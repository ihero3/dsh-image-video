#!/bin/bash
# 紧急停止 Agent 的自动化（只停"会自动重启/唤醒"的东西，绝不动你正在用的 App）
#
# 用法：bash ~/dsh-agent-stop.sh
#
# 它做的事：
#   1. 移除 Agent 可能注册的 launchd 任务（dsh-self-restart / dsh-probe）
#   2. 杀掉 Agent 的重启脚本进程（只匹配脚本路径，不匹配 App 与 dev 启动器）
#   3. 清掉守卫/锁标记，避免下次误判
#   4. 打印结果与"App 是否仍在运行"
set -u
echo "=== 紧急停止 Agent 自动化 ==="

echo "[1/4] 移除 launchd 任务"
for label in dsh-self-restart dsh-probe; do
  if launchctl list 2>/dev/null | grep -q "	$label$"; then
    launchctl remove "$label" 2>/dev/null && echo "  已移除 launchd 任务: $label"
  else
    echo "  未发现: $label"
  fi
done

echo "[2/4] 杀掉重启脚本进程（不含 App 与 dev 启动器）"
killed=0
for pattern in "/private/tmp/dsh-self-restart.sh" "dsh-agent-restart.sh"; do
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  for pid in $pids; do
    kill "$pid" 2>/dev/null && echo "  已终止脚本进程 $pid ($pattern)" && killed=$((killed + 1))
  done
done
[ "$killed" -eq 0 ] && echo "  没有在跑的重启脚本"

echo "[3/4] 清理守卫标记"
rm -f /private/tmp/dsh-agent-restart.lock /private/tmp/dsh-agent-restart.done 2>/dev/null && echo "  已清理（若不存在则无副作用）"

echo "[4/4] 检查 App 是否仍在运行（这一步只读，不动你的 App）"
if curl -s --max-time 3 http://127.0.0.1:9222/json/list >/dev/null 2>&1; then
  echo "  App 仍在运行 ✓（调试端口 9222 可达）"
  echo "  提示：如果界面仍需恢复，请手动重启 App："
  echo "    cd /Users/guxiongjian/Documents/code/deepseek-harness && pnpm run dev:desktop"
else
  echo "  App 当前没在运行（或调试端口不同）"
fi
echo "=== 完成：自动化已停止，App 未被触碰 ==="
