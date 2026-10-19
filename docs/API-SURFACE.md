# RPC / HTTP 契约（A 维护，B 消费）

> 规则：A 每加/改一个端点，就在这里加一行；B 只按这里写 `src/client/api.ts`。
> 契约冻结：每次打 tag 前 24h 只修 bug、不加新端点。

## 已实现（阶段 1–8）

| 端点 | 入参 | 出参 | 备注 |
| --- | --- | --- | --- |
| `health` | — | `{plugin,version,channel,provider,outputsDir,at,defaults?}` | `defaults` 为 7 字段生效默认值 |
| `projects/list` / `create` / `remove` / `rename` | 见 TASKS | project 记录 | 删除会级联资源/时间轴/运行记录 |
| `assets/probe` | `{path}` | `{path,spec{width?,height?,fps?,durationMs?,hasAudio}}` | `A44` 素材探测：**只允许 outputs 目录内或已登记素材**（防任意路径读取） |
| `assets/list` / `attach` / `remove` / `quick-add` | — | asset / `{removed}` / `{projectId,asset,timelineId?}` | `remove` 未带 `force` 时对被引用素材报错并列出引用位置；`quick-add` 供对话卡片使用 |
| `resources/list` / `create` / `remove` / `usage` | — | resource / `{removed}` / `{usage[]}` | 资源含 `scope`（V1 恒为 `project`）与轨迹关键帧 |
| `tasks/list` / `assign` / `cancel` | — | task 记录 | 取消会真的中止在飞生成 |
| `workflows/list` / `save` / `remove` / `run` / `runs` / `run-cancel` / `run-retry` | — | — | `run` 默认复用成功结果缓存；`run-retry` 只重跑失败节点及下游 |
| `timelines/list` / `save` / `remove` / `render` / `renders` / `render-cancel` | — | — | `render` 起导出任务；`renders` 轮询；`render-cancel` 杀 ffmpeg 并清理半成品；渲染任务带 `progressStep{current,total}`（`A41` 进度细分，加法字段）；任务成功后带 `summary`（`A37` 产物/规格/轨道概览，加法字段）；配置 `DSH_OUTPUT_MAX_FILES`/`DSH_OUTPUT_MAX_GB` 时摘要还会带 `retention` **建议**（`A38`，只报告不删除）；**轨道支持 `volume`(0–2) 与 `muted`**（A1，导出真实混音）；**`exportFormat`** `{width,height,frameRate(24/25/30/60),bitrateKbps?}` 可存可改，导出按此出片并**实测复核**（A2） |
| `timelines/validate` | `{timelineId?}` 或 `{document?}`（inline 上限：≤2MB / 片段 ≤400（与存储同源）/ 轨道 ≤50） | `{ok,issues[{code,message,trackId?,clipId?}]}` | `A34`+`A45` 一致性预检（含真实时长越界检测）：**未保存文档也能查**（界面拖拽/保存前用） |
| `presets/list` | — | `{presets[]}` | `A31` 导出预设（抖音竖屏/小红书/方形/YouTube 1080p·4K/默认 720p），与 `timeline set-format presetId` 共用 |
| `diagnostics` | — | `{plugin{name,version}, provider, outputsDir, data{各实体条数,writeCount,fileBytes,runningRuns}, renders{running,queued,recent[]}, runs{running}, cache{nodeResults}, errors{errors[],errorCount}}` | `A9` 诊断快照：出问题不用翻日志；**不含**提示词/路径等敏感内容 |
| `media/ffmpeg` | `{path?}` | `{ffmpeg:probe}` | 带 `path` 时严格只查该副本（诊断） |
| `packages/export` / `import` / `export-resources` / `import-resources` | — | — | 导出**只允许写到 `packages/` 之下**（安全边界） |
| `maintenance/retention` | `{maxBytes?,maxFiles?,keepNewest?,dryRun?}` | `{dryRun,deleted,plan{remove[],keptFiles,keptBytes,freedBytes,overQuota},hint}` | `A15` 输出配额清理：**默认 dryRun 只算不删**；被素材库引用的文件永不删 |
| `outputs/list` / `maintenance/compact` | — | — | 清理重复素材记录 |

## 新增能力（给 B 用）

| 能力 | 契约 | 状态 |
| --- | --- | --- |
| 轨道音量/静音 | `timelines/save` 的 `tracks[].volume`(0–2) / `tracks[].muted` | ✅ A1 |
| 导出规格 | `timelines/save` 的 `exportFormat` `{width,height,frameRate,bitrateKbps?}`；导出按此出片并实测复核 | ✅ A2 |
| 撤销/重做 | **纯逻辑模块** `src/workbench/history.ts` 的 `HistoryStack<T>`（commit/commitWith/undo/redo/peekUndo/peekRedo/reset）→ B 包一层 React hook 即可 | ✅ A3 |
| 渲染排队 | `timelines/renders` 任务多出**加法字段** `queued?`/`queuePosition?`（`status` 仍是 running，不破坏编译）；`timelines/render-cancel` 可取消排队项 | ✅ A4 |

> 时间轴片段支持 `speed`(0.25–4) / `fade`(0–2000ms) / `crop{x,y,width,height}` / `transition`(`fade|wipeleft|circleopen`) + `transitionDurationMs`(0–2000，缺省 400)（`A13`/`A13b`，可选字段，不改变 schemaVersion）。
>
> 数据文件带 `schemaVersion`（当前 **3**）：读入时按迁移链自动升级，**只升不降**（更高版本会拒绝打开并提示升级插件），迁移前自动备份 `workbench.json.pre-migrate-v<N>`。

## Agent 工具面（`src/tools/workbench.ts`）

- `workbench_projects` / `workbench_assets` / `workbench_workflow` / `workbench_tasks` / `workbench_timeline`
- 工作流动作：`list | save | templates | from-template | run | runs | run-cancel | run-retry`（`A10` 新增 `templates`/`from-template`，模板含 `drama-series` 漫剧单集）
- 字幕轨支持 `language`，时间轴支持 `burnLanguage`（`A42`，只烧选定语言；缺省烧全部）；
- 音轨支持 `fadeMs`(0–5000) 淡入淡出、`crossfadeMs`(0–3000) 相邻片段交叉淡化（`A30`）、`duckUnderTrackId` + `duckingDb`(-30..0) 侧链压缩（`A33`）；时间轴文档支持 `normalizeLoudness`（`A20`，缺省关）。
- 时间轴动作：`list | add-clip | add-subtitles | split-clip | copy-clip | trim | drop-clip | set-format | set-track | export`（`A24` 新增 `split-clip`(clipId,atMs) / `copy-clip`(clipId,startMs?,track?)）（`A14` 新增 `add-subtitles`：一段台词按句切分并按字数分配时间，入参 `text`/`startMs?`/`endMs?`/`maxChars?`）
- 任务动作：`list | renders | cancel | render-cancel`
- 护栏：单次片段 ≤20；**不提供**项目/素材级删除（`T6-5`，只在 UI 里做）

## B 申请区（B 写需求，A 认领）

| 需求 | 用途 | 状态 |
| --- | --- | --- |
**怎么写一条能被我直接认领的申请**（照下面这行格式）：

| 想要什么（端点/字段/动作，写具体名字） | 界面要做什么（一句话） | 期望入参/出参 | 状态 |
| --- | --- | --- | --- |
| （示例）`timelines/save` 增加 `track.duckingDb` | 旁白压背景音乐 | `{duckingDb: number}`；导出按 `sidechaincompress` 处理 | 示例 |
| | | | |

**当前待认领：无**（2026-10-19 核对：只有一行占位"改 RPC 端点/数据模型/渲染参数"，不是可执行需求）。
已就绪、无需申请的新契约（直接接）：`track.fadeMs`、`timeline.normalizeLoudness`、`clip.speed/fade/crop/transition/transitionDurationMs`、
`timelines/save.exportFormat`、`maintenance/retention`、`diagnostics.outputs`、`diagnostics.renders.stats`、`workflow templates/from-template`、`timeline add-subtitles`。
 |

