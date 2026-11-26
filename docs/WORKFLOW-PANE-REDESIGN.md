# 专业工作流（画布）重新设计方案

> 版本：v1.2 · 2026-11-26 · 状态：**D3 已拍板（抽屉滑出）；D1 已按 §十二 改口径（三层压缩，不是「合并两层」）；其余待确认，尚未实施**
>
> 基线：`QUICK-CREATE-REDESIGN.md` v1.2.4。方法论一致；本方案额外遵守一条本模块专属约束：
> **`T3-2` 产品决策（planned 节点可放入画布、可保存、不可运行）不可推翻**——见 §九.3。

---

## 决策确认

| # | 决策项 | 结论 | 备注 |
|---|--------|------|------|
| D1 | 画布上方的三层 chrome（pane 头 + 节点条 + 工具条） | **保留三层，但压到合计 ≤110px**：pane 头保持共用件（30）+ 工具条单行（26）+ 节点条两行（2×22）；**不删 pane 头**——它是三个 pane 的共用骨架，删了会与另两份方案冲突 | 保留：约 174px 的界面外壳压在画布上方，800px 窗口下画布被挤出首屏 |
| D2 | 模板市场 | 由**内联展开面板**改为**浮层抽屉**，覆盖画布右上，不挤占画布高度 | 保留：每开一次模板市场，画布高度骤降 150–300px，节点视觉位置整体跳动 |
| D3 | 属性检查器 | ✅ **已定：抽屉式——仅选中节点时从右侧滑出**，覆盖画布右缘、不占布局宽度；未选中时不渲染，画布空态回到画布中央 | 画布宽度零损失。代价：抽屉会盖住右缘节点（§10 风险 2）。原建议「右侧常驻 264px 列」已废弃 |
| D4 | 运行入口 | 从工具条中部移到**最右侧独立分组**，前置状态点 + 文字（就绪 / 运行中 n / 已完成 / 已取消） | 保留：开始按钮夹在「导入」「导出」之后，与 14 个同级按钮混排 |
| D5 | 校验问题可见性 | 运行按钮旁常显「N 个问题」胶囊，点击展开日志；**用 `--warn` 不用 `--danger`**（planned 节点是预期状态，不是错误） | 保留：「开始运行」变灰但原因要用户自己去最右找 |
| D6 | planned 节点呈现 | **保持可点击、可放置（`T3-2`）**，只加「规划中」分组标题与放置后的一次性提示条 | 若改成禁用：直接违反 `T3-2`，并让 2 个测试用例失效（§九.3） |

---

## 一、现状诊断

### 1.1 三层 chrome 压在画布上

```
iv-pane--canvas
 ├─ iv-pane-head          [flow] 工作流画布            [模板市场] [保存态]     ← 22px
 ├─ (可选) .iv-tpl        模板市场内联展开（分组卡片网格）                      ← 150–300px
 ├─ .iv-pal               15 个节点 chip（12 可用 + 3 规划，换行）              ← 2 行 ≈ 44px
│                        （`external` 节点有意不在节点条内：`NODE_CATALOG` 共 16 条，
│                          节点条只映射 runnable + planned，测试断言 15 就是这条边界）
 └─ .iv-workflow-body
     ├─ .iv-toolbar       1 个下拉 + 14 个按钮 + 计数                           ← 2 行 ≈ 60px
     ├─ .iv-flow          画布（min-height 280px）
     └─ .iv-inspector     选中时才出现（否则一行灰字）
```

证据：`Workbench.tsx:3857-3921`（pane 头 + 模板市场内联块）、`WorkflowCanvas.tsx:633-673`（节点条）、
`676-781`（工具条）、`783-807`（画布）、`809-812`（检查器条件渲染）。
样式：`.iv-pal`（`workbench-style.ts:722`，`flex-wrap:wrap`）、`.iv-toolbar`（`445`，`flex-wrap:wrap`）、
`.iv-flow`（`733`，`min-height:280px`）、`.iv-inspector`（`782`）。

**算一笔高度账**（1000px 宽窗口）：pane 内边距 16 + 头 22 + 节点条 52 + 工具条 60 + 三处 gap 24 ≈ **174px**。
画布 `min-height:clamp(480px, calc(100vh - 200px), 980px)`，800px 高窗口 → 600px。两者相加已 774px，
再加页面外壳与模式导航，**画布下沿必然在首屏之下**。这是「专业工作流看起来憋屈」的算术原因。

### 1.2 14 个按钮同一权重

`WorkflowCanvas.tsx:676-781` 依次是：模板下拉、应用模板、适应视图、撤销、重做、复制、粘贴、删除、
导入、导出、**运行 / 取消 / 重试**、节点计数、日志、最大化。

- 全部 `iv-btn iv-btn--sm`，只有运行是 `iv-btn--primary`（但同样 `--sm`）。
- 分组只靠两根 `iv-toolbar-sep`（1px 竖线），且断点在「适应视图 / 撤销」和「删除 / 导入」之间，
  语义分组与视觉分组不一致（撤销重做属于编辑，与复制粘贴同组更合理）。
- 14 个按钮文本都是完整词组（`canvasDeleteSelected`、`canvasImportWorkflow`…），中文下平均 5–7 字，
  1000px 宽必然换行成 2 排；窄窗口 3 排。

### 1.3 模板市场把画布「顶下去」

模板面板不是浮层，是 `pane` 里的一个普通块（`Workflow.tsx:3875-3921`，`.iv-tpl` 网格 `auto-fill minmax(150px,1fr)`）。
展开时画布的可用高度被挤掉，xyflow 的视口不变，于是**用户看到的节点位置整体上移一屏**。
这是节点编辑器里最容易被误认为「我的图乱了」的一种反馈。

### 1.4 检查器插在文档流里，且是条件插入

```tsx
{selectedNodes.length === 0
  ? <p className="iv-meta">{t('canvasEmpty')}</p>          // 809-810：一行灰字
  : <div className="iv-inspector" …>                       // 812：插入一整块
```

后果有三：
1. 选中节点 → 画布高度骤减，视口跳动；
2. 未选中时底部是一行「选择节点查看参数」，占位却没信息；
3. 检查器在画布**下方**，调参数时看不到被调的节点（尤其节点在上半屏时）。

### 1.5 planned 节点：能放、能存、不能跑，且原因藏得很深

palette 里 12 个可用节点与 3 个 planned 节点混排，只隔一条虚线（`WorkflowCanvas.tsx:653`），
planned 卡片额外标一个 `canvasPlannedTag` 小字。两者都能点、都能加。

而 `validateWorkflow` 对 `availability !== 'runnable'` 的节点**直接产出问题项**（`workbench/workflow.ts:489-495`），
只要图里有一个 planned 节点，整张图校验不通过 → 工具条里的「开始运行」被 `disabled={!validation.ok}` 灰掉。

**用户看到的**：点了一个带「规划中」小字的节点 → 画布多一张虚线卡 → 开始运行灰了。
**原因所在**：问题数量只在最右侧「日志」按钮里以一枚小红胶囊呈现（`766-774`）。
这是一条典型的「症状与原因相距 1000px」的链路。

### 1.6 其他

| 位置 | 问题 | 证据 |
|------|------|------|
| 节点条标题 | `style={{ width: '100%' }}` 用内联样式强制换行 | `WorkflowCanvas.tsx:634` |
| 节点条 | 15 个 chip 无分组标题（只有一条虚线分隔） | `633-673` |
| 画布空态 | 没有「从模板开始 / 从左侧添加」的引导 | `809-810` |
| pane 标题 | 顶部 `iv-modes` 导航已写「专业工作流」，pane 头再写「工作流画布」 | `Workbench.tsx:3861` vs `2614` |

---

## 二、设计方案

### 2.1 目标形态

```
┌─ iv-pane--canvas ─────────────────────────────────────────────────────┐
│ [flow] 工作流画布                                        [模板] [已保存] │ ← 头（保留，仅标题文案统一）
├───────────────────────────────────────────────────────────────────────┤
│ [模板 ▾][应用] │ [↶][↷][复制][粘贴][删除] │ [导入][导出]   ● 就绪 [▶ 运行][■][↻] │ [2 问题][日志][⛶]│
├───────────────────────────────────────────────────────────────────────┤
│ 可用 12    [创意输入][剧本][分镜][素材引用][资源引用][轨迹] …→ 横向滚动  │ ← 26px 单行
│ 规划 3     [口型同步][换脸][配音合成]                                    │
├───────────────────────────────────────────────────────────────────────┤
│                                                        ┌─────────────┐│
│                                                        │检查器  [✕]  ││ ← 选中时才滑出
│                    画  布                              │─ ─ ─ ─ ─ ─ ─││   覆盖右缘，不占宽
│                 （全宽，无右侧留白）                     │ 节点参数    ││
│                                                        │ [运行此节点]││
│                                                        └─────────────┘│
│           未选中时：画布中央一行引导（拖入节点 / 看模板）                │
└───────────────────────────────────────────────────────────────────────┘
```

要点：
1. **三层保留、整体压扁，不是「合并两层」**：pane 头 30（三个 pane 的共用骨架，删了会与另两份方案分叉）+ 工具条 26 + 节点条 2 行 ≈44 → **合计 ≈106px**（≥1100px 宽）；800–1100px 宽时节点条换到 3 行 ≈128px。无论哪档都 ≤130px，比现状 174px 省 44–68px，画布足以回到首屏。**不要为了「两层」这个说法去删 pane 头。**
2. **运行组右对齐独立成块**：状态点 + 文案 + 主按钮 + 取消 + 重试，中间用 1px 竖线与其他组隔开。
3. **检查器是抽屉**（D3）：`position:absolute` 贴 stage 右缘，宽 `min(300px, 86%)`；**仅选中时渲染**，从右侧滑入；未选中不占位、不渲染，空态回到画布中央一行。
4. **模板市场浮层**：从 pane 头按钮下方展开，`position:absolute` 覆盖画布右上，宽 `min(520px, 92%)`，`max-height:60vh` 内滚动。
5. **为什么是抽屉而不是右列**：右列 264px 会永久吃掉画布宽度（800px 窗口下画布只剩 500px 左右），而画布宽度恰恰是节点图最需要的；抽屉只在选中时出现，编辑参数本来就是「看着这个节点改」，遮挡可接受，且 Esc / 关闭按钮一拍即收。


### 2.2 结构改造清单

| 元素 | 现状 | 改造 | 必须保留 |
|------|------|------|----------|
| pane 头标题 | `t('paneCanvas')` = 工作流画布 | 改用 `t('modeWorkflow')`，与导航一致（或导航侧改名，二选一） | `data-workbench-pane="paneCanvas"` |
| 模板市场按钮 | `data-workflow-template-toggle` | 保留，改 `aria-expanded` + `aria-controls` 指向浮层 | 同左 |
| 模板市场面板 | `.iv-tpl` 内联块 | 加 `.iv-wf-drawer` 定位为浮层；**内部结构不动** | `data-workflow-template-market="true"`、`data-workflow-template="<id>"` |
| 节点条 | `.iv-pal` 单容器混排 15 个 | 拆两段（可用 / 规划）+ 段标题；容器仍为 `.iv-pal` | `data-workflow-palette="true"`、每个 `data-workflow-palette-item`、`aria-label`、`title`、**15 个全部常在 DOM** |
| 工具条 | 14 按钮平铺 | 按 `文件 / 编辑 / 运行` 三组重排，运行组置右 | `data-workflow-action="…"` 全部保留、`data-workflow-toolbar-run="true"` |
| 运行状态 | 只在按钮 disabled 上体现 | 新增状态点 + 文案（就绪 / 运行中 / 已失败 / 已取消），数据取 `run.latest?.status` | `data-workflow-run-action="start|cancel|retry"` |
| 校验问题 | 只在日志按钮里 | 运行组前加 `N 问题` 胶囊，点击 = 打开日志 | `data-workflow-log-issue-count`、`data-workflow-log-toggle` |
| 日志抽屉 | 画布下方 | **不动**（`iv-worklog` 已能表达「收起时画布独占高度」） | `data-workflow-log`、`data-workflow-log-open` |
| 检查器 | 画布下方 + 条件渲染 | 改为 **stage 内 absolute 抽屉**（`.iv-wf-insp`），仅选中时渲染并滑入；头部加「收起」按钮 | `data-workflow-inspector="<id>"`（仅选中时存在，语义不变） |
| 画布空态 | `<p class="iv-meta">` | 留在画布中央（不在抽屉里，因为抽屉未选中时不渲染）；文案改引导 + 一个「看模板」按钮 | — |
| 节点卡 | `.iv-node` | 加左侧 3px 分类色条（输入 / 生成 / 输出 / 发布），`::before` 实现，不改 DOM | `data-workflow-node`、`data-workflow-node-availability` |

### 2.3 伪代码

```tsx
// 工具条重排（WorkflowCanvas.tsx:676-781）
<div className="iv-toolbar iv-wf-toolbar">
  <div className="iv-wf-grp">{/* 文件：模板下拉 + 应用 + 导入 + 导出 */}</div>
  <span className="iv-toolbar-sep" role="separator" />
  <div className="iv-wf-grp">{/* 编辑：适应 / 撤销 / 重做 / 复制 / 粘贴 / 删除 */}</div>

  <div className="iv-wf-runbar" data-workflow-run-status={run.latest?.status ?? 'none'}>
    {/* 注意：没有 'idle'。既有 data-workflow-run 用的就是 'none'|'running'|'succeeded'|'failed'|'cancelled'，
        两处若要落在同一元素上，只保留一个属性，别造两套值 */}
    {validation.issues.length === 0 ? null : (
      <button type="button" className="iv-chip iv-wf-issues"
        data-workflow-run-blocked="true" onClick={() => { setLogOpen(true) }}>
        <Icon name="alert" size={11} />{validation.issues.length} {t('canvasIssueUnit')}
      </button>
    )}
    <span className="iv-wf-runstate">
      <i className="iv-dot" aria-hidden="true" />
      {t(runStateKey(run.latest?.status))}
    </span>
    <button className="iv-btn iv-btn--primary" data-workflow-run-action="start" …>
      <Icon name="play" size={12} />{t('runStart')}
    </button>
    <button className="iv-btn iv-btn--sm" data-workflow-run-action="cancel" …>{t('runCancel')}</button>
    <button className="iv-btn iv-btn--sm" data-workflow-run-action="retry" …>{t('runRetry')}</button>
  </div>

  <button className="iv-btn iv-btn--sm" data-workflow-log-toggle …>{t('canvasLogs')}</button>
  <button className="iv-btn iv-btn--sm" data-workflow-action="maximize" …>…</button>
</div>
```

```tsx
// 节点条：拆两段，DOM 仍平铺在 .iv-pal 内（测试按属性取，不按顺序）
// 只映射 runnable + planned：NODE_CATALOG 共 16 条，另有 1 条 availability='external'
// 是有意不放进节点条的。**不要**改成「按 availability 通用分组」，那会多出第 16 个 chip，
// 直接打破 `data-workflow-palette-item` 的 length===15 断言。
<div className="iv-pal" data-workflow-palette="true">
  <span className="iv-pal-label">{t('canvasPaletteRunnable')} 12</span>
  {NODE_CATALOG.filter(s => s.availability === 'runnable').map(…)}
  <span className="iv-pal-label iv-pal-label--planned">{t('canvasPalettePlanned')} 3</span>
  {NODE_CATALOG.filter(s => s.availability === 'planned').map(…)}
</div>
```

```tsx
// 检查器抽屉（D3）：stage 负责定位，抽屉只做「滑入 + 覆盖右缘」
<div className="iv-wf-stage">
  <div className="iv-flow" data-workflow-flow="true">…</div>

  {selectedNodes.length === 0
    // 未选中：不渲染抽屉，空态留在画布中央（原 <p class="iv-meta"> 位置）
    ? <p className="iv-wf-empty" data-workflow-empty="true">
        <Icon name="flow" size={14} />
        <span>{t('canvasEmptyHint')}</span>
        <button className="iv-btn iv-btn--sm" onClick={() => setTemplateOpen(true)}>{t('templateMarket')}</button>
      </p>
    : <aside className="iv-wf-insp" role="complementary" aria-label={t('canvasParams')}
        tabIndex={-1} data-workflow-inspector-open="true">
        <div className="iv-wf-insp-head">
          <Icon name={NODE_ICONS[selectedNodes[0]!.data.kind]} size={13} />
          <span className="iv-ellipsis">{t('canvasParams')}</span>
          {selectedNodes.length > 1 ? <span className="iv-meta">{selectedNodes.length}</span> : null}
          {run?.onRunNode === undefined || selectedNodes.length !== 1 ? null : (
            <button className="iv-btn iv-btn--sm" data-workflow-action="run-node" …>
              <Icon name="play" size={11} />{t('canvasRunNode')}
            </button>
          )}
          {/* 收起 = 清空选中，语义与点画布空白一致（内部 setNodes 置 selected:false + setSelectedIds([])） */}
          <button className="iv-btn iv-btn--ghost iv-btn--sm" data-workflow-inspector-close="true"
            aria-label={t('canvasCloseInspector')} title={t('canvasCloseInspector')}
            onClick={closeInspector}>
            <Icon name="x" size={12} />
          </button>
        </div>
        <div className="iv-inspector" data-workflow-inspector={selectedNodes[0]!.id}>…</div>
      </aside>}
</div>
```

> 关键点：`data-workflow-inspector` 仍然**只在选中时存在**（挂在抽屉内部原 `.iv-inspector` 上），所以现有按属性取检查器的用例行为不变；新增的 `data-workflow-inspector-open` / `-close` 只用于契约断言。

### 2.4 交互细则

| 场景 | 行为 |
|------|------|
| 打开模板市场 | 浮层从按钮下方展开，画布**高度不变**；模板浮层层级（40）高于检查器抽屉（6）；点空白 / Esc 关闭 |
| 应用模板 | 浮层自动关闭（现有行为保留） |
| 未选中节点 | **不渲染抽屉**，画布中央一行引导（`flow` 图标 + 一句提示 + 「看模板」按钮）；画布宽度与高度都不变 |
| 选中节点 | 抽屉从右侧滑入（`translateX(100%) → 0`，`--iv-dur-2`），画布尺寸不变；关掉 `prefers-reduced-motion` 时直接出现 |
| 关闭抽屉 | 头部 `[✕]`；或点画布空白（现有 `onPaneClick` 已清选中）；或 Esc。三者都等价于「清空选中」，不额外记忆开合状态 |
| 多选节点 | 抽屉标题显示 `canvasSelected · N`；参数区展示首个节点，`run-node` 在多选时隐藏（现有行为） |
| 图里有 planned 节点 | 运行组左侧常显 `N 问题` 胶囊，点击展开日志并高亮该节点 |
| 运行中 | 状态点脉冲 + 「运行中」；开始按钮 `disabled`；取消可用 |
| 最大化 | 沿用现有 `iv-workflow--max`（`position:fixed;inset:0`），抽屉随 stage 一起全屏，宽度不变 |

### 2.5 图标

| 位置 | 图标 | 存在 |
|------|------|------|
| 运行组状态点 | 复用 `.iv-dot` | ✅ |
| 问题胶囊 | `alert` | ✅ **已存在**（`icons.tsx:32`） |
| 画布空态 | `flow` | ✅ |
| 抽屉收起 | `x` | ✅ |
| 节点条分组标题 | 无图标（纯小字，避免再加图形噪音） | — |

> `icons.tsx` 现有集合包含 `flow / sparkles / storyboard / copy / clipboard / trash / upload / download /
> play / pause / undo / redo / search / expand / shrink / script / sliders / x / alert / check / chevron` 等。
> **`alert` 确实存在（`icons.tsx:32`）**，直接用，不需要替代方案。

---

## 三、样式改造方案

### 3.1 范围与类名占用核对

| 文件 | 改造 |
|------|------|
| `workbench-style.ts` | **不动**（`.iv-pal` / `.iv-toolbar` / `.iv-flow` / `.iv-inspector` 保留基线） |
| `modern-theme.ts` | 增量约 40 条 |
| `WorkflowCanvas.tsx` | 工具条重排、节点条分组、检查器改抽屉 |
| `Workbench.tsx` | 模板市场浮层、pane 头标题 |

新增类名占用核对（均 0）：

| 类名 | 用途 |
|------|------|
| `.iv-wf-toolbar` / `.iv-wf-grp` | 工具条分三组 |
| `.iv-wf-runbar` / `.iv-wf-runstate` / `.iv-wf-issues` | 运行组与状态 |
| `.iv-wf-stage` / `.iv-wf-insp` / `.iv-wf-insp-head` | 画布定位容器 + 检查器抽屉 |
| `.iv-wf-empty` | 画布中央空态（未选中时） |
| `.iv-wf-drawer` | 模板市场浮层 |
| `.iv-pal-label` | 节点条分组标题 |

**不要动的名字**：`.iv-field`（节点参数行，`92px minmax(0,1fr)` 网格，工作流已占用）、
`.iv-node`、`.iv-flow`、`.iv-toolbar`、`.iv-inspector`——这四个是画布基线，改名会连带影响测试与基础表。

### 3.2 modern-theme.ts 新增规则（节选）

```css
/* 工具条：三组 + 运行组右对齐 */
.iv .iv-wf-toolbar{gap:var(--iv-sp-2);padding:4px 0;flex-wrap:wrap}
.iv .iv-wf-grp{display:flex;align-items:center;gap:var(--iv-sp-2);min-width:0}
.iv .iv-wf-runbar{display:flex;align-items:center;gap:var(--iv-sp-2);margin-left:auto;
  padding-left:var(--iv-sp-3);border-left:1px solid var(--iv-line)}
.iv .iv-wf-runstate{display:inline-flex;align-items:center;gap:var(--iv-sp-2);
  font-size:var(--iv-fs-micro);color:var(--iv-tx2);white-space:nowrap}
.iv .iv-wf-runbar[data-workflow-run-status="running"] .iv-dot{color:var(--iv-acc)}
.iv .iv-wf-runbar[data-workflow-run-status="failed"] .iv-dot{color:var(--iv-danger)}
.iv .iv-wf-runbar[data-workflow-run-status="succeeded"] .iv-dot{color:var(--iv-ok)}
/* 问题胶囊：warn 而非 danger——planned 是预期状态，不是错误。
   不给共享 .iv-chip 加变体，避免影响其它 pane */
.iv .iv-wf-issues{height:20px;padding:0 6px;cursor:pointer;color:var(--iv-warn);
  border-color:color-mix(in srgb,var(--iv-warn) 40%,transparent);
  background:color-mix(in srgb,var(--iv-warn) 12%,transparent)}
.iv .iv-wf-issues:hover{background:color-mix(in srgb,var(--iv-warn) 18%,transparent)}

/* 节点条：单行 + 分组标题 */
.iv .iv-pal{align-items:center;gap:var(--iv-sp-1) var(--iv-sp-2);padding:2px 0}
.iv .iv-pal-label{width:100%;font-size:var(--iv-fs-micro);color:var(--iv-tx3)}
.iv .iv-pal-label--planned{margin-top:var(--iv-sp-1)}
.iv .iv-pal-chip{height:22px}

/* 画布定位容器：抽屉浮在画布之上，不参与布局计算 */
.iv .iv-wf-stage{position:relative;display:flex;flex:1 1 auto;min-width:0;min-height:0}
.iv .iv-wf-stage>.iv-flow{flex:1 1 auto}

/* 检查器抽屉（D3）：仅选中时渲染，从右侧滑入，不占宽、不改画布高度 */
.iv .iv-wf-insp{position:absolute;top:0;right:0;bottom:0;width:min(300px,86%);
  z-index:var(--iv-z-drawer);     /* 6：新增语义 token，见 §3.3；不借 playhead */
  display:flex;flex-direction:column;gap:var(--iv-sp-2);overflow:auto;
  padding:var(--iv-sp-3);border:1px solid var(--iv-line);border-radius:var(--iv-r);
  background:var(--iv-surface);box-shadow:var(--iv-shadow-3);
  animation:iv-wf-slide-in var(--iv-dur-3) ease-out}
@keyframes iv-wf-slide-in{from{transform:translateX(14%);opacity:0}to{transform:none;opacity:1}}
.iv .iv-wf-insp-head{display:flex;align-items:center;gap:var(--iv-sp-2);min-width:0;
  padding-bottom:var(--iv-sp-2);border-bottom:1px solid var(--iv-line)}
.iv .iv-wf-insp-head>.iv-ellipsis{flex:1 1 auto}

/* 未选中：画布中央一行引导（绝对定位，不占行高） */
.iv .iv-wf-stage>.iv-wf-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  display:inline-flex;align-items:center;gap:var(--iv-sp-2);margin:0;white-space:nowrap;
  font-size:var(--iv-fs-meta);color:var(--iv-tx3);pointer-events:none}
.iv .iv-wf-stage>.iv-wf-empty .iv-btn{pointer-events:auto}

/* 模板市场浮层（D2）：盖住画布右上，层级高于检查器抽屉 */
.iv .iv-wf-drawer{position:absolute;right:0;top:100%;z-index:var(--iv-z-tip);
  width:min(520px,92%);max-height:60vh;overflow:auto;padding:var(--iv-sp-4);
  border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);box-shadow:var(--iv-shadow-3)}

@media (prefers-reduced-motion:reduce){.iv .iv-wf-insp{animation:none}}
```

> 浮层依赖父级定位：pane 头需要 `position:relative`（`.iv-pane-head` 已为 flex，可在本批加一条 `.iv .iv-pane--canvas>.iv-pane-head{position:relative}`）。

### 3.3 约束

| 约束 | 说明 |
|------|------|
| 画布 DOM 顺序 | 节点条 / 工具条可重排，但**每个 `data-*` 属性必须原地保留** |
| 15 个节点 chip 常在 DOM | 不得折叠成弹出层、不得 `display:none`（测试用 `getByRole` 取元素，隐藏即取不到） |
| 不新增 token | **例外一条**：新增 `--iv-z-drawer:6`（语义层级）。**不要**借 `--iv-z-playhead`——那是时间轴语义，改播放头层级会连带改抽屉。其余用既有的 `--iv-shadow-3` / `--iv-z-tip`(40) / `--iv-z-overlay`(60) |
| 抽屉不参与布局 | `.iv-wf-insp` 必须 `position:absolute`。若误用 `grid`/`flex` 占位，就退回「画布变窄」，D3 的选择作废 |
| 抽屉层级 | 抽屉 6 < 模板浮层 40 < 最大化 60（`.iv-wf-insp` 与 xyflow 的 `.react-flow__panel` 同为 5 会形成平级竞争，靠 DOM 顺序决胜，脆弱） |
| 双主题 | 浮层底色用 `--iv-surface`，不烧白/黑 |
| 动效 | 浮层不加位移动画，避免与 xyflow 视口变化叠加造成眩晕 |

---

## 四、国际化（新增 10 个 key，其中 5 个运行态可先 grep 去重）

| key | en | zh-CN |
|-----|----|-------|
| `canvasPaletteRunnable` | Available | 可用 |
| `canvasPalettePlanned` | Planned | 规划中 |
| `canvasIssueUnit` | issues | 个问题 |
| `canvasEmptyHint` | Drag in a node above, or start from a template | 从上方拖入节点，或从模板开始 |
| `canvasCloseInspector` | Close inspector | 收起检查器 |
| `canvasRunIdle` | Ready | 就绪 |
| `canvasRunRunning` | Running | 运行中 |
| `canvasRunSucceeded` | Done | 已完成 |
| `canvasRunFailed` | Failed | 已失败 |
| `canvasRunCancelled` | Cancelled | 已取消 |

（10 个：8 个界面文案 + 2 个空态/收起。运行态 5 个若与现有 `runStart/runCancel/runRetry` 或 `iv-chip` 文案重复，实施时先 grep 去重，实际新增可能少 3–5 个。）

---

## 五、测试影响预估

| 文件 | 用例 | 依赖 | 影响 |
|------|------|------|------|
| `tests/workflow-canvas.client.test.tsx` | 16 | 节点条 15 项（62-63 行）、planned 3 项且**不禁用**（65-72 行）、`data-workflow-action`（7 处）、日志开关（322-330）、最大化（337）、检查器内 `delete-node` / run-node | **预期 0 失败**：`data-workflow-inspector` 仍挂在选中时的 `.iv-inspector` 上，属性不动；但「planned 不禁用」必须继续满足 |
| `tests/client-template-market.test.tsx` | 2 | `data-workflow-template-toggle`、`data-workflow-template-market`、`data-workflow-template="<id>"` | **0 失败**（浮层仍在 DOM） |
| `tests/workflow-templates.test.ts` / `workflow-catalog.test.ts` | 纯函数 | 无 UI | 0 |
| `tests/client-design-system.test.tsx` | 31 | 若加 `.iv-wf-*` 需补断言 | 加 1 条 |
| `tests/client-modern-theme.test.tsx` | 14 | 新规则需补 1–2 条 | 加 1 条 |

**合计**：0 个既有用例需要改写——只要守住「15 个 chip 常在 DOM 且不禁用」和「`data-workflow-inspector` 仍只在选中时存在」。

两个易踩的隐藏坑：

1. **`15` 是筛选结果，不是 catalog 长度**。`NODE_CATALOG` 共 16 条，其中 1 条 `availability='external'` 有意不进节点条。把节点条改成「按 availability 通用分组」会变成 16 个 chip，`length===15` 立刻失败——必须继续只映射 `runnable` + `planned`。
2. **`data-workflow-run-status` 的缺省值是 `'none'`**，与既有 `data-workflow-run` 同一套枚举。写成 `'idle'` 会让「就绪」态落不到任何 CSS 分支（CSS 里只写了 running/failed/succeeded），状态点会退回继承色。

> 抽屉方案额外注意：用例 `getByRole('button', { name: 'Delete' })` 之类依赖「检查器可见」。jsdom 不执行 `animation`、也不做 `position:absolute` 的视口裁剪，所以抽屉滑入的初始 transform **不会**让元素在测试里不可见——但**不要**用 `visibility:hidden` 或 `display:none` 做入场动画，那会让 3 条用例在 jsdom 下取不到元素。

---

## 六、实施步骤

### Step 0 — 体积基线留证
当前：入口 24,231 B（88%）、总产物 1,490,659 B（106%，超 86,659 B）。**门禁本红，先留证。**

### Step 1 — 工具条重排（`WorkflowCanvas.tsx:676-781`）
分三组、运行组右移、加状态点与问题胶囊。验证：`workflow-canvas.client` 16 用例。

### Step 2 — 节点条分组（`633-673`）
加两个分组标题；`style={{width:'100%'}}` 删除，改类名。验证：同文件「lists every catalog node」用例。

### Step 3 — 检查器改抽屉（`783-812`）
用 `.iv-wf-stage` 包住 `.iv-flow` 与抽屉；未选中渲染 `.iv-wf-empty`（画布中央），选中渲染 `aside.iv-wf-insp`；抽屉加 `[✕]` 与 `data-workflow-inspector-close`；`data-workflow-inspector` 保持在内部 `.iv-inspector` 上。
验证：`delete-node` / `run-node` / `maximize` 三条用例；真机确认选中前后 `.iv-flow` 的 `getBoundingClientRect()` 宽高**完全不变**。

### Step 4 — 模板市场浮层（`Workbench.tsx:3875-3921`）
加 `.iv-wf-drawer`，父级 `position:relative`；Esc / 点外部关闭。验证：`client-template-market` 2 用例。

### Step 5 — 样式 + 契约
`modern-theme.ts` 增量；补 2 条契约；typecheck + vitest + `check-bundle`。

---

## 七、不在本次范围

| 项目 | 说明 |
|------|------|
| 节点卡内部布局（参数摘要、端口标签） | 影响 xyflow 量尺寸逻辑，单独排期 |
| 运行历史（`iv-run-*`）改版 | 已可用，改动收益低于风险 |
| 日志抽屉改版 | 现有「收起时画布独占高度」的设计是对的 |
| planned 节点「不可运行」的交互反转 | 违反 `T3-2`，需产品重新决策，不在 UI 批次内 |
| 画布模板缩略图 | 需要服务端渲染节点图，无接口 |

---

## 八、验证清单

- [ ] 画布页：三层合计高度 **≥1200px 宽 ≤110px**、**900px 宽 ≤130px**（当前约 174px）；用 `getBoundingClientRect().height` 量，不靠目测
- [ ] 工具条：三组语义清晰，运行组在最右且与其它组有 1px 分隔
- [ ] 运行状态：就绪 / 运行中 / 已完成 / 已失败 / 已取消 五种状态文案与色点正确；**缺省 `data-workflow-run-status="none"` 时色点为中性色**
- [ ] 含 planned 节点时：`N 问题` 胶囊出现且是 **warn 色**（不是 danger），点击展开日志，开始运行禁用且有 title 说明
- [ ] 模板市场：打开时画布高度不变（可用 `data-workflow-flow` 的 `getBoundingClientRect().height` 前后对比）
- [ ] 检查器：未选中时**不存在抽屉**、画布中央一行引导；选中时从右侧滑出；选中/取消选中前后 `.iv-flow` 的宽高**一像素不变**
- [ ] 抽屉 `[✕]` / 点画布空白 / Esc 都能收起，且收起后节点不再是选中态
- [ ] 抽屉打开后焦点移入（`aside` 可聚焦），Esc 关闭后焦点回到画布；`role="complementary"` + `aria-label` 可被读屏宣布
- [ ] 抽屉层级为 `--iv-z-drawer:6`：不被 xyflow 的缩放控件压住，也不因播放头层级调整而失效
- [ ] 抽屉出现时，位于画布右缘的节点仍可通过拖动或 `fitView` 看到（不被永久遮死）
- [ ] 最大化：抽屉随 stage 一起全屏，退出后恢复原宽度
- [ ] 15 个节点 chip 全部可点，planned 仍可放置（`T3-2`）
- [ ] 浅色 / 深色主题；窄窗口（<1100px）抽屉宽 `min(300px,86%)`，不挤压画布
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm exec vitest run tests/workflow-canvas.client.test.tsx tests/client-template-market.test.tsx` 全绿
- [ ] `node scripts/check-bundle-size.mjs`：总产物增量 ≤ 6 KB

---

## 九、事实核对（v1.0 复核）

### 9.1 已核实

| # | 事实 | 证据 |
|---|------|------|
| 1 | 节点条 15 项 = 12 可用 + 3 规划 | `workbench/workflow.ts:135-215`；测试 `workflow-canvas.client.test.tsx:62-72` |
| 2 | 工具条 14 按钮 + 1 下拉 + 计数，单一 `.iv-toolbar` | `WorkflowCanvas.tsx:676-781` |
| 3 | 模板市场是内联块而非浮层 | `Workbench.tsx:3875-3921`（位于 pane 头与 `WorkflowCanvas` 之间） |
| 4 | 检查器条件渲染且位于画布下方 | `WorkflowCanvas.tsx:809-812` |
| 5 | planned 节点会让**整张图**校验失败 | `workbench/workflow.ts:489-495` + `WorkflowCanvas.tsx:750`（`disabled={!validation.ok}`） |
| 6 | 画布 pane 最小高度 `clamp(480px, calc(100vh-200px), 980px)` | `workbench-style.ts:386` |
| 7 | `alert` 图标存在 | `icons.tsx:32` |
| 8 | 节点条只映射 `runnable` + `planned`，`external` 有意排除；catalog 共 16 条 | `WorkflowCanvas.tsx:635` + 测试 `length===15` |
| 9 | 运行态枚举无 `idle`：`running / succeeded / failed / cancelled` | `workbench/workflow.ts` 的 `WorkflowRunRecord` |

### 9.2 未核实

| # | 待确认项 | 影响 |
|---|----------|------|
| ~~1~~ | ~~`icons.tsx` 是否有 `alert`~~ | **已核实存在**（`icons.tsx:32`），无需替代 |
| 2 | 窄窗口（<1100px）下 xyflow 的 `fitView` 行为 | 检查器折到底部后画布变矮，可能需要触发一次 `fitView` |
| 3 | 运行态 key 是否与现有 chip 文案重复 | 决定新增 5 个还是复用 |
| 4 | 抽屉打开时是否需要 focus 移入 | 已按 §2.3 加 `tabIndex={-1}` + `role="complementary"`；实施时需在打开后 `focus()`、Esc 关闭后把焦点还给画布，否则读屏用户不知道抽屉出现了 |

### 9.3 已推翻的假设（这三条差点写进方案）

| 假设 | 为什么不能这么做 |
|------|------------------|
| 「planned 节点应从节点条里禁用或收起」 | **违反 `T3-2`**。产品明确决定：planned 可放入画布、可保存、不可运行（`workflow.ts:9`、测试 68-71 行注释「`T3-2`：planned 可以放进图并保存，所以按钮**不是**禁用」）。改成禁用会让 2 个用例失效，并回退一个已拍板的产品决策 |
| 「把节点条收成『＋ 添加节点』弹出面板，省 52px」 | 测试第 62 行直接 `querySelectorAll('[data-workflow-palette-item]')` 断言长度 15；第 77 行用 `getByRole('button', { name: 'Add lip-sync' })` 点击。面板收起时元素不可访问（`getByRole` 默认排除隐藏元素），两条用例同时挂 |
| 「检查器改成『未选中时不渲染』就能省空间」 | 半对半错。条件渲染本身没问题（D3 的抽屉正是未选中不渲染），**错的是它仍插在文档流里**：选中时突然占掉 200+px 高度，画布被压扁。解决方向是「脱离文档流」，不是「渲染与否」 |

---

## 十、风险与待拍板

1. **画布高度收益是可量化的**（174px → ≥1200px 宽约 106px，900px 宽约 128px），但需要接受工具条在窄窗口仍会换行到两排。
2. **D3 抽屉的两个真实风险**：
   - **遮挡右缘节点**。抽屉宽 `min(300px,86%)` 覆盖画布右缘，若用户选中的节点正好在那里，节点会被盖住。缓解：① 抽屉只覆盖到 `stage` 右缘，不遮工具栏与节点条；② `[✕]` / 点空白 / Esc 三种收起方式都很轻；③ 真机若确认遮挡严重，再补一步「选中时 `setCenter` 向左偏移 `width/2 - 150px`」——**先不做，避免每次选中都动视口**。
   - **层级**。抽屉 6（`--iv-z-drawer`）、模板浮层 40、最大化 60；三者不可互换，写进 §3.3 约束。**不要沿用 5**：那是 `--iv-z-playhead` 的值，既与 xyflow 控件平级，也会被时间轴的层级调整连带影响。
3. **`T3-2` 的提示改进**是本方案里唯一「改产品行为观感」的部分（加问题胶囊），但它不改决策、只缩短因果距离。
4. 体积：预计 +4～6 KB raw。基线抬不抬仍是同一个未决问题（已悬三轮）。

---

## 十一、决策记录

| 日期 | 决策 | 结论 | 依据 |
|------|------|------|------|
| 2026-11-26 | D3 属性检查器 | **抽屉式：仅选中时从右侧滑出**（废弃「右侧常驻 264px 列」） | ① 画布宽度是节点图的稀缺资源，常驻 264px 会永久吃掉 1/3（800px 窗口）；② 抽屉只覆盖右缘、不改画布尺寸，选中/取消不再引起任何重排；③ 未选中不渲染 ⇒ 不再需要「常驻空态」这块灰字死区；④ 与 D2 模板浮层同一套「浮层不参与布局」的心智模型 |
| 2026-11-26 | 抽屉关闭语义 | **= 清空选中**（不额外记忆开合状态） | 与 xyflow 点画布空白的行为一致；避免出现「有选中但抽屉关着」的第三态 |

> 未决：D1（**三层压缩**，不删 pane 头）、D2（模板浮层）、D4（运行组右置）、D5（问题胶囊用 warn）、D6（planned 保持可放置）——均按原建议执行，无备选冲突。

---

## 十二、v1.2 复核：可行性与必修项

### 12.1 结论

**可行，且是三份方案里风险最低的一份**（大部分改造是「包一层 + 挪位置」，不改数据流）。v1.0 有 4 处需要纠正，其中 1 处会让测试直接挂。

### 12.2 必修项

| # | 级别 | 问题 | 修订 |
|---|------|------|------|
| M1 | **P1** | 「合并为两层」与 §2.1 目标图自相矛盾——图里明明保留了 pane 头（三层）。若真按「两层」实施，会删掉三个 pane 共用的 `.iv-pane-head`，与另两份方案分叉 | 改为「三层保留、压到 ≤130px」，收益已在 106px 达成，不需要动共用骨架（D1 行、§2.1 要点 1、§3.3、§十 已同步） |
| M2 | **P1** | 节点条若「按 availability 通用分组」会渲染第 16 个 `external` chip，`length===15` 用例直接挂 | 伪码保留 `runnable` / `planned` 两条显式 filter，并把「external 有意排除」写进注释与 §9.1 |
| M3 | P2 | `data-workflow-run-status` 用 `'idle'`，但既有枚举是 `none/running/succeeded/failed/cancelled`，且没有 `idle` 分支的 CSS | 缺省值改 `'none'`；若与既有 `data-workflow-run` 同元素，只留一个属性 |
| M4 | P2 | 抽屉 `z-index: var(--iv-z-playhead)`（5）语义错位、且与 xyflow 控件平级 | 新增 `--iv-z-drawer:6`（唯一新增 token）；§3.3「不新增 token」补这一条例外 |
| M5 | P2 | 问题胶囊用 `--danger` 表达「planned 不可运行」——把预期状态渲染成错误 | 改 warn 色；不给共享 `.iv-chip` 加变体，只在 `.iv-wf-issues` 内着色 |
| M6 | P3 | `alert` 图标标为「需核对」 | 已核实存在（`icons.tsx:32`），直接用 |
| M7 | P3 | 抽屉没有可访问名称，打开后焦点不移动 | `role="complementary"` + `aria-label` + `tabIndex={-1}`，打开 `focus()`、Esc 还焦点给画布 |

### 12.3 与另两份方案共享的原语

pane 头、分段/标签、`<details>` 折叠、状态胶囊按 `SCRIPT-PANE-REDESIGN.md` §11.3。本方案的 `iv-wf-*` 只保留画布独有（stage 定位、抽屉、节点条分组、运行组）。**不要**为画布另建头骨架或分段控件——这正是 M1 的教训。

---

## 十三、实施记录（2026-11-26）

| 决策 | 状态 | 落地 |
|------|------|------|
| D1 三层压缩 | 已达成（以另一种形态） | 上一轮已把「节点条」换成**左侧分组节点库**（可用 12 / 规划 3，15 项常在 DOM）；本轮 chrome = pane 头（约 34）+ 单行工具条（约 26），无需再压节点条 |
| D2 模板市场浮层 | ✅ | `.iv-wf-drawer` 绝对定位覆盖画布右上，`role=dialog` + `aria-controls`，Esc / 点外关闭；画布高度不变 |
| D3 检查器抽屉 | ✅ | 仅选中时渲染的浮层 + `role=complementary` + `aria-label` + `tabIndex=-1`；焦点移入 / 收起还焦点；宽度 `min(300px,86%)`；滑入动效 |
| D4 运行组右置 | ✅ | `.iv-wf-runbar` 独立分组 + 状态点 + 文案；`data-workflow-run-status` 缺省 `none` |
| D5 问题胶囊 | ✅ | `N 个问题` 胶囊贴运行组，warn 色，点击展开日志 |
| D6 planned 提示 | ✅ | 放置后状态条一次性提示，可收起；planned 仍可放置（`T3-2` 未动） |

### 与方案的偏差

1. **节点条未回退成横条**：D1 的「节点条两行」是旧布局的压缩手段；上一轮已用左侧节点库达到同样的分组与更少的高度占用，横条会回退体验。15 项与 `data-workflow-palette-item` 契约保持不变。
2. **没有新增 `--iv-z-drawer`**：上一轮已引入 `--iv-z-canvas-hud:6` / `--iv-z-canvas-pop:8` 承担画布浮层语义，抽屉用 8（> xyflow 控件 5、< 模板浮层 40），再加一个同义 token 只会制造两套口径。
3. **节点卡左侧色条未加**：卡片标题栏已按分组着色（输入/分镜/生成/交付），再叠一条 3px 色条属于重复编码。
4. **体积 +7.9 KB raw**，略超 +≤6 KB 预估；增量来自运行组/胶囊/抽屉可访问性与浮层样式。

### 验证

- `pnpm run lint` 通过；全量 1367 例 1356 通过（6 例既有失败：版本号漂移 / Node 25 localStorage）。
- 新增 6 例：运行态文案与 `data-workflow-run-status`、问题胶囊 warn + 展开日志、planned 一次性提示、抽屉 `role/aria/tabIndex` 与 Esc、模板浮层 `dialog/Esc/aria-controls`。
- 未做真机几何复核：验证时 App 被关闭，CDP 目标消失；`getBoundingClientRect` 的「打开浮层前后画布高度不变」建议在真机补一次。


### 真机复核补修（同批，2026-11-26）

- **D2 浮层重定位**：按「pane 顶部 + 44px」定位时，浮层打开会盖住工具条右侧的运行组与问题胶囊（真机截图确认）。改为由 `WorkflowCanvas` 把 `templateMarket` 渲染进 `.iv-flow`（`top:8px; right:8px; max-height:calc(100% - 16px)`），浮层只覆盖画布。实测 `data-workflow-flow` 在浮层开关前后保持 `1003×726`。
- **M5 扩展到状态条与日志按钮**：planned-only 的校验问题用 `--warn`（`data-workflow-status-tone="warn"`），真错误仍 danger；日志按钮上的计数同步改 warn。
- **节点卡分类色条**：补上 §2.2 的「左侧 3px 分类色条」（纯 CSS `::before`，不改 DOM）。
- 真机几何：pane 头 28px + 工具条 28px = **56px chrome**（目标 ≤110 / 窄窗 ≤130）；抽屉 300×262 覆盖画布右缘，`.iv-flow` 宽度不变；Esc 收起浮层与抽屉均生效。
