#!/bin/bash

# 安装/更新 crontab，每分钟执行一次镜像更新检测脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/auto_deploy_latest.sh"
CRON_LOG="$SCRIPT_DIR/.deploy-state/cron.log"
tmp_cron=""

if [ ! -f "$CHECK_SCRIPT" ]; then
  echo "未找到脚本：$CHECK_SCRIPT"
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "❌ 未找到 crontab 命令，请先安装 cron/cronie。"
  exit 1
fi

chmod +x "$CHECK_SCRIPT"
mkdir -p "$SCRIPT_DIR/.deploy-state"

CRON_JOB="* * * * * $CHECK_SCRIPT >> $CRON_LOG 2>&1"

cleanup() {
  if [ -n "${tmp_cron:-}" ] && [ -f "$tmp_cron" ]; then
    rm -f "$tmp_cron"
  fi
}
trap cleanup EXIT

tmp_cron="$(mktemp)"
if crontab -l >/dev/null 2>&1; then
  crontab -l | grep -v "auto_deploy_latest.sh" > "$tmp_cron" || true
fi

echo "$CRON_JOB" >> "$tmp_cron"

err_file="$(mktemp)"
if ! crontab "$tmp_cron" 2>"$err_file"; then
  err_msg="$(<"$err_file")"
  rm -f "$err_file"
  echo "❌ 安装 crontab 失败：$err_msg"
  if [[ "$err_msg" == *"Operation not permitted"* ]] || [[ "$err_msg" == *"Permission denied"* ]]; then
    echo ""
    echo "常见原因："
    echo "1) 当前用户没有 crontab 权限（检查 /etc/cron.allow 与 /etc/cron.deny）；"
    echo "2) 在受限容器或沙箱内执行（即使有 crontab 二进制也被禁止）；"
    echo "3) 系统策略（如 SELinux / AppArmor）拦截。"
    echo ""
    echo "建议排查命令："
    echo "- whoami"
    echo "- id"
    echo "- ls -l /usr/bin/crontab 2>/dev/null || command -v crontab"
    echo "- crontab -l"
  fi
  exit 1
fi
rm -f "$err_file"

echo "✅ 已安装定时任务（每分钟检查一次）"
echo "任务内容：$CRON_JOB"
echo "查看任务：crontab -l"
