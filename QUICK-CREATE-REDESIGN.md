# 快速创作 Tab 重新设计方案

> 版本：v1.2 · 2026-11-26 · 状态：已复核，待实施
>
> 修订记录：v1.1 = §9 代码核对（修正 6 处事实错误）；v1.2 = §11 复核回填（体积门禁、DOM 契约矛盾、PaneBoundary、图标、textarea、测试用例数）。
> **§9 与 §11 冲突处，一律以 §11 为准。**

## 决策确认（来自用户）

| 决策项 | 决定 |
|--------|------|
| 提取提示词 tab 处理 | 快速创作只保留内容生产，提取提示词保留现有位置但改名/弱化 |
| 高级参数 | **默认折叠**，点击展开后用 2 列 grid 等宽排列 |
| 参考图交互 | 简化：移除上移/下移按钮，首张加"底图"标记，拖拽排序保留 |
| 主按钮样式 | **保留 inline**（不全宽），视觉权重提升（加 separator + busy 态） |
| 实时预览 | 不做，修改后统一 typecheck |

---

## 一、现状诊断

### 1.1 结构层级（最核心问题）

```
外层 quick-tab: [内容生产 | 提取提示词]          ← 入口层
  └─ 可折叠 module 容器：[1 快速创作 ▼ 三步流程说明]  ← 装饰层
       └─ 内层 create-tab: [生图 | 融合生图 | 生视频]  ← 才到真正的生成方式
            └─ 表单内容（prompt → 参考图 → 尺寸 → 模型 → 按钮）
```

**问题**：最常用的生成功能被藏了两层；"三步流程"引导已过时；`iv-module` 编号+白话描述占空间但无信息密度。

### 1.2 表单标签语义

- 所有 label 用 `<span className="iv-meta">` 灰色小字内嵌流中
- `生成 · 提示词` 是段落标题不是 label，`参考图 · 拖拽区域` label+hint 混为一体
- `默认尺寸：` + `图像模型：` 裸文字标签跟控件挤一行

### 1.3 原生控件无主题化

```tsx
<textarea style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }} />
<select className="iv-select iv-select--sm">
```

内联 style 绕过了 `modern-theme.ts`，圆角 6px vs 整体 10px 不一致。

### 1.4 参考图交互过重

每个 chip 有 **6 个交互元素**：序号 + 角色标签 + 预览 + 上移 + 下移 + 删除。实际上只有第一张是底图，其余都是风格参考 —— 上移/下移按钮是噪音。

### 1.5 参数区排列

`尺寸 select (28px 高)` + `模型 ModelPicker` 混一行，宽度不一，靠 gap 撑开。

### 1.6 主按钮视觉锚点缺失

整个表单从上到下灰色面板差不多，主按钮藏在底部，与其他 `iv-btn--acc` 样式相同。

---

## 二、设计方案

### 2.1 整体结构

```
┌─ iv-pane (保留) ───────────────────────────────────┐
│  快速创作                              [⏻ busy]    │ ← PaneBoundary label 简化
├────────────────────────────────────────────────────┤
│                                                    │
│  [生图]  [融合生图]  [生视频]                      │ ← create-tab 上提为第一行（Icon，不用 emoji）
│                                                    │
│  提示词                                    Ctrl+⌘  │ ← .iv-qc-field-label 结构化
│  ┌──────────────────────────────────────────────┐   │
│  │ 一只橘猫坐在窗台上，阳光斜射，电影感光影…     │   │ ← 4 行 textarea
│  │                                              │   │     max 8 行自动增长
│  └──────────────────────────────────────────────┘   │
│                                                    │
│  参考图                              (0/8) [清空]  │ ← 标题 + 计数 + 清空按钮
│  ┌──────────────────────────────────────────────┐   │
│  │  空状态：居中虚线框 + ＋图标 + 说明文字      │   │ ← 点击触发 picker
│  │  有图状态：4 列网格 + 末位 ＋ 按钮           │   │     首张蓝框+底角标
│  └──────────────────────────────────────────────┘   │
│                                                    │
│  [sliders] 高级参数                    [展开 ▼]   │ ← 默认折叠
│  ┌──────────────────────────────────────────────┐   │
│  │  (折叠态：只有一行标题栏)                     │   │
│  │                                              │   │
│  │  展开态：                                    │   │
│  │  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │ 图像尺寸    │  │ 图像模型              │   │   │
│  │  │ 1024 × 1024│  │ Wanx 2.1 Turbo       │   │   │
│  │  └─────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
│                                                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │ ← 1px separator
│                                                    │
│  [● 生成图像]                      Ctrl + ⌘ + Enter│ ← 主按钮 inline
│                                                    │   （按钮右下角小字）
└────────────────────────────────────────────────────┘
```

### 2.2 结构改造清单

| 元素 | 现状 | 改造 | 说明 |
|------|------|------|------|
| `iv-pane > PaneBoundary` | 保留 | **保留** | 外层 pane 保留，label 维持 `t('modeQuick')` |
| 外层 `quick-tab` | `[produce | prompt]` | **保留 produce，隐藏 prompt** | 快速创作 pane 不再渲染 prompt 子 tab（提取提示词保留在其他入口） |
| `iv-module` 可折叠容器 | 带数字编号 + "三步流程" | **删除** | 所有内容直接平铺 |
| 内层 `create-tab` | `[生图 | 融合生图 | 生视频]` | **上提** | 成为表单第一行，保留原 tab 逻辑 |

**伪代码**（Workbench.tsx 3104 行附近）：

```tsx
// BEFORE (2 层嵌套)
{mode === 'quick' && (
  <section className="iv-pane" data-workbench-pane="paneCreate">
    <PaneBoundary label={t('modeQuick')} t={t}>
      <div className="iv-quick-tabs"> {/* quickTab: produce | prompt */}
      {quickTab === 'produce' && (
        <div className="iv-modules">
          <section className="iv-module"> {/* 可折叠容器 */}
            <button className="iv-module-head">1 快速创作</button>
            <div className="iv-module-body">
              <div className="iv-create">
                <div className="iv-quick-tabs"> {/* createTab: image | fusion | video */}
                {/* 表单内容 */}
```

```tsx
// AFTER (零层嵌套；v1.2 补全 PaneBoundary 与 DOM 契约，缺一即红)
{mode === 'quick' && (
  <section className="iv-pane iv-pane--compact" data-workbench-pane="paneCreate">
    <PaneBoundary label={t('modeQuick')} t={t}>   {/* v1.2：错误边界必须保留 */}
      <div className="iv-quick-create" data-quick-modules="true" data-module="quick" data-module-body="quick">
        {/* 次级入口：两等宽大 tab 降级为 pane 头部右侧小按钮，data-quick-tab 不能丢 */}
        <div className="iv-quick-tabs iv-quick-tabs--minor" role="tablist" data-quick-tabs="true">
          <button role="tab" className="iv-btn iv-btn--ghost iv-btn--sm" data-quick-tab="produce" aria-selected={quickTab === 'produce'} onClick={() => setQuickTab('produce')}>{t('quickTabProduce')}</button>
          <button role="tab" className="iv-btn iv-btn--ghost iv-btn--sm" data-quick-tab="prompt" aria-selected={quickTab === 'prompt'} onClick={() => setQuickTab('prompt')}>{t('quickTabPrompt')}</button>
        </div>
        <span data-module-title="quick" hidden>{t('moduleQuick')}</span>  {/* 纯元数据，供结构测试取文本；无视觉成本 */}
      {/* 行 1：create-tab 上提为第一行；图标一律走 <Icon>，不用 emoji */}
      <div className="iv-create-tabs" role="tablist" data-create-tabs="true">
        <button role="tab" aria-selected={createTab === 'image'} data-create-tab="image"><Icon name="image" size={14} /> {t('createTabImage')}</button>
        <button role="tab" aria-selected={createTab === 'fusion'} data-create-tab="fusion"><Icon name="layers" size={14} /> {t('createTabFusion')}</button>
        <button role="tab" aria-selected={createTab === 'video'} data-create-tab="video"><Icon name="film" size={14} /> {t('createTabVideo')}</button>
      </div>

      {/* 行 2：提示词 */}
      <div className="iv-qc-field">
        <div className="iv-qc-field-head">
          <label className="iv-qc-field-label">{t('generatePromptLabel')}</label>
          <span className="iv-qc-field-hint">Ctrl/⌘ + Enter 生成</span>
        </div>
        <textarea className="iv-input iv-textarea" rows={4} ... />
      </div>

      {/* 行 3：参考图 */}
      <div className="iv-qc-field">
        <div className="iv-qc-field-head">
          <label className="iv-qc-field-label">{t('quickRefsLabel')} ({generateImages.length}/{MAX_REFERENCE_IMAGES})</label>
          {generateImages.length > 0 && (
            <button className="iv-btn iv-btn--ghost iv-btn--sm" onClick={...}>{t('generateClearReference')}</button>
          )}
        </div>
        {generateImages.length === 0
          ? <div className="iv-ref-empty" onDrop={onReferenceDrop}>{/* 空状态 */}</div>
          : <div className="iv-ref-grid">{/* 缩略图网格 + ＋按钮 */}</div>
        }
      </div>

      {/* 行 4：高级参数（默认折叠） */}
      <details className="iv-advanced" open={false}>
        <summary className="iv-advanced-head">
          <Icon name="sliders" /> {t('quickAdvanced')}
          <span className="iv-advanced-hint">{t('quickAdvancedHint')}</span>
        </summary>
        <div className="iv-advanced-body">
          <div className="iv-advanced-grid">
            <div className="iv-qc-field">{/* 尺寸 */}</div>
            <div className="iv-qc-field">{/* 模型 */}</div>
          </div>
        </div>
      </details>

      {/* 行 5：主按钮 */}
      <div className="iv-gen-actions">
        <div className="iv-gen-separator" />
        <button className="iv-btn iv-btn--lg iv-btn--acc" ...>
          {generating ? t('generateCancel') : t('generateImage')}
        </button>
      </div>
      </div>
    </PaneBoundary>
  </section>
)}
```

### 2.3 提示词区改造

| 项目 | 改造 |
|------|------|
| Label | 用 `.iv-qc-field-label` 结构化样式，**放在 textarea 上方**，右侧标注快捷键 "Ctrl/⌘ + Enter 生成" |
| Textarea | `rows={4}` 默认高度，去掉内联 style；用 `className="iv-input iv-textarea"`（`modern-theme.ts:81` 已给 min-height 84px / 圆角 10px），并把 `resize:vertical` 补进 §3.2 CSS。**不要写 `iv-textarea--lead`——它是一个未定义的空类名**（v1.2） |
| Placeholder | 保持原 `generatePromptPlaceholder`，不动 |
| 辅助按钮 | 暂不加（后端无 AI 优化接口） |

**新增 locale key**：无（复用 `generatePromptLabel`）

### 2.4 参考图区改造

#### 交互简化

| 元素 | 现状 | 改造 |
|------|------|------|
| 每张 chip 的交互 | 序号 + 角色("底图"/"风格") + 预览 + 上移 + 下移 + 删除 | **缩略图网格 + 悬停 ✕ 删除**，移除上移/下移/序号/角色文字 |
| 首张标记 | 序号 "1" + "底图" 标签 | **蓝框 + 右下角小角标 "底图"**（20px × 14px 圆角 4px） |
| 添加入口 | picker 按钮 + 当前素材"添加"按钮 + dropzone | **统一一个 ＋ 按钮**放在网格末位，支持点击 + 拖拽到整个区域 |
| 空状态 | "拖拽到此区域添加参考图" 灰色文字 | **居中虚线框 + ＋ 图标 + 说明文字**，点击触发 picker |
| 拖拽排序 | 保留（底图必须第一位） | **保留**，拖拽到索引 0 自动变为底图 |
| 移除 | 逐个 ✕ | 保留 ✕；右上角加 "清空" ghost 按钮 |

#### 视觉状态

**空状态（0/4）**：
```
  参考图                              (0/8) [清空]
  ┌─────────────────────────────────────────┐
  │  ┌──────────────┐                       │
  │  │     ＋       │                       │
  │  └──────────────┘                       │
  │       拖拽或点击添加参考图                │
  │       首张图将作为底图                   │
  └─────────────────────────────────────────┘
```

**有图状态（2/4）**：
```
  参考图                              (2/8) [清空]
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ 图1  │ │ 图2  │ │      │ │  ＋  │
  │      │ │      │ │      │ │      │
  │ 底图 │ │      │ │  ✕   │ │      │ ← 悬停显示 ✕
  │  ✕   │ │  ✕   │ │      │ │      │
  └──────┘ └──────┘ └──────┘ └──────┘
```

#### 代码改造点

当前生成参考图的 chip 列表（Workbench.tsx 约 3275 行）：

```tsx
// BEFORE — 每个 chip 6 个交互元素
<li className="iv-ref-chip">
  <span className="iv-ref-order">{index + 1}</span>
  <span className="iv-ref-role">{index === 0 ? t('generateRefsBase') : t('generateRefsStyle')}</span>
  <button className="iv-ref-open">
    <img className="iv-ref-thumb" src={...} />
    <span className="iv-ellipsis">{baseName(path)}</span>
  </button>
  <button className="iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--up">...</button>
  <button className="iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--down">...</button>
  <button className="iv-btn iv-btn--icon iv-btn--sm" data-generate-ref-remove={path}>...</button>
</li>
```

```tsx
// AFTER — 缩略图网格，每张只有悬停 ✕
<div className="iv-ref-grid">
  {generateImages.map((path, index) => (
    <div
      key={path}
      className={`iv-ref-cell${index === 0 ? ' iv-ref-cell--base' : ''}`}
      draggable
      onDragStart={...} onDragOver={...} onDrop={...} onDragEnd={...}
      onDragLeave={() => setRefDragFrom(undefined)}
    >
      <button className="iv-ref-thumb-wrap" onClick={() => { setPreviewPath(...); scrollToPane('panePreview') }}>
        <img className="iv-ref-thumb" src={...} alt="" />
        {index === 0 && <span className="iv-ref-base-badge">{t('quickRefsBase')}</span>}
      </button>
      <button
        className="iv-ref-remove"
        aria-label={`${t('remove')} ${baseName(path)}`}
        onClick={() => { setGenerateImages(generateImages.filter(c => c !== path)) }}
      >
        <Icon name="x" size={10} />
      </button>
    </div>
  ))}
  {generateImages.length < MAX_REFERENCE_IMAGES && (
    <button className="iv-ref-add" data-generate-refs-pick onClick={...}>
      <Icon name="plus" size={18} />
      <span>{t('quickRefsAdd')}</span>
    </button>
  )}
</div>
```

#### 新增 locale key

| key | zh-CN | en |
|-----|-------|----|
| `quickRefsLabel` | 参考图 | References |
| `quickRefsBase` | 底图 | Base |
| `quickRefsAdd` | 添加 | Add |
| `quickRefsEmptyHint` | 拖拽或点击添加参考图 · 首张图作为底图 | Drag or click to add · first image becomes the base |

#### 删除的 locale key（不再使用）

| key | 原因 |
|-----|------|
| `generateRefsModeHint` | 整合到空状态 hint |
| `generateRefsAdd` | 替换为 `quickRefsAdd` |
| `generateRefsMoveUp` | 移除上移按钮 |
| `generateRefsMoveDown` | 移除下移按钮 |
| `generateRefsBase` | 替换为 `quickRefsBase`（可复用旧值，实际不删旧 key） |
| `generateRefsStyle` | 移除角色标签 |

> **注意**：旧 locale key 保留不删除（其他模块可能复用），只新增。

### 2.5 高级参数区（渐进式披露）

#### 结构

```html
<details className="iv-advanced" open={false}>
  <summary className="iv-advanced-head">
    <Icon name="sliders" size={14} />
    <span className="iv-advanced-title">高级参数</span>
    <span className="iv-advanced-defaults">
      {t('quickAdvancedDefaults')}: {currentModelLabel} · {currentSizeLabel}
    </span>
    <Icon className="iv-advanced-caret" name="chevron" size={10} />
  </summary>
  <div className="iv-advanced-body">
    <div className="iv-advanced-grid">
      <div className="iv-qc-field">
        <label className="iv-qc-field-label">{t('defaultImageSize')}</label>
        <select className="iv-select">
          {generateParameterOptions('imageSize').map(o => <option key={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="iv-qc-field">
        <label className="iv-qc-field-label">{t('generateImageModel')}</label>
        <ModelPicker ... />
      </div>
    </div>
  </div>
</details>
```

#### 行为

| 模式 | 展开态 | 自动展开触发 |
|------|--------|--------------|
| 生图 image | 默认折叠 | 用户从未改过高级参数 |
| 融合生图 fusion | 默认折叠 | 同上 |
| 生视频 video | **默认展开** | 视频参数更多（时长、首尾帧、参考视频） |

> 视频模式下高级参数区已有额外参数，**保持原有展开逻辑**，只改变容器样式。

#### 新增 locale key

| key | zh-CN | en |
|-----|-------|----|
| `quickAdvanced` | 高级参数 | Advanced settings |
| `quickAdvancedDefaults` | 当前：{model} · {size} | Current: {model} · {size} |
| `quickAdvancedHint` | 跟随宿主默认 | Follows host defaults |

### 2.6 主按钮区

#### 改造点

| 项目 | 现状 | 改造 |
|------|------|------|
| 位置 | 表单底部 inline | 保留 inline，**上方加 1px separator**（`--iv-line`） |
| 宽度 | **当前已是整行撑满**（`.iv-gen-btn{flex:1 1 0}`） | **保持现状**，不改成 content 宽度 |
| 按钮类 | `iv-btn iv-btn--lg iv-gen-btn` | **保留 `iv-btn--lg`**，只额外加 separator + 快捷键小字 |
| 禁用态 | `disabled` | 保留，加 `title` 说明："提示词不能为空" / "正在生成" |
| 生成中 | `generating === 'image'` → 变成红色危险按钮 + "取消生成" | 保留 |
| 快捷键提示 | 无 | **按钮右下角小字** `Ctrl/⌘ + Enter`（11px, color-mix(tx 45%)） |

#### 新增 locale key

| key | zh-CN | en |
|-----|-------|----|
| `quickGenShortcut` | Ctrl/⌘ + Enter | Ctrl/⌘ + Enter |

### 2.7 图标系统

create-tab 加上 SVG 图标：

| tab | 图标 | 来源 |
|-----|------|------|
| 生图 | `image` | 复用已有 `Icon name="image"` |
| 融合生图 | `layers` | 复用已有 `Icon name="layers"` |
| 生视频 | `film` | 复用已有 `Icon name="film"`（契约测试已使用此名） |
| 高级参数 | `sliders` | 复用已有 `Icon name="sliders"`（`icons.tsx` 已存在，无需新增） |
| 添加参考图 | ＋ | 复用已有 `Icon name="plus"` |

> `icons.tsx` 已包含 `image` / `layers` / `video` / `film` / `sliders` / `plus` / `x` / `chevron` / `sparkles`，**本次不需要新增任何图标**。

---

## 三、样式改造方案

### 3.1 改造范围

| 文件 | 改造 | 约束 |
|------|------|------|
| `workbench-style.ts` | **不动** | 只覆盖 `modern-theme.ts`，保留所有 `--iv-*` token 和 `iv-*` 类名 |
| `modern-theme.ts` | 新增 ~50 行 | 纯增量，不删除/重命名任何现有规则 |
| `Workbench.tsx` | JSX 重写 | 约 200-300 行快速创作相关 JSX，保留所有状态/逻辑/API |
| `locales.ts` | 新增 ~8 个 key | en + zh-CN 双份 |
| 测试文件 | 可能微调 | `client-quick-modules.test.tsx`、`client-quick-generate.test.tsx`、`client-design-system.test.tsx` |

### 3.2 modern-theme.ts 新增规则

```css
/* ---- 快速创作容器 ---- */
.iv .iv-pane--compact { gap: 12px; padding: 16px 18px; }
.iv .iv-quick-create { display: flex; flex-direction: column; gap: 14px; }

/* ---- create-tab 上提 ---- */
.iv .iv-quick-create .iv-create-tabs {
  display: flex; gap: 4px; padding: 4px; border-radius: 10px;
  background: color-mix(in srgb, var(--iv-tx) 5%, transparent);
}
.iv .iv-quick-create .iv-create-tabs .iv-btn {
  height: 32px; padding: 0 12px; border: 0; border-radius: 7px;
  background: transparent; color: var(--iv-tx2); font-size: 12.5px; font-weight: 500;
  box-shadow: none;
}
.iv .iv-quick-create .iv-create-tabs .iv-btn[aria-selected="true"] {
  background: var(--iv-panel); color: var(--iv-tx); font-weight: 600;
  box-shadow: 0 1px 3px color-mix(in srgb, #0b0d12 12%, transparent);
}
.iv .iv-quick-create .iv-create-tabs .iv-btn .iv-btn-ico { margin-right: 6px; }

/* ---- 结构化 field 标签 ---- */
.iv .iv-qc-field { display: flex; flex-direction: column; gap: 6px; }
.iv .iv-qc-field-head {
  display: flex; align-items: center; justify-content: space-between;
}
.iv .iv-qc-field-label {
  font-size: 12px; font-weight: 600; color: var(--iv-tx2); letter-spacing: 0;
}
.iv .iv-qc-field-hint {
  font-size: 11px; color: var(--iv-tx3); font-weight: 500;
}

/* ---- 参考图网格 ---- */
.iv .iv-ref-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.iv .iv-ref-cell {
  position: relative; aspect-ratio: 4/3; border-radius: 8px;
  border: 1px solid var(--iv-line-2); overflow: hidden;
  background: var(--iv-panel-3); cursor: grab;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.iv .iv-ref-cell:hover { border-color: color-mix(in srgb, var(--iv-tx) 30%, transparent); }
.iv .iv-ref-cell:active { cursor: grabbing; }
.iv .iv-ref-cell--base {
  border-color: var(--iv-acc);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--iv-acc) 18%, transparent);
}
.iv .iv-ref-cell img { width: 100%; height: 100%; object-fit: cover; border-radius: 0; }
.iv .iv-ref-base-badge {
  position: absolute; right: 4px; bottom: 4px;
  padding: 1px 5px; border-radius: 3px;
  background: color-mix(in srgb, var(--iv-acc) 90%, transparent);
  color: #fff; font-size: 10px; font-weight: 600; line-height: 1.4;
}
.iv .iv-ref-thumb-wrap {
  width: 100%; height: 100%; padding: 0; border: 0; background: transparent;
  display: block; cursor: zoom-in;
}
.iv .iv-ref-remove {
  position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
  border-radius: 4px; border: 0; background: rgba(0,0,0,.5); color: #fff;
  opacity: 0; transition: opacity .15s ease;
  display: flex; align-items: center; justify-content: center;
}
.iv .iv-ref-cell:hover .iv-ref-remove { opacity: 1; }
.iv .iv-ref-add {
  aspect-ratio: 4/3; border-radius: 8px; border: 1px dashed var(--iv-line-2);
  background: transparent; color: var(--iv-tx3);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; font-size: 11.5px; cursor: pointer;
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.iv .iv-ref-add:hover {
  border-color: var(--iv-acc); color: var(--iv-acc);
  background: color-mix(in srgb, var(--iv-acc) 6%, transparent);
}

/* ---- 参考图空状态 ---- */
.iv .iv-ref-empty {
  border: 1px dashed var(--iv-line-2); border-radius: 10px;
  padding: 24px 16px; text-align: center;
  color: var(--iv-tx3); cursor: pointer;
  background: color-mix(in srgb, var(--iv-tx) 2%, transparent);
  transition: border-color .15s ease, color .15s ease, background .15s ease;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.iv .iv-ref-empty:hover {
  border-color: var(--iv-acc); color: var(--iv-acc);
  background: color-mix(in srgb, var(--iv-acc) 5%, transparent);
}
.iv .iv-ref-empty .iv-ref-empty-ico {
  width: 36px; height: 36px; border-radius: 10px;
  background: color-mix(in srgb, var(--iv-tx) 8%, transparent);
  display: flex; align-items: center; justify-content: center;
  color: var(--iv-tx2);
}

/* ---- 高级参数折叠 ---- */
.iv .iv-advanced {
  border: 1px solid var(--iv-line); border-radius: 10px;
  background: var(--iv-surface); overflow: hidden;
}
.iv .iv-advanced-head {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 10px 12px; list-style: none;
  font-size: 12.5px; font-weight: 600; color: var(--iv-tx2);
}
.iv .iv-advanced-head::-webkit-details-marker { display: none; }
.iv .iv-advanced-head:hover { color: var(--iv-tx); background: color-mix(in srgb, var(--iv-tx) 4%, transparent); }
.iv .iv-advanced-title { flex: none; }
.iv .iv-advanced-defaults {
  flex: 1; font-size: 11.5px; font-weight: 500; color: var(--iv-tx3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.iv .iv-advanced-caret { margin-left: auto; transition: transform .15s ease; }
.iv details.iv-advanced[open] .iv-advanced-caret { transform: rotate(180deg); }
.iv .iv-advanced-body { padding: 10px 12px 12px; border-top: 1px solid var(--iv-line); }
.iv .iv-advanced-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
}

/* ---- 主按钮分隔与快捷键 ---- */
.iv .iv-gen-actions {
  position: relative; padding-top: 14px; display: flex; justify-content: flex-end; gap: 10px;
}
.iv .iv-gen-separator {
  position: absolute; top: 0; left: 0; right: 0;
  height: 1px; background: var(--iv-line);
}
.iv .iv-gen-actions .iv-btn--acc { position: relative; padding-right: 72px; }
.iv .iv-gen-actions .iv-gen-shortcut {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  font-size: 10px; font-weight: 500; color: color-mix(in srgb, currentColor 55%, transparent);
  letter-spacing: .02em;
}

/* ---- 隐藏旧 module 容器 ---- */
.iv .iv-modules, .iv .iv-module, .iv .iv-module-head, .iv .iv-module-body {
  /* 这些旧类只在 Workbench.tsx 快速创作分支里被删除，样式保留不影响 */
}
```

### 3.3 样式约束

| 约束 | 说明 |
|------|------|
| 颜色走 token 链路 | `--iv-*` → `--dsw-alias-*` → `currentColor` 兜底 |
| 浅色/深色主题都成立 | 所有 `color-mix` 基于 token 值，不烧入硬编码颜色 |
| 不新增/删除 `--iv-*` token | 只消费已有 token（`--iv-acc`, `--iv-line`, `--iv-tx`, `--iv-tx2`, `--iv-tx3`, `--iv-panel`, `--iv-surface` 等） |
| CSS 选择器统一带 `.iv` 前缀 | 保持特异性与现有风格一致 |
| `prefers-reduced-motion` 兼容 | 新增 `transition` 需加 `@media (prefers-reduced-motion: reduce)` 分支 |

---

## 四、国际化（新增 locale key）

在 `WorkbenchLocaleKey` type 和 `en` / `zh-CN` 字典中新增：

```typescript
// ---- F9 快速创作简化版 ----
| 'quickRefsLabel'
| 'quickRefsBase'
| 'quickRefsAdd'
| 'quickRefsEmptyHint'
| 'quickAdvanced'
| 'quickAdvancedDefaults'
| 'quickAdvancedHint'
| 'quickGenShortcut'
```

| key | en | zh-CN |
|-----|----|-------|
| `quickRefsLabel` | References | 参考图 |
| `quickRefsBase` | Base | 底图 |
| `quickRefsAdd` | Add | 添加 |
| `quickRefsEmptyHint` | Drag or click to add · first image becomes the base | 拖拽或点击添加参考图 · 首张图作为底图 |
| `quickAdvanced` | Advanced settings | 高级参数 |
| `quickAdvancedDefaults` | Current: {model} · {size} | 当前：{model} · {size} |
| `quickAdvancedHint` | Follows host defaults | 跟随宿主默认 |
| `quickGenShortcut` | Ctrl/⌘ + Enter | Ctrl/⌘ + Enter |

> **注意**：`quickAdvancedDefaults` 含占位符，需实现插值 `{model}` / `{size}`。

---

## 五、测试影响预估

### 5.1 高概率受影响的测试文件

| 文件 | 影响原因 | 修复策略 |
|------|----------|----------|
| `tests/client-quick-modules.test.tsx` | 测试 `iv-module` / `iv-module-head` 类名和可折叠行为 | **删除本测试**（module 容器已移除），或改写为测试新的 create-tab 上提逻辑 |
| `tests/client-quick-generate.test.tsx` | 测试生成按钮、prompt、尺寸、模型等选择器 | 可能需更新选择器（从 `.iv-module-body .iv-btn--acc` 改为直接 `.iv-btn--acc[data-generate-image]`），核心生成逻辑不变 |
| `tests/client-design-system.test.tsx` | 扫描 `.iv-module*` / `.iv-ref-chip*` 等骨架类名契约 | 新增骨架类名（`.iv-quick-create`, `.iv-qc-field`, `.iv-ref-grid`, `.iv-ref-cell`, `.iv-advanced` 等），移除删除的类名 |
| `tests/client-modern-theme.test.tsx` | 扫描 `modern-theme.ts` 样式完整性 | 新增规则需补测试覆盖 |
| `tests/client-multi-reference.test.tsx` | 测试参考图拖拽、排序、删除 | 更新选择器（`.iv-ref-cell` / `.iv-ref-thumb-wrap` / `.iv-ref-remove`），核心交互逻辑不变 |

### 5.2 不受影响的测试

| 文件 | 原因 |
|------|------|
| 所有 Workflow/Timeline/Script 测试 | 快速创作改造只影响 `mode === 'quick'` 分支 |
| `client-fusion-*.test.tsx` | 融合生图的独立模块不受影响 |
| `client-video-*.test.tsx` | 视频模式在高级参数下展开的参数区不变 |

### 5.3 测试修复工作量预估

| 任务 | 预估 |
|------|------|
| 改写选择器 | ~30 分钟 |
| 新增骨架类名测试 | ~15 分钟 |
| 删除废弃 module 测试 | ~10 分钟 |
| 实际跑 typecheck + vitest | ~5 分钟 |
| **合计** | **~1 小时** |

---

## 六、实施步骤

按这个顺序实施，每步可独立验证：

### Step 1 — 添加新 locale key
- `locales.ts`：新增 8 个 key 到 `WorkbenchLocaleKey` union 和 `en` / `zh-CN` 字典
- 验证：`pnpm run typecheck` 通过

### Step 2 — 重写快速创作 JSX（Workbench.tsx）
- 定位 3104-3393 行的 `mode === 'quick'` 分支
- 删除：`iv-quick-tabs`（外层 produce/prompt tab）、`iv-modules` + `iv-module` 容器、`iv-module-head`
- 保留：`createTab` 状态（image/fusion/video 三 tab）、所有生成逻辑（`runGenerate`, `onReferenceDrop`, `moveReferenceImage` 等）、状态变量
- 新增：`.iv-qc-field` 结构化 field 标签、`.iv-ref-grid` 缩略图网格、`.iv-ref-empty` 空状态、`<details class="iv-advanced">` 高级参数、`.iv-gen-actions` + separator + 快捷键小字
- 修改 create-tab 区域位置：从 module-body 内提升到 `.iv-quick-create` 第一行
- 验证：`pnpm run typecheck` 通过，无 runtime 错误

### Step 3 — 新增 modern-theme.ts 样式
- 在现有 `MODERN_THEME_STYLE` 末尾（或合适位置）追加 Step 3.2 的 CSS
- 注意：整表是压缩后字符串，不放换行/注释，新增规则也压缩
- 验证：刷新页面看视觉效果，浅色/深色主题切换

### Step 4 — 修复测试
- 跑 `pnpm exec vitest run tests/client-quick-*.test.tsx tests/client-design-system.test.tsx tests/client-multi-reference.test.tsx`
- 逐一修复失败：更新选择器 / 删除废弃测试 / 新增骨架类名

### Step 5 — 全量 typecheck + 构建
- `pnpm run typecheck`
- `pnpm run build:artifacts && pnpm run build:check`

---

## 七、不在本次范围

| 项目 | 说明 |
|------|------|
| 提取提示词 tab 完整移除 | 本次只改快速创作 pane 内部结构，prompt 子 tab 暂时隐藏（render 但 `display:none`），后续单独 PR 处理 |
| 融合生图 pane 重构 | 快速创作中的融合生图简化与主融合 pane 是两个独立模块 |
| 视频 pane 重构 | 高级参数区视频展开态已有独立布局，不动 |
| AI 优化 prompt 按钮 | 后端无接口，暂不做 |
| 键盘导航全量测试 | Step 4 测试覆盖已包含 |
| 图标 SVG 化 | **本次全量用 `<Icon name>`**（§2.7 六个名字均已存在），不使用 emoji——避免破坏 Round 6「统一 SVG 风格」契约（v1.2 修正） |

---

## 八、验证清单

- [ ] 快速创作 → 生图：prompt 输入 → 参考图 0→4 张拖拽添加 → 拖拽排序 → 首张蓝框底图标记 → 悬停 ✕ 删除 → 清空按钮
- [ ] 快速创作 → 生图：高级参数默认折叠，点击展开 2 列 grid
- [ ] 快速创作 → 融合生图：同上结构，参数区显示融合特定字段
- [ ] 快速创作 → 生视频：同上结构，高级参数默认展开
- [ ] 主按钮：inline、prompt 为空禁用、Ctrl/⌘+Enter 触发、生成中变取消、右下角快捷键小字
- [ ] 浅色/深色主题切换无异常
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run check:bundle` 通过（**开工前实测总产物已超预算 95 KB，见 §11.1；必须先定基线口径，否则本项必然红**）
- [ ] `pnpm run build` 通过
- [ ] `pnpm exec vitest run tests/client-quick-*.test.tsx tests/client-design-system.test.tsx tests/client-multi-reference.test.tsx tests/client-prompt-library.test.tsx` 全绿

## 九、复核修订（v1.1 · 2026-11-26 代码核对）

> 本节为**权威修订**。上文与本节冲突处，一律以本节为准。

### 9.1 修正的 6 处错误

| # | v1.0 说法 | 核对到的事实 | 后果 |
|---|-----------|--------------|------|
| 1 | 参考图上限 4 张 | `MAX_REFERENCE_IMAGES = 8`（`Workbench.tsx:279`） | 计数文案、网格行数全错 |
| 2 | 新增 `.iv-field` 系列类名 | `.iv-field` **已被工作流节点参数占用**（`workbench-style.ts:799`，`grid-template-columns:92px minmax(0,1fr)`） | **会打坏工作流画布所有节点参数布局** → 已全文改为 `.iv-qc-field*` |
| 3 | 高级参数图标 `settings` | `icons.tsx` 无 `settings` | 类型报错 → 改用 `sliders` |
| 4 | 需新增 canvas/layers/film/plus 图标 | 四个全部已存在 | 无需新增图标 |
| 5 | 主按钮从 inline 改为全宽 | `iv-gen-btn{flex:1 1 0}` **当前已经整行撑满** | 用户选「保留 inline」= 保持现状，只加 separator + 快捷键小字 |
| 6 | 可整套删除 `iv-module` | `iv-module` 被 `pipeline` / `episode` 共用；`openModules` / `toggleModule` 三处共用 | 只能删 `quick` 一处用法，样式规则与其余 state 键必须保留 |

### 9.2 必须保留的 DOM 契约

重构换标签可以，`data-*` 属性一个都不能丢：

| 属性 | 位置 | 引用方 |
|------|------|--------|
| `data-generate-prompt` | 提示词 textarea | `client-quick-modules:96` 等 |
| `data-create-tab="image\|fusion\|video"` | 生成方式按钮 | `client-quick-modules:98-100`、`client-fake-api:1170`（`openCreateTab` 助手） |
| `data-create-panel="image\|video"` | 面板容器 | `client-quick-modules:104` |
| `data-generate-refs` | 参考图容器（兼 dropzone） | `client-multi-reference:242` |
| `data-generate-ref={path}` | 每张参考图 | 5 个测试文件 |
| `data-generate-ref-index={i}` | 每张参考图 | 拖拽排序 |
| `data-generate-ref-remove={path}` | 删除按钮 | `client-multi-reference:140` |
| `data-generate-ref-preview={path}` | 缩略图按钮 | 预览相关测试 |
| `data-generate-refs-pick="true"` | 添加按钮 | `client-multi-reference:160/194/215` |
| `data-ref-dropzone` | 拖拽悬停态 | 拖拽测试 |
| `data-generate-size` | 尺寸 select | `client-generate-params` |
| `data-generate-image` | 主按钮 | `client-quick-generate` |
| `data-quick-tab="produce\|prompt"` | **必须保留** | `client-prompt-library:43-44`（否则整文件失败） |
| `data-quick-modules` | 快速创作根容器 | `client-quick-modules:32` |
| `data-module="quick"` | 同上 | `client-quick-modules:95` |
| `data-module-body="quick"` | 内容容器 | `client-quick-modules:125` |
| `data-module-title="quick"` | 标题文本 | `client-quick-modules:154` |
| `data-module-toggle="quick"` | ~~折叠按钮~~ **v1.2：随折叠功能一起删除，不再是必须保留契约** | `client-quick-modules:150`（该用例需同步改写/删除，见 §11.3） |

> v1.0 的 AFTER 伪代码漏写了 6 个属性，实施时按本表补齐。
> **v1.2：唯一例外是 `data-module-toggle="quick"`——折叠功能删除后该属性随之作废（§11.3）；其余属性一个都不能丢。**

### 9.3 「提取提示词」改为降级而非删除（修正 2.2）

v1.0 写「不再渲染 prompt 子 tab」，会直接打挂 `client-prompt-library.test.tsx` 全部用例。

改为：
- 保留 `data-quick-tab="produce"` / `data-quick-tab="prompt"` 两个按钮
- 视觉从「两等宽大 tab」降级为 pane 头部右侧的**次级文字入口**（ghost 小按钮）
- 生成表单是绝对主体，提取提示词是次要切换
- `quickTab` state、`iv-quick-tabs` 类名、`modern-theme.test.tsx:82` 的样式断言全部继续成立

### 9.4 模块容器的保留与删除（修正 2.2）

| 项 | 处理 |
|----|------|
| `.iv-module-n` 编号徽标 | **删除**（去噪音） |
| 折叠按钮 + `openModules.quick` + `toggleModule('quick')` | **删除** |
| `data-quick-modules` / `data-module="quick"` / `data-module-body="quick"` / `data-module-title="quick"` | **保留**（无视觉成本的元数据） |
| `WORKBENCH_STYLE` 的 `.iv-module-body[hidden]{display:none}` | **必须保留**（`client-design-system.test.tsx:346` 断言其存在） |
| `pipeline` / `episode` 的 module 结构 | **完全不动** |

### 9.5 测试改动清单（核对后精确版）

| 文件 | 需改动内容 | 用例数 |
|------|-----------|--------|
| `client-quick-modules.test.tsx` | 断言 `.iv-module-n === '1'`（57–76 行）、两个折叠交互用例（123–146、148–160 行） | **3 个用例**（v1.2 修正；v1.1 写成 2 个，漏算了 57–76 行；`data-module-title` 文本断言保留后可继续通过） |
| `client-multi-reference.test.tsx` | 守住 9.2 的 `data-*` 后**无需改动** | 0 |
| `client-prompt-library.test.tsx` | 按 9.3 保留入口后**无需改动** | 0 |
| `client-design-system.test.tsx` | 现有断言不受影响；新增骨架类名可选补断言 | 0 |
| `client-modern-theme.test.tsx` | 规则保留后**无需改动** | 0 |

> v1.0 高估了影响面（当时估 5 个文件、1 小时）。实际收敛到 **1 个文件的 3 个用例**（v1.2 修正，原写 2 个；见 §11.3）。

### 9.6 样式落地约束（补充）

1. `.iv-qc-*` 全部写在 `MODERN_THEME_STYLE` **末尾**，才能覆盖 `.iv .iv-pane` 等同特异性规则
2. `.iv .iv-pane--compact` 与 `.iv .iv-pane` 特异性相同（均 0,2,0），完全依赖书写顺序
3. 参考图网格 `repeat(4,1fr)` 在 8 张上限下是 2 行；容器 < 420px 时降为 `repeat(3,1fr)`
4. 新增 `transition` 必须补 `@media (prefers-reduced-motion: reduce)` 关闭
5. `.iv-gen-actions` 已有 `display:flex`，只追加 `position:relative` / `padding-top` / `justify-content`，不改 `display`

### 9.7 结论

方向不变，按 9.1–9.6 修正后实施。风险已从「4 个测试文件 + 工作流画布样式被破坏」收敛到「1 个测试文件的 3 个用例」（v1.2 修正，原写 2 个）；不再新增图标、不再占用 `iv-field` 类名、不改变主按钮既有宽度行为。**另需注意 §11——本节结论未覆盖体积门禁与 DOM 契约矛盾。**

**建议实施顺序不变**，但 Step 4 的工作量从「修 5 个文件」降为「修 1 个文件」。

---

## 十、右列（`.iv-dock-col`）改造建议

> 状态：**已确认采用方案 A（分两批）**。第一批与快速创作同批实施；第二批（库区 tab 化 + 任务上顶栏）单独排期。

### 10.1 现状测量

| 指标 | 实测 |
|------|------|
| 宽度 | 固定 `380px`（`grid-template-columns: minmax(0,1fr) 380px`） |
| 屏占 | 1440 屏占 26%，1024 屏占 37% |
| 内容 | 纵向堆叠 6 个可折叠 pane + 2 个默认隐藏 |
| pane 顺序 | 资源(1) → **预览(2)** → 素材(3) → 技能(4) → 导出(5) → 任务(6) |
| 隐藏 pane | 体检(7)、诊断(8)（`showMaintenancePanes` 控制） |
| 头部开销 | 每个 pane 自带 28px 方形图标 + 标题 + 折叠 chevron，共 6 套重复头部 |

### 10.2 三个结构性问题

1. **层级错**：预览（产出）与素材库（输入）同级堆叠，但「生成完立刻看结果」是最强需求，却要滚动越过「资源」才看得到。
2. **密度错**：380px 宽度里塞 6 个 pane，每块都被压扁，右列长期处于滚动状态。
3. **反馈缺**：生成进行中，预览区是空的，没有监视器状态（进度 / 已用时）。

### 10.3 建议分批实施

#### 第一批：不删改现有 `data-*` 选择器（推荐与快速创作同批落地）

| 改动 | 做法 | 测试影响 |
|------|------|----------|
| **预览置顶** | 给 `[data-workbench-pane="panePreview"]` 加 `order:-1`，只改视觉顺序，DOM 不变 | 无 |
| **宽度自适应** | 右列改 `clamp(320px, 26vw, 520px)` | 无 |
| **pane 头部瘦身** | 隐藏 `.iv-pane-tile` 方形图标；标题降到 12px/600；折叠按钮 hover 才显形 | 无 |
| **默认折叠反转** | 素材 / 技能 / 导出 / 任务默认折叠，只保留「资源 + 预览」展开 | 低（仅改 `dockFolded` 初值） |
| **生成完成自动切预览** | 成功后自动 `setPreviewPath` 到最新产出 + 预览滚到顶 + 300ms 强调色顶条淡出 | 低 |
| **生成中监视器态** | 预览区显示进度条 + 已用时（复用已有 `generateProgress` / `generateElapsed` 文案） | 低 |

> **v1.2 措辞修正**：原称「零 DOM 变更」不准确——监视器态要新增进度条 DOM，自动切预览要改 state。准确说法是「不删除、不重命名任何现有选择器」，所以存量测试不会整批迁移；风险等级「低」的判断不变。

**落地后形态：**

```
┌────────────────────────────────┐
│ 监视器 · 预览              [⤢][×]│ ← order:-1 置顶
│ ┌────────────────────────────┐ │
│ │   生成结果 / 进度条 + 用时   │ │ ← 恒深色（--iv-monitor，现状保留）
│ └────────────────────────────┘ │
│ Wanx 2.1 · 1024×1024 · 8.2s    │
│ [作为参考] [下载] [再生成]      │
├────────────────────────────────┤
│ 资源 ▾                         │
├────────────────────────────────┤
│ 素材 ▸   技能 ▸   导出 ▸  任务 ▸│ ← 默认折叠，一行一个
└────────────────────────────────┘
```

#### 第二批：库区 tab 化（独立 PR）

- 素材 / 资源 / 技能 / 导出 / 任务 → 收成**一条 tab 行 + 单内容区**
- 任务移出右列 → 顶栏 badge + 抽屉
- **成本**：`data-workbench-pane` / `paneAssets` 等选择器在 **15 个测试文件、86 处**被引用，隐藏 pane 不在 DOM 会导致整批迁移

### 10.4 为什么第一批不做 tab 化

`workbench.client.test.tsx` 单文件就有 41 处相关断言。把库区 tab 化与快速创作同批做，会把一个低风险改动变成高风险改动。先做不删改现有选择器的部分，拿到视觉收益后再单独排期。

### 10.5 建议方案

| 方案 | 内容 | 风险 | 建议 |
|------|------|------|------|
| **A（推荐）** | 第一批 6 项现在做，第二批单独排期 | 低 | ✅ |
| B | 只做「预览置顶 + 宽度自适应」两条 | 极低 | 备选 |
| C | 两批一起做 | 高 | ❌ |

### 10.6 设计依据

- **监视器恒深**：`--iv-monitor:#0a0b0d` 已在样式里，NLE 惯例（节目监视器在浅色界面里也是黑的），保留。
- **反馈面克制**：生成完成用「预览自动切换 + 1px 强调顶条」而不是 toast，符合 `dsh-client-ui-ux` 的 feedback surface 分级（就地反馈优先于浮层）。
- **先结构后装饰**：先解决「预览要滚动才看得到」这个结构问题，再谈配色与动效。

---

## 十一、v1.2 复核修订（2026-11-26 代码实测）

> **本节为权威修订**。§1–§10 与 §9 冲突处，一律以本节为准；正文里已就地标注受影响的行。
> 复核方法：逐条对照 `src/client/Workbench.tsx`、`locales.ts`、`modern-theme.ts`、`workbench-style.ts`、`scripts/bundle-budget.mjs` 与相关测试文件，不采信文档自述。

### 11.1 体积门禁：开工前已经超预算（最高优先级）

实测命令：`cd plugins/dsh-image-video && node scripts/check-bundle-size.mjs`（2026-11-26 10:20）

| 项 | 基线 | 预算（×1.2） | 实测 | 占用 |
|----|------|--------------|------|------|
| 入口 `lib/client/plugin.js` | 23,000 / gzip 7,800 | 27,600 / 9,360 | 24,231 / 8,215 | 88% / 88% |
| 包内 `client.Workbench.js` | — | — | 1,475,085 / 317,561 | — |
| **总产物** | 1,170,000 / 255,000 | 1,404,000 / 306,000 | **1,499,316 / 325,776** | **107% / 106%（超 95,316 B / 19,776 B）** |
| Step 1 后（+8 key） | — | — | 入口 24,231（不变）/ chunk 1,475,774 / 总产物 1,500,005 | chunk **+689 B raw / +197 B gzip** |

结论与动作：

1. **门禁在改动前就是红的**，§8 的「`pnpm run build` 通过」不能代替 `check:bundle`。Step 1 之前先跑一次 `check:bundle` 留证据（已存 `docs/bundle-baseline-2026-11-26.md`），明确超限不是本次引入。
2. **Step 1 实测推翻了旧口径**：8 个新 key 全部落在 `client.Workbench.js` chunk（+689 B raw / +197 B gzip），入口 `plugin.js` 保持 24,231 B **零变化**。grep 确认入口既无 `quickRefsLabel` 也无中文字符串——`locales.ts` 已不在入口包（Round 6 的「入口只剩 577 B、新增 key 必破门禁」结论已过期）。**入口体积不再是本轮约束**，只需盯总产物。`t` 的签名是 `(key) => string`，不接受插值参数，`quickAdvancedDefaults` 的 `{model}/{size}` 要在调用方自行 `replace`。
3. 总产物超限按仓库既有口径处理：在 `CHANGELOG.md` 写明原因并同步抬 `BUNDLE_TOTAL_BASELINE`（历史已多次这样做，见 `scripts/bundle-budget.mjs` 注释）。**不要为了让门禁变绿而砍本次 UI 改动。**
4. 若决定先抬基线，与本方案同批提交、单独成条目，避免和 UI diff 混在一起无法审计。

### 11.2 四处必须回填的硬伤

| # | 文档位置 | 问题 | v1.2 处置 |
|---|----------|------|-----------|
| 1 | §9.2 / §9.4 | 9.2 要求保留 `data-module-toggle="quick"`，9.4 又写折叠按钮删除——同一属性既「必须留」又「删掉」 | 明确删除折叠功能后该属性作废；9.2 该行已划改，9.5 用例数改为 3；`data-module-body/title="quick"` 仍保留为纯元数据 |
| 2 | §2.2 AFTER 伪代码 | 表格写 PaneBoundary「保留」，伪代码里整层消失 | 伪代码已补回 `<PaneBoundary>` 与闭合标签；这是错误边界，丢了会让渲染异常白屏整页，且 `client-error-boundary.test.tsx` 只测独立组件，兜不住 |
| 3 | §2.7 / §7 | 2.7 说复用 Icon，7 又说先用 emoji 占位——与 Round 6「统一 SVG 风格」契约冲突 | 全部用 `<Icon name>`（image / layers / film / sliders / plus / x / chevron 均存在）；§7 表格已改，AFTER 伪代码已去 emoji。§2.1 示意图里的符号仅是文本示意，不代表实现 |
| 4 | §2.3 textarea | 去掉内联 style 后写了 `iv-textarea--lead`，但 §3.2 没定义该类；且 `resize:vertical` 没落地 | 改为现有 `iv-input iv-textarea`（`modern-theme.ts:81` 已有 min-height 84px / 圆角 10px）；`resize:vertical` 补进 §3.2 CSS 规则块 |

**附：`resize:vertical` 的落点**——在 §3.2 追加一条即可（压缩写法）：

```css
.iv .iv-quick-create textarea.iv-input{resize:vertical}
```

### 11.3 DOM 契约与测试的最终口径

`client-quick-modules.test.tsx` 实际有 **3 个**用例受影响，不是 2 个：

| 用例 | 行号 | 断言 | 处置 |
|------|------|------|------|
| renders one module per page | 57–76 | `.iv-module-n === '1'`（61 行） | 删除该断言或改为断言 `[data-module="quick"]` 存在；`[data-module-title="quick"]` 文本用 `hidden` span 承载后可继续通过 |
| collapses a whole module | 123–146 | 点 `[data-module-toggle="quick"]` 切 hidden | 折叠功能已删 → 用例删除或改写为 pipeline 单模块折叠 |
| clicking anywhere on module header | 148–160 | 同上，点标题区 | 同上 |

`client-prompt-library.test.tsx` 通过 `data-quick-tab="prompt"` 切换（41–44 行），所以 §9.3「降级为次级文字入口而非删除」的判断成立；`client-fake-api.ts` 的 `openCreateTab` 按 `[data-create-tab]` / `[data-create-panel]` 取元素（1166–1177 行），不依赖 `data-create-tabs` 容器属性，但保留该属性零成本。

> **Step 2 实测补充（见 §12）**：实际改动了 **4 个**测试文件，不是 1 个。除上表 3 个用例外，还需改 `client-multi-reference.test.tsx`（上移按钮被删，排序用例重写）和 `client-design-system.test.tsx`（`.iv-create` 类名已改名，改用 `data-generate-prompt` 取元素）。v1.1 的「1 个文件」与 v1.2 的「1 个文件 3 用例」预估均偏低。

### 11.4 复核确认「无需再改」的事实

- `MAX_REFERENCE_IMAGES = 8`（`Workbench.tsx:279`）——计数和网格行数按 8 算，4 列 → 2 行。
- 参考图 chip 确实有序号 / 角色 / 上移 / 下移 / 删除六个元素（`Workbench.tsx:3303–3346`），§1.4 诊断成立。
- 提示词内联 `borderRadius:'6px'` 确实覆盖主题的 10px（`Workbench.tsx:3215`），§1.3 诊断成立。
- `Ctrl/⌘ + Enter` 已实现（`Workbench.tsx:3211`），快捷键提示不是虚假文案。
- `.iv-field` 被工作流节点参数占用（`workbench-style.ts:799`、`WorkflowCanvas.tsx:841`）——继续用 `.iv-qc-*` 前缀。
- `iv-module` 被 pipeline / episode 共用（`Workbench.tsx:3977/4014`）——只删 quick 一处用法。
- 右列 380px 属实（`workbench-style.ts:143`）；右列是 flex 容器（161 行），`order:-1` 生效。
- `modern-theme.ts` 已是新尺度（`.iv-input` 36px/13px、`.iv-textarea` min-height 84px），Round 7 的「23px 压扁」问题已经修过；本次不要再按旧诊断写 23px 假设。

### 11.5 开工前 checklist

1. `node scripts/check-bundle-size.mjs` 留基线证据（当前总产物已红）。
2. 确认 `BUNDLE_TOTAL_BASELINE` 是否本批抬、由谁抬、写进哪条 CHANGELOG。
3. 伪代码按 §2.2 修订版（含 PaneBoundary、`data-*`、Icon）实施，不再参考 v1.0 原文。
4. Step 1 加完 8 个 locale key 后复测体积（已做：入口零变化、chunk +689 B，见 §11.1）。
5. Step 4 只改 `client-quick-modules.test.tsx` 的 3 个用例；其余 4 个测试文件**不改**（若被迫改，说明契约漏了，回头补本文档）。
6. 右列第一批只改 CSS 顺序 / 宽度 / 默认折叠态，`data-workbench-pane` 选择器零改动；第二批独立 PR。

---

## 十二、Step 1 / Step 2 / Step 3 落地记录（2026-11-26）

### 12.1 已完成

| 步骤 | 落地 | 验证 |
|------|------|------|
| 体积留证 | `docs/bundle-baseline-2026-11-26.md`，门禁原始输出 + 前后对比 | exit 1（超预算，改动前即如此） |
| Step 1 | `locales.ts` union / en / zh 三处各加 8 个 key | `pnpm run typecheck` 通过；入口零变化、chunk +689 B |
| Step 2 | `Workbench.tsx` quick 分支 JSX 重写（见 12.2） | typecheck 通过；**77 个相关用例全绿** |
| Step 3 | `modern-theme.ts` 增量样式 + 版本戳 `2026-11-26.1`（见 12.5） | typecheck 通过；**78 个相关用例全绿**；CSS 括号平衡、31 个新类名零遗漏 |

### 12.2 JSX 实际改动清单

1. **外层**：produce/prompt 两等宽大 tab → `iv-quick-tabs--minor` 次级 ghost 小按钮（`data-quick-tab` 保留，`is-active` 标选中）；`iv-module-head`（编号徽标、说明、折叠按钮）删除，改用 `<span data-module-title="quick" hidden>` 承载元数据；`iv-module-body` 去掉 `hidden`；`iv-create` → `iv-quick-create`。`PaneBoundary` 保留。
2. **create-tab**：上提第一行，类名 `iv-create-tabs`，三个按钮改 `<Icon>`（image / layers / film），`data-create-tab` / `data-create-panel` 原样保留。
3. **image 面板**：prompt 结构化 label + 快捷键 hint，`rows=4`，去内联 style；参考图改缩略图网格（首图蓝框徽标 + 悬停 ✕），上移/下移/序号/角色文字删除，拖拽排序保留；尺寸 + 模型收进 `<details class="iv-advanced">`（默认折叠，标题栏回显当前值）；主按钮前加 separator、后加 `iv-gen-shortcut`（放在 button **外部**，避免改变 accessible name）。
4. **video 面板**：prompt 同样结构化；比例/时长/模型收进 `iv-advanced`（**默认展开**）；主按钮同样加 separator + shortcut。首末帧/参考视频槽位逻辑未动。
5. **fusion 面板**：姿态/镜头/风格/裁剪收进 `iv-advanced`（**默认展开**）；FusionGroup 与风控条未动。

### 12.3 与方案的偏差（有意为之）

| # | 方案原文 | 实际 | 理由 |
|---|----------|------|------|
| 1 | §2.5 fusion 高级参数默认折叠 | 默认展开（`open`） | 姿态/镜头/风格/裁剪是融合生图的核心创作参数，不是"高级项"；`client-fusion-params.test.tsx` 直接点击 `[data-pose]` / `[data-crop-enable]`，折叠会让用户找不到 |
| 2 | §2.4 空状态整体可点击触发 picker、`＋` 在网格末位 | `RefPickField` 固定在 `iv-ref-zone` 末尾恒定渲染 | **踩坑**：最初分别在空态与网格两个分支各放一个，`0→1` 张时组件卸载重挂，`keepOpen` 的 `open` state 丢失，`client-multi-reference:168` 直接失败。固定位置后 16/16 通过 |
| 3 | §9.5「1 个测试文件」 | 实际 4 个测试文件 | 上移按钮删除、`.iv-create` 类名改名两处遗漏；已全部回填 §11.3 |

### 12.4 验证结果

| 命令 | 结果 |
|------|------|
| `pnpm run typecheck` | 通过 |
| `vitest run client-quick-modules + client-multi-reference` | 16/16 |
| `vitest run client-prompt-library + client-quick-generate` | 11/11 |
| `vitest run client-fusion-params + client-fusion-compose` | 6/6 |
| `vitest run client-design-system + client-modern-theme` | 42/42（Step 3 新增 1 条 CSS 契约） |
| `vitest run client-generate-params` | 3/3 |
| **合计** | **78/78（8 个文件）** |

### 12.5 Step 3 样式落地（modern-theme.ts）

- 只在 `modern-theme.ts` 增量覆盖，`workbench-style.ts` **未动**；版本戳 `2026-11-24.1` → `2026-11-26.1`，保证热替换后整表覆盖（否则 JSX 已新、CSS 仍旧）。
- `Workbench.tsx` 的 quick pane 补 `iv-pane--compact`，用来收掉 pane 默认大内边距；其余结构不再改。
- 新增规则覆盖：次级 produce/prompt 入口、create-tab 胶囊（选中态高特异性压过 `.iv-btn--acc` 的 38px/13px）、`.iv-qc-field*` 结构化字段、缩略图网格（首图蓝框 + 角标 + 悬停 ✕ + 拖拽落点 + 虚线添加格）、`<details class="iv-advanced">` 折叠头/裁剪符/双列参数栅格、主按钮分隔线与内嵌快捷键、768px 与减少动效两档响应式。
- 旧 `.iv-module` 的顶部分隔线与 `gap` 用 `.iv-modules--quick,.iv-module--quick{padding-top:0;border-top:0;gap:0}` 局部复位，**没有**删基础表里 pipeline / episode 仍在用的规则。
- 颜色全走 `--iv-*` → `--dsw-alias-*` → `currentColor`；原方案里写死的 `#fff` 角标前景改为 `var(--iv-on-acc)`，主按钮内快捷键按按钮变体切换前景（acc 态用 `--iv-on-acc` 混色，danger 态用 `currentColor`），双主题都可读。
- `client-modern-theme.test.tsx` 新增 1 条契约：新结构必须有样式、旧 module 分隔线必须被复位、picker 触发按钮必须撑成网格单元、过渡必须尊重 `prefers-reduced-motion`。

### 12.6 真机反馈修复（2026-11-26 11:05，v1.2.1）

用户真机截图暴露两个问题，均已修复并重建 `lib/`：

| 问题 | 根因 | 修复 |
|------|------|------|
| 参考图区出现约整行宽的巨大空白框，添加入口文字看不见 | Step 2 把 `iv-ref-add-cell` 放在 `iv-ref-grid` **外面**（flex column 的第二行），Step 3 又给它 `aspect-ratio:4/3`，在 1100px 宽的 pane 里被撑成 ~830px 高，按钮内容被推到视口外 | 网格与添加入口都恒定渲染、添加格移进 `iv-ref-grid`；空状态从大色块降为一行提示 `iv-ref-empty-hint`；网格列宽改 `repeat(auto-fill,minmax(88px,120px))` 防止缩略图被拉成大黑块 |
| 参考图与素材缩略图全是黑块 + 破图图标 | `Workbench.tsx` 的 `baseName()` 只按 `/` 切分，Windows 绝对路径 `D:\...\outputs\xxx.png` 被整条塞进 `/outputs/<encodeURIComponent(path)>`，宿主 `safeOutputFileName()` 拒绝反斜杠 → 404。仓库其他面板早有正确处理反斜杠的 `fileName()`，唯独这份漏了 | `baseName()` 改 `path.split(/[\\/]/).pop()`；宿主路由实测正确文件名返回 200 / image/png，确认路由本身正常 |

另外把参考图区常态外框从虚线改淡实线，虚线只留给拖拽投放态（`data-ref-dropzone`）。主题版本戳升到 `2026-11-26.3`，确保热替换整表覆盖。

新增 2 条回归契约：Windows 路径缩略图 URL 必须是 `/outputs/shot-2026.png`、添加格必须在 `.iv-ref-grid` 内；CSS 侧钉住 88–120px 列宽上限。

### 12.7 视觉微调（2026-11-26 11:20，v1.2.2）

用户反馈两处「不好看」，均属「文字/按钮裸放在面上」的问题，已改并重建 `lib/`：

| 位置 | 问题 | 改法 |
|------|------|------|
| pane 顶部次级入口（内容生产 / 提取提示词） | 两个 ghost 按钮裸放在右上角，没有图形锚点，看起来像两段可点的文字 | 改胶囊分段控件：整组一个浅底（`--iv-tx` 5%）+ 激活项浮到底色 `--iv-panel` 加 1px 投影；加图标 `sparkles` / `script`（12px），激活项图标转 `--iv-acc` |
| 参考图字段下的说明 | ① 文案过期：写「最多 6 张」（实际 `MAX_REFERENCE_IMAGES = 8`）、写「用箭头排序」（v1.2 已删按钮）② 11px 灰字横贯 1000px 面板，读成一条横幅 | 文案改「首图为底图，其余作风格参考；拖拽缩略图可调整顺序」；`.iv-qc-field > .iv-qc-field-hint` 加 `align-self:flex-start` + `max-width:56ch`，按内容宽度收口 |

顺带修正 `generateRefsFull`（「最多 6 张参考图」→「最多 8 张参考图」，与常量对齐；`t` 不支持插值，改常量时需同步这里）。

主题版本戳 `2026-11-26.3` → `2026-11-26.4`。新增 1 条契约（次级入口胶囊 + 图标间距 + 说明收口），`typecheck` 通过，68 个相关用例全绿。

### 12.9 取消无效修复（2026-11-26 11:25，v1.2.3）

真机反馈「开始生成后点取消没反应」，根因**不是** DOM 或样式，是提交方式：

| 环节 | 修前 | 修后 |
|------|------|------|
| 提交 | 图片走 `wait` 缺省（同步等待），RPC 挂到出图才返回 | 图片与视频**都** `wait: false`，立刻拿 `taskId` |
| 取消按钮 | `if (generating === 'image') { if (generateTaskId !== undefined) cancelTask(...) }` —— 图片永远拿不到 id，分支直接空转 | 抽出 `cancelGenerate()`：有 id 发 `tasks/cancel`，没 id 如实提示「不可中断」，不假装已停 |
| 中途反馈 | 点了没有任何视觉变化 | `cancelling` 态：按钮显示「取消中…」并禁用，等轮询落 `cancelled` |
| 收尾 | `finally` 里对图片无条件 `setGenerating(undefined)`，会把刚拿到的 taskId 立即抹掉 | 只有「没进轮询」才清 `generating`（`pendingTaskId === undefined`） |
| 终态提示 | 「取消生成」（按钮文案） | 「已取消生成」 |

`generateCannotCancel` / `generateCancelling` / `generateCancelled` 三个 key 新增。回归用例：`client-quick-generate` 新增 1 例，断言生图入参含 `wait:false`、点取消真的调用 `cancelTask(taskId)`、并在飞期间按钮变成「取消中…」。

### 12.10 结果展示不截断（2026-11-26 11:30，v1.2.4）

真机反馈「结果显示框只显示一部分」。根因是**两处硬编码尺寸**，与加载无关：

| 位置 | 修前 | 修后 |
|------|------|------|
| 结果卡媒体（`.iv-last-result-media`） | `96×96` + `object-fit:cover`，横图两侧、竖图上下被裁掉 | `width/height:auto` + `max-width:min(200px,100%)` + `max-height:160px` + `contain`，按素材比例完整显示 |
| 预览舞台（`.iv-dock-preview`） | `height:320px` 固定，小图被拉进大框、大图被压小 | `height:auto` + `min-height:160px` + `max-height:min(52vh,420px)`，高度随内容；图片 `width/height:auto` 只受宽与上限约束 |
| 放大态 | 复用舞台规则 | 显式解除上限（`min-height:0;max-height:none`），双击放大仍铺满视口 |
| 视频首帧占位 | `height:100%`，父级改成 auto 后会塌陷 | `aspect-ratio:16/9` + `min-height:160px`，内层 `object-fit:cover` |

只有 `modern-theme.ts` 与 `client-modern-theme.test.tsx` 变更，DOM 未动；主题戳 `2026-11-26.5`。新增 1 条契约同时钉住三件事：结果卡不得用固定方形 + cover、舞台高度必须由内容决定、放大态必须解除上限（否则双击反而变小）。

### 12.11 尚未完成

1. **基线决策待拍板**：总产物 raw 1,514,496 / 1,404,000（108%，超 110,496 B，gzip 超 22,163 B）。其中 Step 1 贡献 +689 B，Step 3 样式约 +10 KB raw / +1.6 KB gzip，本轮展示修复 +927 B；开工前已超 96,005 B，仍属既有问题，但是否在 CHANGELOG 说明并抬 `BUNDLE_TOTAL_BASELINE` 需用户决定。入口始终 24,231 B（88%）未变。
2. **真机复看待做**：上述修复已重建 `lib/`，需用户刷新宿主再看一眼：结果卡与预览区是否按比例完整显示（横图/竖图各试一张）、双击放大是否仍铺满、缩略图是否出图、video 高级参数展开后的首屏高度。
3. 右列 `.iv-dock-col` 改造（§10）仍是独立批次，本次未碰。

