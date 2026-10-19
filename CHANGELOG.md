## [Unreleased]

（下一轮的改动写这里）

## [0.3.10-workbench-10] - 2026-10-19

### 批次七
- **A34 时间轴一致性校验**：7 类问题码（空视频轨 / 同轨重叠 / 悬空侧链触发轨 / 侧链用在非音频轨 / 转场有空档 / 转场时长被夹 / 空字幕 / 交叉淡化有空档）；`timelines/validate` 端点支持**未保存文档预检**；`timeline validate` 工具动作；与渲染器共用同一套域规则，避免"界面说没事、导出却失败"
- **A33 音频侧链压缩**：音轨 `duckUnderTrackId` + `duckingDb`(-30..0)，导出用 `sidechaincompress`（ratio 由分贝换算）；**修复标签复用 bug**（触发轨需先 `asplit` 才能在侧链与混音里各用一次）

（下一轮的改动写这里）

## [0.3.8-workbench-8] - 2026-10-19

### 批次五
- **A26 项目包 v2**：格式版本升到 2（清单新增资源使用记录 `resourceUsage`），**v1 旧包仍可读**、更高版本明确拒绝；**修复真 bug**：导入时漏传 `exportFormat`/`normalizeLoudness` 会被重置；已知偏差：`speed=1.5` 导入后变 2，测试里已标记待查
- **A25 字幕多行排版**：`wrapSubtitleLines` 按画面宽度折行（优先标点、绝不超上限、尊重原文换行）+ `estimateMaxCharsForWidth`；drawtext 增加 `line_spacing`，换行经占位符安全穿过转义；字体支持 `DSH_SUBTITLE_FONT` 优先；测试 4 例
- **A24 片段拆分/复制**：`splitClipAt`（拆点必须在片段内部；两半时长守恒；右半 `inMs` 按**变速折算**推进）+ `duplicateClip`（默认紧跟原片段，可指定落点或换轨）；工具面 `timeline split-clip` / `copy-clip`；测试 6 例

# Changelog

本文件记录 dsh-image-video 的版本演进。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.11-workbench-11] - 2026-10-19

### 批次八
- **A38 保留策略触发点**：渲染完成后可在摘要里带 `retention` 建议（阈值 `DSH_OUTPUT_MAX_FILES` / `DSH_OUTPUT_MAX_GB`，未配置不提示；**只报告不删除**；钩子异常不影响渲染结果）
- **A37 导出完成摘要**：渲染结束后任务上带 `summary`（产物/字节/实测时长/规格/各轨片段数/有无音轨/有无字幕/是否烧录）+ `describeTimeline` 概览；加法字段，老客户端不受影响；测试 4 例
- **A36 覆盖率门禁落地**：插件 vitest 对齐到根的 **4.x**（复用根已装的 `@vitest/coverage-v8@4.1.11`）；实测 **statements 82.98% / branches 72.52% / functions 81.81% / lines 85.36%**，阈值取实测 −2pp；`scripts/gate.sh` 新增**第 5 步覆盖率门禁**（低于阈值即失败）
- 踩坑与修复（写进提交说明）：vitest 4 对 workspace 深层源码导入更严格（需顶层 `resolve.alias` + `server.deps.inline`）；安装后必须在**根**跑完整 `pnpm install`，否则 workspace 包会被链接成两份导致 typecheck 红

## [0.3.9-workbench-9] - 2026-10-19

### 批次六
- **A31 导出预设**：抖音竖屏 / 小红书 3:4 / 方形 / YouTube 1080p / 4K / 默认 720p（全部过校验）；`presets/list` 端点 + `timeline set-format presetId` 整份套用；未知预设报错并列出可选值
- **A30 音轨交叉淡化**：音轨 `crossfadeMs`(0–3000ms)；相邻片段用 `acrossfade` 重叠淡入淡出，**中间有空档时自动回落普通拼接**；真机验证（2×1s + 300ms 交叉，成片 2s ±150ms，仍有音轨）
- **A29 修复 `speed` 被取整**：`numberField` 原先对所有数值都 `Math.round`，导致 `speed: 1.5` 存成 2（毫秒字段该取整、倍数不该）→ 新增 `integer: false` 只保留 2 位小数；package 往返严格断言 `speed === 1.5` 恢复

## [0.3.5-workbench-5] - 2026-10-18

（下一轮的改动写这里）

## [Unreleased]

（下一轮的改动写这里）

## [0.3.7-workbench-7] - 2026-10-19

### 客户端（同事 B：B1–B13 收口）
- 统一轮询（含页面隐藏暂停/抖动）、素材与任务列表虚拟化、每个面板独立错误边界
- 画布交互补齐（撤销重做接线/复制粘贴/批量删除/单节点运行/状态与错误气泡）
- 时间轴交互补齐（拖拽入轨、片段拖动与手柄改时长、播放/暂停、删除/复制）
- 导出面板（分辨率/帧率/宽高比 → 走 `exportFormat`）、主题与响应式、a11y、i18n、空态引导、视觉基线

### 构建预算（A 处理）
- **抬体积基线**：`BUNDLE_BASELINE` raw 548,282 → **682,374**、gzip 121,161 → **151,212**。
  原因：上述界面工作带来 +24% 的真实增量（新样式表/图标集/交互组件），属功能性增长；
  预算仍维持「基线 + 20%」口径，并在 TASKS-TRACK-B B12 记录"下次性能专项回收预算"的目标。

## [0.3.6-workbench-6] - 2026-10-18

### 批次四
- **A21 渲染耗时可观测**：最近 50 次渲染的耗时 + `render-finished` 结构化日志（status/durationMs）+ `RenderRegistry.stats()`（成功/失败/取消 + p50/p90），并通过 `diagnostics.renders.stats` 暴露
- **A20 音频淡入淡出 + 响度归一化**：音轨 `fadeMs`(0–5000ms) 与文档 `normalizeLoudness`（缺省关）；导出链每轨 `afade=t=in/out`，混音后可选 `loudnorm=I=-16:TP=-1.5:LRA=11`；真机验证仍有音轨且时长 ±80ms

### 批次三
- **A18 诊断暴露输出占用**：`diagnostics` 增加 `outputs{files,bytes,referenced,oldestAt?,newestAt?}`，与 `maintenance/retention` 配合使用
- **A17 时间轴 schema v3**：新增 2→3 迁移（片段特效/转场字段均可选，旧数据无需改写）；迁移链 1→2→3

## [Unreleased]

（下一轮的改动写这里）

## [0.3.4-workbench-4] - 2026-10-18

### 批次二
- **A13b 跨段转场（xfade）**：片段新增 `transition`（`fade`/`wipeleft`/`circleopen`）与 `transitionDurationMs`（0–2000ms，缺省 400）；两段在成片里重叠，因此时间轴总时长**扣掉重叠**（与变速同一个一致性坑）；导出用 `xfade` 链，无转场时仍走 `concat`（零回归）；真机 2×1s + 0.4s 转场 = 1.6s
- **A15 输出保留策略**：`planRetention` 纯函数（最旧优先/受保护不动/保留最新 N/可预演）+ `maintenance/retention` 端点（默认 dryRun）+ `store.referencedAssetPaths()` 保护名单；测试 4 例
- **A14 字幕批量生成**：`splitSubtitleSentences`（句末标点 → 逗号 → 硬切，单条长度上限可控）；`planSubtitleClips` 按字数比例分配时间、保底最短显示、窗口放不下就截断；工具面 `timeline add-subtitles` 一键把台词变成连续的定时字幕（缺省接在字幕轨末尾）
- **A13 片段特效**：`speed`(0.25–4) / `fade`(0–2000ms) / `crop` 入模型并校验；时间轴占位一律按变速折算（`effectiveDurationMs`）；导出链 `crop→setpts→fade`；**修掉一个真 bug**——`freezeTimeline` 另算总时长导致 2 倍速后补 0.5s 黑场，成片与时间轴不一致（现统一走 `timelineDurationMs`，真机 500ms ±70ms ✓）

## [0.3.3-workbench-3] - 2026-10-18

### Track A（底层）A5–A11：面向大规模与商用
- **A5 节点级超时与重试策略化**：默认图像 180s / 视频 900s / 其它 120s，可注入；每次尝试独立 `AbortController` + `Promise.race` 护栏（工具无视取消也能结束）；超时算瞬时失败并重试；`retryBackoffMs` 可配
- **A6 Agent 工具面扩展**：时间轴 `trim` / `drop-clip` / `set-format` / `set-track` + 导出 `render-cancel`（排队项也能取消）；批量护栏 ≤20；修复片段 id 同毫秒撞车
- **A7 项目迁移框架 + schema v2**：迁移链、**只升不降**、找不到路径不猜字段；迁移前自动备份 `.pre-migrate-v<N>`；真实 1→2 迁移（资源补 `scope`、文档补 `resourceUsage`）
- **A8 存储规模化**：一万素材实测 1.64 MB / 冷加载 11.7 ms / 落盘 12.5 ms → **V1 不分片不索引**（索引试过因过期风险撤销）；`writeCount` 可观测；基线 `docs/PERF.md`
- **A9 诊断与可观测**：`diagnostics` 端点（版本/规模/写次数/文件字节/运行中用例/渲染队列/缓存/近 50 条错误）；错误环不落盘、不含敏感内容
- **A10 漫剧/连续剧模板**：`drama-series`（7 节点全 runnable、校验零问题）；Agent 可 `templates` / `from-template` 实例化
- **A11 CI 强化（部分）**：`scripts/check-scope.mjs` 轨道越界自检；真实 IO 用例 `retry: 1`；覆盖率门禁因 vitest/coverage-v8 版本不匹配暂缓（待依赖对齐）

### 测试
- 全量 **484 passed / 5 skipped**（新增 A5–A10 共 23 例：超时重试、工具动作、迁移、规模化、诊断、漫剧模板）

### 新增（Track A / A1 音轨能力）
- **轨道音量与静音**：`TimelineTrack` 增加 `volume`（0–2，缺省 1）与 `muted`，越界一律拒（不静默截断）
- **导出真实混音**：音轨按 `aresample → volume → concat → amix(normalize=0)` 参与 filter graph；静音/零音量轨不输出；无音轨时仍 `-an`
- 真机验证（零生成花费）：产物含 `Audio: aac`、时长与时间轴 ±1 帧；测试 3 例
- **导出参数化（A2）**：`TimelineRecord.exportFormat`（分辨率/帧率/码率，越界一律拒）随文档保存；导出按规格出片（`scale/pad/fps` + `-b:v`/`-crf`）；**产物规格实测复核**——宽高不符或帧率差 >1 直接判 `MEDIA_OUTPUT_INVALID`，不只信参数；真机 640×360@24 验证；测试 4 例

## [Unreleased]

### 新增（Track A：A1–A4）
- **A1 音轨能力**：轨道 `volume`(0–2)/`muted` 入库；导出真实混音（aresample→volume→concat→amix）；静音轨不输出；真机产物含 AAC
- **A2 导出参数化**：`exportFormat`（分辨率/帧率 24·25·30·60/码率）入库；按规格出片并**实测复核**宽高与帧率
- **A3 撤销/重做**：`HistoryStack<T>` 纯逻辑（相同状态不记历史/新编辑清 redo/50 步上限/peek 元信息），画布与时间轴共用语义
- **A4 渲染队列**：`maxConcurrent` 默认 1 + FIFO 队列；排队任务加法字段 `queued/queuePosition`；出队自动拉起、排队可取消、事件进日志
- **A5 节点级超时与重试策略化**：默认超时按种类（图像 180s / 视频 900s / 其它 120s），可注入 `nodeTimeoutMs`；每次尝试独立 `AbortController` + `Promise.race` 护栏（工具无视取消也能结束）；超时算瞬时失败并重试；`retryBackoffMs` 可配
- **A6 Agent 工具面扩展**：时间轴 trim / drop-clip / set-format / set-track + 导出 render-cancel（排队项也能取消）；批量护栏沿用 ≤20；修复片段 id 同毫秒撞车（改唯一生成器）
- **A7 项目迁移框架 + schema v2**：迁移链（只升不降、无路径拒绝）；读入即迁移、迁移前自动备份 `.pre-migrate-v<N>`、结果立即落盘；新增真实 1→2 迁移（资源补 `scope`、文档补 `resourceUsage`）
- **A8 存储规模化**：`writeCount` 可观测 + 一万素材压测基线（1.64 MB / 冷加载 11.7 ms / 落盘 12.5 ms）→ **V1 不需要分片**；曾加按项目索引，实测发现读路径本来就够快且索引带来过期风险，**已撤销**（简单优先）；基线 `docs/PERF.md`
- **A9 诊断与可观测**：`diagnostics` 端点（版本/数据规模/`writeCount`/文件字节/运行中用例/渲染队列/缓存/近 50 条错误）；`DiagnosticsCollector` 有界环（不落盘、不含敏感内容）；runner 错误自动入环
- **A10 漫剧/连续剧模板**：`drama-series`（剧情→剧本→分镜→定妆图→镜头→字幕→合成，7 节点全 runnable 且校验零问题）；Agent 工具面新增 `workflow templates` / `workflow from-template`；角色基准改为运行时挂 `resource-reference`（因 `resourceId` 必填）
- **A11 CI 强化（部分）**：`scripts/check-scope.mjs` 轨道越界自检（A/B 各自跑，越界非零退出）；真实 IO 用例 `retry: 1` 兜底抖动；覆盖率门禁因 vitest 3.x 与 coverage-v8 4.x 版本不匹配暂缓（需依赖对齐，单独排期）
- 测试：A1 3 + A2 4 + A3 5 + A4 5 + A5 3 + A6 2 + A7 4 + A8 1 + A9 6 + A10 4 例

## [0.3.2-workbench-2] - 2026-10-18

### 深度优化（商用/大规模基线第一批）
- **安全边界**：项目包与资源包的**导出目录**只允许落在 `packages/` 之下（此前接受任意路径 → 任意写入风险）；越界直接拒绝并说明边界
- **数据耐用性**：主数据文件损坏时**自动回退到 `.bak`**（`.bak` = 最后一次成功保存的镜像），并把坏文件留证为 `.corrupt-*`；绝不把用户卡死在"文件坏了"上
- **写放大**：内容没有变化时**跳过落盘**（轮询/重复保存场景常见）；写盘仍走 tmp+rename 队列
- **规模化**：任务账本上限 1000 条（超出淘汰最旧），避免单个 JSON 文档无界膨胀
- 测试新增 `store-durability`（备份恢复 / 账本上限）与端点安全边界用例

（下一轮的改动写这里）

### 修复（参数对话框排版错乱 / 样式表跨版本残留 v5，2026-10-18）
- **真正的根因是"旧 CSS 配新 JSX"**：`useWorkbenchStyle` 原本"id 已存在就跳过"，而宿主在插件模块热替换时**不会卸载文档级 `<style>`**。于是新一版 JSX 渲染时仍挂着上一版样式表——旧规则 `.iv-pop-grid label{display:flex;align-items:center}` 把标签和下拉排成一行、`width:76px` 的标签列把行高压到 30px，新旧结构一叠就是"标签压控件、行行错位"。现在注入改为**版本戳自愈**：比对 `WORKBENCH_STYLE_VERSION`，不一致就整表覆盖；新增 `tests/client-style-injection.test.ts` 锁死该行为（含"复用同一节点、不叠第二张表"）
- **面色透明导致浮层看穿**：`--iv-panel` 原先取 `--dsw-alias-bg-l1`，而 Harness 的层级令牌叫 `--dsw-alias-bg-layer-1/2/3`，名字写错后静默退到 `color-mix(currentColor 4%,transparent)` 这种近乎透明的兜底，对话框叠在面板上时底下文字直接透出来。改用 `bg-layer-1`，并把 `--iv-panel-2/3` 改为在**不透明底**上叠文字色（浅色得浅灰、深色得亮一档），新增 `--iv-surface` 专供浮层
- **对话框几何**：弹层不再挂在按钮上算 `left:0`（窄侧栏里必然溢出被裁），改为挂到摘要条、按**栏宽**定位（`container-type:inline-size` + `width:min(560px,100%)`，右对齐到「编辑」按钮那一侧）；栏宽 <360px 时两列自动落成一列；单字段分组（媒体类型）整行铺满；`max-height` 提到 640px 并在吸底动作区留 `scroll-padding`，7 项一次看完不用滚
- **可读性**：分组标题/字段标签/元信息统一 10.5px 三档灰，下拉 25px 高、面板色底（与白底区分）；头部/脚部改用不透明提亮色，滚动时字段不再从按钮缝里透出来
- **体积**：raw 629,587 B / gzip 139,069 B（预算 657,938 / 145,393，占 96%），`check:bundle` 通过；客户端测试 47/47（新增 3 项）

### 修复（工作台配色与交互反馈 v4，2026-10-18）
- **动作色改回蓝色**：此前主按钮/确认按钮取自 `--dsw-alias-brand-primary`，而该令牌在 Harness 浅色主题下**就是近黑色**（Harness「主按钮=黑底白字」的极简口径），导致改名确认、新建项目、保存默认值等按钮呈黑块。改用 Harness 为彩色动作准备的 `--dsw-alias-button-info-fill` / `-hover`（浅色 #4176E6、深色 #7AAAFF），前景取 `--dsw-alias-label-primary-foreground`，两个主题对比度均达标；顺带新增 `--iv-solid` 中性令牌备用
- **主按钮质感**：加 `box-shadow` 微投影与 `:active` 压平；禁用态从"灰块"改为 16% 透明蓝（`--iv-acc` 混合），不再与正常态撞色
- **改名行**：输入框与两个按钮统一 26px 高（原来 23/20px 不齐），主按钮 `min-width:52px`，铅笔图标归入 `--iv-tx3` 静音色
- **参数编辑对话框重做**：新增头部（sliders 图标 + 标题「当前生效参数」+ 说明）、按「媒体类型 / 图像 / 视频」三组分区（`DEFAULT_GROUPS`，7 项不再平铺成一堵墙）、两列表单、脚部提示与按钮 26px 齐平；头部/脚部 `position:sticky` 保证滚动时动作区常驻；新增 locale 键 `defaultsGroupMode` / `defaultsGroupImage` / `defaultsGroupVideo`（中英）
- **左栏「媒体素材 / 生成任务」点击无反馈**：根因是停靠区四个面板在宽屏下本就全部可见，`scrollIntoView` 对视口内元素是空操作，视觉上等于"按了没反应"。现在 `scrollToPane` 额外给目标面板挂 `iv-pane--flash`（描边 + 底色泛蓝，1.5s 渐隐，尊重 `prefers-reduced-motion`），左栏按钮补 `:active` 按下缩放 + 变蓝 + 气泡常显
- **体积**：客户端产物 raw 627,633 B / gzip 137,923 B（预算 raw 657,938 / gzip 145,393，占 95%/95%），`check:bundle` 通过；客户端测试 46/46

### 设计（工作台专业工具风 v3，2026-10-17）
- **应用外壳**：左图标栏（模式导航 + 素材/任务/默认值快捷入口，选中态左侧 2px 指示条 + hover 气泡提示）+ 顶栏（品牌/项目/状态/图标操作）+ 底部状态栏（就绪/产物数/宿主/kind）；模式切换从顶部分段控件改为左栏图标（`aria-pressed` 保留）
- **时间轴重做成 NLE 三件套**：节目监视器（恒深色板 + 时间码浮层 + PROGRAM 徽章 + 字幕叠加）→ transport（播放键 + 等宽时间码 + 走带条）→ 刻度尺 + V1/A1/S1 轨头 + 三色 clip 块（左色条、时长徽章、flexGrow 随时长伸缩）+ 琥珀色播放头（calc 定位跨尺与轨）
- **主题口径（owner 拍板）**：所有面色/文字/边框取 Harness 设计令牌（`--dsw-alias-*`），浅/深主题自适应；唯一例外是**监视器恒深**（媒体惯例：NLE 的节目监视器在浅色 UI 里也是黑的，保证调色判断不受 UI 干扰）；平面无阴影、圆角收敛 5px、大写微型标签 + 等宽时间码
- **工作流页**：节点库从侧栏列表改为顶部 chips（可用/规划中分组保留）；节点卡片深色面板化
- **体积**：客户端产物 raw 621,576 B / gzip 135,615 B（预算 raw 657,938 / gzip 145,393，占 94%/93%），`check:bundle` 通过
- **回归**：客户端 46 项测试全过；全量 436 过 / 3 败，均为工作区既有未提交改动（`src/media/render.ts` 的 ffmpeg stderr 映射）与本机并行抖动（单独重跑即过），与本次无关

### 设计（工作台专业排版 v2，2026-10-17）
- **设计系统落地**：新增 `src/client/workbench-style.ts`（内嵌样式表 + 挂载注入 hook）与 `src/client/icons.tsx`（24 视窗 1.8 描边图标集 35 枚）。配色先取 Harness 设计令牌（`--dsw-alias-*`），取不到退到 `color-mix(currentColor …)`，浅/深主题都成立（`R-NFR-3`）；产物不烧入任何部署事实（门禁 `client-no-hardcoding` 续防）
- **信息降噪**：生效默认值从"一排 7 个控件"改为**一条安静的内联摘要 + 按需弹出的编辑面板**（progressive disclosure）；项目改名/删除图标化并带 title；破坏性操作两步确认改危险色
- **层次与排版**：14px 品牌名 / 12.5px 正文 / 12px 控件 / 11px 元信息 / 10px 眉题五档字阶，行高 1.55，数字 tabular-nums；面板头部统一 24px 着色瓷砖图标；快速创作改为"三步引导 + 统计卡"；素材行图片缩略图；时间轴 clip 块化（左侧色条 + 时长徽章 + 内联编辑）；画布节点库按「可用 / 规划中」分组
- **体积**：客户端产物 raw 611,536 B / gzip 134,051 B（预算 raw 657,938 / gzip 145,393，占 93%/92%），`check:bundle` 通过；构建注意：沙箱会拦 `rmSync('lib')`，需删目录后手动 `npx tsdown && npx tsc -p tsconfig.client.json`
- **回归**：客户端 46 项测试（workbench 32 + canvas 7 + bundle 2 + no-hardcoding 3 + lifecycle 2）全过；宿主侧 8 例超时类失败为本机文件 I/O 慢（加大超时即过），1 例 ffmpeg stderr 映射失败属工作区既有未提交改动（`src/media/render.ts`），与本次无关

## [Unreleased]

### 新增（需求覆盖审计补全）
- **`R-PRJ-4` 引用完整性**：删资源前除工作流外**还扫时间轴**；"项目默认绑定"在 V1 无该字段（空集，复核锚点在 `references.ts` 注释里）
- **`R-QCK-3` 资源使用记录**：跑图产出时自动记录"这张图用到了哪些资源"，资源库显示「被哪些素材用过」（端点 `resources/usage`；同产物去重、随项目级联）
- **`R-COL-1` 资源作用域**：`ResourceRecord.scope` 保留 `project/team/public`，V1 缺省写 `project`、UI 不给团队/公共入口
- **`R-CFG-2` 默认值可见可改**：工作台内直接编辑 7 个生效默认值（`POST /image-video/defaults`，留空 = 清覆盖）；有个真 bug 是客户端测试抓到的——下发时误用了界面文案键而非接口字段名

## [0.3.1-workbench-1] - 2026-10-16

### 工程
- **Agent 自重启的安全化 + 紧急停止**：`scripts/agent-restart.sh`（一次性 detached 进程、900 秒冷却、并发锁、`--check` 自检、不经 launchd）与 `scripts/agent-stop.sh`（紧急停止，不触碰 App）。2026-10-15 用 `launchctl submit` 托管一次性脚本造成 164 轮循环重启，根因与处置写入 `EXECUTION.md` 事故记录


### 口径
- **测试素材与烧钱边界（owner 口径）**：测试默认跳过真实视频生成，必要时先与 owner 确认；需要人像时用大众审美的美女素材；生成类调用**绝不自动重试**（避免重复计费），只有只读/幂等操作才套 3 次重试

### 新增
- **跨运行成功结果缓存（`R-FLW-5`）**：按节点**实际发给工具的参数**算 sha256 指纹（与画布坐标/节点 id 无关），命中且缓存文件仍在时直接用上次产物、**不再调外部生成**；节点记录标 `cached: true`；换参数、文件被删、或显式 `refresh`（工具面 `workbench_workflow action=run refresh=true` / 运行器 `bypassCache`）都真的重跑；缓存有界（上限 200 条，按时间淘汰）。测试 2 例覆盖四种情形

- **planned 能力防伪造（T3-3 收口）**：图里只要含 `lip-sync`/`face-swap`/`voice-synthesize` 这类 `planned` 节点，运行侧**整次拒绝**且不发出任何外部调用、不把任何节点标成成功（`tests/planned-capability.test.ts` 三例）；重试也不会绕过

### 新增
- **时间轴模型与三轨编辑（T5-1）**：`TimelineRecord`（video/audio/subtitle 三轨 + clip：素材路径引用、字幕文本、起点/时长/源内偏移、字幕样式），校验拒非法时间/缺字段/重复 id/超规模/**内联字节**（文档只存引用，可为阶段 8 项目包直接携带）；存储随项目级联；新增 `timelines/list|save|remove` 端点与「时间轴精剪」面板（加入 clip、写字幕、编辑起点/时长、删除、自动保存、总时长）

### 新增
- **时间轴预览与字幕样式（T5-2/T5-3 主体）**：播放头顺序预览（按时间点取当前片段 + 字幕按样式叠加，明确标注"不做转码、导出可能差一两帧"）；字幕样式（字号/颜色/上中下）带模型级校验；`burnSubtitles` 烧录开关随文档落库（关掉后字幕数据不丢）。修了一个真 bug：自动保存漏传 `burnSubtitles`（被客户端测试抓到）

### 新增
- **导出链（T5-5/T5-6）**：`RenderService` 把时间轴**快照**编成 ffmpeg filter graph（片段+黑场填充、可选字幕烧录、libx264），`-progress` 报进度、取消即杀进程并清理半成品、导出后实测时长与时间轴比对（±1 帧）；宿主 `RenderRegistry` 提供 `timelines/render|renders|render-cancel` 与**产物自动登记成素材**；失败面覆盖素材丢失/磁盘满/编码器不支持/ffmpeg 缺失，各有机器码与可操作文案（真机用 ffmpeg 自造素材验证，无生成花费）
- **预览与导出共用边界**：`activeClipAt()` 成为预览与导出唯一的"哪一段在播"来源，并有"切换点相差 ≤ 1 帧"的断言（T5-2 收口）

### 新增
- **Agent 工具面（T6-3/T6-5）**：`workbench_projects/assets/timeline/workflow/tasks` 五个工具，覆盖列表与查询、建项目、把素材放进时间轴、创建/运行工作流、查任务与运行记录、起导出；反幻觉（动作清单回抛、引用必须真实存在、缺坐标自动排布）、批量上限、**不提供任何删除动作**（破坏性操作留在 UI 的两步确认里）

### 新增
- **双向一致刷新（T6-4）**：面板可见时每 5 秒轮询项目/素材/任务，Agent 侧改动无需手动刷新即可出现；本地编辑中的文档不被覆盖；延迟口径（≤5 秒、不可见不轮询）写在实现注释里

### 体积与 CI
- **客户端产物体积门禁（T7-1）**：基线 = 首次可发布构建实测 **raw 548,282 B / gzip 121,161 B**（2026-10-16，`lib/client/plugin.js`），预算 = 基线 +20%（raw 657,938 B / gzip 145,393 B）；`pnpm run check:bundle` 在超预算时列出超支明细并以非零退出
- **CI 补门禁（T7-7）**：`.github/workflows/ci.yml` 增加 `pnpm run test` 与 `pnpm run check:bundle`（此前只有 typecheck + build）

### 新增
- **结构化日志（T7-3）**：生成 / 工作流节点 / 导出三类事件各一行 JSON，字段含 taskId、runId+nodeId、renderId 与服务商、模型、耗时、状态，可按 id 串联；钩子可选注入，宿主输出到 `ctx.logger.info`

### 新增
- **轨迹资源（T2-6）**：`kind: motion-track` 的资源带关键帧（归一化坐标 + 缩放），越界/时间倒流/超 120 帧一律拒（不静默截断）；`describeMotionTrack()` 把关键帧翻成可断言的运动约束文本；画布 `motion-track` 节点新增 `trackId` 完成绑定

### 新增
- **资源包与跨机器（T8-3/T8-4）**：`resources.json` 资源包（含轨迹关键帧、无字节）支持导出/导入，同名冲突默认**不覆盖**，可选重命名/替换并逐条报告；跨机器口径以自动化覆盖"包复制到另一目录 + 路径重写 + 无网络依赖 + 本机自包含"

### 新增
- **对话卡片入口（T6-1）**：媒体卡片新增「发送到工作台 / 放入时间轴」，卡片只传路径、宿主决定项目与时间轴（`assets/quick-add`）；未装工作台时按钮不渲染；跨包改动登记 FORK-FEATURES R10

### 新增
- **浏览器半边与右栏工作台骨架**：插件首次提供 `./client` 出口（`dsh.client = { platform: 'web', inject: […] }`），在 Harness 右侧工作区注册自有 tab 类型（`kind: dsh-image-video-workbench`、`id: dsh-image-video`）与 guide 入口，并渲染工作台骨架：项目名称 / 保存状态 / 三模式切换（快速创作·专业工作流·时间轴精剪）+ 当前模式工作区 + 素材·资源·预览·任务四格。骨架用 `useTabInfo()` 读座位事实（可见性、是否全屏）并以 `data-*` 暴露。客户端 bundle 是模块加载器的 CJS factory 包装，react/react-dom/cordis 与 `@deepseek-ai/dsh-client-*` 全部外置（由宿主模块表解析）
### 修复
- **画布跑视频被模型拒（HTTP 400）**：节点目录把 `resolution` 写成 480P/720P/1080P 这类**模型专属枚举**，而 `minimax-h3` 只认它自己的档位。改为留空即用模型默认，并让运行器对 `model`/`resolution`/`referenceVideo` 的**空值一律不发**（现场验证的价值：这条只有真跑一次才会暴露）

- **画布真机出片（T4-5 验收）**：画布上选 768P 跑通一条真视频（`running` → 节点显示「运行中」→ `succeeded` + `.mp4` 产物），参数与对话路径同名同义
- **服务端/API 错误一律重试（owner 要求）**：运行器对节点级瞬时失败（流被中断/超时/5xx/限流/连接重置）自动重试 **3 次**并记录 `attempts`，确定性失败（4xx 参数错、内容被拒、取消）立即收手；provider 侧 `retryPolicy` 提为 `normal/maxRetries: 8`（有界，不用无上限的 `always`），见 `FORK-FEATURES.md` R09
- **运行记录回看与内置模板（T4-6/T4-7）**：每次运行落库（含图快照与逐节点状态/产物/错误，保留最近 50 次），画布运行区列出历史运行并可点选回看；三个内置模板（文案→分镜→图→视频 / 图片→视频→字幕→渲染 / 参考视频复刻）自带示例值，实例化后直接通过图校验即可跑。同时修正分镜节点的端口语义（分镜表是文字输出）
- **`WorkflowRunner`（T4-4）**：按拓扑序执行 + 逐节点落库 + 失败即停（下游标「被上游阻断」）+ 重试只重跑失败节点及其下游（前序成功节点不再调外部 API）+ 取消连带中止在飞的生成；生成节点复用对话里的同一对工具，上游文本并入提示词、上游产物作首帧；没有执行器的节点如实记 `skipped`（不伪造成功）；新增 `workflows/run|runs|run-cancel|run-retry` 端点与画布运行面板（运行中 2.5s 轮询）
- **图校验（T4-3 的共享半边）**：`validateWorkflow()` 检查必填参数、端口类型兼容、自环、悬空连线、环（三色 DFS，消息给出回路）与 planned 节点不可运行；画布实时显示校验结果并给问题节点标红。宿主在运行前的同源拒绝随运行器（T4-4）接线。**现场验通（2026-10-15）**：空提示词节点实时报 2 个问题并标红，填上后该节点清零
- **工作流文档持久化 + 台账本去重端点**。**现场验通（2026-10-15）**：进入工作流模式读回既有流程 → 加 2 节点 → 保存态 saved → 刷新页面重进读回同一张图；素材面板「整理重复记录」把历史重复 14 条合并为 4 条：`workflows/list|save|remove`（进入工作流模式读回该项目文档，画布改动 0.8s 去抖静默落库，保存四态暴露在 `data-workflow-save`；结构校验含种类、坐标有限性、连线两端存在、自环拒绝与规模上限）；`maintenance/compact` 把幂等上线前留下的重复素材记录合并（只删记录不动文件），素材面板加「整理重复记录」。jsdom 缺口（`ResizeObserver`）统一到 `tests/setup-dom.ts`
- **台账本整理工具**：`scripts/compact-workbench.mjs` 按（项目, 文件）去重（只删记录、不动文件，写回前备份）。注意宿主把台账本缓存在内存，运行中的宿主请勿外部改文件——宿主内去重端点列入下一批
- **工作流画布 v0（阶段 3/4 起步）**：接入 `@xyflow/react@12.12.0`（精确版本，内联进客户端产物；官方样式表由 `scripts/sync-canvas-style.mjs` 内嵌注入，因为客户端模块加载器只加载 JS）。节点目录为画布与宿主共用：12 个可运行节点 + 3 个 `planned`（口型同步/换脸/语音合成）在列表里可见、禁用并注明原因（阶段 3 的"预留能力边界"）；`video-generate` 按 `D7` 承载参考视频与 `compare`，模型名留空由宿主默认；画布顺序：节点库 → 画布 → 节点参数面板，支持加/选/拖/连/删与「适配窗口」。`WorkflowRecord` 是画布维度的唯一事实源，**瞬时选择不入库**（有测试锁住文档字段集合）；planned 节点按 `T3-2` **可放进图并保存**、卡片与参数面板如实标注「未提供」与原因（不做假装能跑的 UI）
- **项目改名自动保存**：停止输入约 0.9 秒后自动落盘（手动「保存」仍在，四态照旧）；新增守护测试确保**客户端产物里不含任何绝对路径、服务商或模型名**——默认模型/尺寸/时长/输出目录一律来自宿主配置
- **登记幂等与产出跳转**：`assets/attach` 对同一（项目, 路径）幂等——重复登记返回已有记录并透出 `created: false`，界面提示「该产物已登记过」而不是再建一条；任务面板的每一行都可直接点开产出（已登记则选中对应素材，未登记则按路径在预览面板临时查看）
- **真实的任务取消、运行中状态与重启恢复**；运行中的行会带上**请求里已知的模型与提示词**（不再是「运行中 · —」）：生成开始即写 `running` 记录（工作台立刻可见），结束写 `succeeded`/`failed`；`GenerationRegistry` 为每次生成注册可取消句柄，并把「取消信号」与「工具执行信号」取并集交给工具——UI 的「取消任务」因此真的会中止提交/轮询（而不是只改账本），账本落 `cancelled`；宿主启动时把上次进程遗留的 `running` 条目标为 `failed`（说明被重启中断），避免永远显示运行中。素材面板同时支持按媒体类型筛选（全部/只看图片/只看视频）
- **创作资源面板与项目改名**：资源记录支持角色/场景/道具/品牌/风格/音色六类（名称与备注校验、按项目列出、按种类过滤、删除二次确认、删除项目时级联记录），面板可直接新建与删除；项目支持**改名**并新增**保存状态四态**（已保存/保存中…/有未保存改动/保存失败，根节点 `data-workbench-save` 暴露）。右栏四个面板至此全部可用
- **任务账本与任务面板**：生成工具经 `withTaskLedger` 包装后**自动入账**（成功记 provider/model/产物路径/字节数，失败记错误原文；账本写失败只告警、绝不影响生成）。账本落在同一份 `workbench.json`，`tasks/list`（可按项目过滤）与 `tasks/assign` 端点对外；右栏任务面板显示状态/模型/大小/时间，并可一键把某次生成的产物**登记为当前项目素材**
- **工作台首个可用切片（阶段 2）**：右栏现在能真正操作——新建/选中/删除项目（二次确认）、把 `outputs/` 里最新未登记的产物登记为项目素材、点选素材在预览面板内联查看图片/视频（走只读 `/outputs` 路由）、删除素材记录（只删记录、不动文件）。宿主侧新增 `WorkbenchStore`（单 JSON 文档 + tmp+rename 原子写，`<outputsDir>/../image-video-workbench/workbench.json`）与 `/image-video` 通道端点 `projects/list|create|remove`、`assets/list|attach|remove`、`outputs/list`；客户端新增 `createWorkbenchApi` 封装。
- **工作台 RPC 健康检查**：宿主侧注册 `/image-video` 通道（`connection.rpc.handle`，随 fiber 卸载撤销）；端点 `health` 回报插件名、版本、通道名、生效服务商与已解析的输出目录；未知端点按连接的 envelope 结构化拒绝，不抛异常、不泄漏凭证
- **客户端 RPC 接线与健康状态展示**：`inject` 增加 `connection`；骨架挂载时调用 `/image-video` 通道的 `health`，头部显示「版本 · 服务商」（连接中/失败各有文案，原始报错只进 `title`），并以 `data-workbench-health` 暴露状态；通道名与健康结果类型抽到 `src/workbench-contract.ts`，两个半边共用，浏览器 bundle 不带宿主代码
- **`PLUGIN_VERSION` 与一致性守卫**：版本常量集中一处，`tests/version.test.ts` 与 `package.json` 对账

- **图片参考图体积守卫**：本地参考图解析出的 data URL 超过 4MB 时，先用 sharp 等比缩到长边 2560 并转 JPEG(q88) 再提交（媒体模式注入/图生图两组入口都走这条链）。手机原图直传时 data URL 比原文件还大约 1/3，此前会撞网关/上游的请求体上限或被拖到超时；压缩不可用时原样提交，交由服务端报错
- **凭证缝引用（`apiKeyEnv`）**：`ProviderCredentials` 新增 `apiKeyEnv`；`apiKey` 留空时按该引用经 `ctx.credentials` 解析（如桌面端登录后写入的 Key），配置里不必内联明文。取值优先级为「明文 `apiKey` > 引用解析值」，两者都取不到按未配置响亮报错；候选服务商过滤改用 `hasConfiguredCredentials`（明文或引用任一非空即已配置），只声明引用的部署不会再被跳过。`resolveProviderCredentials` / `resolveActiveProvider` 因此变为异步并接收 `ApiKeyResolver`
- **媒体模式注入（`mediaMode`）**：`/image-video/defaults` 协议新增 `mediaMode`（`text` / `image` / `video`）；composer 切到图片/视频 tab 后，插件在 `agent/pre-step` 追加一条指令消息（`source.kind = 'image-video.media-mode'`），要求模型直接调用 `generate_image` / `generate_video` 并带出当前生效参数。门控：只在 `next()` 成功且本步带来新的用户输入时注入（工具循环不重复），子代理（`origin === 'subagent'`）不继承主会话模式；`text` 与未设置不注入
- `generate_image` 输出 schema（`image` 与 `previewImage`）声明 `originalDimensions`，并在重建附件引用时透传
- `generate_video` 支持**参考视频（视频编辑）**：`media` 条目新增 `video` 字段，传 `{ video: … }` 即把参考视频交给 `wan3.0-video`（All-in-One 模型），配合提示词中的编辑意图（"替换 / 改成 / 去掉"等）保留原片构图与动作、只改写指定主体或元素。存在参考视频时缺省 `model=wan3.0-video`、`aspectRatio=adaptive`、`duration=-1`（保持原片时长）
- `media` 条目支持显式 `type`（`first_frame` / `last_frame` / `reference_image` / `reference_video`），不再只能靠 `position` 推断；条目既无 `image` 也无 `video` 时响亮报错
- `duration` 接受 `-1`：保持参考视频原时长 / 交由模型智能决定
- 新增 `resolveReferenceVideo`：本地参考视频提交前经 ffmpeg 裁到 ≤15 秒、长边 ≤1280、CRF 32 并转 data URL；压缩后仍超过 6MB 时响亮报错而不是提交巨型请求体（threerouter 无上传端点，2026-09-22 探测 `/v1/files`、`/v1/uploads`、`/v1/assets` 全 404）
- 新增 `REFERENCE_VIDEO_CAPABLE_MODELS` 能力表（`src/runtime-defaults.ts`）与真机契约测试 `tests/live-video-edit-contract.test.ts`（`DSH_IMAGE_VIDEO_LIVE=1` 显式开启，一次运行 = 一个视频任务）
- 新增**原片 / 复刻对比片**（`src/compare.ts`）：存在参考视频时缺省（`compare: true`）额外产出一条对比片并写回 `output.comparePath`。**方向按原片画幅自动选择**——竖屏（3:4、9:16，`height ≥ width`）左右并排，横屏（4:3、16:9，`width > height`）上下堆叠；两侧等比缩放、统一 30fps、按较短者截断，命中常见系统字体时叠加 `ORIGINAL` / `AI RECREATED` 角标。合成失败只写 `notes`，不影响复刻结果
- 新增分段复刻工作流与真机契约测试 `tests/live-video-edit-segments.test.ts`：单次视频编辑任务实测只产出约 5 秒（15 秒参考片同样只回 5 秒），长片必须切段（建议每段 ≈4.4 秒）并行提交后再拼接；该测试的轮询对瞬时网络错误容错——任务在服务端继续跑且结果保留 24 小时，此前一次 `fetch failed` 会丢掉整批已付费任务的结果

### 修复
- **`originalDimensions` 透传**：DSH 0.2.x 起附件服务缩放大图时会带上该字段，此前手写 schema 未声明，`generate_image` 会以 `returned invalid output` 失败，已生成的图被丢弃
- `generate_image` 结果行的**生成模式**改由预检查结论驱动：参考图经 `images` 数组或对话粘贴传入时，不再误报为「文生图」（此前结果行只判断单图入参 `image`）
- `generate_image` 结果行的**尺寸**改取始终提供的 `previewImage`：路由不支持图片输入（纯文本模型）时不再退化成「未知尺寸」
- `generate_image` 的**对话参考图**只取最新一条用户消息：不再把历史轮次里粘贴过的图片静默当作本次参考图（此前实现会扫描整段历史，与本文件与工具描述声明的「只取本轮」不符）

- **RPC 通道名不合规（现场抓出）**：原用 `/image-video/workbench`，而连接层的通道必须是单段路径（`/^\/[A-Za-z0-9._~-]+$/` 且不得占用 `/api`）——宿主 `rpc.handle` 在插件注册时即抛错、浏览器调用被 `invalid RPC target` 拒；改为 `/image-video` 并加守护测试。stub 版单测因替身 `handle` 不校验而漏掉，是桌面现场检查才暴露的

### 变更
- **决策 D1–D7 全部落定**：D1（命名一律 `dsh-image-video`，不另起产品名/不加第三个包）已落地——全仓 `grep dsh-media` 为 0；D2–D7 采纳文档建议值（硬删除+二次确认+引用守卫 / V1 检测+提示、发布前再评 sidecar / 锁 `@xyflow/react` 精确版本 / JSON 清单+素材目录 / 只做音色元数据 / `video-generate` 承载参考视频编辑），并在 `docs/REQUIREMENTS.md` §14 写明各自最晚复核点
- `peerDependencies` 的 DSH 范围由 `*` 收紧为 `^0.2.1-alpha.1`（`dsh-tools` / `dsh-llm` / `dsh-credentials`），`devDependencies` 同步升到 `^0.2.1-alpha.1` 并补 `@deepseek-ai/dsh-agent`：`originalDimensions` 与凭证缝 `resolve` 需要 0.2.x 运行时
- **依赖对齐（修掉一根红基线）**：`@deepseek-ai/schemastery` 由 `^3.18.1` 提到 `^3.18.5-alpha.1`——与 dsh-0.2.1 线 devDeps 传递来的那一份统一，消除"两份 schemastery 并存"导致的 `z<T>` 注解冲突与 `TS2742`；`pnpm-workspace.yaml` 的 `allowBuilds.esbuild` 从占位符改为 `true`（此前 esbuild postinstall 被静默跳过）。对齐后 `pnpm run typecheck` 由红转绿
- **构建改为双面**：`build = clean && tsdown（宿主角 + 客户端角）&& tsc -p tsconfig.client.json`；`bundle` 复用 `build`（Harness 根 `build:plugins` 直接可用）；`files` 纳入 `lib/client/**` 与 `lib/types/client/**`
- **README 与源码注释口径收敛**：视频时长上限统一为 1–30 秒（原注释/README 写 1–10）、`pollTimeoutMs` 默认 600000（原写 300000）、参考视频上限如实写为"上游文档声明 + 本地只强制 ≤15 秒 / 压缩后 ≤6MB"、`runtime-defaults` 的"六个字段"改回"七个字段"、`http-client.ts` 指向的契约文档名修正、`image-preflight` 去掉"threerouter 是唯一异步图片服务商"的过期断言、`media.ts` 陈旧注释改为与实现一致（是否注入模型可见 image 块由路由能力决定）
- **文档**：新增 `docs/REQUIREMENTS.md`（需求 + 验收 + 追踪矩阵 + 16 条实现前必须收敛的事实）、`docs/EXECUTION.md`（工作区/环境/执行流程/验证证据/回滚/发布/排错）、`docs/TASKS.md`（59 个原子任务的唯一进度账本）

## [0.3.1] - 2026-09-20

### 变更
- **构建产物随仓库提交**：`lib/index.js` 与 `lib/index.d.ts` 入库（`.gitignore` 移除 `lib/`），移除 `prepare` 脚本（保留 `build`，新增 `prepublishOnly`）。此前以 git 安装会因 pnpm 的 `allowBuilds` 拦截 `prepare` 而报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，需手动"允许并重试"；现在 `dsh plugin add github:ihero3/dsh-image-video` 一次装好
- **peerDependencies 改为 `*` 且标记 `optional`**：此前的 `^0.1.1-rc.2` 按 semver 预发布规则不匹配 harness 的 `0.1.6-alpha.2`；而 `optional: false` 会让 pnpm 到 registry 自动拉取 peer 链（实测因 `@deepseek-ai/dsh-type-meta` 未发布而 404，或在可解析时装出第二份 `dsh-tools`/`cordis` 与宿主并存）
- 类型声明路径由不存在的 `lib/types/index.d.ts` 修正为实际产物 `lib/index.d.ts`（`types` / `exports.types` / `files` 三处）；`tsdown.config.ts` 固定 dts 文件名，避免内容哈希导致路径漂移
- 文档同步：说明 `lib/` 已随仓库提交、消费方无需构建；`CONTRIBUTING` 增加"改 `src/` 后必须重新构建并提交 `lib/`"的约定

## [0.3.0] - 2026-08-21

### 变更
- `generate_image` 工具结果不再向模型返回 `image` 内容块，改为纯文本摘要（本地路径、服务商、尺寸、大小），修复纯文本模型生成图片后下一轮请求 400（`unknown variant 'image_url', expected 'text'`）的问题
- 图片字节仍通过 attachment 服务持久化，附件引用改经 `output.presentationMeta` 持久化为 UI-only 数据（`tool/result` 事件 `meta` 字段），对模型不可见，客户端可消费做内嵌渲染
- `media.ts` 拆分为 `saveImageAttachment`（持久化附件引用）与 `createImageSummaryText`（模型可见文本），原 `createImageContent` 移除
- 文档与工具描述同步更新：图片"内嵌渲染在对话中"→"模型只见文本摘要，附件走 UI-only 通道"

### 修复
- 修复：使用不支持图片输入的对话模型（如 pi-ai 的 threerouter 网关）时，`generate_image` 成功生成图片后，会话的后续请求因历史含 `image` 块而持续 400，会话无法继续

## [0.2.0] - 2026-08-20

### 变更
- 阿里系服务商统一使用 万象 wanx（阿里云百炼）：`provider` 取值 `'wanx'`，配置字段 `wanx:`，适配器 `wanxAdapter`（文件 `providers/wanx.ts`）
- `generate_video` 默认模型改为 `wan2.2-t2v-plus`（无需开通独立产品即可使用）
- 默认图片尺寸改为 `1024*1024`（百炼接口要求 `*` 分隔，`1024x1024` 会报 "size is not in the correct format"）
- 文档、工具描述、报错文案中的表述统一为 万象 wanx
- Seedance2.5 相关代码与配置保持不变

## [0.1.0] - 2026-08-20

首次发布。文生图与文生视频工具插件，支持 万象 wanx（阿里云百炼）与 Seedance2.5（火山引擎）服务商切换。

### 新增
- `generate_image` 工具：文生图，wanx / Seedance2.5 切换，结果内嵌对话并落地 `outputs/`
- `generate_video` 工具：文生短视频（上限 10s），后台异步轮询不阻塞对话，结果落地 `outputs/`
- 配置 Schema：`provider` 切换、API Key、自定义 baseURL、默认图片尺寸、默认视频时长、超时、重试次数、outputs 目录
- 统一 HTTP 客户端：异常分类（鉴权/配额/任务/超时/网络）+ 中文友好提示 + 可配置重试
- 异步任务管理器：基于 `ctx.effect` 托管轮询生命周期，卸载自动取消任务 + 清理定时器
- 媒体渲染模块：图片通过 attachment 服务内嵌，视频返回本地文件链接
- `cordis.patch.yml`：`- insert` 新增 `image-video` 行，不覆盖现有插件
- 双安装方式：本地文件夹 `dsh plugin add ./` + GitHub `dsh plugin add github:ihero3/dsh-image-video`

### 服务依赖声明
- `tools`（必需）：`inject = ['tools']` 顶部声明
- `attachments`（generate_image 必需）：`ctx.inject(['attachments'], cb)` 显式声明，服务撤销时自动注销工具
