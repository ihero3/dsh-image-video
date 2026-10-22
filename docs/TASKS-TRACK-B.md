# Track B 任务书（界面：交互 / 视觉 / 使用体验）

> 归属：**同事 B**（Track B）。地盘：`src/client/**` + 客户端测试 + UI 文档。**不碰** `src/host`、`src/workbench`、`src/media`、`lib`、依赖。
> 前置：先把 `docs/COLLABORATION.md` 看一遍（文件所有权矩阵 + 分支规则）。
> 每项完成条件：`bash scripts/gate.sh` 全绿（lib 由 A 提交，你本地 build 自测即可）+ 客户端测试 + 截图。

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
- 提交 `lib/`、改 `package.json`/lock、打 tag。
