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
- [x] **A28 覆盖率门禁方案文档** ✅ 2026-10-19：`docs/COVERAGE-PLAN.md`（问题实测证据、方案 A 根级 vitest 对齐的步骤/6 条验证清单/一条命令回滚/风险耗时、方案 B 保守项、待 owner 决策）；**未执行任何依赖改动**
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
- [x] **A30 音轨交叉淡化（acrossfade）** ✅ 2026-10-19：音轨 `crossfadeMs`(0–3000)；相邻片段用 `acrossfade=d=…:c1=tri:c2=tri`，**有空档时回落 concat**（不硬套）；真机验证仍有音轨、成片时长由视频轨决定；测试 3 例
- [x] **A31 导出预设** ✅ 2026-10-19：`src/workbench/presets.ts`（抖音竖屏 1080×1920 / 小红书 3:4 / 方形 / YouTube 1080p / 4K / 默认 720p，全部经 `normalizeExportFormat` 校验）；端点 `presets/list`；工具 `set-format` 支持 `presetId` 整份套用；测试 4 例（含未知预设报错列出可选值）
- [x] **A32 发布 `v0.3.9-workbench-9`** ✅ 2026-10-19：版本 0.3.9 / CHANGELOG 定稿（A29 speed 取整修复 / A30 音轨交叉淡化 / A31 导出预设）/ lib 重建 / tag / Harness 指针同步

## 批次七（A33–A35，2026-10-19 起）

- [x] **A33 音频侧链压缩（旁白压低背景音乐）** ✅ 2026-10-19：音轨 `duckUnderTrackId`（触发轨 id）+ `duckingDb`(-30..0，缺省 -12)；导出链 `sidechaincompress`（ratio 由分贝数换算）；**修掉标签复用 bug**——触发轨信号要被侧链与混音各用一次，必须先 `asplit` 否则 ffmpeg 报「标签已消费」；真机验证有音轨；测试 3 例
- [x] **A34 时间轴一致性校验器** ✅ 2026-10-19：`src/workbench/validate.ts`（空视频轨/同轨重叠/悬空侧链触发轨/侧链用在非音频轨/转场有空档/转场时长被夹/空字幕/交叉淡化有空档，共 7 类码）；端点 `timelines/validate`（**支持传未保存的 document 做保存前预检**）；工具动作 `timeline validate`；与渲染器共用域规则；测试 7 例（含端点 1 例）
- [x] **A35 发布 `v0.3.10-workbench-10`** ✅ 2026-10-19：版本 0.3.10 / CHANGELOG 定稿（A33 侧链压缩 / A34 一致性校验）/ lib 重建 / tag / Harness 指针同步

## 批次八（A36–A39，2026-10-19 起）

- [x] **A36 覆盖率门禁落地（方案 A：对齐 4.x）** ✅ 2026-10-19：插件 `vitest ^3.1.0 → ^4.1.11`（与根一致，复用根 `@vitest/coverage-v8@4.1.11`）；vitest 4 下 workspace 深层源码导入需**顶层 `resolve.alias` + `server.deps.inline`**；**实测** statements 82.98% / branches 72.52% / functions 81.81% / lines 85.36% → 阈值取 −2pp（81/70/80/83）；`scripts/gate.sh` 新增**第 5 步覆盖率门禁**；全量 584 passed 保持绿。**回滚**：还原 `package.json`/`pnpm-lock.yaml`/`vitest.config.ts` 后在根跑 `pnpm install`（详见提交说明）
- [x] **A37 导出完成摘要** ✅ 2026-10-19：`src/media/render-summary.ts`（产物路径/字节/实测时长/规格/各轨片段数/是否有音轨/是否有字幕/是否烧录），渲染任务完成时作为**加法字段** `summary` 挂上（老客户端不受影响）；另提供 `describeTimeline`（变速折算后的轨道概览）；测试 4 例（纯函数 3 + 真机集成 1）
- [x] **A38 保留策略触发点** ✅ 2026-10-19：渲染成功后摘要可带 `retention`（输出目录文件数/字节、建议清理条数、可释放字节、是否仍超限）；阈值由 **`DSH_OUTPUT_MAX_FILES` / `DSH_OUTPUT_MAX_GB`** 环境变量控制，**未配置则完全不提示**；钩子异常只记 `render-retention-failed` 日志、**绝不让渲染失败**；**只报告不删除**（真删仍只走 `maintenance/retention` 的显式 `dryRun:false`）；测试 2 例
- [x] **A39 发布 `v0.3.11-workbench-11`** ✅ 2026-10-19：版本 0.3.11 / CHANGELOG 定稿（A36 覆盖率门禁 / A37 导出摘要 / A38 保留建议）/ lib 重建 / tag / Harness 指针同步

## 持续交付轮次（2026-10-19 起，目标常驻）

- [x] **对抗性质量扫荡 R5** ✅ 2026-10-19：**预设 → 存储 → 导出**端到端验证——320×240 横屏源按"抖音竖屏"预设真出 **1080×1920** 片（`probeMediaSpec` 实测规格一致 ✓）；另断言 6 个预设都能存进时间轴并原样读回；测试 2 例（真机，零生成花费）
- [x] **对抗性质量扫荡 R4** ✅ 2026-10-19：`timelines/validate` 的 inline 文档补边界（`INLINE_TIMELINE_LIMITS`：≤2MB / 片段上限**复用存储层 `MAX_TIMELINE_CLIPS`(400)** / 轨道 ≤50），超限在端点层直接给出可操作错误；顺带修掉"两处数字漂移"（先写 500、与存储层 400 不一致）；测试 4 例（含端点拒绝）
- [x] **对抗性质量扫荡 R3** ✅ 2026-10-19：定位上一轮开放问题——导入行为正确，真问题是**同名项目** → 改为导入时自动去重命名（`（导入） 2`…），恢复并加严断言（3 个项目 / 3 个唯一名字）；一次诊断用例（逐步打印两次导入后的项目数与名字）是定位关键
- [x] **对抗性质量扫荡 R2** ✅ 2026-10-19：① **保留建议钩子不再能拖慢渲染完成**——加 2s 超时（可配 `retentionTimeoutMs`），超时只记 `render-retention-timeout`、状态照常 succeeded；② 校验器 500 片段实测 < 500ms 且仍能报出 9 处重叠；③ 记录开放问题（重复导入行为待查）
- [x] **对抗性质量扫荡 R1** ✅ 2026-10-19：对新代码注入边界/异常，抓出并修掉 **3 个真 bug**——
  ① **自指侧链**（`duckUnderTrackId` 指向自己）会让同一滤镜标签被用两次 → ffmpeg 直接报错（渲染侧跳过 + 校验器新增 `self-ducking` 码）；
  ② **`crossfadeMs` 大于片段时长** 时 `acrossfade=d` 超限 → ffmpeg 报错（改为**逐对夹到较短片段的一半**，必要时该对回落 concat）；
  ③ 缺素材复用了 `empty-subtitle` 问题码 → 调用方无法区分（新增 `missing-asset` 码）。
  回归断言 4 例钉住上述行为。

### 开放问题（持续交付轮次记录）

- ~~项目包重复导入~~ **已定位并修复（R3，2026-10-19）**：诊断证明导入**每次都建新项目**（行为正确，上一轮的"只多 1 个"是测试自身问题）；真问题是**同名**（两个「XX（导入）」）→ 已修为导入时**自动去重命名**（`（导入） 2`、`3`…），并恢复断言 `3 个项目 + 3 个唯一名字`。

## 批次十（A41 起，2026-10-19）

- [x] **A41 渲染进度按镜头细分** ✅ 2026-10-19：`segmentStepAt(bounds, percent)` 纯函数把全局百分比换成"第 N/共 M 段"（按视频段+补边段的累计时长，含变速折算）；任务字段 `progressStep`（加法）；进度回调与成功收尾都刷新，长成片能显示"第 3/12 段"；测试 2 例（纯函数边界 + 集成收尾）
- [x] **A42 多语言字幕轨** ✅ 2026-10-19：字幕轨 `language`(1–16 字符) + 时间轴 `burnLanguage`（只烧选定语言；**不设则沿用老行为烧全部**，向后兼容）；`timelines/save` 透传；校验器新增 3 个码（`dangling-burn-language` / `duplicate-subtitle-language` / `subtitle-burn-overlap` 多轨叠烧提醒）；测试 3 例
- [x] **A43 发布 `v0.3.12-workbench-12`** ✅ 2026-10-19：版本 0.3.12 / CHANGELOG 定稿（A41 进度细分 / A42 多语言字幕 / R1–R5 扫荡修复）/ lib 重建 / tag / Harness 指针同步

## 批次十一（A44 起，2026-10-19）

- [x] **A44 素材探测端点** ✅ 2026-10-19：`probeMediaSpec` 增加 `durationMs`（复用 Duration 解析，音轨/视频都支持）；端点 `assets/probe`（**安全边界**：只允许 outputs 目录内或已登记素材，越界明确拒绝）；用于界面拿真实时长、Agent 决定片段长度；测试 4 例（真机 video/audio/坏文件 + 越界拒绝）
- [x] **A45 校验器接入真实时长** ✅ 2026-10-19：新增 `findClipOverruns`（**纯函数**，把源内偏移也计入需求时长，120ms 容差）；`timelines/validate` 端点先用 `probeMediaSpec` 探测最多 20 个唯一素材的真实时长再判定；探测失败不影响校验；问题码 `clip-longer-than-asset`；测试 4 例（越界/容差/偏移/未知时长 + 端点容错）
- [x] **A46 发布 `v0.3.13-workbench-13`** ✅ 2026-10-19：版本 0.3.13 / CHANGELOG 定稿（A44 素材探测 / A45 越界检测）/ lib 重建 / tag / Harness 指针同步

## 批次十二（A47 起，2026-10-19）

- [x] **A47 门禁脚本修假红与误导** ✅ 2026-10-19：重写 `scripts/gate.sh` —— ① 测试步骤不再 `| tail -5` **截断失败详情**（完整日志落 `/tmp/dsh-test-*.log`）；② 失败时区分"真有失败"与"全过但退出码非 0（worker 抖动）"并给出单跑命令；③ **"五道门全过"移到第 5 道之后**（此前会先宣告成功再失败）；④ 步骤编号统一 `N/5`；⑤ 构建步骤 `grep` 无匹配不再假失败
- [x] **A48 自定义导出预设（schema v4）** ✅ 2026-10-19：**schema 升到 v4** + 真实 3→4 迁移（新增空 `exportPresets`，不影响既有数据）；store CRUD（名称 1–40 字、重名拒绝、规格走 `normalizeExportFormat`）；端点 `presets/list`（内置+自定义合并，带 `custom` 标记）/`presets/save`（支持按 id 覆盖）/`presets/remove`；工具 `set-format presetId` 也能解析自定义预设；测试 8 例（CRUD/校验/持久化/迁移/端点）
- [x] **A49 发布 `v0.3.14-workbench-14`** ✅ 2026-10-19：版本 0.3.14 / CHANGELOG 定稿（A47 门禁脚本 / A48 自定义预设 + schema v4）/ lib 重建 / tag / Harness 指针同步

## 批次十三（A50 起，2026-10-19）

- [x] **A50 渲染队列优先级** ✅ 2026-10-19：`start(timeline, {priority})`（数值大的先跑，**同优先级保持 FIFO**）；入队按优先级有序插入并重算 `queuePosition`；端点 `timelines/render` 与工具 `timeline export` 均支持 `priority`；测试 2 例（优先级顺序 + 同优先级 FIFO）
- [x] **A51 发布 `v0.3.15-workbench-15`** ✅ 2026-10-19：版本 0.3.15 / CHANGELOG 定稿（A50 队列优先级）/ lib 重建 / tag / Harness 指针同步

## 批次十四（A52 起，2026-10-19）

- [x] **A52 渲染 ETA** ✅ 2026-10-19：`estimateEtaSec(percent, elapsedMs)` 纯函数（线性外推；**<5% 或 <1s 不给估计**，避免数字乱跳）；任务字段 `progressEtaSec`（加法）；成功时归零；测试 3 例
- [x] **A53 项目包 v3** ✅ 2026-10-19：`PACKAGE_FORMAT_VERSION` 2→3，清单新增**自定义导出预设**（导入按名称去重合并、不覆盖用户已有预设）；**修掉一个真遗漏**——`A42` 的 `burnLanguage` 导入时没传回去（会丢语言设置）；**v1/v2/v3 包都能导入**（版本区间 1..3）；测试 7 例（含 v2 老包兼容）
- [x] **A54 发布 `v0.3.16-workbench-16`** ✅ 2026-10-19：版本 0.3.16 / CHANGELOG 定稿（A52 ETA / A53 包 v3 + burnLanguage 修复）/ lib 重建 / tag / Harness 指针同步

### 持续交付轮次（续）

- [x] **对抗性质量扫荡 R6** ✅ 2026-10-19：扫 A44–A53 新代码 —— ① **`saveExportPreset` 给了不存在的 id 会静默新建**（调用方以为在更新、实际在造数据）→ 改为明确报错；② ETA 极端边界（恰好 5%、99.9%、极大耗时）不出 NaN/负值；③ `timelines/validate` 在 **21 个缺失素材**时只探测前 20 个、不崩不误报。回归断言 3 例（+端点）

## 批次十五（A55 起，2026-10-19）

- [x] **A55 发布 `v0.3.17-workbench-17`** ✅ 2026-10-19：版本 0.3.17 / CHANGELOG 定稿（R6 契约修复 + ETA/探测边界）/ lib 重建 / tag / Harness 指针同步
- [x] **A56 成片集归组** ✅ 2026-10-19：`groupRenderSets` 纯函数按**项目 + 时间轴**归组（次数/成功/失败/总字节/总时长/最近导出时间/jobIds，按最近导出倒序）；`timelines/renders` 端点新增 `sets`（**只读聚合、纯加法字段**，不改 schema）；测试 2 例
- [ ] **A57 渲染耗时按段统计**

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
