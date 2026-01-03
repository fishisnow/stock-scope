# 使用 Node.js 20 作为基础镜像（包含构建前端所需的环境）
FROM node:20-slim AS frontend-builder

# 定义构建参数（可以在构建时通过 --build-arg 传入）
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

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
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# 构建前端项目
RUN npm run build

# 使用 Python 3.12 作为运行时镜像
FROM python:3.12-slim

# 安装必要的系统依赖（时区数据等）
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# 从 frontend-builder 阶段复制 Node.js 和 npm（因为该阶段已经使用了官方 Node.js 镜像）
# 复制整个 Node.js 安装目录，确保包含所有二进制文件、库文件和符号链接
COPY --from=frontend-builder /usr/local/bin/ /usr/local/bin/
COPY --from=frontend-builder /usr/local/lib/node_modules/ /usr/local/lib/node_modules/

# 创建非 root 用户（安全最佳实践）
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 appuser \
    && mkdir -p /app /home/appuser \
    && chown -R appuser:appuser /app /home/appuser

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

# 设置文件权限（确保非 root 用户可以访问）
RUN chown -R appuser:appuser /app

# 暴露端口
EXPOSE 3000 5001

# 设置环境变量
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai
ENV HOME=/home/appuser

# 切换到非 root 用户（安全最佳实践）
USER appuser

# 启动应用
CMD ["/app/start.sh"]

