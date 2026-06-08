import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const DRIVE_ROOT = '/drive';

/**
 * 从 TRIN_DATA_ACCESSIBLE_PATHS 环境变量读取可访问路径列表
 * 格式: /vol1/1000/Video:/vol1/1000/Music
 */
function getAccessiblePaths(): string[] {
  const raw = process.env.TRIN_DATA_ACCESSIBLE_PATHS || '';
  if (!raw.trim()) {
    return [];
  }
  return raw.split(':').map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * 清理 /drive 下所有旧的符号链接（不删除真实目录）
 */
function cleanupDriveSymlinks(requestedPaths: string[]): void {
  if (!fs.existsSync(DRIVE_ROOT)) {
    fs.mkdirSync(DRIVE_ROOT, { recursive: true });
    return;
  }

  const entries = fs.readdirSync(DRIVE_ROOT, { withFileTypes: true });
  const requestedBasenames = new Set(requestedPaths.map(p => path.basename(p)));

  for (const entry of entries) {
    const entryPath = path.join(DRIVE_ROOT, entry.name);

    if (entry.isSymbolicLink()) {
      // 移除不在请求列表中的符号链接
      if (!requestedBasenames.has(entry.name)) {
        try {
          fs.unlinkSync(entryPath);
          logger.info(`Removed stale symlink: ${entryPath}`);
        } catch (err) {
          logger.warn(`Failed to remove stale symlink: ${entryPath}`, {
            error: (err as Error).message
          });
        }
      }
    }
    // 注意：不删除真实目录，保护用户数据
  }
}

/**
 * 解析符号链接的目标路径
 */
function resolveSymlinkTarget(symlinkPath: string): string | null {
  try {
    return fs.readlinkSync(symlinkPath);
  } catch {
    return null;
  }
}

/**
 * 同步 /drive 下的符号链接：
 * - 为 TRIN_DATA_ACCESSIBLE_PATHS 中的每个路径创建 /drive/{basename} 符号链接
 * - 移除不再需要的旧符号链接
 */
function syncDriveSymlinks(): void {
  const paths = getAccessiblePaths();

  if (paths.length === 0) {
    logger.info('TRIN_DATA_ACCESSIBLE_PATHS is empty, no drive symlinks to create');
    // 仍然清理旧的符号链接
    cleanupDriveSymlinks([]);
    return;
  }

  logger.info(`Syncing drive symlinks for ${paths.length} path(s): ${paths.join(', ')}`);

  // 确保 /drive 目录存在
  if (!fs.existsSync(DRIVE_ROOT)) {
    fs.mkdirSync(DRIVE_ROOT, { recursive: true });
  }

  const validPaths: string[] = [];

  for (const targetPath of paths) {
    const basename = path.basename(targetPath);
    const symlinkPath = path.join(DRIVE_ROOT, basename);

    // 检查目标路径是否存在
    if (!fs.existsSync(targetPath)) {
      logger.warn(`Accessible path does not exist, skipping: ${targetPath}`);
      // 如果符号链接存在但目标不存在，移除它
      if (fs.existsSync(symlinkPath) && fs.lstatSync(symlinkPath).isSymbolicLink()) {
        try {
          fs.unlinkSync(symlinkPath);
          logger.info(`Removed broken symlink: ${symlinkPath}`);
        } catch (err) {
          logger.warn(`Failed to remove broken symlink: ${symlinkPath}`, {
            error: (err as Error).message
          });
        }
      }
      continue;
    }

    validPaths.push(targetPath);

    // 如果已存在同名符号链接
    if (fs.existsSync(symlinkPath)) {
      const stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        const currentTarget = resolveSymlinkTarget(symlinkPath);
        if (currentTarget === targetPath) {
          // 符号链接已正确，无需更新
          logger.debug(`Symlink already correct: ${symlinkPath} -> ${targetPath}`);
          continue;
        }
        // 符号链接指向不同目标，更新它
        try {
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(targetPath, symlinkPath);
          logger.info(`Updated symlink: ${symlinkPath} -> ${targetPath}`);
        } catch (err) {
          logger.warn(`Failed to update symlink: ${symlinkPath}`, {
            error: (err as Error).message
          });
        }
        continue;
      }
      // 已存在真实目录，跳过（保护用户数据）
      if (stat.isDirectory()) {
        logger.warn(`Directory already exists at symlink location, skipping: ${symlinkPath}`);
        continue;
      }
      // 已存在文件，跳过
      logger.warn(`File already exists at symlink location, skipping: ${symlinkPath}`);
      continue;
    }

    // 创建新的符号链接
    try {
      fs.symlinkSync(targetPath, symlinkPath);
      logger.info(`Created symlink: ${symlinkPath} -> ${targetPath}`);
    } catch (err) {
      logger.warn(`Failed to create symlink: ${symlinkPath} -> ${targetPath}`, {
        error: (err as Error).message
      });
    }
  }

  // 清理不再需要的旧符号链接
  cleanupDriveSymlinks(validPaths);
}

// 记录上次已知的 TRIN_APP_STATUS，用于检测变更
let lastAppStatus: string | undefined = process.env.TRIN_APP_STATUS;
let lastAccessiblePaths: string | undefined = process.env.TRIN_DATA_ACCESSIBLE_PATHS;

/**
 * 检查 TRIN_APP_STATUS 是否变为 CONFIG
 * 如果是，重新同步驱动符号链接
 */
function checkConfigStatus(): void {
  const currentStatus = process.env.TRIN_APP_STATUS;
  const currentPaths = process.env.TRIN_DATA_ACCESSIBLE_PATHS;

  // 检测状态变更
  const statusChanged = currentStatus === 'CONFIG' && lastAppStatus !== 'CONFIG';
  // 检测路径变更
  const pathsChanged = currentPaths !== lastAccessiblePaths;

  if (statusChanged || pathsChanged) {
    logger.info(
      `Drive config change detected (status=${currentStatus}, statusChanged=${statusChanged}, pathsChanged=${pathsChanged}), re-syncing...`
    );
    syncDriveSymlinks();

    // 更新跟踪状态
    lastAppStatus = currentStatus;
    lastAccessiblePaths = currentPaths;
  }
}

// 定时器引用
let watchInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化驱动管理器：
 * 1. 启动时同步符号链接
 * 2. 启动定时器检测 TRIN_APP_STATUS 变更
 */
function initialize(): void {
  logger.info('Initializing drive manager...');

  // 首次同步
  syncDriveSymlinks();

  // 每 5 秒检测一次配置变更
  watchInterval = setInterval(() => {
    checkConfigStatus();
  }, 5000);

  logger.info('Drive manager initialized, watching for config changes every 5s');
}

/**
 * 停止驱动管理器
 */
function shutdown(): void {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
    logger.info('Drive manager shutdown');
  }
}

export default {
  initialize,
  shutdown,
  syncDriveSymlinks
};