# 使用 Node.js 20 作为基础镜像（包含构建前端所需的环境）
FROM node:20-slim AS frontend-builder

# 定义构建参数
ARG NEXT_PUBLIC_API_URL=http://invest.fishisnow.xyz:5001

# 设置工作目录
WORKDIR /app/frontend

# 复制前端 package 文件
COPY frontend/package*.json ./

# 安装前端依赖
RUN npm ci

# 复制前端源代码
COPY frontend/ ./

# 设置环境变量（构建时使用）
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 构建前端项目
RUN npm run build

# 使用 Python 3.12 作为运行时镜像
FROM python:3.12-slim

# 安装 Node.js 运行时（用于运行 Next.js）
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制后端依赖文件
COPY backend/requirements.txt ./backend/

# 安装后端依赖
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/frontend ./frontend

# 复制启动脚本
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 暴露端口
EXPOSE 3000 5001

# 设置环境变量
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# 启动应用
CMD ["/app/start.sh"]

