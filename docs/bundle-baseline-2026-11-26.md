# 体积门禁开工前基线证据（2026-11-26）

> 用途：`QUICK-CREATE-REDESIGN.md` v1.2 §11.5 第 1 条要求的开工前留证。
> 采集时间：2026-11-26 10:29 GMT+8
> 命令：`cd plugins/dsh-image-video && node scripts/check-bundle-size.mjs`
> 结果：**exit 1（超预算）**——发生在快速创作改造实施之前，不得归因于本次 UI 改动。

## 原始输出

```text
入口：lib/client/plugin.js
  基线 : raw 23000 B · gzip 7800 B
  预算 : raw 27600 B · gzip 9360 B
  实测 : raw 24231 B（占预算 88%）· gzip 8215 B（占预算 88%）

包内 chunk（首次打开工作台才下载）：
  client.Workbench.js: raw 1475085 B · gzip 317561 B

总产物（入口 + chunk）：
  基线 : raw 1170000 B · gzip 255000 B
  预算 : raw 1404000 B · gzip 306000 B
  实测 : raw 1499316 B（占预算 107%）· gzip 325776 B（占预算 106%）

体积超预算：
  - 总产物 raw 1499316 > 1404000（超 95316 B）
  - 总产物 gzip 325776 > 306000（超 19776 B）
处理方式：先看能否瘦身；确实必要就在 CHANGELOG 里写明原因并同步抬高对应基线。
```

## 结论

| 项 | 实测 | 预算 | 占用 |
|----|------|------|------|
| 入口 raw | 24,231 B | 27,600 B | 88%（余 3,369 B） |
| 入口 gzip | 8,215 B | 9,360 B | 88% |
| 总产物 raw | 1,499,316 B | 1,404,000 B | **107%，超 95,316 B** |
| 总产物 gzip | 325,776 B | 306,000 B | **106%，超 19,776 B** |

1. 入口仍有 3,369 B raw 余量，Step 1 新增 8 个 locale key（en + zh 双份）预计 500–700 B，装得下，但加完必须复测。
2. 总产物超限是既有事实，按仓库惯例需先决定是否在本次 CHANGELOG 中说明并抬高 `BUNDLE_TOTAL_BASELINE`。

## Step 1 后复测（新增 8 个 locale key）

命令：`pnpm exec tsdown && node scripts/check-bundle-size.mjs`（跳过 `clean`，沙箱 safe-delete 会拦 `rmSync('lib')`）

| 项 | Step 1 前 | Step 1 后 | 变化 |
|----|-----------|-----------|------|
| 入口 raw | 24,231 B | 24,231 B | **0** |
| 入口 gzip | 8,215 B | 8,215 B | **0** |
| `client.Workbench.js` raw | 1,475,085 B | 1,475,774 B | +689 B |
| 总产物 raw | 1,499,316 B | 1,500,005 B | +689 B（超限升至 96,005 B） |

关键结论：`grep -c quickRefsLabel lib/client/plugin.js` = **0**，`grep -c 参考图 lib/client/plugin.js` = **0**，而 chunk 中为 **2**（en + zh）。`locales.ts` 字典现已随 chunk 分发、不进入口；旧口径「入口余量仅 577 B，新增 key 必破门禁」不再成立。入口体积不再构成本轮约束。

## Step 3 后复测（modern-theme.ts 样式）

命令同上（`pnpm exec tsdown && node scripts/check-bundle-size.mjs`）。

| 项 | Step 2 后 | Step 3 后 | 变化 |
|----|-----------|-----------|------|
| 入口 raw / gzip | 24,231 / 8,215 B | 24,231 / 8,215 B | **0** |
| `client.Workbench.js` raw | 1,475,774 B | 1,487,447 B | +11,673 B |
| 总产物 raw | 1,500,005 B | 1,511,678 B | 超限 96,005 → **107,678 B** |
| 总产物 gzip | — | 327,384 B | 超 21,384 B |

门禁仍为 exit 1；新增约 10–11 KB raw / 1.6 KB gzip 来自 `.iv .iv-qc-*` / `.iv-ref-*` / `.iv-advanced*` 等约 50 条规则。基线决策（是否抬 `BUNDLE_TOTAL_BASELINE` 并在 CHANGELOG 说明）仍未拍板。

## 真机反馈修复后复测（v1.2.1）

| 项 | Step 3 后 | v1.2.1 后 | 变化 |
|----|-----------|-----------|------|
| 入口 raw / gzip | 24,231 / 8,215 B | 24,231 / 8,215 B | **0** |
| 总产物 raw | 1,511,678 B | 1,510,969 B | −709 B（死规则 `iv-ref-empty*` 删除、空态提示简化） |
| 总产物 gzip | 327,384 B | 327,362 B | −22 B |

超预算 raw 106,969 B / gzip 21,362 B，门禁仍 exit 1。
