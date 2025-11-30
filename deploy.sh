#!/bin/bash

# Stock Scope 一键部署脚本（个人项目简化版）
# 使用方法：./deploy.sh

set -e

IMAGE_NAME="stock-scope"
CONTAINER_NAME="stock-scope-app"

echo "=========================================="
echo "🚀 Stock Scope 部署脚本"
echo "=========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装："
    echo "   curl -fsSL https://get.docker.com | bash -s docker"
    exit 1
fi

# 停止并删除旧容器
echo "📦 清理旧容器..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# 构建镜像
echo "🔨 构建镜像（可能需要几分钟）..."
docker build -t $IMAGE_NAME .

# 清理悬空镜像
docker image prune -f

# 运行容器
echo "🚀 启动容器..."
ENV_ARGS=""
if [ -f ".env" ]; then
    ENV_ARGS="--env-file .env"
    echo "✅ 加载 .env 文件"
fi

docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:3000 \
    -p 5001:5001 \
    $ENV_ARGS \
    --restart unless-stopped \
    $IMAGE_NAME

# 显示状态
echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo "📱 前端地址: http://localhost:3000"
echo "🔌 后端地址: http://localhost:5001"
echo ""
echo "常用命令："
echo "  查看日志: docker logs -f $CONTAINER_NAME"
echo "  停止服务: docker stop $CONTAINER_NAME"
echo "  重启服务: docker restart $CONTAINER_NAME"
echo "  重新部署: ./deploy.sh"
echo "=========================================="

