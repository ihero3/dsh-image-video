# 剧本生成页重新设计方案

> 版本：v1.1 · 2026-11-26 · 状态：可实施（已按 §十一 复核修订）· **尚未实施**
>
> 基线：`QUICK-CREATE-REDESIGN.md` v1.2.4（快速创作改造已落地并入库，主题戳 `2026-11-26.6`）。
> 本方案沿用它的五条方法论：① 先删装饰层，再谈配色；② 新类名先查占用（`.iv-field` 撞工作流节点参数的教训）；
> ③ 图标一律 `<Icon>`，不用 emoji；④ 测试影响精确到「文件 + 用例数」；⑤ 体积门禁开工前先留证。

---

## 决策确认（待拍板）

| # | 决策项 | 建议 | 若不采纳的代价 |
|---|--------|------|----------------|
| D1 | 四个分区 tab（剧本分镜 / 素材提取 / 音色 / 轨迹） | 移入 pane 头部右侧，**复用既有 `.iv-quick-tabs` + `.iv-tab`**（不新建 `.iv-sc-seg`），每项前置图标 | 保持现状：分段外观**已成立**（`modern-theme.ts:48/54-56`），实际缺的只有图标与完整 tab 语义 |
| D2 | module 折叠层（`1 剧本 → 分镜` / `2 本集工作区`） | **删除编号徽标与折叠按钮**，两层内容直接平铺 | 保留：进页面先看到两个折叠头，真正的剧本框又低一屏 |
| D3 | 本集工作区的剧本长框（`rows=10`） | 收进「分集剧本」折叠区，**默认折叠**；分段为空时自动展开 | 保留：与下面的分段落列表重复占位，首屏被文本框吃满 |
| D4 | 分段卡的 5 个下拉（图像/视频/文本模型、Skill、时长） | 收进段内「高级设置」，**默认折叠**，折叠态回显当前值 | 保留：每段 5 个下拉 + 5 个输入，三段就是一面表单墙 |
| D5 | 顶部三个 ghost 按钮（同步工作流 / 导出 / 导入） | 收进 **`<details class="iv-sc-more">`**（原生折叠，不是条件渲染）的溢出菜单，只留「导出」；同步工作流加确认 | 保留：三个等权按钮与「集选择器」「保存态」抢同一行 |
| D6 | 剧本输入框样式 | 去掉内联 `padding`（**圆角已是 10px**，见 §1.3），补 `iv-textarea` 语义类 | 保留：内边距仍是 6px/8px，且靠 `!important` 补丁维持圆角，属卫生问题 |

---

## 一、现状诊断

### 1.1 结构层级：四层才到输入框

```
iv-pane[data-workbench-pane=paneScript]        ← 无 pane 头（没有标题、没有图标）
 └─ 分区 tab ×4（iv-quick-tabs + iv-btn--acc）  ← 第一层：整行四个主按钮
     └─ iv-modules                              ← 第二层：装饰容器
         └─ iv-module ×2（"1 剧本→分镜" / "2 本集工作区"，可折叠）
             └─ PipelineCard（iv-card）→ 剧本输入框
             └─ EpisodeWorkspace（iv-sb）→ 集选择 → 剧本 → 分段 → 分镜
```

证据：`src/client/Workbench.tsx:3655`（pane 起始，无 `iv-pane--compact`、无 `iv-pane-head`）、
`3658`（tab 容器）、`3676`（`iv-modules`）、`3678/3715`（两个 module，`iv-module-n` 分别为 `1`/`2`）。

**问题**：与快速创作 v1.2 删掉的是同一个东西——带编号、带白话说明的可折叠容器。快速创作已经证明这层只有装饰价值；剧本页还留着它，于是「写剧本」这件最该先做的事，被压在两层容器之下。

### 1.2 视觉权重：分段外观已成立，缺的是「位置」与「图标」

```tsx
// Workbench.tsx:3664-3666
aria-selected={scriptTab === tab.key}
className={`iv-btn${scriptTab === tab.key ? ' iv-btn--acc' : ''}`}
style={{ flex: 1 }}
```

**纠正 v1.0 的判断**：这四个 tab 现在**并不是**「四个并列主操作」。

```css
/* modern-theme.ts:48 —— 容器已是浅底整组分段（gap 3 / padding 3 / radius 11 / 5% 灰底） */
.iv .iv-tabs,.iv .iv-quick-tabs,...{gap:3px;padding:3px;border:0;border-radius:11px;background:color-mix(...5%...)}
/* :54 —— 未选中项被拉平：透明底、tx2 字色、无阴影 */
.iv .iv-quick-tabs .iv-btn{background:transparent;color:var(--iv-tx2);box-shadow:none}
/* :56 —— 选中项是一块浮起的 panel，不是 acc 实心 */
.iv .iv-quick-tabs .iv-btn--acc{background:var(--iv-panel);color:var(--iv-tx);box-shadow:0 1px 3px ...}
```

也就是说「胶囊分段」这个视觉**已经在线上生效**；`iv-btn--acc` 在 `.iv-quick-tabs` 作用域里已被改写成「浮起的选中块」。

真正还缺三件事：

1. **没有 pane 头**——四个 tab 直接顶在 pane 顶部，与标题没有从属关系（§1.5）；
2. **纯文字无图标**——与「内容生产 / 提取提示词」同一条意见；
3. **tab 语义只做了一半**——容器有 `role="tablist"`、按钮有 `role="tab"` + `aria-selected`，但没有 `aria-controls`、没有 roving `tabindex`、没有 ←/→ 键。半套 ARIA 比不用 ARIA 更糟（读屏会宣布「标签页」却不响应键盘）。

因此 D1 的落点改为：**`.iv-quick-tabs` 容器与 `.iv-btn` 类名换成既有的 `.iv-tab`**（`:51` 已提供选中态浮起 + `.iv-ico` 变色），只新增图标与补齐 tab 键盘模型——样式增量从 6 条降为 0 条。

### 1.3 表单语义：`iv-meta` 当 label，内联 style 绕开主题

| 位置 | 现状 | 证据 |
|------|------|------|
| 剧本输入标签 | `<span className="iv-meta">剧本</span>`，11px 灰字 | `SharedScriptInput.tsx:70` |
| 剧本输入框 | `className="iv-input"` + `rows={6}` + `style={{ resize, padding:'6px 8px', borderRadius:'6px' }}` | `SharedScriptInput.tsx:71-81` |
| 输入块容器 | `style={{ display:'grid', gap:'var(--iv-sp-4)' }}` | `SharedScriptInput.tsx:69` |
| 三级数量输入 | 三个 `style={{ width:'80px' }}` | `PipelineCard.tsx:219/233/247` |
| 主按钮 | `style={{ minWidth:'132px' }}`，动作行 `style={{ justifyContent:'flex-end' }}` | `PipelineCard.tsx:282/287` |
| 已导入文件 | 关闭按钮写字面量 `×`，不是 `<Icon name="x">` | `SharedScriptInput.tsx:136-145` |

**纠正 v1.0 的两处口径**：

- `iv-input` 在当前主题里是 **36px 高**（`modern-theme.ts:75`），不是 23px；23px 是 `workbench-style.ts:261` 的历史基线，已被覆盖。
- 「6px 圆角」**在视觉上已不存在**：`modern-theme.ts:81` 给了 `textarea.iv-input, .iv-textarea { border-radius:10px; min-height:84px; padding:10px 12px }`，并且 `:122` 有一条 `textarea[style*="border-radius"]{border-radius:10px!important}` 专门兜住这类内联写法。所以圆角是 10px，**内边距仍是内联的 6px/8px**（inline 优先级高于普通规则，只有 `!important` 能压过）。

结论：D6 不是修视觉，而是**拆掉那条 `!important` 补丁**——让新代码不再依赖「用 `[style*=]` 属性选择器打补丁」这种脆弱机制。优先级从 P1 降为 P3。

### 1.4 本集工作区：每段 5 个下拉 + 5 个输入

`EpisodeWorkspace.tsx` 展开态（`segmentBody`，1000–1530 行）静态统计：**5 个 `<select>` + 5 个 `<input>/<textarea>`**——图像模型、视频模型、文本模型、导演 Skill、时长，加上提示词、引用块、动作行、分镜列表。

一集 3 段 = 15 个下拉同屏，且每段都是**默认展开**。当前唯一的减负手段是折叠（`collapsedIds`），但折叠态只剩「段号 + 提示词预览」，等于没有摘要。

顶部一行还挤了 6 个元素：

```
[集选择器] [总时长 00:42] [同步工作流] [导出] [导入] [保存态]   ← 1539-1637
```

三个 ghost 按钮权限、频率、风险完全不同（同步会改画布、导出写盘、导入覆盖集），却同权重并排。

### 1.5 三种 pane 三种头

| pane | 是否有头 | 标题来源 |
|------|----------|----------|
| 快速创作 | 无头 | 顶部 `iv-modes` 模式导航已写「快速创作」 |
| **剧本生成** | **无头** | 只有顶部导航 |
| 专业工作流 | 有头（图标 + 标题 + 模板市场 + 保存态） | 头部标题与导航重复 |
| 时间轴精剪 | 有头（图标 + 标题 + 总时长 + 两个开关 + 保存态） | 同上 |

同一个应用里，有的 pane 有标题条有的没有；有标题条的又把导航里已有的名字再写一遍。这是本轮三个模块共同的「骨架不一致」，不是剧本页独有的问题，但剧本页是唯一**连头都没有**的那个。

---

## 二、设计方案

### 2.1 目标形态

```
┌─ iv-pane ──────────────────────────────────────────────────┐
│ [script] 剧本生成          [剧本分镜][素材提取][音色][轨迹] │ ← 头部：图标+标题，右侧胶囊分段
├────────────────────────────────────────────────────────────┤
│                                                            │
│  剧本                                        0 字  [导入]   │ ← 结构化 label + 字数 + ghost 导入
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 雨夜街头，林夏撑伞走来。老周在屋檐下等她……            │  │ ← rows=6，主题化圆角
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [sliders] 生成设置                       自动 · 自动 · 自动│ ← 折叠摘要（3 个数量 + 模型 + 技能）
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 集 [自动] 每集段 [自动] 每段镜 [自动]                 │  │
│  │ 文本模型 [默认规则 ▾]   导演技能 [＋ 选择 ▾]          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                    [sparkles 生成剧本]      │ ← 唯一主按钮，贴右
│                                                            │
│  ── 本集工作区 ─────────────────────────────────────────  │ ← 分段标题（不是折叠容器）
│  [第 3 集 ▾]  3 段 · 12 镜 · 00:42        [导出] [⋯]       │
│                                                            │
│  📄 分集剧本（折叠，默认收起）                        ▸    │
│                                                            │
│  [sliders 文本模型: 默认规则]  [sparkles 开始分段] [＋ 分段]│
│                                                            │
│  ① 第 1 段   8s · 3 镜   「林夏撑伞走来，雨幕反光……」  ▸  │ ← 折叠态：一行摘要
│  ② 第 2 段   6s · 2 镜   「老周抬头，屋檐滴水」         ▾  │ ← 展开态：提示词 + 引用 + 高级设置
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 提示词 [........................................]     │  │
│  │ 引用 [@1 老周 ✕] [＋]                                │  │
│  │ [sliders] 模型与时长  图像 Wanx · 视频 Wan · 10s      │  │ ← 折叠
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 2.2 结构改造清单

| 元素 | 现状 | 改造 | 保留的契约 |
|------|------|------|------------|
| `section` 外层 | 无头 | 加 `iv-pane-head`：`iv-pane-tile`（`Icon name="script"`）+ `iv-pane-title` + 右侧分段控件 | `data-workbench-pane="paneScript"` |
| 四个分区 tab | `iv-quick-tabs` + 四个 `iv-btn`（容器已是分段底） | 保留 `iv-quick-tabs` 容器；按钮类名 `iv-btn` → **既有 `iv-tab`**；每项前置 `<Icon>`；补 `id` / `aria-controls` / roving `tabIndex` / ←→ 键 | `data-script-tabs`、`data-script-tab="split|extract|voice|motion"`、`aria-selected` |
| `iv-modules` 容器 | 包裹两个 module | 删除容器，两个分区用**小标题**分隔 | `data-module="pipeline"`、`data-module="episode"` 保留 |
| module 头（编号 + 说明 + 折叠） | `iv-module-head` + `iv-module-n` + `data-module-toggle` | **删除**；`data-module-title` 用 `hidden` span 承载（与快速创作同法） | `data-module-body="pipeline"` 保留但恒展开 |
| 剧本输入 | `iv-meta` + 内联 style 的 `iv-input` | `.iv-sc-io` 块：label 行（标题 + 字数 + 导入）+ `iv-input iv-textarea` + 已导入 chips | `data-pipeline-script`、`data-pipeline-import`、`data-pipeline-imported-item`、`data-pipeline-script-chars` |
| 三级数量 + 模型 + 技能 | 五个控件挤一行，无标签行 | 收进 `<details class="iv-sc-adv">`，标题行回显**实际生效值**（如 `6 集 · 3 段 · 4 镜 · 默认规则`）；删掉 `width:80px` 内联值，改 `.iv-sc-num` 承载 | `data-pipeline-plan-episodes/segments/shots`、`data-pipeline-text-model`、`data-pipeline-skill` |
| 生成按钮 | `iv-btn--action--primary`，`minWidth:132` | 保留类名，内联宽度移到 `.iv-sc-generate{min-width:132px}`（**不能直接删**，否则三列变满宽） | `data-pipeline-script-generate` |
| 本集工作区头 | 6 个元素同行 | 集选择器 + 摘要（段/镜/时长）+ 导出 + `⋯` 溢出菜单 | `data-episode-actions`、`data-episode-export`、`data-episode-import`、`data-episode-sync-workflow`、`data-episode-script-state` |
| 分集剧本 | 常驻 `rows=10` textarea | `<details class="iv-sc-script">` 默认折叠，展开时保留原 textarea | `data-episode-script`、`data-episode-script-jump` |
| 分段卡折叠态 | 段名 + 提示词预览 | 段序号 + 时长 + 镜数 + 提示词摘要（单行省略） | `data-segment`、`data-segment-head`、`data-segment-name` |
| 分段卡展开态 | 提示词 + 5 下拉 + 引用 + 动作 + 分镜 | 提示词 → 引用 → `<details>` 高级设置（5 个控件）→ 动作行 → 分镜 | `data-segment-refs`、`data-shot`、`data-segment-storyboard` 及全部 `aria-label` |

### 2.3 伪代码

```tsx
// BEFORE（Workbench.tsx:3655）
<section className="iv-pane" data-workbench-pane="paneScript">
  <PaneBoundary label={t('modeScript')} t={t}>
    <div className="iv-quick-tabs" data-script-tabs="true">
      {SCRIPT_TABS.map(tab => <button className={`iv-btn${active ? ' iv-btn--acc' : ''}`} style={{ flex: 1 }} />)}
    </div>
    <div className="iv-modules">
      <section className="iv-module" data-module="pipeline">
        <button className="iv-module-head" data-module-toggle="pipeline">
          <span className="iv-module-n">1</span> …
        </button>
        <div className="iv-module-body" data-module-body="pipeline" hidden={!openModules.pipeline}>
          <PipelineCard … />
```

```tsx
// AFTER
<section className="iv-pane" data-workbench-pane="paneScript">
  <PaneBoundary label={t('modeScript')} t={t}>
    <div className="iv-pane-head">
      <span className="iv-pane-tile"><Icon name="script" size={13} /></span>
      <h3 className="iv-pane-title">{t('modeScript')}</h3>
      {/* 容器与选中态样式全部来自既有 .iv-quick-tabs / .iv-tab，不新增类 */}
      <div className="iv-quick-tabs" role="tablist" aria-label={t('modeScript')} data-script-tabs="true">
        {SCRIPT_TABS.map((tab, index) => (
          <button key={tab.key} type="button" role="tab"
            id={`script-tab-${tab.key}`} aria-controls="script-panel"
            aria-selected={scriptTab === tab.key}
            tabIndex={scriptTab === tab.key ? 0 : -1}
            className="iv-tab" style={{ flex: 1 }}
            data-script-tab={tab.key}
            onKeyDown={event => { onTabKeyDown(event, index) }}
            onClick={() => { setScriptTab(tab.key) }}>
            <Icon name={SCRIPT_TAB_ICONS[tab.key]} size={12} />
            {t(tab.label)}
          </button>
        ))}
      </div>
    </div>

    <div role="tabpanel" id="script-panel" aria-labelledby={`script-tab-${scriptTab}`}>

    {scriptTab === 'split' && (<>
      {/* module 只作元数据：折叠层已删除 */}
      <span data-module="pipeline" data-module-title="pipeline" hidden>{t('modulePipeline')}</span>
      <div data-module-body="pipeline">
        <PipelineCard … />
      </div>

      <div className="iv-sc-divider"><span>{t('moduleEpisode')}</span></div>
      <span data-module="episode" data-module-title="episode" hidden>{t('moduleEpisode')}</span>
      <div data-module-body="episode">
        {activeEpisode === undefined ? <div className="iv-empty">{t('storyboardNeedsProject')}</div> : <EpisodeWorkspace … />}
      </div>
    </>)}
    </div>{/* /tabpanel */}
```

```ts
// onTabKeyDown：半套 tab 语义补齐（←/→/Home/End + 焦点跟随），约 12 行
// 就地写在 Workbench 里即可；后续其它 .iv-quick-tabs / .iv-tabs 可提取复用
function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
  const last = SCRIPT_TABS.length - 1
  const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
        : event.key === 'End' ? last : -1
  if (next < 0) return
  event.preventDefault()
  setScriptTab(SCRIPT_TABS[next].key)
  // 焦点在下一帧跟到新选中的 tab 上（querySelector 用 data-script-tab 定位）
  requestAnimationFrame(() => {
    document.querySelector<HTMLButtonElement>(`[data-script-tab="${SCRIPT_TABS[next].key}"]`)?.focus()
  })
}
```

```tsx
// 分段卡（EpisodeWorkspace.tsx segmentBody 改造后骨架）
<div className="iv-sb-shot" data-segment={segment.id}>
  <div className="iv-sb-seg-head iv-sb-seg-head--clickable" data-segment-head={segment.id} onClick={toggle}>
    <span className="iv-sb-shot-index">{segment.order}</span>
    <span className="iv-micro" data-segment-name={segment.id}>{t('segmentName').replace('{n}', String(segment.order))}</span>
    <span className="iv-sc-sum">{segment.durationSec}s · {storyboard?.shots.length ?? 0} {t('segmentShotUnit')}</span>
    <span className="iv-ellipsis iv-sc-sum-text">{segment.promptText || t('segmentPromptPlaceholder')}</span>
    <Icon name="chevron" size={11} className={`iv-sc-caret${collapsed ? '' : ' iv-sc-caret--on'}`} />
  </div>
  {collapsed ? null : (
    <div className="iv-sb-shot-body">
      {/* 提示词 → 引用 → 高级设置（5 个控件收进 details）→ 动作行 → 分镜 */}
      <details className="iv-sc-adv" open={advOpen}>
        <summary className="iv-sc-adv-head">
          <Icon name="sliders" size={12} />{t('segmentAdvanced')}
          <span className="iv-sc-adv-sum">{modelSummary(segment)}</span>
          <Icon name="chevron" size={10} className="iv-sc-caret" />
        </summary>
        <div className="iv-sc-adv-body">{/* 时长 / 图像模型 / 视频模型 / 文本模型 / Skill */}</div>
      </details>
    </div>
  )}
</div>
```

> 摘要行里的 `segmentShotUnit` / `segmentAdvanced` 为新增 key（见 §四）。`aria-label`（`clipSpeed` 之外的那批 segment 级 label）全部保持原值，测试按 `aria-label` 取元素。

### 2.4 交互细则

| 场景 | 行为 |
|------|------|
| 首次进入 | 剧本框可编辑；「生成设置」折叠且摘要为 `自动 · 自动 · 自动`；本集工作区「分集剧本」折叠 |
| 剧本为空 | 生成按钮 `disabled` + `title` 说明（沿用 `pipelineGenerateNeedsSource`） |
| 分段为空 | 「分集剧本」**自动展开**（这是唯一需要长文本的场景） |
| 分段跳转 | 下拉选中某段时**先展开**「分集剧本」再 `focus()` + `setSelectionRange`（否则聚焦到隐藏元素，跳转静默失效） |
| 分段已存在 | 分集剧本保持折叠，用户点标题展开；展开态高度 `max-height:40vh` 内滚动 |
| 切集 | 折叠态全部复位到默认（避免上一集的展开状态带来错位感） |
| 生成中 | 剧本框 `disabled`；生成按钮变 `iv-btn--busy` 文案 `pipelineGeneratingScript`（已有 key） |

### 2.5 图标

| 位置 | 图标 | 是否已存在 |
|------|------|-----------|
| pane 头 | `script` | ✅ |
| 剧本分镜 | `storyboard` | ✅ |
| 素材提取 | `box`（资源类目） | ✅ |
| 音色 | `music` | ✅ |
| 轨迹 | `motion` | ✅ |
| 生成设置 / 分段高级 | `sliders` | ✅ |
| 导入剧本 | `script` / `upload` | ✅ |
| 删除已导入文件 | `x`（替换字面量 `×`） | ✅ |

**不需要新增任何图标**（`icons.tsx` 已含全部）。emoji 一律不用——Round 6 的图标契约钉的是 24 视窗 / 1.8 描边 / 统一组件。

---

## 三、样式改造方案

### 3.1 改造范围与类名占用核对

| 文件 | 改造 | 约束 |
|------|------|------|
| `workbench-style.ts` | **不动** | 基础表，其他 pane 共用 |
| `modern-theme.ts` | 增量约 45 条规则 | 只覆盖，不改名、不删除既有规则 |
| `Workbench.tsx` | 分区头 + 删 module 层 | 保留全部 `data-*`（见 2.2） |
| `PipelineCard.tsx` | 去内联 style、拆 field 结构 | 保留 `data-pipeline-*` |
| `SharedScriptInput.tsx` | 换 `iv-textarea`、`×` → `<Icon>` | 保留 `data-pipeline-import*` |
| `EpisodeWorkspace.tsx` | 分段折叠态摘要 + 高级设置折叠 | 保留 `data-segment*` / `data-shot` / `aria-label` |
| `locales.ts` | 新增 5 个 key | en + zh-CN 双份 |

拟新增类名已核对占用（`workbench-style.ts` + `modern-theme.ts` 中匹配 `.类名` 计数）：

| 类名 | 占用 | 用途 |
|------|------|------|
| ~~`.iv-sc-seg` / `.iv-sc-tab`~~ | — | **不再需要**：复用既有 `.iv-quick-tabs` + `.iv-tab`（见 §1.2 / M2） |
| `.iv-sc-io` | 0 | 剧本输入块 |
| `.iv-sc-adv` | 0 | 段内高级设置折叠 |
| `.iv-sc-script` | 0 | 分集剧本折叠 |
| `.iv-sc-sum` / `.iv-sc-sum-text` / `.iv-sc-caret` | 0 | 折叠态摘要与箭头 |
| `.iv-sc-divider` | 0 | 两分区之间的小标题分隔 |

`.iv-qc-field*`（快速创作新增）**直接复用**，不复制一套——体积已在红线上，见 §九.3。

### 3.2 modern-theme.ts 新增规则（节选，实施时压缩成单行）

```css
/* 分区 tab：不新增任何规则。容器 .iv-quick-tabs（:48）、未选中 .iv-tab（:49）、
   选中 .iv-tab[aria-selected="true"]（:51）、选中图标色（:52）全部已在线上生效。
   唯一需要补的是 tab 在 pane 头里靠右且不被标题挤压： */
.iv .iv-pane-head .iv-quick-tabs{margin-left:auto}

/* 剧本输入块 */
.iv .iv-sc-io{display:flex;flex-direction:column;gap:var(--iv-sp-3)}
.iv .iv-sc-io .iv-textarea{resize:vertical;min-height:96px}

/* 原先写死在内联 style 里的两个尺寸，改为类承载 */
.iv .iv-sc-num{width:80px}
.iv .iv-sc-generate{min-width:132px}

/* 「⋯」溢出菜单：原生 details，内容恒在 DOM（测试用 querySelector 仍能取到） */
.iv .iv-sc-more{position:relative;display:inline-flex}
.iv .iv-sc-more>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;
  justify-content:center;width:26px;height:26px;border-radius:var(--iv-r-sm);
  border:1px solid var(--iv-line-2);color:var(--iv-tx2)}
.iv .iv-sc-more>summary::-webkit-details-marker{display:none}
.iv .iv-sc-more>summary:hover{border-color:color-mix(in srgb,var(--iv-tx) 30%,transparent);color:var(--iv-tx)}
.iv .iv-sc-more[open]>summary{border-color:color-mix(in srgb,var(--iv-tx) 30%,transparent);background:var(--iv-panel-2)}
.iv .iv-sc-more-body{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--iv-z-overlay);
  display:flex;flex-direction:column;gap:2px;min-width:132px;padding:4px;
  border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel);box-shadow:var(--iv-shadow-2)}
.iv .iv-sc-more-body .iv-btn{justify-content:flex-start;width:100%}

/* 分区小标题分隔 */
.iv .iv-sc-divider{display:flex;align-items:center;gap:var(--iv-sp-3);color:var(--iv-tx3);
  font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-medium);letter-spacing:.08em;text-transform:uppercase}
.iv .iv-sc-divider::after{content:"";flex:1;height:1px;background:var(--iv-line)}

/* 段内高级设置（复用 iv-advanced 的视觉，语义类名独立） */
.iv .iv-sc-adv{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface)}
.iv .iv-sc-adv-head{display:flex;align-items:center;gap:var(--iv-sp-3);padding:6px 9px;cursor:pointer;
  list-style:none;font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-sc-adv-head::-webkit-details-marker{display:none}
.iv .iv-sc-adv-sum{margin-left:auto;font-weight:var(--iv-fw-regular);color:var(--iv-tx3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.iv .iv-sc-adv-body{padding:8px 9px;border-top:1px solid var(--iv-line)}
.iv details.iv-sc-adv[open] .iv-sc-adv-head .iv-sc-caret{transform:rotate(180deg)}

/* 分段折叠态摘要 */
.iv .iv-sc-sum{font-size:var(--iv-fs-micro);color:var(--iv-tx3);white-space:nowrap}
.iv .iv-sc-sum-text{flex:1;min-width:0;font-size:var(--iv-fs-meta);color:var(--iv-tx3)}
.iv .iv-sc-caret{transition:transform var(--iv-dur-1) ease}
.iv .iv-sc-caret--on{transform:rotate(180deg)}

@media (prefers-reduced-motion:reduce){.iv .iv-sc-caret{transition:none}}
```

### 3.3 样式约束

| 约束 | 说明 |
|------|------|
| 只用现有 token | 不新增 `--iv-*`；阴影用 `color-mix` 就地计算（`--iv-shadow-*` 只有 2/3/acc 三档，对 26px 胶囊过重） |
| 选择器带 `.iv` 前缀 | 与现有特异性一致 |
| 不用裸值 | 尺寸走 `--iv-sp-*` / `--iv-fs-*` / `--iv-r*`；例外仅 `2px` 级微调，需注释 |
| 双主题成立 | 全部颜色基于 token + `color-mix`，不烧硬编码色 |
| 折叠动效可关 | 新增 transition 必须配 `prefers-reduced-motion` |

---

## 四、国际化（新增 5 个 key）

| key | en | zh-CN | 用途 |
|-----|----|-------|------|
| `segmentAdvanced` | Advanced | 高级设置 | 段内折叠标题 |
| `segmentShotUnit` | shots | 镜 | 摘要行单位 |
| `segmentSummary` | {duration}s · {shots} shots | {duration}s · {shots} 镜 | 摘要拼接（调用方自行 replace） |
| `scriptSettings` | Generation settings | 生成设置 | 卡片内折叠标题 |
| `episodeMore` | More actions | 更多操作 | 溢出菜单按钮 |

> `t` 的签名是 `(key) => string`，**不接受插值参数**；带 `{x}` 的文案必须在调用方 `.replace()`。
> 旧 key（`modulePipelineDesc` / `moduleEpisodeDesc` / `moduleCollapse` / `moduleExpand`）**保留不删**——时间轴与画布仍可能在别处复用，删 key 只会让其它调用方编译失败。

---

## 五、测试影响预估

| 文件 | 依赖 | 影响 | 需改动 |
|------|------|------|--------|
| `tests/client-script-tabs.test.tsx` | 4 用例，`data-script-tab`（20 处）、tab 文案与顺序 | **全部仍通过**（只换样式类，契约不动） | 0 |
| `tests/client-quick-modules.test.tsx` | `.iv-module-n` 断言（69、72 行）、`data-module-toggle="pipeline"` 折叠用例（118–137 行） | **3 处失效**：编号徽标删除、折叠行为删除 | 删 1 个用例 + 改 2 行断言 |
| `tests/client-pipeline-card.test.tsx` | 7 用例，`data-pipeline-*` | 结构变化后 `data-pipeline-script` 仍存在；`data-pipeline-plan-*` 移入 `<details>` 仍可查 | 0（若断言「同行可见」需调整） |
| `tests/client-episode-workspace.test.tsx` | 34 用例，`data-segment`（50）、`data-shot`（30）、**头部三按钮导航（708-712）** | 折叠默认态变化会影响「直接找到分段内输入框」的用例；`data-episode-actions` 必须仍是 `.iv-row`，且三个按钮用 `<details>` 承载时**必须恒在 DOM** | **预计 3–6 个**，实施时逐个定位 |
| `tests/client-design-system.test.tsx` | 骨架类名契约 | 若新增 `.iv-sc-*` 需补断言；`iv-module` 断言需保留（画布/时间轴仍无） | 加 1 条 |
| `tests/client-modern-theme.test.tsx` | 样式契约（现 14 条） | 新规则需补 1–2 条钉住 | 加 1 条 |

**合计预估**：改 1 个用例、删 1 个用例、改 2 行断言、新增 2 条契约；`client-episode-workspace` 的 3–6 个需现场定位。
**纠正 v1.0 的乐观口径**：`client-episode-workspace:708-712` 会直接读 `[data-episode-actions]` 内的三个按钮——只要 D5 用「条件渲染的浮层」，这条导航用例必定失败。改用原生 `<details>` 可保持 DOM 恒在，从而把这条用例的影响降为 0（见 M1）。

---

## 六、实施步骤

每步可独立验证，失败可回退。

### Step 0 — 体积基线留证
`node scripts/check-bundle-size.mjs`，把输出贴进本文件附录。
**当前实测：入口 24,231 B（88%）、总产物 1,490,659 B（106%，超 86,659 B）——门禁本来就是红的，别把超限算到本批头上。**

### Step 1 — locale key（5 个）
`locales.ts` 的 union + `en` + `zh-CN` 三处。验证：`pnpm run typecheck`。
> 实测经验：新增 key **不进入口包**（入口 24,231 B 零变化），全落在 `client.Workbench.js` chunk。所以入口余量 3.3 KB 不是本批约束，盯总产物即可。

### Step 2 — 剧本页顶层（`Workbench.tsx` 3653–3853）
加 pane 头（`.iv-pane-head` 共享件）+ 复用 `.iv-quick-tabs`/`.iv-tab` 承载四个分区；删 `iv-modules` 与两个 module 头；`data-module*` 降级为 hidden 元数据；两分区之间加 `iv-sc-divider`。验证：typecheck + `client-script-tabs` 4 用例。

### Step 3 — 输入区与设置区（`PipelineCard.tsx` / `SharedScriptInput.tsx`）
去内联 style；`iv-textarea`；数量/模型/技能收进 `iv-sc-adv`；`×` → `<Icon name="x">`。验证：`client-pipeline-card` 7 用例。

### Step 4 — 分段卡（`EpisodeWorkspace.tsx`）
折叠态摘要；5 个控件收进 `iv-sc-adv`；分集剧本改 `iv-sc-script` 折叠（分段为空时自动展开）。验证：`client-episode-workspace` 34 用例逐个过。

### Step 5 — 样式与测试
`modern-theme.ts` 增量；改 `client-quick-modules` 的 3 处；补 2 条契约；跑 typecheck + 相关 vitest + `check-bundle`。

---

## 七、不在本次范围

| 项目 | 说明 |
|------|------|
| 素材提取 / 音色 / 轨迹三个分区的内部重构 | 本次只改容器与头部，三个面板内部各自独立排期 |
| 分镜（shot）级 UI 重构 | 分镜卡在分段卡内部，改动量单独评估 |
| 分段拖拽排序 | 现有上移/下移按钮仍保留（与引用 chip 的箭头不同，这里没有替代交互） |
| 生成接口变更 | 纯界面改造，不动 `api.*` 与宿主协议 |
| `.iv-module` 基础样式删除 | `workbench-style.ts` 不动；module 类名在别处可能仍被引用 |

---

## 八、验证清单

- [ ] 剧本生成 → 四个分区：胶囊分段可切换，图标齐全，选中态一眼可辨
- [ ] 四个 tab 支持 ←/→/Home/End，Tab 键只停在选中项（roving `tabIndex`），且 `aria-controls` 指向同一 `tabpanel`
- [ ] 「⋯」菜单用原生 `<details>`：内容恒在 DOM；关闭态不点击也能被 `querySelector` 取到；「同步工作流」有二次确认
- [ ] 「跳到第 N 段」会先展开分集剧本再选中文本
- [ ] 剧本输入：圆角 10px、min-height ≥ 84px、可纵向拉伸、字数实时更新
- [ ] 生成设置折叠：默认收起，摘要显示「自动 · 自动 · 自动」，展开后 5 个控件不换行错位
- [ ] 生成剧本：空剧本禁用、生成中变 busy、成功后有 notice、失败有 `iv-err`
- [ ] 本集工作区：分集剧本默认折叠；分段为空时自动展开
- [ ] 分段卡：折叠态一行摘要（段号 + 时长 + 镜数 + 提示词摘要）；展开后 5 个控件在高级设置里
- [ ] 集切换：折叠态复位，不残留上一集状态
- [ ] 浅色 / 深色主题无异常；`prefers-reduced-motion` 下无动效
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm exec vitest run tests/client-script-tabs.test.tsx tests/client-pipeline-card.test.tsx tests/client-episode-workspace.test.tsx tests/client-quick-modules.test.tsx` 全绿
- [ ] `node scripts/check-bundle-size.mjs`：总产物增量 ≤ 8 KB（样式约 40 条规则），不因本批再恶化超过 1%

---

## 九、事实核对（v1.0 复核）

### 9.1 已核实（可直接引用）

| # | 事实 | 证据 |
|---|------|------|
| 1 | 剧本 pane 无头部，四个 tab 顶到最上 | `Workbench.tsx:3655`（无 `iv-pane-head`） |
| 2 | 四个 tab 是 `iv-btn--acc` + 内联 `flex:1` | `Workbench.tsx:3665-3666` |
| 3 | 两个 module 带编号 `1`/`2` 与折叠按钮 | `Workbench.tsx:3687/3724`、`3682/3719` |
| 4 | `iv-input` + 内联 `borderRadius:6px` 的 textarea | `SharedScriptInput.tsx:71-81` |
| 5 | 三级数量输入硬编码 `width:80px` ×3 | `PipelineCard.tsx:219/233/247` |
| 6 | 每个分段展开态 5 个 `<select>` + 5 个输入 | `EpisodeWorkspace.tsx` 1000–1530 行静态统计 |
| 7 | 本集工作区头部 6 个元素同行 | `EpisodeWorkspace.tsx:1539-1637` |
| 8 | `.iv-module-n` 与折叠被测试断言 | `tests/client-quick-modules.test.tsx:69/72/118-137` |
| 9 | 体积现状 106%（超 86,659 B） | `node scripts/check-bundle-size.mjs` |

### 9.2 未核实（实施前需现场确认）

| # | 待确认项 | 为什么重要 |
|---|----------|-----------|
| 1 | 「分集剧本」textarea 与分段落列表的内容是否真的重复 | 若两者用途不同（一个是整体剧本、一个是拼接视图），折叠策略要改 |
| 2 | `client-episode-workspace` 的 34 个用例里有多少会因折叠默认态变化而失败 | 决定 Step 4 的实际工作量 |
| 3 | 380px 宽右列场景是否也渲染剧本 pane | 若会，`.iv-quick-tabs` 需再加断点（回收 tab 文案为图标 + `title`） |

### 9.3 已推翻的假设（写方案时先想错、后纠正）

| 假设 | 事实 |
|------|------|
| 「新增 locale key 会撑破入口体积」 | **不成立**。实测入口零变化，key 全在 chunk。旧口径已过期，见 `docs/bundle-baseline-2026-11-26.md` |
| 「`.iv-field` 可以拿来当结构化字段类名」 | **不成立**。`.iv-field` 已被工作流节点参数占用（`grid-template-columns:92px minmax(0,1fr)`），故本方案一律 `.iv-sc-*` |
| 「重命名 `.iv-qc-field` 成中性名更干净」 | **不建议**。体积已超 86 KB，复制一套规则 = 再涨 1–2 KB；命名债记在这里，等体积回绿再统一 |

---

## 十、风险与待拍板

1. **D3（分集剧本折叠）是唯一可能引起用户困惑的改动**——如果用户习惯「进页面就看全文」，折叠会让首屏少一块内容。缓解：分段为空时自动展开。
2. **`client-episode-workspace` 是最大不确定项**（34 个用例）。建议 Step 4 单独一个提交，出问题可整步回滚。
3. **体积**：本批预计 +6～8 KB raw。当前 106%，若不在 CHANGELOG 说明并抬 `BUNDLE_TOTAL_BASELINE`，门禁会一直是红的——**这个决策悬了三轮，建议本轮一并定**。

---

## 十一、v1.1 复核：可行性与必修项

### 11.1 结论

**可行，但 v1.0 有 3 处诊断基于过期基线、2 处改造会引入回归。** 结构收敛（删 module 层、pane 头、分段折叠）方向正确；按 M1–M6 修订后可开工，预估实际样式增量从 45 条降到约 30 条。

### 11.2 必修项（按严重度）

| # | 级别 | 问题 | 修订 |
|---|------|------|------|
| M1 | **P1** | D5 若用「点击后才渲染的浮层」，`client-episode-workspace:710` 的 `[data-episode-actions]` 三按钮断言必挂；隐藏的 `data-episode-import-file` 也必须常驻 | 改原生 `<details class="iv-sc-more">`：内容恒在 DOM、键盘可开合、零 JS。另：「同步工作流」调 `syncEpisodeWorkflow` 会**重建画布且当前无确认**（`EpisodeWorkspace.tsx:1546-1566`），收进菜单后必须补 `confirm` |
| M2 | **P1** | tab 只做了半套 ARIA：有 `role=tablist/tab` 与 `aria-selected`，但无 `aria-controls`、无 roving `tabIndex`、无 ←→。读屏会宣布「标签页」却不响应方向键，比纯按钮更差 | 按 §2.3 补 `id` / `aria-controls` / `role=tabpanel` / `tabIndex` / `onTabKeyDown`（12 行） |
| M3 | P2 | D6 的视觉前提不成立：圆角**已是 10px**（`modern-theme.ts:81` + `:122` 的 `!important`），只有 padding 是 6/8 | 改称「拆 `[style*=border-radius]` 补丁」；降为 P3，不与结构改造同批提交 |
| M4 | P2 | 直接删 `width:80px` / `minWidth:132px` 会让三级数量变满宽、主按钮变窄 | 用 §3.2 的 `.iv-sc-num` / `.iv-sc-generate` 接管，再删内联 |
| M5 | P2 | 折叠摘要 `自动 · 自动 · 自动` 不是有效信息 | 回显**生效值**（`6 集 · 3 段 · 4 镜 · 默认规则`），复用 `PipelineCard` 现有的 resolve 结果 |
| M6 | P3 | D3 + D4 + 生成设置三处同时默认收起，首屏只剩一个文本框，属「渐进披露过度」 | 「生成设置」保持展开（主路径参数），只折叠低频的「分集剧本」与「段内高级」；分段为空时自动展开的规则保留 |

另：`jumpToSegment()`（`EpisodeWorkspace.tsx:1531-1535`）会 `focus()` 并选中分集剧本里的文本。D3 折叠后该函数会聚焦到隐藏元素——**必须让跳转先展开 `<details>`**，否则「跳到某段」静默失效。

### 11.3 跨 pane 共享原语（本批与另两份方案共同遵守）

| 原语 | 唯一实现 | 禁止 |
|------|----------|------|
| pane 头 | `.iv-pane-head` + `.iv-pane-tile` + `.iv-pane-title` + `.iv-pane-actions`（画布/时间轴已在用） | 另起 `iv-*-head` 变体 |
| 分段 / 标签 | `.iv-quick-tabs` / `.iv-tabs` + `.iv-tab`（选中态由 `[aria-selected=true]` 提供） | `.iv-sc-seg`、`.iv-tl-seg`、`.iv-wf-seg` |
| 原位折叠 | 原生 `<details>` + `<summary>` | 手写 state 条件渲染（丢 DOM、丢键盘） |
| 状态胶囊 | `.iv-chip` + `--ok` / `--err`，需要 `--warn` 时三处同步 | 每个 pane 自造 pill |
| 浮层层级 | 既有 `--iv-z-tip:40`（tooltip）/ `--iv-z-overlay:60`（浮层） | 复用 `--iv-z-playhead` 当抽屉层级 |

理由：三份方案各自新增 30–45 条规则，合计约 120 条；共享后总量可压到 ~60 条。当前总产物 106%（超 86,659 B），这是唯一能把三批增量压进 1% 的路径。

### 11.4 建议实施顺序（调整后）

1. M2（tab 语义）+ D1 类名切换 + pane 头 —— 纯结构，测试零改动，可先行；
2. D2 删 module 层 + D3/D4 折叠 + 跳转自动展开 —— 与 `client-episode-workspace` 同批，单独提交；
3. M1 溢出菜单 + 同步确认 —— 独立提交；
4. M3/M4 内联样式清理 —— 最后做，纯卫生。
