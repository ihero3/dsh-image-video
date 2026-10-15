#!/bin/bash
# Agent 的安全一次性自重启（专门防 2026-10-15 那次"无限重启"再发生）
#
# 三条硬守卫：
#   1) 绝不交给 launchd：`launchctl submit` 会在脚本退出后重跑，那正是 164 次循环的根因；
#      这里用 setsid 脱离会话的一次性进程，跑完就退出，不留常驻进程。
#   2) 冷却守卫：默认 15 分钟内已经成功重启过 → 直接退出、什么都不做（重复调用永远无害）。
#   3) 并发锁：已有重启在跑 → 退出。
#
# 用法：
#   bash ~/dsh-agent-restart.sh            # 真正重启（带守卫）
#   bash ~/dsh-agent-restart.sh --check    # 只做守卫自检，不杀任何进程（安全）
#   bash ~/dsh-agent-restart.sh --force     # 跳过冷却守卫（仅在明确要求时用）
set -u
LOG=/private/tmp/dsh-agent-restart.log
STAMP=/private/tmp/dsh-agent-restart.done
LOCKDIR=/private/tmp/dsh-agent-restart.lock
COOLDOWN=${DSH_RESTART_COOLDOWN_SECONDS:-900}
MODE=${1:-run}

check_guards() {
  local now last age
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
    local lock_age
    lock_age=$((now - $(stat -f %m "$LOCKDIR" 2>/dev/null || echo 0)))
    if [ "$lock_age" -lt 600 ]; then
      echo "已有重启在进行（锁 $(basename "$LOCKDIR")，$lock_age 秒）：本次不做任何事"
      return 1
    fi
    echo "发现超过 10 分钟的陈旧锁，清掉继续"
    rm -rf "$LOCKDIR"
  fi
  return 0
}

if [ "$MODE" = "--check" ]; then
  echo "=== 守卫自检（不会杀任何进程） ==="
  if check_guards; then echo "结论：会执行一次重启（App 会被重启一次，随后自动回来）"; else echo "结论：什么都不会做"; fi
  exit 0
fi

if ! check_guards; then
  echo "守卫拦下：未做任何操作"
  exit 0
fi
mkdir "$LOCKDIR" 2>/dev/null || { echo "拿不到锁，退出"; exit 0; }

# 脱离会话：Agent 的会话进程死掉也不影响这次重启
if [ "${DSH_RESTART_DETACHED:-0}" != "1" ]; then
  DSH_RESTART_DETACHED=1 nohup bash -c "setsid_ok=\$(command -v setsid || true); if [ -n \"\$setsid_ok\" ]; then exec setsid /bin/bash '$0' --run; else exec /bin/bash '$0' --run; fi" >>"$LOG" 2>&1 &
  disown 2>/dev/null || true
  echo "已排定自重启（脱离会话，日志 $LOG）"
  exit 0
fi

echo "=== [$(date '+%F %T')] 安全自重启开始 ===" >>"$LOG"
{
  echo "=== [$(date '+%F %T')] 安全自重启开始 ==="
  echo "监听 9222 的进程: $(lsof -iTCP:9222 -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')"
  pkill -f "Harness Dev.app/Contents/MacOS/Electron" 2>/dev/null && echo "已终止 App（仅一次）"
  pkill -f "scripts/dev.ts" 2>/dev/null && echo "已终止 dev 启动器"
  sleep 5
  pkill -9 -f "Harness Dev.app/Contents/MacOS/Electron" 2>/dev/null
  sleep 2
  cd /Users/guxiongjian/Documents/code/deepseek-harness || { echo "RESULT=FAIL 找不到仓库"; exit 1; }
  PNPM=$(command -v pnpm || command -v corepack || echo npx)
  env PATH="$PATH" "$PNPM" run dev:desktop >>"$LOG" 2>&1 &
  for i in $(seq 1 90); do
    sleep 2
    if curl -s --max-time 2 http://127.0.0.1:9222/json/list >/dev/null 2>&1; then
      date +%s >"$STAMP"     # 只在确认 App 回来后才记冷却时间
      echo "RESULT=PASS App 在约 $((i*2 + 7)) 秒后回来（已写冷却标记）"
      rm -rf "$LOCKDIR"
      exit 0
    fi
  done
  echo "RESULT=FAIL 180 秒内没有等到 App 回来（不再自动重试；把日志发我）"
  rm -rf "$LOCKDIR"
  exit 1
} >>"$LOG" 2>&1
