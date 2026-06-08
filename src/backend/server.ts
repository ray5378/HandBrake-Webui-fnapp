import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import http from 'http';

import config from './src/config';
import errorHandler from './src/middleware/errorHandler';
import authRoutes from './src/routes/auth';
import fileRoutes from './src/routes/files';
import jobRoutes from './src/routes/jobs';
import presetRoutes from './src/routes/presets';
import userRoutes from './src/routes/users';
import systemRoutes from './src/routes/system';
import { startThumbnailCleanup } from './src/services/thumbnailService';
import { closeDatabase } from './src/models/database';
import { killAllJobs } from './src/services/handbrakeService';
import driveManager from './src/services/driveManager';

const app = express();

config.initialize();

// 初始化驱动管理器：读取 TRIN_DATA_ACCESSIBLE_PATHS 并在 /drive 下创建符号链接
// 同时启动定时器检测 TRIN_APP_STATUS 变更，实现动态更新
try {
  driveManager.initialize();
} catch (e: unknown) {
  console.warn('Failed to initialize drive manager, continuing...', (e as Error).message);
}

const cacheDir = config.cacheDir;
if (cacheDir) {
  const cacheTempDir = `${cacheDir}/handbrake-temp`;
  try {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheTempDir, { recursive: true, force: true });
      fs.mkdirSync(cacheTempDir, { recursive: true });
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.warn('Failed to clean cache directory:', err.message);
  }
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
  })
);

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    credentials: true
  })
);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined'));
}

const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many attempts, please try again later.' }
});

app.use('/api/auth/login', authStrictLimiter);
app.use('/api/auth/setup-admin', authStrictLimiter);
app.use('/api/auth/logout', authStrictLimiter);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skip: req => req.originalUrl.startsWith('/api/files/thumbnail'),
  message: { success: false, error: 'Too many requests, please try again later.' }
});

const fileOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many file operations, please try again later.' }
});

app.use('/api/files/search', fileOpsLimiter);
app.use('/api/files/info', fileOpsLimiter);
app.use('/api/files/stream', fileOpsLimiter);
app.use('/api/files/download', fileOpsLimiter);
app.use('/api/files/tree', fileOpsLimiter);
app.use('/api', apiLimiter);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
});

app.use(errorHandler);

const server: http.Server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`HandBrake Web UI server running on port ${config.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (global.gc) {
    console.log('GC monitoring: enabled (--expose-gc active)');
  } else {
    console.warn(
      'GC monitoring: disabled (start with --expose-gc to enable automatic garbage collection)'
    );
  }

  if (config.cacheDir) {
    startThumbnailCleanup();
    console.log('Thumbnail cleanup service started');
  }
});

server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;
server.requestTimeout = 120000;

let gcTimer: ReturnType<typeof setInterval> | null = null;
if (global.gc) {
  gcTimer = setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);

    if (heapUsedMB > heapTotalMB * 0.7 || rssMB > 512) {
      global.gc!();
      console.log(`GC triggered: heap ${heapUsedMB}/${heapTotalMB}MB, rss ${rssMB}MB`);
    }
  }, 60000);
}

const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }

  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    closeDatabase();
  } catch (_e) {
    // ignore
  }

  try {
    killAllJobs();
  } catch (_e2) {
    // ignore
  }

  driveManager.shutdown();

  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
