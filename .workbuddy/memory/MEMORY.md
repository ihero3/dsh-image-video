# dsh-image-video — 长期项目约定

## 验证口径（每次实质改动都要走）

- `pnpm run typecheck`（两份 tsconfig）
- 定向 vitest → 全量 `pnpm exec vitest run --maxWorkers=2 --retry=0`
- 必要时 `pnpm exec tsdown` 打包
- 汇报如实给数字（含 skipped）；失败先说失败，别宣称完成

## 代码约定

- 文案集中在 `src/client/locales.ts`：中英两份字典 + `WorkbenchLocaleKey` 联合类型，三处同步改；改完 grep 旧串确认无残留。
- 前端 UI 状态在 `src/client/workbench-store.ts`：按剧集隔离的内存快照 + localStorage 草稿（key `image-video:script-draft:<episodeId>`）。
- 宿主 RPC `src/host/rpc.ts`，客户端封装 `src/client/api.ts`；新增端点同步更新 `docs/API-SURFACE.md` 与 `CHANGELOG.md`。
- 测试替身 `tests/client-fake-api.ts`；全局隔离在 `tests/setup-dom.ts`（`afterEach` 清 `image-video:script-draft:*`，另有 ResizeObserver stub 与 `asyncUtilTimeout: 2000`）。**新增浏览器存储型状态必须在这里清理**，否则用例互相污染（曾导致全量跑 4 例失败）。
- `data-episode-*` / `data-workflow-*` / `data-pipeline-*` 等定位属性是测试契约，别随手改。

## 既定设计决策

- 单集导出 `episode.json` v2：含 `storyboards` + `resourceRefs`/`assetRefs`；导入**新建一集**、id 全量重发、不覆盖现有集；v1 清单给分镜缺失提示。
- 「同步到工作流」确定性幂等：id `wfl-ep-<集id>`，逐镜 image→video 链 + 末尾 preview，整图 upsert 覆盖而非追加。
- 工作流 JSON 统一入口 `src/client/workflow-io.ts` + 适配层 `src/workbench/workflow-adapters.ts`：兼容 dsh 原生 / ComfyUI UI（`nodes`+`links`，LiblibAI 导出同构）/ ComfyUI API（`class_type`+`inputs`）/ 项目包 `manifest.json`。映射不了的节点保留为 `external`（原始 JSON 存 config），可见可导回但**不可运行**——没有执行引擎就不假装能跑。导出仍为 dsh 原生，**单向兼容**。
- 画布导入入口：文件选择、拖拽 `.json`/`.png`、Ctrl/Cmd+V 粘贴 JSON、PNG 元数据 `workflow`/`prompt` 还原。
- 比例/分辨率没有集级数据源，沿用节点默认值；模型与按镜引用写进生成节点（`refs` 元数据参数，不制造端口不匹配的连线）。

## 用户偏好

- 中文、简洁随意；先给结论，缺口要明说。
- 交付要能独立读懂（中间过程在 UI 里是折叠的）。
