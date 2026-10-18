# Track A 任务书（底层：逻辑 / 框架 / API / 模型 / 数据 / 渲染）

> 归属：**你（owner）**。地盘：`src/host`、`src/workbench`、`src/media`、`src/tools`、`scripts`、`lib`、依赖与发布。
> 原则：**契约先行**（新增/变更端点先写 `docs/API-SURFACE.md`），B 依赖你的产出，所以**优先做能解锁 B 的项**。
> 每项完成条件：`bash scripts/gate.sh` 四道门全绿 + 有测试 + 在 CHANGELOG 记一行。

## P0（解锁界面的关键底层，先做）

- [x] **A1 时间轴音轨能力（领域+导出）**：`TimelineTrack` 增加 `volume`（0–2）/`muted`；校验入库；导出 filter graph 支持 `volume=` 与 `-an` 静音；测试：音量字段往返 + filter 含 volume。*（对应总任务书 §7.2）* ✅ 2026-10-18 完成：`volume`(0–2)/`muted` 入库并往返；导出真实混音（aresample→volume→concat→amix，多轨 `normalize=0`）；静音轨不输出；真机验证产物含 `Audio: aac` 且时长 ±1 帧；测试 3 例
- [x] **A2 导出参数化**：`RenderService` 支持 `{ width, height, frameRate, bitrate? }`，校验（分辨率白名单/帧率 24/25/30/60）；输出规格复核（宽高/帧率实测）；测试：非默认规格导出可播放且时长 ±1 帧。*（§7.3）* ✅ 2026-10-18 完成：`TimelineRecord.exportFormat`（宽高偶数 128–4096 / 帧率 24·25·30·60 / 码率 500–50000 kbps）入库校验；导出按规格出片（scale/pad/fps/`-b:v`）；**产物实测复核**（`probeMediaSpec` 校验宽高与帧率，不符报 `MEDIA_OUTPUT_INVALID`）；真机 640×360@24 验证；测试 4 例
- [ ] **A3 撤销/重做领域支撑**：给 store 增加**命令式变更 API**（`apply(ops)` 返回反操作）+ 快照栈接口（供 B 接线 UI）；测试：编辑→撤销→重做后文档逐字段一致。*（§6.2、§7.1 的 undo/redo）*
- [ ] **A4 渲染队列与并发控制**：导出同时最多 1 个、其余排队（状态 `queued`）；工作流节点并发上限可配；测试：两个导出排队顺序 + 取消排队项。
- [ ] **A5 节点级超时与重试策略化**：`timeoutMs` 可配（默认按 kind）、重试次数/退避可配；测试：超时节点记为 failed 且带可操作文案。

## P1（能力补齐与规模化）

- [ ] **A6 Agent 工具面扩展**：`workbench_timeline` 增加 scrub/裁剪动作、`workbench_tasks` 增加 `render-cancel/export-status`、新增 `workbench_render` 启动导出；批量护栏（单次 ≤20 片段、并发 ≤2）。*（§10）*
- [ ] **A7 项目迁移框架**：`schemaVersion` → 迁移函数链（v1→v2…）+ 迁移前自动 `.bak`；损坏文件已能自动回滚（已做）；测试：旧版本文件加载后字段齐全。*（§8.1）*
- [ ] **A8 存储规模化**：单 JSON 在 1 万素材量级的读写优化（按项目分片 or 冷热分层 + 索引），保留现有原子写与 `.bak`；压测脚本 + 指标写进文档。*（§8）*
- [ ] **A9 诊断与可观测**：`/image-video/diagnostics`（版本、数据规模、最近错误、渲染队列、缓存命中率）；结构化日志补 `durationMs` 分位；测试：端点字段齐全。*（§13/§六.4 运行日志）*
- [ ] **A10 模板体系扩展**：新增「漫剧/连续剧」模板（本集剧情→角色/场景参考→分镜→逐镜生成→审核→配音/字幕→合成），并把模板放进数据层（可被 Agent 实例化）。*（§6.5）*

## P2（发布与工程）

- [ ] **A11 CI 强化**：覆盖率门禁（阈值先在文档定 60%，再爬）、稳定性（重试仅对已知 flaky）、PR 模板（改动范围自检）。
- [ ] **A12 发布**：版本号 + CHANGELOG 定稿 + `lib` 构建提交 + `v0.3.x-workbench-N` tag + Harness 指针 bump。

## 交付物

每个 P0/P1 项：代码 + 测试 + `docs/API-SURFACE.md` 更新（若涉及端点）+ CHANGELOG 一行。
