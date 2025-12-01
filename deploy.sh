#!/bin/bash

# Stock Scope 一键部署脚本
# 使用方法：
#   ./deploy.sh          - 使用本地镜像或从阿里云拉取
#   ./deploy.sh build    - 重新构建镜像
#   ./deploy.sh pull     - 从阿里云拉取最新镜像

set -e

LOCAL_IMAGE="stock-scope:latest"
ALIYUN_IMAGE="crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest"
CONTAINER_NAME="stock-scope"

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

# 根据参数决定使用哪个镜像
IMAGE_TO_USE=""
MODE="${1:-auto}"

case $MODE in
    build)
        echo "🔨 构建本地镜像..."
        docker build -t $LOCAL_IMAGE .
        IMAGE_TO_USE=$LOCAL_IMAGE
        docker image prune -f
        ;;
    pull)
        echo "📥 从阿里云拉取镜像..."
        docker pull $ALIYUN_IMAGE
        IMAGE_TO_USE=$ALIYUN_IMAGE
        ;;
    auto|*)
        # 自动模式：优先使用本地镜像，没有则从阿里云拉取
        if docker image inspect $LOCAL_IMAGE >/dev/null 2>&1; then
            echo "✅ 使用本地镜像: $LOCAL_IMAGE"
            IMAGE_TO_USE=$LOCAL_IMAGE
        elif docker image inspect $ALIYUN_IMAGE >/dev/null 2>&1; then
            echo "✅ 使用阿里云镜像: $ALIYUN_IMAGE"
            IMAGE_TO_USE=$ALIYUN_IMAGE
        else
            echo "📥 本地无镜像，从阿里云拉取..."
            docker pull $ALIYUN_IMAGE
            IMAGE_TO_USE=$ALIYUN_IMAGE
        fi
        ;;
esac

# 检查 .env 文件
echo ""
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件"
    echo "   某些功能可能无法正常使用"
    echo "   请参考 env.example 创建 .env 文件"
    echo ""
fi

# 运行容器
echo "🚀 启动容器..."
ENV_ARGS=""
if [ -f ".env" ]; then
    ENV_ARGS="--env-file .env"
    echo "✅ 加载 .env 文件"
fi

# 检测操作系统，设置网络模式
EXTRA_ARGS=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux 系统使用 host 网络模式（最简单）
    EXTRA_ARGS="--network host"
    echo "✅ Linux 系统：使用 host 网络模式"
else
    # Windows/macOS 系统
    EXTRA_ARGS="--add-host=host.docker.internal:host-gateway"
    echo "✅ 使用 host.docker.internal"
fi

docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:3000 \
    -p 5001:5001 \
    $ENV_ARGS \
    $EXTRA_ARGS \
    --restart unless-stopped \
    $IMAGE_TO_USE

# 等待启动
sleep 3

# 显示状态
echo ""
if docker ps | grep -q $CONTAINER_NAME; then
    echo "=========================================="
    echo "✅ 部署完成！"
    echo "=========================================="
    echo "使用镜像: $IMAGE_TO_USE"
    echo ""
    echo "📱 前端地址: http://localhost:3000"
    echo "🔌 后端地址: http://localhost:5001"
    echo ""
    echo "常用命令："
    echo "  查看日志: docker logs -f $CONTAINER_NAME"
    echo "  停止服务: docker stop $CONTAINER_NAME"
    echo "  重启服务: docker restart $CONTAINER_NAME"
    echo ""
    echo "部署选项："
    echo "  使用本地镜像: ./deploy.sh"
    echo "  重新构建镜像: ./deploy.sh build"
    echo "  从阿里云拉取: ./deploy.sh pull"
    echo "=========================================="
else
    echo "❌ 容器启动失败，查看日志："
    docker logs $CONTAINER_NAME
    exit 1
fi

