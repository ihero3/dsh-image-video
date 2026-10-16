#!/bin/bash
# 推送前的一条命令门禁（`T7-1`/`T7-7` 的纪律化）。
#
# 背景：今天两次"测试还是红的就推上去了"——git 的 pre-commit 钩子只跑 whitespace/清单，
# 不跑测试。所以把四道门做成一条命令，推之前一律先跑它：
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
echo "四道门全过：可以推。"
