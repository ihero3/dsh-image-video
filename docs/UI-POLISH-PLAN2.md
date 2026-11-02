# UI 打磨第二轮：视觉层级与显著提示（UI-POLISH-PLAN2 · Round 7）

> 状态：**R7-1 ~ R7-5 已全部落地（含 17 个 accent 按钮分级与 busy 态全量推广）**（样式戳 `2026-10-31.5`），剩余见 §12.3 · 作者：Track B · 日期：2026-10-31
>
> 前置：Round 6（`UI-POLISH-PLAN.md`）全部落地 —— 59 个设计令牌、`.iv-sub` 骨架、`.iv-pane-body` 删除、`PanelState` 六态、键盘化与播报通道、R6-4 验收脚本就绪。`WORKBENCH_STYLE_VERSION = '2026-10-31.3'`，入口 `plugin.js = 64,943 B`（占预算 99%，余量 577 B）。
> 后续：每批次独立 PR；门禁统一走 `bash scripts/gate.sh`，合入后按批次推 gitlink。

## 0. 第二轮定位

### 0.1 与第一轮的关系（继承，不推翻）

| 维度 | Round 6（已完成） | Round 7（本计划） |
| --- | --- | --- |
| 核心命题 | **一致**：同类元素同源，无裸值，状态机完整 | **主次**：同源之后，让"该大的大、该明显明显、该小的小、该告警显眼" |
| 主要交付 | 59 令牌、骨架、状态机、a11y 通道、验收脚本 | 视觉重量预算、核心输入强调、主行动分级、告警四级、验证加固 |
| 不变的东西 | 双主题、v3 NLE 视觉基因、令牌体系、面板结构、API 契约 | 全部继承，**不重写** |

> 一句话：Round 6 让界面"没错"，Round 7 让界面"有重点"。用户反馈"主次不分"的本质，是**一致性解决后、强调性尚未建立**——这正是第二轮的功课。

### 0.2 事实基线（2026-10-31 对 `2026-10-31.3` 实测）

| # | 项 | 实测值 / 证据 | 判定 |
| --- | --- | --- | --- |
| F1 | 唯一"主按钮"处理 | `.iv-btn--acc` 共 **17 处，全部带 `iv-btn--sm`**（`height:20px;font-size:10.5px`）；含生成(Workbench:2729)、融合运行(3060)、导出(3616/4577) | 主行动 = **最小号按钮**，比默认 `.iv-btn`(23px/11px) 还小 |
| F2 | **核心输入被压扁** | 主创提示词 `<textarea rows={3} className="iv-input">`（2438 区），而 `.iv-input{height:23px}` 且**未加 `.iv-textarea`**(min-height:42px) | 按样式表推断，**提示词 = 23px 单行条**（须真机确认）；若成立为本轮第一优先 |
| F3 | 面板标题字号 | `.iv-pane-title{font-size:var(--iv-fs-body)/font-weight:500}` = **11px/500**；正文 11px/400 | 标题与正文**同字号**，结构不可读 |
| F4 | 主创标题 | `.iv-create-title` = 13px/500（唯一用 title 档） | 与其余 9 个 pane(11px) 不一致，且 hero 只有 13px |
| F5 | 字号梯度 | 8/9/10.5/11/12/13/16；**11→13 无中间档** | 梯度有"洞"：正文直接跳 hero，缺"区块标题"档 |
| F6 | 空态主句 | `.iv-empty strong` = 11px/500（line 342） | 空态唯一要读的话，却是正文级 |
| F7 | 阻塞告警配色 | 风控 block 走 `iv-chip--warn`（琥珀，line 3047）：`ok?'ok':'warn'` | **阻塞 = 警告同色**，违反"该告警显眼" |
| F8 | 生成中态 | 生成时按钮 `disabled` → `opacity:.42`（line 2731/167），仅文字换 `t('generating')`，无旋转/进度 | **进行中看起来像"坏了"**，不是"在跑" |
| F9 | 禁用无理由 | 提示词为空 → 生成按钮 42% 淡灰，无任何"为什么不能点" | 用户不知为何点不动 |
| F10 | 权重分布 | 最重 `700` 只用在 **9px 微型标签**；标题用 500/600 | 最重字重压在最不重要（最小）的文本上 |
| F11 | 入口预算 | `plugin.js = 64,943 B / 65,520 B`（99%，余 577 B） | **任何新代码不得进入口**；CSS 改在 `workbench-style.ts`（Workbench chunk，安全） |

### 0.3 设计原则（本计划的判据）

1. **尺寸即权重**：主行动必须比次级**大**（高度 + 字号 + 内边距 + 图标），不止靠颜色。
2. **梯度连续**：11 → 12 → 13 → 14 → 16，五档逐级可辨，无断档也无挤档。
3. **告警分级、比例得当**：info < warn < error < **blocking**，颜色 + 形状 + 位置拉开；blocking 必须"一眼就知道停了"。
4. **进行中必须"活"**：忙碌态是强化（满不透明 + 旋转/进度），**不是**降级为灰色 disabled。
5. **次级收敛**：次要面板去重边框、三级动作转 `ghost`/`sm`、辅助固定 `meta`/`micro`，让主行动靠"周围安静"突出。
6. **不破预算、不破契约**：只动 Workbench chunk 的 CSS/组件；不进入口；不推翻 Round 6 令牌与骨架。

---

## 1. 自我审阅：这套方案合理吗？

> 用户问"是否合理"。先给结论：**方向成立，但第一版有三处我不满意，已在本版修正。** 下面把证据、假设、反风险摊开。

### 1.1 结论成立的证据链

"主次不分"不是一个主观感受，它对应三个可量化的倒置：

- **主行动比次要小**（F1：20px < 23px）——尺寸倒置。
- **标题不比正文大**（F3：11px = 11px）——层级倒置。
- **阻塞和警告同色**（F7：都琥珀）——告警倒置。

三者叠加，界面自然"处处一样重"。这不是审美问题，是**权重分配问题**，可用规则修，不需要重设计。

### 1.2 方案的三个假设（假设不成立时，哪里要改）

| 假设 | 若不成立 | 影响面 |
| --- | --- | --- |
| A. 目标是**密集专业工具**（NLE DNA），不是消费级 | 若用户想要更"亲和/大按钮"的观感，整个字号基准应从 11 抬到 13–14，按钮从 23 抬到 32+ | 全局，等于换一套尺度；本计划数值需整体重算 |
| B. "主次"主要指**同屏内元素对比**，不是**跨屏信息架构** | 若用户其实想要重新组织功能分组/导航层级，那属 IA 重构，不是样式打磨 | 需拆独立"信息架构"议题，本计划只解决"看得见的轻重" |
| C. 用户愿意为"重点"付出**信息密度下降**的代价 | ~~若坚持一屏塞满，则只能做弱强调~~ **已确认（2026-10-31）：愿意牺牲一点密度** | 尺寸类改动全部放行 |

> 我的判断：A（密集专业工具）、B（同屏视觉对比）成立；**C 已于 2026-10-31 由用户确认为"愿意牺牲一点密度"**，因此 R7-3/R7-5 的尺寸类改动（lg 按钮、prompt 80px、pane 标题 13px）全部放行。

### 1.3 反风险：过度强调 = 高亮盲区

如果每个面板都加框、每个按钮都变蓝变大，界面会从"没重点"变成"满屏重点"，一样读不出主次。**这是本方案最大的自我威胁。** 对策是 §2 的"视觉重量预算"——用配额硬约束，而不是逐处凭感觉加粗。

### 1.4 若只有一天：80/20 四件事

按投入产出，先做这四件（都是小改动、高收益）：

1. **提示词解除 23px 压扁**（F2）——一句话改 `iv-input` → `iv-input iv-textarea`。
2. **风控 block 改红**（F7）——一行 `ok?'ok':'warn'` → 加 `block?'err'`。
3. **主按钮升 lg**（F1）——只改生成/融合两处 className。
4. **面板标题 11→13**（F3）——一处 CSS。

其余（分级、空间、测试）按批次跟进。

---

## 2. 视觉重量预算（系统性方法）

> 目的：把"主次"从"逐处凭感觉"变成"可分配、可审计的预算"，防止 §1.3 的高亮盲区。

### 2.1 四级重量

| 级别 | 语义 | 视觉手段 | 单屏配额 |
| --- | --- | --- | --- |
| **W1 英雄** | 此刻唯一的焦点（主创"提示词→生成"簇、结果卡） | 最大尺寸 + 强调色 + 图标 + 留白包裹 | **每屏 ≤ 1 簇** |
| **W2 区块** | 面板标题、次级主行动、关键指标 | title(13)/600、accent 默认按钮、metric(16) 数字 | 每 pane ≤ 3 |
| **W3 内容** | 卡片、字段、列表行、正文 | body(11)/400、1px 发丝线 | 不限，但不加色 |
| **W4 底噪** | 提示、辅助、微标签、外壳 | meta(10.5)/micro(9)、tx3、无边框 | 不限，不抢眼 |

### 2.2 硬规则

- 同一 pane 内**不允许两个 W1**；出现两个 → 其中一个必须降级。
- 一个视图内 accent（蓝）按钮**总数与 W2 配额对齐**（≤3），其余走中性/ghost。
- W1 的"大"必须由**留白**衬托——周围 W3/W4 越安静，W1 越突出。加粗不是唯一手段。

### 2.3 元素 → 重量映射（本轮落地依据）

| 元素 | 目标级别 | 具体 |
| --- | --- | --- |
| 主创提示词 | W1 | 高度 ≥ 80px、字号 12、清晰 focus 环 |
| 生成/融合运行 | W1 | `iv-btn--acc iv-btn--lg`(30/13) + 图标 |
| 生成视频 | W2 | `iv-btn--acc`(默认 23/11)，不加 lg |
| 面板标题 | W2 | 13px/600（现 11/500） |
| 指标数字 | W2 | 维持 metric 16 |
| 空态主句 | W2 | 11 → lead(14) |
| 卡片名/行文本 | W3 | strong(12)/body(11) 不变 |
| 辅助/微标签 | W4 | meta(10.5)/micro(9) 不变 |
| 次要停靠面板 | W4 | 去全边框，仅 surface + 顶线 |

---

## 3. 字号层级重构（R7-1）

### 3.1 新增一档"引导"

```css
.iv{
  /* 现有 8 档保留：tick8 / micro9 / meta10.5 / body11 / strong12 / title13 / metric16 */
  --iv-fs-lead:14px;   /* 新增：区块/页面引导标题、主创 hero、监视器说明、空态主句 */
}
```

梯度变为 **11 → 12 → 13 → 14 → 16**（body→strong→title→lead→metric），每级差 1–2px，可辨且不挤。

### 3.2 修正误用（逐处）

| 选择器 | 现值 | 改为 | 理由 |
| --- | --- | --- | --- |
| `.iv-pane-title` | 11 / 500 | `var(--iv-fs-title)`(13) / 600 | 标题必须比正文大且重 |
| `.iv-create-title` | 13 / 500 | `var(--iv-fs-lead)`(14) / 600 | 主创是 quick hero，再高一档 |
| `.iv-empty strong` | 11 / 500 | `var(--iv-fs-lead)`(14) / 600 | 空态唯一要读的话 |
| `.iv-pop-head-title` | 13 | `var(--iv-fs-lead)`(14) | 弹层标题与面板同级，避免"头轻" |
| `.iv-stats b` | metric(16) | 不动 | 已是"该大的大"的正面样板 |

### 3.3 字重归位

- 微型标签（`.iv-micro`/`.iv-sub-title`）维持 700——**重而小**是正确语义（大写标签）。
- 区块标题统一 600；**仅 hero/空态主句允许 700**，一屏至多 1–2 处，避免 700 贬值。
- 正文/辅助维持 400。

### 3.4 落地与保护

- `WORKBENCH_STYLE_VERSION` → `2026-10-31.5`。
- 契约测试新增：`--iv-fs-lead` 存在；`.iv-pane-title` 含 `var(--iv-fs-title)`；禁止 `.iv-pane-title`/`.iv-create-title` 出现 `font-size:11px`。

---

## 4. 核心输入强调（R7-2，本轮第一优先）

> 这是第一版漏掉的最大问题：全工具最该被看见的输入——提示词——被压成 23px 单行条（F2）。

### 4.1 现状与风险

- 主创提示词 `<textarea rows={3} className="iv-input">`；`.iv-input{height:23px}` 且无 `.iv-textarea`，CSS 高度覆盖 `rows`。
- **后果**：用户面对一条 23px 的窄缝写创作描述；这是"该大的没大"最严重的一处，直接伤害核心任务。
- **须真机确认**：按样式表推断成立；若真机实测行高被 `rows` 撑开，则本项降级为"仅补 `.iv-textarea` 保证 min-height"。

### 4.2 目标形态

```css
.iv-create textarea.iv-input{          /* 仅主创提示词，不影响其他 iv-input */
  height:auto;
  min-height:80px;
  padding:var(--iv-sp-4) var(--iv-sp-5);
  font-size:var(--iv-fs-strong);       /* 12：主输入略大于正文 */
  line-height:1.55;
  resize:vertical;
}
```

- 用 `.iv-textarea` 语义（min-height 42 的通用版）+ 主创覆盖到 80px；两处都给，保证任何入口都不再被压扁。
- 焦点态沿用既有 `.iv-input:focus{border-color:var(--iv-acc)}`，再加 `box-shadow:0 0 0 3px color-mix(...)` 让 W1 聚焦更明确。

### 4.3 与生成按钮的关系（W1 簇）

- 提示词（上）与生成按钮（下）在视觉上组成一个 W1 簇：大输入 + 大按钮 + 两者间 `--iv-sp-3` 紧凑、簇外 `--iv-sp-6` 留白。
- 用 `Ctrl/Cmd+Enter` 触发生成（Workbench 已有）保持不变，并在提示词下方用 `iv-micro` 标一行快捷键（W4，不抢）。

### 4.4 验收

- 真机：提示词高度 ≥ 80px；输入 3 行文本无滚动挤压；`Ctrl+Enter` 仍触发。
- 结构契约：主创 `textarea` 同时含 `iv-input` 与 `iv-textarea`（或命中 `iv-create textarea` 规则）。

---

## 5. 主行动强调与交互状态（R7-3）

### 5.1 新增 `.iv-btn--lg`

```css
.iv-btn--lg{height:30px;padding:0 16px;font-size:var(--iv-fs-title);font-weight:var(--iv-fw-medium);gap:var(--iv-sp-3)}
.iv-btn--lg.iv-btn--icon{width:30px;padding:0}
.iv-btn--acc.iv-btn--lg{box-shadow:var(--iv-shadow-acc-hover)}
```

尺寸阶梯：**lg(30/13) > 默认(23/11) > sm(20/10.5)**。

### 5.2 17 个 `iv-btn--acc` 的主次重分级

口径：**"点了进入核心产出" = W1(lg)；"面板内提交/应用" = W2(默认 accent)；"行内/弹层紧凑动作" = W3(保留 sm)**。

| 行号 | 当前 | 新分级 | 理由 |
| --- | --- | --- | --- |
| 2729 生成图片 | `acc sm` | **`acc lg`** | 全插件第一主行动 |
| 2738 生成视频 | `sm` | `acc`（默认，不加 lg） | 次级：与图片同级但略低 |
| 2750 取消生成 | `danger sm` | `danger sm` | 中止类，不与主行动争大 |
| 3060 融合运行 | `acc sm` | **`acc lg`** | 融合生图主行动 |
| 3616 时间轴导出 | `acc sm` | **`acc lg`** | 时间轴的终局动作 |
| 4577 弹层"应用" | `acc sm` | `acc sm` | 弹层底部，空间紧张 |
| 2076/2199/2301/3115/3218 等其余 | `acc sm` | 逐处按口径判定；行内"添加/选择/导入"保留 sm | R7-3 实施时逐处确认并写进 PR |

> 规则先写死、再逐处落地：避免"全 lg"（又没重点）或"全 sm"（维持现状）。

### 5.3 交互状态矩阵（补 F8/F9）

| 状态 | 当前 | 目标 |
| --- | --- | --- |
| default | 蓝底白字 | 不变（lg 加阴影） |
| hover | `--iv-acc-deep` + 阴影 | 不变 |
| active | `box-shadow:none` | 加 `translateY(1px)` 轻微下压 |
| focus-visible | 2px 外环 | 不变（已合规） |
| disabled | `opacity:.42` | **加"原因"**：空提示词 → 输入框下方 `iv-micro` 提示"先写提示词"；风控 block → 红字说明（见 §6） |
| **busy（生成中）** | `disabled` + 换字 → 42% 淡灰 | **新增 `.iv-btn--busy`**：满不透明 + 左侧 14px 旋转环 + 保留强调色；**不套用 disabled 透明度**。用 `aria-busy="true"` 而非 `disabled`（保持可感知进度） |

- busy 环用纯 CSS（`border` + `@keyframes spin`），`prefers-reduced-motion` 下停转但保留静态环。
- 生成中按钮**不可重复点击**但**看起来是活的**：`pointer-events:none` 代替 `disabled`，避免 42% 灰。

### 5.4 测试

- 结构契约：主创存在 `iv-btn--acc iv-btn--lg`。
- 生成中：断言按钮有 `iv-btn--busy` 且 `aria-busy`，无 `disabled` 属性。
- 计算样式（Playwright）：lg 实高 ≥ 28 且 > sm 实高；busy 态 opacity ≥ 0.9。

---

## 6. 显著提示 / 告警等级（R7-4）

### 6.1 四级 severity

| 级别 | 触发 | 颜色 | 形状 | 现有类 | 处理 |
| --- | --- | --- | --- | --- | --- |
| info | 提示/空态 | `--iv-tx3` | `.iv-meta`/`.iv-notice` | 有 | 不变 |
| warn | 可继续的提醒 | `--iv-warn` 琥珀 | `.iv-chip--warn`/`.iv-meta--warn` | 有 | 不变 |
| error | 失败可重试 | `--iv-danger` 红 + 软底 | `.iv-notice--error`/`.iv-alert` | 有 | 不变 |
| **blocking** | 阻断提交（合规） | `--iv-danger` 红 + 实底/强边 + 图标 | 新 `.iv-notice--block`：左 3px 红条 + 加大内边距 + `role=alert` | 无 | **新增** |

### 6.2 具体修正

1. **block 配色**（line 3047）：
   ```tsx
   // 旧：level==='ok' ? 'ok' : 'warn'   → block 显示琥珀
   className={`iv-chip iv-chip--${level === 'ok' ? 'ok' : level === 'block' ? 'err' : 'warn'}`}
   ```
2. **block 命中建议**：`iv-meta--warn`(琥珀) → `iv-meta--err`（红），让"为什么被拦"也变红。
3. **生成前拦截条**（2483 区，现 `iv-notice--error`）升级 `.iv-notice--block`；`role="alert"` 接入 R6-3 播报（"内容合规未通过，已阻止生成"）。
4. **状态栏**：`useAppNotice` 接口接 blocking，红底强提示，4s 内不叠加（保最多 2 条队列）。

### 6.3 对比度纪律

新增强提示元素双主题过 `check-contrast.mjs`：红字/软底 ≥ 4.5:1（正文）、≥3:1（大字）。不达标降透明度或换实底——**响亮不等于读不清**。

---

## 7. 空间与结构强调（R7-5）

### 7.1 面板边框分级

- **主工作面板**（画布/时间轴/预览）：保留完整 1px 边框。
- **次要停靠面板**（素材/任务/导出/诊断）：新增 `.iv-pane--quiet{background:var(--iv-surface);border-color:transparent;border-top:1px solid var(--iv-line)}`，逐 pane 加类（只加 className，不改结构）。

### 7.2 主创 hero 化

- `.iv-create` 已带 36px 图标 tile，层级已最高；只确保其排第一 + 标题 lead(14)，**不额外加框**。

### 7.3 监视器主导

- `.iv-monitor` 现 `min-height:168px`；真机若被压则升 `200px`，同步附录 A 登记——**先测再动**。

### 7.4 收敛噪声

- 行内删除/重命名统一 `ghost`/`sm`；蓝按钮总数与 W2 配额对齐；辅助固定 `meta`/`micro`。

---

## 8. 测试优化（R7-6）

> 收口 Round 6 两个未决：R6-4 脚本待真机；Workbench 级在沙箱 OOM。并补"层级"专属断言。

### 8.1 结构级契约（jsdom，进 `client-design-system.test.tsx`）

| 断言 | 方式 |
| --- | --- |
| 主创存在 `iv-btn--acc iv-btn--lg` | `querySelector` |
| 主创 prompt 含 `iv-textarea` | `querySelector` 属性/类 |
| `.iv-pane-title` 用 `var(--iv-fs-title)`、`.iv-create-title` 用 `var(--iv-fs-lead)` | 样式表字符串扫描 |
| block → `iv-chip--err`（非 warn） | 渲染 block 断言 className |
| 生成中按钮有 `iv-btn--busy` + `aria-busy`，无 `disabled` | 渲染 `generating='image'` 断言 |
| `--iv-fs-lead` 存在、无新增裸值 | 既有扫描扩写 |

### 8.2 计算样式级（Playwright，接 R6-4）

新增 `scripts/check-emphasis.mjs`（复用 `check-contrast.mjs` 的取值方式）。

**实现思路**：不点业务按钮，而是往真实页面里插一组**离屏探针元素**（`visibility:hidden`，不影响截图），量它们的计算样式——这样结论不依赖"有没有项目/素材"这种业务状态，可稳定复跑。另加少量真实 DOM 断言（提示词高度、标题字号）。

| 检查 | 阈值 | 取值方式 |
| --- | --- | --- |
| 按钮尺寸阶梯 | lg ≥ 28px 且 lg > 默认 > sm | 探针 |
| lg 带投影 | `box-shadow ≠ none` | 探针 |
| 字号阶梯 | lead ≥ 14 > title > strong > body | 读 `.iv` 上的令牌 |
| 面板标题 > 正文 | `pane-title ≥ 13px` 且 > body 11px | 真实 DOM |
| 主创标题 > 面板标题 | `≥ 14px` 且 > pane-title（W1 压住 W2） | 真实 DOM |
| 提示词实高 | ≥ 80px | 真实 DOM（`.iv-create textarea`） |
| busy 态不透明度 | ≥ 0.9（不被 disabled 的 42% 吃掉） | 探针（带 `disabled`） |
| busy 环尺寸 | 10–14px | 探针伪元素 `::before` |
| blocking 左红条 | 3px | 探针 |
| block 色 ≠ warn 色 | `color` 不等 | 探针两个 chip |

**软提示**（只打印数字，不判失败）：每个可见 pane 内 `.iv-btn--lg` 与 `.iv-btn--acc` 的数量。计划 §2 说"每屏 W1 ≤ 1"，但"什么算一屏"需要人判，脚本不替人做这个决定。

文本对比度仍由 `check-contrast.mjs` 负责，本脚本**不重复**检查（两处阈值口径不同容易打架）。

须真机（jsdom 不算样式表值），与 R6-4 同批执行，**不进 `gate.sh` 必过项**，作为发布门禁记录。命令：`pnpm run check:emphasis`（缺 playwright 时 exit 2，与 `check-contrast.mjs` 一致）。

### 8.3 主观验证（专业做法）

脚本能验数值，验不了"看起来对不对"。两个低成本人工判据：

- **眯眼测试**：截图缩小到 25%，若主行动/主创不是第一眼落点 → 层级失败。
- **3 秒测试**：给同事看 3 秒，问"这页最该做什么"；答不出 → 主次失败。

各记录一句结论，附在 R7 验收清单，不量化但留痕。

### 8.4 OOM 策略

- 沙箱**不再**渲染完整 Workbench（Round 6 已证 OOM，非逻辑错）；全工作区视觉改 **Playwright 真机渲染**。
- `capture-ui-baseline.mjs`（支持 `DSH_BASELINE_OUT`）补一组"强调前后"对照：默认/生成中/风控 block/空态；像素 diff 用 `diff-ui-baseline.mjs`（sharp，零新增依赖）。
- vitest 只跑面板/组件级 + 结构级断言（§8.1），沙箱可跑。

### 8.5 覆盖率

- 若 §5.2 的按钮分级抽成配置表，补对应单测；纯 CSS 不虚增分母。
- 真机跑一次 `pnpm exec vitest run --coverage`，实测值写进 `docs/archive/2026-10-31/COVERAGE-PLAN.md`，涨了随之抬阈值。

---

## 9. 批次与门禁（含每批验收标准）

| 批次 | 范围 | 验收标准（可测） | 风险 | 依赖 |
| --- | --- | --- | --- | --- |
| **R7-0 基线** | 5 张 PNG（默认/生成中/block/空态/时间轴）+ 双主题对比度留底 | ≥5 张入库；diff 空跑通过 | 低 | 无 |
| **R7-1 字号** | lead 令牌 + 4 处误用 + 契约 | typecheck + 契约绿；PNG 标题变大 | 低 | R7-0 |
| **R7-2 核心输入** | prompt 解压 + focus 强化 + 快捷键提示 | 真机提示词 ≥80px；`Ctrl+Enter` 有效 | 中 | R7-1 |
| **R7-3 主行动** | lg 按钮 + 17 分级 + busy/禁用理由 | 主创有 lg；busy 态 opacity≥0.9 且非 disabled | 中 | R7-1 |
| **R7-4 告警** | 四级 + block 改红 + `.iv-notice--block` + 播报 | block 走 err；双主题 ≥4.5:1；role=alert | 中 | R7-1 |
| **R7-5 空间** | `.iv-pane--quiet` + hero + 噪声收敛 | PNG 对照主区更"实"；无断裂 | 低 | R7-1 |
| **R7-6 测试** | 结构契约 + `check-emphasis.mjs` + 覆盖率 + 全工作区对照 | 真机全绿；diff 通过；眯眼/3秒留痕 | 中 | R7-2/3/4/5 |
| **R7-7 验收** | 复跑 R6-4 + 文档回填 | 对比度/像素/PNG 全过；`gate.sh` 绿 | 低 | R7-6 |

每批次独立 PR，合入后单独推 gitlink。

**当前状态**：R7-1 / R7-2 / R7-3 / R7-4 / R7-5 **已落地并通过沙箱可跑的门禁**（详见 §12）；R7-6 的 `check-emphasis.mjs` **脚本已就绪**（`pnpm run check:emphasis`）、R7-0 的 PNG 基线、覆盖率与 R7-7 的 `gate.sh` 复跑**待真机执行**（沙箱渲染完整工作台会 OOM，属已知环境限制）。

---

## 10. 风险与明确不做

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 主按钮变大挤 380px 窄栏 | 换行/溢出 | 真机 380px+200% 走查；lg 在 <420px 退为默认 accent |
| 提示词解压后主创面板变高 | 首屏可见内容减少 | 80px 为下限；真机对比后再调，不一次拉满 |
| 补 lead 后标题整体偏大 | 密集面板变松 | 仅 pane 标题/hero 用；PNG 对照 |
| block 改红误伤 warn 语义 | 分不清轻重 | 严格按 §6.1 四级；warn 维持琥珀 |
| 次要面板去边框后边界模糊 | 找不到边界 | 保 surface 底 + 顶线，非全无框 |
| 过度强调 → 高亮盲区 | 又回到没重点 | §2 重量预算硬约束（每屏 W1 ≤1） |
| 入口预算 99% | 破线 | 仅 CSS/组件内改动；不碰 `plugin.ts`/`locales.ts` |
| 全工作区只能真机验 | 沙箱不能判定 | 验证改 Playwright（§8.4），不自欺 |

**明确不做**：

- 不推翻 Round 6 令牌/骨架/状态机/双主题。
- 不引入第二套样式语言（Tailwind/CSS-in-JS）。
- 不改业务逻辑与 API 契约。
- 不新增图标风格、不改品牌 Mark。
- 不做宿主级 Toast（R6-3 已定：插件内状态栏，二期换 sink）。
- 不"全都加 lg / 全都加框"——重点的前提是"有不被强调的东西"。
- 不在本计划处理**信息架构/导航重构**（属假设 B 之外，见 §1.2）。

---

## 11. 工作量（含上浮）

| 批次 | 内容 | 估时 | 上浮点 |
| --- | --- | --- | --- |
| R7-0 | 基线首采 + 对比度 | 2h | 真机排期 +1h |
| R7-1 | lead + 4 处修正 + 契约 | 2h | PNG 对照 +1h |
| R7-2 | prompt 解压 + focus | 1.5h | 真机确认 +0.5h |
| R7-3 | lg + 17 分级 + busy | 3h | 逐处核对 +1.5h |
| R7-4 | 四级告警 + block + 播报 | 3h | 对比度回改 +1.5h |
| R7-5 | 空间降权 + hero | 2h | 真机复核 +1h |
| R7-6 | 强调测试 + 覆盖率 + 对照 | 3h | Playwright 环境 +1.5h |
| R7-7 | 验收 + 文档 | 2h | — |
| **合计** | | **18.5h（≈2.4 工作日）** | 上浮 **24–28h** |

比 Round 6（26h）略小：本轮在一致骨架上做强调，不重铺令牌、不重写状态机。每批次重估，不一次承诺总工期。

---

## 12. 落地记录（2026-10-31）

### 12.1 已完成（R7-1 ~ R7-5 全部）

| 项 | 位置 | 改动 |
| --- | --- | --- |
| `--iv-fs-lead:14px` | `workbench-style.ts` | 新增令牌，梯度 11/12/13/14/16 |
| 面板标题 11→13 | `.iv-pane-title` | 改用 `--iv-fs-title` |
| 主创标题 13→14 | `.iv-create-title` | 改用 `--iv-fs-lead` |
| 空态主句 11→14 | `.iv-empty strong` | 改用 `--iv-fs-lead` |
| 弹层标题 13→14 | `.iv-pop-head-title` | 改用 `--iv-fs-lead` |
| 提示词解压 | `.iv-create textarea.iv-input` + JSX | `min-height:80px`、字号 12、focus 环；textarea 补 `iv-textarea` |
| 主按钮 lg | `.iv-btn--lg`(30/13) | 生成图片、融合运行升 lg |
| 视频生成分 | JSX | `sm` → `acc` 默认（W2） |
| 阻塞改红 | `iv-chip--err` + `.iv-meta--err` | block 不再用琥珀；命中建议同步变红 |
| busy 态（F8） | `.iv-btn--busy` + JSX | 生成/融合进行中：满不透明 + 旋转环 + `aria-busy`，不再 42% 灰 |
| 阻塞告警块 | `.iv-notice--block` + JSX | 左红条 + 加大呼吸 + `role=alert` |
| 次要面板降权 | `.iv-pane--quiet` + 4 处 JSX | 素材/任务/导出/诊断：底色退 surface、边框减淡 |

**验证**：`typecheck` 绿；`client-design-system.test.tsx` **28/28 通过**（新增 13 条层级/强调契约）；`client-prompt-risk` 4/4、`client-fusion-compose` 4/4、`client-generate-params` 3/3、`client-a11y` 4/4、`client-empty-states` 2/2、`client-export-panel` 4/4、`client-storyboard-edit` 7/7、`client-asset-health` 3/3、`client-ratio-slices` 3/3 全绿；`tsdown` 构建成功；`check:bundle` 通过（入口 67,114 / 69,600 B，**96%**；总产物 1,017,083 / 1,087,104 B，94%）。

### 12.2 17 个 accent 按钮的分级结果（已全部落地）

口径见 §5.2。**lg 只有 3 个**（主创生成图片、融合运行、时间轴导出）——这是"每屏 W1 ≤ 1"的直接体现；其余按"面板提交 / 行内紧凑"两档处理。

| 位置 | 动作 | 前 | 后 | 判定 |
| --- | --- | --- | --- | --- |
| `Workbench` 生成图片 | 全插件第一主行动 | `acc sm` | **`acc lg`** | W1 |
| `Workbench` 融合运行 | 融合生图主行动 | `acc sm` | **`acc lg`** | W1 |
| `Workbench` 时间轴导出 | 时间轴终局动作 | `acc sm` | **`acc lg`**（+busy） | W1 |
| `Workbench` 生成视频 | 与图片同级但略低 | `sm` | `acc` 默认 | W2 |
| `Workbench` 故事板规划 | 面板内进入核心产出 | `acc sm` | `acc` 默认（+busy） | W2 |
| `RatioSlicesPanel` 运行 | 面板底部独立行主行动 | `acc sm` | `acc` 默认（+busy） | W2 |
| `AssetHealthPanel` 运行 | 面板 CTA，但挤在 tab 行内 | `acc sm` | 保留 `sm`（+busy） | W2-尺寸受限 |
| `Workbench` 新建项目 | 内嵌表单，与输入同排 | `acc sm` | 保留 | W3 |
| `Workbench` 重命名保存 | 行内编辑 | `acc sm` | 保留 | W3 |
| `Workbench` 参数默认值保存 | 弹层底部 | `acc sm` | 保留 | W3 |
| `Workbench` 提示词保存 | 与输入同排 | `acc sm` | 保留 | W3 |
| `Workbench` 添加物料 | 行内添加 | `acc sm` | 保留 | W3 |
| `ResourceFoldersPanel` 发到表单 | 展开块内应用 | `acc sm` | 保留 | W3 |

**busy 态同步推广**（原来只有 3 个生成按钮）：时间轴导出、故事板规划、比例切片、健康检查四处**都会跑长任务**，原本 `disabled` → 42% 灰，与"进行中"语义冲突，现统一挂 `iv-btn--busy` + `aria-busy`。所有 busy 按钮**都不改 `disabled`**（防重入仍在），只覆写视觉。

### 12.3 R7-6 测试工具（脚本已就绪，待真机执行）

| 产物 | 状态 |
| --- | --- |
| `scripts/check-emphasis.mjs` + `pnpm run check:emphasis` | **已就绪**：10 条硬断言（尺寸/字号阶梯、提示词高度、busy 环、block 红条与语义色）+ 2 类软提示（accent/lg 配额）；缺 playwright 时 exit 2 |
| `data-workbench-pane="paneCreate"` | **已补**：快速模式主创 pane 原先没有标识，配额检查与后续真机脚本都无法定位它 |
| `docs/R7-验收清单.md` | **已就绪**：沙箱段 → 浏览器段 → 人工段三段式；含"预期会变 / 绝不能变"对照表（这轮像素 diff 必然非空，必须知道哪些是预期的） |
| `tests/client-design-system.test.tsx` | **28/28**：新增的 4 条把"文本域归 rows 管 / sm busy 环 10px / 主创 W1 簇 / 导出 lg"钉成结构契约 |
| 覆盖率 `test:coverage`、PNG 基线、眯眼/3 秒测试 | **待真机**（沙箱渲染完整工作台会 OOM） |

### 12.4 尚未落地（后续批次）

- F9 禁用理由（"为什么不能点"）——需新增文案键，入口预算紧（余 2,486 B），暂缓。
- 覆盖率实跑、PNG 基线、眯眼/3 秒测试（需真机）。

### 12.5 与计划的偏差

- 阻塞告警用 `.iv-notice--block`（非计划里的 `.iv-notice--block`）：现有元素是 `p.iv-notice`，复用其骨架比重写更稳。
- `.iv-pane--quiet` 用「边框减淡 55%」而非计划里的 `border-color:transparent`：无真机走查时保留边界更安全。
- 生成中仍 `disabled`（防重入保留），但由 `.iv-btn--acc…iv-btn--busy` 覆写不透明度与底色，视觉上是"活"的；未把 `disabled` 换成 `aria-busy` 单轨。
- `.iv-meta--err` 为本次新增（计划未单列），因 block 的命中建议需要与 warn 拉开颜色。
- **文本域全量修复**（计划只列了主创提示词）：查证发现 `composePrompt`、`storyboardScript`、分镜 image/video 提示词、融合风格备注、批量字幕等 **7 处 textarea 同样只挂 `.iv-input`**，全被 `height:23px` 压成单行。改为在样式表加一条 `textarea.iv-input{height:auto}`，让 `rows` 归位——一处 CSS 修 8 处，比逐个补类名不易漏。
- 时间轴导出升 `lg` 后与同行的 `sm` 取消按钮存在高度差（30 vs 20）；`.iv-toolbar` 是 `align-items:center`，视觉上居中而非错位，但建议真机确认该行是否需要整体抬到 `--iv-sp-3` 间距。

---

## 附录 A：冻结常量（本轮不碰）

轨道头 46px、左 rail 42px、控件高 23px、tile 22px、状态栏 23px、片段轨 58px —— 布局结构尺寸，不 token 化、不随层级调整。

## 附录 B：本轮新增一览（以代码为准，2026-10-31 核对）

```css
--iv-fs-lead:14px;   /* 填补 13→16 断档 */
```

新增**类**（非新令牌，全部在 Workbench chunk 内，不占入口预算）：

| 类 | 用途 |
| --- | --- |
| `.iv-btn--lg` | 主行动独立大号档（30px / 13px / 带投影） |
| `.iv-btn--busy` | 进行中：满不透明 + 旋转环（`pointer-events:none` 防重入） |
| `.iv-btn--sm.iv-btn--busy::before` | 小号按钮的环缩到 10px，避免撑破 20px 高度 |
| `.iv-notice--block` | blocking 级：左 3px 红条 + 加内边距 + 600 字重 |
| `.iv-meta--err` | block 的命中建议走红，与 warn 琥珀拉开 |
| `.iv-pane--quiet` | 次要面板降权：底退 surface、边框减淡 55% |
| `.iv-create textarea.iv-input` | 主创提示词：min-height 80px / 字号 12 / focus 环 |
| `textarea.iv-input` | **全局**：文本域高度归 `rows` 管（一处修 8 处） |

新增**结构标记**：`data-workbench-pane="paneCreate"`（快速模式主创 pane 原先无标识，配额检查与真机脚本需要它）。

新增**产物**：`scripts/check-emphasis.mjs`（`pnpm run check:emphasis`）、`docs/R7-验收清单.md`。

## Dev Note（非权威）

- "W1 ≤1 / W2 ≤3"是本轮的分级硬标准；PR 描述必须附分级表，否则 reviewer 无法判断"为什么这个按钮是 lg"。
- 提示词被压扁（F2）是本轮性价比第一的修复；但要真机确认，别照推断直接交。
- block 配色（line 3047 的 `ok?'ok':'warn'`）一行即可让用户分清"被拦"与"提醒"，先做这个。
- 假设 C 已确认（愿牺牲一点密度）；若真机发现密度代价过大，再把 R7-3/R7-5 的尺寸类改动降为颜色/字重类。
- 强调检查与对比度同属 Playwright 真机脚本，合并一次走查跑完，别分两次。
