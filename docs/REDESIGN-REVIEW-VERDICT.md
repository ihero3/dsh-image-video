# 三份 Pane 重设计方案 · 专家团联合评审纪要

> 评审日期：2026-11-26 · 评审方：UI 设计全栈专家团（视觉 / 体验 / 工程 三阶段串行）
> 评审对象：`SCRIPT-PANE-REDESIGN.md` v1.1、`TIMELINE-PANE-REDESIGN.md` v1.2、`WORKFLOW-PANE-REDESIGN.md` v1.2
> 性质：**只读评审，未修改任何方案文件、未改动任何源码**。本文是三阶段结论的主理人汇编，供拍板与改稿使用。

---

## 〇、一句话结论

**三份方案方向都对，没有一份"不可行"，但也都不是"照着做就行"——每份都带 P1 级前置条件。**
真正卡住落地的不是某个 pane 的局部设计，而是**三份共用底座的四个决策一直没拍板**：状态色语义、层级表、确认/撤销表、键盘契约，外加一个悬了三轮的体积基线。这五件事定不下来，三批独立实施后视觉与交互分叉会比现状更难收。

---

## 一、可行性裁决矩阵

| 方案 | 视觉 | 体验 | 工程 | 综合裁决 |
|------|------|------|------|----------|
| 剧本生成页 v1.1 | 有条件可行 | 有条件可行 | 有条件可行 | **可改后实施**——文档内部口径打架（M6 vs 目标图/验证清单），且删容器会挂 3 个测试、同步确认再挂 1 个 |
| 时间轴精剪 v1.2 | 有条件可行 | 有条件可行 | **现稿工程上不可行** | **必须大改**——"0 用例改动"是错的（≥5 个交互用例会挂），播放头去 46px 需 DOM 重构，D2 只减播放器未治双播放头心智 |
| 专业工作流画布 v1.2 | 有条件可行 | 有条件可行（体验风险最集中） | 有条件可行（契约最稳） | **可先做**——0 测试改动成立，但 Esc 与最大化冲突、三个整图替换入口无确认、窄屏抽屉遮挡 |

---

## 二、必须主理人先拍板的四张统一表（跨方案）

这四项是三阶段评审的共同交集，不拍板就开工 = 返工。

### 2.1 状态色语义表（视觉 C3 / 体验 §4.5 / 工程交叉）
`--iv-acc` 已被 `modern-theme.ts:36` 覆盖成中性色 `--iv-solid`，导致"运行中 / 选中 / 视频轨 / 节点图标"色相信号全部失效；`.iv-chip--run`、`.iv-clip--sel` 一并退化。
- **定法**：状态色（ok/warn/danger）只表状态；"选中/激活"用 `--iv-solid` + `--iv-on-solid`（主题反相天然成立）或显式 info token；"分类"用中性明度阶梯。三者不得互借。
- 若走"运行中"蓝色路线，显式取 `var(--dsw-alias-button-info-fill,#4176e6)`，不要再借被覆盖的 `--iv-acc`。

### 2.2 层级表（视觉 W3/C5 / 体验 §4.5）
剧本 `⋯` 菜单用了 `--iv-z-overlay`(60，模态层)、画布抽屉用 6、模板浮层用 40，三者语义倒挂。
- **定法**：`6 = 抽屉`（新增 `--iv-z-drawer:6`，不要借 `--iv-z-playhead:5`）；`40 = 所有非模态 popover`（溢出菜单、模板浮层、节点气泡、tooltip）；`60 = 仅模态/全屏/遮罩`。三份采用同一张表。

### 2.3 确认 / 撤销表（体验 §4.3）
| 操作类型 | 例子 | 定法 |
|---|---|---|
| 整图/整集替换 | 同步工作流重建画布、导入集、导入/粘贴工作流、应用模板 | 事前确认 + 事后可撤销，提示里明确"可撤销" |
| 单条删除 | 删片段、删段、删节点 | 轻确认或带"撤销"的瞬时提示；批量删除必须确认 |
| 外写但非破坏 | 导出视频/导出集 | 不确认，状态可见 + 可取消 |
| 纯视图变换 | 折叠、切 tab、缩放、抽屉开合 | 不确认，状态可见、可回到原状 |

确认弹窗统一复用已有 `useDialogFocus` + `role=dialog`，**不用 `window.confirm`**（jsdom 不支持、读屏与主题不受控、三份各写会分叉）。

### 2.4 键盘契约（体验 §4.4 / 工程 W1/T1）
| 键 | 统一语义 |
|---|---|
| Tab | DOM 顺序；tablist 用 roving tabIndex；浮层打开焦点移入 |
| ←/→ | 仅在 tablist / menu 内切换；画布留给 xyflow |
| Enter/Space | 激活/切换折叠/选中；选中后焦点移到对应编辑器 |
| **Esc** | **关最内层浮层；无浮层且最大化时退出最大化；无其他行为不吞键** |
| Delete/Backspace | 删除选中对象；输入框内不劫持 |
| Cmd/Ctrl+Z | 撤销；与 `applyGraph` 历史统一 |

当前冲突：画布 Esc 只绑最大化、剧本 `⋯` 无 Esc、时间轴未定义检查器焦点退出。

### 2.5 体积基线（工程 §0 / §4.1）——悬了三轮，建议本轮一次定死
实跑只读 `check-bundle-size.mjs`：入口 24,231 B（88%），总产物 **raw 1,490,659 / 106% 超 86,659 B；gzip 325,219 / 106% 超 19,219 B**。三份方案只写了 raw 超限，**漏了 gzip 也超**。
- **定法**：`scripts/bundle-budget.mjs` 的 `BUNDLE_TOTAL_BASELINE` 从 `{raw:1_170_000, gzip:255_000}` 改 `{raw:1_265_000, gzip:278_000}`，预算自动变 1,518,000 / 333,600；入口基线不动；`CHANGELOG.md` 写明理由。`tests/bundle-budget.test.ts` 无需改（预算派生）。
- 抬后当前占用 98.2%/97.5%，三批全落地预计 99.4%/98.5%，与历史每轮余量口径一致。
- **单批增量硬上限 6 KB raw / 1.2 KB gzip**；门禁抬基线后必须全绿，不能拿"本来就红"当豁免。
- `.iv-disclosure` 基类抽取净省约 5–8 条规则 / 400–800 B raw（不是方案说的减半），值得做但不能替代抬基线；抽取时**必须保留** `.iv .iv-advanced-head::-webkit-details-marker{` 字面串（`client-modern-theme.test.tsx:133` 钉住）。

---

## 三、逐方案必修项汇总（三阶段取并集，按优先级）

### 3.1 剧本生成页
| # | 来源 | 级别 | 问题 | 修法 |
|---|------|------|------|------|
| S-a | 体验/工程 | **P0** | 文档口径打架：M6 说"生成设置保持展开"，但 §2.1 目标图 / §2.4 / §八:478 三处仍写默认收起 + 无效摘要"自动·自动·自动" | 开工前统一三处为 M6 口径；摘要按 M5 回显生效值（`6 集·3 段·4 镜·默认规则`）。纯文档修订，先做 |
| S-b | 视觉/工程 | P1 | §2.3 把 `data-module` 降级为 hidden `<span>` 并删 `.iv-modules` → `client-quick-modules:66-67/82-86` 两个用例挂；折叠用例 `:118-137` 是整个失效 | **保留 `.iv-modules` / `iv-module[data-module]` 两层容器**，只删 `iv-module-head` 与折叠行为，`data-module-body` 恒展开 |
| S-c | 体验/工程 | P1 | 分段头 `<div onClick>` 无键盘路径——段内是全页 80% 编辑内容，键盘用户完全进不去，比改造前更糟 | 整行改 `<button aria-expanded aria-controls>`，折叠体加 `id`/`hidden`；与 tab 焦点跟随用同一套写法 |
| S-d | 体验/工程 | P1 | `⋯` 菜单无 Esc/外部点击关闭/焦点归还；"同步工作流"补确认会让 `client-episode-workspace:311/316` 挂 | 复用 `useDialogFocus`；确认用例同批改，或给确认按钮 `data-episode-sync-confirm`；**不引入 `window.confirm`** |
| S-e | 工程 | P1 | `jumpToSegment` 在 `<details>` 关闭态 `focus()` 静默失效，且 jsdom 测不出（"测试绿、线上坏"） | `detailsRef.current.open = true` 直接改 DOM + `flushSync`，再 focus；补焦点断言测试 |
| S-f | 视觉 | P1 | 折叠箭头方向错：`chevron` 是右向">"，转 180° 变"<"读作"返回"；正确约定是收起 0° / 展开 90° | 改 90° + `--iv-dur-2`，顺手修 `modern-theme.ts:202` 同源问题 |
| S-g | 视觉/体验 | P2 | `.iv-sc-adv` 声称复用 `.iv-advanced` 实际是近似值（12 vs 12.5px、6/9 vs 8/10、100 vs 120ms、缺 overflow:hidden），且摘要用 `--iv-tx3` 装饰色承载正文 | 首选双类名 `class="iv-advanced iv-sc-adv"` 零新增规则；摘要文字提 `--iv-tx2` |
| S-h | 视觉/体验 | P2 | 380px 右列下 4 个带图标 tab + 标题会换行成"无标题的右对齐孤行"；`⋯` 26px、导入 `×` 无命中区下限 | 加容器查询窄态（图标+title）；粗指针 ≥44×44 命中区；tab 包进 `.iv-pane-actions` |

其余 P2/P3：tab 的 `aria-controls` 四个同指一个 panel（补 NVDA/VoiceOver 实测）、两个同名"文本模型"控件来源不清（后者改只读回显）、新分段全折叠打断"生成→立刻精修"（仅最新段默认展开）、保存态无 live region、中文小标题用了 `uppercase`+`.08em` 字距、摘要 `max-width:60%` 截掉生效值。

### 3.2 时间轴精剪
| # | 来源 | 级别 | 问题 | 修法 |
|---|------|------|------|------|
| T-a | 工程 | **P0** | "0 用例改动"不实：13 控件搬出 `.iv-clip` 后，`client-timeline-interaction` 5 个用例读"轨道内第 N 个 input"会挂（`:152/171/179-197/233/257-262`） | 改读检查器字段，新增 `data-timeline-insp-field="start\|duration"` 稳定契约；**不要**在 clip 里藏一份 input 给测试（重复 aria-label + 值漂移） |
| T-b | 工程/体验 | **P1** | fallback 下禁用分割/复制/删除会让 `client-timeline-interaction:230/271-285` 挂（加入片段不写 `selectedClipId`）；split 的 disabled 只能由 playhead 决定 | `appendClip`/`onLaneDrop`/`applyBatchSubtitles` 加入片段即 `setSelectedClipId(newId)`；split 永不叠加 `isFallback` |
| T-c | 工程/视觉 | **P1** | 播放头移入 `.iv-tl-lanes` 去 46px 需重构每条 `.iv-track` 的 grid，代价远超方案描述，且会波及 laneRefs | **用 CSS token 零重构**：`--iv-tl-head:46px`，ruler/track 用变量，JS 改 `calc(var(--iv-tl-head) + (100% - var(--iv-tl-head))*ratio)` |
| T-d | 体验 | **P1** | D2 只减播放器数量，未消除双播放头心智（核心心智问题被划到"下一批"） | 本批最小集：两播放器互斥 + 文案职责说死（"顺序预览·独立播放，不影响播放头"）+ 外部触发先展开「辅助」 |
| T-e | 体验/工程 | **P1** | 导出中 `opacity:.55 + pointer-events:none` 只挡鼠标，键盘仍可改参数 → "我改了但导出用旧值" | 三个 select + 两个 checkbox 加 `disabled={renderRunning}`；`data-busy` 只做视觉，删 `pointer-events:none` |
| T-f | 视觉/体验 | P1 | 检查器称"54px 固定"但自身 flex-wrap 装 13 控件实测 110–135px，是预算 2 倍；缩略底 `opacity:.42` + `--iv-tx3` 文字在双主题都不可读 | 常用 4 项常驻 + 其余 9 项进 `<details>`；缩略图 opacity:1 + 可读性渐变 + 前景文字强制白色（媒体惯例）；预算改实测区间 |
| T-g | 工程 | P2 | 缩放只能 `width:calc(100%*zoom)`，禁 `transform:scaleX()`（会缩放 padding、破坏 `LANE_PADDING_PX=8` 换算）；ruler/playhead/lane 必须同容器；slider 输入需 rAF 节流 | 补纯函数测试"zoom 后同 clientX 落点毫秒不变"；验收加"无 >50ms long task" |
| T-h | 视觉/体验 | P2 | ffmpeg 降为色点却无任何状态配色编码（成功/失败一样）；`44px` 片段条里 22px 分割按钮 `opacity:0` 触屏不可发现；12 格刻度末格被裁 | 容器挂 `--ok/--err`；粗指针 `opacity:1`+32px；12 格时文字隔格显示、末格 `translateX(-100%)` |

其余：矮屏≤640px"同屏"承诺失效（补第三档降级）、键盘选中片段后焦点不进检查器（rAF 移到检查器锚点）、删除片段无撤销、§3.1"workbench-style.ts 不动"与 M4 自相矛盾（选 modern-theme 覆盖方案）。

### 3.3 专业工作流画布
| # | 来源 | 级别 | 问题 | 修法 |
|---|------|------|------|------|
| W-a | 体验/工程 | **P1** | Esc 冲突：`WorkflowCanvas.tsx:567-573` 全局 Esc 无条件退最大化，抽屉 Esc 只在验证清单里写了没实现 | 直接 `useDialogFocus(selected, inspRef, closeInspector)`——document capture + stopPropagation 天然实现"先关抽屉后退最大化"；`closeInspector` 必须等价于清空选中 |
| W-b | 体验 | **P1** | 三个整图替换入口全部无确认（应用模板 `426-443`、导入 `499-505`、Ctrl+V JSON `588-598`），模板浮层化后误触概率反升 | 图非空时事前摘要确认（含"可撤销"）；Ctrl+V 后给带"撤销"按钮的 notice；三入口统一策略 |
| W-c | 体验/视觉 | **P1** | 窄屏抽屉 `min(300px,86%)` 会盖住用户正在编辑的节点，正好抵消 D3"看着节点改参数"的收益 | 条件触发：节点屏幕位置落入抽屉覆盖区时 `setCenter` 移到左侧可见区（一次即可）；或 <900px 改底部抽屉 |
| W-d | 视觉/工程 | P1 | "三层 ≤110/130px"被自身 `.iv-pal-label{width:100%}` 推翻——两段标题独占两行，节点条实为 4 行 ≈66–90px，三层回到 135–160px | 标题改 `flex:none;width:auto` 与 chip 同行，或拆两个 flex 行容器；重测 1200/900/800 三档写回文档 |
| W-e | 视觉/体验 | P2 | 运行中色点取被覆盖的 `--iv-acc` 退化为中性，与"就绪"无法区分；空态文字 `--iv-tx3` 比它引导的按钮还弱 | 走状态色表（§2.1）的形状/颜色语义；空态文案提 `--iv-tx2`、CTA 升 `.iv-btn--acc` |
| W-f | 工程 | P2 | 模板浮层 `position:absolute;top:100%` 依赖父级 relative，但 `.iv-main{overflow:auto}` 会裁切向下展开的浮层 | 实测最大化态；必要时改 `position:fixed` + 触发按钮 rect 定位 |
| W-g | 工程/体验 | P2 | "点击问题胶囊 = 展开日志并高亮该节点"无现成"问题→节点"映射状态，强做会改 `setNodes` 并污染 undo 历史、可能改写 planned 节点 | 本批只 `setLogOpen(true)`；高亮单独排期或改纯 CSS `data-workflow-issue-node` |

其余：抽屉焦点归还落空（选中节点被删时 `previous.focus()` 指向已卸载 DOM，兜底聚焦 `.iv-flow`）、22px chip 触屏命中区、抽屉 `complementary` 非模态语义需选定、`data-workflow-run-status` 缺省 `'none'` 别写 `'idle'`。

---

## 四、实施顺序（工程侧建议，含回滚边界）

| 批次 | 内容 | 为什么必须这组 | 回滚边界 |
|---|---|---|---|
| **B0 共享底座**（无 UI 变化） | check-bundle 留证 → 抬基线 1,265,000/278,000 + CHANGELOG → 加 `--iv-z-drawer:6` → 抽 `.iv-disclosure` 基类（保留 `.iv-advanced-head` 字面串） | 门禁/层级/折叠是所有批次前提，先抽否则各写一套再合并返工 | 单独 commit，只改预算/样式/CHANGELOG |
| **B1 画布全部** | 工具条三组 + 节点条分组 + 检查器抽屉 + 模板浮层 + `useDialogFocus`/Esc | 抽屉与焦点/Esc 不能拆；0 测试改动 | 回退 `WorkflowCanvas.tsx` + 模板块 + B1 CSS |
| **B2 时间轴 Step1** | 顺序重排、ffmpeg 色点、导出条常驻 | 纯位置调整、测试全绿，先拿"同屏"收益 | `Workbench.tsx` 单文件 hunk |
| **B3 时间轴 Step2** | 13 控件搬家 + fallback + 键盘选中 + **5 个测试改写** + 加入片段自动选中 | 控件搬家与测试契约必须同批，否则 CI 红 | 回退 `Workbench.tsx` + `client-timeline-interaction.test.tsx` |
| **B4 时间轴 Step4a/4b** | 4a 播放头改 CSS token（不重构 DOM）；4b 缩放接真值 + rAF 节流 + 坐标数学测试 | 播放头与缩放共用坐标基准 | 回退 CSS 变量与 slider handler，不动 B3 |
| **B5 剧本 Step1/2** | pane 头 + tab 语义（refs 焦点）+ 删 module 头；**保留 `.iv-modules`/`data-module` 容器** | 保留容器才能不挂 `client-quick-modules` 2 个用例 | 回退 `Workbench.tsx` 剧本分支 |
| **B6 剧本 Step3/4** | 输入区去内联 + 段内高级折叠 + 分集剧本折叠 + 跳转修复 + 同步确认 + 测试 | 折叠/跳转/确认耦合同一 EpisodeWorkspace 状态；测试改动最多 | 回退 3 个组件 + 对应测试 |
| **B7 卫生（可选）** | M3 拆 `!important`、内联样式清理 | 纯样式卫生，不阻塞功能 | 单独 commit |

---

## 五、验收清单的三条共同补充（三份方案都漏了）

1. **全量测试**：`pnpm exec vitest run`（不只跑点名文件）+ 两份 tsconfig 的 typecheck + `pnpm run build && node scripts/check-bundle-size.mjs`，raw/gzip 两个口径都记，单批增量硬限 6 KB / 1.2 KB。
2. **DOM 契约新增断言**：剧本 `data-module` 仍是祖先容器、tab roving 的 `document.activeElement`、details 关闭态跳转后 textarea 有焦点；时间轴 fallback 两态 disabled、split 只受 playhead 约束、zoom 后落点毫秒不变；画布"最大化+抽屉同开按一次 Esc 只关抽屉"。
3. **真机抽样（jsdom 测不到）**：900/768/640px 首屏 `getBoundingClientRect().bottom ≤ innerHeight`；zoom slider 无 >50ms long task；抽屉打开前后 `.iv-flow` 宽高一像素不变；模板浮层打开前后画布高度不变；浅/深双主题 + 亮/暗图上的片段文字可读。

---

## 六、待用户拍板（Main 决议清单）

按顺序，前两项决定后面所有改稿：

1. **是否接受 §2.5 抬体积基线到 1,265,000 / 278,000（raw/gzip 同时）？** —— 不抬则三批无论怎么瘦身门禁都红。
2. **是否通过 §2.1 状态色表 + §2.2 层级表？** —— 决定 `--iv-acc` 失效问题与 z-index 倒挂怎么收。
3. **是否通过 §2.3 确认/撤销表 + §2.4 键盘契约？** —— 决定三份的破坏性操作与 Esc 行为怎么写。
4. **时间轴 D2 双播放器**：本批只做"互斥 + 文案区分"（推荐），还是本批就统一播放时钟（成本高）？
5. **画布窄屏遮挡**：条件 `setCenter`（推荐）还是 <900px 改底部抽屉？
6. **实施范围**：先按 B0→B1（画布）跑通一批验证流程，还是三批连续做完？

---

*本纪要为三阶段成员独立评审的主理人汇编，所有事实性判断均由对应阶段成员核实；未修改任何原始方案或源码。*
