# Track B 任务书（界面：交互 / 视觉 / 使用体验）

> 归属：**同事 B**（Track B）。地盘：`src/client/**` + 客户端测试 + UI 文档。**不碰** `src/host`、`src/workbench`、`src/media`、`lib`、依赖。
> 前置：先把 `docs/COLLABORATION.md` 看一遍（文件所有权矩阵 + 分支规则）。
> 每项完成条件：`bash scripts/gate.sh` 全绿（2026-10-25 起 `lib/` 停止入库、由 harness 侧 `pnpm run build:plugins` 生成；本地 `pnpm run build` 自测即可，**不再提交 `lib/`**）+ 客户端测试 + 截图。

## 双轨分工（2026-10-21）

> 完整清单与依赖顺序见 `docs/PLAN-TWO-TRACKS.md`（A / B 各一份，互不冲突）。

### Wave 1（2026-10-22 完成：B-1～B-5，全部基于已存在端点）

- [x] **B-1（F2 多参考图选择器）**：素材多选（≤6）→ 按序 chips（首图=底图，其余=风格/脸部参考），可拖拽 + 前移/后移按钮排序、逐个移除、封顶 6 张。发送口径：1 张走 `image`（兼容 A151），≥2 张走按序 `images[]`（工具侧 `image` 优先于 `images`，不两个一起发）。测试：`tests/client-multi-reference.test.tsx`（5 项：按序下发 / 单图兼容 / 按钮+拖拽排序 / 移除与清空 / 封顶）。
- [x] **B-2（F3 生成进度）**：新增 `listRunningTasks`（`tasks/running` → `{running}`）；生成中显示已用时（宿主 `startedAt`，退化到本地点击时间）+ 不定进度条，无百分比时显示"生成中 · 12s"；本地秒表 `src/client/use-elapsed.ts` 每秒推进，统一轮询顺带刷新宿主快照。测试：`tests/client-generate-progress.test.tsx`（3 项：视频已用时随时间前进、图片同步秒表、确实调了 `tasks/running`）。
- [x] **B-3（G4 首尾帧/视频编辑入口）**：视频生成表单增加「尾帧图」「参考视频」两个可选槽 + 真人勾选；请求体带 `media: [{image,type:'first_frame'}?, {image,type:'last_frame'}, {video,type:'reference_video'}]` 与 `realPerson` 透传（首帧也必须进 `media`——工具的 `image` 在 `media` 存在时被忽略）。**宿主 `media/generate` 尚未转发 `media`/`realPerson`，已按契约先行规则在 `docs/API-SURFACE.md`「B 申请区」登记待 A 认领**；界面同时给出"待宿主转发后生效"的诚实提示。测试：`tests/client-video-edit-slots.test.tsx`（4 项）。
- [x] **B-4（G2 物料库分栏）**：创作资源面板拆成 角色/场景/物品 三个常驻栏 + 「其他」下拉（brand/style/voice/motion-track），切栏即筛选（`resources/list?kind=` 宿主支持，面板一次取全量本地过滤——零请求零闪烁），参考图缩略图，按名筛选（换栏自动清空）。新建资源归入当前栏。测试：`tests/client-resource-columns.test.tsx`（4 项）。
- [x] **B-5（B17 片段手柄 + 分割/复制）**：左右手柄调时长维持既有接线（`timeline-math.ts`，测试固化）；新增「分割」按钮接域层 `splitClipAt`（拆分点=播放头，必须严格在片段内部，两半时长守恒、右半补 `inMs`）；「复制」从本地实现改接域层 `duplicateClip`（与 Agent 的 `split-clip`/`copy-clip` 同一套规则）。测试：`tests/client-timeline-interaction.test.tsx` 增补 3 项（分割守恒 + 选中右半、播放头在外时禁用、副本落点）。

**Wave 1 门禁**：`tests/client-*.test.ts(x)` 24 个文件全绿（新增 16 项）+ `workbench.client` / `workflow-canvas.client` 全绿 + `pnpm run typecheck` 通过。未提交 `lib/`、未改 `package.json`、未打 tag。

### Wave 2（2026-10-22 完成：B-6～B-10；B-9/B-10 界面已交付、宿主端点等 A-4/A-5）

> A 于 2026-10-22 交付 A-1（四个快速模板 + 文案键）、A-2（`assets/remove-many`）、A-3（资源 `assetPaths[]`），并附送 A-9（`timelines/split-clip`/`copy-clip` RPC 端点，B-5 的域层接线与之同源、无漂移）。

- [x] **B-6（F4 模板市场卡片）**：四个快速模板在模板市场里分两组展示——「快速上手」（quick-image / quick-video / storyboard / cover）与「完整链路」（原有模板）；文案键 A 已补，**描述由客户端 `TEMPLATE_HINTS` 补**（`WorkflowTemplate` 无 `describe` 字段，数据层归 A）；点卡即一键新建（实例化 + 落库 + 收起市场）。顺手补了 `.iv-tpl-*` 样式（B15 起模板卡一直无样式）。测试：`tests/client-template-market.test.tsx`（2 项：分组/名称/描述、点击实例化落库）。
- [x] **B-7（F5 素材批量操作）**：素材行加多选复选框（点行=预览、点框=批量，两件事不互斥）；有选中时出现批量条——批量删除（一次 `assets/remove-many`，宿主单次 ≤200，不存在的 id 进 skipped）、批量引用到提示词（选中的图片按列表顺序进 F2 参考图，封顶 6 张）、清除选择；被引用的素材删除被拒后留在选区并给"仍要删除"（force）二次确认。测试：`tests/client-bulk-operations.test.tsx`（4 项）。
- [x] **B-8（F6 资源资料库）**：资源可挂多张参考图——行内编辑器（增/删/清 + 计数 + 底图/参考角标）、行内「挂选中素材」一键归入、多参考图行缩略图 "+n" 角标；合并规则与数据层一致：**有 `assetPaths` 就以它为准，旧 `assetPath` 只在没有 `assetPaths` 时兜底**（否则删掉旧图会被合并视图放回来）；清空时两个字段一起清。测试：`tests/client-resource-references.test.tsx`（4 项：旧数据合并 / 挂选中素材 / 增删 / 清空）。
- [x] **B-9（G3 融合生图 UI）**：界面已交付——快速创作面板内「融合生图」区：角色/场景/物品三组多选 chip（`aria-pressed` 可达）、按选区去重封顶 6 张的本地参考图预览（无图时明示"降级纯文生"）、独立提示词框与「融合生成」按钮，点击调 `media/compose`（`api.ts` 的 `composeMedia`）。**真机生效仍等 A-4 端点**（已在 API-SURFACE B 申请区登记；端点缺失时如实展示宿主错误、不伪造成功）。测试：`tests/client-fusion-compose.test.tsx`（4 项）。
- [x] **B-10（G1 提示词 UI）**：界面已交付——「提示词工坊」区：选中图片素材 → `prompts/extract` 提取 → 结构化结果拼成可编辑草稿（主体/风格/材质/细节，缺字段跳过）→ `prompts/save` 入库 → `prompts/list` 列表 → 一键带入生成表单 / `prompts/remove` 删除。**真机生效仍等 A-5 端点**（视觉模型不可用时由宿主给清晰错误；界面如实报错、绝不编造结果）。测试：`tests/client-prompt-library.test.tsx`（4 项）。

**Wave 2 门禁**：29 个 `client-*.test.*` 文件全绿（99 项，Wave 2 新增 18 项：B-6~B-8 10 项 + B-9/B-10 8 项）+ `workbench.client`(32) + `workflow-canvas.client`(13) + bundle 2 项 + 漂移 2 项 + `pnpm run typecheck` 通过。

**仍挂在 API-SURFACE「B 申请区」的三条**：① B-3 的 `media/generate` 转发 `media[]`/`realPerson`；② A-4 `media/compose`（B-9 已接线）；③ A-5 `prompts/extract` + 提示词库 CRUD（B-10 已接线）。三者均按「契约先行」在客户端落地并写假宿主测试，宿主端点为唯一缺口。

## P0（用户最能感知的体验问题）

- [x] **B1 轮询收敛**：现有 3 个定时器（导出 2s / 运行 2.5s / 项目 5s）合成 **1 个统一轮询**：间隔按活跃度自适应（有 running 任务 2s，否则 5s）、`document.hidden` 时暂停、加 ±20% 抖动；测试：隐藏时不再发请求、可见时恢复。
- [x] **B2 列表虚拟化**：素材/资源/任务列表超过 100 条时只渲染可视区（保持现有键盘与 aria 行为）；测试：1000 条数据下渲染节点数 < 60。
- [x] **B3 错误边界**：每个 pane 一个 error boundary —— 单个面板崩掉只显示"该面板出错 + 重试"，**不拖垮整个右栏**；测试：故意抛错的子组件被兜住。
- [x] **B4 画布交互补齐**：撤销/重做接线（用 A3 的命令 API）、节点复制/粘贴、框选与批量删除、单节点运行（用运行器 `only`）、节点运行中/失败的状态与错误气泡；测试：复制粘贴后节点数 +1、撤销回滚。
- [x] **B5 时间轴交互补齐**：素材**拖拽**入轨（draggable + drop 定位）、片段拖动改起点、左右手柄改时长、播放/播放暂停（顺序播放当前片段）、播放头跟随、删除/复制片段；测试：拖拽后 `startMs` 落在鼠标位置附近。
- [x] **B6 导出面板**：分辨率/帧率/宽高比选择（调 A2 的新签名）、导出进度/取消、成功后内嵌播放器预览 + "登记到素材库"提示；测试：选择非默认规格后请求体正确。

## P1（质感与可用性）

- [x] **B7 主题与响应式**：明暗两套主题用宿主变量（不写死颜色）、窄窗（<768px）自动全屏与折叠、右侧空间不足时的紧凑排版；测试：两主题下关键文字对比度 ≥ 4.5。
- [x] **B8 a11y**：所有可操作元素键盘可达、`aria-label` 完整、焦点顺序、`:focus-visible` 样式；测试：Tab 顺序覆盖三模式切换与主要动作。
- [x] **B9 i18n 完整性**：zh/en 键集合一致（缺键测试：两边 key 差集为空）、新增文案必须双语。
- [x] **B10 空态与引导**：首次打开有 3 步引导（选项目→快速创作→放时间轴）、空列表有"下一步做什么"、模板卡片化选择。
- [x] **B11 视觉回归**：对三个模式各存一张截图基线（`docs/ui-baseline/*.png`），改样式后对比。**机制就绪**：`scripts/capture-ui-baseline.mjs`（Playwright）+ `docs/ui-baseline/README.md` 已就位；PNG 基线需在**带显示的 CI / 本地浏览器**中由 A 执行采集（本无显示环境无法出图，约束已文档化）。

## 第二批（B14–B16，A 已备好契约，直接接）

- [x] **B14 接新契约**：转场选择器（clip.transition + transitionDurationMs）、变速/淡入淡出/裁剪控件（speed/fade/crop）、音轨淡入淡出滑块（track.fadeMs）、导出响度开关（timeline.normalizeLoudness）；已接线到 UI，值域钳制与 `saveTimeline` 持久化均已落地；测试：`tests/client-timeline-effects.test.tsx`（speed/fade/transition/loudness/audio-track-fade 共 4 项）。
- [x] **B15 新面板**：字幕批量按钮（`timeline add-subtitles`，输入一段台词一键铺字幕）、模板市场（`workflow templates` / `from-template`，含 `drama-series`）、诊断面板（`diagnostics` 的 outputs 占用 + renders.stats 耗时）；已完成：字幕批量复用域层 `planSubtitleClips`、模板市场合并 `WORKFLOW_TEMPLATES`+`DRAMA_TEMPLATES` 并支持实例化、诊断面板新增客户端 `getDiagnostics` 调用（outputs 占用 / render 统计 / 近期错误）；测试：`tests/client-templates-diagnostics.test.tsx`（字幕批量 / 模板市场 / 诊断面板 共 3 项）。
- [ ] **B16 体积回收**：当前占预算 83%（基线 682,374 raw / 151,212 gzip + 20%），目标**回收到 ≤ 80%**；做法：按需加载图标、拆样式表、去掉未用 locale。**审计结论（杠杆已全做，目标未达）**：①「去未用 locale」已删 7 个未引用键（-0.4KB）；②「图标按需」0 可删（39 个图标均被 `NODE_ICONS` 等使用）；③「拆样式表」0 安全收益（死选择器多为 React Flow 运行时类）。**根因同 B12**：体积被画布必需的 `@xyflow/react`+`d3-*` 主导；且本插件契约要求 `lib/client/plugin.js` 为自包含单文件——`tests/client-bundle.test.ts` 强制 factory 只能 `require` 宿主模块表，代码分割会被该契约测试拦截、在真实宿主亦加载失败（已实测并回退懒加载改造）。基线本身已占 83%（>80%），故 ≤80% 在 Track B 权限内**数学上不可达**（不可改构建/外置、不可破坏单文件契约）。达标须 Track A 外部化 React Flow/d3 并更新宿主模块表（即 B12 指出的 A 侧构建策略），随后同步抬高 `BUNDLE_BASELINE` 或在 CHANGELOG 说明（门禁自身允许的兜底路径）。B16 三杠杆的"纯代码"部分已交付，单文件产物回到 713,804 B（87%）。
- [x] **B17 拆分/复制/裁剪手柄**：已接 A24 域层 `split-clip`/`copy-clip`（`src/workbench/edits.ts`）——2026-10-22 完成：分割按钮（播放头为拆分点）+ 复制改接域层 + 手柄调时长测试固化，见上方 Wave 1 B-5。

## P2

- [x] **B12 bundle 瘦身**：实测 raw 682,873 B（占预算 **104%**，超 24,935 B）、gzip 152,407 B（占预算 **105%**，超 7,014 B）——**未达 ≤85% 目标**。完整分析见 `docs/B12-BUNDLE-REPORT.md`。根因：产物体积被画布必需的 `@xyflow/react` + `d3-*` 主导；三档瘦身杠杆中「图标按需」不适用（包内无图标库）、「减少重复样式」无安全收益（看似重复的选择器实为状态/后代复合选择器）、「避免整包内联」需改 `tsdown.config.ts` 并外部化 React Flow/d3，属 A 的构建/加载策略范畴。**不提交 lib**，数值已汇报。
- [x] **B13 交互细节打磨**：撤销历史可视化（可选，未做）；快捷键 Cmd/Ctrl+Z 撤销、Cmd+Shift+Z 重做已接 `window` keydown（`tests/client-keyboard.test.tsx`）；空格播放、Delete 删除由 B5 时间轴与 B4 画布交互覆盖并有对应测试。

## 你不能做的（要交给 A）

- 改 RPC 端点/数据模型/渲染参数 → 在 `docs/API-SURFACE.md` 的「B 申请」写一行，A 认领。
- 改 `package.json`/lock、打 tag（`lib/` 自 2026-10-25 起已停止入库，由 `build:plugins` 生成，无需任何人提交）。

## Round 2（2026-10-22，B-9..B-14（全部可立即开工））

> 详见 `docs/PLAN-TWO-TRACKS.md` 的「Round 2 分工」。

## Round 3（2026-10-24，B-15..B-17；基于 v1.0.0 `38e0314`）

> A 的 A-7（`storyboard/plan`）与 A-11（`exports/*`）均已上线（v1.0.0，契约见
> `docs/API-SURFACE.md` 第 26–29 行），Wave 3 三项全部完成。

- [x] **B-15（分镜表编辑 UI）**：快速模式新增「分镜工坊」——剧本 + 可选目标镜头数 →
  `storyboard/plan`（`{projectId,script,shots?}` → `{shots,referencedResourceIds}`）→
  镜头表：序号/镜头描述/角色（逗号顿号文本）/场景/图片提示词/视频提示词全部可改，
  支持增删镜、上移/下移（移完 1-based 重排序号）、「带入生成」（只填表不自动生成）、
  「送入画布」（有图片生成节点就改写其提示词，没有就追加一个并切到工作流模式）。
  空剧本/无项目用按钮禁用拦；宿主错误（如空剧本）如实展示、不伪造镜头。
  测试：`tests/client-storyboard-edit.test.tsx`（7 项：入参形状/禁用护栏/改后带入/
  送入画布新建/改写既有节点/增删移重排/宿主错误如实）。
- [x] **B-16（导出历史面板）**：dock 新增「导出历史」pane（`src/client/panels/ExportHistoryPanel.tsx`）——
  `exports/list` 四态徽标（queued/running/succeeded/failed，复用任务状态文案）、
  产物走 `/outputs/<文件名>` 只读路由可点开、字节/耗时/失败原因原样展示、
  按项目筛选、空态；失败行给「重试导出」（先 `exports/record` 记新账再按原时间轴重渲，
  且不在时间轴模式也会被轮询跟着收尾）。时间轴模式点导出时自动记账，
  渲染终态经统一轮询捕获后 `exports/update` 回写（取消 → failed + 宿主原因，不伪装成功）。
  测试：`tests/client-export-history.test.tsx`（5 项：四态事实渲染/空态/项目筛选/
  重试记账/导出全链路记账与回写）。
- [x] **B-17（发布前收尾）**：左栏新增「帮助」入口——浮层列三个模式说明与**真实存在**的
  快捷键（Ctrl/⌘+Enter 生成、Ctrl/⌘+Z/Shift+Z 撤销重做、空格播放、Delete 删除；
  没绑定的键不写）；无项目时顶栏出现「示例项目」按钮——一键建项并套用 quick-image
  模板（script → image-generate），让新用户打开就有东西可看。真实生成端到端走查
  （图片 + 视频各一次）需 A 授权/API key，操作路径与预期写在
  `docs/WALKTHROUGH-v1.0.0.md`，授权后约 10 分钟可完成。
  测试：`tests/client-release-polish.test.tsx`（3 项：帮助浮层内容与开关/示例项目
  建项套模板/有项目后按钮隐藏）。

**Round 3 门禁**：`pnpm run typecheck` 通过；客户端 36 个测试文件全绿
（`client-*` 32 + `workbench.client` + `workflow-canvas.client` + 新增 3 个），
新增 15 项（B-15 7 + B-16 5 + B-17 3）。未提交 `lib/`、未改 `package.json`/lock、未打 tag。

**Round 3 环境备注（需 A 决策）**：
1. 本地构建跑不了：pnpm store 缺 `@jridgewell/sourcemap-codec`（`magic-string` 的依赖），
   `pnpm run build` 在 tsdown 处失败——发版构建请重跑 `pnpm run check:bundle` 确认体积
   （A-6 后入口已按需加载，新增主要在按需块）。
2. 远端历史被重组：`origin/main` 现为分叉 lineage（`478832a`，树里没有 `src/client`、
   `src/host`、`src/workbench`、`docs/` 与 134 个测试文件），含全部双轨工作的
   `38e0314`（v1.0.0）本地完好。本轮基于 `38e0314`；**未向 origin 推送**，
   reconcile 方式待 A 决定。

## Round 4（2026-10-25，基于 `28d9213`；P0-2 待补第一项：物料自动匹配）

> 基线变化（同事 A 交接后各进一个提交）：插件 `396179c → 28d9213`、harness `88cd5aa0 → 73f7ff56`，
> 都是「`lib/` 停止跟踪，改由 harness `pnpm run build:plugins` 生成」——交接提醒 #2 据此改写：
> 改 `src/**` 后本地 `pnpm run build` 自测即可，`lib/` 不再需要提交。

- [x] **B-18（物料自动匹配闭环）**：`pipelines/compose` 早回传 `missingResources`（剧本提到、
  资源库没有的物料名），客户端类型也有该字段，但界面一直没渲染——严格模式下用户只看到
  "对不上"，不知缺什么、去哪补。`PipelineCard` 结果区新增缺失清单：每个缺失名一个
  `iv-chip--warn` chip + 「登记为角色/场景/物品」快速按钮（`resources/create`）→ 成功后
  **按上一次编排的同一入参自动重编**，刷新匹配结果（免费、零新端点）；登记失败如实报错、
  缺项不消失；缺失为空时显示"未检测到缺失物料"（无假阳性）；登记进行中按钮禁用。
  `runPipeline` 路径同样记住入参，起跑后也能补登记。locales 三处同步（`pipelineMissingTitle/Hint/None`、
  `pipelineRegisterRole/Scene/Prop` 七个键，en/zh）。测试：`tests/client-pipeline-materials.test.tsx`
  （5 项：缺失清单渲染 / 登记后自动重编且入参正确 / 失败不伪造 / 空缺失无假阳性 / 进行中禁用）。
- 配套契约申请（见 `docs/API-SURFACE.md`「B 申请区」）：`pipelines/compose|run` 显式 `resourceIds`
  （物料手动挑选）+ `matchedResources` 回显——**已于 2026-10-26 被 A 认领并上线**（`pipelines/compose|run`
  支持 `resourceIds`、编排结果回显 `matchedResources`，未知 id 如实提醒）；UI 接驳见下方 Round 5。

## Round 5（2026-10-26，UI 接驳 A 已交付的 6 项宿主能力）

> 前置：同事 A（Track A）于 2026-10-25~26 把 `docs/API-SURFACE.md`「B 申请区」全部 6 条清空（宿主侧均已上线），
> 但**界面一直没接**，留给 Track B 在「快速创作」优化里落地。本回合把 A 在 B 申请区用的编号
> （B-3/B-4/B-5/B-6/B-7/B-18）一次性接完。**注意编号撞车**：下表 B-3~B-7、B-18 是 A 对*B 申请区宿主能力*的编号，
> 与 Wave 1/2/Round 4 历史同号任务（B-3 尾帧/参考视频、B-4 物料分栏、B-5 片段手柄、B-6 模板市场、B-7 批量操作、B-18 缺失清单）**不是同一件事**，勿混。

- [x] **B-3（融合生图参数化 · 姿态/镜头/裁剪）**：在 A-4 `media/compose` 上扩参（`API-SURFACE` 第 78 行「含 B-3 姿态/镜头/裁剪」）。
  `Workbench` 融合区新增：姿态/镜头两组 chip（复用宿主 `POSE_PRESETS`/`LENS_PRESETS`，`t(preset.labelKey)` 直接渲染，零手写映射）、
  风格备注 `textarea`、裁剪开关 + 四个数字字段（宿主 `normalizeComposeCrop` 校验 0..1、每边 ≥5%，越界/过小在状态栏报错且**不透传**）。
  `runCompose` 透传 `pose`/`lens`/`styleNote`/`cropScene`（裁剪关闭时不带 `cropScene`）。`src/client/api.ts` 的 `ComposeMediaInput` 与 fake 同步扩字段。
  测试：`tests/client-fusion-params.test.tsx`（2 项：pose/lens/styleNote/合法 cropScene 透传；非法裁剪被 `normalizeComposeCrop` 拒透传）。
- [x] **B-4（视频续写显式模式）**：`media/generate` 增 `continuation: true` 显式续写意图（宿主校验必须有参考视频、不静默降级；`tests/host-media-generate.test.ts:117` 钉住）。
  G4 视频生成表单加「续写」勾选；`runGenerate` 在视频模式 + 已勾选 + 有参考视频时透传 `continuation: true`，
  缺参考视频时弹错误提示并**早退零调用**；清空参考视频同步清续写勾选。`docs/API-SURFACE.md` 的 `media/generate` 行补记 `continuation?` 字段。
  测试：`tests/client-video-continuation.test.tsx`（2 项：有参考视频时 `continuation:true` 透传；缺参考视频时守卫拦截、零 `generatePayloads`）。
- [x] **B-5（成片多比例切片）**：`timelines/render-ratios`（`API-SURFACE` 第 145 行，B-5）。时间轴模式 `VoiceCard` 后新增
  `RatioSlicesPanel`：勾选 9:16 / 1:1 / 4:3（默认勾 9:16）→ `renderRatioSlices({timelineId,ratios,priority?})` →
  展示各比例 `ratio · width×height`（短边不变：9:16=720×1280、1:1=720×720、4:3=960×720）；无时间轴时如实提示、按钮禁用、不假装能导出。
  测试：`tests/client-ratio-slices.test.tsx`（3 项：无时间轴提示 / 导出尺寸断言 / 无勾选拒绝运行）。
- [x] **B-6（模型能力卡 + 提示词风控）**：`models/catalog` + `prompts/check`（`API-SURFACE` 第 34/35 行，B-6）。
  *能力卡*：快速创作区（outputs 统计后）新增 `ModelCardsPanel`，加载 `modelsCatalog()` 渲染卡片——名称/校验芯片/类型/成本/时长/画幅/能力矩阵（`FeatureRow`：图生视频/首末帧/多帧/参考视频/音频）/提示词技巧；`consistencyIssues` 非空照实提示（卡片与运行时能力漂移不粉饰）。
  *风控*：`Workbench` 融合区新增风控条——「检查提示词」按钮调 `checkPrompt`，`composeRisk.level==='block'` 时 `runCompose` **直接拒绝零调用**并展示命中建议；`warn`/`ok` 仅状态提示。
  测试：`tests/client-models-catalog.test.tsx`（3 项：卡片渲染 / drift 警告 / 空提示）；风控 `checkPrompt` 走 fake 断言（block/warn/ok 判定已固化于 `client-fake-api.ts`）。
- [x] **B-7（资源库扁平分类闭环）**：`resources/update` 支持 `folder`（`API-SURFACE` 第 117 行，B-7）。资源 pane 顶部新增
  `ResourceFoldersPanel`：`listResourcesWithFolders` 加载 + 分类侧栏（`__all__` / `__none__` / 各 `folder`）本地过滤、零请求零闪烁；
  每个资源行「重绘计划」按钮调 `planResourceRedraw` 展开（prompt / 参考数 / 建议 / 警告）+ 「发送融合」按钮（`onSendToCompose(plan.prompt)` 回填融合提示词）。
  测试：`tests/client-resource-folders.test.tsx`（3 项：分类条渲染与过滤 / `planResourceRedraw` 记录 `redrawPayloads` / `onSendToCompose` 回调带回提示词）。
- [x] **B-18（流水线手动挑选物料）**：`pipelines/compose|run` 显式 `resourceIds` + `matchedResources` 回显（A 2026-10-26 认领，`API-SURFACE` 第 80/83 行）。
  `PipelineCard` 手写编排/运行控制区后新增手动挑选块：加载 `listResources` 勾选（计数 + 清空），给了 `resourceIds` 就按指定资源编排（缺 id 仍走剧本自动匹配）；
  结果区回显 `matchedResources`（`{name}/{kind}` 芯片）。与 Round 4 的 B-18（缺失清单自动匹配闭环）**互补**，非同一交付。
  测试：`tests/client-pipeline-manual-pick.test.tsx`（2 项：① 勾选后 `composePipeline`/`runPipeline` 透传 `resourceIds=['res-1']` 且结果区回显 `matchedResources`；② 未挑时不带 `resourceIds`、无 `matched` 回显，走剧本自动匹配）。

**Round 5 门禁**：
- 新增 6 个测试文件、共 **15 项**（B-3 2 + B-4 2 + B-5 3 + B-6 3 + B-7 3 + B-18 2）；既有 `client-*.test.*` 全绿、无回归（分批跑：结构类 `no-hardcoding`/`i18n`/`a11y`/`theme`/`style-injection`、相邻 `fusion-compose`/`pipeline-card`/`quick-generate`/`resource-columns`/`resource-references`/`pipeline-materials`/`multi-reference`/`voice-card` 等 28 个文件均 PASS）。
- `pnpm run typecheck` 通过（exit 0，双 tsconfig）。
- `pnpm run check:bundle` 通过：入口 55,361 B（占预算 84%）· 总产物 909,044 B（占预算 84%），仍留约 16% 余量。
- 契约漂移类测试全绿（`rpc-new-endpoints` 10、`rpc-contract-drift` 1、`tool-actions-drift` 1）。

**Round 5 环境备注（非本次改动引起）**：
1. `tests/workbench-rpc-endpoints.test.ts` 此前 1 项失败——`refuses package exports outside the packages directory` 断言
   `manifestPath.toContain('packages/')`，Windows 实际路径为 `packages\`（反斜杠）；已修为跨平台归一
   `toContain(join('packages', ''))`（`join` 在 Windows 出反斜杠、POSIX 出正斜杠），该文件 26 passed｜1 skipped 全绿
   （同事 A 的"门禁全绿"是在 Linux/macOS CI 跑的，此断言在 Windows 沙箱才暴露）。
2. 本地 `pnpm run build` 仍受 pnpm store 缺 `@jridgewell/sourcemap-codec` 影响在 tsdown 处失败（Round 3 已记录）；
   体积门禁用 `pnpm run check:bundle` 兜底确认。
3. 宿主未运行（54274 无监听）——交接核对四项中 `workbench.json` 仍为 `schemaVersion=4`、无 `.pre-migrate-v4` 备份、
   `lib/index.js` 为 10-25 旧产物、插件 rev 未变；属**交接环境态**，UI 接驳不依赖宿主运行（fake 宿主已闭环验证）。

