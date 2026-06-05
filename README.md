# HandBrake Web UI

基于 HandBrake 的 Web 视频转码管理界面

[English Documentation](README_EN.md)

## 特性

- 🌐 响应式 Web UI - 支持桌面端和移动端
- 🔐 JWT 认证系统 - 支持多用户管理
- 🎬 视频转码 - 支持多种编码格式
- 🎥 视频播放 - 内置视频播放器，支持在线预览
- 📊 实时进度 - 实时监控转码进度
- 🐳 Docker 部署 - 一键部署,开箱即用
- 📁 文件管理 - 直观的文件浏览器
- ⚡ 硬件加速 - 支持 Intel/AMD/NVIDIA 硬件转码

## 快速开始

### 使用 Docker Compose 部署 (推荐)

#### 1. 创建 docker-compose.yml

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

#### 2. 启动服务

```bash
# 创建必要目录
mkdir -p config drive

# 启动容器
docker-compose up -d

# 查看实际使用的端口
docker ps

# 查看日志
docker-compose logs -f
```

#### 3. 访问 Web UI

- 默认地址: http://localhost:52389
- 首次访问: 请在页面上设置管理员账号密码

#### 4. 目录结构说明

容器使用统一的 `/drive` 挂载点，所有文件操作都在同一文件系统内。

> ### 💡 核心设计
>
> 只需挂载 **一个文件目录**，即可确保源文件、转码缓存和输出文件均处于同一文件系统中，**避免跨设备移动文件导致的性能开销或操作失败**。

| 容器内路径 | 用途 | 说明 |
|-----------|------|------|
| `/config` | 配置和数据库 | 持久化配置和 SQLite 数据库 |
| `/drive` | 文件存储根目录 | 存放源视频、转码输出、缓存文件 |

#### 5. 转码前配置

首次使用需在 **设置 → 缓存目录** 中通过文件浏览器指定一个临时缓存目录（例如 `/drive/cache`），转码过程中的临时文件会写入此目录。

---

### 使用 Docker 直接部署

```bash
# 拉取镜像
docker pull ray5378/handbrake-webui-fnapp:latest

# 启动容器
docker run -d \
  --name handbrake-webui \
  -p 52389:52389 \
  -v $(pwd)/config:/config \
  -v $(pwd)/drive:/drive \
  --restart unless-stopped \
  ray5378/handbrake-webui-fnapp:latest
```

---

### 本地构建

如果您想自己构建镜像：

```bash
# 克隆项目
git clone https://github.com/ray5378/handbrake-webui.git
cd handbrake-webui

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

### 手动部署

```bash
# 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 启动后端
cd backend && npm start

# 启动前端开发服务器
cd frontend && npm run dev
```

## 目录结构

```
handbrake-webui/
├── docker/              # Docker 配置
├── backend/             # 后端代码
├── frontend/            # 前端代码
├── config/              # 配置目录 (映射)
├── drive/               # 文件存储根目录 (映射)
└── docker-compose.yml   # Docker Compose 配置
```

## 配置说明

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| JWT_SECRET | JWT 密钥 | (随机生成) |
| CONFIG_DIR | 配置目录 | /config |

### 目录映射指南

容器通过两个挂载点持久化数据：

| 宿主机路径 | 容器内路径 | 用途 |
|-----------|-----------|------|
| `./config` | `/config` | SQLite 数据库和配置文件 |
| `./drive` | `/drive` | 源文件、转码输出、缓存等所有文件 |

`/drive` 为单挂载点设计，源文件、转码临时缓存和输出文件都在同一文件系统内，避免跨设备文件移动导致的 `EXDEV` 错误。

### 硬件加速配置

#### Intel/AMD GPU (VA-API/QSV)
默认已启用，通过 `/dev/dri` 设备映射提供支持。

#### NVIDIA GPU (NVENC)
需要先在主机上安装 `nvidia-docker2` 运行时，然后在 `docker-compose.yml` 中取消注释 NVIDIA 配置。

安装 nvidia-docker2 的步骤：
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

## 支持的格式

### 输入格式
- MP4, MKV, AVI, MOV, WMV, FLV, WebM 等

### 输出格式
- MP4 (H.264, H.265)
- MKV (H.264, H.265, VP9, AV1)
- WebM (VP9, AV1)

## 技术栈

- **前端**: React 18 + Vite + Tailwind CSS
- **后端**: Node.js + Express
- **数据库**: SQLite
- **转码**: HandBrake CLI
- **容器化**: Docker + Docker Compose

## 许可证

MIT License
