#!/bin/bash
# Pre-push gate (T7-1 / T7-7). Run before every push:
#   bash scripts/gate.sh          # full: typecheck / tests / build / bundle / coverage
#   bash scripts/gate.sh --fast   # fast: typecheck / tests only (NOT valid for pushing)
# Any step failing => non-zero exit, with the log path printed.
# ASCII-only on purpose: a previous revision was double-encoded (mojibake in a variable
# name), which silently broke failure reporting. Keep this file free of non-ASCII bytes.
set -uo pipefail
cd "$(dirname "$0")/.."

FAST=0
for argument in "$@"; do
  case "$argument" in
    --fast) FAST=1 ;;
    *) echo "Unknown argument: $argument (only --fast is supported)"; exit 2 ;;
  esac
done

STEP=0
TOTAL=5
step() { STEP=$((STEP + 1)); echo; echo "=== ${STEP}/${TOTAL} $1 ==="; }
fail() { echo "FAILED: $1 (log: ${2:-none})"; exit 1; }

step "typecheck"
pnpm run typecheck || fail "typecheck"

step "build (lib 由构建生成，不再入库)"
# 2026-10-25 起 lib/ 不再入库（.gitignore 忽略，由 `pnpm run build`/`build:plugins` 生成）。
# 因此**必须先构建再跑测试**：产物契约测试（client-bundle / client-no-hardcoding）读的就是 lib/。
BUILD_LOG="/tmp/dsh-build-$(date +%s).log"
if ! pnpm run build > "$BUILD_LOG" 2>&1; then
  tail -20 "$BUILD_LOG"
  fail "build" "$BUILD_LOG"
fi
grep -E "Build complete" "$BUILD_LOG" | tail -2 || echo "(build finished; no 'Build complete' marker found)"
test -f lib/client/plugin.js || fail "build 没有产出 lib/client/plugin.js（构建配置漂了？）"

step "tests (full suite)"
TEST_LOG="/tmp/dsh-test-$(date +%s).log"
# Bound worker count: on a loaded machine vitest can fail to START workers
# ("Timeout waiting for worker to respond") even though every test passes.
# Fewer workers = slower but reliable; correctness of the gate matters more.
if ! pnpm exec vitest run --maxWorkers=2 > "$TEST_LOG" 2>&1; then
  echo "--- tail of test log ($TEST_LOG) ---"
  tail -40 "$TEST_LOG"
  echo "------------------------------------"
  if grep -qE "Tests[[:space:]]+[0-9]+ passed" "$TEST_LOG" && ! grep -qE "Tests .*failed" "$TEST_LOG"; then
    echo "WARNING: all tests report passed but the process exited non-zero."
    echo "         Likely a worker/teardown flake. Re-run: pnpm exec vitest run"
  else
    echo "FAILED: real test failures (see summary above)."
  fi
  exit 1
fi
grep -E "Test Files|Tests  " "$TEST_LOG" | tail -2

if [ "$FAST" -eq 1 ]; then
  echo
  echo "Fast gate passed (typecheck + build + tests)."
  echo "WARNING: bundle / coverage were NOT run. Before pushing run the full gate: bash scripts/gate.sh"
  exit 0
fi

step "client bundle budget"
pnpm run check:bundle || fail "client bundle over budget (slim it down, or document why in CHANGELOG and raise BUNDLE_BASELINE)"

step "coverage thresholds (vitest.config.ts)"
COVERAGE_LOG="/tmp/dsh-coverage-$(date +%s).log"
if ! pnpm exec vitest run --coverage > "$COVERAGE_LOG" 2>&1; then
  grep -E "Statements|Branches|Functions|Lines|ERROR|threshold" "$COVERAGE_LOG" | tail -8
  fail "coverage" "$COVERAGE_LOG"
fi
grep -E "Statements|Branches|Functions|Lines" "$COVERAGE_LOG" | tail -4

echo
echo "All five gates passed. Safe to push."
