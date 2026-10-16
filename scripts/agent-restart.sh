#!/bin/bash
# Agent 的安全一次性自重启（专门防 2026-10-15 那次"无限重启"再发生）
#
# 三条硬守卫：
#   1) 绝不交给 launchd：`launchctl submit` 会在脚本退出后重跑，那是 164 次循环的根因；
#      这里用"新会话 + 一次性进程"，跑完就退出，不留常驻进程。
#   2) 冷却守卫：默认 15 分钟内已成功重启过 → 直接退出、什么都不做（重复调用永远无害）。
#   3) 并发锁：已有重启在跑 → 退出（陈旧锁 >10 分钟自动清）。
#
# 用法：
#   bash ~/dsh-agent-restart.sh --check     # 只做守卫自检，不杀任何进程（安全）
#   bash ~/dsh-agent-restart.sh --dry-run   # 走完整流程但**不杀不启**（验证脚本自身）
#   bash ~/dsh-agent-restart.sh             # 真正重启一次
#   bash ~/dsh-agent-restart.sh --force      # 跳过冷却守卫
set -u
LOG=/private/tmp/dsh-agent-restart.log
STAMP=/private/tmp/dsh-agent-restart.done
LOCKDIR=/private/tmp/dsh-agent-restart.lock
COOLDOWN=${DSH_RESTART_COOLDOWN_SECONDS:-900}
MODE=${1:-run}

if [ "$MODE" = "--stop" ]; then
  rm -rf "$LOCKDIR"
  echo "已清除并发锁（若有）"
  exit 0
fi

check_guards() {
  local now last age lock_age
  now=$(date +%s)
  if [ "$MODE" != "--force" ] && [ -f "$STAMP" ]; then
    last=$(cat "$STAMP" 2>/dev/null || echo 0)
    case "$last" in ''|*[!0-9]*) last=0 ;; esac
    age=$((now - last))
    if [ "$age" -lt "$COOLDOWN" ]; then
      echo "冷却中（$((COOLDOWN - age)) 秒后可再重启）：本次不做任何事"
      return 1
    fi
  fi
  if [ -d "$LOCKDIR" ]; then
    lock_age=$((now - $(stat -f %m "$LOCKDIR" 2>/dev/null || echo 0)))
    if [ "$lock_age" -lt 600 ]; then
      echo "已有重启在进行（锁 ${LOCKDIR}，$lock_age 秒）：本次不做任何事"
      return 1
    fi
    echo "发现超过 10 分钟的陈旧锁，清掉继续"
    rm -rf "$LOCKDIR"
  fi
  return 0
}

if [ "$MODE" = "--check" ]; then
  echo "=== 守卫自检（不会杀任何进程） ==="
  if check_guards; then echo "结论：会执行一次重启（App 重启一次后自动回来）"; else echo "结论：什么都不会做"; fi
  exit 0
fi

if ! check_guards; then
  echo "守卫拦下：未做任何操作"
  exit 0
fi

# 真正干活的那一段（--dry-run 只打印）
work() {
  echo "=== [$(date '+%F %T')] 安全自重启开始（dry-run=${DRY_RUN:-0}） ==="
  echo "监听 9222 的进程: $(lsof -iTCP:9222 -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')"
  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "DRY-RUN：到这一步会执行 pkill App/dev、sleep 7、在仓库根跑 pnpm run dev:desktop 并轮询 9222"
    echo "RESULT=DRY-RUN"
    return 0
  fi
  pkill -f "Harness Dev.app/Contents/MacOS/Electron" 2>/dev/null && echo "已终止 App（仅一次）"
  pkill -f "scripts/dev.ts" 2>/dev/null && echo "已终止 dev 启动器"
  sleep 5
  pkill -9 -f "Harness Dev.app/Contents/MacOS/Electron" 2>/dev/null
  sleep 2
  cd /Users/guxiongjian/Documents/code/deepseek-harness || { echo "RESULT=FAIL 找不到仓库"; return 1; }
  PNPM=$(command -v pnpm || command -v corepack || echo npx)
  # 关键：宿主继承来的 ELECTRON_RUN_AS_NODE=1 会让 Electron 退化成纯 Node，
  # 于是它拒绝 --remote-debugging-port/--user-data-dir（昨晚重启失败的真正原因）。
  env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS PATH="$PATH" "$PNPM" run dev:desktop >>"$LOG" 2>&1 &
  for i in $(seq 1 90); do
    sleep 2
    if curl -s --max-time 2 http://127.0.0.1:9222/json/list >/dev/null 2>&1; then
      date +%s >"$STAMP"
      echo "RESULT=PASS App 在约 $((i * 2 + 7)) 秒后回来（已写冷却标记）"
      return 0
    fi
  done
  echo "RESULT=FAIL 180 秒内没有等到 App 回来（不再自动重试）"
  return 1
}

# --dry-run：前台走完整流程，不杀不启
if [ "$MODE" = "--dry-run" ]; then
  mkdir "$LOCKDIR" 2>/dev/null || { echo "拿不到锁，退出"; exit 0; }
  DRY_RUN=1 work
  status=$?
  rm -rf "$LOCKDIR"
  echo "dry-run 结束（退出码 ${status}）"
  exit 0
fi

# 脱离会话：Agent 会话死掉也不影响这次重启；不自带任何调度器
if [ "${DSH_RESTART_DETACHED:-0}" != "1" ]; then
  echo "=== [$(date '+%F %T')] 排定一次性自重启（新会话，不经 launchd） ===" >>"$LOG"
  DSH_RESTART_DETACHED=1 nohup python3 -c "
import os, subprocess, sys
os.setsid()
subprocess.Popen(['/bin/bash', sys.argv[1], '--run'],
                 env=dict(os.environ, DSH_RESTART_DETACHED='1'),
                 stdin=subprocess.DEVNULL,
                 stdout=open('/private/tmp/dsh-agent-restart.log', 'a'),
                 stderr=subprocess.STDOUT,
                 start_new_session=True)
" "$0" >>"$LOG" 2>&1 &
  echo "已排定自重启（脱离会话，日志 ${LOG}）"
  exit 0
fi

mkdir "$LOCKDIR" 2>/dev/null || { echo "拿不到锁（可能已有重启在跑）：未做任何操作"; exit 0; }
work >>"$LOG" 2>&1
status=$?
rm -rf "$LOCKDIR"
exit "$status"
