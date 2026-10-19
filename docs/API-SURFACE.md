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
| `timelines/list` / `save` / `remove` / `render`（`{timelineId,priority?,retryTransient?}`（`A114` 瞬时失败自动重试一次，opt-in）） / `renders`（`{renders,sets}`，`A56` 成片集） / `render-cancel` | — | — | `render` 起导出任务；`renders` 轮询；`render-retry{renderId}` 复用原时间轴与原优先级重跑（`A59`）；`render-cancel` 杀 ffmpeg 并清理半成品；渲染任务带 `progressStep{current,total}`（`A41` 进度细分）、`progressEtaSec`（`A52` 预计剩余秒数，过早不给）；成功后 `summary` 可含 `segmentTimingsMs`/`slowestSegment`（`A57` 各段耗时）；任务成功后带 `summary`（`A37` 产物/规格/轨道概览，加法字段）；配置 `DSH_OUTPUT_MAX_FILES`/`DSH_OUTPUT_MAX_GB` 时摘要还会带 `retention` **建议**（`A38`，只报告不删除）；**轨道支持 `volume`(0–2) 与 `muted`**（A1，导出真实混音）；**`exportFormat`** `{width,height,frameRate(24/25/30/60),bitrateKbps?}` 可存可改，导出按此出片并**实测复核**（A2） |
| `timelines/validate` | `{timelineId?}` 或 `{document?}`（inline 上限：≤2MB / 片段 ≤400（与存储同源）/ 轨道 ≤50） | `{ok,issues[{code,message,trackId?,clipId?}]}` | `A34`+`A45` 一致性预检（含真实时长越界检测）：**未保存文档也能查**（界面拖拽/保存前用） |
| `presets/list` | — | `{presets[]}`（内置 `custom:false` + 自定义 `custom:true`） | `A31`+`A48` 导出预设 |
| `presets/save` | `{id?,name,width,height,frameRate,bitrateKbps?}` | `{preset}` | `A48` 自定义预设：名称 1–40 字且不重名，规格过校验 |
| `presets/remove` | `{id}` | `{removed}` | `A48` 删除自定义预设 |
| `diagnostics` | — | `{plugin{name,version}, provider, outputsDir, data{各实体条数,writeCount,fileBytes,runningRuns}, renders{running,queued,recent[]}, runs{running}, cache{nodeResults}, errors{errors[],errorCount}}` | `A9` 诊断快照：出问题不用翻日志；**不含**提示词/路径等敏感内容 |
| `media/ffmpeg` | `{path?}` | `{ffmpeg:probe}` | 带 `path` 时严格只查该副本（诊断） |
| `packages/export` / `import` / `export-resources` / `import-resources` | — | — | 导出**只允许写到 `packages/` 之下**（安全边界）；`A53` 起包格式 **v3**（含自定义预设，导入按名称去重），v1/v2 仍可导入 |
| `maintenance/integrity` | — | `{integrity}`（`A104` 完整性巡检：悬空素材引用/孤儿记录/悬空资源使用，只报告不修复）|
| `maintenance/archive` | `{olderThanDays?,dryRun?}` | `{archivedTasks,archivedRuns,estimatedBytes,dryRun,olderThanDays}`（`A94` 归档已结束的旧任务/运行记录到旁路文件，默认 dryRun）|
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
> 数据文件带 `schemaVersion`（当前 **4**）：读入时按迁移链自动升级，**只升不降**（更高版本会拒绝打开并提示升级插件），迁移前自动备份 `workbench.json.pre-migrate-v<N>`。

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

## 完整端点表（A71 补齐）

> 由 `tests/rpc-contract-drift.test.ts` 守护：`src/host/rpc.ts` 里的每个端点都必须出现在本文档，
> 否则测试直接红。下面按资源分组，参数为必填项，返回为成功时的 `value` 结构。

### 项目与素材

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `projects/list` | — | `{projects}` |
| `projects/create` | `{name}` | `{project}` |
| `projects/rename` | `{projectId,name}` | `{project}` |
| `projects/remove` | `{projectId}` | `{removed}` |
| `assets/list` | `{projectId,kind?}` | `{assets}` |
| `assets/attach` | `{projectId,path,kind?,prompt?}` | `{asset,created}` |
| `assets/quick-add` | `{projectId,path?}` | `{asset,created}`（自动推断种类） |
| `assets/remove` | `{projectId,assetId}` | `{removed}` |
| `assets/size-report` | `{topN?}` | `{size}`（`A116` 体积排行：Top N/总量/中位数/占比，标注是否未使用）|
| `assets/duplicates` | `{maxHashFiles?}` | `{duplicates}`（`A112` 内容去重：按大小分组、仅同大小算 sha256；给出建议保留项与可回收字节，只报告不删除）|
| `assets/usage` | `{projectId?}` | `{summary,assets}`（素材利用率：从未被时间轴使用的排前面，`A82` 只报告不删除）|

### 资源与用法记录

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `resources/list` | `{projectId?}` | `{resources}` |
| `resources/create` | `{projectId,kind,name?}` | `{resource}` |
| `resources/remove` | `{resourceId}` | `{removed}` |
| `resources/usage` | `{resourceId?}` | `{usage}` |

### 工作流

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `workflows/list` | `{projectId}` | `{workflows}` |
| `workflows/save` | `{projectId,id?,name,nodes,edges}` | `{workflow}` |
| `workflows/remove` | `{workflowId}` | `{removed}` |
| `workflows/run` | `{workflowId,refresh?}` | `{run}` |
| `workflows/runs` | `{projectId,workflowId?}` | `{runs}` |
| `workflows/run-cancel` | `{runId}` | `{cancelled}` |
| `workflows/run-retry` | `{runId}` | `{run}`（复用上次产物的成功节点） |

### 时间轴与导出

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `timelines/list` | `{projectId}` | `{timelines}` |
| `timelines/save` | `{projectId,id?,tracks,frameRate?,burnSubtitles?,exportFormat?,normalizeLoudness?,burnLanguage?}` | `{timeline}` |
| `timelines/duplicate` | `{timelineId,name?}` | `{timeline}`（`A86` 整条复制为副本：片段 id 重新生成、素材共享、名字自动去重）|
| `timelines/remove` | `{timelineId}` | `{removed}` |
| `timelines/validate` | `{timelineId?}` 或 `{document?}`（inline ≤2MB / 片段 ≤400 / 轨道 ≤50） | `{ok,issues}` |
| `timelines/render` | `{timelineId,priority?}` | `{render}` |
| `timelines/preflight` | `{timelineId}` | `{ok,issues,estimate,usage,summaryLine}`（`A84` 导出前体检：问题+体积+素材浪费一次给全）|
| `timelines/estimate` | `{timelineId,width?,height?,frameRate?,bitrateKbps?}` | `{estimate}`（时长/规格/比例/预估体积；覆盖分辨率时码率自动重估，`A80`）|
| `timelines/render-retry` | `{renderId}` | `{render,retriedFrom}`（复用原时间轴与优先级） |
| `timelines/renders` | `{projectId?}` | `{renders,sets}`（`sets` 为成片集聚合） |
| `renders/overview` | — | `{overview}`（`A90` 队列全景：running/queued/recent/throughput + 带诊断的失败数）|
| `timelines/render-cancel` | `{renderId}` | `{cancelled}` |

### 任务（生成任务）

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `tasks/list` | `{projectId?}` | `{tasks}` |
| `tasks/running` | — | `{tasks}`（进行中的生成任务） |
| `tasks/assign` | `{taskId,resourceId}` | `{task}` |
| `tasks/cancel` | `{taskId}` | `{cancelled}` |

### 项目包

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `packages/export` | `{projectId,targetDir,nameSuffix?}` | `{manifestPath}`（目标必须在 `packages/` 之下） |
| `packages/inspect` | `{packageDir,verifyFiles?}` | `{inspection}`（`A96` 只读预检：版本兼容/项目信息/缺失素材/同名冲突，不落地数据）|
| `packages/import` | `{packageDir,nameSuffix?,structureOnly?}` | 导入结果（项目/素材/缺失清单） |
| `packages/export-resources` | `{targetDir}` | `{manifestPath}`（全量资源包） |
| `packages/import-resources` | `{packageDir}` | 导入结果（跳过统计） |

### 维护与诊断

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `media/ffmpeg` | — | `{available,path?,message?}` |
| `diagnostics` | — | `{logs,outputs,renders,logFiles}`（`A100` 落盘日志文件与体积）|
| `maintenance/retention` | `{dryRun?}` | 保留计划（默认 `dryRun:true`，只算不删） |
| `presets/list` | — | `{presets}`（内置 `custom:false` + 自定义 `custom:true`） |
| `presets/save` | `{id?,name,width,height,frameRate,bitrateKbps?}` | `{preset}` |
| `presets/remove` | `{id}` | `{removed}` |
