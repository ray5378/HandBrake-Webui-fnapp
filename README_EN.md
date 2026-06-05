# HandBrake Web UI

Web-based video transcoding management interface powered by HandBrake

[中文文档](README.md)

## Features

- 🌐 Responsive Web UI — desktop and mobile friendly
- 🔐 JWT Authentication — multi-user management
- 🎬 Video Transcoding — supports multiple codec formats
- 🎥 Video Playback — built-in video player with online preview
- 📊 Live Progress — real-time transcoding progress monitoring
- 🐳 Docker Deployment — one-click setup, ready to use
- 📁 File Management — intuitive file browser
- ⚡ Hardware Acceleration — Intel/AMD/NVIDIA hardware transcoding

## Quick Start

### Deploy with Docker Compose (Recommended)

#### 1. Create docker-compose.yml

```yaml
services:
  handbrake-webui:
    image: ray5378/handbrake-webui-fnapp:latest
    container_name: handbrake-webui
    ports:
      - 52389:52389
    volumes:
      - ./config:/config
      - ./drive:/drive
    restart: unless-stopped
    devices:
      - /dev/dri:/dev/dri
```

#### 2. Start the Service

```bash
# Create required directories
mkdir -p config drive

# Start the container
docker-compose up -d

# Check the actual port in use
docker ps

# View logs
docker-compose logs -f
```

#### 3. Access the Web UI

- Default address: http://localhost:52389
- First visit: set up admin account and password on the page

#### 4. Directory Structure

The container uses a unified `/drive` mount point. All file operations occur within the same filesystem.

> ### 💡 Core Design
>
> Mount only **one file directory** to ensure source files, transcode cache, and output files all reside on the same filesystem, **avoiding performance overhead or operation failures caused by cross-device file moves**.

| Container Path | Purpose | Description |
|---------------|---------|-------------|
| `/config` | Configuration & Database | Persists config and SQLite database |
| `/drive` | File Storage Root | Stores source videos, transcode output, and cache files |

#### 5. Pre-Transcode Configuration

On first use, go to **Settings → Cache Directory** and use the file browser to specify a temporary cache directory (e.g., `/drive/cache`). Temporary files during transcoding will be written to this directory.

---

### Deploy with Docker Directly

```bash
# Pull the image
docker pull ray5378/handbrake-webui-fnapp:latest

# Start the container
docker run -d \
  --name handbrake-webui \
  -p 52389:52389 \
  -v $(pwd)/config:/config \
  -v $(pwd)/drive:/drive \
  --restart unless-stopped \
  ray5378/handbrake-webui-fnapp:latest
```

---

### Build Locally

If you want to build the image yourself:

```bash
# Clone the project
git clone https://github.com/ray5378/handbrake-webui.git
cd handbrake-webui

# Build the image
docker-compose build

# Start the service
docker-compose up -d
```

### Manual Deployment

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend && npm start

# Start frontend dev server
cd frontend && npm run dev
```

## Directory Structure

```
handbrake-webui/
├── docker/              # Docker configuration
├── backend/             # Backend source code
├── frontend/            # Frontend source code
├── config/              # Configuration directory (mapped)
├── drive/               # File storage root (mapped)
└── docker-compose.yml   # Docker Compose configuration
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| JWT_SECRET | JWT secret key | (randomly generated) |
| CONFIG_DIR | Configuration directory | /config |

### Directory Mapping Guide

The container persists data through two mount points:

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `./config` | `/config` | SQLite database and configuration files |
| `./drive` | `/drive` | All files: source, transcode output, cache, etc. |

`/drive` uses a single mount point design — source files, transcode temp cache, and output files all reside on the same filesystem, preventing `EXDEV` errors from cross-device file operations.

### Hardware Acceleration Setup

#### Intel/AMD GPU (VA-API/QSV)

Enabled by default, supported through `/dev/dri` device mapping.

#### NVIDIA GPU (NVENC)

Requires installing the `nvidia-docker2` runtime on the host machine first, then uncomment the NVIDIA configuration in `docker-compose.yml`.

Steps to install nvidia-docker2:

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

## Supported Formats

### Input Formats

- MP4, MKV, AVI, MOV, WMV, FLV, WebM, and more

### Output Formats

- MP4 (H.264, H.265)
- MKV (H.264, H.265, VP9, AV1)
- WebM (VP9, AV1)

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Transcoding**: HandBrake CLI
- **Containerization**: Docker + Docker Compose

## License

MIT License