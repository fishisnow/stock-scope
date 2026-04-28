#!/bin/bash

# 每分钟执行一次：
# 1) 拉取 latest 镜像并获取 digest
# 2) 若 digest 变化，则自动执行 deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy.sh"
STATE_DIR="$SCRIPT_DIR/.deploy-state"
STATE_FILE="$STATE_DIR/latest.digest"
LOG_FILE="$STATE_DIR/auto-deploy.log"
LOCK_DIR="$STATE_DIR/.auto-deploy.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
ALIYUN_IMAGE="crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest"

mkdir -p "$STATE_DIR"

log() {
  local message="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

cleanup_lock() {
  rm -f "$LOCK_PID_FILE" 2>/dev/null || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

# 防重入：上一次任务未结束时，本次直接跳过
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [ -f "$LOCK_PID_FILE" ]; then
    stale_pid="$(cat "$LOCK_PID_FILE" 2>/dev/null || true)"
    if [ -n "$stale_pid" ] && ! kill -0 "$stale_pid" 2>/dev/null; then
      log "检测到陈旧锁，清理后重试"
      cleanup_lock
      if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        log "锁目录仍存在，跳过本次运行"
        exit 0
      fi
    else
      log "检测任务仍在执行中，跳过本次运行"
      exit 0
    fi
  else
    log "锁目录缺少 pid 文件，跳过本次运行"
    exit 0
  fi
fi

echo "$$" > "$LOCK_PID_FILE"
trap cleanup_lock EXIT

if ! command -v docker >/dev/null 2>&1; then
  log "docker 未安装，跳过本次检查"
  exit 0
fi

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  log "deploy.sh 不存在或无执行权限：$DEPLOY_SCRIPT"
  exit 1
fi

log "开始检查镜像是否更新：$ALIYUN_IMAGE"

if ! docker pull "$ALIYUN_IMAGE" >/dev/null 2>&1; then
  log "拉取镜像失败，跳过本次检查"
  exit 0
fi

current_digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "$ALIYUN_IMAGE" 2>/dev/null || true)"
if [ -z "$current_digest" ] || [ "$current_digest" = "<no value>" ]; then
  log "无法读取镜像 digest，跳过本次检查"
  exit 0
fi

previous_digest=""
if [ -f "$STATE_FILE" ]; then
  previous_digest="$(cat "$STATE_FILE")"
fi

if [ -z "$previous_digest" ]; then
  echo "$current_digest" > "$STATE_FILE"
  log "首次初始化 digest：$current_digest"
  exit 0
fi

if [ "$current_digest" != "$previous_digest" ]; then
  log "检测到镜像更新：$previous_digest -> $current_digest"
  if (cd "$PROJECT_ROOT" && "$DEPLOY_SCRIPT") >>"$LOG_FILE" 2>&1; then
    echo "$current_digest" > "$STATE_FILE"
    log "自动部署成功，已更新 digest 状态"
  else
    log "自动部署失败，保留旧 digest 以便下次重试"
    exit 1
  fi
else
  log "镜像无更新"
fi
