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

# 从构建阶段复制前端静态产物
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# 设置文件权限（确保非 root 用户可以访问）
RUN chown -R appuser:appuser /app

# 暴露端口
EXPOSE 5001

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai
ENV HOME=/home/appuser

# 切换到非 root 用户（安全最佳实践）
USER appuser

# 启动应用（定时任务 + 后端 API）
# 保持单容器部署，但移除 Next.js 运行时以降低内存占用
CMD ["sh", "-c", "cd /app/backend && python -c \"from app.core import schedule_stocks; schedule_stocks.main()\" & p1=$!; cd /app/backend && gunicorn -w 2 --threads 2 --timeout 120 --max-requests 500 --max-requests-jitter 50 -b 0.0.0.0:5001 app.api.api_app:app & p2=$!; while true; do for p in $p1 $p2; do if ! kill -0 \"$p\" 2>/dev/null; then wait \"$p\"; exit $?; fi; done; sleep 1; done"]

