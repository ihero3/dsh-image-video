# UI 打磨与测试优化方案（Round 6 · 修订版 v2）

> 状态：**方案阶段（已按代码实测修订）** · 作者：Track B · 日期：2026-10-27 · 修订：v2
>
> 前置：Wave 3（B-15/16/17）与 Round 5（B-3/B-4/B-5/B-6/B-7/B-18）全部落地；`main` @ `e29e1b5`。  
> 后续：每批次独立 PR；门禁统一走 `bash scripts/gate.sh`，合入后按批次推 gitlink。

## 0. 本轮定位

### 0.1 判据（先定义"打磨完成"，再谈做什么）

功能闭环之后，"专业排版/交互/测试"不是把 CSS 收拾干净，而是三条可验证的判据：

| 判据      | 含义                                      | 验证方式                     |
| ------- | --------------------------------------- | ------------------------ |
| **一致**  | 同类元素同源（令牌/骨架/图标/反馈态），换一个面板不换一套语言        | 契约测试 + 样式表静态扫描           |
| **完整**  | 每个交互有明确状态机（进入/进行/成功/失败/恢复），没有"点了没反应"的缝隙 | 状态矩阵评审 + 真机走查            |
| **可验证** | 视觉与可访问性不靠肉眼断言，有基线、有脚本、有阈值               | PNG 基线 + 对比度脚本 + a11y 用例 |

v1 方案把 70% 篇幅放在 gap 与字号上——那只是"一致"里最小的一块，且实测收益被高估（见 §0.3 勘误 2/3）。v2 把重心移到**信息层级**、**状态完整性**、**可验证性**。

### 0.2 事实基线（2026-10-27 对 `e29e1b5` 实测，替代 v1 的估数）

| 项                    | 实测值                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workbench-style.ts` | 676 行 → **695 行**（R6-1 后），CSS 令牌 25 → **59 个**（§3.5）                                                                                                                                                             |
| gap 分布（143 处）        | 6px×41、5px×30、4px×19、8px×15、3px×12、2px×7、10px×7、7px×5、9px×2、11px×2、12px×2、1px×1 —— **R6-1 已全部令牌化，见 §3.5**                                                                                                        |
| font-size 分布（12 个值）  | 10.5×19、11×18、10×17、11.5×8、9×5、8.5×5、12×4、9.5×3、12.5×3、8×1、13.5×1、16×1 —— **R6-1 已收为 8 档，见 §3.2**                                                                                                                |
| 其它未收敛维度              | border-radius 8 个值；z-index 仅 4 档（2/5/40/60）；transition 3 个时长；**7 处 elevation 阴影**（另有 5 处焦点/选中环）                                                                                                                  |
| 图标                   | `IconName` **40 个**，`STROKE` **38 个**，`SHAPES` 2 个，`BrandMark` 1 个                                                                                                                                               |
| 结构                   | 9 个可寻址 pane（`data-workbench-pane`）+ quick 模式页 1 个 + **3 个内嵌区块**；`.iv-pane-head` 9 个；**`.iv-pane-body` 仅 3 处使用、`panels/**` 内 0 处**（D2 决定删除，见 §4.1）                                                                |
| 可访问性属性               | `aria-label` 101 处（Workbench 84）；`aria-pressed/expanded/selected` 已用；**`aria-live` / `aria-busy` / `aria-modal` 各 0 处**                                                                                          |
| 视觉提示                 | `title=` 69 处（Workbench 43、WorkflowCanvas 12）                                                                                                                                                                    |
| 测试                   | UI 侧用例 **46 个**：`client-*.test.*` 44 个（39 `.tsx` + 5 `.ts`）+ `workbench.client.test.tsx` + `workflow-canvas.client.test.tsx`；`tests/**` 共 167 个（另有 `client-fake-api.ts` helper、`http-client.test.ts` 属宿主 HTTP 层） |
| 覆盖率口径                | `vitest.config.ts` 的 `coverage.exclude` **排除了 `src/client/**`**                                                                                                                                                  |
| 视觉基线                 | `docs/ui-baseline/` **只有 README，没有任何 PNG**                                                                                                                                                                       |

### 0.3 v1 勘误（先纠正，再执行）

| #  | v1 说法                                               | 实测                                                                                                                          | 结论                                                                                           |
| -- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1  | "全量 44 文件并发 vitest"                                 | 数字**成立**：`client-*.test.*` 共 44（39 `.tsx` + 5 `.ts`）。但 UI 侧实际是 **46**（漏了 `workbench.client` / `workflow-canvas.client`）     | 不是错误，是范围口径要写清；本文所有"client 全绿"都指这 46 个                                                        |
| 2  | 间距收敛为 4/6/8/10/14 五级，`6px→6px`、`8px→8px`            | 最常用的是 **5px（30 处）与 3px（12 处）**，14px **一次都没用到**                                                                              | v1 阶梯凭空造了顶级档，又漏掉最常用值；照做会"改 200 行、视觉几乎不变、还漏 40 处"                                             |
| 3  | 字号"散在 9–13.5px 共 6 个值"                              | 实际 **12 个值**，含 8px（时间轴刻度）、8.5px（mon-badge/step-n/t-kind）、16px（`iv-stat b` 数字）                                               | 4 级表漏了 micro 与 metric 两个真实角色                                                                 |
| 4  | "icon 39 个 / STROKE 37 个"                           | 40 / 38                                                                                                                     | 修正                                                                                           |
| 5  | "token 约 30 个"                                      | 25 个                                                                                                                        | 修正                                                                                           |
| 6  | flaky 根因："vitest 默认 `threads`，加 `pool:'forks'` 隔离"  | 官方文档 `pool` 默认值已改为 `'forks'`（1.0 统一池之后；本项目 4.1.11）                                                                          | **该修复是空操作**，不产生任何行为变化                                                                        |
| 7  | `pool` 未设导致 4–8 个 worker 抢 CPU                      | 真实 CPU 争抢已被 `scripts/gate.sh` 的 `--maxWorkers=2` 挡住；`pnpm test` 裸跑才复现                                                       | 修法应是"限制并行度 + 确定性等待"，不是换 pool                                                                 |
| 8  | `.iv-pop-panel` 被祖先 `.iv-page` 的 `overflow:auto` 裁切 | `.iv-page` 无 overflow；真正的裁切源是 `.iv{overflow:hidden}`（插件根被宿主右栏限高），且面板跨出 `.iv` 底部即不可达                                         | 根因写错；portal 到 `body` 会让 `container:iv-defaults/inline-size` 与 `width:min(560px,100%)` 的基准全失效 |
| 9  | 加 `.iv *::-webkit-scrollbar` 确保子容器统一                | 现有 `.iv ::-webkit-scrollbar`（后代选择器）**已覆盖所有后代**                                                                              | 空操作；真正缺的是根元素 `.iv` 自身                                                                        |
| 10 | "3 个新 panel 未复用 `.iv-pane`，改为 `.iv-pane` 骨架"        | 三者是**嵌在既有 `.iv-pane` 内部**的区块（`ModelCardsPanel` 3004、`RatioSlicesPanel` 3163、`ResourceFoldersPanel` 4065）                    | 改成 `.iv-pane` 会**嵌套 pane**（双边框/双内边距）；真问题是"子区块缺骨架"+"位置在宿主 pane-head 之前"                       |
| 11 | "缺键盘与动效审计"                                          | 已有 `client-a11y.test.tsx`、`client-keyboard.test.tsx`；`:focus-visible` 全局规则已存在（style 第 80 行）；`prefers-reduced-motion` 已有 3 处 | 必须建立在既有资产上做增量，别重复造                                                                           |
| 12 | B1 门禁含"PNG 基线 diff"                                 | 基线目录**一张图都没有**（README 自述"待采集"）                                                                                              | 门禁当前不可执行；必须先把采集做进 R6-0                                                                       |

### 0.4 已定决策（2026-10-27，不再讨论）

| #      | 决策                     | 理由                                                                                                                                                                            | 落地位置         |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **D1** | **覆盖率纳入 `src/client`** | 本轮全部工作都在 `src/client`，而它当前被 `coverage.exclude` 整体排除——等于"测试优化"没有度量对象，`gate.sh` 第 5 步对本轮改动免疫。不纳入就只能靠人工走查，无法回归                                                                   | §2.4 · R6-0  |
| **D2** | **删除 `.iv-pane-body`** | 实测其声明 `.iv-pane-body{display:flex;flex-direction:column;gap:8px;min-width:0}` 与 `.iv-pane` 的**前四条声明逐字相同**，没有任何独立取值 → 纯冗余包裹层。删它是零视觉变化，留它会让每个人以为"骨架里有 body 这一层"而实际 6 个 pane 都没有 | §4.1b · R6-2 |

> 两条都不涉及业务逻辑与数据，可独立回退（D1 回退=把 exclude 加回去；D2 回退=还原 3 处 `<div>` 与 1 行 CSS）。

---

## 1. 缺口矩阵（现状 → 目标）

### 1.1 设计令牌完整度

v1 只收 gap + font-size。一个可用作"专业工具"的系统至少还需四组：

| 组            | 现状                                                              | 目标                     |
| ------------ | --------------------------------------------------------------- | ---------------------- |
| 间距           | 12 个裸值（含 1px/3px/5px/7px/9px/11px 奇数值）                          | 6 档偶数节奏（§3.1）          |
| 字号           | 12 个值、字号与字重/行高各自为政                                              | 6 档"字号+字重+行高"三元组（§3.2） |
| 圆角           | 8 个值（1/2/3/4/5/6/10/999）                                        | 6 档（§3.3）              |
| 层级 / 动效 / 阴影 | z-index 裸写 4 档；transition 3 个时长无 easing 令牌；7 处 elevation 阴影各写各的 | 分别令牌化（§3.3）            |
| 布局稳定         | 无 `scrollbar-gutter`，列表在"有/无滚动条"间切换会抖 8px                       | `stable`（§3.4）         |

### 1.2 排版与信息层级（v1 完全没覆盖）

| #  | 问题                                                                                                               | 证据                                                                                                                                   |
| -- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| L1 | 两个子区块渲染在宿主 pane 标题**之前**，视觉上"内容先于标题"                                                                             | `RatioSlicesPanel`（3163）在 `iv-pane-head` 之前；`ResourceFoldersPanel`（4065）同                                                            |
| L2 | 三个区块的"容器语义"三种写法，与既有区块也不同源 **（R6-2 已统一为 `.iv-sub`，见 §4.6）**                                                       | `.iv-model-cards`（630）**连底色和边框都没有**；`.iv-res-folders`（644）/`.iv-ratio-slices`（625）用 `--iv-panel`；而 `.iv-fusion`（544）用 `--iv-surface` |
| L3 | 长文本策略不成体系：部分 `.iv-ellipsis`，部分裸 `span`，无 `min-width:0` 兜底                                                        | 列表/卡片里模型名、文件名长度不可控                                                                                                                   |
| L4 | 数字对齐**大体已做**（8 处 `tabular-nums`，含 `.iv-count`/`.iv-stat b`/时间码），缺 3 个次要点                                         | `.iv-status b`、`.iv-exp-facts`、`.iv-help-list b` 仍是比例数字，数值跳动时会抖                                                                      |
| L5 | 双语长度差异未验（en 串普遍长 30–60%）                                                                                         | 无任何布局压力用例                                                                                                                            |
| L6 | 密度不统一：同为"面板体"，`.iv-pane` padding 9/11、`.iv-fusion` 8、`.iv-model-cards` 0 **（R6-2 已统一为 sp-4/sp-5 与 sp-4，见 §4.6）** | 相邻面板内边距不同源                                                                                                                           |

### 1.3 交互状态机（v1 只做了 3 个组件，不够）

现状&#x662F;**"三态"而非"六态"**：`empty` 有（`.iv-empty` 10 处）、`error` 有（3 处 `role="alert"`，含 `PaneBoundary`；另有 **9 处**裸 `iv-meta--warn` 文本无任何角色）、`loading` 基本没有（无骨架，靠按钮 disabled 暗示）、`refreshing` / `retry` / `cancel` 缺失。

目标六态：`initial-loading` / `empty` / `ready` / `refreshing`（保留旧数据）/ `error-with-retry`（保留旧数据 + 顶部告警）/ `cancelled`。见 §5.1。

### 1.4 可访问性

| 缺口           | 具体                                                                                                                                                   | 影响                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 无播报通道        | `aria-live`/`aria-busy` 0 处；生成进度、任务状态、保存结果全靠视觉                                                                                                       | 读屏用户全程静默                                |
| 时间轴不可键盘操作    | `.iv-clip-h` 是 `<div role="separator" aria-orientation="vertical">`（Workbench 3451/3459），**无 `tabIndex`**、只有 `onMouseDown`、无 `aria-valuenow/min/max` | **违反 WCAG 2.1 SC 2.1.1**，剪辑核心操作对键盘用户不可用 |
| 弹层无 focus 管理 | `.iv-pop-panel` 有 `role="dialog"` 但无 `aria-modal`、无 focus 移入/trap/归还                                                                                 | 键盘用户会 Tab 到弹层背后的控件                      |
| 错误文本无角色      | 9 处 `iv-meta--warn` 纯文本，无 `role`/`aria-live`                                                                                                         | 失败不可感知                                  |
| 对比度未测        | `.iv-tx3`（52% 透明度）配 9px/10.5px 大量使用；`--iv-warn` 10.5px 正文                                                                                            | 高概率低于 4.5:1                             |
| 焦点环双标准       | 全局 `.iv :focus-visible` 用 box-shadow；`.iv-seg-cell:focus-visible` 用 outline                                                                          | 同产品两种焦点语言                               |

### 1.5 可验证性

| 缺口       | 现状                                                                                          |
| -------- | ------------------------------------------------------------------------------------------- |
| 视觉回归不可执行 | 无 PNG 基线；采集脚本要求带显示环境                                                                        |
| 覆盖率为零    | `src/client/**` 被 `coverage.exclude` 排除，UI 改动无度量（D1 已定纳入，见 §2.4）                            |
| 布局类断言缺位  | jsdom 无排版引擎：overlay 定位、裁切、对比度在单测里**永远测不出来**                                                 |
| 产品产物依赖   | `client-bundle` / `client-no-hardcoding` 读 `lib/`，测试前必须 `pnpm run build`（`gate.sh` 已如此，别绕过） |

---

## 2. R6-0 测试地基（必须先做，其他批次的前置）

### 2.1 前置：可执行环境（已实测，2026-10-27）

> 勘误：本文件 v2 初稿写"当前检出跑不了测试（`node_modules/.bin/vitest` 不存在）"——**错了**。插件目录的 `node_modules` 只有 13 个链接、无 `.pnpm`，但 Node 会向上解析到 harness 根 `node_modules`，`pnpm exec vitest` 实测可用：  
> `vitest/4.1.11 win32-x64 node-v22.22.2`，单文件用例 2.77s 跑完 3 passed。  
> 教训：**"二进制不在 ./node_modules/.bin"≠"跑不了"**，先 `pnpm exec <bin> --version` 再下结论。

标准顺序：

```bash
pnpm exec vitest --version              # 0. 先确认工具链可解析（而不是看 .bin 目录）
pnpm run typecheck                      # 1.
pnpm exec tsdown                        # 2a. 构建：产物契约测试（client-bundle / client-no-hardcoding）读 lib/
pnpm run check:bundle                   # 2b. 体积门禁
pnpm run test:ui                        # 3. UI 子集 46 个文件，--maxWorkers=2 --retry=0
bash scripts/gate.sh                    # 4. 全量五步
```

两个环境限制（实测，非代码问题）：

- `pnpm run build` 会先跑 `pnpm run clean`（`rmSync('lib')`），在受限沙箱里被 safe-delete 拦掉 → **改用 `pnpm exec tsdown` 跳过 clean**；真机不受影响。
- 本沙箱里一次并发跑 3 个以上 jsdom 用例文件会**空输出 exit 1**（内存被杀）；单文件/双文件正常。所以"全量全绿"只能在真机或 CI 上判定，沙箱内请按文件逐个验证。

### 2.2 Flaky 的正确修法（三层，按优先级）

症状已确认：`fireEvent.click(await screen.findByRole('button', { name: `${en.panePreview} ${name}` }))`（`tests/client-video-edit-slots.test.tsx:39`）在全量并发时超时；`findByRole` 继承 Testing Library 的 **1s** `asyncUtilTimeout`，与 `testTimeout: 60s` 无关——v1 这段诊断是对的。

修法按"根因 > 缓冲"排序：

1. **确定性就绪信号（根治）**——不要让用例猜"列表渲染好了没"。在 `.iv` 根节点上挂 `data-iv-ready="true"`，条件为首次 `health()` + `listAssets()` + `listProjects()` + `listRunningTasks()` 全部 settle（成功或失败都算 settle）。用例统一 `await waitFor(() => expect(root.dataset.ivReady).toBe('true'))` 后再选具体按钮。
   - 代价：生产代码加一个属性（无视觉、无 API 影响）。
   - 收益：所有 client 用例获得同一个确定性锚点，后续新增用例不再各自造等待。
2. **全局放宽异步查询超时（缓冲）**——在 `tests/setup-dom.ts` 的 `if (typeof window !== 'undefined')` 块内加 `configure({ asyncUtilTimeout: 2000 })`（`@testing-library/react`）。一行，全量生效；**与 `retry` 不同，它不会掩盖逻辑错误**，只是给慢机器留余量。
3. **限制并行度（消除争抢）**——`pnpm test` 加 `--maxWorkers=2`（与 `gate.sh` 对齐），或在 `vitest.config.ts` 设 `maxWorkers: 2`。`gate.sh` 的注释已经记录过"高并发下 worker 起不来"的教训，直接把结论产品化。
4. **不要做的事**：加 `pool: 'forks'`（默认已是 forks，空操作）；给 jsdom 用例加 `retry`（掩盖真实竞态）；把 `findByRole` 超时逐个调到 5s（治标且扩散）。

验证：连续跑 3 轮 `pnpm exec vitest run tests/client tests/workbench.client tests/workflow-canvas.client --maxWorkers=2 --retry=0` 全绿，且报告里 `retry` 计数为 0。

### 2.3 契约测试的分工（避免第 4 个重叠文件）

v1 打算新建 `tests/design-system.test.tsx` 覆盖 token/骨架/控件/图标，但仓库已有三份相邻职责的测试，直接新建会造成四处口径打架。改为**按职责扩写，只补真正缺的一份**：

| 文件                                           | 现有职责                         | 本轮增量                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/client-style-injection.test.ts`       | 注入幂等、版本戳自愈、surface token 不透明 | + 新增令牌存在性（`--iv-sp-*` / `--iv-fs-*` / `--iv-r-*` / `--iv-z-*` / `--iv-dur-*`）；+ 禁止裸奇数值回归（扫 `gap:5px`、`font-size:9.5px` 等）                                                                                                                             |
| `tests/client-theme.test.tsx`                | 不硬编码颜色、768 断点存在              | + 双主题下 `--iv-monitor` 恒深断言                                                                                                                                                                                                                            |
| `tests/client-a11y.test.tsx`                 | 模式切换 label/pressed、导出选择器命名   | + overlay focus trap/归还；+ `aria-live` 存在且节流；+ 时间轴手柄键盘微调                                                                                                                                                                                               |
| **新增** `tests/client-design-system.test.tsx` | —                            | **✅ 已落地（R6-0）**：图标契约（遍历 `ICON_NAMES` 断言 viewBox=24/strokeWidth=1.8/linecap=round/fill=none/aria-hidden，且每个名字真有图形）；21 个基础令牌定义存在；`--iv-monitor` 恒深；`.iv-pane` 不嵌套。目标类断言（head 首子元素、`.iv-pane-body` 已删、`.iv-sub` 顺序、间距/字号令牌）以 `it.todo` 占位，由 R6-1/R6-2 启用 |

> **契约测试的写法纪律**：只断言"当前已成立"的事实；"改完才成立"的写 `it.todo` 并在标题里标批次。写早了会当场把 `gate.sh` 弄红，最后一定是被人删掉——那比不写更糟。
>
> 为此在 `icons.tsx` 增了 `ICON_NAMES`（由 `STROKE` + `SHAPES` 的键派生）。这样新图标进表就自动纳入契约，不会出现"加了 `IconName` 忘了加图形、渲染出空 svg"的漂移。

"禁止裸奇数值"这条是本轮回归保护的关键：它让"以后有人再写 `gap:7px`"在 CI 里直接失败，而不是等下一次人工审计。

### 2.4 覆盖率口径（已定：纳入 `src/client`）

`coverage.exclude: ['src/client/**']` 让本轮所有 UI 工作**不计入任何度量**，`gate.sh` 第 5 步对本轮改动完全免疫。**决策 D1：纳入。**

落地步骤（顺序不能换）：

1. **先测基线，再动配置**：
   ```bash
   pnpm exec vitest run --coverage 2>&1 | tail -20   # 记下当前四项全局值
   ```
2. **改 `vitest.config.ts`**：从 `coverage.exclude` 移除 `'src/client/**'`。保留 `'src/**/*.d.ts'`；不排除 `locales.ts` / `workbench-style.ts`（纯数据与字符串常量在模块求值阶段即视为已执行，不会虚低；排除它们反而会让分母失真）。
3. **同步下调全局阈值**——这是最容易漏的连锁：`thresholds` 的全局那组（当前 `lines:83 / functions:80 / branches:70 / statements:81`）判的是**全仓汇总**，纳入 client 后汇总必降，不改就会直接红。按既有口径取 `新基线 − 2pp`。
4. **给 client 单列一档**（vitest 4 支持 glob 键，与全局键共存）：
   ```ts
   thresholds: {
     lines: <新全局>, functions: <新全局>, branches: <新全局>, statements: <新全局>,
     'src/client/**': { lines: <client 实测−2>, functions: …, branches: …, statements: … },
   }
   ```
   若该版本的 glob 阈值行为与预期不符（分档不生效/与全局冲突），退化方案：保持全局一组，另用 `vitest run --coverage --coverage.include=src/client/**` 单独跑一次并人工对表——不要为此引入第二个测试框架。
5. **`coverage.all` 默认 true 要心里有数**：未被执行的文件也进分母。client 里有大量"只在某个 mode 才渲染"的组件（canvas / timeline / 各 pane），分母比"被 import 的"大得多。所以首轮 client 数字大概在 **45–65%** 区间——这是**正常值，不是缺陷**。

首轮数字不达标的处理原则（重要）：

- **不要为凑阈值补测试**。阈值是回归护栏，不是 KPI；补一堆断言 DOM 存在的测试只会让噪声上升。
- 正确做法是按目录分档并写明"逐轮提升"，例如 `'src/client/panels/**'` 单独一档给更低阈值（面板三态迁移后自然会涨），`'src/client/*.tsx'` 一档。每轮结束把实测值追加进 `docs/COVERAGE-PLAN.md` 的表格，涨了就把阈值抬上去。
- 若某文件确实不可测（例如纯样式字符串），排除它时必须在 `COVERAGE-PLAN.md` 写明理由，不许静默 exclude。

验收：`bash scripts/gate.sh` 第 5 步绿；`COVERAGE-PLAN.md` 里有一张"日期 / 全局 / client 分档 / 本轮变更"的表。

回退：把 `'src/client/**'` 加回 `exclude`、全局阈值还原即可（一次改动，无数据影响）。

### 2.5 视觉基线（把不可执行的门禁变可执行）

`docs/ui-baseline/README.md` 已写明：脚本就绪、**PNG 待采集**。所以 R6-0 必须先采集一次并入库，否则 v1 的"PNG diff 门禁"是空的。

落地要求：

1. 场景清单沿用 README 的 8 项，但补两项本轮新增关注点：`overlay-open.png`（默认值弹层展开）、`timeline-trim.png`（片段手柄 hover）。
2. **固定采集条件**：同一 OS/同一浏览器版本/固定 1440×900 与 420×900 两档视口/固定种子数据（示例项目 + 3 素材 + 1 任务），否则跨机器 diff 全是字体渲染噪声。
3. 基线与阈值口径：**只在同一环境内比**；`pixelmatch` 阈值 `0.1%` 像素差，超过即人工看；跨 OS 不比（字体 hinting 不同，比了必然红）。
4. 体积控制：单图 < 200KB，必要时 `.gitattributes` 标 LFS 或改 webp。

---

## 3. R6-1 设计令牌补全（零结构风险）

> **状态：✅ 已完成（2026-10-27）**。`workbench-style.ts` 版本戳 → `2026-10-27.1`；契约测试 13 passed / 3 todo；typecheck / build / check:bundle 全过。  
> 与计划的**三处偏差**（全量替换、行高未做、阴影 4 档）见 §3.5。

### 3.1 间距：按真实分布定 6 档（不是凭空五级）

实测表明节奏是 **2px 偶数**为主（占 91/143），奇数值是漂移产物。定为：

```css
.iv{
  --iv-sp-1:2px;   /* 行内微调：图标与文字、list 行之间 */
  --iv-sp-2:4px;   /* 控件簇内：工具栏按钮、chip 组 */
  --iv-sp-3:6px;   /* 元素之间：字段、行、卡片内部 */
  --iv-sp-4:8px;   /* 区块之间：pane body、表单组 */
  --iv-sp-5:10px;  /* 版面分隔：page/dock、面板之间 */
  --iv-sp-6:12px;  /* 呼吸位：hero、状态栏组间 */
}
```

归并规则（只有离群值需要动，共 52 处）：

| 现值   | 处数 | 归并到         | 理由                                                              |
| ---- | -- | ----------- | --------------------------------------------------------------- |
| 1px  | 1  | `--iv-sp-1` | 视觉上与 2px 无差                                                     |
| 3px  | 12 | `--iv-sp-2` | 紧凑簇内                                                            |
| 5px  | 30 | `--iv-sp-2` | 工具栏簇内，收紧 1px 让 380px 窄栏更从容；若视觉复核偏挤，**一次性**整体改 `--iv-sp-3`，不要逐处挑 |
| 7px  | 5  | `--iv-sp-3` | 字段间距                                                            |
| 9px  | 2  | `--iv-sp-4` | 就近向下                                                            |
| 11px | 2  | `--iv-sp-6` | hero 呼吸位（唯一向上归的例外）                                              |

**执行策略（已落地，与原计划不同，记录偏差）**：原计划是"只替换语义容器类、组件内部保留裸值"，**实际做了全量替换**——143 处 `gap` 全部走 `var(--iv-sp-*)`。理由：

1. 只替换一部分，契约就无法断言"无裸 gap"，而这条断言是防止"以后又写 7px"的唯一手段；
2. 逐条判断 143 处属于"语义容器"还是"组件内部"，成本高于收益且标准主观；
3. 位移已核实 ≤1px：5px→4px（30 处）、3px→4px（12 处）、7px→6px（5 处）、9px→8px（2 处）、11px→12px（2 处）、1px→2px（1 处）；且面板宽度由 `grid` / `minmax` 决定，不依赖 gap，不会引起布局断裂。

代价与后续约定：`.iv-chip` / `.iv-btn` 这类组件内微间距也被锁进全局节奏。若将来某个组件确实需要独立节奏，**加组件级 `--iv-sp-*` 覆盖**，不要再新增裸值。

**冻结常量（不许 token 化，动了会错位）**：轨道头 `46px`（`.iv-ruler` margin-left 与 `.iv-track` grid 首列必须一致）、左 rail `42px`、控件高 `23px`、tile `22px`、status 高 `23px`、`.iv-clips` 高 `58px`。这些是**布局结构尺寸**，不是间距。

### 3.2 字号：角色 = 字号 + 字重

字号不能单独收——9px 配 700 和 9px 配 400 是两种可读性。按"角色 = 字号 + 字重"收（**行高本轮不动**，理由见 §3.5）：

| 令牌               | 字号     | 字重  | 角色                           | 吸收的现值            |
| ---------------- | ------ | --- | ---------------------------- | ---------------- |
| `--iv-fs-root`   | 12px   | —   | `.iv` 根基准（唯一不是"角色"的令牌）       | 12               |
| `--iv-fs-metric` | 16px   | 600 | 统计数字（`iv-stat b`）            | 16               |
| `--iv-fs-title`  | 13px   | 600 | 面板标题、Hero、品牌名、浮层标题           | 12.5(标题类) / 13.5 |
| `--iv-fs-strong` | 12px   | 600 | 行主标题、卡片名（`.iv-row` 12.5→12）  | 12 / 12.5(行文本)   |
| `--iv-fs-body`   | 11px   | 400 | 控件文字、正文、行文本                  | 11 / 11.5        |
| `--iv-fs-meta`   | 10.5px | 400 | 辅助说明、计数、空态文案、状态栏             | 10 / 10.5        |
| `--iv-fs-micro`  | 9px    | 700 | 大写微型标签、时间码、徽章、`iv-stat span` | 8.5 / 9 / 9.5    |
| `--iv-fs-tick`   | 8px    | 500 | **仅**时间轴刻度（等宽数字密集）           | 8                |

> 12.5px 需要分两处判断：`.iv-row`（列表主文本，互动元素）归 `strong` 12px；`.iv-brand-name` / `.iv-pop-head-title`（标题类）归 `title` 13px。同值不同角色，说明"按值收敛"不够，必须按角色收敛。

配套字重令牌 `--iv-fw-regular:400` / `--iv-fw-medium:600` / `--iv-fw-bold:700`，把现存的 `500`→400、`650`→600 归并。

三条红线：

1. **8px/8.5px 一律提到 9px**。时间轴刻度（`.iv-ruler b`）是唯一例外论证对象：等宽数字 + 高频刷新，可保留 8px，但必须进对比度检查（§6.2），不达标就提到 9px 并给刻度降密度（每 2 格标一次）。
2. 小字必须先过对比度再定字号。`.iv-tx3` 是 52% 透明混合，配 9px 通常是本轮最容易踩线的地方。
3. 降低动作色（`--iv-warn-soft` / `--iv-danger-soft` / `--iv-ok-soft`）只做背景，文字一律用实色 token。现有 `.iv-meta--warn`（`color:var(--iv-warn)` + 10.5px）要按这条复核。

### 3.3 圆角 / 层级 / 动效 / 阴影

```css
.iv{
  --iv-r-xs:3px;    /* 缩略图、clip、小色块（吸收 1/2px） */
  --iv-r-sm:4px;    /* 小控件、badge */
  --iv-r:5px;       /* 默认：按钮/输入/pane 内元素（保持现值，不动视觉） */
  --iv-r-lg:6px;    /* pane 容器 */
  --iv-r-xl:10px;   /* 浮层/对话框 */
  --iv-r-pill:999px;/* chip/badge/步骤 */

  --iv-z-sticky:2;    /* 浮层吸底/吸顶头 */
  --iv-z-playhead:5;  /* 播放头（时间轴最上） */
  --iv-z-tip:40;      /* 轻提示/气泡 */
  --iv-z-overlay:60;  /* 模态/弹层 */

  --iv-dur-1:100ms;   /* hover/背景 */
  --iv-dur-2:120ms;   /* 状态切换 */
  --iv-dur-3:300ms;   /* 进度条宽度 */
  --iv-ease:cubic-bezier(.2,.8,.3,1);

  --iv-shadow-acc:0 1px 2px color-mix(in srgb,var(--iv-acc) 40%,transparent);      /* 主按钮常态 */
  --iv-shadow-acc-hover:0 2px 6px color-mix(in srgb,var(--iv-acc) 45%,transparent); /* 主按钮 hover */
  --iv-shadow-2:0 8px 24px color-mix(in srgb,#000 30%,transparent);                 /* 气泡 / 画布控件 */
  --iv-shadow-3:0 18px 46px color-mix(in srgb,#000 30%,transparent),0 2px 8px color-mix(in srgb,#000 16%,transparent); /* 浮层 */
}
```

**阴影只收 4 档，不是 5 档**：`.iv-monitor` 的 `inset 0 1px 6px`（内嵌凹陷）与 `.iv-help` 的 `0 10px 32px var(--iv-tx) 26%`（用文字色混合，深色主题下才不发灰）语义不同，硬归并会改变它们在深色主题下的观感——保留裸值并在此注明，比造两个只用一次的令牌好。

层级注意：`--iv-z-overlay:60` 只在插件自己的层叠上下文内有效。**portal 出去以后**（§5.5）宿主右栏可能有自己的 z-index 栈，`60` 未必压得住——所以 portal 目标应选"插件挂载点的兄弟层"而不是 `document.body`，或经宿主令牌取值。这一条必须在 R6-3 用真机确认，不能靠 CSS 猜。

### 3.4 滚动条与布局稳定

- 现有 `.iv ::-webkit-scrollbar` 已覆盖全部后代，**不需要照 v1 再加 `*` 版**；只补根元素：`.iv,.iv ::-webkit-scrollbar{...}`。
- 给滚动容器（`.iv-main`、`.iv-list`、`.iv-pop-panel`、`.iv-exports-list`）加 `scrollbar-gutter:stable`，消除"出现滚动条时内容横向抖 8px"。
- `.iv-pop-panel` 已有 `overscroll-behavior:contain`，保留。

### 3.5 落地结果与偏差（2026-10-27 实测）

替换量（脚本确定性替换后逐项核对，非估算）：

| 类别                        | 替换处数          | 残留                            |
| ------------------------- | ------------- | ----------------------------- |
| `gap`                     | 143           | 仅 `gap:0` 1 处（轨道头内部，不是间距）     |
| `font-size`               | 85            | 0（全部 `var(--iv-fs-*)`）        |
| `font-weight`             | 25            | 0                             |
| `border-radius`           | 32            | 0 像素值（`50%` 圆形保留）             |
| `z-index`                 | 8             | 0                             |
| `transition` 时长           | 8             | 0（`animation` 关键帧时长保留）        |
| 阴影                        | 5             | 2 处有意保留（monitor inset / help） |
| `scrollbar-gutter:stable` | 5             | —                             |
| 令牌                        | 25 → **59 个** | —                             |

**三处偏差（记录在案）**：

1. **间距全量替换**（原计划只换语义容器类）——理由与代价见 §3.1 末段。
2. **行高本轮不动**。原计划写"字号+字重+行高三元组"，实际只做了字号+字重。原因：行高现值集中在 1.2–1.5，收成 3 档会整体改变密集卡片（stat / clip / node）的高度，属**可感知的布局变化**，而它对可读性的收益远低于字号；混在本批次做会让"1px 位移"与"整块增高"纠缠，PNG 对照也分不清是哪个引起的。留给"真有具体排版问题"时再单独做。
3. **阴影 4 档而非 5 档**——理由见 §3.3 末段。

**可感知的视觉变化（预期内，需真机 PNG 对照）**：

| 变化            | 范围                               | 幅度      |
| ------------- | -------------------------------- | ------- |
| 工具栏 / 控件簇间距收紧 | 30 处 `gap:5px→4px`               | 1px     |
| 紧凑簇间距放宽       | 12 处 `gap:3px→4px`               | 1px     |
| 微型标签 / 徽章字号上调 | 5 处 `8.5px→9px`                  | 0.5px   |
| 10px 文本上调     | 17 处 `10px→10.5px`               | 0.5px   |
| Hero 呼吸位放宽    | 2 处 `11px→12px`                  | 1px     |
| 进度条 / 片段单元格圆角 | `2px→3px`（元素高 3–16px，浏览器会 clamp） | ≈0      |
| 节点错误气泡阴影      | `0 8px 20px→0 8px 24px`          | 半径 +4px |

**体积**：客户端 chunk `902,137 B`（+5,258 B，全部来自新令牌与注释），入口 `plugin.js` 不变（`64,943 B`）——CSS 在 chunk 里，不进首屏。总产物 967,080 B 占预算 89%。

---

## 4. R6-2 排版与信息层级（v1 缺的一层）

> **状态：✅ 已完成（2026-10-27）**。版本戳 → `2026-10-27.2`；契约测试 **15 passed（0 todo）**；相关既有测试全绿；build / bundle 89% 通过。  
> 落地结果、两个新发现与一处偏差见 §4.6。

### 4.1 三个内嵌区块：是"位置 + 骨架"问题，不是"容器类"问题

三个区块（`ModelCardsPanel` / `RatioSlicesPanel` / `ResourceFoldersPanel`）都渲染在既有 `.iv-pane` **内部**。所以：

- ❌ 不能把容器改成 `.iv-pane`（会产生嵌套 pane：双边框、双内边距、`.iv-pane` 的 `padding:9px 11px` 加在已有 pane 内层）。
- ✅ 引入**子区块骨架** `.iv-sub`（层级介于 pane 与卡片之间）：

```
.iv-pane                    （display:flex; column; gap:8px —— 它本身就是容器）
  ├─ .iv-pane-head          （tile + title + chip + actions；必须是第一个子元素）
  ├─ .iv-sub                （子区块：1px --iv-line 边框 + --iv-surface 底 + sp-3/sp-4 内边距）
  │    ├─ .iv-sub-head      （小标题 + 动作，10.5px 大写微型标签）
  │    └─ .iv-sub-body
  └─ ...（其余直属内容）
```

- ✅ **移动挂载位置**：`RatioSlicesPanel`（3163）与 `ResourceFoldersPanel`（4065）当前在 `iv-pane-head` 之前渲染，必须移到 head 之后。这是本轮唯一涉及 JSX 顺序的改动，收益是信息层级正确（标题在内容之上），风险是纯结构移动（不动 hooks/状态）。
- 验收：契约断言"`.iv-pane` 首个可渲染子元素是 `.iv-pane-head`，且任何 `.iv-sub` 不得出现在它之前"。

### 4.1b 删掉 `.iv-pane-body`（决策 D2）

这不是"要不要统一"的问题，而是**它是个纯冗余层**。实测其声明（`workbench-style.ts:256`）：

```css
.iv-pane-body{display:flex;flex-direction:column;gap:8px;min-width:0}
```

与 `.iv-pane` 的**前四条声明逐字相同**，没有一条独立取值。全仓只有 3 处使用（`Workbench.tsx` 4023 / 4081 / 4382），`panels/**` 零使用；其余 6 个 pane 都是把子元素直接挂在 `.iv-pane` 下。留着它只会让人以为"骨架里真有 body 这一层"，而实际大部分 pane 没有——这正是"看着统一、实际没统一"的典型。

删除方式（零视觉变化，父级 `flex column + gap:8px` 完全等价）：

1. 3 处 `<div className="iv-pane-body">…</div>` 换成 `<>…</>`（fragment 不产生 DOM，子元素直接成为 `.iv-pane` 的 flex item，间距仍是 8px）；
2. 删掉 `workbench-style.ts:256` 那一行；
3. 契约测试加一条 `expect(document.querySelector('.iv-pane-body')).toBeNull()`，防止有人"顺手加回来"。

例外：若将来某个 pane 真的需要**独立滚动区**，不要复活 `body` 这个抽象，而是起语义明确的名字（如 `.iv-pane-scroll`，带 `overflow:auto; overscroll-behavior:contain`）——"能滚"才是它唯一的正当理由，其余属性都与 `.iv-pane` 重复。

### 4.2 面板头一致性

9 个 pane 结构与 9 个 `.iv-pane-head` 数量已对齐，剩余差异是内部顺序与 actions 位置。收敛为固定三段，并把"head 必须是第一个子元素"写成契约（当前 2 个 pane 违反）：

```
.iv-pane-head = [.iv-pane-tile] [.iv-pane-title] [.iv-chip 状态] [.iv-pane-actions 靠右]
```

逐 pane 走查表（11 个容器，含 quick 页）：标题是否 `h3`、tile 图标是否语义正确、actions 是否全部靠右、状态 chip 是否只在有状态时出现。**不新增 pane，不重排模式页结构。**

### 4.3 密度与对齐

| 项       | 规则                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 面板内边距   | 统一 `padding: var(--iv-sp-4) var(--iv-sp-5)`（左右略宽于上下，符合工具面板阅读习惯）；`.iv-fusion` / `.iv-ratio-slices` 等区块改用 `.iv-sub` 后共享同一内边距          |
| 图标与文字基线 | 图标 `align-items:center`，但标题行内的 14px 图标与 11px 文字需 `transform: translateY(.5px)` 级光学微调，逐处核（不许全局 hack）                                 |
| 数字对齐    | 已有 8 处 `tabular-nums`（`.iv-count`/`.iv-stat b`/时间码/刻度等），补齐剩余 3 处：`.iv-status b`、`.iv-exp-facts`、`.iv-help-list b`（数值每秒刷新，比例数字会横向抖动） |
| 缩略图比例   | `.iv-thumb` 固定 64×44（16:11）；素材横向混排时不得被 flex 拉伸，`flex:none` 已具备，补 `object-fit:cover` 回归断言                                            |
| 长文本     | 三层兜底：容器 `min-width:0` → 文本 `.iv-ellipsis` → 可展开处给 `title`（与 §5.6 的 `data-tip` 合并）                                                   |

### 4.4 双语与极端内容压力（**改判：不在单测里做**）

原计划写"放进超长英文串 → 断言 `scrollWidth <= clientWidth`"。**这条要撤回**：jsdom 没有排版引擎，`scrollWidth` / `clientWidth` 恒为 0，这种断言永远通过——写它等于自欺，比不写更危险（会给人"已覆盖"的错觉）。

改为放进真机矩阵（§6.1），作为必查项：

| 场景                                            | 检查                                      |
| --------------------------------------------- | --------------------------------------- |
| 最长英文标签（`Generate video from reference` 级）放进按钮 | 不换行撑破、不被裁切、tooltip 可见                   |
| 80 字符文件名 + 中英混排                               | ellipsis 生效、行高不变、相邻元素不被挤走               |
| 计数 0 / 1 / 1000+                              | 状态栏与计数 chip 不换行错位、数字不跳宽（`tabular-nums`） |
| 空项目（`defaultRows` 为空）                         | 摘要条不出现、不留空壳高度                           |
| 视口 380px + 浏览器 200% 缩放                        | 工具栏不重叠、面板可滚、字不糊                         |

单测里**能**做且值得做的只有两类，已分别落在别处：文案键完整性（`client-i18n`）、结构与令牌契约（`client-design-system`）。

### 4.5 空态升级

`.iv-empty` 已在 10 处使用，但新 panel 仍用 `iv-meta` 纯文本当空态。统一为 `PanelState kind="empty"`（§5.1），并强制两件事：

1. 空态必须有**主动作**（"去生成"/"新建项目"/"导入素材"），否则用户卡在死胡同；
2. 空态文案说明**为什么空**（未初始化 / 未选项目 / 真的没有），三种原因不能共用一句话。

### 4.6 落地结果与两个新发现（2026-10-27 实测）

**已做**：

| 项                      | 结果                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.iv-sub` 骨架           | 新增 `.iv-sub` / `.iv-sub-head` / `.iv-sub-title` / `.iv-sub-actions`；并把原先 7 条各自为政的容器规则（`iv-fusion` / `iv-prompt-studio` / `iv-storyboard` / `iv-compose-params` / `iv-pipeline-pick` / `iv-ratio-slices` / `iv-res-folders` / `iv-model-cards`）合并成**一组共享声明**（padding 7/8 不一、底色在 panel 与 surface 之间摇摆 → 统一 `--iv-surface` + `sp-4`） |
| 三个面板容器                 | `ModelCardsPanel` / `RatioSlicesPanel` / `ResourceFoldersPanel` 的容器改为 `.iv-sub`，头部改为「`.iv-sub-title`（大写微型标签 + 图标）+ `.iv-sub-actions`（靠右）」                                                                                                                                                                                         |
| 位置修正                   | `RatioSlicesPanel` 与 VoiceCard 从 `paneTimeline` 的 head **之前**移到主内容之后；`ResourceFoldersPanel` 从 `paneResources` 的 head 之前移到三栏物料库之后                                                                                                                                                                                                  |
| `.iv-pane-body` 删除（D2） | 3 处改 `<>`，CSS 删除；契约断言 `querySelector('.iv-pane-body') === null`                                                                                                                                                                                                                                                                   |
| 面板内边距                  | `.iv-pane` `padding:9px 11px` → `var(--iv-sp-4) var(--iv-sp-5)`；`scroll-margin` 一并 token 化                                                                                                                                                                                                                                        |
| 数字对齐                   | 补齐 `.iv-status b`、`.iv-exp-facts`、`.iv-help-list b` 的 `tabular-nums`（此前 8 处已有）                                                                                                                                                                                                                                                    |
| 契约测试                   | 3 条 `it.todo` 全部转成实断言（quick 模式 + 时间轴模式两轮），**15 passed / 0 todo**                                                                                                                                                                                                                                                                  |

**新发现 1（真实缺陷，顺手修了）**：`.iv-card` / `.iv-card-head` / `.iv-card-body` / `.iv-card-note` 这四个类名**在样式表里根本没有定义**——`PipelineCard` 与 `VoiceCard` 一直在用空类名。而 `.iv-ico` 是 `display:block`，所以在没有 `display:flex` 的 head 里，**图标会独占一行、标题与徽章掉到第二行**。已补最小样式（`.iv-card` flex column + gap、`.iv-card-head` flex row + gap）。这比 `.iv-pane-body` 更隐蔽：`pane-body` 至少还有样式，只是冗余；`iv-card` 是"名字在、样式不在"。

**新发现 2（记录，未做）**：`PipelineCard` / `VoiceCard` 里仍有大量内联 `style={{ display:'grid', gap:'8px' }}`（8px 是裸值，绕过了刚建立的间距令牌）。内联样式优先级高于类，属于"令牌化漏网"。建议 R6-3 一并清：把内联 gap 换成语义类（`.iv-card-body` 已可承载），否则"无裸 gap"的契约只是**样式表内**成立，DOM 内联仍可绕过。

**一处偏差**：原计划 §4.2 要"逐 pane 走查表（标题是否 h3、actions 是否靠右）"，实际只做了契约化（head 必须首位 + 子区块不得抢位），没有逐个 pane 手工走查 9 个头部。原因：契约能拦住**结构错位**这类真问题，而"tile 图标是否语义正确"是主观判断，逐个人工核一遍的成本与收益不成比例；这类判断留给真机走查时顺手记。

---

## 5. R6-3 交互状态机与可访问性（中风险）

> **状态：🟡 部分完成（2026-10-27）**。已落地：时间轴手柄键盘化、弹层 focus 管理、常驻播报区、`placeOverlay` 纯函数。  
> 未做（拆为 R6-3b，见 §5.8）：`PanelState` 六态组件与面板迁移、`data-tip`、状态栏消息队列。

### 5.1 一个组件表达六态，而不是三个组件

v1 的 `PanelLoading` / `PanelEmpty` / `PanelError` 三个组件会让调用方在三个 API 间选择，且没有"刷新中"和"错误但有旧数据"这两种真实状态。改为单组件 + 判别式：

```tsx
// panels/PanelState.tsx —— 类型用 PanelView，组件用 PanelState，避免同名混淆
type PanelView =
  | { kind: 'initial-loading' }
  | { kind: 'empty'; reason: 'no-project' | 'not-initialized' | 'no-data'; action?: ReactNode }
  | { kind: 'error'; message: string; onRetry?: () => void; stale?: ReactNode }
  | { kind: 'refreshing'; stale: ReactNode }
```

默认 a11y 行为内置（这样调用方无法忘）：

| kind            | role     | aria               | 视觉                                           |
| --------------- | -------- | ------------------ | -------------------------------------------- |
| initial-loading | `status` | `aria-busy="true"` | 3 条骨架，高度按内容 3 档；`prefers-reduced-motion` 下静态 |
| empty           | `status` | —                  | `.iv-empty` + icon tile + 主行动按钮              |
| error           | `alert`  | —                  | 顶部告警条 + Retry；`stale` 数据**继续显示**，不 blank     |
| refreshing      | `status` | `aria-busy="true"` | 保留内容 + 顶部 2px 不定进度条                          |

迁移顺序：先建组件 → 3 个新 panel 迁（它们逻辑最乱、无历史包袱）→ 2 个已用 `role="alert"` 的 panel（`AssetHealth`/`ExportHistory`）→ 其余逐 pane。每迁一个跑该 pane 的用例并提交。

### 5.2 错误恢复

现状问题不是"没有错误 UI"，而是**错误 UI 会把内容顶掉**（`iv-notice` 在 pane body 顶部，加载失败时列表区变空）。规则：

- 有旧数据 → 顶部告警 + 旧数据可见 + Retry；
- 无旧数据 → 整块 `PanelState error`；
- 错误原文（`thrown.message`）默认折叠，只显示人话 + "详情"展开，避免把 RPC 堆栈糊在用户脸上；
- 所有 Retry 必须有 loading 反馈（按钮进入 disabled + 文案切换），否则用户会连点。

顺带修一个真实缺陷：`ModelCardsPanel.tsx:67` 的 `{loading ? t('modelCardsLoadFailed') : '↻'}` —— loading 时按钮上显示的是"加载失败"文案。应改为 spinner 或省略号。

### 5.3 播报通道（aria-live）

在 Workbench 根内加一个视觉隐藏的 `<LiveRegion>`（`role="status" aria-live="polite"`），集中投递：

| 事件                                      | 文案               | 节流     |
| --------------------------------------- | ---------------- | ------ |
| 任务状态迁移（queued→running→succeeded/failed） | "任务开始 / 完成 / 失败" | 每次迁移一条 |
| 生成进度                                    | 不播报百分比（噪声）       | —      |
| 导出开始/完成                                 | 一条               | —      |
| 保存成功/失败                                 | 一条               | —      |
| 批量操作结果                                  | "已删除 3 项，1 项失败"  | 合并为一条  |

规则：同一事件 5s 内不重复；`role="status"` 而非 `alert`（除失败）；文案走 `locales.ts`（不要拼英文）。

### 5.4 键盘与 focus（本轮最大补齐项）

| 项           | 做法                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 弹层 focus 管理 | 打开：焦点移到弹层第一个可聚焦元素（无则容器 `tabIndex={-1}`）；Tab 循环 trap；Esc 关闭；关闭后焦点**归还触发按钮**。`.iv-pop-panel` / `.iv-help` 加 `aria-modal="true"`（都是阻断式编辑面）                                                                                                  |
| 时间轴手柄键盘化    | 沿用现有 `role="separator"`（window-splitter 模式，比 `slider` 更贴语义），补 `tabIndex={0}` + `aria-valuenow/min/max`（毫秒）+ `aria-valuetext`（时间码）；**方向键 100ms、Shift + 方向键 1s、Home/End 到两端**（原计划写"1 帧/10 帧"，已改判为毫秒，理由见 §5.8）。**这是 WCAG 2.1.1 的硬要求**，不是加分项 |
| 片段本体        | 选中态支持键盘切换（`ArrowUp/Down` 换片段），删除快捷键需在 help 浮层里列出并保持一致                                                                                                                                                                                    |
| 焦点环统一       | 保留全局 `.iv :focus-visible` box-shadow 方案，删掉 `.iv-seg-cell:focus-visible` 的 outline 覆盖，避免两套语言                                                                                                                                              |
| 录制/输入       | 输入框内不劫持全局快捷键（现有 `client-keyboard` 已覆盖 Ctrl+Z，需扩展：在 `input/textarea` 聚焦时不触发）                                                                                                                                                              |

### 5.5 Overlay 定位：抽成纯函数，别用 CSS 猜

真实裁切源是 `.iv{overflow:hidden}`（插件根 = 宿主右栏的可视区）。而 `.iv-pop-panel` 的宽度依赖 `container:iv-defaults/inline-size` + `@container` + `width:min(560px,100%)`——**一旦 portal 到 `body`，`100%` 变成视口宽、`@container` 失效**，v1 的"portal 一行修复"会直接把弹层撑满屏。

正确做法：

1. 抽 `src/client/overlay-position.ts`：

```ts
export interface Rect { top: number; left: number; right: number; bottom: number }
export interface Placement { side: 'below' | 'above'; maxHeight: number; align: 'start' | 'end' }

/** 纯函数：给定锚点、浮层期望尺寸、可视区，算出放置与最大高度。 */
export function placeOverlay(anchor: Rect, panel: { w: number; h: number }, viewport: { w: number; h: number }, prefer: 'below' | 'above' = 'below'): Placement
```

1. 单测覆盖：右侧贴边→`align:'end'`；下方空间不足→`side:'above'`；上下都不足→取大的一侧并压 `maxHeight`；浮层比视口宽→`maxHeight` 不失控、宽度取 `min(anchorW, viewport)`。
2. 组件侧：`createPortal` 到**插件挂载点内的兄弟层**（不是 `document.body`，避免宿主 z-index 栈与主题变量失效），渲染时把测量到的 `anchorRect.width` 以 inline `width` 注入，替代失效的 `container` 查询。
3. `.iv-node-bubble` 同理，但它是"可溢出画布"的小气泡：优先保留 absolute + flip（改 `left/right` 吸附），不 portal——portal 会让 xyflow 的平移缩放不再带着它移动，反而更糟。

### 5.6 IconTip：用 `data-tip` + `::after`，不要包一层组件

事实：`aria-label` 已覆盖 101 处，可访问性不缺 label；缺的是**鼠标用户的可见提示**。而且 `title=` 的 69 处体验差（1s 延迟、样式不可控）。

- 用 `data-tip="…"` + 一条 CSS（`.iv [data-tip]:hover::after` / `:focus-visible::after`，复用 `.iv-rail-tip` 的视觉）——**零 DOM 增量、零 flex 布局影响**。
- 包 `<IconTip>` 组件会引入额外 `span`，在 `.iv-toolbar` / `.iv-pane-actions` 这类 `flex-wrap` 容器里可能改变换行点——这是 v1 方案的实际风险。
- 纯 CSS 无法做视口翻转；贴边元素（右栏最右侧按钮）改用 §5.5 的测量版，或让 `::after` 强制右对齐（`right:0`）。
- 时间轴手柄 `.iv-clip-h` 的提示与 §5.4 的 `aria-valuetext` 共用同一文案源，避免两处不一致。

### 5.7 轻量 Toast（不必等到二期）

v1 把 Toast 完全推到二期，理由是"需要宿主级 overlay 容器"。但 `.iv-status`（页脚状态栏）在插件内、且**不随 panel 关闭而消失**，已具备"临时消息宿"的语义。

- R6-3 先做**状态栏消息队列**：`useAppNotice()` → 3 类（ok/warn/err）+ 4s 自动消失 + 去重 + `aria-live` 投递；最多同时 2 条，多的排队。
- 二期再做宿主级 Toast（跨插件、跟随宿主主题/位置），届时把 `useAppNotice` 的 sink 换成宿主 API 即可，调用方不改。

### 5.8 落地结果（R6-3a，2026-10-27 实测）

**已做**：

| 项           | 产物                                                                                                                                               | 验证                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 时间轴手柄键盘化    | `timeline-math.ts` 增 `nudgeDeltaForKey` + `formatTimecode`；`Workbench` 手柄补 `tabIndex` / `aria-valuenow/min/max` / `aria-valuetext` / `onKeyDown` | `timeline-nudge` 9 条（纯函数边界）+ `client-timeline-keyboard` 5 条（真实按键） |
| 弹层 focus 管理 | 新增 `use-dialog-focus.ts`（打开移入 / Tab 循环 / Esc / 归还）；接到默认值弹层与帮助浮层；两处补 `aria-modal` + `tabIndex=-1`                                                 | `client-a11y` 新增 1 条（移入 + 回环 + Esc + 归还）                          |
| 常驻播报区       | `Workbench` 内联 `[data-live-region]`（`role=status` / `aria-live` 随 tone / `aria-atomic`）；可见提示条**去掉 `role`**                                       | `client-a11y` 断言常驻 + 语义 + 提示条无 role                               |
| 浮层定位        | 新增 `overlay-position.ts`：`placeOverlay` 纯函数（翻转 / 压缩 / 夹紧 / 宽度收敛）                                                                                 | `overlay-position` 6 条                                            |

**三个发现（前两个是文档先前写错的）**：

1. **`.iv-help-mask` 原本没有 Esc 处理**。§2.4 表格里标着"outside click + ESC ✅"——实测 `grep Escape` 零命中，只有遮罩点击。现在由 `useDialogFocus` 补上（ESC 在 document 捕获阶段处理，宿主冒泡拦截也不影响）。
2. **jsdom 下内联 `clip: rect(0 0 0 0)` 会让测试进程直接被内存杀掉**（无任何输出、exit 1，连 vitest banner 都不打）。排查过程：同一元素去掉该属性即恢复。改用 `clipPath: inset(50%)` 或直接省略。**这是一条会让人误判成"代码有死循环"的假象**，值得记住。
3. **把播报区抽成独立函数组件后，同一位置渲染会让进程崩溃**（内联等价实现正常，原因未定位，试过换文件名/属性/样式、用探针打日志都拿不到输出）。因为只此一处使用，最终采用内联并删掉了独立组件与其单测——《不为抽象而抽象》，但这是环境问题的妥协，不是设计选择，已在代码注释里写明。

**一处改判**：原计划"方向键 1 帧 / Shift 10 帧"改为**方向键 100ms / Shift 1s**。理由：时间轴内部只以毫秒为单位，**没有帧率基准**（导出 fps 是导出设置，不是编辑粒度）；凭空假设 25fps 会让"1 帧"变成一个说不出依据的数字。等时间轴真引入帧率再切。

**R6-3b 落地（同日）**：

| 项                 | 结果                                                                                                                                                                                    |                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `PanelState` 六态组件 | 新增 `panels/PanelState.tsx`：`loading`（骨架，行数夹在 1–6）/ `empty`（图标 + 标题 + 提示 + 主动作）/ `error`（`role=alert` + 重试 + 可选原始错误）/ `refreshing`（保留旧数据时的细进度条）。**不接管 stale**：调用方把 error 放顶部、下面继续渲染旧数据 | `client-panel-state` 6 条 |
| 3 个面板迁移           | `ModelCards` / `RatioSlices` / `ResourceFolders` 全部改用 `PanelState`；出错时**保留旧数据**（此前会把内容整块顶掉）；顺带修掉"返回空数组时渲染空白网格"（`cards.length === 0` 也算空态）                                             | 三个面板既有用例全绿（3+3+3）        |
| 内联 gap 清理         | 22 处 `style={{gap:'Npx'}}` → `var(--iv-sp-*)`（PipelineCard 7 / VoiceCard 3 / Workbench 12），令牌化不再只在样式表内成立                                                                              | typecheck + 卡片类用例绿       |
| 文案键               | **零新增**：全部复用 `paneErrorRetry` / `modelCardsEmpty` / `resourceFolderNone` 等，入口体积不变                                                                                                     | —                        |
| `data-tip`        | **本批不做**。69 处 `title=` 批量换成 `data-tip` 要逐个确认"贴右边界的按钮提示不会跑出视口"，而纯 CSS 无法翻转；草率替换会把右侧按钮的提示顶到屏幕外，比 `title` 更糟                                                                             | —                        |
| 状态栏消息队列           | **本批不做**。单条 `notice` 已覆盖现有全部操作；同屏两条提示会挤占状态栏，等真出现"连续操作需要多条反馈"的需求再加                                                                                                                     | —                        |

> **验收限制（必须知道）**：本批改动在**独立组件/面板级**测试里全部通过，但**渲染完整 Workbench 的测试在当前沙箱会 OOM**（无输出、exit 1，连 vitest banner 都不打）。
>
> 已做排除实验（做完都恢复了现场）：回退 12 处内联 `gap: var(--iv-sp-*)` → 仍崩；移除新增的 `.iv-skel` / `.iv-alert` / `.iv-refreshing` CSS 块 → 仍崩；把 `PanelState` 改成 `return null` → 仍崩。所以**不是某一处写错**，而是当前体积的工作台渲染整体超出了这个环境的内存上限（chunk 902 KB → 982 KB，而 quick 模式本身就渲染 6 个 pane、几十个区块）。
>
> 因此：**合入前先在真机跑 `pnpm run test:ui:changed`（32 条，几秒出结果），再跑 `pnpm run test:ui`（46 条全量）**，并走查三个面板的加载/空/错误态。不要把"独立用例绿"当成"工作台没坏"。

---

## 6. R6-4 真机验收与固化

> **状态：🟡 可执行件已就绪，等待真机执行**（2026-10-28）。  
> 已交付：`scripts/check-contrast.mjs`（对比度）、`scripts/diff-ui-baseline.mjs`（像素 diff，复用已有 `sharp`，**零新增依赖**）、`scripts/capture-ui-baseline.mjs` 支持 `DSH_BASELINE_OUT` 分目录采集、`.gitignore` 忽略 `current/` 与 `diff/`。  
> **逐步命令与判读规则见 [`docs/R6-4-验收清单.md`](./R6-4-验收清单.md)**；本文件只保留设计理由。

### 6.1 浏览器矩阵（jsdom 测不出来，必须真机）

| 维度 | 档位                                                      |
| -- | ------------------------------------------------------- |
| 视口 | 380（宿主最窄右栏）/ 420 / 768（断点）/ 1024 / 1440                 |
| 主题 | 浅色 / 深色                                                 |
| 缩放 | 100% / 200%（浏览器 zoom 与"仅放大字体"各一次）                       |
| 场景 | quick 空态、advanced 画布、timeline 编辑、默认值弹层展开、help 浮层、错误态、窄窗 |

每档只记录"通过/异常 + 截图"，异常写清是溢出、裁切、重叠还是换行。200% 缩放是本轮最容易崩的一档（固定 px 高度控件 + 字号放大）。

### 6.2 对比度自动检查（替代"核一遍"）

`scripts/check-contrast.mjs`：Playwright 取 `getComputedStyle`，直接读**浏览器已求值**的前景色与"第一个不透明祖先底色"，按 WCAG 2.1 公式算对比度。

- **判定口径（勘误）**：v1 写的"<14px 用 4.5:1、≥14px 且 600+ 用 3:1"是把 **pt 当成了 px**。WCAG 的 large-scale 门槛是 **18pt ≈ 24px**，或 **14pt ≈ 18.66px 且 bold**。脚本按后者实现——照 v1 那套会把 14px 正文误判成"可以 3:1"，等于放宽了标准。
- **不需要 canvas**：`getComputedStyle` 返回的已经是 `color-mix()` 的求值结果（`rgb()` 或 `color(srgb …)`），脚本两种格式都解析。
- 输出：双主题各自的失败清单（比值 < 阈值、字号、选择器、文本片段）+ 单独列出"底色为近似值（半透明叠层）"的节点，这些必须人工确认。
- 阈值写进脚本，**不进 `gate.sh` 必过步骤**（无显示环境跑不了），但作为 R6-4 的必跑项记录在案。

### 6.3 基线入库与 diff

- 基线采到 `docs/ui-baseline/*.png`（入库）；改样式后新图采到 `docs/ui-baseline/current/`（不入库），再 `node scripts/diff-ui-baseline.mjs` 比对。
- **分目录是必须的**：采集脚本原本硬编码输出到基线目录，一采集就把基线覆盖掉，diff 永远 0%。已加 `DSH_BASELINE_OUT`。
- 用 `sharp` 而不是 `pixelmatch`：只需要"差异像素占比 + 标红图"，不需要它的抗锯齿启发式；而 `sharp` 已是运行时依赖，不新增包。
- 阈值：单通道差 > 20 算像素变化，占比 > 0.1% 判不一致；超阈必须附"为什么可以变"写进 PR 描述。
- 只在同 OS/同浏览器内比；跨环境只做人工看，不做像素判定。

### 6.4 每次交付的回归清单

```bash
pnpm exec vitest --version               # 工具链自检（别只看 node_modules/.bin，可能是空的）
pnpm run typecheck
pnpm exec tsdown                         # 产物契约测试读 lib/；受限环境里 clean 会被拦，跳过它
pnpm run check:bundle                    # 入口 99% 已贴线，涨了先查是不是进了入口
pnpm run test:ui                         # 46 个 UI 用例（沙箱 OOM，必须真机/CI）
bash scripts/gate.sh                     # 5 步全量（typecheck/build/tests/bundle/coverage）
node scripts/verify-workbench-tab.mjs    # 宿主是否在服务客户端半边
# 真机专项（无显示环境跑不了）
DSH_WEB_URL=http://localhost:5173 node scripts/check-contrast.mjs
node scripts/diff-ui-baseline.mjs
```

加两条本轮专属：

- 样式表改动后核对 `WORKBENCH_STYLE_VERSION`（`workbench-style.ts:29`）是否 bump。它是排障锚点：用户报"样式旧了"时，先比 `style.dataset.version` 与产物版本。
- 改 CSS / 加导出后跑 `pnpm run check:bundle`。口径（`scripts/bundle-budget.mjs`）：入口基线 54,600 B / 总产物 905,920 B，+20% 预算 65,520 / 1,087,104。  
  **实测告警（2026-10-27，R6-0 加 `ICON_NAMES` 后）**：入口 **64,943 B 占预算 99%**（余量仅 577 B），总产物 961,822 B 占 88%。  
  也就是说 —— **入口已经贴线**，任何往 `plugin.ts`（入口）里新增的代码都会立刻破线；R6-3 的 `PanelState` / `overlay-position` / `LiveRegion` 必须落在 `Workbench` chunk 里，不许被入口 import。  
  注：本次为跳过 `clean` 的构建（沙箱限制），真机 `pnpm run build` 后应复测一次；若仍 99%，说明余量本就只剩这 577 B，R6-3 开工前先确认落点。

### 6.5 文档同步

- 本文件批次完成后回填"实测/结论"，不留在"方案阶段"；
- `HANDOFF-UI-DETAILS.md` 补一节"设计系统骨架"（`.iv-pane` / `.iv-sub` / `PanelState` 的用法约束），否则下一个人会再造一套；
- `COVERAGE-PLAN.md` 记录 D1 落地后的基线与分档表（日期 / 全局四项 / client 分档 / 本轮变更），后续每轮只追加不覆盖；

---

## 7. 批次与门禁

批次命名改用 `R6-x`，避免与任务号 `B-xx` 混淆（需要新任务号时从 B-19 继续）。

| 批次                              | 范围                                                                                                                                         | 交付物                                                                                                         | 验收                                                                                                 | 风险                 | 依赖        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **R6-0 测试地基**                   | 环境自检脚本说明、`asyncUtilTimeout`、`data-iv-ready`、`--maxWorkers=2`、`--retry=0` 脚本、契约测试扩写、**覆盖率纳入（D1：测基线 → 改 exclude → 下调全局阈值 → client 分档）**、基线首采 | `tests/setup-dom.ts` + `vitest.config.ts` + 4 个测试文件 + `docs/COVERAGE-PLAN.md` 记录 + `docs/ui-baseline/*.png` | 连续 3 轮 UI 子集全绿且 retry=0；`gate.sh` 第 5 步绿；基线 10 张入库                                                 | 中（覆盖率阈值需一次调准）      | 无         |
| **R6-1 令牌补全** ✅ **已完成**         | 间距/字号/字重/圆角/层级/动效/阴影/`scrollbar-gutter` + 裸值禁令                                                                                             | `workbench-style.ts`（59 个令牌）、`client-design-system` 7 条令牌契约                                                 | typecheck + 契约（13 passed）+ build + bundle 89% ✅；真机 PNG 对照待做                                        | 低（无结构变化，单处位移 ≤1px） | R6-0      |
| **R6-2 排版与层级** ✅ **已完成**        | `.iv-sub` 骨架、区块位置修正、删 `.iv-pane-body`（D2）、`iv-card` 补样式、密度/数字对齐                                                                            | 3 个 panel 容器 + `Workbench.tsx` 两处移动 + 3 处 fragment + 8 条容器规则合并                                              | 契约 **15 passed / 0 todo** ✅；相关既有测试全绿 ✅；真机矩阵/PNG 对照待做                                               | 中（动 JSX 顺序）        | R6-1      |
| **R6-3a 交互与 a11y** ✅ **已完成**    | 手柄键盘化、focus trap/归还、常驻播报区、`placeOverlay` 纯函数                                                                                               | `timeline-math.ts` / `use-dialog-focus.ts` / `overlay-position.ts` + 3 个测试文件                                | 19 条断言全绿：`timeline-nudge`(9)、`client-timeline-keyboard`(5)、`client-a11y`(+1)、`overlay-position`(6) | 中（动键盘交互）           | R6-0、R6-2 |
| **R6-3b 状态机** ✅ **已完成（待真机验收）**  | `PanelState` 四形态 + 3 面板迁移、内联 gap 清理；`data-tip` 与消息队列明确不做（理由见 §5.8）                                                                         | `panels/PanelState.tsx` + 3 个面板重写 + 22 处内联 gap                                                              | 组件 6 条 + 面板 9 条全绿；Workbench 级渲染在本沙箱 OOM，**须真机 `test:ui` 复验**                                       | 中高（面板状态机）          | R6-3a     |
| **R6-4 验收固化** 🟡 **可执行件就绪，待真机** | 对比度脚本、像素 diff 脚本、采集分目录、验收清单、文档勘误                                                                                                           | `scripts/check-contrast.mjs`、`scripts/diff-ui-baseline.mjs`、`docs/R6-4-验收清单.md`、`.gitignore`                | 脚本空分支/核心逻辑已实测（1 像素差异 → 1% → exit 1）；**PNG 与对比度须真机跑**                                               | 低                  | R6-3b     |

每批次独立 PR，合入后单独推 gitlink。**不要打包成一个大 PR**——R6-1 是样式面，R6-3 是逻辑面，混在一起出问题无法二分。

---

## 8. 风险与明确不做

| 风险                       | 影响                   | 处理                                                                    |
| ------------------------ | -------------------- | --------------------------------------------------------------------- |
| 间距归并让工具栏更紧/更松            | 局部观感变化               | 5px→4px 一次性决定；PNG 对照；不满意整档改，不逐处调                                      |
| `data-iv-ready` 引入新的等待依赖 | 若某请求永不 settle，用例反而更慢 | 加超时（`waitFor` 自带 2s），并在 ready 判定里把失败也算 settle                         |
| 时间轴键盘化改动交互模型             | 可能影响现有拖拽用例           | 手柄加 `tabIndex` + 键盘通道，拖拽逻辑一行不动；先跑 `client-timeline-interaction`       |
| portal 与宿主层叠/主题冲突        | 弹层被压住或颜色失真           | portal 到插件挂载点兄弟层；真机验证；必要时取宿主 z-index 令牌                               |
| 纳入覆盖率后 `gate.sh` 首次必红    | 阻塞交付                 | 已在 §2.4 定死顺序：先测基线 → 再关闸 → 全局阈值同步下调 → client 分档；首轮 45–65% 属正常，不为凑阈值补测试 |
| 基线 PNG 膨胀仓库              | 仓库体积                 | 单图 <200KB；超了转 webp 或 LFS                                              |
| 真机验收依赖带显示环境              | 可能排不上                | R6-0 就把首采跑掉；后续 diff 不阻塞开发，只阻塞发布                                       |

**明确不做的事**：

- 不推倒 v3 样式系统（token 体系、双主题、NLE 视觉已成熟）；
- 不重写 Workbench 主结构（rail + 顶栏 + 主区 + 状态栏 + dock 已定稿）；
- 不引入 Tailwind / UnoCSS / CSS-in-JS 第二套样式语言；
- 不做宿主级 Toast（R6-3 只做插件内状态栏消息，二期换 sink）；
- 不改业务逻辑与 API 契约（`docs/API-SURFACE.md` 的 B 申请区不动）；
- 不造独立品牌 / logo / favicon（`BrandMark` 只用 `currentColor` 或 `--iv-acc` 单色，≥14px，等比缩放，四周留白 ≥ 1/4 边长；命名与 tagline 改动走 owner）；
- 不新增图标风格（新图标单 path 进 `STROKE`、多元素进 `SHAPES`，禁止外贴异 stroke/异网格/填充图标集；装饰图标保持 `aria-hidden`）。

---

## 9. 工作量（按可验证里程碑重估）

| 批次             | 内容                                              | 估时                  | 上浮点                     |
| -------------- | ----------------------------------------------- | ------------------- | ----------------------- |
| R6-0           | 环境 + flaky + 契约测试 + 覆盖率纳入（D1）+ 基线首采             | 5h                  | 阈值一次调不准要试 2–3 轮（+2h）    |
| R6-1           | 8 组令牌 + 离群归并 + 禁令断言 + PNG 对照                    | 5h（✅ 已完成，实际 ~2h）    | 间距归并后视觉复核反复（+2h）        |
| R6-2           | `.iv-sub` + 位置修正 + 删 `.iv-pane-body`（D2）+ 对齐/密度 | 5h（✅ 已完成，实际 ~2.5h）  | 双语压力改判为真机项（§4.4），不再占用本批 |
| R6-3a 交互与 a11y | 手柄键盘化 + focus 管理 + 播报区 + overlay 纯函数            | 3h（✅ 已完成，实际 ~2.5h）  | jsdom 环境怪象排查耗时（见 §5.8）  |
| R6-3b 状态机      | PanelState 四形态 + 3 面板迁移 + 内联 gap                | 3h（✅ 已完成，实际 ~1.5h）  | 本沙箱无法跑 Workbench 级渲染    |
| R6-4           | 对比度脚本 + 基线 diff + 文档回填                          | 3h                  | 对比度不达标要回改配色（+2h）        |
| **合计**         |                                                 | **26h（约 3.5 个工作日）** | 上浮到 **33–37h**          |

比 v1 的 18h 高，原因是把"完整/可验证"两层真正计进来了（六态迁移、键盘化、真机矩阵、基线采集）。建议**每批次结束重估一次**，不要一次性承诺总工期。

---

## 附录 A：冻结常量（不是间距，别 token 化）

| 常量       | 值    | 位置                                             | 为什么不能动                |
| -------- | ---- | ---------------------------------------------- | --------------------- |
| 轨道头宽     | 46px | `.iv-ruler{margin-left}` + `.iv-track` grid 首列 | 两处必须严格相等，否则刻度与轨道错位    |
| 左 rail 宽 | 42px | `.iv-body` grid 首列                             | 图标 28px + 两侧留白        |
| 控件高      | 23px | `.iv-btn` / `.iv-input` / `.iv-select`         | 与工具栏行高、pane head 对齐   |
| tile     | 22px | `.iv-pane-tile` / `.iv-tile`                   | 与 14px 图标 + 4px 内边距耦合 |
| 状态栏高     | 23px | `.iv-status`                                   | 与控件高一致                |
| 片段轨高     | 58px | `.iv-clips`                                    | 时间轴纵向节奏基准             |

## 附录 B：勘误复核命令

```bash
# 间距 / 字号分布（期望：§0.2 那张表）
grep -o 'gap:[0-9]\+px' src/client/workbench-style.ts | sort | uniq -c | sort -rn
grep -o 'font-size:[0-9.]\+px' src/client/workbench-style.ts | sort | uniq -c | sort -rn

# 图标：期望 40 / 38 / 2
sed -n '/export type IconName/,/^$/p' src/client/icons.tsx | grep -o "'[a-z]*'" | wc -l
sed -n '/^const STROKE/,/^}/p' src/client/icons.tsx | grep -c '^  [a-z]*:'
sed -n '/^const SHAPES/,/^}/p' src/client/icons.tsx | grep -c '^  [a-z]*:'

# 结构：9 个 pane、9 个 pane-head、3 处 pane-body
grep -n 'data-workbench-pane="' src/client/Workbench.tsx
grep -c 'iv-pane-head' src/client/Workbench.tsx
grep -rc 'iv-pane-body' src/client/Workbench.tsx src/client/panels/*.tsx

# a11y：aria-live/busy/modal 期望 0
grep -rn 'aria-live\|aria-busy\|aria-modal' src/client/ | wc -l
grep -rn 'iv-meta--warn' src/client/ | wc -l     # 10 = 9 处用法 + 1 处 CSS 定义

# 测试与基线
ls tests | grep '^client-.*\.test\.' | wc -l   # 44（39 tsx + 5 ts）；UI 侧还要 +2 个 *.client.test.tsx
ls tests/*.client.test.tsx                      # workbench / workflow-canvas
grep -n 'exclude' -A3 vitest.config.ts          # src/client/** 被排除
ls docs/ui-baseline                             # 仅 README
grep -n 'maxWorkers' scripts/gate.sh            # 已有 --maxWorkers=2
```

## Dev Note（非权威）

- vitest `pool` 默认是 `forks`，改它没用；要降并行就动 `maxWorkers` / `fileParallelism`。
- 间距归并若 diff 超 300 行，拆两 PR：先定义令牌 + 改 10 条核心规则验证视觉，再全量替换语义容器类。
- `configure({asyncUtilTimeout})` 必须写在 `setup-dom.ts` 的 `window` 判断块内，否则 node 环境的 host 测试会因缺 DOM 而报错。
- 时间轴手柄键盘化时，`aria-valuenow` 用毫秒、`aria-valuetext` 用时间码——读屏念时间码比念毫秒有用。
- Round 5 遗留：`renderRatioSlices` 在 fake host 返回 `queued` 后 UI 是否刷新没有用例钉住，R6-2 迁 RatioSlicesPanel 时顺手补一条。

