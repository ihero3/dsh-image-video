# 视觉生成工作流编辑器参考调研

> 目的：给本仓库「工作流画布」找可对标的实现（ComfyUI / LiblibAI / InvokeAI / LiteGraph / React Flow），
> 把它们的**数据模型、交互口径、上手路径**翻译成本页面能落地的改动。
>
> 调研时间：2026-11-26。只记录能在官方文档/仓库里核到的点；每条结论后面给出来源。

## 结论摘要（先看这五条）

1. **节点图的骨架是「节点 + 链接 + 分组」的纯数据**，执行器与画布分离；ComfyUI 的 workflow JSON 用 `version / nodes / links / groups` 表达，且版本号跟随 schema 演进（[Workflow JSON 规格](https://docs.comfy.org/specs/workflow_json)）。本项目的 `WorkflowRecord`（`nodes/edges/schemaVersion`）同构，方向是对的。
2. **节点库是被反复打磨的重点**：ComfyUI 前端最新一轮把节点搜索做成侧栏式（列表重排为 All / Essentials / Blueprints 等分组），说明"在左侧可检索地找节点"比"顶上一排平铺按钮"更接近真实使用（[ComfyUI_frontend PR #8987](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8987)）。
3. **上手靠模板而不是靠空白**：LiblibAI 的工作流页把整套图包装成「一键运行」的模板（[示例工作流页](https://www.liblib.art/modelinfo/52064f3cf04a498f8757efb69b49edc4)），ComfyUI 也把 workflow templates 作为独立入口（[ComfyUI 基础概念：工作流](https://docs.comfy.org/basic-concepts/workflow)）。空画布必须给起步卡。
4. **拖线当刻就拒绝非法连接**：React Flow 官方给出防环示例 `isValidConnection`（[Preventing Cycles](https://reactflow.dev/examples/interaction/prevent-cycles)），端口类型不兼容也应在这一层拦掉，而不是等运行后从日志里找原因。
5. **日志/校验不该常驻画布**：ComfyUI 把队列与执行信息放进侧栏，画布拿满空间；本页面把校验与运行明细收进可折叠抽屉、状态收进一行状态条，属于同一取舍。

---

## 1. ComfyUI / ComfyUI_frontend

### 数据模型

- 工作流文件是纯 JSON，schema 带版本号（v1.0 / 旧版 v0.4），核心字段是 `nodes`、`links`、`groups`（[规格](https://docs.comfy.org/specs/workflow_json)、[Workflow JSON 0.4](https://docs.comfy.org/specs/workflow_json_0.4)）。
- 节点由「类型定义 + 实例」组成：节点定义（输入/输出/控件）来自后端注册表，前端按 class_type 找定义渲染（[ComfyUI Frontend Objects: LiteGraph / ComfyApp / ComfyNode](https://github.com/comfy-org/docs/blob/14b13d5ec7bd9cdac8b64628891534a0374b1676/custom-nodes/js/javascript_objects_and_hijacking.mdx)）。
- 前端正在把 LiteGraph 的能力原生化，例如把 reroute 变成图里的原生节点（[Comfy-Org RFC 0002](https://github.com/Comfy-Org/rfcs/blob/main/rfcs/0002-litegraph_native_reroute.md)）。

**对应本项目**：`src/workbench/workflow.ts` 的 `NodeKindSpec`（种类 → 端口/参数）+ `WorkflowRecord`（图）+ `validateWorkflow`（图校验）已经是同一分层；本轮给 `NodeKindSpec` 加了 `group`（只是展示维度，不影响执行），让节点库能分组。

### 值得抄的交互

| 模式 | ComfyUI 的做法 | 本项目的落点 |
| --- | --- | --- |
| 节点库 | 侧栏 + 搜索 + 分类，拖到画布 | `WorkflowCanvas` 左侧 `.iv-wf-lib`（分组 + 搜索 + 拖拽），窄容器自动收成图标条 |
| 加节点 | 点库里的项、或双击空白处搜节点 | 点库项 / 双击空白弹出快速添加（`quickAdd`） |
| 端口 | 类型化端口，拖不上就是接不上 | `portsCompatible()` + React Flow `isValidConnection`，`onConnect` 二次兜底 |
| 运行 | 一个 Queue / Run 主按钮，队列与历史在侧栏 | 顶栏唯一主按钮（运行流程/运行中 N/M），历史在日志抽屉 |
| 节点状态 | running / 成功 / 失败 / **cached** 直接画在节点上 | 卡片状态点 + 错误气泡 + `data-workflow-node-cached` 缓存标签 |
| 产出 | 节点内嵌图片预览 | 卡片底部缩略图，点开送到右侧预览 |
| 排布 | 用户可以手动摆；导入的图按原坐标还原 | 「自动排列」按深度分列重排（`autoLayout`），导入/套模板后自动适配窗口 |

### 不要照搬

- **不要把所有参数塞进节点卡片**：ComfyUI 节点上的控件多到需要折叠，新用户容易迷路。本页面把参数放进浮层检视器（选中才出现），卡片只留 1–2 个摘要。
- **不要把执行细节（队列、prompt、节点 id）暴露在画布上**：普通用户只需要"能不能跑 / 跑到哪一步"。
- **不要追求 LiteGraph 的全能力**（子图、动态端口、原生 reroute）：我们的节点集是固定的 15 个，语义清晰，先把上手与运行体验做顺。

## 2. LiteGraph（ComfyUI 的图引擎）

- LiteGraph 是独立的节点图库，ComfyUI 在其上扩展；节点、链接、分组、子图都是图内对象（[ComfyUI_frontend 仓库](https://github.com/Comfy-Org/ComfyUI_frontend)）。
- 它的"重"在于：节点自带渲染与控件、序列化格式与后端 prompt 格式不同（工作流 JSON vs API prompt）。

**结论**：我们用 React Flow 而不是 LiteGraph 是合理的——参数走 React 组件、样式跟随 Harness 主题；本轮把 LiteGraph 的**交互习惯**（库、拖拽、双击加节点、cached）搬过来即可，不必搬引擎。

## 3. LiblibAI（哩布哩布）

- 工作流以「模板/应用」形态发布：打开即是一张排好的图，页面上给「一键运行」，用户改提示词就能出图（[示例工作流](https://www.liblib.art/modelinfo/52064f3cf04a498f8757efb69b49edc4)）。
- 对非技术用户，它把「节点图」藏在表单化入口后面：先是"要生成什么"，再展开参数。

**对应本项目**：空画布起步卡（`CanvasOnboarding`）用四张模板卡替代空白，点一张即得一条可跑的链路，并自动适配窗口；模板自带示例文案（`WORKFLOW_TEMPLATES` 的 `params`），改几个字就能跑。

### LiblibTV 画布截图拆解（2026-11-26 补充）

对着 liblib.tv 的 canvas 截图逐块看，哪些值得抄、哪些按我们的方式做：

| 界面元素 | liblib 的做法 | 我们的取舍 |
| --- | --- | --- |
| 模型选择 | 底部工具条一个 **模型 pill**（`Seedream 5.5`、`2.6 Flash`）+ 下拉，默认模型直接可见 | **抄**：检视器的「模型」从空白文本框改成选择器，并显示宿主解析出的默认模型名（`data-model-picker-default`） |
| 生成参数 | `16:9 · 2K · 1张` 一排胶囊，点开才出候选 | **部分抄**：比例/时长/分辨率已在下拉里；暂不做胶囊，避免小面板里过密 |
| 风格预设 | `风格 / 配色 / 构图 / 节奏 / 相机` 五个分组 + 缩略图预设 | **后续**：属于"预设提示词"能力，等提示词库接进来再做，不在画布层硬塞 |
| 节点内嵌产出 | 图片节点直接铺满画面，带「AI生成」角标与重生成/保存按钮 | **抄一半**：卡片已内嵌缩略图并可送到右侧预览；悬浮操作（重生成）留到节点级运行完善后 |
| 节点标题 | 画布外一行 `图片节点 10` / `视频节点 12` | **不抄**：编号对用户没有意义，我们用"种类名 + 状态 + 产出" |
| 连线 | 选中的链路发蓝光 | **后续**：可以做"选中节点高亮上下游"，属于可读性增强 |
| 深色画布 | 整块近黑画布 | **不抄**：跟随 Harness 主题（浅色主题下黑画布会显得突兀），这是本项目的设计系统约定 |
| 底部 composer | 画布自带一整套生成输入条 | **不抄**：生成入口在右侧预览栏与「快速创作」，画布只做编排，避免两套输入互相打架 |

## 4. InvokeAI

- 同样提供节点式 workflow editor，并有完整的编辑器界面文档（[Workflows 入门](https://invoke-ai.github.io/InvokeAI-7/users-guide/workflows/introduction/)、[编辑器界面](https://github.com/CypherNaught-0x/InvokeAI/blob/d56905e2a69621e6779c88ea46c3ee90191539dd/docs/src/content/docs/workflows/editor-interface.mdx)）。
- 它的画布把「节点库 / 画布 / 检视器」做成三栏，属性面板独立于节点。

**对应本项目**：检视器从"画布下方的一段表单"改成"浮在画布右上、选中才出现"，画布高度不再因选中而抖动。

## 5. React Flow（本项目底座）

本轮直接用到/需要知道的 API：

- `isValidConnection`：拖线时逐条判定，官方用它在连线上防环（[Preventing Cycles](https://reactflow.dev/examples/interaction/prevent-cycles)）。
- `MiniMap`：节点多时给全局缩略图（[MiniMap 文档](https://reactflow.dev/api-reference/components/minimap)）。
- `fitView` / `screenToFlowPosition`：适配窗口、把屏幕坐标换算成画布坐标（拖拽落点、双击加节点的位置）。
- `Handle` 的 id 必须与 `Edge.sourceHandle/targetHandle` 严格一致；v12 里 `undefined !== null`，不匹配的边会被**静默丢弃**——本项目历史上"有节点没连线"就是这个坑（见 `src/workbench/workflow.ts` 的注释）。本轮把模板/粘贴/连线三条路径统一过 `withHandles()`。

---

## 6. 可落地模式清单（按 收益 × 成本 排序）

| # | 模式 | 机制 | 参考 | 本轮 |
| --- | --- | --- | --- | --- |
| 1 | 空画布给模板起步 | 空图时在画布中央给 4 张模板卡 + 空白 + 导入 | LiblibAI 一键运行、ComfyUI templates | ✅ |
| 2 | 节点库分组 + 搜索 + 拖拽 | 左侧栏，按 input/story/generate/finish/planned 分组；输入即过滤；拖到落点 | ComfyUI 节点库/搜索 PR | ✅ |
| 3 | 双击空白快速加节点 | 光标处弹输入框，回车落节点 | ComfyUI 双击加节点 | ✅ |
| 4 | 端口类型在拖线时校验 | `portsCompatible` + `isValidConnection` | React Flow prevent-cycles | ✅ |
| 5 | 模板/导入后自动排版 + 适配 | 最长路径分列（`autoLayout`），再 `fitView` | ComfyUI 模板开箱即用 | ✅ |
| 6 | 运行成为唯一主按钮 | 顶栏右侧主按钮，运行中显示 N/M 与细进度条，失败时给重试 | ComfyUI Queue | ✅ |
| 7 | cached / 失败 / 产出画在卡片上 | 状态点、缓存标签、错误气泡、缩略图 | ComfyUI 节点状态 | ✅ |
| 8 | 检视器浮层化 | 选中才出现，不占画布高度；右上角可关闭 | InvokeAI 三栏编辑器 | ✅ |
| 9 | 选中态动作条 | 复制/粘贴/删除/只跑此节点浮在画布顶 | Figma / 通用编辑器习惯 | ✅ |
| 10 | 状态条替代散落说明 | 节点数/连线数、校验、运行、暂存提示一行 | 专业工具状态栏 | ✅ |
| 11 | 全选 / 快捷键 | ⌘A 全选、`/` 聚焦节点库、⌘Z/⇧⌘Z、⌘C/⌘V、Delete | 通用编辑器 | ✅ |
| 12 | 小地图 | 节点 ≥ 6 时出现在右下 | React Flow MiniMap | ✅ |
| 13 | 分组（Group/Frame）与注释 | 把一段链路框起来命名 | ComfyUI groups | ⏳ 后续 |
| 14 | 子图 / 复用片段 | 把常用链路折叠成一个节点 | ComfyUI 子图 | ⏳ 后续（先做模板即可覆盖 80% 场景） |
| 15 | 表单化「应用视图」 | 一张图导出成一个只有几个输入框的页面 | LiblibAI 应用化 | ⏳ 后续（配合「快速创作」页） |

## 7. 反模式（ComfyUI 新用户最容易卡住的地方，别重复）

1. **首屏空白**：打开就是一张空图 + 一堆缩写节点名，用户不知道从哪开始。
2. **平铺的节点按钮**：十几个 chip 铺满两行，既难扫也难搜，还挤占画布。
3. **参数全在节点上**：节点越做越宽，图一复杂就没法读。
4. **错误只在日志里**：连线接错、必填为空，运行后才在控制台/日志里报。
5. **运行按钮藏在工具栏中段**：主操作不突出，用户会先去找"哪里能跑"。
6. **选中后画布抖动**：属性面板出现/消失导致画布高度跳变，正在拖的节点会跑位。
7. **把内部 id 暴露给用户**：节点卡片、错误文案里出现 `video-generate-mwx0...` 这种 id，用户无法理解。

## 8. 本轮实际落地对照

| 文件 | 改了什么 |
| --- | --- |
| `src/client/WorkflowCanvas.tsx` | 顶栏重排（模板/撤销/自动排列/适配/导入导出 + 唯一主运行按钮）；左侧分组节点库（搜索/拖拽/收起）；空画布起步卡；双击快速添加；浮层检视器；选中态动作条；状态条；卡片状态/缓存/缩略图；节点分组配色；⌘A 全选；`withHandles` 统一端口 id；小地图 |
| `src/client/workflow-layout.ts` | 新增：`autoLayout`（最长路径分列、环安全）、`filterItems`（分词检索） |
| `src/workbench/workflow.ts` | `NodeGroup` + 目录分组；`portsCompatible` 单一口径（校验器复用） |
| `src/client/workbench-style.ts` | 画布区样式重构（库/顶栏/状态条/起步卡/检视器/快速添加/端口配色/边与节点层级），修掉两处从未生效的属性选择器；版本戳递增 |
| `src/client/locales.ts` | 新增 24 个中英文案键 |
| `tests/workflow-layout.test.ts` | 新增 9 例（排布/检索） |
| `tests/workflow-canvas.client.test.tsx` | 新增 5 例（起步卡/检索/拖放/缓存/产出预览） |
| `tests/workflow-catalog.test.ts` | 新增 2 例（端口兼容、分组齐全） |
| `src/media/builtin-models.ts` | 新增：服务商 → 内置默认模型（与适配器同源，仅宿主使用）；`resolveEffectiveModel` 合并「配置显式值 → 内置默认」 |
| `src/host/rpc.ts` + `src/index.ts` | `models/catalog` 增加 `defaults`（生效默认模型），供界面对「模型」字段显示默认值 |
| `src/client/panels/ModelPicker.tsx` | 下拉里给默认模型打「默认」标记，并在下方写出默认模型名 |
| `src/client/WorkflowCanvas.tsx` | 「模型」字段接 `ModelPicker`（按节点类型过滤图片/视频模型）；未传 API 时退回文本框 |
| `tests/builtin-models.test.ts` | 新增 7 例（映射、旧 id、显式优先、缺失回落） |

## 9. 后续建议（不在本轮）

1. **分组/框选注释**（ComfyUI groups）：把"剧本→分镜"这类逻辑段框起来，双击折叠。
2. **节点级运行态更细**：现在只有 running/succeeded/failed/cached；补"排队中"与耗时。
3. **应用视图**：模板再加一层"只暴露 3 个输入框"的表单，给非专业用户。
4. **导入 ComfyUI 图的布局还原**：现在导入按原坐标；可以在缺少坐标时跑 `autoLayout` 兜底。
5. **性能**：节点数逼近 `MAX_WORKFLOW_NODES=200` 时，考虑 `onlyRenderVisibleElements` 与 `React.memo` 卡片。
