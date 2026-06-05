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

# Docker 镜像配置
DOCKER_IMAGE_NAME="ray5378/handbrake-webui-fnapp:${VERSION}"
DOCKER_IMAGE_LATEST="ray5378/handbrake-webui-fnapp:latest"
DOCKER_IMAGE_TAR="${FPK_SOURCE}/docker/image.tar.gz"

echo "========================================"
echo " HandBrake-Webui fpk 打包构建"
echo " Version: ${VERSION}"
echo "========================================"

# ---- 检查依赖 ----
echo "[1/7] 检查依赖..."

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

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker 未安装。"
    exit 1
fi
echo "  docker: $(docker --version)"

if ! command -v convert &>/dev/null; then
    echo "WARN: ImageMagick 未安装，跳过图标生成"
    echo "  安装: sudo apt install imagemagick"
fi

# ---- 构建前端 ----
echo "[2/7] 构建前端..."
cd "${PROJECT_ROOT}/frontend"
if [ ! -d "node_modules" ]; then
    echo "  安装前端依赖..."
    npm ci --ignore-scripts
fi
npm run build
echo "  前端构建完成"

# ---- 构建 Docker 镜像 ----
echo "[3/7] 构建 Docker 镜像..."
cd "${PROJECT_ROOT}"
docker build \
    -f docker/Dockerfile \
    -t "${DOCKER_IMAGE_NAME}" \
    -t "${DOCKER_IMAGE_LATEST}" \
    .
echo "  Docker 镜像构建完成: ${DOCKER_IMAGE_NAME}"

# ---- 导出 Docker 镜像为 tar.gz ----
echo "[4/7] 导出 Docker 镜像..."
mkdir -p "${FPK_SOURCE}/docker"
echo "  正在压缩导出镜像 (可能较慢)..."
docker save "${DOCKER_IMAGE_LATEST}" | gzip > "${DOCKER_IMAGE_TAR}"
echo "  镜像已导出: ${DOCKER_IMAGE_TAR} ($(du -h "${DOCKER_IMAGE_TAR}" | cut -f1))"

# ---- 更新版本号 ----
echo "[5/7] 更新版本号..."
sed -i "s/^version[[:space:]]*=.*/version               = ${VERSION}/" "${FPK_SOURCE}/manifest"
echo "  manifest 版本已更新为 ${VERSION}"

# ---- 生成图标 ----
echo "[6/7] 检查图标..."
if [ ! -f "${FPK_SOURCE}/ICON.PNG" ]; then
    if command -v convert &>/dev/null; then
        echo "  生成默认图标..."
        convert -size 256x256 xc:'#4A90D9' \
            -fill white -font Helvetica -pointsize 120 \
            -gravity center -annotate 0 'HB' \
            "${FPK_SOURCE}/ICON.PNG"
        cp "${FPK_SOURCE}/ICON.PNG" "${FPK_SOURCE}/ICON_256.PNG"
        mkdir -p "${FPK_SOURCE}/app/images"
        cp "${FPK_SOURCE}/ICON.PNG" "${FPK_SOURCE}/app/images/icon.png"
    else
        echo "WARN: 无图标文件且无法生成，请手动创建 ICON.PNG"
    fi
fi

# ---- 设置脚本权限 ----
echo "[7/7] 设置脚本权限..."
chmod +x "${FPK_SOURCE}/cmd/"* 2>/dev/null || true
chmod +x "${FPK_SOURCE}/config/"* 2>/dev/null || true

# ---- 打包 ----
echo ""
echo "========================================"
echo " 执行 fnpack build..."
echo "========================================"
mkdir -p "${OUTPUT_DIR}"

cd "${FPK_SOURCE}"
if [ -f "manifest" ]; then
    ${FNPAKCK_CMD} build . 2>&1 || {
        echo "  尝试备选打包方式..."
        ${FNPAKCK_CMD} build "${FPK_SOURCE}" 2>&1 || {
            echo "ERROR: fpk 打包失败"
            exit 1
        }
    }
fi

GENERATED_FPK=$(find "${FPK_SOURCE}" -maxdepth 1 -name "*.fpk" -type f 2>/dev/null | head -1)
if [ -n "$GENERATED_FPK" ]; then
    mv "$GENERATED_FPK" "${FPK_FILE}"
    echo ""
    echo "========================================"
    echo " 打包成功!"
    echo " 输出: ${FPK_FILE}"
    echo " 大小: $(du -h "${FPK_FILE}" | cut -f1)"
    echo " 包含 Docker 镜像: $(du -h "${DOCKER_IMAGE_TAR}" | cut -f1)"
    echo "========================================"
else
    echo "WARN: 未找到生成的 fpk 文件，请检查 fnpack 输出"
    echo "  预期输出到: ${FPK_FILE}"
fi

# 生成校验和
cd "${OUTPUT_DIR}"
sha256sum "${APP_NAME}-${VERSION}.fpk" > "${APP_NAME}-${VERSION}.fpk.sha256"
echo " 校验和: $(cat "${APP_NAME}-${VERSION}.fpk.sha256")"

# 清理导出的镜像 tar（已打包进 fpk，不再需要源文件）
rm -f "${DOCKER_IMAGE_TAR}"
echo " 临时镜像文件已清理"