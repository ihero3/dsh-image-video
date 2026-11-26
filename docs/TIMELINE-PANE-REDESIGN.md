# 时间轴精剪重新设计方案

> 版本：v1.2 · 2026-11-26 · 状态：**D1 已拍板（常驻轨道下方）；D3 口径已按 §十二 修订；其余待确认，尚未实施**
>
> 基线：`QUICK-CREATE-REDESIGN.md` v1.2.4。方法论一致；本模块额外一条原则：
> **时间轴的验收标准是「监视器 + 轨道同屏」**，任何让这两者分离的改动都不算完成。

---

## 决策确认

| # | 决策项 | 结论 | 代价 / 备注 |
|---|--------|------|-------------|
| D1 | 导出入口位置 | ✅ **已定：导出设置常驻轨道下方**（不做头部浮层） | **0 测试改动**。代价：导出要滚到轨道下方（但它在轨道之后，符合「先看内容再导出」）。原建议「头部 `[导出 ▾]` + 浮层」已废弃 |
| D2 | 两个播放器（逐段预览 + 节目监视器） | 监视器留原位；逐段预览降级进底部「辅助」折叠区 | 0 测试改动（`data-seg-preview` 保留） |
| D3 | 片段参数（13 个控件） | **全部移入轨道下方的「片段」检查器**，片段条只留缩略底 + 名 + 时长 + 左右手柄 | 检查器**默认「展示」第一段**（`inspected = selected ?? first`），但**不写入选中态**——这样既保住 `client-timeline-effects` 4 个用例，又不引入「进页面就有片段被选中」的副作用。见 M2 |
| D4 | 顶部两个 checkbox（烧字幕 / 响度归一） | 随 D1 落定：**移入轨道下方的导出条** | 0 测试改动（`data-timeline-burn` / `data-timeline-loudness` 仍在 DOM 且可见） |
| D5 | ffmpeg 状态行 | 降为 pane 头里的一枚色点 chip，失败时才展开说明 | 0 测试改动（`data-timeline-ffmpeg` 保留在 chip 上） |
| D6 | 缩放滑杆 | **接上真实缩放**（当前是死控件） | 需要 `--iv-tl-zoom` 变量 + 横向滚动容器 |

---

## 一、现状诊断

### 1.1 顺序倒置：导出在监视器之前

当前 pane 内自上而下（`Workbench.tsx:4004-4552`）：

| # | 区块 | 行号 | 高度（估） | 问题 |
|---|------|------|-----------|------|
| 1 | pane 头（标题 / 总时长 / 两个 checkbox / 保存态） | 4006-4039 | 22 | 两个导出选项放在标题栏 |
| 2 | ffmpeg 状态行（chip + 全路径 + 重新检测） | 4042-4057 | 24 | 运维信息占一整行 |
| 3 | 逐段预览（播放器 + 段条） | 4060-4063 | ≈202 | 第二个播放器，与监视器互不同步 |
| 4 | **导出操作行**（3 个下拉 + 主按钮 + 取消 + 状态 + 进度 + 注册） | 4067-4170 | 40+ | **用户还没看到内容就先遇到导出** |
| 5 | 节目监视器 | 4173-4195 | 168+ | 第 5 位才出现 |
| 6 | transport（播放 / 时间码 / 滑块 / 缩放） | 4198-4216 | 34 | 缩放是死控件（见 1.5） |
| 7 | 刻度 + 三条轨道 | 4219-4544 | ≈196 | 被挤到首屏之下 |
| 8 | 配音卡 + 多比例导出 | 4545-4547 | ? | 与时间轴同流，页面更长 |

合计：22+24+202+40+168+34+196 = **686px**，加 7 处 8px 间距与 pane 内边距 ≈ **758px**，还没算配音卡。
900px 高窗口扣掉页面外壳就装不下，**结果是「监视器看得见、时间轴要滚动」**——这正好违背精剪工具的第一原则。

### 1.2 两个播放器、两套控制

| | 逐段预览（`TimelineSegmentPreview`） | 节目监视器（`iv-monitor`） |
|---|---|---|
| 位置 | 第 3 区（导出条下方） | 第 4 区 |
| 播放按钮 | `segPlay` / `segPause` | `transportPlay` / `transportPause` |
| 进度 | `.iv-seg-bar` 的 N 个格子 | `.iv-playhead` + scrub |
| 内容 | 视频轨按序逐段播放 | 播放头所在片段的单帧/视频 |

两个都能「播」，但**互不同步**：在监视器里按播放，逐段预览不动；在逐段里播，播放头不动。
用户无法建立「现在播的就是时间轴上这一处」的因果感。这是本模块最伤的一个点。

### 1.3 片段被做成了微型表单

```tsx
// Workbench.tsx:4292-4489，单个 .iv-clip 内部
开始(ms) 时长(ms) 速度 淡入淡出 转场 转场时长 裁剪x 裁剪y 裁剪w 裁剪h (字幕:字号 颜色 位置) 分割 复制 删除
```

静态统计：**13 个 `<input>/<select>`**。而片段容器只有 58px 高、`overflow:hidden`：

```css
/* workbench-style.ts:684-687 */
.iv-clips{height:58px}
.iv-clip{position:absolute;top:0;bottom:0;overflow:hidden;padding:3px 7px 3px 9px}
.iv-clip .iv-input{height:18px;font-size:var(--iv-fs-meta);width:56px}   /* 713 */
```

18px 高的输入框 + 11px 字号，已经低于可用下限；`flex-wrap:wrap` 让控件换行后**被 `overflow:hidden` 直接裁掉**。
用户的实际感受就是「片段里有一堆看不清也点不到的东西」。

片段条本来的职责只有三件：**占位（在哪、多长）· 内容（是什么）· 抓取（左右手柄）**。
参数属于「选中之后才关心」的信息，应放进检查器。

### 1.4 导出区把「设置 / 动作 / 结果」混在一行

`4067-4170` 一个 `.iv-toolbar` 里同时有：

- 设置：分辨率 / 帧率 / 宽高比（三个 `iv-field`，`92px` 标签列 + 控件）
- 动作：`[下载 开始导出]`（`iv-btn--acc iv-btn--lg`）+ `[取消导出]`
- 结果：状态 chip（running / succeeded / failed）+ 进度条 + `[注册为素材]`

三种语义塞进一个会自动换行的容器，窗口一窄就变成三排，且「取消导出」与「开始导出」同排相邻，
一个误点就可能中断已经渲染了 80% 的任务。

### 1.5 缩放滑杆是死的

```tsx
// Workbench.tsx:4214
<input className="iv-scrub" type="range" min={0} max={100} defaultValue={60} aria-label={t('timelineZoom')} />
```

`defaultValue` + **没有 `onChange`** + 没有任何地方消费它。
拖它不会改变轨道宽度、不会改变刻度密度，是纯装饰控件。这类控件比缺失更糟——用户会以为界面坏了。

### 1.6 刻度固定 5 格，与内容无关

```tsx
{[0, 25, 50, 75, 100].map(pct => <b style={{ left: `${pct}%` }}>{timecode((timelineTotal * pct) / 100)}</b>)}
```

无论总时长 8 秒还是 8 分钟，永远只有 5 个刻度。精剪时需要更密的参考点（至少随缩放变化）。

### 1.7 魔法数字 `46px` 出现在两处

```tsx
// Workbench.tsx:4229  播放头位置
style={{ left: `calc(46px + (100% - 46px) * ${playheadMs / Math.max(1, timelineTotal)})` }}
```
```css
/* workbench-style.ts:670/676  轨道头宽度 */
.iv-ruler{margin-left:46px}
.iv-track{grid-template-columns:46px minmax(0,1fr)}
```

轨道头一改宽，播放头就错位。这是「同一个常量写在 JS 和 CSS 两处」的典型代价。

### 1.8 其他

| 位置 | 问题 | 证据 |
|------|------|------|
| 监视器空态 | `style={{ color: '#9aa0a8' }}` 硬编码，浅色主题下对比度不足 | `Workbench.tsx:4176`；**改 `--iv-tx2`**（空态是引导文案，属正文，`--iv-tx3` 只够装饰级对比） |
| 字幕预览 | 字号/位置用内联 style 计算（这个是合理的动态值，但字号换算 `fontSize/2` 缺注释） | `4185-4191` |
| 片段外观 | 视频片段只有图标 + 文件名，没有缩略底图 | `4322-4328` |
| 轨道头 | 只有 `V1/A1/S1` + kind，没有静音/独奏/锁定 | `4232-4249` |
| 字幕批次输入 | `style={{ flex:1, minWidth:'140px', resize:'vertical' }}` | `4509` |

---

## 二、设计方案

### 2.1 目标形态

```
┌─ iv-pane ──────────────────────────────────────────────────────────────┐
│ [film] 时间轴   00:42   ●ffmpeg 9.0.2                              ●已保存 │ ← 头：标题+时长+ffmpeg 色点+保存态
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      节目监视器（16:9，随宽自适应）                 │  │ ← 第一屏就能看到
│  │                                          TC 00:03:12 / 00:42      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  [▶] 00:03:12 ──────●────────────────────── / 00:42   [search] ——●——  │ ← transport + 可用缩放
├────────────────────────────────────────────────────────────────────────┤
│  00:00      00:10      00:20      00:30      00:40                     │ ← 刻度随缩放变化
│  V1 │ ▮▮ 镜头A.mp4    ▮▮▮ 镜头B.mp4                                   │ ← 28px 条：缩略底+名+时长
│  A1 │ ~~~~~~~~ 配乐.mp3 ~~~~~~~~~~~~~~~~~                             │
│  S1 │      「林夏撑伞走来」        「老周抬头」                          │
├────────────────────────────────────────────────────────────────────────┤
│  片段 · 镜头B.mp4    起点 3200ms  时长 4000ms  速度 1.0  淡入 0ms      │ ← 片段检查器（选中优先，否则展示首段）
│                      转场 [淡入 ▾] 400ms  裁剪 [x][y][w][h] [✕]        │
│                      [分割] [复制] [删除]                              │
├────────────────────────────────────────────────────────────────────────┤
│  导出   分辨率 [默认 ▾]   帧率 [30 ▾]   画幅 [横屏 ▾]                  │ ← 常驻轨道下方（D1）
│         ☑ 烧录字幕   ☑ 响度归一                          [开始导出]     │
│         （导出中：状态 · 进度 ——●————  [取消导出]  [注册为素材]）        │
├────────────────────────────────────────────────────────────────────────┤
│  ▸ 辅助：逐段预览 · 配音 · 多比例导出                                   │ ← 折叠，默认收起
└────────────────────────────────────────────────────────────────────────┘
```

导出条为什么常驻而不是浮层（D1 结论）：

| 理由 | 说明 |
|------|------|
| 三个下拉是「每次导出都要确认」的参数 | 藏进浮层后每次都要多点一次，且无法一眼确认当前设置 |
| 两个 checkbox 是时间轴级状态 | `burnSubtitles` / `normalizeLoudness` 属于时间轴数据，不是导出临时参数，放在导出条里语义更准 |
| 0 测试改动 | `client-export-panel` / `client-a11y` / `workbench.client` 都直接取 `[data-timeline-export*]`，位置在轨道下方不影响取用 |
| 代价可控 | 导出条在轨道之后，滚动成本只在「点开始导出」这一步，而导出本身就是终结动作 |

### 2.2 结构改造清单

| 元素 | 现状 | 改造 | 必须保留 |
|------|------|------|----------|
| pane 头 | 标题 + 总时长 + 2 checkbox + 保存态 | 标题 + 总时长 + **ffmpeg 色点** + 保存态（两个 checkbox 下移到导出条） | `data-timeline-save`、`data-timeline-ffmpeg` |
| ffmpeg 状态行 | 独立一行（chip + 路径 + 重检） | 降为 pane 头色点；点开才显示路径与「重新检测」 | `data-timeline-ffmpeg` 放在 chip 容器上 |
| 导出操作行 | 独立区块，在监视器之前 | **整块下移到轨道之后常驻**（D1）：一行三个下拉 + 两个 checkbox + 主按钮；导出中在同区块第二行显示状态/进度/取消/注册 | `data-timeline-export`、`data-timeline-export-resolution/fps/aspect`、`data-timeline-export-cancel`、`data-timeline-render`、`data-timeline-render-percent`、`data-timeline-register`、`data-timeline-burn`、`data-timeline-loudness` |
| 监视器 | 168px 起，`max-height:200px` 的 img/video | **改为整列里唯一可伸缩的元素**：容器 `flex:1 1 auto;min-height:0`，媒体 `max-height:100%`（必须删掉 `workbench-style.ts:649` 的 `200px` 上限，否则监视器变高后画面仍是 200px、上下大片留白）；空态换 `--iv-tx2` | `data-timeline-preview`、`data-timeline-active-clip`、`data-timeline-active-subtitle`、`data-timeline-subtitle-preview` |
| transport | 播放 + 时间码 + scrub + 死缩放 | 保留结构，缩放接真值；scrub 与播放头同源 | `data-timeline-play`、`data-timeline-playhead` |
| 刻度 | 固定 5 格 | 按缩放计算刻度数（6–12 格），仍用现有 DOM 结构 | `.iv-ruler` |
| 播放头 | `calc(46px + …)` | 移入 `.iv-tl-lanes`（只覆盖轨道区），**去掉 46px 数学** | `.iv-playhead` |
| 片段条 | 13 个控件 | 只留：缩略底（图）/ 图标 + 名 + 时长 + 左右手柄 | `data-timeline-clip`、`data-timeline-clip-kind`、`data-timeline-clip-selected`、`data-timeline-clip-handle="left|right"`、`data-timeline-clip-split`、`draggable` |
| 片段检查器 | 不存在 | 新增 `.iv-clip-ins`：起点/时长/速度/淡入/转场/裁剪/字幕样式/分割/复制/删除；**默认展示第一段参数（不进入选中态）** | 全部 `aria-label`（`clipSpeed` / `clipFade` / `clipTransition` / `clipTransitionDuration` / `clipCrop*` / `styleFontSize` 等）原样搬过去 |
| 字幕添加 | 轨道内两行输入 | 保留（属于轨道级操作） | `data-timeline-subtitles-batch*`、`subtitlePlaceholder` |
| 逐段预览 | 独立区块（第 3 区） | 移入底部「辅助」折叠区 | `data-seg-preview`、`data-seg-counter` |
| 配音 / 多比例 | 时间轴之后平铺 | 一并收进「辅助」折叠区 | 组件内部契约不变 |

### 2.3 伪代码

```tsx
// 片段条：只留三件事。注意 tabIndex/键盘选中——参数搬走后，
// 键盘用户必须还能「选中另一个片段」，否则多片段时间轴对键盘用户不可用（M1）
<div className={`iv-clip iv-clip--${track.kind}${selected ? ' iv-clip--sel' : ''}`}
  role="group" tabIndex={0}
  aria-label={`${label} · ${(clip.durationMs / 1000).toFixed(1)}s`}
  aria-current={selected ? 'true' : undefined}
  data-timeline-clip={clip.id} data-timeline-clip-kind={track.kind}
  data-timeline-clip-selected={selected ? 'true' : 'false'}
  draggable onDragStart={…} onClick={() => { setSelectedClipId(clip.id) }}
  onKeyDown={event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setSelectedClipId(clip.id)
  }}
  style={{ left: `${left}%`, width: `${width}%` }}>
  <div className="iv-clip-h iv-clip-h--l" data-timeline-clip-handle="left" … />
  <div className="iv-clip-h iv-clip-h--r" data-timeline-clip-handle="right" … />
  {isImage(clip.assetPath)
    ? <img className="iv-clip-thumb" src={`/outputs/${encodeURIComponent(baseName(clip.assetPath))}`} alt="" />
    : null}
  <span className="iv-clip-top">
    <Icon name={TRACK_ICONS[track.kind]} size={11} />
    <span className="iv-ellipsis" title={…}>{label}</span>
    <span className="iv-clip-dur">{(clip.durationMs / 1000).toFixed(1)}s</span>
  </span>
  {/* 分割留在片段上：语义是「切这一条」，放进检查器反而指向不明 */}
  <button className="iv-clip-split" type="button" aria-label={t('clipSplit')}
    data-timeline-clip-split={clip.id} onClick={event => { event.stopPropagation(); splitClip(clip.id) }}>
    <Icon name="storyboard" size={11} />
  </button>
</div>
```

```tsx
// 片段检查器：选中片段优先；未选中时「展示」第一段，但不写入 selectedClipId（M2）
const flat = timeline.tracks.flatMap(t => t.clips.map(c => ({ track: t, clip: c })))
const selected = flat.find(item => item.clip.id === selectedClipId)
const inspected = selected ?? flat[0]
const isFallback = selected === undefined && inspected !== undefined

<div className="iv-clip-ins" data-timeline-clip-inspector={inspected?.clip.id ?? ''}
  data-timeline-clip-inspector-fallback={isFallback ? 'true' : 'false'}>
  {inspected === undefined
    ? <span className="iv-meta">{t('clipInspectorEmpty')}</span>
    : (<>
        <span className="iv-clip-ins-title">
          <Icon name={TRACK_ICONS[inspected.track.kind]} size={12} />
          {inspected.track.kind === 'subtitle' ? inspected.clip.text : baseName(inspected.clip.assetPath ?? '')}
          {isFallback ? <span className="iv-clip-ins-hint">{t('clipInspectorFallback')}</span> : null}
        </span>
        {/* 参数区：任何时候可编辑；首次修改时自动 setSelectedClipId( inspected.clip.id )，
            避免「改了参数却不知道改的是哪一段」 */}
        <div className="iv-clip-ins-grid">{/* 起点 / 时长 / 速度 / 淡入 / 转场 / 裁剪 / 字幕样式 */}</div>
        {/* 破坏性动作只在真正选中时才启用：fallback 状态下删除/分割指向不明 */}
        <div className="iv-clip-ins-actions">{/* 分割 / 复制 / 删除，disabled={isFallback} */}</div>
      </>)}
</div>
```

```tsx
// 刻度随缩放：6–12 格
const ticks = zoom <= 1 ? 6 : zoom <= 2 ? 8 : 12
{Array.from({ length: ticks + 1 }, (_, i) => <b key={i} style={{ left: `${(i / ticks) * 100}%` }}>{…}</b>)}
```

```tsx
// 播放头：只覆盖轨道区，去掉 46px
<div className="iv-tl-lanes">
  <div className="iv-playhead" style={{ left: `${(playheadMs / Math.max(1, timelineTotal)) * 100}%` }} />
  {tracks…}
</div>
```

### 2.4 交互细则

| 场景 | 行为 |
|------|------|
| 进入时间轴 | 监视器 + 轨道同屏；有片段时检查器**展示**第一段参数（`fallback=true`，片段不高亮）；**无任何片段**时才显示「选择片段以编辑参数」 |
| 加入片段 | 真正选中新片段（`setSelectedClipId`），检查器随之切换（这是 `client-timeline-effects` 4 个用例不改的关键） |
| 首次修改 fallback 参数 | 先把该片段写入选中态，再落库——避免「改了参数但未选中」的归属歧义 |
| 选中片段 | 片段条高亮（沿用 `iv-clip--sel`），检查器载入该片段 |
| 键盘操作 | 片段 `tabIndex=0`，Enter/Space 选中；检查器参数始终在 Tab 序列内（fallback 保证） |
| 删除选中片段 | 检查器回落到首个剩余片段（fallback）；无片段则回空态 |
| 分割 | 按钮仍在检查器里，但 `data-timeline-clip-split` 需要挂在**能定位到具体片段**的元素上——建议保留在片段条右下角（小图标，18px），因为「在片段上分割」比「在检查器里分割」更直观 |
| 拖拽 / 手柄 | 逻辑零改动；`laneRatio` 只依赖 lane 的 `getBoundingClientRect`，与片段内部布局无关 |
| 导出中 | 导出条原地变为两行：第一行参数置灰只读（避免边导边改），第二行状态 + 进度 + 「取消导出」；「注册为素材」仅在成功后出现，且与「开始导出」**不同排**（避免误点） |
| 导出完成 | 参数恢复可编辑，结果显示为条内一行（成功/失败 + 产物名 + 注册），不弹窗 |
| 缩放 | 0.5×–3×；`--iv-tl-zoom` 控制 `.iv-tl-lanes` 内层宽度，超出走横向滚动；缩放时保持播放头所在时间点居中 |

### 2.5 图标

| 位置 | 图标 | 存在 |
|------|------|------|
| pane 头 | `film` | ✅ |
| ffmpeg 状态 | `.iv-dot` | ✅ |
| 导出 | `download` | ✅ |
| 片段分类 | `image` / `film` / `music` / `subtitle`（`TRACK_ICONS` 已有） | ✅ |
| 检查器动作 | `storyboard`（分割）/ `copy` / `trash` | ✅ |
| 缩放 | `search` | ✅ |

**不新增图标**。emoji 一律不用。

---

## 三、样式改造方案

### 3.1 范围与类名占用核对

| 文件 | 改造 |
|------|------|
| `workbench-style.ts` | **不动**（`.iv-clip` / `.iv-tracks` / `.iv-transport` 是基线） |
| `modern-theme.ts` | 增量约 45 条 |
| `Workbench.tsx` | 顺序重排、片段条瘦身、检查器、刻度与播放头 |
| `locales.ts` | 新增 4 个 key |

新增类名核对（均 0 占用）：`.iv-tl-pane`、`.iv-clip-ins`、`.iv-clip-ins-grid`、`.iv-clip-ins-actions`、
`.iv-clip-ins-hint`、`.iv-clip-thumb`、`.iv-clip-split`、`.iv-tl-lanes`、`.iv-tl-bar`、`.iv-tl-export`、
`.iv-tl-status`、`.iv-tl-aux`、`.iv-tl-zoom`。

**不新增** `.iv-tl-progress`：既有 `.iv-progress`（`workbench-style.ts:447`）已含 `>i` 填充与 `--run` 动画，直接复用。

**不能动的名字**：`.iv-clip`、`.iv-clips`、`.iv-t-clip` 系列、`.iv-track`、`.iv-t-lane`、`.iv-playhead`、`.iv-monitor`、
`.iv-transport`、`.iv-scrub`——这些是既有基线，且被测试的几何断言间接依赖。

### 3.2 modern-theme.ts 新增规则（节选）

```css
/* 片段条：只放「位置 / 内容 / 手柄」 */
.iv .iv-clips{height:44px}
.iv .iv-clip{padding:0 6px;display:flex;flex-direction:column;justify-content:center;gap:0;overflow:hidden}
.iv .iv-clip-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42;border-radius:0}
.iv .iv-clip-top{position:relative;z-index:1;display:flex;align-items:center;gap:var(--iv-sp-2);min-width:0}
.iv .iv-clip-dur{font-variant-numeric:tabular-nums}
/* 片段可聚焦：否则参数搬走后键盘用户无法切换片段 */
.iv .iv-clip:focus-visible{outline:2px solid var(--iv-acc);outline-offset:1px}
/* 分割：命中区 ≥ 22px（18px 低于可用下限） */
.iv .iv-clip-split{position:absolute;right:2px;bottom:2px;z-index:2;display:inline-flex;
  align-items:center;justify-content:center;width:22px;height:22px;padding:0;
  border:0;border-radius:var(--iv-r-xs);background:color-mix(in srgb,var(--iv-bg) 55%,transparent);
  color:var(--iv-tx2);cursor:pointer;opacity:0;transition:opacity var(--iv-dur-1)}
.iv .iv-clip:hover .iv-clip-split,.iv .iv-clip:focus-within .iv-clip-split{opacity:1}
.iv .iv-clip-split:hover{color:var(--iv-tx)}

/* 时间轴整列：监视器是唯一弹性项，其余固定 —— 这样「同屏」由布局保证，不靠 magic number */
.iv .iv-tl-pane{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-height:0;height:100%}
.iv .iv-monitor{flex:1 1 auto;min-height:140px;max-height:clamp(160px,calc(100dvh - 520px),420px)}
.iv .iv-monitor img,.iv .iv-monitor video{max-width:100%;max-height:100%;width:auto}
@supports not (height:100dvh){.iv .iv-monitor{max-height:420px}}

/* 片段检查器 */
.iv .iv-clip-ins{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3);
  padding:6px 9px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv .iv-clip-ins-title{display:inline-flex;align-items:center;gap:var(--iv-sp-2);
  font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-clip-ins-hint{font-weight:var(--iv-fw-regular);color:var(--iv-tx3);margin-left:var(--iv-sp-2)}
.iv .iv-clip-ins-grid{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2) var(--iv-sp-3)}
.iv .iv-clip-ins .iv-input,
.iv .iv-clip-ins .iv-select{height:22px;font-size:var(--iv-fs-meta);width:64px}
.iv .iv-clip-ins .iv-select{width:88px}
.iv .iv-clip-ins-actions{display:flex;gap:var(--iv-sp-2);margin-left:auto}

/* 轨道区：播放头只覆盖 lanes */
.iv .iv-tl-lanes{position:relative}
.iv .iv-tl-zoom-track{width:calc(100% * var(--iv-tl-zoom,1));min-width:100%}

/* 导出条：常驻轨道下方（D1），第一行参数、第二行动作/进度 */
.iv .iv-tl-export{border-top:1px solid var(--iv-line);padding-top:var(--iv-sp-3)}
.iv .iv-tl-export .iv-tl-bar{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv .iv-tl-export[data-busy="true"] .iv-tl-params{opacity:.55;pointer-events:none}
.iv .iv-tl-status{display:inline-flex;align-items:center;gap:var(--iv-sp-2);
  font-size:var(--iv-fs-meta);color:var(--iv-tx2);white-space:nowrap}
/* 进度条：复用既有 .iv-progress（workbench-style.ts:447，含 --run 动画），
   只补一个弹性尺寸，不要另建 .iv-tl-progress */
.iv .iv-tl-export .iv-progress{flex:1 1 160px;min-width:120px}

/* 辅助折叠区 */
.iv .iv-tl-aux{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface)}
.iv .iv-tl-aux>summary{display:flex;align-items:center;gap:var(--iv-sp-3);padding:6px 9px;cursor:pointer;
  list-style:none;font-size:var(--iv-fs-meta);color:var(--iv-tx2)}
.iv .iv-tl-aux>summary::-webkit-details-marker{display:none}
.iv .iv-tl-aux-body{padding:8px 9px;border-top:1px solid var(--iv-line);display:grid;gap:var(--iv-sp-3)}

@media (prefers-reduced-motion:reduce){.iv .iv-clip{transition:none}}
```

### 3.3 约束

| 约束 | 说明 |
|------|------|
| 片段几何不变 | `left/width` 百分比定位、`position:absolute`、左右手柄位置全部保留，否则 `client-timeline-interaction` 的拖拽/手柄用例会挂 |
| 18px 控件全部淘汰 | 检查器里下限 22px，主线控件 28px |
| 无裸色 | `#9aa0a8` 换成 `var(--iv-tx2)`；`--iv-tx3` 只用于装饰性图标 |
| 无裸 `46px` | 播放头位置改用百分比 + 独立容器 |
| 双主题 | 字幕预览保留 `#fff`（成片语义，不属于主题）并加注释说明 |
| 动效 | 片段不加位移动画，只保留边框/阴影过渡 |

---

## 四、国际化（新增 2 个 key）

| key | en | zh-CN |
|-----|----|-------|
| `clipInspectorEmpty` | Select a clip to edit its parameters | 选择片段以编辑参数 |
| `tlAuxTools` | More tools | 辅助工具 |

导出条**不加标题文案**：靠左侧 `download` 图标 + 右侧 `exportStart`（已有「Export video」）作视觉锚点，省一个 key。
原 `exportDialog` 随 D1 取消浮层一并去掉；`clipTwoUnits` 确认不需要——起点/时长分两个字段，复用 `clipStart` / `clipDuration`。

现有 `clipStart` / `clipDuration` / `clipSpeed` / `clipFade` / `clipTransition` / `clipCrop*` / `styleFontSize`
**全部复用**——它们同时是 `aria-label` 的取值来源，改文案会连带改掉测试选择器。

---

## 五、测试影响预估

| 文件 | 用例 | 依赖 | 影响 |
|------|------|------|------|
| `tests/client-timeline-effects.test.tsx` | 4 | 直接 `querySelector('[aria-label^="Speed "]')`，**未先选片段** | 检查器「展示」第一段（fallback）→ **0 失败**；若改成「必须有选中才渲染」→ 4 个全挂 |
| `tests/client-timeline-interaction.test.tsx` | 10 | `data-timeline-clip`、`data-timeline-clip-handle`、lane 几何 | **0 失败**（几何与手柄不动） |
| `tests/client-timeline-keyboard.test.tsx` | 5 | 手柄键盘操作、`data-timeline-clip-split` | 0（分割按钮位置变但属性在） |
| `tests/client-segment-preview.test.tsx` | 3 | `data-seg-preview`、`data-seg-counter` | 0（移入折叠区仍在 DOM） |
| `tests/client-export-panel.test.tsx` | 4 | 三个下拉 + `data-timeline-export` **直接取，不点开任何浮层** | **0 失败**（导出条常驻，见 D1） |
| `tests/client-a11y.test.tsx` | 4 | 三个下拉的 `aria-label` | 0（常驻在 DOM，无需展开） |
| `tests/workbench.client.test.tsx` | 42（其中 1 处点 `data-timeline-burn`） | `[data-timeline-burn]` 直接点击 | 0（checkbox 移到导出条仍在 DOM 且可见） |
| `tests/client-design-system.test.tsx` | 31 | `[data-timeline-export]` 存在性 | 0（按钮仍在） |
| `tests/client-export-history.test.tsx` | — | `[data-timeline-export]` 点击 | 0 |

**合计**：**0 个既有用例需要改写**——这是 D1 选「常驻轨道下方」的直接收益，也是本方案唯一可能拖累交付节奏的地方，现在没有了。

---

## 六、实施步骤

### Step 0 — 体积基线留证
当前：入口 24,231 B（88%）、总产物 1,490,659 B（106%，超 86,659 B）。**先留证。**

### Step 1 — 顺序重排 + ffmpeg 降级（低风险，先拿同屏收益）
监视器 → transport → 轨道保持相邻；ffmpeg 行并入 pane 头色点；导出区块移到轨道之后。
验证：`client-design-system` 里 `[data-timeline-export]` 存在性仍通过；`client-export-panel` 4 用例（应保持绿）。

### Step 2 — 片段条瘦身 + 检查器
先把 13 个控件从 `.iv-clip` 搬到 `.iv-clip-ins`，**检查器默认选中第一段**；再改样式。
验证：`client-timeline-effects` 4 用例 + `client-timeline-interaction` 10 用例。

### Step 3 — 导出条成型（D1：常驻，不做浮层）
把两个 checkbox 从 pane 头下移到导出条；参数行 + 动作行分组；导出中置灰参数、第二行显示状态/进度/取消；`data-busy` 挂在容器上。
验证：`client-export-panel` / `client-a11y` / `workbench.client`（**均无需改动，直接跑**）。

### Step 4 — 播放头与刻度
`.iv-tl-lanes` 包住轨道；播放头改百分比；刻度随缩放 6–12 格；缩放接 `--iv-tl-zoom`。
验证：`client-timeline-interaction` 的播放头跟随用例。

### Step 5 — 辅助折叠区
逐段预览 / 配音 / 多比例收进 `iv-tl-aux`。
验证：`client-segment-preview` 3 用例。

### Step 6 — 样式与契约
`modern-theme.ts` 增量；补 2 条契约；typecheck + vitest + `check-bundle`。

---

## 七、不在本次范围

| 项目 | 说明 |
|------|------|
| 视频片段缩略图（首帧） | 需要宿主抽帧接口或 `video` 元素取帧，成本高、性能风险大；本批只给**图片类片段**上缩略底 |
| 音频波形 | 同上，需要音频解码 |
| 轨道静音 / 独奏 / 锁定 | 涉及域模型与导出行为，单独排期 |
| 多轨拖拽重排 / 轨道增删 | 域层未支持 |
| 监视器播放与时间轴播放头联动 | 这是 1.2 的根治方向，但需要播放时钟统一，属于**下一批**（本批只做「减少播放器数量」） |
| 转场可视化（片段间叠化指示） | 需要额外渲染层 |

---

## 八、验证清单

- [ ] 首屏（900px **与 768px** 高窗口各测一次）能同时看到监视器、三条轨道与导出条第一行，无需滚动（用 `getBoundingClientRect().bottom ≤ innerHeight` 断言，不靠目测）
- [ ] 监视器是唯一可伸缩项：窗口变矮时只有它缩小，轨道/检查器/导出条宽度与高度不变
- [ ] 键盘：Tab 可达片段，Enter/Space 切换选中；检查器参数始终在 Tab 序列内（无选中时走 fallback）
- [ ] 片段条只剩：缩略底 / 图标 / 名 / 时长 / 左右手柄；**点击不再出现一堆输入框**
- [ ] 选中片段 → 检查器载入；**未选中但有片段 → 展示第一段并标 `fallback`（片段不高亮）**；无片段 → 显示引导；删除后回落正确
- [ ] fallback 状态下「分割/复制/删除」不可点；首次修改任一参数即自动选中该片段
- [ ] 检查器里速度 / 淡入 / 转场 / 裁剪 / 字幕样式全部可用，且与落库一致（去抖后读 `timelines[0]`）
- [ ] 拖拽移动、左右手柄改起止、分割、复制、Delete 删除、键盘微调全部行为不变
- [ ] 缩放滑杆改变轨道密度与刻度数量；缩放后播放头仍对准同一时间点
- [ ] 导出条常驻在轨道下方（不是浮层、不是头部按钮）：三项设置 + 两个开关直接可见可改
- [ ] 导出中：参数行置灰不可改；状态 / 进度 / 取消在同一区块第二行；成功后「注册为素材」出现
- [ ] 导出全程页面不出现浮层，也没有因导出而起的高度抖动
- [ ] 逐段预览在「辅助」里仍能播放、计数正确（`data-seg-counter`）
- [ ] 浅色主题下监视器空态文字可读（不再硬编码 `#9aa0a8`）
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm exec vitest run tests/client-timeline-*.test.tsx tests/client-segment-preview.test.tsx tests/client-export-panel.test.tsx tests/client-a11y.test.tsx` 全绿
- [ ] `node scripts/check-bundle-size.mjs`：总产物增量 ≤ 8 KB

---

## 九、事实核对（v1.0 复核）

### 9.1 已核实

| # | 事实 | 证据 |
|---|------|------|
| 1 | 导出区块在监视器之前 | `Workbench.tsx:4067`（导出）vs `4173`（监视器） |
| 2 | 单个片段内部 13 个 `<input>/<select>` | `Workbench.tsx:4292-4489` 静态统计 |
| 3 | 片段容器 58px 高 + `overflow:hidden`，控件 18px | `workbench-style.ts:684-687,713` |
| 4 | 缩放滑杆 `defaultValue` 且无 `onChange` | `Workbench.tsx:4214` |
| 5 | 刻度固定 `[0,25,50,75,100]` 五格 | `Workbench.tsx:4221-4226` |
| 6 | `46px` 同时出现在 JSX 与 CSS | `Workbench.tsx:4229`；`workbench-style.ts:670,676` |
| 7 | 监视器空态硬编码 `#9aa0a8` | `Workbench.tsx:4176` |
| 8 | 两个播放器并存 | `TimelineSegmentPreview`（`4062`）与 `.iv-monitor`（`4173`） |
| 9 | 特效检查器相关测试**不先选片段** | `tests/client-timeline-effects.test.tsx:46,50,60,67` |

### 9.2 未核实

| # | 待确认项 | 影响 |
|---|----------|------|
| 1 | 逐段预览与监视器是否有意设计成两种用途 | 若是（逐段=粗看、监视器=精看），D2 的「降级」仍成立，但文案要写清区别 |
| 2 | `.iv-clips{height:58px}` 改成 44px 是否影响拖拽命中率 | 44px 仍高于 24px 最小命中，但需真机确认 |
| 3 | 配音卡 `VoiceCard` 的实际高度 | 决定「辅助」折叠能省多少 |
| 4 | 缩放实现是否与 xyflow 无关 | 时间轴不是 xyflow，无冲突；仅需确认 `--iv-tl-zoom` 不影响 `laneRatio` 计算（它用 rect 宽度，缩放后 rect 变宽 → 需同步换算，**这是 Step 4 的唯一风险点**） |

### 9.3 已推翻的假设

| 假设 | 事实 |
|------|------|
| 「把片段参数搬进检查器，测试会大面积挂」 | **不会**。`clipStart` / `clipDuration` / `clipCrop*` / `styleFontSize` 在测试中**零引用**；只有 Speed / Fade / Transition / TransitionDuration 4 处，靠「默认选中第一段」即可保住 |
| 「缩放滑杆只是没做出效果」 | 比这更糟：它有 `aria-label`、会被读屏软件播报，但完全不响应操作——**可访问性上是错的**，不只是难看 |
| 「逐段预览可以直接删」 | **不能**。`client-segment-preview.test.tsx` 3 个用例依赖 `data-seg-preview` / `data-seg-counter`，且它是「视频轨顺序播放」的唯一入口，删掉等于砍功能 |

---

## 十、风险与待拍板

1. ~~D1（导出浮层）会动 3 个测试文件~~ **已消除**：D1 定为「常驻轨道下方」，0 测试改动。新风险只有一条——导出条常驻会让 pane 总高比浮层方案多约 40px（参数行 + 动作行），900px 窗口下可能需要滚动才能点到「开始导出」。缓解：参数与动作**合并为一行**（宽屏），仅在窄屏（<760px）换行；导出中才展开第二行。
2. **D3（检查器默认选中第一段）** 是保住 4 个用例的关键设计，但它也意味着「进页面就有一段时间轴处于选中态」。若你觉得这有歧义，替代方案是改测试（4 行 `fireEvent.click`）。
3. **Step 4 的缩放**是唯一有真实技术风险的一步：`laneRatio` 依赖 lane 的 `rect.width`，缩放后必须把 `zoom` 计入换算，否则拖拽落点会偏移。建议单独提交、单独验证。
4. 体积：预计 +6～8 KB raw。当前 106%（超 86,659 B）。**基线抬不抬这个决策已经悬了三轮**，本批若再不做，门禁会持续为红，后续每个批次都要重复解释一次。

---

## 十一、决策记录

| 日期 | 决策 | 结论 | 依据 |
|------|------|------|------|
| 2026-11-26 | D1 导出入口 | **常驻轨道下方**（废弃头部浮层方案） | ① 三个下拉 + 两个开关都是高频确认项，藏进浮层等于每次多点一次；② 两个 checkbox 属于时间轴数据而非导出临时参数，放在导出条语义更准；③ 0 测试改动，省掉 3 个测试文件的联合修改；④ 导出是终结动作，滚动成本可接受 |
| 2026-11-26 | D3 检查器默认选中 | 维持原方案：默认选中第一段 | 保住 `client-timeline-effects` 4 个用例；替代方案（改测试）多改 4 行且丢一致性 |

> 未决：D2（逐段预览降级）、D4（两个 checkbox 位置，现已随 D1 落定在导出条）、D5（ffmpeg 色点）、D6（缩放接真值）——均按原建议执行，无备选冲突。

---

## 十二、v1.2 复核：可行性与必修项

### 12.1 结论

**方向正确，但 v1.1 的核心验收标准与目标形态互相矛盾，需按本节修订后实施。**

三处硬伤：

1. **「同屏」被目标形态自己破坏**——v1.1 把监视器从 168px 抬到 `min(46vh,420px)`，在 900px 窗口下约 414px，**比现状多占 246px**；而 §1.1 的原始诊断恰恰是「758px 已经装不下」。用固定的 `46vh` 换固定的 `168px`，只是把溢出换了个位置。
2. **D3 的措辞与伪代码不一致**——D3 表/§2.4 写「默认选中第一段」，§2.3 的 `?? first` 实际是「展示但不选中」。两种实现后果不同（前者进页面就有选中态、Delete 有误删风险）。
3. **参数搬走后缺键盘选中路径**——片段是可点 `<div>`，无 `tabIndex`；`client-timeline-keyboard` 覆盖的是手柄，不是片段选中。

### 12.2 高度预算（900px 高窗口，页面外壳按 120px 估）

| 区块 | 高度 | 策略 |
|------|------|------|
| pane 头 | 30 | 固定，单行 |
| **监视器** | **余量** | `flex:1 1 auto`；`min-height:140`；`max-height:clamp(160px, 100dvh - 520px, 420px)` |
| transport | 34 | 固定 |
| 刻度 | 22 | 固定 |
| 三条轨道 | 132（3×44） | 固定 |
| 片段检查器 | 54 | 固定，单行 + 动作 |
| 导出条 | 62 | 参数行；导出中展开第二行 |
| 间距 | 36（6×6） | `--iv-sp-3` |
| **固定合计** | **≈370** | |

900px 窗口：可用 ≈780 → 监视器 ≈410（在 cap 内），轨道与导出条全在首屏。
768px 窗口：可用 ≈648 → 监视器 ≈278，**仍然同屏**。

这就是本题的正解：**不要给监视器定高，让它吃掉余量**。任何写死的 `vh` 都会在某一档窗口失效。

### 12.3 必修项

| # | 级别 | 问题 | 修订 |
|---|------|------|------|
| M1 | **P1** | 片段无键盘可达性，参数搬走后多片段无法用键盘切换 | 片段加 `tabIndex=0` + `role="group"` + `aria-current` + Enter/Space 选中（§2.3 已给代码）；检查器 fallback 常驻，保证参数永远在 Tab 序列内 |
| M2 | **P1** | D3 三处口径不一致 | 统一为「**展示**第一段（`fallback=true`，不写选中态）」；fallback 下禁用分割/复制/删除；首次改参数自动选中。D3 表、§2.3、§2.4、§八 已同步 |
| M3 | **P1** | `min(46vh,420px)` 与「同屏」目标冲突 | 按 12.2 改为弹性监视器，删掉 `46vh` |
| M4 | **P2** | 监视器变高但媒体仍被 `max-height:200px` 卡住 → 大面积留白 | 同时改 `workbench-style.ts:649` 为 `max-height:100%`（§3.2 已补） |
| M5 | **P2** | `.iv-tl-progress` 与既有 `.iv-progress` 重复 | 复用 `.iv-progress`，只补弹性宽度 |
| M6 | **P2** | 分割按钮在 §2.3 伪码里漏了；放回片段后若不 `stopPropagation` 会连带切换选中 | 已补：22px 命中区 + `stopPropagation` |
| M7 | P3 | 空态用 `--iv-tx3` 对比度不足（引导文案属正文） | 改 `--iv-tx2` |
| M8 | P3 | Step 4 把播放头、刻度、缩放在一步做，风险混在一起 | 拆 4a（播放头/刻度，纯 DOM 位移）与 4b（缩放）。缩放换算只认「内层 zoomed lane 的 rect」，**不要拿外层滚动容器再除一次 zoom** |

### 12.4 与另两份方案共享的原语

pane 头、分段/标签、`<details>` 折叠、状态胶囊一律按 `SCRIPT-PANE-REDESIGN.md` §11.3 执行；本方案的 `iv-tl-*` 只保留时间轴独有部分（轨道压缩、导出条、辅助区）。**禁止**为时间轴另建一套 pane 头或分段控件。

---

## 十三、实施记录（2026-11-26）

| Step | 状态 | 落地要点 |
|------|------|----------|
| 0 体积基线 | ✅ | 开工前总产物 1,536,507 B（109%，既有超限） |
| 1 顺序重排 + ffmpeg 降级 | ✅ | 监视器 → transport → 轨道 → 检查器 → 导出条 → 辅助；ffmpeg 收成 pane 头 chip，不可用时才展开 message + 重新检测 |
| 2 片段条瘦身 + 检查器 | ✅ | 片段只剩缩略底/图标/名/时长/手柄/分割；检查器 `fallback` 展示首段、动作禁用、首次改参数自动选中 |
| 3 导出条成型（D1 常驻） | ✅ | 参数行 + 两个开关 + 开始导出；导出中参数置灰、第二行状态/进度/取消/注册 |
| 4 播放头 + 刻度 + 缩放 | ✅ | `--iv-tl-head-w` 单变量三处引用；刻度 6/8/12；缩放 0.5–3×，横向滚动，缩放后播放头居中 |
| 5 辅助折叠区 | ✅ | `<details>` 收逐段预览 / 配音 / 多比例 |
| 6 样式与契约 | ✅ | `modern-theme.ts` +45 条；新增 8 例测试 |

### 与方案的三处偏差（都是实现时发现的事实）

1. **「0 个既有用例需要改写」不成立**：`client-timeline-interaction` 有 5 个用例从 `[data-timeline-track="video"] input` 按索引读片段参数（起点/时长/速度），`workbench.client` 有 1 处读字幕 `input[type=color]`。参数搬进检查器后这些选择器必然落空，已改成从 `[data-timeline-clip-inspector]` 读，**断言意图不变**（落点换算、手柄守恒、分割守恒、复制偏移）。
2. **fallback 下禁用复制/删除**：按 M2 执行后，「复制片段」用例改为先点选片段再点复制（原来未选中直接点）。
3. **加入片段自动选中**：§2.4 要求，实现于 `appendClip`；顺带让「加字幕→改字幕样式」用例自然读到正确对象。

### 体积

总产物 1,536,507 → 1,552,339 B（**+15.8 KB** raw，111%），超出本节预估的 +≤8 KB。增量主要在检查器 JSX（13 个控件 + 标签）与 45 条样式；同批删掉 6 条已死的片段内表单规则。

### 未做（按 §七 范围）

视频胶片条 / 音频波形 / 轨道静音·独奏·锁定 / 监视器与播放头统一时钟 / 转场可视化。`docs/research/timeline-editor-references.md` 给出了下一批优先级（pps 坐标系、刻度函数、吸附、胶片条、轨道三键、单一时钟）。
