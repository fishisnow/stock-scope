#!/bin/bash

# Stock Scope 一键部署脚本
# 使用方法：./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-}"

ALIYUN_IMAGE="crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest"
CONTAINER_NAME="stock-scope"
BACKEND_HEALTH_URL="http://localhost:5001/api/stock-analysis/health"

echo "=========================================="
echo "🚀 Stock Scope 部署脚本"
echo "=========================================="

# 解析 .env 路径（兼容 cron 的工作目录差异）
if [ -z "$ENV_FILE" ]; then
    for candidate in "$PROJECT_ROOT/.env" "$SCRIPT_DIR/.env" ".env"; do
        if [ -f "$candidate" ]; then
            ENV_FILE="$candidate"
            break
        fi
    done
fi

if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到 .env 文件，部署终止"
    echo "   可通过 ENV_FILE=/absolute/path/.env 指定"
    exit 1
fi

if [ ! -r "$ENV_FILE" ]; then
    echo "❌ .env 文件不可读：$ENV_FILE"
    exit 1
fi

if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?SUPABASE_URL=' "$ENV_FILE"; then
    echo "❌ .env 中缺少 SUPABASE_URL：$ENV_FILE"
    exit 1
fi

if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?SUPABASE_KEY=' "$ENV_FILE"; then
    echo "❌ .env 中缺少 SUPABASE_KEY：$ENV_FILE"
    exit 1
fi

echo "✅ 使用环境变量文件: $ENV_FILE"

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

# 运行容器
echo "🚀 启动容器..."
ENV_ARGS=(--env-file "$ENV_FILE")
echo "✅ 加载 .env 文件"

# 检测操作系统，设置网络模式
EXTRA_ARGS=()
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux 系统使用 host 网络模式（最简单）
    # 注意：host 网络模式会降低隔离性，但为了兼容性保留
    # 如果可能，建议使用桥接网络模式以提高安全性
    EXTRA_ARGS+=(--network host)
    echo "✅ Linux 系统：使用 host 网络模式"
else
    # Windows/macOS 系统
    EXTRA_ARGS+=(--add-host=host.docker.internal:host-gateway)
    echo "✅ 使用 host.docker.internal"
fi

# 安全加固配置
SECURITY_ARGS=()
SECURITY_ARGS+=(--security-opt no-new-privileges:true)  # 禁止获取新权限
SECURITY_ARGS+=(--cap-drop ALL)  # 移除所有能力
SECURITY_ARGS+=(--cap-add NET_BIND_SERVICE)  # 仅允许绑定端口（<1024需要）
SECURITY_ARGS+=(--memory=2g)  # 限制内存使用
SECURITY_ARGS+=(--memory-swap=2g)  # 禁用交换分区
SECURITY_ARGS+=(--cpus=2)  # 限制 CPU 使用
SECURITY_ARGS+=(--pids-limit=100)  # 限制进程数
SECURITY_ARGS+=(--ulimit nofile=1024:2048)  # 限制文件描述符
SECURITY_ARGS+=(--ulimit nproc=1024)  # 限制进程数（ulimit方式）

# 使用非 root 用户运行（如果镜像支持）
if [ "$USE_NON_ROOT" = true ]; then
    SECURITY_ARGS+=(--user 1000:1000)  # 使用非 root 用户
    echo "✅ 启用非 root 用户运行"
else
    echo "⚠️  使用 root 用户运行（安全性较低，建议更新镜像）"
fi

echo "🔒 应用安全加固配置..."

docker run -d \
    --name "$CONTAINER_NAME" \
    -p 3000:3000 \
    -p 5001:5001 \
    "${ENV_ARGS[@]}" \
    "${EXTRA_ARGS[@]}" \
    "${SECURITY_ARGS[@]}" \
    --restart unless-stopped \
    "$ALIYUN_IMAGE"

# 等待后端健康检查就绪（最多 120 秒）
echo "⏳ 等待后端健康检查通过..."
HEALTH_READY=false
for _ in $(seq 1 60); do
    if command -v curl >/dev/null 2>&1; then
        if curl -fsS --max-time 3 "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
            HEALTH_READY=true
            break
        fi
    else
        # 若系统无 curl，则回退为容器存活检查
        if docker ps | grep -q "$CONTAINER_NAME"; then
            HEALTH_READY=true
            break
        fi
    fi
    sleep 2
done

# 显示状态
echo ""
if docker ps | grep -q "$CONTAINER_NAME" && [ "$HEALTH_READY" = true ]; then
    # 清理旧镜像，仅保留当前 latest 对应镜像，避免磁盘空间耗尽
    echo "🧹 清理旧镜像..."
    IMAGE_REPO="${ALIYUN_IMAGE%:*}"
    CURRENT_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$ALIYUN_IMAGE" 2>/dev/null || true)"

    if [ -n "$CURRENT_IMAGE_ID" ]; then
        docker images --no-trunc "$IMAGE_REPO" --format '{{.ID}}' | sort -u | while read -r IMAGE_ID; do
            if [ -n "$IMAGE_ID" ] && [ "$IMAGE_ID" != "$CURRENT_IMAGE_ID" ]; then
                docker rmi -f "$IMAGE_ID" >/dev/null 2>&1 || true
            fi
        done
        echo "✅ 镜像清理完成（已保留当前最新镜像）"
    else
        echo "⚠️  未能识别当前镜像 ID，跳过镜像清理"
    fi

    echo "=========================================="
    echo "✅ 部署完成！"
    echo "=========================================="
    echo "使用镜像: $ALIYUN_IMAGE"
    echo ""
    echo "📱 前端地址: http://localhost:3000"
    echo "🔌 后端地址: http://localhost:5001"
    echo "🩺 健康检查: $BACKEND_HEALTH_URL"
    echo ""
    echo "常用命令："
    echo "  查看日志: docker logs -f $CONTAINER_NAME"
    echo "  停止服务: docker stop $CONTAINER_NAME"
    echo "  重启服务: docker restart $CONTAINER_NAME"
    echo "=========================================="
else
    echo "❌ 部署失败：容器未就绪或健康检查超时"
    echo "   健康检查地址: $BACKEND_HEALTH_URL"
    echo "   查看日志: docker logs $CONTAINER_NAME"
    docker logs "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
fi

