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
| `timelines/list` / `save` / `remove` / `render`（`{timelineId,priority?,retryTransient?,thumbnailAtMs?}`（`A126` 封面帧位置）（`A114` 瞬时失败自动重试一次，opt-in）） / `renders`（`{renders,sets}`，`A56` 成片集） / `render-cancel` | — | — | `render` 起导出任务；`renders` 轮询；`render-retry{renderId}` 复用原时间轴与原优先级重跑（`A59`）；`render-cancel` 杀 ffmpeg 并清理半成品；渲染任务带 `progressStep{current,total}`（`A41` 进度细分）、`progressEtaSec`（`A52` 预计剩余秒数，过早不给）；成功后 `summary` 可含 `segmentTimingsMs`/`slowestSegment`（`A57` 各段耗时）；任务成功后带 `summary`（`A37` 产物/规格/轨道概览，加法字段）；配置 `DSH_OUTPUT_MAX_FILES`/`DSH_OUTPUT_MAX_GB` 时摘要还会带 `retention` **建议**（`A38`，只报告不删除）；**轨道支持 `volume`(0–2) 与 `muted`**（A1，导出真实混音）；**`exportFormat`** `{width,height,frameRate(24/25/30/60),bitrateKbps?}` 可存可改，导出按此出片并**实测复核**（A2） |
| `timelines/validate` | `{timelineId?}` 或 `{document?}`（inline 上限：≤2MB / 片段 ≤400（与存储同源）/ 轨道 ≤50） | `{ok,issues[{code,message,trackId?,clipId?}]}` | `A34`+`A45` 一致性预检（含真实时长越界检测）：**未保存文档也能查**（界面拖拽/保存前用） |
| `presets/list` | — | `{presets[]}`（内置 `custom:false` + 自定义 `custom:true`） | `A31`+`A48` 导出预设 |
| `presets/save` | `{id?,name,width,height,frameRate,bitrateKbps?}` | `{preset}` | `A48` 自定义预设：名称 1–40 字且不重名，规格过校验 |
| `presets/remove` | `{id}` | `{removed}` | `A48` 删除自定义预设 |
| `diagnostics` | — | `{plugin{name,version}, provider, outputsDir, data{各实体条数,writeCount,fileBytes,runningRuns}, renders{running,queued,recent[]}, runs{running}, cache{nodeResults}, errors{errors[],errorCount}}` | `A9` 诊断快照：出问题不用翻日志；**不含**提示词/路径等敏感内容 |
| `assets/remove-many` | `{ids[],force?}` | `{removed,skipped[{id,reason}]}` | **`A-2`** 批量删除素材（单次 ≤200；不存在的 id 进 skipped 而不报错）|
| `assets/attach-many` | `{projectId,items[{path,kind?,bytes?}]}` | `{created,assets}` | **`A152`** 批量登记素材（单次 ≤200；kind 缺省按扩展名推断）|
| `media/import` | `{projectId,paths[]}` | `{imported,assets,skipped[{path,reason}]}` | **`A152`** 从本地路径批量导入媒体：**复制进 outputs**（保证 `/outputs` 预览可用），跳过不支持的类型并说明原因 |
| `storyboard/plan` | `{projectId,script,shots?}` | `{shots[],referencedResourceIds[]}` | **`A-7`** 剧本→结构化分镜表（确定性拆解：切句→分组→识别资源里的角色/场景→生成 imagePrompt/videoPrompt；接入 LLM 后可替换同一契约；空剧本如实报错）|
| `exports/list` | `{projectId?,limit?}` | `{exports[]}` | **`A-11`** 导出历史（独立 `exports.json`，按项目过滤、默认 50 条）|
| `exports/record` | `{projectId,timelineId}` | `{export}` | **`A-11`** 记录一次导出（初始 `queued`）|
| `exports/update` | `{id,status?,outputPath?,bytes?,error?,elapsedSeconds?}` | `{export}` | **`A-11`** 更新导出状态/产物/失败原因 |
| `prompts/list` | `{}` | `{prompts[]}` | **`A-5`** 提示词库（独立 `prompts.json`，不动项目 schema）|
| `prompts/save` | `{id?,name,text,source?}` | `{prompt}` | **`A-5`** 新增/更新提示词（名称/内容不能为空）|
| `prompts/remove` | `{id}` | `{removed}` | **`A-5`** 删除 |
| `prompts/extract` | `{path}` | `{text}` | **`A-5`** 图片→提示词；**宿主未注入视觉模型时如实报错**（`R-BND-4` 不伪造）|
| `media/compose` | `{projectId,prompt,resourceIds[],size?,model?}` | `{path,asset,referencedImages,resourceIds}` | **`A-4`** 融合生图：按创作资源收集参考图（`assetPaths` 优先，回退 `assetPath`）与描述，一次生成并登记素材；**无生成适配器时如实报错** |
| `media/generate` | `{prompt,mediaMode?,size?,model?,image?,images?,duration?,aspectRatio?,resolution?,projectId?,wait?}` | `{mediaMode,path,bytes?,asset?,taskId?}` | **`A145`** 工作台内直接生成（复用对话同一对工具；给 `projectId` 时产物自动登记素材并写任务账本；**不自动重试**；**可取消**（`tasks/running` 取 id → `tasks/cancel`，取消后任务落 `cancelled`）；`wait:false` 立即返回 `{pending:true,taskId}`（**必须带 projectId**，视频这类长任务用它避免 RPC 干等）|
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
| `media/generate` 转发 `media[]`（每项 `{image?,video?,type?,position?}`）与 `realPerson`（布尔）到 `generate_video` 工具 | 「尾帧图 / 参考视频」槽生效（B-3 客户端已接线，请求体已按 `media:[{image,type:'last_frame'},{video,type:'reference_video'}]` 发送） | 入参在现有 `media/generate` 上加两个字段；宿主原样拼进 `generate_video` 的 `media` 参数即可（工具侧 `last_frame`/`reference_video` 已实现，见 `src/tools/generate-video.ts`） | **待认领（A）** |
| `media/compose`（A-4） | 融合生图：选角色+场景+物品 → 一次拼装生成（B-9 客户端已接线，见 `src/client/api.ts` 的 `composeMedia`） | 入：`{projectId, prompt, roles?: string[], scenes?: string[], props?: string[]}`（**资源 id**；宿主按 id 解析各自参考图、缺图降级为纯文生）；出：`{mediaMode?, path?, bytes?, asset?, taskId?, referencePaths?}`（与 `media/generate` 同构；`referencePaths` 可选回显真正用到的参考图） | **待认领（A-4）** |
| `prompts/extract` + `prompts/list` / `prompts/save` / `prompts/remove`（A-5） | 提示词工坊：从素材提取结构化提示词 → 编辑 → 入库 → 一键带入（B-10 客户端已接线，见 `src/client/api.ts` 的 `extractPrompt`/`listPrompts`/`savePrompt`/`removePrompt`） | `extract` 入：`{projectId?, assetId?, path?}`；出：`{style?, subject?, material?, details?, text?}`（客户端缺字段容忍；模型不可用时给清晰错误、**不伪造结果**）。`list` 出 `{prompts: PromptRecord[]}`；`save` 入 `{id?, name, text, tags?}` 出 `{prompt: PromptRecord}`；`remove` 入 `{id}` 出 `{removed: boolean}`。`PromptRecord = {id, name, text, tags?, createdAt?}` | **待认领（A-5）** |
| | | | |

**当前待认领：3 条**（2026-10-22 B-3/B-9/B-10 登记：① `media/generate` 转发 `media[]` + `realPerson`；② A-4 `media/compose`；③ A-5 `prompts/extract` + 提示词库 CRUD。三者客户端均已按「契约先行」接线并写了假宿主测试，宿主端点为唯一缺口）。
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
| `assets/project-stats` | — | `{stats}`（`A132` 按项目统计占用：素材数/总字节/被引用字节/时间轴数，按占用降序）|
| `assets/size-report` | `{topN?}` | `{size}`（`A116` 体积排行：Top N/总量/中位数/占比，标注是否未使用）|
| `assets/duplicates` | `{maxHashFiles?}` | `{duplicates}`（`A112` 内容去重：按大小分组、仅同大小算 sha256；给出建议保留项与可回收字节，只报告不删除）|
| `assets/usage` | `{projectId?}` | `{summary,assets}`（素材利用率：从未被时间轴使用的排前面，`A82` 只报告不删除）|

### 资源与用法记录

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `resources/list` | `{projectId?}` | `{resources}` |
| `resources/update` | `{id,name?,note?,assetPath?,assetPaths?}` | `{resource}` | **`A153`** 改资源：改名/备注/参考图；`assetPath: null` 清除，**不传则保留** |
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
| `pipelines/compose` | `{projectId, script, mode?, shots?, duration?, imageModel?, videoModel?, ratio?, strictResources?, styleNote?}` | `{pipeline: {workflowId, name, mode, shots, nodes, warnings, missingResources}}` —— **只编排不跑**（零花费；`P0-2`） |
| `pipelines/run` | 同上 | `{pipeline, run}` —— 编排并立刻起跑（剧本 → 分镜 →（生图）→ 生视频） |

### 时间轴与导出

| 端点 | 参数 | 返回 |
| --- | --- | --- |
| `timelines/list` | `{projectId}` | `{timelines}` |
| `timelines/save` | `{projectId,id?,tracks,frameRate?,burnSubtitles?,exportFormat?,normalizeLoudness?,burnLanguage?}` | `{timeline}` |
| `subtitles/export` | `{timelineId,trackId?,format?}` | `{srt,cues}`（`A118` 导出标准 SRT）|
| `subtitles/import` | `{timelineId,srt,format?,trackId?,offsetMs?,replace?}` | `{timeline,imported,skipped}`（`A118` 导入 SRT 为字幕片段）|
| `timelines/split-clip` | `{timelineId,clipId,atMs}` | `{timeline,leftId,rightId}` | **`A-9`** 客户端分割片段（此前只有工具动作）|
| `timelines/copy-clip` | `{timelineId,clipId}` | `{timeline}` | **`A-9`** 客户端复制片段 |
| `timelines/duplicate` | `{timelineId,name?}` | `{timeline}`（`A86` 整条复制为副本：片段 id 重新生成、素材共享、名字自动去重）|
| `timelines/remove` | `{timelineId}` | `{removed}` |
| `timelines/validate` | `{timelineId?}` 或 `{document?}`（inline ≤2MB / 片段 ≤400 / 轨道 ≤50） | `{ok,issues}` |
| `timelines/render` | `{timelineId,priority?}` | `{render}` |
| `timelines/preflight` | `{timelineId}` | `{ok,issues,estimate,usage,summaryLine}`（`A84` 导出前体检：问题+体积+素材浪费一次给全）|
| `timelines/estimate` | `{timelineId,width?,height?,frameRate?,bitrateKbps?}` | `{estimate}`（时长/规格/比例/预估体积；覆盖分辨率时码率自动重估，`A80`）|
| `timelines/render-retry` | `{renderId}` | `{render,retriedFrom}`（复用原时间轴与优先级） |
| `timelines/renders` | `{projectId?}` | `{renders,sets}`（`sets` 为成片集聚合） |
| `renders/overview` | — | `{overview}`（`A90` 队列全景：running/queued/recent/throughput + 诊断失败数 + `recentItems`（`A128` 最近成片：视频/封面/字幕路径））|
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

## HTTP 路由（非 RPC，由 webServer 提供）

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/outputs/<文件名>` | GET / HEAD | **只读**返回 outputs 目录里的媒体文件。仅单段文件名、防目录遍历、扩展名白名单（mp4/mov/webm/png/jpg/jpeg/webp/gif）；**支持 `Range`**（206 + `content-range` + `accept-ranges`，视频拖动需要）；只在宿主绑定 `127.0.0.1` 时注册（0.0.0.0 不暴露到局域网）|

> 真机证据（2026-10-20，`dsh-app://app`）：`HEAD /outputs/<png>` → 200 + `image/png`；
> `GET` 带 `Range: bytes=0-99` → **206** + `content-range: bytes 0-99/1843275` + `accept-ranges: bytes`。
> 结论：**同源相对路径在桌面端可直接用**，客户端不需要改写 host/端口。
