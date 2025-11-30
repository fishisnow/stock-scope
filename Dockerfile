# 使用 Node.js 20 作为基础镜像（包含构建前端所需的环境）
FROM node:20-slim AS frontend-builder

# 设置工作目录
WORKDIR /app/frontend

# 复制前端 package 文件
COPY frontend/package*.json ./

# 安装前端依赖
RUN npm ci

# 复制前端源代码
COPY frontend/ ./

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

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
echo "🚀 启动 Stock Scope 应用..."\n\
echo "========================================"\n\
\n\
# 设置 Python 路径\n\
export PYTHONPATH=/app/backend:$PYTHONPATH\n\
\n\
# 启动后端服务（使用 Gunicorn，在后台运行）\n\
echo "📊 启动后端服务（Gunicorn）..."\n\
cd /app/backend/app && gunicorn -w 4 -b 0.0.0.0:5001 web_app:app &\n\
BACKEND_PID=$!\n\
\n\
# 等待后端启动\n\
sleep 3\n\
\n\
# 启动前端服务\n\
echo "🌐 启动前端服务..."\n\
cd /app/frontend && npm start &\n\
FRONTEND_PID=$!\n\
\n\
echo "========================================"\n\
echo "✅ 应用启动成功！"\n\
echo "前端地址: http://localhost:3000"\n\
echo "后端地址: http://localhost:5001"\n\
echo "========================================"\n\
\n\
# 等待任一进程退出\n\
wait -n $BACKEND_PID $FRONTEND_PID\n\
\n\
# 如果其中一个进程退出，杀死另一个\n\
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null\n\
exit $?\n\
' > /app/start.sh && chmod +x /app/start.sh

# 暴露端口
EXPOSE 3000 5001

# 设置环境变量
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# 启动应用
CMD ["/app/start.sh"]

