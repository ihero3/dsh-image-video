# Track A 任务书（底层：逻辑 / 框架 / API / 模型 / 数据 / 渲染）

> 归属：**你（owner）**。地盘：`src/host`、`src/workbench`、`src/media`、`src/tools`、`scripts`、`lib`、依赖与发布。
> 原则：**契约先行**（新增/变更端点先写 `docs/API-SURFACE.md`），B 依赖你的产出，所以**优先做能解锁 B 的项**。
> 每项完成条件：`bash scripts/gate.sh` 四道门全绿 + 有测试 + 在 CHANGELOG 记一行。

## P0（解锁界面的关键底层，先做）

- [x] **A1 时间轴音轨能力（领域+导出）**：`TimelineTrack` 增加 `volume`（0–2）/`muted`；校验入库；导出 filter graph 支持 `volume=` 与 `-an` 静音；测试：音量字段往返 + filter 含 volume。*（对应总任务书 §7.2）* ✅ 2026-10-18 完成：`volume`(0–2)/`muted` 入库并往返；导出真实混音（aresample→volume→concat→amix，多轨 `normalize=0`）；静音轨不输出；真机验证产物含 `Audio: aac` 且时长 ±1 帧；测试 3 例
- [x] **A2 导出参数化**：`RenderService` 支持 `{ width, height, frameRate, bitrate? }`，校验（分辨率白名单/帧率 24/25/30/60）；输出规格复核（宽高/帧率实测）；测试：非默认规格导出可播放且时长 ±1 帧。*（§7.3）* ✅ 2026-10-18 完成：`TimelineRecord.exportFormat`（宽高偶数 128–4096 / 帧率 24·25·30·60 / 码率 500–50000 kbps）入库校验；导出按规格出片（scale/pad/fps/`-b:v`）；**产物实测复核**（`probeMediaSpec` 校验宽高与帧率，不符报 `MEDIA_OUTPUT_INVALID`）；真机 640×360@24 验证；测试 4 例
- [x] **A3 撤销/重做领域支撑** ✅ 完成（2026-10-18）：见 CHANGELOG：给 store 增加**命令式变更 API**（`apply(ops)` 返回反操作）+ 快照栈接口（供 B 接线 UI）；测试：编辑→撤销→重做后文档逐字段一致。*（§6.2、§7.1 的 undo/redo）*
- [x] **A4 渲染队列与并发控制** ✅ 完成（2026-10-18）：见 CHANGELOG：导出同时最多 1 个、其余排队（状态 `queued`）；工作流节点并发上限可配；测试：两个导出排队顺序 + 取消排队项。
- [x] **A5 节点级超时与重试策略化** ✅ 2026-10-18：`nodeTimeoutMs(kind)` + 默认图像 180s/视频 900s/其它 120s；每次尝试独立 AbortController + `Promise.race` 超时护栏（工具无视取消也能结束）；超时计入瞬时失败并重试；`retryBackoffMs` 可配；测试 3 例：`timeoutMs` 可配（默认按 kind）、重试次数/退避可配；测试：超时节点记为 failed 且带可操作文案。

## 批次二（A13–A16）

- [x] **A13 变速/淡入淡出/裁剪 + 跨段 xfade 转场（已完成）** ✅ 2026-10-18：片段新增 `speed`(0.25–4)/`fade`(0–2000ms)/`crop`（偶数宽高）；**时间轴所有占位计算按变速折算**（`effectiveDurationMs` 已用于 `timelineDurationMs`/`activeClipAt`/导出排布，避免成片与时间轴错位）；导出链 `crop → setpts → fade → fps → scale/pad` 已落地并验到 filter 里；测试 4 例。**已闭环**：端到端时长偏差的根因是 `freezeTimeline` 里另算了一遍总时长（用原始 `durationMs`），导致 2 倍速片段后补了 0.5s 黑场 → 改为统一走 `timelineDurationMs`（按变速折算）；真机 2 倍速 + 裁剪 + 淡入淡出输出 **500ms ±70ms** ✓；**A13b xfade 跨段转场**：`transition`(fade/wipeleft/circleopen) + `transitionDurationMs`(0–2000，缺省 400)，时间轴总时长**扣掉段间重叠**，导出改用 `xfade` 链（无转场时仍走 `concat`，零回归）；真机 2×1s + 0.4s 转场 = **1.6s ±120ms** ✓
- [x] **A14 字幕批量生成** ✅ 2026-10-18：`src/workbench/subtitles.ts`（按句末标点切句 → 长句按逗号续切 → 仍超长硬切；按字数比例分配时间、保底最短显示、放不下就截断而不是压到看不见）；工具面 `workbench_timeline action=add-subtitles`（缺省接在字幕轨末尾/到时间轴末尾）；测试 18 例：按句切分 + 时间分配 + 工具面动作
- [x] **A15 输出配额与清理** ✅ 2026-10-18：`src/media/retention.ts` 纯函数计划器（最旧优先、受保护引用不动、至少保留最新 N、可预演）；端点 `maintenance/retention`（**默认 dryRun**，`dryRun=false` 才真删，且只删 outputs 目录内、名字不含路径分隔符的文件）；`store.referencedAssetPaths()` 提供保护名单；测试 4 例：outputs 上限、`maintenance` 扩展、诊断暴露
- [x] **A16 发布 `v0.3.4-workbench-4`** ✅ 2026-10-18：版本 0.3.4 / CHANGELOG 定稿（A13–A15）/ lib 构建提交 / tag / Harness 指针同步；全量测试与四道门见发布提交说明

## 批次三（A17–A19）

- [x] **A17 时间轴 schema v3 + 真实迁移** ✅ 2026-10-18：`WORKBENCH_SCHEMA_VERSION=3`，新增 2→3 迁移（A13/A13b 的 `speed/fade/crop/transition` 均为可选字段，无需改写旧数据）；迁移链 1→2→3 全绿；测试适配（注入链两步）
- [x] **A18 诊断暴露 outputs/保留策略状态** ✅ 2026-10-18：`diagnostics` 新增 `outputs{files,bytes,referenced,oldestAt?,newestAt?}`（与 `maintenance/retention` 配合决定是否清理）；端点测试断言字段可读
- [x] **A19 发布 `v0.3.5-workbench-5`** ✅ 2026-10-18：版本 0.3.5 / CHANGELOG 定稿（xfade + schema v3 + 诊断输出占用）/ lib 构建 / tag / Harness 指针同步

## 批次四（A20–A23）

- [x] **A20 音频淡入淡出 + 响度归一化** ✅ 2026-10-18：音轨 `fadeMs`(0–5000) + 文档 `normalizeLoudness`（缺省关）；导出链 `afade=t=in/out`（轨内）+ `loudnorm=I=-16:TP=-1.5:LRA=11`（混音后）；真机出片仍有音轨且时长不变；测试 3 例
- [x] **A21 耗时分位数日志 + 诊断渲染统计** ✅ 2026-10-18：`RenderRegistry` 记最近 50 次渲染耗时并输出 `render-finished` 结构化日志（含 status/durationMs）；新增 `stats()`（成功/失败/取消计数 + p50/p90）；`diagnostics.renders.stats` 暴露；节点侧 `durationMs` 早已在 runner 日志里；测试 +2
- [ ] **A22 覆盖率门禁依赖对齐（⏸ 试过并回滚，待根级依赖方案）** 2026-10-18 实测：在根执行 `pnpm add -D --filter dsh-image-video @vitest/coverage-v8@3.2.7` 安装成功（10.7s，插件 devDep=3.2.7 且解析到匹配 vitest@3.2.7 的构建），但触发 pnpm 重新链接 96 个包后，**Track B 的 `tests/client-rpc-transport.test.ts` 直接挂了**（`@deepseek-ai/dsh-client-connection/src/client/rpc.ts` 解析不到）→ 立刻回滚（`pnpm-lock.yaml` + 插件 `package.json`/`vitest.config.ts` + `pnpm install --filter`），B 的用例恢复 3/3 绿。**结论：单独给插件加 coverage devDep 会扰动工作区的 client-connection 解析，正确做法是根级统一升/对齐 vitest 大版本（属跨仓依赖治理），需要 owner 决策后排期**；在此之前 A11 的覆盖率门禁保持暂缓
- [x] **A23 发布 `v0.3.6-workbench-6`** ✅ 2026-10-18：A20（音频淡入淡出+响度归一化）+ A21（渲染耗时分位数与诊断统计）；A22 记为待 owner 决策

## 批次五（A24–A27，2026-10-19 起）

- [x] **A24 时间轴片段拆分/复制（域 + 工具）** ✅ 2026-10-19：`src/workbench/edits.ts`（`splitClipAt` 按变速折算源内偏移、总时长不变；`duplicateClip` 默认紧跟原片段、可指定落点/目标轨）；工具动作 `split-clip`/`copy-clip`；测试 6 例（含 2 倍速拆分与越界拒绝）：按播放头把片段一分为二（`split-clip`）、片段复制到指定轨道/起点；供 B 的"拆分/复制"按钮使用（域层先落地，UI 后接）
- [x] **A25 字幕多行排版** ✅ 2026-10-19：`wrapSubtitleLines`（尊重原文换行；按宽度折行、优先标点断、不超上限）+ `estimateMaxCharsForWidth`（按画面宽/字号估算每行字数）；drawtext 加 `line_spacing` 并用占位符安全穿过转义；字体支持 `DSH_SUBTITLE_FONT` 环境变量优先；测试 4 例：多行字幕换行（`\n` → drawtext 正确渲染）、长句自动折行（按像素宽度估算）、字体回退链与可配置字体文件
- [x] **A26 项目包 v2** ✅ 2026-10-19：`PACKAGE_FORMAT_VERSION=2`，清单新增 `resourceUsage`（按项目导出、导入时改写 projectId）；**v1 旧包仍可读**（版本区间 1..2）、更高版本明确拒绝；**修复真 bug**——导入时 `saveTimeline` 漏传 `exportFormat`/`normalizeLoudness` 导致被重置成 720p30/关；测试 4 例；**残留待查**：`speed=1.5` 导入后变 2（疑似某处四舍五入），测试内已 NOTE：包格式版本升到 2，包含片段特效/转场/音轨淡入淡出/响度开关/资源使用记录；**旧包（v1）可读**（导入时向上兼容）
- [x] **A27 发布 `v0.3.8-workbench-8`** ✅ 2026-10-19：版本 0.3.8 / CHANGELOG 定稿（A24 拆分复制 / A25 字幕多行 / A26 项目包 v2）/ lib 重建 / tag / Harness 指针同步
- [ ] **A22 覆盖率门禁（仍阻塞）**：需 root 级 vitest 对齐决策（见该条证据）

## 批次六（A29–A32，2026-10-19 起）

- [x] **A29 修复 `speed` 被悄悄取整** ✅ 2026-10-19：根因是 `numberField` 一律 `Math.round`（毫秒字段该如此，但 `speed` 是倍数）→ 新增 `integer: false` 选项（保留 2 位小数）并给 `speed` 使用；恢复 package 往返的严格断言 `speed === 1.5`；4 个相关测试文件 17 例全绿
- [ ] **A30 音轨交叉淡化（acrossfade）**
- [ ] **A31 导出预设**
- [ ] **A32 发布 `v0.3.9-workbench-9`**

## P1（能力补齐与规模化）

- [x] **A6 Agent 工具面扩展** ✅ 2026-10-18：`workbench_timeline` 新增 trim（改起止/时长/源偏移）/ drop-clip（片段移出轨道）/ set-format（导出规格）/ set-track（音量静音）；`workbench_tasks` 新增 render-cancel（排队中的也能取消）；沿用 ≤20 批量护栏；顺手修了片段 id 同毫秒撞车（改用唯一生成器）；测试 10 例（含 T6-5 危险动作护栏仍绿）：`workbench_timeline` 增加 scrub/裁剪动作、`workbench_tasks` 增加 `render-cancel/export-status`、新增 `workbench_render` 启动导出；批量护栏（单次 ≤20 片段、并发 ≤2）。*（§10）*
- [x] **A7 项目迁移框架** ✅ 2026-10-18：`src/workbench/migrate.ts`（迁移链 + **只升不降**：更高版本明确拒绝、找不到路径不猜字段）；store 读入时自动迁移并**先备份 `<file>.pre-migrate-v<N>`**，迁移结果立即落盘；**schema 升到 v2** 并写了真实 1→2 迁移（资源补 `scope`、文档补 `resourceUsage`）；测试 4 例：`schemaVersion` → 迁移函数链（v1→v2…）+ 迁移前自动 `.bak`；损坏文件已能自动回滚（已做）；测试：旧版本文件加载后字段齐全。*（§8.1）*
- [x] **A8 存储规模化** ✅ 2026-10-18：一万素材实测（1.64 MB 文档 / 冷加载 11.7 ms / 索引查询 ~0 ms / 落盘 12.5 ms）→ **结论：V1 无需分片**；加 `writeCount` 写次数计数；索引方案实测后**撤销**（读路径本已毫秒级，缓存反而带过期风险）；基线写入 `docs/PERF.md`；压测用例 `tests/store-scale.test.ts`：单 JSON 在 1 万素材量级的读写优化（按项目分片 or 冷热分层 + 索引），保留现有原子写与 `.bak`；压测脚本 + 指标写进文档。*（§8）*
- [x] **A9 诊断与可观测** ✅ 2026-10-18：`diagnostics` 端点（版本/数据规模/写次数/文件字节/运行中用例/渲染队列/缓存/近 50 条错误）；`DiagnosticsCollector` 有界环形缓冲（不落盘、不含提示词）；runner 错误自动入环；`store.stats()` 提供规模快照；测试 6 例：`/image-video/diagnostics`（版本、数据规模、最近错误、渲染队列、缓存命中率）；结构化日志补 `durationMs` 分位；测试：端点字段齐全。*（§13/§六.4 运行日志）*
- [x] **A10 模板体系扩展** ✅ 2026-10-18：`src/workbench/drama.ts` 新增「漫剧/连续剧单集」模板（剧情→剧本→分镜→定妆图→镜头→字幕→合成，**7 节点全 runnable、校验零问题**；角色基准因 `resourceId` 必填改由运行时挂引用节点，模板说明里写明）；工具面新增 `templates`/`from-template` 供 Agent 实例化；测试 4 例：新增「漫剧/连续剧」模板（本集剧情→角色/场景参考→分镜→逐镜生成→审核→配音/字幕→合成），并把模板放进数据层（可被 Agent 实例化）。*（§6.5）*

## P2（发布与工程）

- [x] **A11 CI 强化** ✅ 2026-10-18 部分完成：① `scripts/check-scope.mjs --track=a|b` 轨道越界自检（按 COLLABORATION 的矩阵，越界非零退出）；② 真实 IO 用例（ffmpeg 渲染）`retry: 1` 兜底抖动；③ vitest 超时 60s/30s（A5 时已加）。**覆盖率门禁暂缓**：插件解析 vitest@3.2.7，根装的 `@vitest/coverage-v8` 是 v4，provider 直接崩（`reportsDirectory` undefined）→ 需先把 coverage 依赖对齐到 3.x 或整体升 vitest，属于依赖变更，单独排期：覆盖率门禁（阈值先在文档定 60%，再爬）、稳定性（重试仅对已知 flaky）、PR 模板（改动范围自检）。
- [x] **A12 发布** ✅ 2026-10-18：`v0.3.3-workbench-3`（版本 0.3.3 / CHANGELOG 定稿 / lib 构建提交 / tag = main = `cb9a6eb` / Harness 指针同步 `166bd6cdcb`）；全量 **484 passed / 5 skipped**，四道门全绿：版本号 + CHANGELOG 定稿 + `lib` 构建提交 + `v0.3.x-workbench-N` tag + Harness 指针 bump。

## 交付物

每个 P0/P1 项：代码 + 测试 + `docs/API-SURFACE.md` 更新（若涉及端点）+ CHANGELOG 一行。
