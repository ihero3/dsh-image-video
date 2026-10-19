#!/bin/bash
# 推送前的一条命令门禁（`T7-1`/`T7-7` 的纪律化）。
#
# 背景：曾经两次"测试还是红的就推上去了"——git 的 pre-commit 钩子只跑 whitespace/清单，
# 不跑测试。所以把五道门做成一条命令，推之前一律先跑它：
#   bash scripts/gate.sh
# 任何一步失败就**不许推**（脚本以非零退出并指出是哪一步 + 日志路径）。
set -uo pipefail
cd "$(dirname "$0")/.."

STEP=0
TOTAL=5
step() { STEP=$((STEP + 1)); echo; echo "=== ${STEP}/${TOTAL} $1 ==="; }
fail() { echo "✗ ${1}（见日志：${2:-无}）"; exit 1; }

step "typecheck"
pnpm run typecheck || fail "typecheck 未通过"

# 测试：日志完整落盘（不再用 tail 截断——之前正是因为截断，看不到真正的失败原因）
step "全量测试"
TEST_LOG="/tmp/dsh-test-$(date +%s).log"
if ! pnpm run test > "$TEST_LOG" 2>&1; then
  echo "--- 测试日志尾部（完整：$TEST_LOG）---"
  tail -40 "$TEST_LOG"
  echo "-----------------------------------"
  # 区分"真有失败"与"全部通过但进程非零退出"（worker/teardown 抖动）
  if grep -qE "Tests[[:space:]]+[0-9]+ passed" "$TEST_LOG" && ! grep -qE "Tests .*failed" "$TEST_LOG"; then
    echo "⚠ 日志显示测试全部通过，但进程退出码非 0 —— 疑似 worker/teardown 抖动。"
    echo "  请单跑确认：pnpm exec vitest run"
  else
    echo "✗ 测试确有失败（见上方摘要）。"
  fi
  exit 1
fi
grep -E "Test Files|Tests  " "$TEST_LOG" | tail -2

step "构建（lib 是入库产物）"
BUILD_LOG="/tmp/dsh-build-$(date +%s).log"
if ! pnpm run build > "$BUILD_LOG" 2>&1; then
  tail -20 "$BUILD_LOG"
  fail "构建失败" "$BUILD_LOG"
fi
grep -E "Build complete" "$BUILD_LOG" | tail -2 || echo "（构建完成，未匹配到 Build complete 字样）"

step "客户端体积门禁"
pnpm run check:bundle || fail "客户端产物体积超预算（先看能否瘦身；确需抬预算须在 CHANGELOG 写明原因并改 BUNDLE_BASELINE）"

step "覆盖率门禁（低于 vitest.config.ts 阈值即失败）"
COVERAGE_LOG="/tmp/dsh-coverage-$(date +%s).log"
if ! pnpm exec vitest run --coverage > "$COVERAGE_LOG" 2>&1; then
  grep -E "Statements|Branches|Functions|Lines|ERROR|threshold" "$COVERAGE_LOG" | tail -8
  fail "覆盖率门禁失败" "$COVERAGE_LOG"
fi
grep -E "Statements|Branches|Functions|Lines" "$COVERAGE_LOG" | tail -4

echo
echo "五道门全过：可以推。"
