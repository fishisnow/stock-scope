#!/bin/bash

# 安装/更新 crontab，每分钟执行一次镜像更新检测脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/auto_deploy_latest.sh"
CRON_LOG="$SCRIPT_DIR/.deploy-state/cron.log"

if [ ! -f "$CHECK_SCRIPT" ]; then
  echo "未找到脚本：$CHECK_SCRIPT"
  exit 1
fi

chmod +x "$CHECK_SCRIPT"
mkdir -p "$SCRIPT_DIR/.deploy-state"

CRON_JOB="* * * * * $CHECK_SCRIPT >> $CRON_LOG 2>&1"

tmp_cron="$(mktemp)"
if crontab -l >/dev/null 2>&1; then
  crontab -l | grep -v "auto_deploy_latest.sh" > "$tmp_cron" || true
fi

echo "$CRON_JOB" >> "$tmp_cron"
crontab "$tmp_cron"
rm -f "$tmp_cron"

echo "✅ 已安装定时任务（每分钟检查一次）"
echo "任务内容：$CRON_JOB"
echo "查看任务：crontab -l"
