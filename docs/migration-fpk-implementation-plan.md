# HandBrake-Webui → fnOS fpk 迁移实施计划

> **For agentic workers:** 按任务顺序逐步实施。步骤使用 `- [ ]` 复选框跟踪进度。

**目标:** 将 HandBrake-Webui (Node.js + React + HandBrake CLI Docker 应用) 包装为 fnOS fpk 原生应用包，使其可从应用中心一键安装，桌面生成图标，支持 FN Connect 远程访问。

**方案:** Docker-based fpk — 在 fpk 生命周期脚本中通过 Docker CLI 管理容器（安装时拉取镜像并运行，停止时停容器，卸载时删容器）。复用现有 Dockerfile 和镜像，无需修改 HandBrake-Webui 源码。

**技术栈:** fnpack (fnOS 打包工具), Bash (生命周期脚本), Docker (容器运行时), HandBrake-Webui 现有 Docker 镜像

**项目结构:**
```
/workspace/
├── fpk/                              # fpk 打包源目录
│   ├── manifest                      # 应用元数据
│   ├── ICON.PNG                      # 应用图标 256x256
│   ├── ICON_256.PNG                  # 高清图标
│   ├── app/
│   │   ├── ui/config                 # UI 入口配置 (JSON)
│   │   └── images/icon.png           # UI 图标
│   ├── cmd/
│   │   ├── main                      # 生命周期管理 (安装/启停/升级/卸载)
│   │   ├── install_init              # 安装前初始化
│   │   ├── install_callback          # 安装后回调
│   │   ├── uninstall_init            # 卸载前回调
│   │   ├── uninstall_callback        # 卸载后回调
│   │   ├── upgrade_init              # 升级前回调
│   │   ├── upgrade_callback          # 升级后回调
│   │   ├── service                   # systemd service 定义
│   │   ├── config                    # 配置生成脚本
│   │   └── common                    # 公共函数库
│   └── config/
│       ├── privilege                 # 权限配置
│       └── resource                  # 资源配置
└── scripts/
    └── build-fpk.sh                  # fpk 打包构建脚本
```

---

## 任务 1: 创建 manifest 应用元数据

**文件:**
- 创建: `/workspace/fpk/manifest`

- [ ] **步骤 1: 编写 manifest 文件**

manifest 是 fpk 应用的核心元数据描述文件，使用 INI-style 键值对格式。

```ini
appname               = App.ThirdParty.HandBrakeWebui
version               = 1.0.0
display_name          = HandBrake 转码
desc                  = 基于 Web 界面的 HandBrake 视频转码管理工具，支持队列管理、预设管理和 Intel QSV / VA-API 硬件加速。基于 HandBrake CLI + FFmpeg 实现高效视频转码。
platform              = x86
source                = thirdparty
maintainer            = ray5378
maintainer_url        = https://github.com/ray5378/HandBrake-Webui
distributor           = ray5378
distributor_url       = https://github.com/ray5378/HandBrake-Webui
os_min_version        = 0.9.27
ctl_stop              = true
desktop_uidir         = ui
desktop_applaunchname = App.ThirdParty.HandBrakeWebui.Web
service_port          = 52389
checkport             = false
```

**字段说明:**

| 字段 | 值 | 说明 |
|---|---|---|
| `appname` | `App.ThirdParty.HandBrakeWebui` | 应用唯一标识。`App.ThirdParty` 前缀标识第三方应用 |
| `version` | `1.0.0` | 当前版本号，遵循 SemVer |
| `display_name` | `HandBrake 转码` | 桌面和应用中心显示的名称 |
| `desc` | ... | 应用描述，显示在应用中心详情页 |
| `platform` | `x86` | 支持 x86_64 架构（ARM64 待后续支持） |
| `source` | `thirdparty` | 来源类型，第三方应用 |
| `os_min_version` | `0.9.27` | 最低 fnOS 版本要求 |
| `ctl_stop` | `true` | 允许用户在应用中心停止/启动应用 |
| `desktop_uidir` | `ui` | UI 配置目录名（相对于 app/） |
| `desktop_applaunchname` | `App.ThirdParty.HandBrakeWebui.Web` | 桌面入口标识，需与 app/ui/config 中的键名匹配 |
| `service_port` | `52389` | 容器内部监听端口 |
| `checkport` | `false` | 不检查端口占用（使用 host 网络模式） |

- [ ] **步骤 2: 验证 manifest 格式**

```bash
# manifest 文件不应包含 BOM，使用 UTF-8 编码
file /workspace/fpk/manifest
# 应输出: ASCII text 或 UTF-8 Unicode text
```

---

## 任务 2: 创建 UI 入口配置和图标

**文件:**
- 创建: `/workspace/fpk/app/ui/config`
- 创建: `/workspace/fpk/app/images/icon.png`

- [ ] **步骤 1: 编写 app/ui/config**

UI 入口配置定义应用在 fnOS 桌面如何打开。使用 iframe 类型在桌面窗口内嵌入 Web UI。

```json
{
    ".url": {
        "App.ThirdParty.HandBrakeWebui.Web": {
            "title": "HandBrake 转码",
            "icon": "images/icon-{0}.png",
            "type": "iframe",
            "protocol": "http",
            "url": "/cgi/ThirdParty/App.ThirdParty.HandBrakeWebui/index.cgi/",
            "allUsers": true
        }
    }
}
```

**配置说明:**

| 字段 | 值 | 说明 |
|---|---|---|
| `App.ThirdParty.HandBrakeWebui.Web` | — | 入口标识，必须与 manifest 中 `desktop_applaunchname` 一致 |
| `title` | `HandBrake 转码` | 桌面图标下方显示的名称 |
| `icon` | `images/icon-{0}.png` | 图标路径，`{0}` 会被替换为桌面主题（light/dark） |
| `type` | `iframe` | 在桌面窗口内打开，而非新标签页 |
| `protocol` | `http` | 后端协议 |
| `url` | `/cgi/ThirdParty/.../index.cgi/` | fnOS Nginx 反向代理路径，自动路由到容器端口 |
| `allUsers` | `true` | 所有用户均可看到此应用 |

- [ ] **步骤 2: 生成应用图标**

使用 ImageMagick 生成一个简单的占位图标（实际发布时替换为正式图标）：

```bash
# 生成 256x256 PNG 图标
convert -size 256x256 xc:'#4A90D9' \
  -fill white -font Helvetica -pointsize 120 \
  -gravity center -annotate 0 'HB' \
  /workspace/fpk/ICON.PNG

# 复制为高清图标
cp /workspace/fpk/ICON.PNG /workspace/fpk/ICON_256.PNG

# 生成 UI 图标
mkdir -p /workspace/fpk/app/images
cp /workspace/fpk/ICON.PNG /workspace/fpk/app/images/icon.png

# 验证
file /workspace/fpk/ICON.PNG
# 应输出: PNG image data, 256 x 256
```

---

## 任务 3: 编写 cmd/common 公共函数库

**文件:**
- 创建: `/workspace/fpk/cmd/common`

- [ ] **步骤 1: 编写公共函数库**

公共函数被所有生命周期脚本引用，提供日志、Docker 操作、路径解析等通用能力。

```bash
#!/bin/bash
# ============================================================
# HandBrake-Webui fpk — 公共函数库
# 被 cmd/main 和所有回调脚本 source 引用
# ============================================================

set -e

# ---- 应用信息 ----
APP_NAME="App.ThirdParty.HandBrakeWebui"
CONTAINER_NAME="handbrake-webui"
IMAGE_NAME="ray5378/handbrake-webui-fnapp:latest"
INTERNAL_PORT="52389"

# ---- 路径解析 ----
# fnOS 应用路径约定:
#   /var/apps/{appname}/           — 应用根目录
#   /var/apps/{appname}/var/       — 可写数据目录
#   /var/apps/{appname}/target/    — 链接到 /usr/local/apps/@appcenter/{appname}/
#   /usr/local/apps/@appdata/{appname}/  — 应用数据持久化目录

# 尝试多个可能的路径来定位应用根目录
find_app_root() {
    local candidates=(
        "/var/apps/${APP_NAME}"
        "/usr/local/apps/@appcenter/${APP_NAME}"
    )
    for dir in "${candidates[@]}"; do
        if [ -d "$dir" ]; then
            echo "$dir"
            return 0
        fi
    done
    # 默认回退
    echo "/var/apps/${APP_NAME}"
}

APP_ROOT=$(find_app_root)
APP_VAR="${APP_ROOT}/var"
APP_CONFIG="${APP_VAR}/config"

# ---- 日志函数 ----
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $*" >&2
}

log_warn() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

# ---- Docker 操作 ----

# 确保 Docker 守护进程可用
ensure_docker() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker 不可用，请确认 fnOS Docker 服务已启动"
        return 1
    fi
    if ! docker info &>/dev/null; then
        log_error "Docker 守护进程未运行"
        return 1
    fi
    log_info "Docker 就绪"
    return 0
}

# 检查容器是否存在
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"
}

# 检查容器是否运行中
container_running() {
    docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"
}

# 获取容器状态
get_container_status() {
    if container_running; then
        echo "running"
    elif container_exists; then
        echo "existed"
    else
        echo "absent"
    fi
}

# ---- 持久化配置管理 ----

# 确保配置目录存在
ensure_config_dir() {
    mkdir -p "${APP_CONFIG}"
    log_info "配置目录: ${APP_CONFIG}"
}

# 读取持久化配置值
get_config() {
    local key="$1"
    local default="$2"
    local config_file="${APP_CONFIG}/fpk.conf"
    if [ -f "$config_file" ]; then
        grep -s "^${key}=" "$config_file" | cut -d= -f2- || echo "$default"
    else
        echo "$default"
    fi
}

# 写入持久化配置值
set_config() {
    local key="$1"
    local value="$2"
    local config_file="${APP_CONFIG}/fpk.conf"
    ensure_config_dir
    if grep -qs "^${key}=" "$config_file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$config_file"
    else
        echo "${key}=${value}" >> "$config_file"
    fi
}

# ---- 数据卷映射 ----

# 获取用户配置的视频数据目录
get_data_volume() {
    local saved_path
    saved_path=$(get_config "drive_path" "")
    if [ -n "$saved_path" ] && [ -d "$saved_path" ]; then
        echo "$saved_path"
    else
        echo ""
    fi
}

# ---- 容器启动模板 ----
generate_docker_run_cmd() {
    local data_vol="$1"
    local cmd="docker run -d \\
        --name ${CONTAINER_NAME} \\
        --restart unless-stopped \\
        --network host \\
        -v ${APP_CONFIG}:/config \\
        -e PORT=${INTERNAL_PORT} \\
        -e CONFIG_DIR=/config \\
        -e NODE_ENV=production"

    if [ -n "$data_vol" ]; then
        cmd="${cmd} \\
        -v ${data_vol}:/drive"
    fi

    # 透传 GPU 加速设备
    if [ -e /dev/dri ]; then
        cmd="${cmd} \\
        --device /dev/dri:/dev/dri"
    fi

    cmd="${cmd} \\
        ${IMAGE_NAME}"

    echo "$cmd"
}
```

---

## 任务 4: 编写 cmd/main 生命周期管理脚本

**文件:**
- 创建: `/workspace/fpk/cmd/main`

- [ ] **步骤 1: 编写 cmd/main 主脚本**

cmd/main 是 fpk 的核心生命周期脚本，fnOS 应用中心通过调用此脚本并传入不同参数来管理应用。

```bash
#!/bin/bash
# ============================================================
# HandBrake-Webui fpk — 主生命周期管理脚本
# 被 fnOS appcenter 调用，参数: {install|start|stop|status|restart|uninstall|upgrade}
# ============================================================

# 加载公共函数库
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# source 路径兼容（cmd/main 或 target/cmd/main）
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
elif [ -f "$(dirname "${SCRIPT_DIR}")/cmd/common" ]; then
    source "$(dirname "${SCRIPT_DIR}")/cmd/common"
else
    # 从已知路径加载
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || {
        echo "FATAL: 无法加载公共函数库" >&2
        exit 1
    }
fi

ACTION="${1:-help}"

# ============================================================
# 安装
# ============================================================
do_install() {
    log_info "===== 开始安装 ${APP_NAME} ====="

    ensure_docker || return 1
    ensure_config_dir

    # 检查是否已存在同名容器
    if container_exists; then
        log_warn "容器 ${CONTAINER_NAME} 已存在，跳过创建"
        # 确保容器在运行
        if ! container_running; then
            log_info "启动已有容器..."
            docker start "${CONTAINER_NAME}" || return 1
        fi
        log_info "安装完成"
        return 0
    fi

    # 拉取镜像
    log_info "正在拉取 Docker 镜像: ${IMAGE_NAME}..."
    docker pull "${IMAGE_NAME}" 2>&1 | tail -5
    local pull_ret=${PIPESTATUS[0]}
    if [ $pull_ret -ne 0 ]; then
        log_error "镜像拉取失败 (exit: $pull_ret)"
        return 1
    fi
    log_info "镜像拉取完成"

    # 获取数据目录
    local data_vol
    data_vol=$(get_data_volume)

    # 启动容器
    log_info "正在创建并启动容器..."
    local run_cmd
    run_cmd=$(generate_docker_run_cmd "$data_vol")
    eval "$run_cmd" || return 1

    # 等待服务就绪
    log_info "等待服务就绪..."
    local retry=0
    local max_retry=30
    while [ $retry -lt $max_retry ]; do
        if curl -s "http://localhost:${INTERNAL_PORT}/api/system/health" >/dev/null 2>&1; then
            log_info "服务已就绪"
            break
        fi
        sleep 2
        retry=$((retry + 1))
    done

    if [ $retry -ge $max_retry ]; then
        log_warn "服务启动超时，请稍后检查容器日志"
    fi

    log_info "===== 安装完成 ====="
    return 0
}

# ============================================================
# 启动
# ============================================================
do_start() {
    log_info "===== 启动 ${CONTAINER_NAME} ====="

    ensure_docker || return 1

    if container_running; then
        log_info "容器已在运行中"
        return 0
    fi

    if container_exists; then
        log_info "启动已有容器..."
        docker start "${CONTAINER_NAME}" || {
            log_error "容器启动失败"
            return 1
        }
    else
        log_warn "容器不存在，执行安装流程..."
        do_install || return 1
    fi

    log_info "容器已启动"
    return 0
}

# ============================================================
# 停止
# ============================================================
do_stop() {
    log_info "===== 停止 ${CONTAINER_NAME} ====="

    ensure_docker || return 1

    if ! container_exists; then
        log_info "容器不存在，无需停止"
        return 0
    fi

    if ! container_running; then
        log_info "容器已停止"
        return 0
    fi

    # 优雅关闭：先发 SIGTERM，等待 30 秒
    log_info "正在停止容器（优雅关闭）..."
    docker stop -t 30 "${CONTAINER_NAME}" || {
        log_warn "优雅停止超时，强制停止..."
        docker kill "${CONTAINER_NAME}" || true
    }

    log_info "容器已停止"
    return 0
}

# ============================================================
# 状态
# ============================================================
do_status() {
    ensure_docker 2>/dev/null || {
        echo "stopped"
        return 0
    }

    if container_running; then
        local uptime
        uptime=$(docker inspect "${CONTAINER_NAME}" --format='{{.State.StartedAt}}' 2>/dev/null || echo "unknown")
        echo "running (since: ${uptime})"
    elif container_exists; then
        echo "stopped"
    else
        echo "not_installed"
    fi
    return 0
}

# ============================================================
# 重启
# ============================================================
do_restart() {
    log_info "===== 重启 ${CONTAINER_NAME} ====="
    do_stop || true
    sleep 2
    do_start || return 1
    log_info "重启完成"
    return 0
}

# ============================================================
# 卸载
# ============================================================
do_uninstall() {
    log_info "===== 卸载 ${APP_NAME} ====="

    ensure_docker 2>/dev/null || {
        log_info "Docker 不可用，跳过容器清理"
        return 0
    }

    if container_exists; then
        log_info "正在停止并删除容器..."
        docker stop -t 10 "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || {
            log_error "容器删除失败"
            return 1
        }
        log_info "容器已删除"
    else
        log_info "容器不存在，跳过"
    fi

    # 询问是否保留数据（fnOS 会在 UI 交互中决定）
    local keep_data
    keep_data=$(get_config "keep_data_on_uninstall" "true")
    if [ "$keep_data" = "false" ]; then
        log_info "清理数据目录: ${APP_CONFIG}"
        rm -rf "${APP_CONFIG}" 2>/dev/null || true
    else
        log_info "保留数据目录: ${APP_CONFIG}"
    fi

    log_info "===== 卸载完成 ====="
    return 0
}

# ============================================================
# 升级
# ============================================================
do_upgrade() {
    log_info "===== 升级 ${APP_NAME} ====="

    ensure_docker || return 1

    # 拉取新镜像
    log_info "正在拉取最新镜像: ${IMAGE_NAME}..."
    docker pull "${IMAGE_NAME}" 2>&1 | tail -5
    local pull_ret=${PIPESTATUS[0]}
    if [ $pull_ret -ne 0 ]; then
        log_error "镜像拉取失败 (exit: $pull_ret)"
        return 1
    fi

    if ! container_exists; then
        log_info "容器不存在，直接安装新版本..."
        do_install || return 1
        log_info "===== 升级完成 ====="
        return 0
    fi

    # 记录旧容器配置
    local old_data_vol
    old_data_vol=$(docker inspect "${CONTAINER_NAME}" --format '{{range .Mounts}}{{if eq .Destination "/drive"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$old_data_vol" ]; then
        set_config "drive_path" "$old_data_vol"
        log_info "保留数据卷映射: ${old_data_vol}"
    fi

    # 停止并删除旧容器
    log_info "停止旧容器..."
    docker stop -t 30 "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
    log_info "旧容器已删除"

    # 创建新容器
    log_info "创建新容器..."
    local data_vol
    data_vol=$(get_data_volume)
    local run_cmd
    run_cmd=$(generate_docker_run_cmd "$data_vol")
    eval "$run_cmd" || return 1
    log_info "新容器已启动"

    log_info "===== 升级完成 ====="
    return 0
}

# ============================================================
# 主入口
# ============================================================
case "${ACTION}" in
    install)
        do_install
        ;;
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    status)
        do_status
        ;;
    restart)
        do_restart
        ;;
    uninstall)
        do_uninstall
        ;;
    upgrade)
        do_upgrade
        ;;
    *)
        echo "用法: $0 {install|start|stop|status|restart|uninstall|upgrade}"
        echo "当前状态: $(do_status)"
        exit 1
        ;;
esac

exit $?
```

---

## 任务 5: 编写 cmd 回调脚本

**文件:**
- 创建: `/workspace/fpk/cmd/install_init`
- 创建: `/workspace/fpk/cmd/install_callback`
- 创建: `/workspace/fpk/cmd/uninstall_init`
- 创建: `/workspace/fpk/cmd/uninstall_callback`
- 创建: `/workspace/fpk cmd/upgrade_init`
- 创建: `/workspace/fpk/cmd/upgrade_callback`

- [ ] **步骤 1: 编写 install_init (安装前)**

```bash
#!/bin/bash
# ============================================================
# 安装前初始化 — 检查环境和前置条件
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 安装前检查 ====="

# 1. 检查 Docker 是否可用
if ! command -v docker &>/dev/null; then
    log_error "Docker 未安装。请确认 fnOS 系统正常。"
    exit 1
fi

# 2. 检查磁盘空间（至少需要 2GB 用于 Docker 镜像）
AVAILABLE_KB=$(df /var/apps | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_KB" -lt 2097152 ]; then
    log_error "磁盘空间不足。需要至少 2GB 可用空间。"
    exit 1
fi
log_info "磁盘空间: $((AVAILABLE_KB / 1024))MB 可用"

# 3. 检查是否已安装（避免同名容器冲突）
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    log_warn "发现同名容器 ${CONTAINER_NAME}，将在安装时复用"
fi

log_info "环境检查通过"
exit 0
```

- [ ] **步骤 2: 编写 install_callback (安装后)**

```bash
#!/bin/bash
# ============================================================
# 安装后回调 — 安装完成后的收尾工作
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 安装后处理 ====="

# 检查服务是否正常运行
if curl -s "http://localhost:${INTERNAL_PORT}/api/system/health" >/dev/null 2>&1; then
    log_info "HandBrake-Webui 服务运行正常"
else
    log_warn "服务暂未响应，可能在启动中，请稍候检查"
fi

# 记录安装信息
set_config "install_version" "1.0.0"
set_config "install_time" "$(date '+%Y-%m-%d %H:%M:%S')"

log_info "===== 安装后处理完成 ====="
exit 0
```

- [ ] **步骤 3: 编写 uninstall_init (卸载前)**

```bash
#!/bin/bash
# ============================================================
# 卸载前回调 — 询问用户是否保留数据
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 卸载前准备 ====="

# 通知用户数据保留选项
# fnOS 会在卸载对话框中提示用户选择
log_info "卸载时将保留配置和数据目录: ${APP_CONFIG}"
log_info "如需清理数据，卸载后手动删除: rm -rf ${APP_CONFIG}"

# 保存用户选择（fnOS 框架会通过环境变量传递用户选择）
if [ "${UNINSTALL_KEEP_DATA}" = "false" ]; then
    set_config "keep_data_on_uninstall" "false"
    log_info "用户选择清理数据"
else
    set_config "keep_data_on_uninstall" "true"
    log_info "用户选择保留数据"
fi

exit 0
```

- [ ] **步骤 4: 编写 uninstall_callback (卸载后)**

```bash
#!/bin/bash
# ============================================================
# 卸载后回调 — 清理工作
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 卸载后清理 ====="

# 清理 Docker 镜像（可选，节省空间）
KEEP_IMAGE=$(get_config "keep_image_on_uninstall" "false")
if [ "$KEEP_IMAGE" = "false" ]; then
    log_info "清理 Docker 镜像: ${IMAGE_NAME}"
    docker rmi "${IMAGE_NAME}" 2>/dev/null || log_warn "镜像清理失败（可能被其他容器使用）"
fi

log_info "===== 卸载后清理完成 ====="
exit 0
```

- [ ] **步骤 5: 编写 upgrade_init (升级前)**

```bash
#!/bin/bash
# ============================================================
# 升级前回调 — 备份当前配置
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 升级前备份 ====="

# 备份配置目录
BACKUP_DIR="${APP_CONFIG}/backup/pre-upgrade-$(date '+%Y%m%d%H%M%S')"
mkdir -p "${BACKUP_DIR}"

if [ -d "${APP_CONFIG}" ]; then
    cp -r "${APP_CONFIG}"/* "${BACKUP_DIR}/" 2>/dev/null || true
    log_info "配置已备份到: ${BACKUP_DIR}"
fi

# 保存旧版本信息
if container_exists; then
    local old_version
    old_version=$(docker inspect "${CONTAINER_NAME}" --format '{{.Config.Image}}' 2>/dev/null || echo "unknown")
    set_config "pre_upgrade_image" "$old_version"
    log_info "旧版本镜像: ${old_version}"
fi

log_info "===== 升级前备份完成 ====="
exit 0
```

- [ ] **步骤 6: 编写 upgrade_callback (升级后)**

```bash
#!/bin/bash
# ============================================================
# 升级后回调 — 验证新版本并清理旧备份
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

log_info "===== 升级后验证 ====="

# 验证服务
for i in $(seq 1 12); do
    if curl -s "http://localhost:${INTERNAL_PORT}/api/system/health" >/dev/null 2>&1; then
        log_info "新版本服务运行正常"
        set_config "upgrade_status" "success"
        set_config "upgrade_time" "$(date '+%Y-%m-%d %H:%M:%S')"

        # 清理超过 3 天的旧备份
        find "${APP_CONFIG}/backup" -type d -mtime +3 -exec rm -rf {} + 2>/dev/null || true

        log_info "===== 升级后验证完成 ====="
        exit 0
    fi
    sleep 5
done

log_error "升级后服务未能在 60 秒内就绪"
set_config "upgrade_status" "failed"

# 回滚提示
log_warn "如需回滚，请执行:"
log_warn "  docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}"
log_warn "  docker run -d --name ${CONTAINER_NAME} ... \$(get_config pre_upgrade_image)"

exit 1
```

- [ ] **步骤 7: 设置所有脚本的可执行权限**

```bash
chmod +x /workspace/fpk/cmd/{main,install_init,install_callback,uninstall_init,uninstall_callback,upgrade_init,upgrade_callback,common}
```

---

## 任务 6: 编写 cmd/service 和 cmd/config

**文件:**
- 创建: `/workspace/fpk/cmd/service`
- 创建: `/workspace/fpk/cmd/config`

- [ ] **步骤 1: 编写 cmd/service**

定义 systemd service 配置，确保 fnOS 可以管理容器的生命周期。

```bash
#!/bin/bash
# ============================================================
# 生成 systemd service 配置
# 输出到 stdout，由 appcenter 捕获并注册
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

# 生成 service 单元配置
cat << EOF
[Unit]
Description=HandBrake Web UI (Docker)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${SCRIPT_DIR}/main start
ExecStop=${SCRIPT_DIR}/main stop
ExecReload=${SCRIPT_DIR}/main restart
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

exit 0
```

- [ ] **步骤 2: 编写 cmd/config**

处理首次运行时的配置初始化。

```bash
#!/bin/bash
# ============================================================
# 配置初始化脚本
# 在首次安装时生成默认配置
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/common" ]; then
    source "${SCRIPT_DIR}/common"
else
    source "/var/apps/${APP_NAME}/cmd/common" 2>/dev/null || exit 1
fi

ensure_config_dir

# 如果配置文件不存在，生成默认配置
CONFIG_FILE="${APP_CONFIG}/fpk.conf"
if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << 'EOFCONF'
# HandBrake-Webui fpk 持久化配置
# 此文件由生命周期脚本自动管理
install_version=1.0.0
keep_data_on_uninstall=true
keep_image_on_uninstall=false
drive_path=
EOFCONF
    log_info "默认配置文件已生成: ${CONFIG_FILE}"
else
    log_info "配置文件已存在: ${CONFIG_FILE}"
fi

exit 0
```

- [ ] **步骤 3: 设置可执行权限**

```bash
chmod +x /workspace/fpk/cmd/{service,config}
```

---

## 任务 7: 编写 config/privilege 和 config/resource

**文件:**
- 创建: `/workspace/fpk/config/privilege`
- 创建: `/workspace/fpk/config/resource`

- [ ] **步骤 1: 编写 config/privilege**

权限配置定义应用运行所需的系统权限，包括 Docker 访问和设备透传。

```bash
#!/bin/bash
# ============================================================
# 权限配置
# 定义应用运行所需的系统权限和设备访问
# ============================================================

# Docker 访问权限（应用通过 Docker CLI 管理容器）
allow_docker=true

# 硬件设备透传 — Intel QSV / VA-API 视频硬件加速
# /dev/dri 包含 renderD128 (VA-API) 和 card0 (QSV) 设备
allow_dev_dri=true

# 网络配置 — 使用 host 网络模式
allow_network_host=true

# 特权模式 — 不需要完整特权，仅设备透传即可
privileged=false

# 允许的 capability
capabilities=(
    SYS_ADMIN   # 某些 GPU 驱动需要
)

echo "privilege configuration loaded"
exit 0
```

- [ ] **步骤 2: 编写 config/resource**

资源配置定义应用可以使用的系统资源限制。

```bash
#!/bin/bash
# ============================================================
# 资源配置
# 定义应用的资源限制和建议值
# ============================================================

# CPU 限制
# 空 = 不限制（转码任务需要充分利用 CPU）
cpu_shares=1024   # 默认 CPU 权重（1024 = 基准）

# 内存限制
# 转码任务可能消耗大量内存，建议不限制或设较高值
memory_limit=0    # 0 = 不限制（单位: MB）
memory_reservation=1024  # 预留内存（单位: MB）

# 磁盘 I/O
io_read_bps=0     # 0 = 不限制
io_write_bps=0    # 0 = 不限制

echo "resource configuration loaded"
exit 0
```

- [ ] **步骤 3: 设置可执行权限**

```bash
chmod +x /workspace/fpk/config/{privilege,resource}
```

---

## 任务 8: 编写 fpk 打包构建脚本

**文件:**
- 创建: `/workspace/scripts/build-fpk.sh`

- [ ] **步骤 1: 编写构建脚本**

此脚本检查 fnpack 工具、组装 fpk 目录、执行打包。

```bash
#!/bin/bash
# ============================================================
# HandBrake-Webui fpk 打包构建脚本
# 使用方法: ./scripts/build-fpk.sh [version]
# 示例: ./scripts/build-fpk.sh 1.0.0
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FPK_SOURCE="${PROJECT_ROOT}/fpk"
OUTPUT_DIR="${PROJECT_ROOT}/dist"
VERSION="${1:-1.0.0}"
APP_NAME="App.ThirdParty.HandBrakeWebui"
FPK_FILE="${OUTPUT_DIR}/${APP_NAME}-${VERSION}.fpk"

echo "========================================"
echo " HandBrake-Webui fpk 打包构建"
echo " Version: ${VERSION}"
echo "========================================"

# ---- 检查依赖 ----
echo "[1/5] 检查依赖..."

FNPAKCK_CMD=""
for cmd in fnpack /usr/local/bin/fnpack ./fnpack; do
    if command -v "$cmd" &>/dev/null; then
        FNPAKCK_CMD="$cmd"
        break
    fi
done

if [ -z "$FNPAKCK_CMD" ]; then
    echo "ERROR: fnpack 未安装。请从 https://developer.fnnas.com/ 下载。"
    echo "  安装: chmod +x fnpack-*-linux-amd64 && sudo mv fnpack-*-linux-amd64 /usr/local/bin/fnpack"
    exit 1
fi
echo "  fnpack: ${FNPAKCK_CMD}"

# 检查 ImageMagick (用于生成图标)
if ! command -v convert &>/dev/null; then
    echo "WARN: ImageMagick 未安装，跳过图标生成"
    echo "  安装: sudo apt install imagemagick"
fi

# ---- 更新版本号 ----
echo "[2/5] 更新版本号..."
sed -i "s/^version[[:space:]]*=.*/version               = ${VERSION}/" "${FPK_SOURCE}/manifest"
echo "  manifest 版本已更新为 ${VERSION}"

# ---- 生成图标（如果不存在）---
echo "[3/5] 检查图标..."
if [ ! -f "${FPK_SOURCE}/ICON.PNG" ]; then
    if command -v convert &>/dev/null; then
        echo "  生成默认图标..."
        convert -size 256x256 xc:'#4A90D9' \
            -fill white -font Helvetica -pointsize 120 \
            -gravity center -annotate 0 'HB' \
            "${FPK_SOURCE}/ICON.PNG"
        cp "${FPK_SOURCE}/ICON.PNG" "${FPK_SOURCE}/ICON_256.PNG"
        cp "${FPK_SOURCE}/ICON.PNG" "${FPK_SOURCE}/app/images/icon.png"
    else
        echo "WARN: 无图标文件且无法生成，请手动创建 ICON.PNG"
    fi
fi

# ---- 设置脚本权限 ----
echo "[4/5] 设置脚本权限..."
chmod +x "${FPK_SOURCE}/cmd/"* 2>/dev/null || true
chmod +x "${FPK_SOURCE}/config/"* 2>/dev/null || true

# ---- 打包 ----
echo "[5/5] 执行 fnpack build..."
mkdir -p "${OUTPUT_DIR}"

# fnpack build 会在当前目录生成 .fpk 文件
cd "${FPK_SOURCE}"
if [ -f "manifest" ]; then
    # fnpack build 命令
    ${FNPAKCK_CMD} build . 2>&1 || {
        # 如果 build . 失败，尝试进入父目录打包
        echo "  尝试备选打包方式..."
        ${FNPAKCK_CMD} build "${FPK_SOURCE}" 2>&1 || {
            echo "ERROR: fpk 打包失败"
            exit 1
        }
    }
fi

# 查找生成的 fpk 文件
GENERATED_FPK=$(find "${FPK_SOURCE}" -maxdepth 1 -name "*.fpk" -type f 2>/dev/null | head -1)
if [ -n "$GENERATED_FPK" ]; then
    mv "$GENERATED_FPK" "${FPK_FILE}"
    echo ""
    echo "========================================"
    echo " 打包成功!"
    echo " 输出: ${FPK_FILE}"
    echo " 大小: $(du -h "${FPK_FILE}" | cut -f1)"
    echo "========================================"
else
    echo "WARN: 未找到生成的 fpk 文件，请检查 fnpack 输出"
    echo "  预期输出到: ${FPK_FILE}"
fi

# 生成校验和
cd "${OUTPUT_DIR}"
sha256sum "${APP_NAME}-${VERSION}.fpk" > "${APP_NAME}-${VERSION}.fpk.sha256"
echo " 校验和: $(cat "${APP_NAME}-${VERSION}.fpk.sha256")"
```

- [ ] **步骤 2: 设置构建脚本可执行权限**

```bash
chmod +x /workspace/scripts/build-fpk.sh
```

---

## 任务 9: 验证 fpk 结构完整性

**文件:**
- 创建: `/workspace/scripts/validate-fpk.sh`

- [ ] **步骤 1: 编写验证脚本**

在打包前验证 fpk 源目录的结构完整性。

```bash
#!/bin/bash
# ============================================================
# fpk 结构完整性验证脚本
# 在打包前检查所有必需文件是否存在、格式是否正确
# ============================================================

set -e

FPK_DIR="${1:-/workspace/fpk}"
ERRORS=0
WARNINGS=0

check_file() {
    local file="$1"
    local desc="$2"
    local optional="${3:-false}"

    if [ ! -f "${FPK_DIR}/${file}" ]; then
        if [ "$optional" = "true" ]; then
            echo "  WARN: ${file} — ${desc} (可选)"
            WARNINGS=$((WARNINGS + 1))
        else
            echo "  ERROR: ${file} — ${desc} (必需)"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "  OK: ${file}"
    fi
}

check_executable() {
    local file="$1"
    if [ -f "${FPK_DIR}/${file}" ]; then
        if [ ! -x "${FPK_DIR}/${file}" ]; then
            echo "  WARN: ${file} — 缺少可执行权限"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
}

echo "========================================"
echo " fpk 结构完整性验证"
echo " 目录: ${FPK_DIR}"
echo "========================================"

echo ""
echo "--- 必需文件 ---"
check_file "manifest" "应用元数据"
check_file "ICON.PNG" "应用图标 (256x256)"
check_file "ICON_256.PNG" "高清图标"

echo ""
echo "--- UI 配置 ---"
check_file "app/ui/config" "UI 入口配置"

echo ""
echo "--- 生命周期脚本 ---"
check_file "cmd/main" "主生命周期脚本"
check_file "cmd/common" "公共函数库"
check_file "cmd/install_init" "安装前初始化"
check_file "cmd/install_callback" "安装后回调"
check_file "cmd/uninstall_init" "卸载前回调"
check_file "cmd/uninstall_callback" "卸载后回调"
check_file "cmd/upgrade_init" "升级前回调"
check_file "cmd/upgrade_callback" "升级后回调"
check_file "cmd/service" "Service 配置" "true"
check_file "cmd/config" "配置初始化" "true"

echo ""
echo "--- 权限配置 ---"
check_file "config/privilege" "权限配置" "true"
check_file "config/resource" "资源配置" "true"

echo ""
echo "--- 可执行权限检查 ---"
check_executable "cmd/main"
check_executable "cmd/common"
check_executable "cmd/install_init"
check_executable "cmd/install_callback"
check_executable "cmd/uninstall_init"
check_executable "cmd/uninstall_callback"
check_executable "cmd/upgrade_init"
check_executable "cmd/upgrade_callback"

echo ""
echo "--- Manifest 字段检查 ---"
if [ -f "${FPK_DIR}/manifest" ]; then
    REQUIRED_FIELDS=("appname" "version" "display_name" "platform" "source" "os_min_version" "service_port")
    for field in "${REQUIRED_FIELDS[@]}"; do
        if grep -qs "^${field}[[:space:]]*=" "${FPK_DIR}/manifest"; then
            value=$(grep "^${field}[[:space:]]*=" "${FPK_DIR}/manifest" | head -1 | cut -d= -f2- | xargs)
            echo "  OK: ${field} = ${value}"
        else
            echo "  ERROR: manifest 缺少字段 '${field}'"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

echo ""
echo "========================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo " 结果: 全部通过 ✓"
elif [ $ERRORS -eq 0 ]; then
    echo " 结果: 通过（${WARNINGS} 个警告）"
    echo " 建议: 检查警告项，确认是否符合预期"
else
    echo " 结果: 失败（${ERRORS} 个错误，${WARNINGS} 个警告）"
    echo " 请修复上述错误后重新验证"
    exit 1
fi
echo "========================================"
```

- [ ] **步骤 2: 设置验证脚本可执行权限并运行**

```bash
chmod +x /workspace/scripts/validate-fpk.sh
bash /workspace/scripts/validate-fpk.sh /workspace/fpk
```

预期输出:
```
========================================
 fpk 结构完整性验证
 目录: /workspace/fpk
========================================

--- 必需文件 ---
  OK: manifest
  OK: ICON.PNG
  OK: ICON_256.PNG
...
 结果: 全部通过 ✓
```

---

## 任务 10: 端到端验证清单

**文件:** 无需创建新文件，对照以下清单在 fnOS 环境中验证。

- [ ] **步骤 1: 在 fnOS 环境安装 fnpack**

```bash
# 下载 fnpack (Linux amd64)
wget https://developer.fnnas.com/static/fnpack-1.0.1-linux-amd64
chmod +x fnpack-1.0.1-linux-amd64
sudo mv fnpack-1.0.1-linux-amd64 /usr/local/bin/fnpack
fnpack --help
```

- [ ] **步骤 2: 构建 fpk**

```bash
cd /workspace
bash scripts/build-fpk.sh 1.0.0
# 预期输出: dist/App.ThirdParty.HandBrakeWebui-1.0.0.fpk
```

- [ ] **步骤 3: SSH 到 fnOS 安装 fpk**

```bash
# 将 fpk 传输到 fnOS
scp dist/App.ThirdParty.HandBrakeWebui-1.0.0.fpk user@fnos:/tmp/

# SSH 到 fnOS 安装
ssh user@fnos
sudo appcenter-cli install-fpk /tmp/App.ThirdParty.HandBrakeWebui-1.0.0.fpk
```

- [ ] **步骤 4: 验证桌面图标**

在 fnOS 桌面确认出现 "HandBrake 转码" 图标，点击后以 iframe 窗口打开 Web UI。

- [ ] **步骤 5: 验证核心功能**

```
1. 注册管理员账号
2. 浏览文件系统
3. 提交转码任务
4. 查看任务进度
5. 完成转码
```

- [ ] **步骤 6: 验证硬件加速**

```bash
# SSH 到 fnOS
# 检查容器是否透传了 GPU 设备
docker exec handbrake-webui ls -la /dev/dri
# 预期输出: renderD128, card0 等设备文件

# 在 Web UI 设置页面确认 "硬件加速: Intel QSV 可用"
```

- [ ] **步骤 7: 验证生命周期管理**

```bash
# 停止应用
sudo appcenter-cli stop App.ThirdParty.HandBrakeWebui
# 验证: Web UI 不可访问，docker ps 看不到容器

# 启动应用
sudo appcenter-cli start App.ThirdParty.HandBrakeWebui
# 验证: Web UI 恢复访问

# 升级应用（模拟）
sudo appcenter-cli upgrade App.ThirdParty.HandBrakeWebui
# 验证: 配置和数据保留

# 卸载应用
sudo appcenter-cli uninstall App.ThirdParty.HandBrakeWebui
# 验证: 容器被删除，数据可选保留
```

---

## 附录: 完整文件清单

```
fpk/
├── manifest                          # 任务 1
├── ICON.PNG                          # 任务 2
├── ICON_256.PNG                      # 任务 2
├── app/
│   ├── ui/
│   │   └── config                    # 任务 2
│   └── images/
│       └── icon.png                  # 任务 2
├── cmd/
│   ├── common                        # 任务 3
│   ├── main                          # 任务 4
│   ├── install_init                  # 任务 5
│   ├── install_callback              # 任务 5
│   ├── uninstall_init                # 任务 5
│   ├── uninstall_callback            # 任务 5
│   ├── upgrade_init                  # 任务 5
│   ├── upgrade_callback              # 任务 5
│   ├── service                       # 任务 6
│   └── config                        # 任务 6
├── config/
│   ├── privilege                     # 任务 7
│   └── resource                      # 任务 7
scripts/
├── build-fpk.sh                      # 任务 8
└── validate-fpk.sh                   # 任务 9
```

**总计: 19 个文件 (17 个 fpk 源文件 + 2 个脚本)**