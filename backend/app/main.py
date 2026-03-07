# -*- coding: utf-8 -*-

import threading
import time

import core.schedule_stocks as schedule_stocks
import api.api_app as api_app


def run_scheduler():
    """运行定时任务"""
    print("🚀 定时任务服务启动...")
    schedule_stocks.main()


def run_api_app():
    """运行 API 应用"""
    print("🌐 API 服务启动在 http://localhost:5001")
    api_app.app.run(debug=False, host='0.0.0.0', port=5001, use_reloader=False)


def main():
    print("=" * 50)
    print("📈 股票数据统计系统启动")
    print("=" * 50)

    # 创建并启动定时任务线程
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()

    # 给定时任务一点启动时间
    time.sleep(2)

    # 启动 API 应用（在主线程中运行）
    run_api_app()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 系统正在关闭...")
    except Exception as e:
        print(f"❌ 系统启动失败: {e}")
