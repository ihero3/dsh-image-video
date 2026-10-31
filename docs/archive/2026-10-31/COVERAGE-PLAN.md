# 覆盖率门禁：根级 vitest 对齐方案（A28）

> 状态：**方案待 owner 拍板**。本文件只描述怎么做、怎么验证、怎么回滚，**不包含任何已执行的依赖改动**。

## 一、问题（实测证据）

| 事实 | 数值/现象 |
| --- | --- |
| 插件解析到的 vitest | `3.2.7`（插件自身 devDependencies 里有 vitest） |
| 根安装的覆盖率 provider | `@vitest/coverage-v8@4.1.11` |
| 直接跑 `vitest --coverage` | 崩：`Cannot read properties of undefined (reading 'reportsDirectory')`（provider 与 vitest 大版本不匹配） |
| 单独给插件加 `@vitest/coverage-v8@3.2.7` | 装得上（10.7s，解析到匹配构建），但 pnpm 重链接 96 个包后 **Track B 的 `tests/client-rpc-transport.test.ts` 失败**（`@deepseek-ai/dsh-client-connection/src/client/rpc.ts` 解析不到）→ 已完整回滚 |

结论：**不能在插件侧单装**，必须做根级对齐。

## 二、方案 A（推荐）：根级统一 vitest 大版本

### 目标
让"根 / 插件"使用同一个 vitest 大版本，从而能安装匹配的 coverage provider 并稳定产出覆盖率报告。

### 步骤
1. **摸清依赖树**：`pnpm why vitest`（根与插件各一次），确认谁把 vitest 拉成 3.x、谁是 4.x。
2. **选目标版本**：优先"全仓对齐到根已有的 4.x"（改动面更小、根已装 coverage-v8@4.1.11）；若某些插件强依赖 3.x，则整体对齐到 3.x 并安装 `coverage-v8@3.x`。
3. **只改依赖，不改代码**：调整根 `package.json` 的 devDependencies（必要时在 `pnpm-workspace.yaml` 加 `overrides`/`peerDependencyRules`），**单独一个 commit**。
4. `pnpm install`（观察是否重新链接大量包——上次的坑就在这里）。
5. **完整回归**（见下）。
6. 覆盖率跑通后，按实测值设阈值（先取实测值向下留 2–3 个百分点，再逐步爬升）。

### 验证清单（必须全绿才允许提交）
- [ ] 根 `pnpm install` 无报错、无 `peers check` 阻断项
- [ ] 插件 `pnpm exec vitest run` 全绿（当前基线 568 passed / 5 skipped）
- [ ] **`tests/client-rpc-transport.test.ts` 单独跑绿**（上次就挂在这里）
- [ ] 插件 `pnpm exec vitest run --coverage` 能产出 `text-summary`，并记录 line/branch/function/statement 四个数
- [ ] `bash scripts/gate.sh` 四道门全绿
- [ ] 根仓相关包（至少 `packages/*` 里依赖 vitest 的）测试不回归

### 回滚路径（一条命令）
```bash
git checkout -- pnpm-lock.yaml package.json plugins/dsh-image-video/package.json
pnpm install --filter dsh-image-video   # 重新链接回原状
pnpm exec vitest run tests/client-rpc-transport.test.ts   # 确认恢复
```

### 风险与耗时
- 风险：根级 vitest 升级会牵动**其它插件/包**的测试（特别是 peer 语义变化）；`pnpm install` 会重新链接，需确认无解析回归。
- 耗时估计：30–60 分钟（含完整回归）。
- 建议：**单独一次提交 + 单独验证**，不与其他功能混在一起；在打 tag 前必须全绿。

## 三、方案 B（保守）：覆盖率暂缓

保持现状，质量用以下已有指标把关（都已在跑）：
- `scripts/gate.sh` 四道门（typecheck / 全量测试 / 构建 / 体积预算）
- 全量测试基线（当前 **568 passed / 5 skipped**）
- 真实 IO 用例（ffmpeg 渲染、包往返、迁移链）

缺点：没有"覆盖率随功能增长而下降"的自动告警。

## 四、需要 owner 决定的事

1. 走 **A**（我做根级对齐，单独提交 + 完整回归 + 回滚路径已备好）还是 **B**（暂缓，标为已知缺口）？
2. 若走 A：优先对齐到 **4.x**（推荐，根已装 4.1.11）还是 **3.x**？
