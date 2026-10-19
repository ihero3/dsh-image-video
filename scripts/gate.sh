#!/bin/bash
# 推送前的一条命令门禁（`T7-1`/`T7-7` 的纪律化）。
#
# 背景：今天两次"测试还是红的就推上去了"——git 的 pre-commit 钩子只跑 whitespace/清单，
# 不跑测试。所以把五道门做成一条命令，推之前一律先跑它：
#   bash scripts/gate.sh
# 任何一步失败就**不许推**（脚本会以非零退出并指出是哪一步）。
set -euo pipefail
cd "$(dirname "$0")/.."

step() { echo; echo "=== $1 ==="; }

step "1/4 typecheck"
pnpm run typecheck

step "2/4 全量测试"
pnpm run test 2>&1 | tail -5

step "3/4 构建（lib 是入库产物）"
pnpm run build 2>&1 | grep -E "Build complete" | tail -2

step "4/4 客户端体积门禁"
pnpm run check:bundle

echo
echo "五道门全过：可以推。"

# === 5/5 覆盖率门禁（A36）：低于 vitest.config.ts 里的阈值即失败 ===
echo "=== 5/5 覆盖率门禁 ==="
if ! pnpm exec vitest run --coverage > /tmp/dsh-coverage.log 2>&1; then
  echo "覆盖率门禁失败（详见 /tmp/dsh-coverage.log）："
  grep -E "Statements|Branches|Functions|Lines|ERROR" /tmp/dsh-coverage.log | tail -6
  exit 1
fi
grep -E "Statements|Branches|Functions|Lines" /tmp/dsh-coverage.log | tail -4
echo "覆盖率门禁通过。"
