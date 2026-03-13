#!/bin/bash

# 阿里云镜像仓库部署脚本
# 用于构建和推送 Stock Scope 项目镜像

set -e

# 配置信息
REGISTRY="crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com"
REGISTRY_VPC="crpi-3f383vugjtqlop7w-vpc.cn-guangzhou.personal.cr.aliyuncs.com"
USERNAME="aliyun4847844216"
REGISTRY_PASSWORD="${ALIYUN_REGISTRY_PASSWORD:-}"
NAMESPACE="fishisnow"
REPO="stock-scope"
VERSION="v1.0.0"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 前置检查：确保 Docker 已安装且 daemon 已启动
echo -e "${GREEN}[前置检查] 检查 Docker 运行状态...${NC}"
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}❌ 未检测到 docker 命令，请先安装 Docker Desktop${NC}"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    if [ "$(uname -s)" = "Darwin" ]; then
        echo -e "${YELLOW}⚠️  Docker 未启动，正在尝试启动 Docker Desktop...${NC}"
        open -a Docker

        # 最长等待 120 秒，直到 Docker daemon 就绪
        DOCKER_READY=false
        for _ in $(seq 1 60); do
            if docker info >/dev/null 2>&1; then
                DOCKER_READY=true
                break
            fi
            sleep 2
        done

        if [ "$DOCKER_READY" != "true" ]; then
            echo -e "${YELLOW}❌ Docker 启动超时，请手动打开 Docker Desktop 后重试${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}❌ Docker daemon 未启动，请先启动 Docker 服务后重试${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Docker 已就绪${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stock Scope 镜像构建与推送工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 步骤 1: 读取 .env 文件中的构建参数
echo -e "${GREEN}[1/6] 读取 .env 配置文件...${NC}"
BUILD_ARGS=""
if [ -f ".env" ]; then
    # 定义需要在构建时传递的环境变量列表
    BUILD_ENV_VARS=(
        "NEXT_PUBLIC_API_URL"
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    
    # 遍历并读取每个环境变量
    for VAR_NAME in "${BUILD_ENV_VARS[@]}"; do
        if grep -q "^${VAR_NAME}=" .env; then
            VAR_VALUE=$(grep "^${VAR_NAME}=" .env | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//")
            if [ -n "$VAR_VALUE" ]; then
                BUILD_ARGS="$BUILD_ARGS --build-arg ${VAR_NAME}=${VAR_VALUE}"
                echo -e "  ✓ ${VAR_NAME}=${VAR_VALUE}"
            fi
        fi
    done
    echo -e "${GREEN}✅ 配置读取完成${NC}"
else
    echo -e "${YELLOW}⚠️  警告: 未找到 .env 文件，使用默认配置${NC}"
fi
echo ""

# 步骤 2: 构建镜像
echo -e "${GREEN}[2/6] 构建 Docker 镜像...${NC}"
docker build $BUILD_ARGS -t stock-scope:latest .
echo -e "${GREEN}✅ 镜像构建完成${NC}"
echo ""

# 步骤 3: 打标签
echo -e "${GREEN}[3/6] 为镜像打标签...${NC}"
docker tag stock-scope:latest ${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION}
docker tag stock-scope:latest ${REGISTRY}/${NAMESPACE}/${REPO}:latest
echo -e "${GREEN}✅ 标签设置完成${NC}"
echo ""

# 步骤 4: 登录 (公网)
echo -e "${GREEN}[4/6] 登录阿里云镜像仓库...${NC}"
if [ -z "$REGISTRY_PASSWORD" ]; then
    echo -e "${YELLOW}❌ 环境变量 ALIYUN_REGISTRY_PASSWORD 未设置${NC}"
    echo -e "${YELLOW}请先执行：export ALIYUN_REGISTRY_PASSWORD='你的阿里云镜像仓库密码'${NC}"
    exit 1
fi
echo "$REGISTRY_PASSWORD" | docker login --username="${USERNAME}" --password-stdin "${REGISTRY}"
echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 步骤 5: 推送镜像
echo -e "${GREEN}[5/6] 推送镜像到仓库...${NC}"
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION}
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:latest
echo -e "${GREEN}✅ 镜像推送完成${NC}"
echo ""

# 步骤 6: 清理本地旧镜像（仅保留当前最新镜像）
echo -e "${GREEN}[6/6] 清理本地旧镜像...${NC}"
TARGET_REPO="${REGISTRY}/${NAMESPACE}/${REPO}"
CURRENT_IMAGE_ID="$(docker image inspect --format '{{.Id}}' ${TARGET_REPO}:latest 2>/dev/null || true)"

if [ -n "$CURRENT_IMAGE_ID" ]; then
    docker images --no-trunc "$TARGET_REPO" --format '{{.ID}}' | sort -u | while read -r IMAGE_ID; do
        if [ -n "$IMAGE_ID" ] && [ "$IMAGE_ID" != "$CURRENT_IMAGE_ID" ]; then
            docker rmi -f "$IMAGE_ID" >/dev/null 2>&1 || true
        fi
    done
    echo -e "${GREEN}✅ 本地旧镜像清理完成（已保留当前 latest 镜像）${NC}"
else
    echo -e "${YELLOW}⚠️  未识别到当前 latest 镜像 ID，跳过清理${NC}"
fi
echo ""

# 完成信息
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "镜像信息："
echo -e "  仓库地址: ${REGISTRY}/${NAMESPACE}/${REPO}"
echo -e "  版本标签: ${VERSION}, latest"
echo ""
echo -e "拉取镜像命令："
echo -e "  ${YELLOW}docker pull ${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION}${NC}"
echo -e "  ${YELLOW}docker pull ${REGISTRY}/${NAMESPACE}/${REPO}:latest${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo -e "  - 如果从 ECS 推送，建议使用 VPC 地址获得更快速度："
echo -e "    ${REGISTRY_VPC}"
echo -e "  - 修改脚本中的 VERSION 变量来更新版本号"
echo ""

