# RPC / HTTP 契约（A 维护，B 消费）

> 规则：A 每加/改一个端点，就在这里加一行；B 只按这里写 `src/client/api.ts`。
> 契约冻结：每次打 tag 前 24h 只修 bug、不加新端点。

## 已实现（阶段 1–8）

| 端点 | 入参 | 出参 | 备注 |
| --- | --- | --- | --- |
| `health` | — | `{plugin,version,channel,provider,outputsDir,at,defaults?}` | `defaults` 为 7 字段生效默认值 |
| `projects/list` / `create` / `remove` / `rename` | 见 TASKS | project 记录 | 删除会级联资源/时间轴/运行记录 |
| `assets/list` / `attach` / `remove` / `quick-add` | — | asset / `{removed}` / `{projectId,asset,timelineId?}` | `remove` 未带 `force` 时对被引用素材报错并列出引用位置；`quick-add` 供对话卡片使用 |
| `resources/list` / `create` / `remove` / `usage` | — | resource / `{removed}` / `{usage[]}` | 资源含 `scope`（V1 恒为 `project`）与轨迹关键帧 |
| `tasks/list` / `assign` / `cancel` | — | task 记录 | 取消会真的中止在飞生成 |
| `workflows/list` / `save` / `remove` / `run` / `runs` / `run-cancel` / `run-retry` | — | — | `run` 默认复用成功结果缓存；`run-retry` 只重跑失败节点及下游 |
| `timelines/list` / `save` / `remove` / `render` / `renders` / `render-cancel` | — | — | `render` 起导出任务；`renders` 轮询；`render-cancel` 杀 ffmpeg 并清理半成品；**轨道支持 `volume`(0–2) 与 `muted`**（A1，导出真实混音）；**`exportFormat`** `{width,height,frameRate(24/25/30/60),bitrateKbps?}` 可存可改，导出按此出片并**实测复核**（A2） |
| `media/ffmpeg` | `{path?}` | `{ffmpeg:probe}` | 带 `path` 时严格只查该副本（诊断） |
| `packages/export` / `import` / `export-resources` / `import-resources` | — | — | 导出**只允许写到 `packages/` 之下**（安全边界） |
| `outputs/list` / `maintenance/compact` | — | — | 清理重复素材记录 |

## 新增能力（给 B 用）

| 能力 | 契约 | 状态 |
| --- | --- | --- |
| 轨道音量/静音 | `timelines/save` 的 `tracks[].volume`(0–2) / `tracks[].muted` | ✅ A1 |
| 导出规格 | `timelines/save` 的 `exportFormat` `{width,height,frameRate,bitrateKbps?}`；导出按此出片并实测复核 | ✅ A2 |
| 撤销/重做 | **纯逻辑模块** `src/workbench/history.ts` 的 `HistoryStack<T>`（commit/commitWith/undo/redo/peekUndo/peekRedo/reset）→ B 包一层 React hook 即可 | ✅ A3 |
| 渲染排队 | `timelines/renders` 任务多出**加法字段** `queued?`/`queuePosition?`（`status` 仍是 running，不破坏编译）；`timelines/render-cancel` 可取消排队项 | ✅ A4 |

## B 申请区（B 写需求，A 认领）

| 需求 | 用途 | 状态 |
| --- | --- | --- |
| （示例）`timelines/save` 增加 `volume`/`muted` | 音轨音量与静音 | A1 实现中 |
