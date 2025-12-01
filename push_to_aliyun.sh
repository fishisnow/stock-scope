#!/bin/bash

# 阿里云镜像仓库部署脚本
# 用于构建和推送 Stock Scope 项目镜像

set -e

# 配置信息
REGISTRY="crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com"
REGISTRY_VPC="crpi-3f383vugjtqlop7w-vpc.cn-guangzhou.personal.cr.aliyuncs.com"
USERNAME="aliyun4847844216"
NAMESPACE="fishisnow"
REPO="hys"
VERSION="v1.0.0"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stock Scope 镜像构建与推送工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 步骤 1: 构建镜像
echo -e "${GREEN}[1/4] 构建 Docker 镜像...${NC}"
docker build -t stock-scope:latest .
echo -e "${GREEN}✅ 镜像构建完成${NC}"
echo ""

# 步骤 2: 打标签
echo -e "${GREEN}[2/4] 为镜像打标签...${NC}"
docker tag stock-scope:latest ${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION}
docker tag stock-scope:latest ${REGISTRY}/${NAMESPACE}/${REPO}:latest
echo -e "${GREEN}✅ 标签设置完成${NC}"
echo ""

# 步骤 3: 登录 (公网)
echo -e "${GREEN}[3/4] 登录阿里云镜像仓库...${NC}"
echo -e "${YELLOW}请输入密码进行登录：${NC}"
docker login --username=${USERNAME} ${REGISTRY}
echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 步骤 4: 推送镜像
echo -e "${GREEN}[4/4] 推送镜像到仓库...${NC}"
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION}
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:latest
echo -e "${GREEN}✅ 镜像推送完成${NC}"
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

