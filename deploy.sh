#!/bin/bash

# Stock Scope 一键部署脚本
# 使用方法：./deploy.sh

set -e

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

# 从阿里云拉取镜像
echo "📥 从阿里云拉取最新镜像..."
docker pull $ALIYUN_IMAGE

# 检查镜像是否支持非 root 用户（可选，如果失败会自动回退）
echo "🔍 检查镜像安全配置..."
if docker run --rm --user 1000:1000 $ALIYUN_IMAGE id > /dev/null 2>&1; then
    echo "✅ 镜像支持非 root 用户运行"
    USE_NON_ROOT=true
else
    echo "⚠️  警告: 镜像可能不支持非 root 用户，将尝试使用 root 用户"
    echo "   建议重新构建镜像以启用安全加固功能"
    USE_NON_ROOT=false
fi

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
    # 注意：host 网络模式会降低隔离性，但为了兼容性保留
    # 如果可能，建议使用桥接网络模式以提高安全性
    EXTRA_ARGS="--network host"
    echo "✅ Linux 系统：使用 host 网络模式"
else
    # Windows/macOS 系统
    EXTRA_ARGS="--add-host=host.docker.internal:host-gateway"
    echo "✅ 使用 host.docker.internal"
fi

# 安全加固配置
SECURITY_ARGS=""
SECURITY_ARGS="$SECURITY_ARGS --security-opt no-new-privileges:true"  # 禁止获取新权限
SECURITY_ARGS="$SECURITY_ARGS --cap-drop ALL"  # 移除所有能力
SECURITY_ARGS="$SECURITY_ARGS --cap-add NET_BIND_SERVICE"  # 仅允许绑定端口（<1024需要）
SECURITY_ARGS="$SECURITY_ARGS --memory=2g"  # 限制内存使用
SECURITY_ARGS="$SECURITY_ARGS --memory-swap=2g"  # 禁用交换分区
SECURITY_ARGS="$SECURITY_ARGS --cpus=2"  # 限制 CPU 使用
SECURITY_ARGS="$SECURITY_ARGS --pids-limit=100"  # 限制进程数
SECURITY_ARGS="$SECURITY_ARGS --ulimit nofile=1024:2048"  # 限制文件描述符
SECURITY_ARGS="$SECURITY_ARGS --ulimit nproc=1024"  # 限制进程数（ulimit方式）

# 使用非 root 用户运行（如果镜像支持）
if [ "$USE_NON_ROOT" = true ]; then
    SECURITY_ARGS="$SECURITY_ARGS --user 1000:1000"  # 使用非 root 用户
    echo "✅ 启用非 root 用户运行"
else
    echo "⚠️  使用 root 用户运行（安全性较低，建议更新镜像）"
fi

echo "🔒 应用安全加固配置..."

docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:3000 \
    -p 5001:5001 \
    $ENV_ARGS \
    $EXTRA_ARGS \
    $SECURITY_ARGS \
    --restart unless-stopped \
    $ALIYUN_IMAGE

# 等待启动
sleep 3

# 显示状态
echo ""
if docker ps | grep -q $CONTAINER_NAME; then
    echo "=========================================="
    echo "✅ 部署完成！"
    echo "=========================================="
    echo "使用镜像: $ALIYUN_IMAGE"
    echo ""
    echo "📱 前端地址: http://localhost:3000"
    echo "🔌 后端地址: http://localhost:5001"
    echo ""
    echo "常用命令："
    echo "  查看日志: docker logs -f $CONTAINER_NAME"
    echo "  停止服务: docker stop $CONTAINER_NAME"
    echo "  重启服务: docker restart $CONTAINER_NAME"
    echo "=========================================="
else
    echo "❌ 容器启动失败，查看日志："
    docker logs $CONTAINER_NAME
    exit 1
fi

