# === Build stage ===
FROM node:20-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Install build tools needed to compile native addons (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy package files and install all dependencies (including devDeps for tsc)
COPY backend/package*.json ./
RUN npm ci

# Copy backend source and compile TypeScript to JavaScript
COPY backend/tsconfig.json ./
COPY backend/server.ts ./
COPY backend/src ./src
RUN npx tsc

# Install production dependencies only
RUN npm ci --omit=dev

# === Runtime stage ===
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Configure Debian repos to include non-free (needed for Intel VA-API drivers)
RUN echo "deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb-src http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb-src http://deb.debian.org/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb-src http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# Install runtime dependencies only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    handbrake-cli ffmpeg pciutils curl ca-certificates dumb-init \
    libva2 libva-drm2 libva-x11-2 \
    intel-media-va-driver-non-free \
    mesa-va-drivers \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled Node.js modules from builder stage
COPY --from=builder /build/node_modules ./backend/node_modules

# Copy compiled TypeScript output (dist/)
COPY --from=builder /build/dist ./backend/dist

# Copy frontend build output
COPY frontend/dist ./backend/frontend/dist

ENV NODE_ENV=production
ENV PORT=52389
ENV CONFIG_DIR=/config

RUN mkdir -p /config /drive

EXPOSE 52389

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--expose-gc", "/app/backend/dist/server.js"]

ARG VITE_GIT_COMMIT=unknown
ENV VITE_GIT_COMMIT=${VITE_GIT_COMMIT}
LABEL maintainer="HandBrake Web UI Team"
LABEL description="HandBrake Web UI - Web-based video transcoding management"
LABEL org.opencontainers.image.source="https://github.com/ray5378/HandBrake-Webui"
LABEL org.opencontainers.image.licenses="MIT"