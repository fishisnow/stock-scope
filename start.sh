#!/bin/bash
set -e
echo "🚀 启动 Stock Scope 应用..."
echo "========================================"

# 设置 Python 路径
export PYTHONPATH=/app/backend:$PYTHONPATH

# 启动定时任务服务（在后台运行）
echo "⏰ 启动定时任务服务..."
cd /app/backend/app && python -c "import core.schedule_stocks as schedule_stocks; schedule_stocks.main()" &
SCHEDULER_PID=$!

# 等待定时任务启动
sleep 2

# 启动后端服务（使用 Gunicorn，在后台运行）
echo "📊 启动后端服务（Gunicorn）..."
cd /app/backend/app && gunicorn -w 4 -b 0.0.0.0:5001 web_app:app &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端服务
echo "🌐 启动前端服务..."
cd /app/frontend && npm start &
FRONTEND_PID=$!

echo "========================================"
echo "✅ 应用启动成功！"
echo "前端地址: http://localhost:3000"
echo "后端地址: http://localhost:5001"
echo "========================================"

# 等待任一进程退出
wait -n $SCHEDULER_PID $BACKEND_PID $FRONTEND_PID

# 如果其中一个进程退出，杀死其他进程
kill $SCHEDULER_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
exit $?

