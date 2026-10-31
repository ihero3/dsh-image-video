# 发布门禁清单（`T7-6`）

面向 `dsh-image-video` 的每次发布，按顺序做完再打 tag。任何一项没过就**不要**发。

## 1. 代码与产物的四道门

| # | 命令 | 通过标准 |
| --- | --- | --- |
| 1 | `pnpm run typecheck` | 退出码 0（宿主与客户端两个 tsconfig 都过） |
| 2 | `pnpm run test` | 全绿；跳过项必须写明原因（当前基线：**822 passed / 5 skipped**，144 个套件） |
| 3 | `pnpm run build` | 产出 `lib/**`，且 `lib` 已入库（私有插件只复制 `lib/`） |
| 4 | `pnpm run check:bundle` | 客户端产物在预算内（基线 +20%，超了就说明原因并同步抬基线） |

> **推之前先跑 `bash scripts/gate.sh`**：它把上面四道门串成一条命令，任何一步失败就非零退出。
> 这条纪律是被两次"测试还红着就推"逼出来的（git 的 pre-commit 钩子只做 whitespace/清单检查，不跑测试）。

## 2. 真机证据（阶段门禁要求）

- `docs/archive/2026-10-31/GATE-1-EVIDENCE.md` 里有**本阶段**的现场记录：真实调用、真实文件、真实任务 ID。
- 媒体流程至少覆盖 8 步：登记素材 → 画布跑生成 → 运行记录 → 时间轴拼片 → 顺序预览 → 字幕样式 → 导出成片 → 产物自动登记。
- 导出证据必须含 render id 与产物路径；生成证据必须含任务 id。

## 3. 交付面检查

- `manifest` / `dsh.client` 契约未改（`tests/manifest-contract.test.ts`）。
- 客户端产物里**没有**绝对路径与服务商/模型名（`tests/client-no-hardcoding.test.ts`）。
- 面向用户的错误都能"照着修"（`tests/error-actionability.test.ts` + ffmpeg/导出失败面测试）。
- 跨仓改动（若本次有）已登记 `FORK-FEATURES.md`。

## 4. 打 tag

```bash
git tag -a v0.x.y-workbench-N -m "dsh-image-video workbench N"
git push origin v0.x.y-workbench-N     # ← 推 tag 需要 owner 明确同意
```

- `x.y` 跟插件版本（`src/version.ts`），`N` 是工作台迭代号。
- 打 tag 前把 CHANGELOG 的 `未发布` 段落定稿成版本号。
- **打 tag 与推 tag 都需 owner 明确指令**（本项目约定：git 写操作听 owner）。

## 5. 事后

- 在 CHANGELOG 里补"已知缺口"（不许把没做的写成做了）。
- 冒烟：`node scripts/verify-workbench-tab.mjs` + 一次**零生成花费**的导出：

  ```bash
  npx tsx scripts/smoke-export.ts   # ffmpeg 本地合成夹具 → 真实导出 → 断言四件套
  ```

  它不调用任何模型：夹具由 `testsrc` 合成，只走 `RenderService` / `RenderRegistry` 生产链路。
