# 双轨分工计划（2026-10-21，owner 明确按 Track A / Track B 拆分）

> **目的**：把剩余工作拆成两条**文件不冲突**的执行线，并行推进。
> **Track A（你）**：`src/host` / `src/workbench` / `src/media` / `src/tools` / `scripts` / `lib` / A 的测试与文档 / **发版与子模块指针**。
> **Track B（同事）**：`src/client/**` + `tests/*client*` + UI 文档。**不碰** A 的地盘，**不提交 `lib/`、不改 `package.json`、不打 tag**。
> **契约先行规则**：凡是 B 要用的新端点/字段，**A 先落地 + 写进 `docs/API-SURFACE.md`**，B 再接线；A 没落地前 B 不要自己造端点。

## Wave 1（可立即并行，互不依赖）

### Track A（先做这 5 项，全是纯后端/域层）
| # | 任务 | 落地位置 | 验收 |
| --- | --- | --- | --- |
| **A-1** | **F4 模板补齐 4 个**：`quick-image` / `quick-video` / `storyboard` / `cover`（模板数据 + `instantiateTemplate` + 测试）| `src/workbench/{templates,drama}.ts` + `tests/` | 4 个模板都能实例化成合法 workflow（`validateWorkflow` 通过），每个至少 1 个生成节点 |
| **A-2** | **F5 后端**：`assets/remove-many`（`{ids[]}` → `{removed,skipped[]}`，单次 ≤200）| `src/host/rpc.ts` + `docs/API-SURFACE.md` | 端点测试（含"不存在 id 跳过不报错"）|
| **A-3** | **F6 后端**：资源支持 **多张参考图**（`assetPaths[]`，保留 `assetPath` 兼容）+ `resources/update` 支持设置/追加/清除 | `src/workbench/records.ts`（schema 兼容，不升版本）+ `store.ts` + `rpc.ts` | 测试：追加/替换/清除；旧数据（只有 `assetPath`）仍可读 |
| **A-4** | **G3 后端：融合生图** `media/compose`：`{projectId, prompt, roles[], scenes[], props[]}` → 解析每个资源的参考图 → 拼多参考图 + 提示词 → 调生成 → 自动登记素材 | `src/host/rpc.ts` + `src/workbench/*` | 测试：资源引用解析、缺参考图降级为纯文生、素材登记 |
| **A-5** | **G1 后端：提示词提取** `prompts/extract`：图片（本地路径/素材 id）→ 结构化提示词（风格/主体/材质/细节）+ 提示词库 CRUD（`prompts/list|save|remove`）| 新模块 + `rpc.ts` | 测试：提取结果结构校验、库增删改查、不可用模型时给清晰错误（**不伪造结果**）|

### Track B（可立即并行，全部基于**已存在**的端点）
| # | 任务 | 落地位置 | 验收 |
| --- | --- | --- | --- |
| **B-1** | **F2 多参考图选择器**：素材多选（≤6）→ `media/generate` 的 `images[]`；首图=底图，其余=风格/脸部参考；可拖拽排序 | `src/client/Workbench.tsx` | 生成请求体含按序 `images`；客户端测试 |
| **B-2** | **F3 生成进度**：调 `tasks/running` → 已用时（`startedAt`）+ 进度条；无百分比时显示"生成中 · 12s" | `src/client/**` | 客户端测试（假 api 前进时间断言文案变化）|
| **B-3** | **G4 首尾帧 / 视频编辑 UI 入口**：视频生成表单增加「尾帧图」与「参考视频」两个可选槽 → `media/generate` 的 `media: [{image,type:'last_frame'}, {video,type:'reference_video'}]` | `src/client/Workbench.tsx` | 请求体正确；含真人勾选项透传 |
| **B-4** | **G2 物料库分栏**：创作资源面板拆成 角色/场景/物品 三栏（`resources/list?kind=`），显示参考图缩略图，支持按名筛选 | `src/client/Workbench.tsx` | 三栏切换、筛选、缩略图；客户端测试 |
| **B-5** | **B17 片段手柄接线**：时间轴片段左右手柄调时长、分割/复制按钮接到 `split-clip`/`copy-clip` | `src/client/Workbench.tsx` | 拖动后 `durationMs` 变化、分割后片段数 +1 |

## Wave 2（B 依赖 A 的 Wave 1 契约）

| # | 任务 | 依赖 | 落地位置 |
| --- | --- | --- | --- |
| **B-6** | F4 模板市场卡片（4 个新模板的文案 key + 卡片 + 一键新建）| **A-1** | `src/client/locales.ts`、`Workbench.tsx` |
| **B-7** | F5 素材批量操作 UI（多选 → 批量删除「调 `assets/remove-many`」/ 批量引用到提示词）| **A-2** | `Workbench.tsx` |
| **B-8** | F6 资源资料库 UI（资源可挂多张参考图；「把选中素材归到该角色」；按资源查看关联素材）| **A-3** | `Workbench.tsx` |
| **B-9** | G3 融合生图 UI（选角色+场景+物品 → 预览拼装 → 调 `media/compose`）| **A-4** | `Workbench.tsx` |
| **B-10** | G1 提示词 UI（从素材/本地图提取 → 可编辑 → 存入提示词库 → 一键带入生成表单）| **A-5** | `Workbench.tsx` |

### Track A Wave 2
| # | 任务 | 说明 |
| --- | --- | --- |
| **A-6** | **B16 体积外置**：把 `@xyflow/react` + `d3-*` 外置并由宿主模块表提供；同步 `BUNDLE_BASELINE`；客户端束回落到 ≤80% | A 改构建 + 宿主模块表，B 只需重跑体积门禁 |
| **A-7** | **G5 后端：剧本 → 分镜**（`storyboard/plan`：剧本 → 结构化分镜表（镜头/角色/场景/台词/图片提示词/视频提示词））| 之后 B 做分镜表编辑 UI（Wave 3）|
| **A-8** | **G6 生产线编排**：把 A-1/A-7 串成"剧本→分镜→生图→视频→导出"可运行模板 | 依赖 A-7 |

## 协作纪律（两边都要守）
1. **谁改谁跑门禁**：A 跑 `bash scripts/gate.sh`（五道门）；B 至少跑 `pnpm exec vitest run tests/client-*.test.tsx` + `pnpm run typecheck`。
2. **端点/动作变更必须同步 `docs/API-SURFACE.md`**（A 的漂移测试会拦）。
3. **A 负责发版**（`release.mjs` → build → gate → tag → push → Harness 指针）；B **不要**提交 `lib/`、不要打 tag。
4. **冲突处理**：如果 B 必须动 A 的文件，先在该文件头写 `// TODO(A):` 一行说明，交给 A 改。
5. **每日一条状态**：各自在 `docs/TASKS-TRACK-A.md` / `docs/TASKS-TRACK-B.md` 勾选进度，A 发版时汇总。

---

# Round 2 分工（2026-10-22，v0.3.74 之后）

> 上一轮 B 已完成 B-1~B-8 ✓；A 已完成 A-1/A-2/A-3/A-4/A-5/A-9 与 F1 ✓。
> 本轮原则不变：**A 改 host/workbench/media/tools/lib/发布；B 只改 `src/client/**` + `tests/*client*`**；
> B 不碰 `lib/`、`package.json`、tag；需要新端点先在 `docs/API-SURFACE.md` 的「B 申请区」写一行，A 认领。

## Track B（**现在就能全部开工**，所需契约都已上线）

| # | 任务 | 依赖（已就绪）| 验收 |
| --- | --- | --- | --- |
| **B-9** | **融合生图 UI**：从创作资源里多选 角色/场景/物品 → 预览拼装（参考图数量 + 描述）→ 调 `media/compose` → 结果进素材 | `media/compose` ✓ | 请求体含 `resourceIds`；结果登记素材；客户端测试 |
| **B-10** | **提示词 UI**：提示词库列表/保存/删除；「从素材提取」按钮调 `prompts/extract`，**把报错当"需配置"提示**（不是失败态）→ 可编辑后一键带入生成表单 | `prompts/list|save|remove|extract` ✓ | CRUD 全通；extract 报错时展示引导文案；测试 |
| **B-11** | **素材库体检界面**：去重结果（`assets/duplicates`）/体积排行（`assets/size-report`）/项目统计（`assets/project-stats`） | 三个端点 ✓ | 三块数据渲染 + 空态；测试 |
| **B-12** | **生成结果卡片**：生成完成后在面板内显示缩略图 + 「重新生成」+「用作参考图」+「加入时间轴」 | `media/generate` ✓ `attachAsset` ✓ | 三个动作各一条测试 |
| **B-13** | **时间轴逐段预览**：用现有片段顺序播放（`<video>` 队列），显示当前片段序号/总时长（真正的合成预览留给 A 的 ffmpeg）| 现有时间轴数据 ✓ | 播放/暂停/跳段；测试 |
| **B-14** | **打磨**：空态引导、快捷键（生成 `⌘⏎`）、对比度/焦点环、错误文案统一 | — | 无 lint/类型错误 + 2 条测试 |

## Track A（后端 / 跨仓 / 发布）

| # | 任务 | 说明 | 阻塞谁 |
| --- | --- | --- | --- |
| **A-6** | **体积外置**（B16）：宿主模块表加 `@xyflow/react` + `d3-*`，插件 client face 外置，束回 ≤80% | 方案已落 `docs/A6-BUNDLE-EXTERNALIZE.md`，6 步 + 回滚点 | 发布质量 |
| **A-10** | **宿主 provider 层流式重试**：把插件的 `retry-policy` 策略搬到 Harness provider（模型流 502/中断自动重试 3~6 次）| 插件层已完成 ✓，这层补上才算根治 | 稳定性 |
| **A-7** | **`storyboard/plan`**：剧本 → 结构化分镜表（镜头/角色/场景/台词/图片提示词/视频提示词），无 LLM 适配器时**如实报错** | 新端点 + 测试 | **B-15** |
| **A-11** | **`exports/history`**：导出历史按项目归档（列表/失败原因/产物路径）| 新端点 + 测试 | **B-16** |
| **A-8** | **生产线编排**：A-1 模板 + A-7 分镜串成「剧本→分镜→生图→视频→导出」可运行模板 | 依赖 A-7 | 发布质量 |
| **P1** | **发布 v1.0.0**：版本跨 1.0.0 + 发布说明 + 3 分钟演示 + 示例项目包 + schema v4 迁移说明 | A only（发版归 A）| — |

## Wave 3（B 依赖 A 的，等 A 落地后我做通知）

| # | 任务 | 依赖 |
| --- | --- | --- |
| **B-15** | 分镜表编辑 UI（可改镜头/提示词、批量重排）| A-7 |
| **B-16** | 导出历史面板（按项目看成功/失败/重试）| A-11 |

## 纪律（同前）
1. A 跑 `bash scripts/gate.sh`；B 至少 `pnpm run typecheck` + `vitest run tests/client-*`。
2. 端点/字段变更同步 `docs/API-SURFACE.md`。
3. A 负责 `release.mjs` → build → gate → tag → push → Harness 指针；B 不碰这些。
4. 冲突时 B 留 `// TODO(A):` 一行，交 A 改。
