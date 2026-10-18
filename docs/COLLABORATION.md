# 双轨协作规则（Track A 底层 / Track B 界面）

> 目标：两个人**并行干活、不产生合并冲突**。规则只有三条：**文件所有权矩阵**、**分支与合并顺序**、**接口契约先落地**。

## 一、文件所有权矩阵（谁的地盘谁改，越界即冲突）

| 范围 | 归属 | 说明 |
| --- | --- | --- |
| `src/client/**`（Workbench.tsx / WorkflowCanvas.tsx / workbench-style.ts / icons.tsx / locales.ts / api.ts / plugin.ts / canvas-style.ts） | **B（界面）** | A 一律不改 |
| `tests/*.client.test.tsx`、`tests/workflow-canvas.client.test.tsx`、`tests/client-*.test.ts`、`tests/version.test.ts` | **B** | 客户端测试归 B |
| `src/host/**`、`src/workbench/**`、`src/media/**`、`src/tools/**`、`src/http-client.ts`、`src/providers/**`、`src/config.ts`、`src/runtime-defaults.ts`、`src/version.ts` | **A（底层）** | B 一律不改 |
| 其余测试（store/runner/timeline/render/package/endpoints/ledger/cancel…） | **A** | |
| `src/workbench-contract.ts`、`src/host/rpc.ts`（**新增端点/字段**） | **A** | A 改完必须同步 `docs/API-SURFACE.md` |
| `src/client/api.ts` 里对接新端点的调用代码 | **B** | B 只消费契约，不改契约 |
| `lib/**`（构建产物，仓库入库） | **A** | **B 不提交 lib**（本地可 build 自测，但别 `git add lib`） |
| **Harness 里的子模块指针**（bump `plugins/dsh-image-video`） | **A 独占** | 2026-10-18 实测：两人同时 bump 指针 → rebase 必冲突。**B 永远不碰指针**；A 每次推送插件后在 Harness 里 bump 一次 |
| `scripts/**`、`.github/**` | **A** | |
| `docs/TASKS-TRACK-A.md` / `docs/TASKS-TRACK-B.md` / 各自新增文档 | 各自 | A 维护 COLLABORATION、REQUIREMENTS、EXECUTION、RELEASE；B 维护 UI 文档 |
| `package.json` / `pnpm-lock.yaml` / 依赖 | **A** | 需要新依赖先跟 A 说，由 A 添加（避免 lock 冲突） |

**B 的每日自检（防止越界）**：

```bash
git diff --name-only origin/main...HEAD | grep -vE '^(src/client/|tests/.*client.*|docs/)' && echo '⚠ 动了别人的文件' || echo '✓ 只动了自己地盘'
```

## 二、分支与合并顺序（避免互相 rebase 地狱）

- A 用 `track-a/<主题>`，B 用 `track-b/<主题>`；**都基于最新 `main`**开分支。
- 提交前：`git pull --rebase origin main` → `bash scripts/gate.sh` 四道门全绿 → 再推。
- **合并顺序：A 先合（host 契约/端点先落地），B 随后 rebase 到新 main 再合**。B 若被 A 的契约变更影响，A 必须在 `docs/API-SURFACE.md` 写清楚「新增/变更/废弃」。
- 一次主题一个分支，分支寿命 ≤ 3 天；超了就拆小。

## 三、接口契约怎么协作（唯一允许的"跨界"）

1. **A** 在 `src/host/rpc.ts` 加端点 → 在 `docs/API-SURFACE.md` 记一行：`端点名 / 入参 / 出参 / 错误码 / 对应需求 ID`。
2. **B** 在 `src/client/api.ts` 按那一行实现调用（B 拥有 api.ts）。
3. 若 B 需要新端点：在 `docs/API-SURFACE.md` 的「B 申请」区写一行需求（不要自己改 host ✗），A 认领后实现。
4. **契约冻结窗口**：每次发布（打 tag）前 24h 不再改契约，只修 bug。

## 四、冲突兜底

- 真撞车时：**B 让 A**（A 的改动是数据层，B 的界面可重放）；就地 rebase 解决，不要 force-push 到 main。
- `lib/` 冲突：**永远以 A 的构建为准**（B 本地 `git checkout -- lib`）。
- 发布：只有 A 打 tag（`v0.3.x-workbench-N`），流程见 `docs/RELEASE.md`。
