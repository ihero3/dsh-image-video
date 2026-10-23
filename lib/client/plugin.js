window.__ModuleLoader__.load({
	id: "dsh-image-video",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _xyflow_react = require("@xyflow/react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/workbench-contract.ts
		/**
		* The channel contract shared by the host and browser halves of the workbench.
		*
		* It holds no runtime dependency of either side, so the browser bundle can carry
		* the channel name and the health shape without pulling in host code. The host
		* handler (`src/host/rpc.ts`) and the client plugin (`src/client/plugin.ts`) both
		* read it, which is what keeps "the two halves agree on the channel" from being
		* a comment nobody checks.
		*/
		/**
		* Channel of the workbench RPC, as `connection.rpc.handle`/`call` name it.
		*
		* **One path segment only**: the connection transport validates channels against
		* `/^\/[A-Za-z0-9._~-]+$/` and rejects `/api` (see `rpc-host.ts` `assertChannel`),
		* on the host and in the browser caller alike. A channel like
		* `/image-video/workbench` throws at registration and every call is refused.
		*/
		const WORKBENCH_RPC_CHANNEL = "/image-video";
		//#endregion
		//#region src/client/api.ts
		/**
		* Build the API over a client connection.
		* @param connection - the client connection handle (`ctx.get('connection')`).
		* @returns the typed API.
		*/
		function createWorkbenchApi(connection) {
			/** Call one endpoint and unwrap the connection result envelope. */
			async function call(endpoint, payload = {}) {
				const result = await connection.rpc.call(WORKBENCH_RPC_CHANNEL, endpoint, payload);
				if (!result.ok) throw new Error(result.error?.message ?? `workbench ${endpoint} failed`);
				return result.value;
			}
			return {
				health: () => call("health"),
				listProjects: async () => (await call("projects/list")).projects,
				createProject: async (name) => (await call("projects/create", { name })).project,
				removeProject: async (id) => (await call("projects/remove", { id })).removed,
				listAssets: async (projectId) => (await call("assets/list", { projectId })).assets,
				attachAsset: (input) => call("assets/attach", input),
				removeAsset: async (id, force) => (await call("assets/remove", force === true ? {
					id,
					force: true
				} : { id })).removed,
				removeAssets: (input) => call("assets/remove-many", input),
				renameProject: async (id, name) => (await call("projects/rename", {
					id,
					name
				})).project,
				listResources: async (projectId, kind) => (await call("resources/list", {
					projectId,
					kind
				})).resources,
				createResource: async (input) => (await call("resources/create", input)).resource,
				removeResource: async (id, force) => (await call("resources/remove", force === true ? {
					id,
					force: true
				} : { id })).removed,
				listTasks: async (limit) => (await call("tasks/list", { limit })).tasks,
				listRunningTasks: async () => (await call("tasks/running")).running,
				probeFfmpeg: async (path) => (await call("media/ffmpeg", path === void 0 ? {} : { path })).ffmpeg,
				saveDefaults: async (patch) => {
					const response = await fetch("/image-video/defaults", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(patch)
					});
					if (!response.ok) {
						const text = await response.text().catch(() => "");
						throw new Error(`默认值没写进去（HTTP ${response.status}）：${text.slice(0, 200)}`);
					}
				},
				listResourceUsage: async (options) => (await call("resources/usage", options ?? {})).usage,
				renderTimeline: async (timelineId, projectId, options) => (await call("timelines/render", {
					timelineId,
					...projectId !== void 0 ? { projectId } : {},
					...options !== void 0 ? {
						resolution: options.resolution,
						fps: options.fps,
						aspect: options.aspect
					} : {}
				})).render,
				listRenders: async (projectId) => (await call("timelines/renders", projectId === void 0 ? {} : { projectId })).renders,
				cancelRender: async (renderId) => (await call("timelines/render-cancel", { renderId })).cancelled,
				listTimelines: async (projectId) => (await call("timelines/list", { projectId })).timelines,
				saveTimeline: async (input) => (await call("timelines/save", input)).timeline,
				removeTimeline: async (id) => (await call("timelines/remove", { id })).removed,
				listWorkflows: async (projectId) => (await call("workflows/list", { projectId })).workflows,
				saveWorkflow: async (input) => (await call("workflows/save", input)).workflow,
				removeWorkflow: async (id) => (await call("workflows/remove", { id })).removed,
				compactAssets: async () => (await call("maintenance/compact", {})).removed,
				runWorkflow: async (workflowId, only) => (await call("workflows/run", {
					workflowId,
					...only === void 0 ? {} : { only }
				})).run,
				listRuns: async (projectId, workflowId) => (await call("workflows/runs", {
					projectId,
					workflowId
				})).runs,
				cancelRun: async (runId) => (await call("workflows/run-cancel", { runId })).cancelled,
				retryRun: async (runId) => (await call("workflows/run-retry", { runId })).run,
				cancelTask: async (id) => (await call("tasks/cancel", { id })).cancelled,
				attachAssets: (input) => call("assets/attach-many", input),
				updateResource: (input) => call("resources/update", input).then((result) => result.resource),
				importMedia: (input) => call("media/import", input),
				generateMedia: (input) => call("media/generate", input),
				composeMedia: (input) => call("media/compose", input),
				extractPrompt: (input) => call("prompts/extract", input),
				planStoryboard: (input) => call("storyboard/plan", input),
				listPrompts: async () => (await call("prompts/list")).prompts,
				savePrompt: async (input) => (await call("prompts/save", input)).prompt,
				removePrompt: async (id) => (await call("prompts/remove", { id })).removed,
				assignTask: async (id, projectId) => (await call("tasks/assign", {
					id,
					projectId
				})).task,
				assetSizeReport: async (topN) => (await call("assets/size-report", topN === void 0 ? {} : { topN })).size,
				assetDuplicates: async (maxHashFiles) => (await call("assets/duplicates", maxHashFiles === void 0 ? {} : { maxHashFiles })).duplicates,
				assetProjectStats: async () => (await call("assets/project-stats")).stats,
				listOutputs: async (limit) => (await call("outputs/list", { limit })).outputs,
				getDiagnostics: () => call("diagnostics")
			};
		}
		//#endregion
		//#region src/workbench/records.ts
		/**
		* Mint a record id. Time-ordered prefix plus randomness keeps ids sortable and
		* collision-free without pulling in a uuid dependency.
		* @param prefix - short kind marker (`prj` | `ast`).
		* @returns the new id.
		*/
		function newWorkbenchId(prefix) {
			return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		}
		/**
		* 节点目录。顺序即画布左侧节点库的展示顺序（先能用的，后 planned）。
		*
		* `video-generate` 按 `D7` 显式承载参考视频与 `compare`（不另立 `video-edit` 节点），
		* 参数语义与对话里的 `generate_video` 对齐（`R-FLW-4`）。
		*/
		const NODE_CATALOG = [
			{
				kind: "creative-input",
				labelKey: "nodeCreativeInput",
				availability: "runnable",
				input: "any",
				output: "text",
				params: [{
					id: "brief",
					labelKey: "paramBrief",
					type: "textarea",
					default: "",
					required: true
				}]
			},
			{
				kind: "script",
				labelKey: "nodeScript",
				availability: "runnable",
				input: "text",
				output: "text",
				params: [{
					id: "text",
					labelKey: "paramScript",
					type: "textarea",
					default: "",
					required: true
				}]
			},
			{
				kind: "storyboard",
				labelKey: "nodeStoryboard",
				availability: "runnable",
				input: "text",
				output: "text",
				params: [{
					id: "shots",
					labelKey: "paramShots",
					type: "number",
					default: 4,
					required: true
				}, {
					id: "note",
					labelKey: "paramNote",
					type: "text",
					default: ""
				}]
			},
			{
				kind: "asset-reference",
				labelKey: "nodeAssetReference",
				availability: "runnable",
				input: "media",
				output: "asset",
				params: [{
					id: "assetId",
					labelKey: "paramAsset",
					type: "text",
					default: "",
					required: true
				}]
			},
			{
				kind: "resource-reference",
				labelKey: "nodeResourceReference",
				availability: "runnable",
				input: "any",
				output: "resource",
				params: [{
					id: "resourceId",
					labelKey: "paramResource",
					type: "text",
					default: "",
					required: true
				}]
			},
			{
				kind: "motion-track",
				labelKey: "nodeMotionTrack",
				availability: "runnable",
				input: "media",
				output: "media",
				params: [{
					id: "trackId",
					labelKey: "paramTrack",
					type: "text",
					default: ""
				}, {
					id: "note",
					labelKey: "paramNote",
					type: "text",
					default: ""
				}]
			},
			{
				kind: "image-generate",
				labelKey: "nodeImageGenerate",
				availability: "runnable",
				input: "text",
				output: "media",
				params: [
					{
						id: "model",
						labelKey: "paramModel",
						type: "text",
						default: ""
					},
					{
						id: "prompt",
						labelKey: "paramPrompt",
						type: "textarea",
						default: "",
						required: true
					},
					{
						id: "ratio",
						labelKey: "paramRatio",
						type: "select",
						default: "3:4",
						options: [
							{
								value: "1:1",
								labelKey: "ratioSquare"
							},
							{
								value: "3:4",
								labelKey: "ratioPortrait"
							},
							{
								value: "16:9",
								labelKey: "ratioLandscape"
							},
							{
								value: "9:16",
								labelKey: "ratioVertical"
							}
						]
					}
				]
			},
			{
				kind: "video-generate",
				labelKey: "nodeVideoGenerate",
				availability: "runnable",
				input: "media",
				output: "media",
				params: [
					{
						id: "model",
						labelKey: "paramModel",
						type: "text",
						default: ""
					},
					{
						id: "prompt",
						labelKey: "paramPrompt",
						type: "textarea",
						default: "",
						required: true
					},
					{
						id: "ratio",
						labelKey: "paramRatio",
						type: "select",
						default: "16:9",
						options: [
							{
								value: "16:9",
								labelKey: "ratioLandscape"
							},
							{
								value: "9:16",
								labelKey: "ratioVertical"
							},
							{
								value: "1:1",
								labelKey: "ratioSquare"
							}
						]
					},
					{
						id: "duration",
						labelKey: "paramDuration",
						type: "number",
						default: 5
					},
					{
						id: "resolution",
						labelKey: "paramResolution",
						type: "select",
						default: "",
						options: [
							{
								value: "",
								labelKey: "resolutionDefault"
							},
							{
								value: "480P",
								labelKey: "resolution480"
							},
							{
								value: "768P",
								labelKey: "resolution768"
							},
							{
								value: "2K",
								labelKey: "resolution2k"
							}
						]
					},
					{
						id: "referenceVideo",
						labelKey: "paramReferenceVideo",
						type: "text",
						default: ""
					},
					{
						id: "compare",
						labelKey: "paramCompare",
						type: "boolean",
						default: false
					}
				]
			},
			{
				kind: "preview",
				labelKey: "nodePreview",
				availability: "runnable",
				input: "media",
				output: "media",
				params: []
			},
			{
				kind: "publish-asset",
				labelKey: "nodePublishAsset",
				availability: "runnable",
				input: "media",
				output: "asset",
				params: [{
					id: "name",
					labelKey: "paramAssetName",
					type: "text",
					default: ""
				}]
			},
			{
				kind: "subtitle",
				labelKey: "nodeSubtitle",
				availability: "runnable",
				input: "media",
				output: "media",
				params: [{
					id: "text",
					labelKey: "paramScript",
					type: "textarea",
					default: "",
					required: true
				}]
			},
			{
				kind: "render",
				labelKey: "nodeRender",
				availability: "runnable",
				input: "media",
				output: "media",
				params: [{
					id: "note",
					labelKey: "paramNote",
					type: "text",
					default: ""
				}]
			},
			{
				kind: "lip-sync",
				labelKey: "nodeLipSync",
				availability: "planned",
				reasonKey: "plannedLipSync",
				input: "media",
				output: "media",
				params: []
			},
			{
				kind: "face-swap",
				labelKey: "nodeFaceSwap",
				availability: "planned",
				reasonKey: "plannedFaceSwap",
				input: "media",
				output: "media",
				params: []
			},
			{
				kind: "voice-synthesize",
				labelKey: "nodeVoiceSynthesize",
				availability: "planned",
				reasonKey: "plannedVoice",
				input: "text",
				output: "media",
				params: []
			}
		];
		const BY_KIND = new Map(NODE_CATALOG.map((spec) => [spec.kind, spec]));
		/** 取一个节点种类的事实。 */
		function nodeSpec(kind) {
			const spec = BY_KIND.get(kind);
			if (spec === void 0) throw new Error(`unknown workflow node kind: ${kind}`);
			return spec;
		}
		/** 新节点的默认参数（取自目录）。 */
		function defaultParams(kind) {
			const spec = nodeSpec(kind);
			return Object.fromEntries(spec.params.map((field) => [field.id, field.default]));
		}
		/**
		* 内置模板：文案→分镜→图→视频 / 图片→视频→字幕→渲染 / 参考视频复刻（`compare`）。
		*
		* 示例值只求"能跑通并看清链路"，用户改提示词即可；端口类型与必填项都满足校验。
		*/
		const WORKFLOW_TEMPLATES = [
			{
				id: "copy-to-video",
				labelKey: "templateCopyToVideo",
				nodes: [
					{
						kind: "creative-input",
						params: { brief: "一支 15 秒的咖啡广告：清晨窗边，热气升腾" }
					},
					{
						kind: "script",
						params: { text: "镜头一：晨光落在杯口；镜头二：热气缓慢升腾；镜头三：字幕收尾。" }
					},
					{
						kind: "storyboard",
						params: {
							shots: 3,
							note: "每镜 5 秒，暖色调"
						}
					},
					{
						kind: "image-generate",
						params: { prompt: "清晨窗边的咖啡杯特写，暖色调，柔和顶光，浅景深" }
					},
					{
						kind: "video-generate",
						params: {
							prompt: "镜头缓慢推近，热气升腾，光影流动",
							duration: 5,
							compare: false
						}
					},
					{
						kind: "preview",
						params: {}
					}
				],
				edges: [
					[0, 1],
					[1, 2],
					[2, 3],
					[3, 4],
					[4, 5]
				]
			},
			{
				id: "image-to-video",
				labelKey: "templateImageToVideo",
				nodes: [
					{
						kind: "image-generate",
						params: { prompt: "金属质感的播放按钮悬浮在薄荷绿背景上，居中留白" }
					},
					{
						kind: "video-generate",
						params: {
							prompt: "按钮轻微旋转并伴随光晕闪烁，背景缓慢流动",
							duration: 5
						}
					},
					{
						kind: "subtitle",
						params: { text: "订阅即可继续观看" }
					},
					{
						kind: "render",
						params: { note: "导出 1080P" }
					}
				],
				edges: [
					[0, 1],
					[1, 2],
					[2, 3]
				]
			},
			{
				id: "reference-remake",
				labelKey: "templateReferenceRemake",
				nodes: [{
					kind: "video-generate",
					params: {
						prompt: "保留原片构图与动作，把背景替换成雪夜街道，并生成对比片",
						duration: 5,
						compare: true,
						referenceVideo: ""
					}
				}, {
					kind: "preview",
					params: {}
				}],
				edges: [[0, 1]]
			},
			{
				id: "quick-image",
				labelKey: "templateQuickImage",
				nodes: [{
					kind: "script",
					params: { text: "一句话说清你要的画面（示例：雨夜霓虹街头，电影感）" }
				}, {
					kind: "image-generate",
					params: { prompt: "雨夜霓虹街头，电影感，浅景深" }
				}],
				edges: [[0, 1]]
			},
			{
				id: "quick-video",
				labelKey: "templateQuickVideo",
				nodes: [
					{
						kind: "script",
						params: { text: "一句话说清这段镜头（示例：镜头缓慢推近，光照流动）" }
					},
					{
						kind: "image-generate",
						params: { prompt: "首帧：雨夜霓虹街头，主体居中，电影感" }
					},
					{
						kind: "video-generate",
						params: {
							prompt: "镜头缓慢推近，光照流动",
							duration: 5,
							compare: false
						}
					}
				],
				edges: [[0, 1], [1, 2]]
			},
			{
				id: "storyboard",
				labelKey: "templateStoryboard",
				nodes: [
					{
						kind: "creative-input",
						params: { brief: "30 秒产品短片：从环境空镜到产品特写" }
					},
					{
						kind: "script",
						params: { text: "镜头一：环境空镜；镜头二：人物入画；镜头三：产品特写＋字幕" }
					},
					{
						kind: "storyboard",
						params: {
							shots: 3,
							note: "每镜 5 秒"
						}
					},
					{
						kind: "image-generate",
						params: { prompt: "分镜首帧：产品置于木桌，侧逆光，浅景深" }
					}
				],
				edges: [
					[0, 1],
					[1, 2],
					[2, 3]
				]
			},
			{
				id: "production-line",
				labelKey: "templateProductionLine",
				nodes: [
					{
						kind: "script",
						params: { text: "镜头一：雨夜街头，小雨撑伞回眸；镜头二：霓虹倒影里她的侧脸；镜头三：黑伞收拢，雨停。" }
					},
					{
						kind: "storyboard",
						params: {
							shots: 3,
							note: "每镜 5 秒，冷色调霓虹"
						}
					},
					{
						kind: "image-generate",
						params: { prompt: "分镜首帧：雨夜街头，小雨撑黑伞回眸，霓虹倒影，电影感" }
					},
					{
						kind: "video-generate",
						params: {
							prompt: "镜头缓慢推近，雨丝落下，霓虹光流动",
							duration: 5,
							compare: false
						}
					}
				],
				edges: [
					[0, 1],
					[1, 2],
					[2, 3]
				]
			},
			{
				id: "cover",
				labelKey: "templateCover",
				nodes: [{
					kind: "script",
					params: { text: "封面图：视频主视觉 + 大标题留白" }
				}, {
					kind: "image-generate",
					params: { prompt: "竖版封面：主体居中偏右，左侧留出标题空间，高对比" }
				}],
				edges: [[0, 1]]
			}
		];
		/** 端口兼容表：目标输入能接受哪些来源输出。`any` 全收；`asset` 可当 `media` 用。 */
		const PORT_ACCEPTS = {
			any: [
				"any",
				"text",
				"media",
				"resource",
				"asset"
			],
			text: ["any", "text"],
			media: [
				"any",
				"media",
				"asset"
			],
			resource: ["any", "resource"],
			asset: [
				"any",
				"asset",
				"media"
			]
		};
		/**
		* 校验整张图：必填参数、端口类型、自环、悬空连线、环、planned 节点不可运行。
		*
		* 纯函数、不碰 IO——画布用它做即时反馈，宿主在运行前用同一份逻辑拒绝（`R-FLW-3`）。
		* @param nodes - 图里的节点。
		* @param edges - 图里的连线。
		* @returns 是否可运行，以及全部问题。
		*/
		function validateWorkflow(nodes, edges) {
			const issues = [];
			const byId = new Map(nodes.map((node) => [node.id, node]));
			for (const node of nodes) {
				const spec = nodeSpec(node.kind);
				if (spec.availability !== "runnable") issues.push({
					code: "not-runnable",
					nodeId: node.id,
					message: `${node.kind} is planned and cannot run (${spec.reasonKey ?? "no reason recorded"})`
				});
				for (const field of spec.params) {
					if (field.required !== true) continue;
					const value = node.params[field.id];
					if (value === void 0 || value === "" || value === false) issues.push({
						code: "missing-required",
						nodeId: node.id,
						message: `${node.kind}.${field.id} is required`
					});
				}
			}
			for (const edge of edges) {
				const source = byId.get(edge.source);
				const target = byId.get(edge.target);
				if (source === void 0 || target === void 0) {
					issues.push({
						code: "dangling-edge",
						edgeId: edge.id,
						message: `edge ${edge.id} references a missing node`
					});
					continue;
				}
				if (edge.source === edge.target) {
					issues.push({
						code: "self-loop",
						edgeId: edge.id,
						message: `edge ${edge.id} loops onto itself`
					});
					continue;
				}
				const from = nodeSpec(source.kind).output;
				const to = nodeSpec(target.kind).input;
				if (!PORT_ACCEPTS[to].includes(from)) issues.push({
					code: "port-mismatch",
					edgeId: edge.id,
					message: `${source.kind}(${from}) cannot feed ${target.kind}(${to})`
				});
			}
			const colour = /* @__PURE__ */ new Map();
			const outgoing = /* @__PURE__ */ new Map();
			for (const edge of edges) {
				if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
				outgoing.get(edge.source)?.push(edge.target);
			}
			const stack = [];
			const walk = (id) => {
				colour.set(id, "grey");
				stack.push(id);
				for (const next of outgoing.get(id) ?? []) {
					const state = colour.get(next) ?? "white";
					if (state === "grey") {
						issues.push({
							code: "cycle",
							nodeId: next,
							message: `cycle: ${[...stack.slice(stack.indexOf(next)), next].join(" -> ")}`
						});
						continue;
					}
					if (state === "white") walk(next);
				}
				stack.pop();
				colour.set(id, "black");
			};
			for (const node of nodes) if ((colour.get(node.id) ?? "white") === "white") walk(node.id);
			return {
				ok: issues.length === 0,
				issues
			};
		}
		//#endregion
		//#region src/workbench/timeline.ts
		/** 转场时长上限（毫秒）。 */
		const MAX_CLIP_TRANSITION_MS = 2e3;
		/** 变速的允许范围。 */
		const CLIP_SPEED_RANGE = {
			min: .25,
			max: 4
		};
		/** 淡入淡出时长上限（毫秒）。 */
		const MAX_CLIP_FADE_MS = 2e3;
		/** 音频轨淡入淡出时长上限（毫秒，`A20`）。 */
		const MAX_TRACK_FADE_MS = 5e3;
		/**
		* 片段在时间轴上**实际占用**的时长（变速折算后）。
		* @param clip - 片段。
		* @returns 毫秒（至少 1）。
		*/
		function effectiveDurationMs(clip) {
			const speed = clip.speed ?? 1;
			return Math.max(1, Math.round(clip.durationMs / speed));
		}
		/** 单个 clip 最长 30 分钟。 */
		const MAX_CLIP_DURATION_MS = 1800 * 1e3;
		/**
		* 取某个时间点上某类轨道的活动 clip。
		*
		* **预览与导出共用这一份边界判断**（`R-TML-3`）：预览显示哪一段、导出从哪一段切，
		* 都来自这里，所以"预览切换点"与"导出切换点"不会各算一套。
		* @param tracks - 轨道。
		* @param kind - 轨道种类。
		* @param timeMs - 播放头位置（毫秒）。
		* @returns 该时刻的活动 clip，没有则 `undefined`。
		*/
		function activeClipAt(tracks, kind, timeMs) {
			return tracks.filter((track) => track.kind === kind).flatMap((track) => track.clips).find((clip) => timeMs >= clip.startMs && timeMs < clip.startMs + effectiveDurationMs(clip));
		}
		/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
		function timelineDurationMs(tracks) {
			return tracks.reduce((longest, track) => {
				const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs);
				let end = 0;
				for (let index = 0; index < ordered.length; index += 1) {
					const clip = ordered[index];
					const start = clip.startMs;
					const clipEnd = start + effectiveDurationMs(clip);
					const previous = ordered[index - 1];
					const adjacent = previous !== void 0 && start <= previous.startMs + effectiveDurationMs(previous) + 1;
					const overlap = track.kind === "video" && adjacent ? transitionOverlapMs(clip, previous) : 0;
					end = Math.max(end, clipEnd - overlap);
				}
				return Math.max(longest, end);
			}, 0);
		}
		/**
		* 片段与其**上一个片段**之间实际生效的转场时长（毫秒）。
		* @param clip - 当前片段。
		* @param previous - 上一个片段（没有则不生效）。
		* @returns 0 表示不转场。
		*/
		function transitionOverlapMs(clip, previous) {
			if (previous === void 0 || clip.transition === void 0) return 0;
			return Math.min(transitionDurationMs(clip), Math.floor(Math.min(effectiveDurationMs(clip), effectiveDurationMs(previous)) / 2));
		}
		/**
		* 转场时长（缺省 400ms，按 0–2000 夹取）。
		* @param clip - 片段。
		* @returns 毫秒。
		*/
		function transitionDurationMs(clip) {
			const value = clip.transitionDurationMs ?? 400;
			return Math.max(0, Math.min(MAX_CLIP_TRANSITION_MS, Math.round(value)));
		}
		//#endregion
		//#region src/workbench/edits.ts
		/**
		* 在给定时间点把片段一分为二。
		*
		* 规则：拆分点必须**严格落在片段内部**（不能等于首尾）；两半的时长之和等于原时长；
		* 右半的 `inMs` 要把左半消耗的**源内时长**补上（变速时按 `speed` 折算）。
		*
		* @param tracks - 轨道。
		* @param clipId - 要拆的片段。
		* @param atMs - 拆分点（时间轴毫秒，绝对时间）。
		* @param newId - 新片段 id 生成器。
		* @returns 新轨道与两半的 id。
		* @throws {Error} 片段不存在或拆分点不在片段内部时。
		*/
		function splitClipAt(tracks, clipId, atMs, newId) {
			const owner = tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
			const clip = owner?.clips.find((candidate) => candidate.id === clipId);
			if (owner === void 0 || clip === void 0) throw new Error(`找不到片段 ${clipId}`);
			const start = clip.startMs;
			const length = effectiveDurationMs(clip);
			const at = Math.round(atMs);
			if (at <= start || at >= start + length) throw new Error(`拆分点 ${at}ms 必须在片段内部（${start}..${start + length}ms，不含首尾）`);
			const leftMs = at - start;
			const rightMs = length - leftMs;
			const speed = clip.speed ?? 1;
			const consumedSourceMs = Math.round(leftMs * speed);
			const rightId = newId();
			const left = {
				...clip,
				durationMs: Math.max(1, Math.round(leftMs * speed))
			};
			const right = {
				...clip,
				id: rightId,
				startMs: at,
				durationMs: Math.max(1, Math.round(rightMs * speed)),
				inMs: (clip.inMs ?? 0) + consumedSourceMs
			};
			return {
				tracks: tracks.map((track) => track.id !== owner.id ? track : {
					...track,
					clips: track.clips.flatMap((candidate) => candidate.id !== clipId ? [candidate] : [left, right])
				}),
				leftId: clipId,
				rightId
			};
		}
		/**
		* 复制片段：默认放在同一轨、紧跟原片段之后；也可以指定新的起点或换到同类型轨道。
		*
		* @param tracks - 轨道。
		* @param clipId - 要复制的片段。
		* @param newId - 新片段 id 生成器。
		* @param options - 覆盖落点（`startMs`）或目标轨道（`trackKind`）。
		* @returns 新轨道与新片段 id。
		* @throws {Error} 片段不存在时。
		*/
		function duplicateClip(tracks, clipId, newId, options = {}) {
			const owner = tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
			const clip = owner?.clips.find((candidate) => candidate.id === clipId);
			if (owner === void 0 || clip === void 0) throw new Error(`找不到片段 ${clipId}`);
			const target = options.trackKind === void 0 ? owner : tracks.find((track) => track.kind === options.trackKind) ?? owner;
			const copyId = newId();
			const copy = {
				...clip,
				id: copyId,
				startMs: options.startMs === void 0 ? clip.startMs + effectiveDurationMs(clip) : Math.max(0, Math.round(options.startMs))
			};
			return {
				tracks: tracks.map((track) => track.id !== target.id ? track : {
					...track,
					clips: [...track.clips, copy]
				}),
				newClipId: copyId
			};
		}
		/** 全部数据层模板。 */
		const DRAMA_TEMPLATES = [{
			id: "drama-series",
			labelKey: "templateDramaSeries",
			describe: "漫剧/连续剧单集：本集剧情 → 剧本 → 分镜 → 定妆图 → 镜头视频 → 字幕 → 合成（角色基准引用请在运行时挂一个 resource-reference 节点）",
			nodes: [
				{
					kind: "creative-input",
					params: { brief: "本集剧情：雨夜便利店，主角捡到一只会说话的猫，结尾留悬念" }
				},
				{
					kind: "script",
					params: { text: "第 1 集：雨夜。主角推门进便利店，收银台后传来一声猫叫。" }
				},
				{
					kind: "storyboard",
					params: {
						shots: 4,
						note: "每镜 5 秒，冷色调雨夜，特写与中景交替"
					}
				},
				{
					kind: "image-generate",
					params: { prompt: "角色定妆照：雨夜便利店门口，暖黄店招，湿发，半身，电影感" }
				},
				{
					kind: "video-generate",
					params: {
						prompt: "镜头缓慢推近，雨滴滑落玻璃，角色转头看向店内",
						duration: 5,
						compare: false
					}
				},
				{
					kind: "subtitle",
					params: { text: "第 1 集 · 雨夜的猫" }
				},
				{
					kind: "render",
					params: { note: "合成本集成片（1080P）" }
				}
			],
			edges: [
				[0, 1],
				[1, 2],
				[2, 3],
				[3, 4],
				[4, 5],
				[5, 6]
			]
		}];
		//#endregion
		//#region src/workbench/subtitles.ts
		const DEFAULT_MAX_CHARS = 28;
		const DEFAULT_MIN_DURATION = 600;
		/** 句子切分：先按句末标点/换行切，再把过长的句子按逗号类标点续切。 */
		const SENTENCE_END = /[。！？!?；;\n]+/;
		const CLAUSE_END = /[，,、：:]+/;
		/**
		* 把文本切成适合做字幕的短句（保留原文顺序，丢弃空段）。
		* @param text - 原始文本（台词、旁白、文案均可）。
		* @param options - 切句选项。
		* @returns 非空短句数组。
		*/
		function splitSubtitleSentences(text, options = {}) {
			const maxChars = Math.max(4, Math.round(options.maxChars ?? DEFAULT_MAX_CHARS));
			const sentences = [];
			for (const rawSentence of text.split(SENTENCE_END)) {
				const sentence = rawSentence.trim();
				if (sentence === "") continue;
				if (sentence.length <= maxChars) {
					sentences.push(sentence);
					continue;
				}
				let buffer = "";
				for (const clause of sentence.split(CLAUSE_END)) {
					const piece = clause.trim();
					if (piece === "") continue;
					if ((buffer + piece).length <= maxChars) {
						buffer = buffer === "" ? piece : `${buffer}，${piece}`;
						continue;
					}
					if (buffer !== "") sentences.push(buffer);
					if (piece.length <= maxChars) buffer = piece;
					else {
						for (let index = 0; index < piece.length; index += maxChars) sentences.push(piece.slice(index, index + maxChars));
						buffer = "";
					}
				}
				if (buffer !== "") sentences.push(buffer);
			}
			return sentences;
		}
		/**
		* 把文本排成一组**连续、不重叠、不越界**的字幕片段。
		*
		* 时间分配按字数比例（长句显示更久），并保证每条不短于 `minDurationMs`；
		* 条数太多放不下时**截断文本**（而不是把每条压到看不见）。
		*
		* @param text - 文本。
		* @param options - 时间窗与样式。
		* @returns 字幕片段（`kind` 层面属于字幕轨，调用方负责放进轨道）。
		* @throws {Error} 时间窗非法时。
		*/
		function planSubtitleClips(text, options) {
			const { startMs, endMs } = options;
			if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) throw new Error(`字幕时间窗非法：startMs=${startMs} endMs=${endMs}（要求 endMs > startMs）`);
			const totalMs = Math.round(endMs - startMs);
			const minDuration = Math.max(100, Math.round(options.minDurationMs ?? DEFAULT_MIN_DURATION));
			const sentences = splitSubtitleSentences(text, options);
			if (sentences.length === 0) return [];
			const fit = Math.max(1, Math.floor(totalMs / minDuration));
			const kept = sentences.slice(0, fit);
			const weights = kept.map((sentence) => Math.max(1, sentence.length));
			const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
			let newIdCounter = 0;
			const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
			const newId = options.newId ?? (() => `sub-${stamp}-${newIdCounter++}`);
			const clips = [];
			let cursor = Math.round(startMs);
			let remainingMs = totalMs;
			let remainingWeight = totalWeight;
			kept.forEach((sentence, index) => {
				const share = index === kept.length - 1 ? remainingMs : Math.max(minDuration, Math.round(remainingMs * (weights[index] / remainingWeight)));
				const durationMs = Math.max(1, Math.min(share, remainingMs));
				clips.push({
					id: newId(),
					text: sentence,
					startMs: cursor,
					durationMs,
					...options.style === void 0 ? {} : { style: options.style }
				});
				cursor += durationMs;
				remainingMs -= durationMs;
				remainingWeight -= weights[index];
			});
			return clips;
		}
		//#endregion
		//#region src/client/canvas-style.ts
		/**
		* 由 `node scripts/sync-canvas-style.mjs` 生成，请勿手改。
		*
		* 来源：@xyflow/react@12.12.0 的 dist/style.css（MIT）。内嵌原因见同步脚本。
		*/
		/** 官方画布样式表（原样内嵌）。 */
		const CANVAS_STYLE = "/* this gets exported as style.css and can be used for the default theming */\n/* these are the necessary styles for React/Svelte Flow, they get used by base.css and style.css */\n.react-flow {\n  direction: ltr;\n\n  --xy-edge-stroke-default: #b1b1b7;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #555;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(255, 255, 255, 0.5);\n\n  --xy-minimap-background-color-default: #fff;\n  --xy-minimap-mask-background-color-default: rgba(240, 240, 240, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #e2e2e2;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: transparent;\n  --xy-background-pattern-dots-color-default: #91919a;\n  --xy-background-pattern-lines-color-default: #eee;\n  --xy-background-pattern-cross-color-default: #e2e2e2;\n  background-color: var(--xy-background-color, var(--xy-background-color-default));\n  --xy-node-color-default: inherit;\n  --xy-node-border-default: 1px solid #1a192b;\n  --xy-node-background-color-default: #fff;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(0, 0, 0, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #1a192b;\n  --xy-node-border-radius-default: 3px;\n\n  --xy-handle-background-color-default: #1a192b;\n  --xy-handle-border-color-default: #fff;\n\n  --xy-selection-background-color-default: rgba(0, 89, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(0, 89, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #fefefe;\n  --xy-controls-button-background-color-hover-default: #f4f4f4;\n  --xy-controls-button-color-default: inherit;\n  --xy-controls-button-color-hover-default: inherit;\n  --xy-controls-button-border-color-default: #eee;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #ffffff;\n  --xy-edge-label-color-default: inherit;\n  --xy-resize-background-color-default: #3367d9;\n}\n.react-flow.dark {\n  --xy-edge-stroke-default: #3e3e3e;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #727272;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(150, 150, 150, 0.25);\n\n  --xy-minimap-background-color-default: #141414;\n  --xy-minimap-mask-background-color-default: rgba(60, 60, 60, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #2b2b2b;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: #141414;\n  --xy-background-pattern-dots-color-default: #555;\n  --xy-background-pattern-lines-color-default: #333;\n  --xy-background-pattern-cross-color-default: #333;\n  --xy-node-color-default: #f8f8f8;\n  --xy-node-border-default: 1px solid #3c3c3c;\n  --xy-node-background-color-default: #1e1e1e;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(255, 255, 255, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #999;\n\n  --xy-handle-background-color-default: #bebebe;\n  --xy-handle-border-color-default: #1e1e1e;\n\n  --xy-selection-background-color-default: rgba(200, 200, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(200, 200, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #2b2b2b;\n  --xy-controls-button-background-color-hover-default: #3e3e3e;\n  --xy-controls-button-color-default: #f8f8f8;\n  --xy-controls-button-color-hover-default: #fff;\n  --xy-controls-button-border-color-default: #5b5b5b;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #141414;\n  --xy-edge-label-color-default: #f8f8f8;\n}\n.react-flow__background {\n  background-color: var(--xy-background-color-props, var(--xy-background-color, var(--xy-background-color-default)));\n  pointer-events: none;\n  z-index: -1;\n}\n.react-flow__container {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n}\n.react-flow__pane {\n  z-index: 1;\n  touch-action: none;\n}\n.react-flow__pane.draggable {\n    cursor: grab;\n  }\n.react-flow__pane.dragging {\n    cursor: grabbing;\n  }\n.react-flow__pane.selection {\n    cursor: pointer;\n  }\n.react-flow__viewport {\n  transform-origin: 0 0;\n  z-index: 2;\n  pointer-events: none;\n}\n.react-flow__renderer {\n  z-index: 4;\n}\n.react-flow__selection {\n  z-index: 6;\n}\n.react-flow__nodesselection-rect:focus,\n.react-flow__nodesselection-rect:focus-visible {\n  outline: none;\n}\n.react-flow__edge-path {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n  stroke-width: var(--xy-edge-stroke-width, var(--xy-edge-stroke-width-default));\n  fill: none;\n}\n.react-flow__connection-path {\n  stroke: var(--xy-connectionline-stroke, var(--xy-connectionline-stroke-default));\n  stroke-width: var(--xy-connectionline-stroke-width, var(--xy-connectionline-stroke-width-default));\n  fill: none;\n}\n.react-flow .react-flow__edges {\n  position: absolute;\n}\n.react-flow .react-flow__edges svg {\n    overflow: visible;\n    position: absolute;\n    pointer-events: none;\n  }\n.react-flow__edge {\n  pointer-events: visibleStroke;\n}\n.react-flow__edge.selectable {\n    cursor: pointer;\n  }\n.react-flow__edge.animated path {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\n.react-flow__edge.animated path.react-flow__edge-interaction {\n    stroke-dasharray: none;\n    animation: none;\n  }\n.react-flow__edge.inactive {\n    pointer-events: none;\n  }\n.react-flow__edge.selected,\n  .react-flow__edge:focus,\n  .react-flow__edge:focus-visible {\n    outline: none;\n  }\n.react-flow__edge.selected .react-flow__edge-path,\n  .react-flow__edge.selectable:focus .react-flow__edge-path,\n  .react-flow__edge.selectable:focus-visible .react-flow__edge-path {\n    stroke: var(--xy-edge-stroke-selected, var(--xy-edge-stroke-selected-default));\n  }\n.react-flow__edge-textwrapper {\n    pointer-events: all;\n  }\n.react-flow__edge .react-flow__edge-text {\n    pointer-events: none;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n/* Arrowhead marker styles - use CSS custom properties as default */\n.react-flow__arrowhead polyline {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__arrowhead polyline.arrowclosed {\n  fill: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__connection {\n  pointer-events: none;\n}\n.react-flow__connection .animated {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\nsvg.react-flow__connectionline {\n  z-index: 1001;\n  overflow: visible;\n  position: absolute;\n}\n.react-flow__nodes {\n  pointer-events: none;\n  transform-origin: 0 0;\n}\n.react-flow__node {\n  position: absolute;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  pointer-events: all;\n  transform-origin: 0 0;\n  box-sizing: border-box;\n  cursor: default;\n}\n.react-flow__node.selectable {\n    cursor: pointer;\n  }\n.react-flow__node.draggable {\n    cursor: grab;\n    pointer-events: all;\n  }\n.react-flow__node.draggable.dragging {\n      cursor: grabbing;\n    }\n.react-flow__nodesselection {\n  z-index: 3;\n  transform-origin: left top;\n  pointer-events: none;\n}\n.react-flow__nodesselection-rect {\n    position: absolute;\n    pointer-events: all;\n    cursor: grab;\n  }\n.react-flow__handle {\n  position: absolute;\n  pointer-events: none;\n  min-width: 5px;\n  min-height: 5px;\n  width: 6px;\n  height: 6px;\n  background-color: var(--xy-handle-background-color, var(--xy-handle-background-color-default));\n  border: 1px solid var(--xy-handle-border-color, var(--xy-handle-border-color-default));\n  border-radius: 100%;\n}\n.react-flow__handle.connectingfrom {\n    pointer-events: all;\n  }\n.react-flow__handle.connectionindicator {\n    pointer-events: all;\n    cursor: crosshair;\n  }\n.react-flow__handle-bottom {\n    top: auto;\n    left: 50%;\n    bottom: 0;\n    transform: translate(-50%, 50%);\n  }\n.react-flow__handle-top {\n    top: 0;\n    left: 50%;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-left {\n    top: 50%;\n    left: 0;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-right {\n    top: 50%;\n    right: 0;\n    transform: translate(50%, -50%);\n  }\n.react-flow__edgeupdater {\n  cursor: move;\n  pointer-events: all;\n}\n.react-flow__pane.selection .react-flow__panel {\n  pointer-events: none;\n}\n.react-flow__panel {\n  position: absolute;\n  z-index: 5;\n  margin: 15px;\n}\n.react-flow__panel.top {\n    top: 0;\n  }\n.react-flow__panel.bottom {\n    bottom: 0;\n  }\n.react-flow__panel.top.center, .react-flow__panel.bottom.center {\n      left: 50%;\n      transform: translateX(-15px) translateX(-50%);\n    }\n.react-flow__panel.left {\n    left: 0;\n  }\n.react-flow__panel.right {\n    right: 0;\n  }\n.react-flow__panel.left.center, .react-flow__panel.right.center {\n      top: 50%;\n      transform: translateY(-15px) translateY(-50%);\n    }\n.react-flow__attribution {\n  font-size: 10px;\n  background: var(--xy-attribution-background-color, var(--xy-attribution-background-color-default));\n  padding: 2px 3px;\n  margin: 0;\n}\n.react-flow__attribution a {\n    text-decoration: none;\n    color: #999;\n  }\n@keyframes dashdraw {\n  from {\n    stroke-dashoffset: 10;\n  }\n}\n.react-flow__edgelabel-renderer {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  left: 0;\n  top: 0;\n}\n.react-flow__viewport-portal {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n}\n.react-flow__minimap {\n  background: var(\n    --xy-minimap-background-color-props,\n    var(--xy-minimap-background-color, var(--xy-minimap-background-color-default))\n  );\n}\n.react-flow__minimap-svg {\n    display: block;\n  }\n.react-flow__minimap-mask {\n    fill: var(\n      --xy-minimap-mask-background-color-props,\n      var(--xy-minimap-mask-background-color, var(--xy-minimap-mask-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-mask-stroke-color-props,\n      var(--xy-minimap-mask-stroke-color, var(--xy-minimap-mask-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-mask-stroke-width-props,\n      var(--xy-minimap-mask-stroke-width, var(--xy-minimap-mask-stroke-width-default))\n    );\n  }\n.react-flow__minimap-node {\n    fill: var(\n      --xy-minimap-node-background-color-props,\n      var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-node-stroke-color-props,\n      var(--xy-minimap-node-stroke-color, var(--xy-minimap-node-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-node-stroke-width-props,\n      var(--xy-minimap-node-stroke-width, var(--xy-minimap-node-stroke-width-default))\n    );\n  }\n.react-flow__background-pattern.dots {\n    fill: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-dots-color-default))\n    );\n  }\n.react-flow__background-pattern.lines {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-lines-color-default))\n    );\n  }\n.react-flow__background-pattern.cross {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-cross-color-default))\n    );\n  }\n.react-flow__controls {\n  display: flex;\n  flex-direction: column;\n  box-shadow: var(--xy-controls-box-shadow, var(--xy-controls-box-shadow-default));\n}\n.react-flow__controls.horizontal {\n    flex-direction: row;\n  }\n.react-flow__controls-button {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 26px;\n    width: 26px;\n    padding: 4px;\n    border: none;\n    background: var(--xy-controls-button-background-color, var(--xy-controls-button-background-color-default));\n    border-bottom: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n    color: var(\n      --xy-controls-button-color-props,\n      var(--xy-controls-button-color, var(--xy-controls-button-color-default))\n    );\n    cursor: pointer;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n.react-flow__controls-button svg {\n      width: 100%;\n      max-width: 12px;\n      max-height: 12px;\n      fill: currentColor;\n    }\n.react-flow__edge.updating .react-flow__edge-path {\n      stroke: #777;\n    }\n.react-flow__edge-text {\n    font-size: 10px;\n  }\n.react-flow__node.selectable:focus,\n  .react-flow__node.selectable:focus-visible {\n    outline: none;\n  }\n.react-flow__node-input,\n.react-flow__node-default,\n.react-flow__node-output,\n.react-flow__node-group {\n  padding: 10px;\n  border-radius: var(--xy-node-border-radius, var(--xy-node-border-radius-default));\n  width: 150px;\n  font-size: 12px;\n  color: var(--xy-node-color, var(--xy-node-color-default));\n  text-align: center;\n  border: var(--xy-node-border, var(--xy-node-border-default));\n  background-color: var(--xy-node-background-color, var(--xy-node-background-color-default));\n}\n.react-flow__node-input.selectable:hover, .react-flow__node-default.selectable:hover, .react-flow__node-output.selectable:hover, .react-flow__node-group.selectable:hover {\n      box-shadow: var(--xy-node-boxshadow-hover, var(--xy-node-boxshadow-hover-default));\n    }\n.react-flow__node-input.selectable.selected,\n    .react-flow__node-input.selectable:focus,\n    .react-flow__node-input.selectable:focus-visible,\n    .react-flow__node-default.selectable.selected,\n    .react-flow__node-default.selectable:focus,\n    .react-flow__node-default.selectable:focus-visible,\n    .react-flow__node-output.selectable.selected,\n    .react-flow__node-output.selectable:focus,\n    .react-flow__node-output.selectable:focus-visible,\n    .react-flow__node-group.selectable.selected,\n    .react-flow__node-group.selectable:focus,\n    .react-flow__node-group.selectable:focus-visible {\n      box-shadow: var(--xy-node-boxshadow-selected, var(--xy-node-boxshadow-selected-default));\n    }\n.react-flow__node-group {\n  background-color: var(--xy-node-group-background-color, var(--xy-node-group-background-color-default));\n}\n.react-flow__nodesselection-rect,\n.react-flow__selection {\n  background: var(--xy-selection-background-color, var(--xy-selection-background-color-default));\n  border: var(--xy-selection-border, var(--xy-selection-border-default));\n}\n.react-flow__nodesselection-rect:focus,\n  .react-flow__nodesselection-rect:focus-visible,\n  .react-flow__selection:focus,\n  .react-flow__selection:focus-visible {\n    outline: none;\n  }\n.react-flow__controls-button:hover {\n      background: var(\n        --xy-controls-button-background-color-hover-props,\n        var(--xy-controls-button-background-color-hover, var(--xy-controls-button-background-color-hover-default))\n      );\n      color: var(\n        --xy-controls-button-color-hover-props,\n        var(--xy-controls-button-color-hover, var(--xy-controls-button-color-hover-default))\n      );\n    }\n.react-flow__controls-button:disabled {\n      pointer-events: none;\n    }\n.react-flow__controls-button:disabled svg {\n        fill-opacity: 0.4;\n      }\n.react-flow__controls-button:last-child {\n    border-bottom: none;\n  }\n.react-flow__controls.horizontal .react-flow__controls-button {\n    border-bottom: none;\n    border-right: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n  }\n.react-flow__controls.horizontal .react-flow__controls-button:last-child {\n    border-right: none;\n  }\n.react-flow__resize-control {\n  position: absolute;\n}\n.react-flow__resize-control.left,\n.react-flow__resize-control.right {\n  cursor: ew-resize;\n}\n.react-flow__resize-control.top,\n.react-flow__resize-control.bottom {\n  cursor: ns-resize;\n}\n.react-flow__resize-control.top.left,\n.react-flow__resize-control.bottom.right {\n  cursor: nwse-resize;\n}\n.react-flow__resize-control.bottom.left,\n.react-flow__resize-control.top.right {\n  cursor: nesw-resize;\n}\n/* handle styles */\n.react-flow__resize-control.handle {\n  width: 5px;\n  height: 5px;\n  border: 1px solid #fff;\n  border-radius: 1px;\n  background-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  translate: -50% -50%;\n}\n.react-flow__resize-control.handle.left {\n  left: 0;\n  top: 50%;\n}\n.react-flow__resize-control.handle.right {\n  left: 100%;\n  top: 50%;\n}\n.react-flow__resize-control.handle.top {\n  left: 50%;\n  top: 0;\n}\n.react-flow__resize-control.handle.bottom {\n  left: 50%;\n  top: 100%;\n}\n.react-flow__resize-control.handle.top.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.bottom.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.top.right {\n  left: 100%;\n}\n.react-flow__resize-control.handle.bottom.right {\n  left: 100%;\n}\n/* line styles */\n.react-flow__resize-control.line {\n  border-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  border-width: 0;\n  border-style: solid;\n}\n.react-flow__resize-control.line.left,\n.react-flow__resize-control.line.right {\n  width: 1px;\n  transform: translate(-50%, 0);\n  top: 0;\n  height: 100%;\n}\n.react-flow__resize-control.line.left {\n  left: 0;\n  border-left-width: 1px;\n}\n.react-flow__resize-control.line.right {\n  left: 100%;\n  border-right-width: 1px;\n}\n.react-flow__resize-control.line.top,\n.react-flow__resize-control.line.bottom {\n  height: 1px;\n  transform: translate(0, -50%);\n  left: 0;\n  width: 100%;\n}\n.react-flow__resize-control.line.top {\n  top: 0;\n  border-top-width: 1px;\n}\n.react-flow__resize-control.line.bottom {\n  border-bottom-width: 1px;\n  top: 100%;\n}\n.react-flow__edge-textbg {\n  fill: var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default));\n}\n.react-flow__edge-text {\n  fill: var(--xy-edge-label-color, var(--xy-edge-label-color-default));\n}\n";
		/** 注入目标 <style> 的 id，保证重复挂载只注入一次。 */
		const CANVAS_STYLE_ID = "dsh-image-video-canvas-style";
		//#endregion
		//#region src/client/icons.tsx
		/** 单路径图标：一个 `d` 讲完（圆用小圆弧拼）；多元素图形见 {@link SHAPES}。 */
		const STROKE = {
			bolt: "M13 2 3 14h7l-1 8 11-14h-7l1-8z",
			film: "M3.5 5h17v14h-17zM8 5v14M16 5v14M3.5 9.5h4.5M3.5 14.5h4.5M16 9.5h4.5M16 14.5h4.5",
			folder: "M3.5 8A1.5 1.5 0 0 1 5 6.5h4l2 2h8A1.5 1.5 0 0 1 20.5 10v7a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z",
			plus: "M12 5v14M5 12h14",
			refresh: "M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 3.5V9h-5.5",
			trash: "M4.5 7h15M10 7V5.2A1.2 1.2 0 0 1 11.2 4h1.6A1.2 1.2 0 0 1 14 5.2V7M6.2 7l.8 12.2A1.3 1.3 0 0 0 8.3 20.5h7.4a1.3 1.3 0 0 0 1.3-1.3L17.8 7M10.2 10.8v6M13.8 10.8v6",
			check: "M4.8 12.6 9.8 17.6 19.2 6.8",
			alert: "M12 3.8 2.6 20.2h18.8zM12 9.6v4.6M12 17.4v.2",
			x: "M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8",
			download: "M12 3.5v11M7.6 10 12 14.4 16.4 10M4.5 19.5h15",
			image: "M4 5h16v14H4zM8.6 10.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8M20.4 15.6 15 10.2 7 18.2",
			video: "M3.6 6.4h10.8a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1zM15.4 10.6 20.4 8v8l-5-2.6z",
			clock: "M12 7.4V12l3.4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
			layers: "M12 3 3 7.4l9 4.4 9-4.4zM3 12.4 12 16.8l9-4.4M3 17 12 21.4 21 17",
			eye: "M2.6 12S6.1 5.6 12 5.6 21.4 12 21.4 12 17.9 18.4 12 18.4 2.6 12 2.6 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
			user: "M12 11.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.2 20.4a7.8 7.8 0 0 1 15.6 0",
			play: "M8.2 5.4 19 12 8.2 18.6z",
			filter: "M3.6 5.4h16.8l-6.4 7.8v5.2l-4 1.8v-7z",
			upload: "M12 19.6V5M6.6 10.4 12 5l5.4 5.4M4.6 21h14.8",
			link: "M9.6 14.4 14.4 9.6M7.8 11.8 6 13.6a3.6 3.6 0 0 0 5.1 5.1l1.8-1.8M16.2 12.2 18 10.4a3.6 3.6 0 0 0-5.1-5.1l-1.8 1.8",
			box: "M12 3 21 7.4v9.2L12 21 3 16.6V7.4zM3 7.4 12 11.8l9-4.4M12 11.8V21",
			script: "M6.4 3.4h8.2l4 4v13.2H6.4zM14.6 3.4v4h4M9.4 12.4h5.2M9.4 16.4h5.2",
			storyboard: "M3.6 4.4h16.8v5.2H3.6zM3.6 12.4h7.2v7.2H3.6zM13.2 12.4h7.2v7.2h-7.2z",
			input: "M3.6 6.4h16.8v11.2H3.6zM7.6 10.6h8.8M7.6 14h5",
			subtitle: "M3.6 5.4h16.8v13.2H3.6zM7 15h6M14.6 15h2.4",
			music: "M9 17.6V5.8l10-2.6v11.6M6 17.6a3 3 0 1 0 6 0 3 3 0 0 0-6 0M16 14.8a3 3 0 1 0 6 0 3 3 0 0 0-6 0z",
			motion: "M3 16.4c2-8.4 4-8.4 6 0s4 8.4 6 0 4-8.4 6 0",
			sparkles: "M11.6 3.8 13.3 8 17.6 9.8 13.3 11.6 11.6 15.8 9.9 11.6 5.6 9.8 9.9 8zM18.4 15.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
			tag: "M4 4.6h6.6l9 9-6.6 6.6-9-9zM7.4 8.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
			search: "M10.6 17a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8M15.4 15.4 20 20",
			copy: "M8.6 8.6h10v10h-10zM5.4 15.4v-10h10",
			pause: "M8.6 5v14M15.4 5v14",
			pencil: "M4.6 19.4l.8-3.6L16.2 5a1.7 1.7 0 0 1 2.4 0l.4.4a1.7 1.7 0 0 1 0 2.4L8 18.6z",
			chevron: "M9.5 5.5 16 12l-6.5 6.5",
			undo: "M4 9h9.5a4.5 4.5 0 0 1 0 9H10M8 5 4 9l4 4",
			redo: "M20 9h-9.5a4.5 4.5 0 0 0 0 9H14M16 5l4 4-4 4",
			clipboard: "M9.5 4.5h5v2.2h-5zM7 6.2h10V20H7zM10.2 11h3.6M10.2 14.4h3.6"
		};
		/** 多元素图标（矩形/圆等无法用一个 `d` 表达的图形）。 */
		const SHAPES = {
			flow: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "3",
					y: "3",
					width: "7",
					height: "6",
					rx: "1.6"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "14",
					y: "15",
					width: "7",
					height: "6",
					rx: "1.6"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6.5 9v2.6a2 2 0 0 0 2 2h9" })
			] }),
			sliders: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 7h8M16 7h4M4 17h4M12 17h8" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "14",
					cy: "7",
					r: "2"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "10",
					cy: "17",
					r: "2"
				})
			] })
		};
		/**
		* 渲染一个图标。
		* @param props - 图标名、尺寸与附加类名。
		* @returns 内联 SVG（对辅助技术隐藏，颜色随文字）。
		*/
		function Icon({ name, size = 14, className }) {
			const d = STROKE[name];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: className === void 0 ? "iv-ico" : `iv-ico ${className}`,
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: d === void 0 ? SHAPES[name] : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d })
			});
		}
		/** 品牌标（填充三角，放在渐变底标里用）。 */
		function BrandMark({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "currentColor",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8.6 5.2 19 12 8.6 18.8z" })
			});
		}
		//#endregion
		//#region src/client/workbench-style.ts
		/**
		* 工作台设计系统 v3 —— 专业工具风（达芬奇/Premiere DNA）+ Harness 主题自适应。
		*
		* 客户端产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的 CSS 打包链，
		* 所以整张样式表内嵌成字符串，由 {@link useWorkbenchStyle} 挂载时注入一次
		* （与 `canvas-style.ts` 的 xyflow 官方样式同一机制）。
		*
		* 设计口径：
		* - **结构专业感**：左图标栏（模式导航）+ 顶栏 + 主区 + 底部状态栏的应用外壳；
		*   1px 发丝线分面板、平面无阴影、圆角收敛 5px、大写微型标签 + 等宽时间码。
		* - **颜色跟随 Harness 主题**（`R-NFR-3`）：所有面色/文字/边框先取 Harness 设计令牌
		*   （`--dsw-alias-*`），取不到退到与文字同源的中间色（`color-mix(currentColor …)`），
		*   浅色/深色都成立；**唯一例外是视频监视器恒深**（媒体惯例：NLE 的节目监视器
		*   在浅色界面里也是黑的，保证调色判断不受 UI 干扰）。
		* - 产物不烧入任何部署事实（服务商名、绝对路径）。
		*/
		/** 注入目标 <style> 的 id，保证重复挂载只注入一次。 */
		const WORKBENCH_STYLE_ID = "dsh-image-video-workbench-style";
		/**
		* 样式表版本戳。宿主页面在插件模块热替换/重载时不会卸载文档级 `<style>`，
		* 只要 id 相同就会留下**上一版**样式表；一旦 JSX 已更新、CSS 还是旧的，
		* 界面就会出现"新旧混排"（旧规则给新结构定位，标签和控件错行）。
		* 所以注入时不做"已存在就跳过"，而是比对版本戳、不一致就整表覆盖。
		*/
		const WORKBENCH_STYLE_VERSION = "2026-10-22.3";
		/** 整张工作台样式表（类名统一 `iv-` 前缀，作用域根为 `.iv`）。 */
		const WORKBENCH_STYLE = `
.iv{
  /* 面色必须**不透明**：浮层叠在内容上时，任何透明底都会把底下的文字透出来。
     Harness 的层级令牌是 bg-layer-1/2/3（不是 bg-l1/bg-l2，写错会静默退到
     "4% 叠色"这种近乎透明的兜底，浮层就变成毛玻璃看穿）。 */
  --iv-panel:var(--dsw-alias-bg-layer-1,color-mix(in srgb,currentColor 4%,transparent));
  /* 抬升面：在不透明底上叠一点文字色，浅色主题得到浅灰、深色主题得到浅一档的灰，
     两个主题都不再依赖"哪一档令牌在浅色主题里其实也是纯白"这种巧合。 */
  --iv-panel-2:color-mix(in srgb,var(--iv-panel) 94%,var(--iv-tx));
  --iv-panel-3:color-mix(in srgb,var(--iv-panel) 88%,var(--iv-tx));
  /* 浮动面（对话框/弹层）：比面板再高一点，且恒不透明。 */
  --iv-surface:color-mix(in srgb,var(--iv-panel) 96%,var(--iv-tx));
  --iv-line:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 13%,transparent));
  --iv-line-2:var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 22%,transparent));
  --iv-tx:var(--dsw-alias-label-primary,currentColor);
  --iv-tx2:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 76%,transparent));
  --iv-tx3:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 52%,transparent));
  /* 动作色：Harness 的 brand-primary 在两个主题下都是近中性色（浅色主题=近黑），
     那是它"主按钮=黑底白字"的极简口径；工作台要的是可辨识的蓝色动作色，
     所以取 Harness 为"彩色动作"准备的 info 令牌（浅色=#4176E6 / 深色=#7AAAFF），
     并按主题配前景色（浅色白字 / 深色黑字），保证对比度达标。 */
  --iv-acc:var(--dsw-alias-button-info-fill,#4176e6);
  --iv-acc-deep:var(--dsw-alias-button-info-hover,#3f57d6);
  --iv-on-acc:var(--dsw-alias-label-primary-foreground,#ffffff);
  /* 中性主按钮（黑底白字）单独留一个令牌，供"确认类"次要动作使用。 */
  --iv-solid:var(--dsw-alias-button-primary-fill,#1f1f1f);
  --iv-on-solid:var(--dsw-alias-label-primary-inverted,#ffffff);
  --iv-solid-hover:var(--dsw-alias-button-primary-hover,#3a3a3a);
  --iv-ok:var(--dsw-alias-state-success-primary,#2ba471);
  --iv-warn:var(--dsw-alias-state-warn-primary,#c07d00);
  --iv-danger:var(--dsw-alias-state-error-primary,#e5534b);
  --iv-acc-soft:color-mix(in srgb,var(--iv-acc) 11%,transparent);
  --iv-ok-soft:color-mix(in srgb,var(--iv-ok) 11%,transparent);
  --iv-warn-soft:color-mix(in srgb,var(--iv-warn) 11%,transparent);
  --iv-danger-soft:color-mix(in srgb,var(--iv-danger) 10%,transparent);
  --iv-monitor:#0a0b0d;
  --iv-r:5px;
  --iv-mono:var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  display:flex;flex-direction:column;height:100%;box-sizing:border-box;overflow:hidden;
  font:inherit;color:var(--iv-tx);font-size:12px;line-height:1.5;
}
.iv *,.iv *::before,.iv *::after{box-sizing:border-box}
.iv p{margin:0}.iv h3{margin:0}.iv ul{margin:0;padding:0;list-style:none}
.iv ::-webkit-scrollbar{width:8px;height:8px}
.iv ::-webkit-scrollbar-thumb{background:color-mix(in srgb,currentColor 22%,transparent);border-radius:4px;border:2px solid transparent;background-clip:content-box}
.iv ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,currentColor 34%,transparent);background-clip:content-box}
.iv ::-webkit-scrollbar-track{background:transparent}
.iv ::selection{background:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv :focus-visible{outline:none;box-shadow:0 0 0 2px var(--iv-panel-2,#fff),0 0 0 4px color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-ico{flex:none;display:block}
.iv-mono{font-family:var(--iv-mono);font-variant-numeric:tabular-nums}
.iv-micro{font-size:9.5px;font-weight:700;letter-spacing:.11em;color:var(--iv-tx3);text-transform:uppercase;white-space:nowrap}
.iv-meta{font-size:11px;color:var(--iv-tx3)}
.iv-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* ============ 应用外壳：顶栏 ============ */
.iv-top{display:flex;flex-wrap:wrap;align-items:center;gap:7px 10px;padding:7px 10px;
  background:var(--iv-panel);border-bottom:1px solid var(--iv-line);flex:none}
.iv-brand{display:flex;align-items:center;gap:8px;min-width:0}
.iv-mark{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;color:var(--iv-on-acc);
  background:linear-gradient(135deg,var(--iv-acc),var(--iv-acc-deep))}
.iv-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.iv-brand-name{font-size:12.5px;font-weight:650;letter-spacing:.01em;white-space:nowrap}
.iv-brand-sub{font-size:9px;font-weight:600;letter-spacing:.11em;color:var(--iv-tx3);white-space:nowrap;text-transform:uppercase}
.iv-top-sep{width:1px;height:18px;background:var(--iv-line-2);flex:none}
.iv-proj{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.iv-newform{display:flex;align-items:center;gap:5px}
.iv-newform .iv-input{width:108px}
.iv-top-meta{margin-left:auto;display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-rename{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--iv-panel);
  border-bottom:1px solid var(--iv-line);flex:none;color:var(--iv-tx3)}
.iv-rename .iv-input{flex:1;min-width:140px;max-width:340px;color:var(--iv-tx)}
/* 改名行：输入框与两个按钮统一 26px 高，视觉上是一条齐平的编辑带 */
.iv-rename .iv-btn{height:26px;padding:0 11px;font-size:11px}
.iv-rename .iv-btn--acc{min-width:52px}

/* ============ 应用外壳：左图标栏 + 主区 ============ */
.iv-body{display:grid;grid-template-columns:42px minmax(0,1fr);flex:1;min-height:0}
.iv-rail{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0;
  background:var(--iv-panel);border-right:1px solid var(--iv-line)}
.iv-rail-btn{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--iv-r);
  border:1px solid transparent;background:transparent;color:var(--iv-tx3);cursor:pointer;position:relative}
.iv-rail-btn:hover{background:var(--iv-panel-3);color:var(--iv-tx2)}
/* 快捷入口（素材/任务/默认值）按下即反馈：即使目标已在视口内，也看得出"点到了" */
.iv-rail-btn:active{transform:scale(.93);color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-rail-btn:active .iv-rail-tip{opacity:1}
.iv-rail-btn.on{background:var(--iv-panel-3);color:var(--iv-acc)}
.iv-rail-btn.on::before{content:"";position:absolute;left:-7px;top:6px;bottom:6px;width:2px;
  border-radius:2px;background:var(--iv-acc)}
.iv-rail-tip{position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;z-index:40;
  background:var(--iv-panel-3);border:1px solid var(--iv-line-2);border-radius:4px;padding:2px 8px;
  font-size:10.5px;color:var(--iv-tx);opacity:0;pointer-events:none;transition:opacity .12s}
.iv-rail-btn:hover .iv-rail-tip{opacity:1}
.iv-rail-sep{width:16px;border-top:1px solid var(--iv-line);margin:4px 0;flex:none}
.iv-rail-bottom{margin-top:auto}
.iv-main{min-width:0;overflow:auto;display:flex;flex-direction:column}

/* ============ 应用外壳：状态栏 ============ */
.iv-status{display:flex;align-items:center;gap:12px;height:23px;padding:0 10px;flex:none;
  background:var(--iv-panel);border-top:1px solid var(--iv-line);font-size:10px;color:var(--iv-tx3)}
.iv-status b{color:var(--iv-tx2);font-weight:600}
.iv-status .dot{width:6px;height:6px;border-radius:50%;background:var(--iv-ok);flex:none}
.iv-status-right{margin-left:auto;display:flex;gap:12px;align-items:center}

/* ============ 控件 ============ */
.iv-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:23px;padding:0 9px;
  border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);
  font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease}
.iv-btn:hover:not(:disabled){border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-btn:disabled{opacity:.42;cursor:not-allowed}
.iv-btn--acc{background:var(--iv-acc);border-color:transparent;color:var(--iv-on-acc);font-weight:600;
  box-shadow:0 1px 2px color-mix(in srgb,var(--iv-acc) 40%,transparent)}
.iv-btn--acc:hover:not(:disabled){background:var(--iv-acc-deep);color:var(--iv-on-acc);border-color:transparent;
  box-shadow:0 2px 6px color-mix(in srgb,var(--iv-acc) 45%,transparent)}
.iv-btn--acc:active:not(:disabled){box-shadow:none}
.iv-btn--acc:disabled{background:color-mix(in srgb,var(--iv-acc) 16%,transparent);box-shadow:none;
  color:color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-btn--danger{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 45%,transparent);background:var(--iv-danger-soft)}
.iv-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--iv-danger) 16%,transparent);border-color:var(--iv-danger);color:var(--iv-danger)}
.iv-btn--ghost{background:transparent;border-color:transparent;color:var(--iv-tx3)}
.iv-btn--ghost:hover:not(:disabled){background:var(--iv-panel-3);color:var(--iv-tx)}
.iv-btn--icon{width:23px;padding:0}
.iv-btn--sm{height:20px;padding:0 7px;font-size:10.5px;gap:4px}
.iv-btn--sm.iv-btn--icon{width:20px;padding:0}
.iv-input,.iv-select{height:23px;min-width:0;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);
  background:var(--iv-panel-2);color:var(--iv-tx);font:inherit;font-size:11px;padding:0 8px;
  transition:border-color .12s ease}
.iv-input::placeholder{color:var(--iv-tx3)}
.iv-input:hover,.iv-select:hover{border-color:color-mix(in srgb,currentColor 35%,transparent)}
.iv-input:focus,.iv-select:focus{outline:none;border-color:var(--iv-acc)}
.iv-select{appearance:none;-webkit-appearance:none;padding-right:22px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M1 1l3 3 3-3' fill='none' stroke='%238e96a3' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 7px center}
.iv-textarea{min-height:42px;height:auto;padding:5px 8px;line-height:1.45;resize:vertical}
.iv-select--sm{height:20px;padding:0 18px 0 6px;font-size:10.5px}
.iv-toolbar--export .iv-field{grid-template-columns:auto minmax(56px,72px);gap:4px}
.iv-toolbar--export .iv-field-label{font-size:10px}
.iv-check{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--iv-tx2);cursor:pointer;user-select:none;white-space:nowrap}
.iv-check input{accent-color:var(--iv-acc);width:12px;height:12px;margin:0}
.iv-scrub{flex:1;height:14px;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;min-width:60px}
.iv-scrub::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--iv-panel-3)}
.iv-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:-4px;border-radius:50%;
  background:var(--iv-warn);border:2px solid var(--iv-panel)}
.iv-color{width:24px;height:20px;padding:0;border:1px solid var(--iv-line-2);border-radius:4px;background:var(--iv-panel-2);cursor:pointer}

/* ============ 徽章 ============ */
.iv-chip{display:inline-flex;align-items:center;gap:5px;height:19px;padding:0 8px;border-radius:999px;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:10.5px;color:var(--iv-tx2);white-space:nowrap}
.iv-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.iv-chip--ok{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 35%,transparent);background:var(--iv-ok-soft)}
.iv-chip--warn{color:var(--iv-warn);border-color:color-mix(in srgb,var(--iv-warn) 35%,transparent);background:var(--iv-warn-soft)}
.iv-chip--err{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent);background:var(--iv-danger-soft)}
.iv-chip--run{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 35%,transparent);background:var(--iv-acc-soft)}
.iv-chip--run .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
@keyframes iv-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.iv-chip--run .iv-dot{animation:none}.iv-btn,.iv-row,.iv-clip{transition:none}}
.iv-badge{display:inline-flex;align-items:center;gap:4px;padding:0 7px;height:17px;border-radius:999px;
  border:1px solid var(--iv-line);background:var(--iv-panel-2);font-size:9.5px;color:var(--iv-tx3);white-space:nowrap}
.iv-notice{display:flex;align-items:flex-start;gap:8px;padding:7px 11px;border-radius:var(--iv-r);
  font-size:11.5px;border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2);flex:none}
.iv-notice--error{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent)}
.iv-notice .iv-ico{margin-top:2px}

/* ============ 默认值摘要条 + 弹层 ============ */
/* 摘要条同时是弹层的定位容器：这样弹层宽度按**栏宽**算，窄侧栏里也不会溢出/被裁。 */
.iv-defaults{position:relative;container:iv-defaults/inline-size;
  display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;padding:5px 10px;flex:none;
  border-bottom:1px solid var(--iv-line);background:var(--iv-panel);font-size:10.5px;color:var(--iv-tx2)}
.iv-def{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}
.iv-def i{font-style:normal;color:var(--iv-tx3)}
.iv-def b{font-weight:600;color:var(--iv-tx);font-variant-numeric:tabular-nums}
.iv-def+.iv-def::before{content:"";width:1px;height:9px;background:var(--iv-line-2);margin-right:10px;align-self:center}
/* 触发按钮本身不建定位上下文：弹层挂到摘要条上，位置只跟栏宽有关 */
.iv-pop{display:inline-flex}
.iv-pop-panel{position:absolute;top:calc(100% + 6px);right:0;left:auto;z-index:60;
  width:min(560px,100%);max-height:min(64vh,440px);overflow:auto;overscroll-behavior:contain;padding:0;
  scroll-padding:8px 0 54px;
  border-radius:10px;border:1px solid var(--iv-line-2);background:var(--iv-surface);
  box-shadow:0 18px 46px color-mix(in srgb,#000 30%,transparent),0 2px 8px color-mix(in srgb,#000 16%,transparent)}
/* 弹层头部：标题 + 一行说明，给对话框一个明确的"这是什么" */
.iv-pop-head{display:flex;align-items:flex-start;gap:9px;padding:9px 14px 8px;
  border-bottom:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:10px 10px 0 0;position:sticky;top:0;z-index:2}
.iv-pop-head .iv-ico{color:var(--iv-acc);margin-top:1px}
.iv-pop-head-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.iv-pop-head-title{font-size:12.5px;font-weight:650;color:var(--iv-tx);line-height:1.35}
.iv-pop-head-sub{font-size:10.5px;color:var(--iv-tx3);line-height:1.45}
/* 分组：媒体类型 / 图像 / 视频，每组一个微型标题 + 两列表单（窄栏自动落成一列） */
.iv-pop-group{padding:8px 14px 9px}
.iv-pop-group+.iv-pop-group{border-top:1px solid var(--iv-line)}
.iv-pop-group-title{display:block;margin-bottom:7px}
.iv-pop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
/* 只有一个字段的分组（如"媒体类型"）不占半栏留白，整行铺满，读起来才像一段设置 */
.iv-pop-grid:not(:has(>label+label)){grid-template-columns:minmax(0,1fr)}
.iv-pop-grid label{display:flex;flex-direction:column;gap:3px;font-size:10.5px;color:var(--iv-tx3);min-width:0}
.iv-pop-grid label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-pop-grid .iv-select{width:100%;min-width:0;height:24px;font-size:11px;background:var(--iv-surface)}
/* 底部动作区：提示在左、按钮在右；吸底且不透明，滚动时字段不会从按钮缝里透出来 */
.iv-pop-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 14px;
  border-top:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:0 0 10px 10px;position:sticky;bottom:0;z-index:2}
.iv-pop-foot .iv-meta{margin-right:auto;font-size:10.5px;line-height:1.4;max-width:240px}
.iv-pop-foot .iv-btn{height:26px;padding:0 13px;font-size:11px}
/* 栏宽不足 360px 时两列会挤成"标签一列、控件一列"的错位错觉，直接落成一列 */
@container iv-defaults (max-width:360px){.iv-pop-grid{grid-template-columns:minmax(0,1fr)}}

/* ============ 面板 ============ */
.iv-page{display:flex;flex-direction:column;gap:10px;padding:10px;flex:none}
.iv-dock{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:10px;padding:0 10px 10px;align-items:start}
.iv-pane{display:flex;flex-direction:column;gap:8px;min-width:0;border:1px solid var(--iv-line);
  border-radius:6px;background:var(--iv-panel);padding:9px 11px;scroll-margin:10px}
/* 左栏快捷入口点击后的确认高亮：一次性脉冲，避免"点了没反应"的错觉 */
.iv-pane--flash{animation:iv-pane-flash 1.5s ease-out}
@keyframes iv-pane-flash{
  0%{border-color:var(--iv-acc);background:var(--iv-acc-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 18%,transparent)}
  100%{border-color:var(--iv-line);background:var(--iv-panel);box-shadow:0 0 0 0 transparent}
}
@media (prefers-reduced-motion:reduce){.iv-pane--flash{animation:none;border-color:var(--iv-acc)}}
.iv-pane-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.iv-pane-tile{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 24%,transparent)}
.iv-pane-title{margin:0;display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;letter-spacing:.01em}
.iv-pane-actions{margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.iv-pane-body{display:flex;flex-direction:column;gap:8px;min-width:0}
.iv-pane img,.iv-pane video{width:100%;border-radius:4px;display:block;background:var(--iv-monitor)}
.iv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-count{margin-left:auto;font-size:10.5px;color:var(--iv-tx3);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-progress{height:3px;border-radius:2px;background:var(--iv-panel-3);overflow:hidden;min-width:70px;flex:1}
.iv-progress>i{display:block;height:100%;border-radius:2px;background:var(--iv-acc);transition:width .3s ease}
.iv-progress--ok>i{background:var(--iv-ok)}
.iv-progress--err>i{background:var(--iv-danger)}
/* F3：生成没有百分比——不定进度条（色带往返），配"生成中 · 12s"文案 */
.iv-progress--run>i{width:38%;animation:iv-progress-run 1.15s ease-in-out infinite}
@keyframes iv-progress-run{0%{margin-left:-38%}100%{margin-left:100%}}
.iv-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-add-row .iv-select{flex:1;min-width:110px}

/* ============ G2 物料库分栏 ============ */
.iv-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.iv-tab{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:var(--iv-r);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);font-size:10.5px;cursor:pointer}
.iv-tab:hover{color:var(--iv-tx);border-color:color-mix(in srgb,currentColor 35%,transparent)}
.iv-tab .iv-ico{color:var(--iv-tx3)}
.iv-tab.on{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);background:var(--iv-acc-soft)}
.iv-tab.on .iv-ico{color:var(--iv-acc)}
.iv-tabs .iv-select{width:auto;min-width:64px}

/* ============ 列表 ============ */
.iv-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0}
.iv-row{display:flex;align-items:center;gap:9px;padding:5px 6px;border-radius:var(--iv-r);
  border:1px solid transparent;font-size:12.5px;cursor:pointer;transition:background .1s ease}
.iv-row:hover{background:var(--iv-panel-2)}
.iv-row[data-active=true]{background:var(--iv-acc-soft);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv-row-main{flex:1;min-width:0;display:flex;align-items:center;gap:7px}
.iv-row-btn{flex:1;min-width:0;display:flex;align-items:center;gap:7px;border:0;background:transparent;
  color:inherit;font:inherit;font-size:11.5px;text-align:left;cursor:pointer;padding:0}
.iv-row-btn:disabled{cursor:default}
.iv-row-actions{display:flex;align-items:center;gap:4px;flex:none}
.iv-tile{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;flex:none;
  border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2)}
.iv-tile--image{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent);background:var(--iv-acc-soft)}
.iv-tile--video{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 30%,transparent);background:var(--iv-ok-soft)}
.iv-thumb{width:64px;height:44px;border-radius:3px;object-fit:cover;flex:none;background:var(--iv-monitor);
  border:1px solid var(--iv-line-2)}
.iv-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 10px;text-align:center;
  color:var(--iv-tx3);font-size:11.5px}
.iv-empty-tile{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;
  background:var(--iv-panel-2);border:1px solid var(--iv-line);color:var(--iv-tx3)}
.iv-empty strong{color:var(--iv-tx2);font-size:11.5px;font-weight:600}

/* ============ 快速创作 Hero ============ */
.iv-hero{display:flex;flex-direction:column;gap:11px}
.iv-hero-top{display:flex;align-items:center;gap:11px}
.iv-hero-ico{width:36px;height:36px;border-radius:6px;display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 26%,transparent)}
.iv-hero-title{font-size:13.5px;font-weight:650;letter-spacing:.01em}
.iv-hero-text{font-size:11.5px;color:var(--iv-tx2);max-width:70ch}
.iv-steps{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-step{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 3px;border-radius:999px;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:10.5px;color:var(--iv-tx2);white-space:nowrap}
.iv-step-n{width:15px;height:15px;border-radius:50%;display:grid;place-items:center;flex:none;
  font-size:8.5px;font-weight:700;color:var(--iv-on-acc);background:var(--iv-acc)}
.iv-step-arrow{color:var(--iv-tx3);flex:none}
.iv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.iv-stat{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);padding:6px 9px}
.iv-stat b{display:block;font-size:16px;font-weight:650;line-height:1.2;font-variant-numeric:tabular-nums}
.iv-stat span{font-size:9px;letter-spacing:.06em;color:var(--iv-tx3)}

/* ============ F2 多参考图 chips ============ */
.iv-refs{display:grid;gap:5px}
.iv-ref-list{display:flex;flex-wrap:wrap;gap:4px}
.iv-ref-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 3px 0 0;max-width:100%;
  border:1px solid var(--iv-line-2);border-radius:var(--iv-r);background:var(--iv-panel-2);font-size:10.5px;cursor:grab}
.iv-ref-chip[data-ref-drop=true]{border-color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-ref-chip .iv-ellipsis{max-width:120px}
.iv-ref-order{width:17px;align-self:stretch;display:grid;place-items:center;border-radius:var(--iv-r) 0 0 var(--iv-r);
  background:var(--iv-panel-3);color:var(--iv-tx2);font-family:var(--iv-mono);font-size:9.5px}
.iv-ref-role{font-size:9px;font-weight:600;letter-spacing:.06em;color:var(--iv-tx3);text-transform:uppercase}
.iv-ref-chip .iv-btn{width:18px;height:18px;padding:0;border-color:transparent;background:transparent;color:var(--iv-tx3)}
.iv-ref-chip .iv-btn:hover:not(:disabled){color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-ref-move--up .iv-ico{transform:rotate(-90deg)}
.iv-ref-move--down .iv-ico{transform:rotate(90deg)}

/* ============ F3 生成进度 ============ */
.iv-genprog{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* ============ G4 视频槽（尾帧/参考视频/真人） ============ */
.iv-vslots{display:grid;gap:5px;padding:7px 9px;border:1px dashed var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2)}

/* ============ B-7 素材批量操作条 ============ */
.iv-bulk{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 8px;border:1px solid var(--iv-line-2);
  border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-row-check{flex:none;margin-right:2px}

/* ============ B-8 资源多参考图 ============ */
.iv-thumb-wrap{position:relative;flex:none;line-height:0}
.iv-thumb-more{position:absolute;right:2px;bottom:2px;padding:0 3px;border-radius:3px;background:var(--iv-monitor);
  color:#cfd3d8;font-family:var(--iv-mono);font-size:8.5px;line-height:1.4}
.iv-refs-editor{display:grid;gap:6px;padding:7px 9px;border:1px solid var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2)}

/* ============ 时间轴：监视器 / transport / 轨道 ============ */
.iv-monitor{position:relative;min-height:168px;border-radius:4px;overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(130% 130% at 50% 0%,#1c1f27 0%,var(--iv-monitor) 72%);
  border:1px solid var(--iv-line-2);box-shadow:inset 0 1px 6px color-mix(in srgb,#000 45%,transparent)}
.iv-monitor img,.iv-monitor video{max-width:100%;max-height:200px;display:block}
.iv-mon-tc{position:absolute;left:8px;top:7px;font-family:var(--iv-mono);font-size:10px;color:#cfd3d8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 14%,transparent);
  border-radius:3px;padding:1px 6px;font-variant-numeric:tabular-nums}
.iv-mon-badge{position:absolute;right:8px;top:7px;font-size:8.5px;font-weight:600;letter-spacing:.1em;color:#9aa0a8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 12%,transparent);
  border-radius:3px;padding:2px 6px;text-transform:uppercase}
.iv-mon-sub{position:absolute;left:0;right:0;bottom:9px;padding:0 10px;text-align:center;pointer-events:none;
  color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.7)}
.iv-transport{display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid var(--iv-line);
  border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-tp-btn{width:24px;height:24px;display:grid;place-items:center;border-radius:var(--iv-r);flex:none;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);cursor:pointer}
.iv-tp-btn:hover{color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-tp-btn--play{color:var(--iv-on-acc);background:var(--iv-acc);border-color:transparent}
.iv-tp-btn--play:hover{background:var(--iv-acc-deep);color:var(--iv-on-acc)}
.iv-tc-now{font-family:var(--iv-mono);font-size:11.5px;color:var(--iv-tx);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-tc-total{font-family:var(--iv-mono);font-size:10px;color:var(--iv-tx3);white-space:nowrap}
.iv-zoom{display:flex;align-items:center;gap:5px;margin-left:auto;font-size:10px;color:var(--iv-tx3);white-space:nowrap}
.iv-zoom .iv-scrub{max-width:64px;flex:none}
.iv-tl{position:relative;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);overflow:hidden}
.iv-ruler{position:relative;height:16px;margin-left:46px;border-bottom:1px solid var(--iv-line-2);
  background:var(--iv-panel-3)}
.iv-ruler i{position:absolute;top:0;bottom:0;width:1px;background:var(--iv-line-2)}
.iv-ruler b{position:absolute;top:2px;font-family:var(--iv-mono);font-size:8px;font-weight:500;color:var(--iv-tx3);
  transform:translateX(-50%);font-variant-numeric:tabular-nums}
.iv-tracks{position:relative}
.iv-track{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:stretch;border-bottom:1px solid var(--iv-line)}
.iv-track:last-child{border-bottom:0}
.iv-t-head{display:flex;flex-direction:column;justify-content:center;gap:0;padding:5px 0 5px 8px;
  border-right:1px solid var(--iv-line);background:var(--iv-panel-3)}
.iv-t-head .micro{font-size:9px}
.iv-t-kind{font-size:8.5px;color:var(--iv-tx3)}
.iv-t-lane{position:relative;padding:4px 8px;display:flex;flex-direction:column;gap:5px;min-height:40px}
/* B5：片段按**时间**绝对定位（left=起点比例、width=时长比例），拖拽/手柄才有"落点即时间" */
.iv-clips{position:relative;display:block;height:58px}
.iv-clip{display:flex;flex-direction:column;gap:3px;min-width:16px;flex-basis:auto;min-height:34px;
  padding:3px 7px 3px 9px;border-radius:3px;border:1px solid var(--iv-line-2);background:var(--iv-panel);
  font-size:10.5px;position:absolute;top:0;bottom:0;overflow:hidden;cursor:grab}
.iv-clip:active{cursor:grabbing}
.iv-clip--sel{border-color:var(--iv-acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-acc) 30%,transparent)}
/* B5：左右手柄改起点/时长 */
.iv-clip-h{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:2;border:0;background:transparent;padding:0}
.iv-clip-h--l{left:0}
.iv-clip-h--r{right:0}
.iv-clip-h::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:2px;height:16px;border-radius:1px;background:color-mix(in srgb,currentColor 42%,transparent)}
.iv-clip-h:hover::after{background:var(--iv-acc);width:3px}
/* B5：放置落点高亮 */
.iv-t-lane--drop{background:var(--iv-acc-soft);outline:1px dashed var(--iv-acc);outline-offset:-2px}
.iv-clip::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
.iv-clip--video{border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-acc-soft),transparent 46%),var(--iv-panel)}
.iv-clip--video::before{background:var(--iv-acc)}
.iv-clip--audio{border-color:color-mix(in srgb,var(--iv-ok) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-ok-soft),transparent 46%),var(--iv-panel)}
.iv-clip--audio::before{background:var(--iv-ok)}
.iv-clip--subtitle{border-color:color-mix(in srgb,var(--iv-warn) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-warn-soft),transparent 46%),var(--iv-panel)}
.iv-clip--subtitle::before{background:var(--iv-warn)}
.iv-clip-top{display:flex;align-items:center;gap:5px;min-width:0}
.iv-clip-top .iv-ico{color:var(--iv-tx3)}
.iv-clip-dur{margin-left:auto;font-family:var(--iv-mono);font-size:9px;color:var(--iv-tx3);white-space:nowrap;font-variant-numeric:tabular-nums}
.iv-clip-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.iv-clip .iv-input{height:18px;font-size:10px;width:56px;padding:0 4px}
.iv-clip .iv-select{height:18px;font-size:10px;width:74px;padding:0 16px 0 5px}
.iv-clip .iv-color{width:22px;height:18px}
.iv-clip .iv-btn{height:18px;width:18px;padding:0;border-color:transparent;background:transparent;color:var(--iv-tx3);margin-left:auto}
.iv-clip .iv-btn:hover:not(:disabled){color:var(--iv-danger);background:var(--iv-danger-soft)}
.iv-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--iv-warn);z-index:5;pointer-events:none}
.iv-playhead::before{content:"";position:absolute;top:0;left:-4px;border:5px solid transparent;border-top:6px solid var(--iv-warn)}

/* ============ 工作流画布 ============ */
.iv-pal{display:flex;flex-wrap:wrap;gap:4px}
.iv-pal-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:var(--iv-r);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);font:inherit;font-size:10.5px;
  cursor:pointer;white-space:nowrap;transition:background .1s ease,color .1s ease}
.iv-pal-chip:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-pal-chip .iv-ico{color:var(--iv-acc)}
.iv-pal-chip[data-availability=planned]{border-style:dashed;opacity:.68}
.iv-pal-chip[data-availability=planned] .iv-ico{color:var(--iv-tx3)}
.iv-pal-sep{width:100%;border-top:1px dashed var(--iv-line-2);margin:2px 0}
.iv-canvas-main{display:flex;flex-direction:column;gap:7px;min-width:0}
.iv-flow{height:250px;border:1px solid var(--iv-line);border-radius:var(--iv-r);overflow:hidden;background:var(--iv-panel-2)}
.iv-issues{display:grid;gap:3px;font-size:10.5px;border-radius:var(--iv-r);padding:6px 9px;border:1px solid var(--iv-line)}
.iv-issues strong{font-size:10.5px;font-weight:700;letter-spacing:.06em;opacity:.9;display:inline-flex;align-items:center;gap:5px;text-transform:uppercase}
.iv-issues[data-ok=true]{color:var(--iv-ok);background:var(--iv-ok-soft);border-color:color-mix(in srgb,var(--iv-ok) 28%,transparent)}
.iv-issues[data-ok=false]{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 28%,transparent)}
.iv-issues span{display:inline-flex;align-items:center;gap:5px}
.iv-run{display:grid;gap:5px;font-size:10.5px;border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:6px 9px;background:var(--iv-panel-2)}
.iv-run-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-run-head strong{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--iv-tx3);text-transform:uppercase}
.iv-run-history{display:flex;flex-wrap:wrap;gap:4px}
.iv-run-item{border:1px solid var(--iv-line-2);background:var(--iv-panel);color:var(--iv-tx2);border-radius:999px;
  font:inherit;font-size:10px;padding:1px 8px;cursor:pointer;white-space:nowrap}
.iv-run-item:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-run-item[data-active=true]{border-color:var(--iv-acc);color:var(--iv-tx);background:var(--iv-acc-soft)}
.iv-run-nodes{display:grid;gap:2px}
.iv-node-run{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--iv-tx2)}
.iv-node-run .iv-dot{width:5px;height:5px}
.iv-node-run[data-status=succeeded] .iv-dot{color:var(--iv-ok)}
.iv-node-run[data-status=failed] .iv-dot{color:var(--iv-danger)}
.iv-node-run[data-status=running] .iv-dot{color:var(--iv-acc);animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run[data-status=cancelled] .iv-dot,.iv-node-run[data-status=skipped] .iv-dot{color:var(--iv-tx3)}
.iv-run-actions{display:flex;flex-wrap:wrap;gap:5px}
/* ============ B-6 模板市场（分组卡片） ============ */
.iv-tpl{display:grid;gap:10px}
.iv-tpl-group{display:grid;gap:5px}
.iv-tpl-group-title{display:block}
.iv-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.iv-tpl-card{display:grid;gap:3px;padding:8px 10px;text-align:left;border:1px solid var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2);color:var(--iv-tx2);cursor:pointer;transition:border-color .1s ease,background .1s ease}
.iv-tpl-card:hover{border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);background:var(--iv-acc-soft);color:var(--iv-tx)}
.iv-tpl-card .iv-ico{color:var(--iv-acc)}
.iv-tpl-name{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--iv-tx)}
.iv-tpl-desc{font-size:10px;line-height:1.45;color:var(--iv-tx3)}
.iv-inspector{display:grid;gap:5px;border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:7px 9px;background:var(--iv-panel-2)}
.iv-inspector-head{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;
  color:var(--iv-tx3);text-transform:uppercase}
.iv-field{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px;align-items:center;font-size:11px}
.iv-field>span{color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-field .iv-input,.iv-field .iv-select{height:21px;font-size:11px}
.iv-field textarea.iv-input{height:auto}

/* ---- xyflow 节点卡片（画布内） ---- */
.iv-node{position:relative;min-width:148px;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel);
  color:var(--iv-tx);font-size:11px}
.iv-node[data-workflow-node-selected=true]{border-color:var(--iv-acc);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 20%,transparent)}
.iv-node[data-availability=planned]{border-style:dashed}
.iv-node[data-invalid=true]{border-color:var(--iv-danger)}
.iv-node-head{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--iv-panel-3);
  border-bottom:1px solid var(--iv-line);font-weight:600;min-width:0}
.iv-node-head .iv-ico{color:var(--iv-acc)}
.iv-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.iv-node-planned{margin-left:auto;display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:500;
  color:var(--iv-tx3);white-space:nowrap}
.iv-node-body{padding:5px 8px;display:grid;gap:2px;font-size:10px;color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis}
/* B4：节点运行状态徽章（卡片右上角的小圆点） */
.iv-node-run{margin-left:auto;display:grid;place-items:center;flex:none}
.iv-node-planned+.iv-node-run{margin-left:4px}
.iv-node-run .iv-dot{width:7px;height:7px}
.iv-node-run--running{color:var(--iv-acc)}
.iv-node-run--running .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run--succeeded{color:var(--iv-ok)}
.iv-node-run--failed{color:var(--iv-danger)}
.iv-node-run--cancelled,.iv-node-run--skipped{color:var(--iv-tx3)}
@media (prefers-reduced-motion:reduce){.iv-node-run--running .iv-dot{animation:none}}
/* B4：失败节点的错误开关 + 气泡（气泡要能溢出卡片，故卡片本身不裁切） */
.iv-node-err{margin-left:2px;width:16px;height:16px;display:grid;place-items:center;flex:none;padding:0;
  border:0;border-radius:3px;background:var(--iv-danger-soft);color:var(--iv-danger);cursor:pointer}
.iv-node-err:hover{background:color-mix(in srgb,var(--iv-danger) 22%,transparent)}
.iv-node-bubble{position:absolute;left:8px;right:8px;top:calc(100% + 5px);z-index:40;
  background:var(--iv-surface);border:1px solid color-mix(in srgb,var(--iv-danger) 45%,transparent);
  border-radius:5px;padding:5px 8px;font-size:10px;line-height:1.45;color:var(--iv-danger);
  box-shadow:0 8px 20px color-mix(in srgb,#000 30%,transparent);white-space:pre-wrap;word-break:break-all}
/* B4：画布工具栏分组分隔 */
.iv-toolbar-sep{width:1px;height:15px;background:var(--iv-line-2);flex:none;margin:0 3px}

/* ---- xyflow 主题覆盖（特异性高于官方样式表） ---- */
.iv-flow .react-flow{--xy-edge-stroke-default:var(--iv-line-2,#555);--xy-connectionline-stroke-default:var(--iv-acc,#4d6bfe);
  --xy-edge-stroke-selected-default:var(--iv-acc,#4d6bfe);--xy-background-pattern-dots-color-default:var(--iv-line-2,#555);
  --xy-controls-button-background-color-default:var(--iv-panel,#fefefe);
  --xy-controls-button-background-color-hover-default:var(--iv-panel-3,#f4f4f4);
  --xy-controls-button-color-default:var(--iv-tx2,inherit);
  --xy-controls-button-border-color-default:var(--iv-line,#eee)}
.iv-flow .react-flow .react-flow__handle{width:9px;height:9px;background:var(--iv-acc,#4d6bfe);
  border:2px solid var(--iv-panel,#fff)}
.iv-flow .react-flow__controls{box-shadow:0 8px 24px color-mix(in srgb,#000 30%,transparent);
  border-radius:var(--iv-r);overflow:hidden;border:1px solid var(--iv-line)}
.iv-flow .react-flow__attribution{background:transparent;color:var(--iv-tx3)}
.iv-flow .react-flow__attribution a{color:var(--iv-tx3)}
/* B7：窄窗（<768px）紧凑排版——右侧空间不足时缩小间距/字号，停靠区强制单列可滚，隐藏轨道文字（用悬浮提示代替） */
@media (max-width:768px){
.iv{padding:6px;font-size:11px}
.iv-top{padding:6px 8px;gap:6px}
.iv-rail{width:42px}
.iv-rail-txt{display:none}
.iv-dock{grid-template-columns:1fr;max-height:44vh;overflow:auto}
.iv-pane-head{padding:6px 8px}
.iv-hero{padding:10px}
.iv-steps{flex-wrap:wrap}
.iv-toolbar{flex-wrap:wrap}
}
/* B-9 融合生图 / B-10 提示词工坊 */
.iv-fusion,.iv-prompt-studio{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface)}
.iv-fusion-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between}
.iv-fusion-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-prompt-lib{display:flex;flex-direction:column;gap:4px}
.iv-prompt-row{display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid var(--iv-line)}
.iv-prompt-row .iv-ellipsis{flex:1;min-width:0}
/* B-11 素材库体检 */
.iv-health{display:flex;flex-direction:column;gap:6px;min-height:0}
.iv-health-tabs{flex:none}
.iv-health-body{display:flex;flex-direction:column;gap:4px;min-height:0;overflow:auto}
.iv-size-list,.iv-dupes-list,.iv-stats-list{display:flex;flex-direction:column;gap:3px;min-height:0;overflow:auto}
.iv-size-summary{flex:none}
.iv-size-row,.iv-stats-row{display:flex;align-items:center;gap:6px;padding:2px 0;border-top:1px solid var(--iv-line)}
.iv-size-row:first-of-type,.iv-stats-row:first-of-type{border-top:0}
.iv-size-name{flex:1;min-width:0}
.iv-size-bytes{flex:none;font-family:var(--iv-mono);font-size:10px;color:var(--iv-tx3)}
.iv-dupes-group{display:flex;flex-direction:column;gap:2px;padding:4px 0;border-top:1px solid var(--iv-line)}
.iv-dupes-group-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-dupes-item{display:flex;align-items:center;gap:6px;padding:1px 0 1px 10px;font-size:11px;color:var(--iv-tx2)}
.iv-dupes-item.keep{color:var(--iv-tx)}
.iv-stats-row{flex-direction:column;align-items:flex-start;gap:1px}
.iv-stats-name{max-width:100%;font-size:11px}
.iv-stats-facts{display:flex;gap:8px;flex-wrap:wrap;font-size:10px}
/* B-13 时间轴逐段预览 */
.iv-seg-wrap{flex-wrap:wrap}
.iv-seg-preview{display:flex;flex-direction:column;gap:6px;width:100%;min-width:0}
.iv-seg-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-seg-video{width:100%;max-height:150px;border-radius:var(--iv-r);background:var(--iv-monitor)}
.iv-seg-bar{display:flex;gap:2px;width:100%;min-width:0}
.iv-seg-cell{flex:1 1 0;min-width:6px;height:16px;padding:0;border:1px solid var(--iv-line);border-radius:2px;
background:var(--iv-panel-3);cursor:pointer}
.iv-seg-cell.on{border-color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-seg-cell:focus-visible{outline:2px solid var(--iv-acc);outline-offset:1px}
`;
		/**
		* 注入工作台样式表（只注入一次；模块加载器不处理 CSS 文件）。
		* 与 `canvas-style.ts` 同机制：同一 <style> id 幂等。
		*/
		function useWorkbenchStyle() {
			(0, react.useEffect)(() => {
				const existing = document.getElementById(WORKBENCH_STYLE_ID);
				const style = existing instanceof HTMLStyleElement ? existing : document.createElement("style");
				if (existing === null) {
					style.id = WORKBENCH_STYLE_ID;
					document.head.append(style);
				}
				if (style.textContent !== WORKBENCH_STYLE) style.textContent = WORKBENCH_STYLE;
				style.dataset.version = WORKBENCH_STYLE_VERSION;
			}, []);
		}
		/**
		* 建一个快照历史栈。
		* @param initial - 初始状态。
		* @returns 栈操作（见 {@link HistoryStack}）。
		*/
		function useHistoryStack(initial) {
			const [state, setState] = (0, react.useState)({
				past: [],
				present: initial,
				future: []
			});
			const stateRef = (0, react.useRef)(state);
			stateRef.current = state;
			const lastTag = (0, react.useRef)(void 0);
			const lastAt = (0, react.useRef)(0);
			const commit = (0, react.useCallback)((next, tag) => {
				const current = stateRef.current;
				if (current.present === next) return;
				const now = Date.now();
				const coalesce = tag !== void 0 && tag === lastTag.current && now - lastAt.current < 800;
				lastTag.current = tag;
				lastAt.current = now;
				if (coalesce) {
					setState((current_) => ({
						...current_,
						present: next
					}));
					return;
				}
				setState({
					past: [...current.past, current.present].slice(-100),
					present: next,
					future: []
				});
			}, []);
			const undo = (0, react.useCallback)(() => {
				const current = stateRef.current;
				if (current.past.length === 0) return void 0;
				const previous = current.past[current.past.length - 1];
				lastTag.current = void 0;
				setState({
					past: current.past.slice(0, -1),
					present: previous,
					future: [current.present, ...current.future]
				});
				return previous;
			}, []);
			const redo = (0, react.useCallback)(() => {
				const current = stateRef.current;
				if (current.future.length === 0) return void 0;
				const next = current.future[0];
				lastTag.current = void 0;
				setState({
					past: [...current.past, current.present],
					present: next,
					future: current.future.slice(1)
				});
				return next;
			}, []);
			const reset = (0, react.useCallback)((next) => {
				lastTag.current = void 0;
				lastAt.current = 0;
				setState({
					past: [],
					present: next,
					future: []
				});
			}, []);
			return {
				present: state.present,
				undoDepth: state.past.length,
				redoDepth: state.future.length,
				canUndo: state.past.length > 0,
				canRedo: state.future.length > 0,
				commit,
				undo,
				redo,
				reset
			};
		}
		//#endregion
		//#region src/client/WorkflowCanvas.tsx
		/**
		* 工作流画布（`T4-1`/`T4-2` + `B4` 交互补齐）。
		*
		* 边界按 `R-FLW-1`：画布**只做交互**——节点位置、连线、选择、缩放平移、适配窗口。
		* 执行、参数校验（除"必填"以外的语义校验）、调度与持久化都在宿主侧；
		* 本组件把画布维度的事实收敛成一个 `WorkflowRecord` 交给上层（`T4-1` 单一事实源），
		* 且**选择状态只在本地**，不进 `WorkflowRecord`（UI 瞬时选择不入库）。
		*
		* `B4` 补齐的交互：撤销/重做（快照历史栈，`A3` 落地后可切换）、节点复制/粘贴、
		* 框选与批量删除、单节点运行（运行器 `only`，宿主端点见 API-SURFACE「B 申请」）、
		* 节点运行中/失败状态与错误气泡。
		*
		* 样式：客户端私有插件产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的
		* CSS 打包链，所以 `@xyflow/react` 的官方样式表由 `scripts/sync-canvas-style.mjs`
		* 内嵌成字符串，在挂载时注入一次。
		*/
		/** 运行状态 → 文案键。 */
		function runStatusKey(status) {
			switch (status) {
				case "running": return "statusRunning";
				case "succeeded": return "statusSucceeded";
				case "failed": return "statusFailed";
				case "cancelled": return "statusCancelled";
			}
		}
		/** 节点运行状态 → 文案键。 */
		function nodeStatusKey(status) {
			switch (status) {
				case "running": return "statusRunning";
				case "succeeded": return "statusSucceeded";
				case "failed": return "statusFailed";
				case "cancelled": return "statusCancelled";
				case "skipped": return "statusSkipped";
			}
		}
		/** 节点种类 → 图标（画布库、节点卡片、参数面板共用）。 */
		const NODE_ICONS = {
			"creative-input": "input",
			"script": "script",
			"storyboard": "storyboard",
			"asset-reference": "box",
			"resource-reference": "link",
			"motion-track": "motion",
			"image-generate": "image",
			"video-generate": "video",
			"preview": "eye",
			"publish-asset": "upload",
			"subtitle": "subtitle",
			"render": "download",
			"lip-sync": "sparkles",
			"face-swap": "sparkles",
			"voice-synthesize": "sparkles"
		};
		/** 运行状态 → 徽章色调。 */
		function runChipClass(status) {
			switch (status) {
				case "running": return "iv-chip iv-chip--run";
				case "succeeded": return "iv-chip iv-chip--ok";
				case "failed": return "iv-chip iv-chip--err";
				case "cancelled": return "iv-chip";
			}
		}
		/** 注入官方样式表（只注入一次；模块加载器不处理 CSS 文件）。 */
		function useCanvasStyle() {
			(0, react.useEffect)(() => {
				if (document.getElementById("dsh-image-video-canvas-style") !== null) return;
				const style = document.createElement("style");
				style.id = CANVAS_STYLE_ID;
				style.textContent = CANVAS_STYLE;
				document.head.append(style);
			}, []);
		}
		function toCanvasNodes(record) {
			return record.nodes.map((node) => ({
				id: node.id,
				type: "workbench",
				position: {
					x: node.position.x,
					y: node.position.y
				},
				data: {
					kind: node.kind,
					params: { ...node.params }
				}
			}));
		}
		function toCanvasEdges(record) {
			return record.edges.map((edge) => ({
				id: edge.id,
				source: edge.source,
				target: edge.target
			}));
		}
		/** 把画布状态合并回文档（只带持久字段，不带选择）。 */
		function merge(record, nodes, edges) {
			return {
				...record,
				nodes: nodes.map((node) => ({
					id: node.id,
					kind: node.data.kind,
					position: {
						x: Math.round(node.position.x),
						y: Math.round(node.position.y)
					},
					params: node.data.params
				})),
				edges: edges.map((edge) => ({
					id: edge.id,
					source: edge.source,
					target: edge.target
				})),
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		}
		let nodeSequence = 0;
		/** 生成画布内唯一的节点/连线 id（与宿主的记录 id 空间无关）。 */
		function nextNodeId(kind) {
			nodeSequence += 1;
			return `${kind}-${Date.now().toString(36)}-${nodeSequence.toString(36)}`;
		}
		/**
		* 节点卡片：本地化种类名 + 参数摘要 + `B4` 的运行状态徽章与错误气泡。
		*
		* 运行状态来自运行记录（`nodeRuns` 按 nodeId 归拢），只进 `node.data` 的样式字段，
		* 不被 `merge` 持久化——运行记录是宿主侧的事实，卡片只是它的镜子。
		*/
		function WorkflowNodeCard({ data, selected, t }) {
			const [bubbleOpen, setBubbleOpen] = (0, react.useState)(false);
			const spec = nodeSpec(data.kind);
			const planned = spec.availability !== "runnable";
			const summary = spec.params.filter((field) => data.params[field.id] !== "" && data.params[field.id] !== false && data.params[field.id] !== void 0).slice(0, 2).map((field) => `${t(field.labelKey)}=${String(data.params[field.id]).slice(0, 14)}`).join(" · ");
			const runStatus = data.runStatus;
			const failed = runStatus === "failed";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-node",
				"data-workflow-node": data.kind,
				"data-workflow-node-selected": selected ? "true" : "false",
				"data-workflow-node-availability": spec.availability,
				"data-workflow-node-invalid": data.invalid === true ? "true" : "false",
				"data-workflow-node-run-status": runStatus ?? "none",
				role: "button",
				tabIndex: 0,
				"aria-label": `${t(spec.labelKey)}${runStatus === void 0 ? "" : ` · ${t(nodeStatusKey(runStatus))}`}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_xyflow_react.Handle, {
						type: "target",
						position: _xyflow_react.Position.Left
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-node-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
								name: NODE_ICONS[data.kind],
								size: 13
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "iv-node-title",
								children: t(spec.labelKey)
							}),
							planned ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "iv-node-planned",
								"data-workflow-planned-tag": "true",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "sparkles",
									size: 9
								}), t("canvasPlannedTag")]
							}) : null,
							runStatus === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `iv-node-run iv-node-run--${runStatus}`,
								"data-workflow-node-run-badge": runStatus,
								title: t(nodeStatusKey(runStatus)),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
									className: "iv-dot",
									"aria-hidden": "true"
								})
							}),
							failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "iv-node-err",
								"data-workflow-node-error-toggle": "true",
								"aria-label": t("nodeErrorDetails"),
								title: data.runError ?? t("statusFailed"),
								onClick: (event) => {
									event.stopPropagation();
									setBubbleOpen((open) => !open);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "alert",
									size: 10
								})
							}) : null
						]
					}),
					summary === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-node-body",
						children: summary
					}),
					failed && bubbleOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-node-bubble",
						"data-workflow-node-error-bubble": "true",
						role: "status",
						children: data.runError ?? t("statusFailed")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_xyflow_react.Handle, {
						type: "source",
						position: _xyflow_react.Position.Right
					})
				]
			});
		}
		/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
		function CanvasSurface({ record, onChange, t, run }) {
			const [nodes, setNodes, onNodesChange] = (0, _xyflow_react.useNodesState)(toCanvasNodes(record));
			const [edges, setEdges, onEdgesChange] = (0, _xyflow_react.useEdgesState)(toCanvasEdges(record));
			const [error, setError] = (0, react.useState)(void 0);
			const [templateId, setTemplateId] = (0, react.useState)(WORKFLOW_TEMPLATES[0]?.id ?? "");
			const [selectedIds, setSelectedIds] = (0, react.useState)([]);
			const { fitView } = (0, _xyflow_react.useReactFlow)();
			const lastPushed = (0, react.useRef)("");
			const seededId = (0, react.useRef)(record.id);
			const clipboard = (0, react.useRef)(void 0);
			const { commit: commitHistory, undo: undoHistory, redo: redoHistory, reset: resetHistory, canUndo, canRedo, undoDepth, redoDepth } = useHistoryStack({
				nodes: toCanvasNodes(record),
				edges: toCanvasEdges(record)
			});
			const onSelectionChange = (0, react.useCallback)((params) => {
				setSelectedIds(params.nodes.map((node) => node.id));
			}, []);
			const selectedNodes = (0, react.useMemo)(() => nodes.filter((node) => selectedIds.includes(node.id)), [nodes, selectedIds]);
			(0, react.useEffect)(() => {
				if (seededId.current === record.id) return;
				seededId.current = record.id;
				const nextNodes = toCanvasNodes(record);
				const nextEdges = toCanvasEdges(record);
				setNodes(nextNodes);
				setEdges(nextEdges);
				resetHistory({
					nodes: nextNodes,
					edges: nextEdges
				});
				setSelectedIds([]);
			}, [
				record,
				setNodes,
				setEdges,
				resetHistory
			]);
			(0, react.useEffect)(() => {
				const merged = merge(record, nodes, edges);
				const fingerprint = JSON.stringify({
					nodes: merged.nodes,
					edges: merged.edges
				});
				if (fingerprint === lastPushed.current) return;
				lastPushed.current = fingerprint;
				onChange(merged);
			}, [
				nodes,
				edges,
				record,
				onChange
			]);
			const validation = (0, react.useMemo)(() => validateWorkflow(merge(record, nodes, edges).nodes, merge(record, nodes, edges).edges), [
				record,
				nodes,
				edges
			]);
			(0, react.useEffect)(() => {
				const invalidIds = new Set(validation.issues.flatMap((issue) => issue.nodeId === void 0 ? [] : [issue.nodeId]));
				setNodes((current) => {
					let changed = false;
					const next = current.map((node) => {
						const invalid = invalidIds.has(node.id);
						if (node.data.invalid === true === invalid) return node;
						changed = true;
						return {
							...node,
							data: {
								...node.data,
								invalid
							}
						};
					});
					return changed ? next : current;
				});
			}, [validation.issues.filter((issue) => issue.nodeId !== void 0).map((issue) => issue.nodeId).join(","), setNodes]);
			(0, react.useEffect)(() => {
				const byId = new Map((run?.latest?.nodeRuns ?? []).map((entry) => [entry.nodeId, entry]));
				setNodes((current) => {
					let changed = false;
					const next = current.map((node) => {
						const entry = byId.get(node.id);
						const status = entry?.status;
						const errorText = entry?.error;
						if (node.data.runStatus === status && node.data.runError === errorText) return node;
						changed = true;
						return {
							...node,
							data: {
								...node.data,
								runStatus: status,
								runError: errorText
							}
						};
					});
					return changed ? next : current;
				});
			}, [(run?.latest?.nodeRuns ?? []).map((entry) => `${entry.nodeId}:${entry.status}:${entry.error ?? ""}`).join("|"), setNodes]);
			const nodeTypes = (0, react.useMemo)(() => ({ workbench: (nodeProps) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowNodeCard, {
				...nodeProps,
				t
			}) }), [t]);
			/**
			* 应用一张新图：改本地状态 + 推历史 + 回写事实源（回写由上面的 effect 完成）。
			* @param next - 新图。
			* @param tag - 历史合并标签（拖拽/连续输入传稳定 tag，一次性动作传唯一 tag）。
			*/
			const applyGraph = (0, react.useCallback)((next, tag) => {
				setNodes(next.nodes);
				setEdges(next.edges);
				commitHistory(next, tag);
			}, [
				commitHistory,
				setNodes,
				setEdges
			]);
			const addNode = (0, react.useCallback)((kind) => {
				const index = nodes.length;
				const node = {
					id: nextNodeId(kind),
					type: "workbench",
					position: {
						x: 40 + index % 4 * 190,
						y: 40 + Math.floor(index / 4) * 120
					},
					data: {
						kind,
						params: defaultParams(kind)
					},
					selected: true
				};
				const nextNodes = nodes.map((candidate) => ({
					...candidate,
					selected: false
				}));
				nextNodes.push(node);
				applyGraph({
					nodes: nextNodes,
					edges
				}, `add:${node.id}`);
			}, [
				nodes,
				edges,
				applyGraph
			]);
			const updateParam = (0, react.useCallback)((id, key, value) => {
				applyGraph({
					nodes: nodes.map((node) => node.id === id ? {
						...node,
						data: {
							...node.data,
							params: {
								...node.data.params,
								[key]: value
							}
						}
					} : node),
					edges
				}, `param:${id}:${key}`);
			}, [
				nodes,
				edges,
				applyGraph
			]);
			const onConnect = (0, react.useCallback)((connection) => {
				if (connection.source === connection.target) {
					setError(t("canvasSelfLoop"));
					return;
				}
				setError(void 0);
				const id = `${connection.source}-${connection.target}`;
				if (edges.some((edge) => edge.id === id)) return;
				applyGraph({
					nodes,
					edges: (0, _xyflow_react.addEdge)({
						...connection,
						id
					}, edges)
				}, `connect:${id}`);
			}, [
				nodes,
				edges,
				applyGraph,
				t
			]);
			const applyTemplate = (0, react.useCallback)((id) => {
				const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === id);
				if (template === void 0) return;
				const stamp = Date.now().toString(36);
				const built = template.nodes.map((spec, index) => ({
					id: `${template.id}-${index}-${stamp}`,
					type: "workbench",
					position: {
						x: 40 + index % 2 * 200,
						y: 30 + Math.floor(index / 2) * 110
					},
					data: {
						kind: spec.kind,
						params: {
							...defaultParams(spec.kind),
							...spec.params ?? {}
						}
					}
				}));
				const builtEdges = template.edges.map(([from, to]) => ({
					id: `${built[from]?.id ?? from}->${built[to]?.id ?? to}`,
					source: built[from]?.id ?? String(from),
					target: built[to]?.id ?? String(to)
				}));
				setError(void 0);
				applyGraph({
					nodes: built,
					edges: builtEdges
				}, `template:${id}`);
			}, [applyGraph]);
			/** 删除选中的节点（批量：框选/多选后一次删完）。 */
			const deleteSelected = (0, react.useCallback)(() => {
				if (selectedIds.length === 0) return;
				const doomed = new Set(selectedIds);
				applyGraph({
					nodes: nodes.filter((node) => !doomed.has(node.id)),
					edges: edges.filter((edge) => !doomed.has(edge.source) && !doomed.has(edge.target))
				}, `delete:${Date.now().toString(36)}`);
			}, [
				selectedIds,
				nodes,
				edges,
				applyGraph
			]);
			/** 复制选中的节点（含两端都在选区里的连线）到内部剪贴板。 */
			const copySelected = (0, react.useCallback)(() => {
				if (selectedIds.length === 0) {
					setError(t("canvasPasteEmpty"));
					return;
				}
				const doomed = new Set(selectedIds);
				clipboard.current = {
					nodes: selectedNodes.map((node) => ({
						...node,
						data: {
							...node.data,
							params: { ...node.data.params }
						}
					})),
					edges: edges.filter((edge) => doomed.has(edge.source) && doomed.has(edge.target))
				};
				setError(void 0);
			}, [
				selectedIds,
				selectedNodes,
				edges,
				t
			]);
			/** 粘贴：换新 id、级联偏移、只选粘贴进来的这一批。 */
			const pasteClipboard = (0, react.useCallback)(() => {
				const clip = clipboard.current;
				if (clip === void 0 || clip.nodes.length === 0) {
					setError(t("canvasPasteEmpty"));
					return;
				}
				const idMap = /* @__PURE__ */ new Map();
				const pasted = clip.nodes.map((node, index) => {
					const id = nextNodeId(node.data.kind);
					idMap.set(node.id, id);
					return {
						...node,
						id,
						position: {
							x: node.position.x + 24,
							y: node.position.y + 24 + index * 6
						},
						selected: true,
						data: {
							...node.data,
							params: { ...node.data.params }
						}
					};
				});
				const remap = (id) => idMap.get(id) ?? id;
				const pastedEdges = clip.edges.map((edge) => ({
					...edge,
					id: `${remap(edge.source)}->${remap(edge.target)}`,
					source: remap(edge.source),
					target: remap(edge.target)
				}));
				const nextNodes = nodes.map((node) => ({
					...node,
					selected: false
				}));
				nextNodes.push(...pasted);
				const nextEdges = edges.concat(pastedEdges);
				setError(void 0);
				applyGraph({
					nodes: nextNodes,
					edges: nextEdges
				}, `paste:${Date.now().toString(36)}`);
			}, [
				nodes,
				edges,
				applyGraph
			]);
			/** 撤销/重做：取历史栈的上一态，应用到画布（回写由 effect 完成）。 */
			const undo = (0, react.useCallback)(() => {
				const previous = undoHistory();
				if (previous === void 0) return;
				setNodes(previous.nodes);
				setEdges(previous.edges);
			}, [
				undoHistory,
				setNodes,
				setEdges
			]);
			const redo = (0, react.useCallback)(() => {
				const next = redoHistory();
				if (next === void 0) return;
				setNodes(next.nodes);
				setEdges(next.edges);
			}, [
				redoHistory,
				setNodes,
				setEdges
			]);
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					const target = event.target;
					if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable === true)) return;
					const meta = event.metaKey || event.ctrlKey;
					const key = event.key.toLowerCase();
					if (meta && key === "z") {
						event.preventDefault();
						if (event.shiftKey) redo();
						else undo();
						return;
					}
					if (meta && key === "y") {
						event.preventDefault();
						redo();
						return;
					}
					if (meta && key === "c") {
						event.preventDefault();
						copySelected();
						return;
					}
					if (meta && key === "v") {
						event.preventDefault();
						pasteClipboard();
						return;
					}
					if (!meta && (event.key === "Delete" || event.key === "Backspace")) {
						if (selectedIds.length > 0) {
							event.preventDefault();
							deleteSelected();
						}
					}
				};
				window.addEventListener("keydown", onKeyDown);
				return () => {
					window.removeEventListener("keydown", onKeyDown);
				};
			}, [
				undo,
				redo,
				copySelected,
				pasteClipboard,
				deleteSelected,
				selectedIds.length
			]);
			const onNodeDragStop = (0, react.useCallback)((_event, node) => {
				commitHistory({
					nodes,
					edges
				}, `drag:${node.id}`);
			}, [
				commitHistory,
				nodes,
				edges
			]);
			const onPaneClick = (0, react.useCallback)(() => {
				setError(void 0);
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-canvas-main",
				"data-workflow-canvas": "true",
				"data-workflow-nodes": String(nodes.length),
				"data-workflow-edges": String(edges.length),
				"data-workflow-selected": selectedIds[0] ?? "",
				"data-workflow-selected-count": String(selectedIds.length),
				"data-workflow-history": `${undoDepth}/${redoDepth}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "iv-pal",
					"data-workflow-palette": "true",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "iv-micro",
							style: { width: "100%" },
							children: t("canvasPalette")
						}),
						NODE_CATALOG.filter((spec) => spec.availability === "runnable").map((spec) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "iv-pal-chip",
							"data-workflow-palette-item": spec.kind,
							"data-workflow-availability": spec.availability,
							"aria-label": `${t("canvasAdd")} ${spec.kind}`,
							title: spec.reasonKey === void 0 ? spec.kind : t(spec.reasonKey),
							onClick: () => {
								addNode(spec.kind);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
								name: NODE_ICONS[spec.kind],
								size: 12
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(spec.labelKey) })]
						}, spec.kind)),
						NODE_CATALOG.some((spec) => spec.availability !== "runnable") ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "iv-pal-sep",
							role: "separator"
						}), NODE_CATALOG.filter((spec) => spec.availability !== "runnable").map((spec) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "iv-pal-chip",
							"data-workflow-palette-item": spec.kind,
							"data-workflow-availability": spec.availability,
							"aria-label": `${t("canvasAdd")} ${spec.kind}`,
							title: spec.reasonKey === void 0 ? spec.kind : t(spec.reasonKey),
							onClick: () => {
								addNode(spec.kind);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: NODE_ICONS[spec.kind],
									size: 12
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(spec.labelKey) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-meta",
									children: t("canvasPlannedTag")
								})
							]
						}, spec.kind))] }) : null
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "iv-canvas-main",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-toolbar",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "iv-select",
									"data-workflow-template": "true",
									"aria-label": t("templateTitle"),
									value: templateId,
									onChange: (event) => {
										setTemplateId(event.target.value);
									},
									children: WORKFLOW_TEMPLATES.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: template.id,
										children: t(template.labelKey)
									}, template.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "apply-template",
									onClick: () => {
										applyTemplate(templateId);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "copy" }), t("templateApply")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "fit",
									onClick: () => {
										fitView({ padding: .2 });
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "search" }), t("canvasFit")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-toolbar-sep",
									role: "separator",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "undo",
									"aria-label": t("canvasUndo"),
									title: `${t("canvasUndo")}（⌘Z）`,
									disabled: !canUndo,
									onClick: undo,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "undo" }), undoDepth > 0 ? undoDepth : ""]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "redo",
									"aria-label": t("canvasRedo"),
									title: `${t("canvasRedo")}（⌘⇧Z）`,
									disabled: !canRedo,
									onClick: redo,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "redo" }), redoDepth > 0 ? redoDepth : ""]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-toolbar-sep",
									role: "separator",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "copy",
									"aria-label": t("canvasCopy"),
									title: `${t("canvasCopy")}（⌘C）`,
									disabled: selectedIds.length === 0,
									onClick: copySelected,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "copy" }), t("canvasCopy")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "paste",
									"aria-label": t("canvasPaste"),
									title: `${t("canvasPaste")}（⌘V）`,
									onClick: pasteClipboard,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "clipboard" }), t("canvasPaste")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "delete-node",
									"aria-label": t("canvasDeleteSelected"),
									title: `${t("canvasDeleteSelected")}（Delete）`,
									disabled: selectedIds.length === 0,
									onClick: deleteSelected,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "trash" }),
										t("canvasDeleteSelected"),
										selectedIds.length > 1 ? ` · ${selectedIds.length}` : ""
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "iv-count",
									children: [
										nodes.length,
										" ",
										t("canvasNodesCount"),
										" · ",
										edges.length,
										" ",
										t("canvasEdgesCount")
									]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-issues",
							"data-workflow-issues": String(validation.issues.length),
							"data-workflow-runnable": validation.ok ? "true" : "false",
							"data-ok": validation.ok ? "true" : "false",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("validationTitle") }), validation.ok ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								"data-workflow-validation": "ok",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "check",
									size: 12
								}), t("validationOk")]
							}) : validation.issues.slice(0, 6).map((issue, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "iv-issue",
								"data-workflow-issue": issue.code,
								title: issue.message,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
										name: "alert",
										size: 12
									}),
									issue.nodeId === void 0 ? "" : `${issue.nodeId}: `,
									t(issue.code === "missing-required" ? "issueRequired" : issue.code === "port-mismatch" ? "issuePort" : issue.code === "self-loop" ? "issueSelfLoop" : issue.code === "dangling-edge" ? "issueDangling" : issue.code === "cycle" ? "issueCycle" : "issuePlanned")
								]
							}, `${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`))]
						}),
						run === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-run",
							"data-workflow-run": run.latest?.status ?? "none",
							"data-workflow-run-count": String(run.latest?.nodeRuns.length ?? 0),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-run-head",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("runTitle") }), run.latest === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-meta",
										children: t("runNone")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: runChipClass(run.latest.status),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
												className: "iv-dot",
												"aria-hidden": "true"
											}),
											t(runStatusKey(run.latest.status)),
											" · ",
											run.latest.nodeRuns.filter((node) => node.status === "succeeded").length,
											"/",
											run.latest.nodeRuns.length
										]
									}), run.latest.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-meta iv-ellipsis",
										title: run.latest.error,
										children: run.latest.error.slice(0, 80)
									})] })]
								}),
								run.history.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "iv-run-history",
									"data-workflow-run-history": "true",
									children: run.history.slice(0, 8).map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "iv-run-item",
										"data-workflow-run-item": entry.id,
										"data-workflow-run-item-selected": entry.id === run.selectedRunId ? "true" : "false",
										onClick: () => {
											run.onSelectRun(entry.id);
										},
										children: [
											new Date(entry.startedAt).toLocaleTimeString("zh-CN", { hour12: false }),
											" · ",
											t(runStatusKey(entry.status)),
											" · ",
											entry.nodeRuns.filter((node) => node.outputPath !== void 0).length,
											" ",
											t("runArtifacts")
										]
									}, entry.id))
								}) : null,
								run.latest === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "iv-run-nodes",
									children: run.latest.nodeRuns.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "iv-node-run",
										"data-workflow-node-run": node.nodeId,
										"data-workflow-node-status": node.status,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
											className: "iv-dot",
											"aria-hidden": "true"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "iv-ellipsis",
											children: [
												node.nodeId,
												" · ",
												t(nodeStatusKey(node.status)),
												node.outputPath === void 0 ? "" : ` · ${node.outputPath.split("/").pop() ?? ""}`,
												node.error === void 0 ? "" : ` · ${node.error.slice(0, 60)}`
											]
										})]
									}, node.nodeId))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-run-actions",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "iv-btn iv-btn--primary iv-btn--sm",
											"data-workflow-run-action": "start",
											disabled: run.busy || !validation.ok || run.latest?.status === "running",
											onClick: run.onStart,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "play" }), t("runStart")]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "iv-btn iv-btn--sm",
											"data-workflow-run-action": "cancel",
											disabled: run.latest?.status !== "running",
											onClick: run.onCancel,
											children: t("runCancel")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "iv-btn iv-btn--sm",
											"data-workflow-run-action": "retry",
											disabled: run.latest?.status !== "failed",
											onClick: run.onRetry,
											children: t("runRetry")
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-flow",
							"data-workflow-flow": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_xyflow_react.ReactFlow, {
								nodes,
								edges,
								nodeTypes,
								onNodesChange,
								onEdgesChange,
								onConnect,
								onSelectionChange,
								onNodeDragStop,
								onPaneClick,
								multiSelectionKeyCode: ["Meta", "Control"],
								selectionOnDrag: true,
								proOptions: { hideAttribution: false },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_xyflow_react.Background, { gap: 18 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_xyflow_react.Controls, { showInteractive: false })]
							})
						}),
						selectedNodes.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "iv-meta",
							children: t("canvasEmpty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-inspector",
							"data-workflow-inspector": selectedNodes[0].id,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-inspector-head",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
											name: NODE_ICONS[selectedNodes[0].data.kind],
											size: 13
										}),
										t("canvasParams"),
										" · ",
										selectedNodes[0].data.kind,
										selectedNodes.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "iv-meta",
											children: [
												t("canvasSelected"),
												" · ",
												selectedNodes.length
											]
										}) : null,
										run?.onRunNode === void 0 || selectedNodes.length !== 1 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "iv-btn iv-btn--sm",
											"data-workflow-action": "run-node",
											"aria-label": t("canvasRunNode"),
											title: t("canvasRunNode"),
											disabled: run.busy || run.latest?.status === "running",
											onClick: () => {
												run.onRunNode?.(selectedNodes[0].id);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
												name: "play",
												size: 11
											}), t("canvasRunNode")]
										})
									]
								}),
								nodeSpec(selectedNodes[0].data.kind).availability !== "runnable" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "iv-meta",
									"data-workflow-planned-note": "true",
									style: { color: "var(--iv-warn)" },
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
											name: "sparkles",
											size: 12
										}),
										" ",
										t(nodeSpec(selectedNodes[0].data.kind).reasonKey)
									]
								}) : null,
								nodeSpec(selectedNodes[0].data.kind).params.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-meta",
									children: t("canvasNoParams")
								}) : nodeSpec(selectedNodes[0].data.kind).params.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "iv-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(field.labelKey) }), field.type === "boolean" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										"data-workflow-param": field.id,
										checked: selectedNodes[0].data.params[field.id] === true,
										onChange: (event) => {
											updateParam(selectedNodes[0].id, field.id, event.target.checked);
										}
									}) : field.type === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "iv-select",
										"data-workflow-param": field.id,
										value: String(selectedNodes[0].data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selectedNodes[0].id, field.id, event.target.value);
										},
										children: (field.options ?? []).map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: option.value,
											children: t(option.labelKey)
										}, option.value))
									}) : field.type === "textarea" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "iv-input iv-textarea",
										"data-workflow-param": field.id,
										rows: 2,
										value: String(selectedNodes[0].data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selectedNodes[0].id, field.id, event.target.value);
										}
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "iv-input",
										"data-workflow-param": field.id,
										type: field.type === "number" ? "number" : "text",
										value: String(selectedNodes[0].data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selectedNodes[0].id, field.id, field.type === "number" ? Number(event.target.value) : event.target.value);
										}
									})]
								}, field.id))
							]
						}),
						error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "iv-notice iv-notice--error",
							role: "status",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "iv-meta",
							children: t("canvasTransient")
						})
					]
				})]
			});
		}
		/** 对外画布组件：套 `ReactFlowProvider` 并注入官方样式 + 设计系统样式。 */
		function WorkflowCanvas(props) {
			useCanvasStyle();
			useWorkbenchStyle();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_xyflow_react.ReactFlowProvider, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasSurface, { ...props }) });
		}
		/**
		* 算当前应该渲染哪些行（纯函数，方便单测）。
		* @param input - 滚动位置、视口高度、总条数与行高/缓冲参数。
		* @returns 窗口区间与顶/底占位高度。
		*/
		function visibleWindow(input) {
			const rowHeight = input.rowHeight ?? 28;
			const overscan = input.overscan ?? 6;
			const total = Math.max(0, Math.floor(input.total));
			const totalHeight = total * rowHeight;
			if (total === 0) return {
				start: 0,
				end: 0,
				topHeight: 0,
				bottomHeight: 0,
				totalHeight: 0
			};
			const viewport = input.viewportHeight > 0 ? input.viewportHeight : 240;
			const first = Math.max(0, Math.floor(input.scrollTop / rowHeight));
			const visible = Math.max(1, Math.ceil(viewport / rowHeight));
			const start = Math.max(0, first - overscan);
			const end = Math.min(total, first + visible + overscan);
			return {
				start,
				end,
				topHeight: start * rowHeight,
				bottomHeight: Math.max(0, totalHeight - end * rowHeight),
				totalHeight
			};
		}
		/**
		* 渲染一个列表：条数少时全量直出，条数多时只渲染可视区。
		* @param props - 见 {@link VirtualListProps}。
		* @returns `<ul>` 列表（虚拟化时内部带顶/底占位 li）。
		*/
		function VirtualList({ items, renderRow, rowHeight = 28, overscan = 6, className }) {
			const [scrollTop, setScrollTop] = (0, react.useState)(0);
			const [viewportHeight, setViewportHeight] = (0, react.useState)(0);
			const scrollRaf = (0, react.useRef)(void 0);
			const onScroll = (0, react.useCallback)((event) => {
				const element = event.currentTarget;
				if (scrollRaf.current !== void 0) cancelAnimationFrame(scrollRaf.current);
				scrollRaf.current = requestAnimationFrame(() => {
					scrollRaf.current = void 0;
					setScrollTop(element.scrollTop);
					setViewportHeight(element.clientHeight);
				});
			}, []);
			if (items.length <= 100) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className,
				children: items.map((item, index) => renderRow(item, index))
			});
			const window_ = visibleWindow({
				scrollTop,
				viewportHeight,
				total: items.length,
				rowHeight,
				overscan
			});
			const rows = [];
			for (let index = window_.start; index < window_.end; index += 1) rows.push(renderRow(items[index], index));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
				className,
				onScroll,
				style: {
					maxHeight: 240,
					overflowY: "auto"
				},
				children: [
					window_.topHeight > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
						"aria-hidden": "true",
						style: {
							height: window_.topHeight,
							padding: 0,
							border: 0,
							flex: "none"
						}
					}) : null,
					rows,
					window_.bottomHeight > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
						"aria-hidden": "true",
						style: {
							height: window_.bottomHeight,
							padding: 0,
							border: 0,
							flex: "none"
						}
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/PaneBoundary.tsx
		/**
		* 面板错误边界（`B3`）：每个 pane 一个，单个面板崩掉只显示"该面板出错 + 重试"，
		* **不拖垮整个右栏**。
		*
		* 用法：把面板内容包进 `<PaneBoundary label={…} t={t}>…</PaneBoundary>`。
		* 健康时边界零 DOM 包裹（直接渲染 children），出错时换成一段自包含的
		* 空态（图标 + 面板名 + 简短错误 + 重试按钮）。重试 = 摘掉错误态并
		* 用递增的 key 重挂子树，让面板内的组件从头初始化。
		*/
		/** 捕获渲染期错误并换成面板级空态的边界。 */
		var PaneBoundary = class extends react.Component {
			state = {
				error: void 0,
				attempt: 0
			};
			/** 渲染出错：切换到错误空态。 */
			static getDerivedStateFromError(error) {
				return { error };
			}
			/** 控制台留全栈（现场排查用）；界面只显示简短文案。 */
			componentDidCatch(error, info) {
				console.error("[dsh-image-video] pane crashed:", error.message, info.componentStack ?? "");
			}
			/** 重试：清错误态 + key 递增重挂子树。 */
			retry = () => {
				this.setState((current) => ({
					error: void 0,
					attempt: current.attempt + 1
				}));
			};
			render() {
				const { error, attempt } = this.state;
				if (error === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: this.props.children }, attempt);
				const { t, label } = this.props;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "iv-empty",
					"data-pane-error": "true",
					role: "alert",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "iv-empty-tile",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
								name: "alert",
								size: 17
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
							t("paneError"),
							" · ",
							label
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "iv-meta iv-ellipsis",
							style: { maxWidth: "100%" },
							title: error.message,
							children: error.message.slice(0, 120)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "iv-btn iv-btn--sm",
							"data-pane-error-retry": "true",
							onClick: this.retry,
							children: t("paneErrorRetry")
						})
					]
				});
			}
		};
		/** 时间轴最小可导航尺度（ms）：空轨也要有长度，否则落点换算全塌到 0。 */
		const MIN_TIMELINE_MS = 3e3;
		/**
		* 把鼠标 x 换算成时间轴上的毫秒位置（按 lane 宽度比例映射，夹在 [0, total]）。
		* @param clientX - 鼠标视口 x。
		* @param lane - lane 的 `{left, width}`（调用方量好的 rect）。
		* @param totalMs - 时间轴总时长。
		* @returns 毫秒位置。
		*/
		function laneTimeFromClientX(clientX, lane, totalMs) {
			const usable = lane.width - 16;
			if (usable <= 0 || totalMs <= 0) return 0;
			const ratio = (clientX - lane.left - 8) / usable;
			return Math.round(Math.min(1, Math.max(0, ratio)) * totalMs);
		}
		/**
		* 左手柄拖动：改起点（起点只能后移到距右边界一个最短时长处）。
		* @param clip - 原片段的 `{startMs, durationMs}`。
		* @param deltaMs - 鼠标移动换算出的毫秒增量。
		* @returns 新的 `{startMs, durationMs}`。
		*/
		function resizeClipLeft(clip, deltaMs) {
			const latestStart = clip.startMs + clip.durationMs - 200;
			const startMs = Math.round(Math.min(latestStart, Math.max(0, clip.startMs + deltaMs)));
			return {
				startMs,
				durationMs: clip.durationMs - (startMs - clip.startMs)
			};
		}
		/**
		* 右手柄拖动：改时长（夹在最短时长与模型上限之间）。
		* @param clip - 原片段。
		* @param deltaMs - 毫秒增量。
		* @returns 新的 `{startMs, durationMs}`。
		*/
		function resizeClipRight(clip, deltaMs) {
			const durationMs = Math.round(Math.min(MAX_CLIP_DURATION_MS, Math.max(200, clip.durationMs + deltaMs)));
			return {
				startMs: clip.startMs,
				durationMs
			};
		}
		/**
		* 顺序播放：某一时刻之后的下一个视频片段起点（跳过空隙）。
		* @param tracks - 轨道。
		* @param afterMs - 从这一刻之后找。
		* @returns 下一个视频片段的起点；没有则 `undefined`（该结束了）。
		*/
		function nextVideoClipStart(tracks, afterMs) {
			return tracks.filter((track) => track.kind === "video").flatMap((track) => track.clips).sort((left, right) => left.startMs - right.startMs).find((clip) => clip.startMs >= afterMs)?.startMs;
		}
		//#endregion
		//#region src/client/use-unified-poll.ts
		/**
		* 统一轮询（`B1`）：把导出 2s / 运行 2.5s / 项目 5s 三个定时器收敛成一个。
		*
		* 口径（任务书 `TASKS-TRACK-B.md` B1）：
		* - 间隔按活跃度自适应：有 running 任务 2s，否则 5s；
		* - `document.hidden` 时**停表**（不发请求），恢复可见时立即补跳一次；
		* - 每跳间隔加 ±20% 抖动，避免多客户端/多标签页同相位撞车。
		*
		* 为什么用递归 `setTimeout` 而不是 `setInterval`：间隔随活跃度变化，
		* 每跳重新取一次基准 + 新抖动，`setInterval` 做不到（改间隔等于重置定时器）。
		*/
		/** 有 running 任务时的轮询基准（毫秒）。 */
		const POLL_ACTIVE_MS = 2e3;
		/** 空闲时的轮询基准（毫秒）。 */
		const POLL_IDLE_MS = 5e3;
		/** 抖动幅度（相对值）：±20%。 */
		const POLL_JITTER = .2;
		/**
		* 算一跳的实际间隔：基准 × (1 ± 20%)。
		* @param baseMs - 基准间隔（毫秒）。
		* @param random - [0,1) 随机源。
		* @returns 抖动后的间隔（毫秒，至少 50ms）。
		*/
		function jitteredInterval(baseMs, random = Math.random) {
			const factor = 1 + (random() * 2 - 1) * POLL_JITTER;
			return Math.max(50, Math.round(baseMs * factor));
		}
		/**
		* 挂载统一轮询：一个定时器链，按活跃度换基准，隐藏即停。
		* @param options - 见 {@link UnifiedPollingOptions}。
		*/
		function useUnifiedPolling({ active, onTick, enabled = true, random = Math.random }) {
			const tickRef = (0, react.useRef)(onTick);
			tickRef.current = onTick;
			const activeRef = (0, react.useRef)(active);
			activeRef.current = active;
			const randomRef = (0, react.useRef)(random);
			randomRef.current = random;
			(0, react.useEffect)(() => {
				if (!enabled || typeof document === "undefined") return;
				let timer;
				let stopped = false;
				const clearTimer = () => {
					if (timer !== void 0) {
						clearTimeout(timer);
						timer = void 0;
					}
				};
				const schedule = () => {
					clearTimer();
					if (stopped) return;
					if (document.hidden === true) return;
					const base = activeRef.current ? POLL_ACTIVE_MS : POLL_IDLE_MS;
					timer = setTimeout(() => {
						timer = void 0;
						if (stopped) return;
						if (document.hidden !== true) tickRef.current();
						schedule();
					}, jitteredInterval(base, randomRef.current));
				};
				const onVisibilityChange = () => {
					if (document.hidden === true) {
						clearTimer();
						return;
					}
					tickRef.current();
					schedule();
				};
				schedule();
				document.addEventListener("visibilitychange", onVisibilityChange);
				return () => {
					stopped = true;
					clearTimer();
					document.removeEventListener("visibilitychange", onVisibilityChange);
				};
			}, [enabled, active]);
		}
		//#endregion
		//#region src/client/use-elapsed.ts
		/**
		* 已用时秒表（`F3` 生成进度）：给一个开始时间戳，每秒推一次渲染。
		*
		* 单独成模块是为了可单测：进度条没有百分比时，界面只能显示"生成中 · 12s"，
		* 这个秒表就是那句话的数据源。`startedAt` 为 `undefined` 时停表（没有在飞的生成）。
		*/
		/**
		* 从开始时间戳算已用时（整秒），每秒钟推一次。
		* @param startedAt - 开始的毫秒时间戳；`undefined` 表示没有在跑的任务。
		* @returns 已用时秒数；没有在跑的任务时为 `undefined`。
		*/
		function useElapsedSeconds(startedAt) {
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				if (startedAt === void 0) return;
				setNow(Date.now());
				const timer = setInterval(() => {
					setNow(Date.now());
				}, 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [startedAt]);
			if (startedAt === void 0) return void 0;
			return Math.max(0, Math.floor((now - startedAt) / 1e3));
		}
		//#endregion
		//#region src/client/panels/AssetHealthPanel.tsx
		/**
		* B-11 素材库体检面板：体积排行 / 去重 / 项目统计。
		*
		* 三个端点都只报告不删除（宿主契约如此），所以这里只呈现可回收空间与建议保留项，
		* 不提供任何破坏性操作。`formatBytes` 由工作台注入，避免与主面板重复实现。
		*/
		/** 路径只显示文件名；完整路径放进 `title`，面板宽度不足以展示绝对路径。 */
		function fileName(path) {
			return path.split(/[\\/]/).pop() ?? path;
		}
		function AssetHealthPanel({ api, formatBytes, t }) {
			const [tab, setTab] = (0, react.useState)("size");
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			const [sizeData, setSizeData] = (0, react.useState)(void 0);
			const [dupesData, setDupesData] = (0, react.useState)(void 0);
			const [statsData, setStatsData] = (0, react.useState)(void 0);
			const runReport = async () => {
				setLoading(true);
				setError(void 0);
				try {
					if (tab === "size") setSizeData(await api.assetSizeReport(20));
					else if (tab === "dupes") setDupesData(await api.assetDuplicates());
					else setStatsData(await api.assetProjectStats());
				} catch (thrown) {
					setError(thrown instanceof Error ? thrown.message : String(thrown));
				} finally {
					setLoading(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-health",
				"data-health-panel": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-tabs iv-health-tabs",
						role: "tablist",
						children: [[
							["size", t("healthSize")],
							["dupes", t("healthDupes")],
							["stats", t("healthStats")]
						].map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === key,
							className: `iv-tab${tab === key ? " on" : ""}`,
							"data-health-tab": key,
							onClick: () => {
								setTab(key);
							},
							children: label
						}, key)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "iv-btn iv-btn--acc iv-btn--sm iv-health-run",
							"data-health-run": "true",
							disabled: loading,
							onClick: () => {
								runReport();
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
								name: "refresh",
								size: 11
							}), loading ? t("healthRunning") : t("healthRun")]
						})]
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-notice iv-notice--error",
						role: "alert",
						children: error
					}),
					tab === "size" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-health-body",
						"data-health-body": "size",
						children: sizeData === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-empty",
							children: t("healthEmptyHint")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-size-list",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-size-summary iv-meta",
								children: [
									t("healthSizeSummary"),
									": ",
									formatBytes(sizeData.totalBytes),
									" · ",
									t("healthMedian"),
									": ",
									formatBytes(sizeData.medianBytes),
									" · ",
									sizeData.top.length,
									"/",
									sizeData.count,
									" · ",
									Math.round(sizeData.topShare * 100),
									"%"
								]
							}), sizeData.top.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-size-row",
								"data-size-path": entry.path,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-size-name iv-ellipsis",
										title: entry.path,
										children: fileName(entry.path)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-size-bytes",
										children: formatBytes(entry.bytes)
									}),
									entry.unused === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-chip iv-chip--warn",
										children: t("healthUnused")
									})
								]
							}, entry.path))]
						})
					}),
					tab === "dupes" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-health-body",
						"data-health-body": "dupes",
						children: dupesData === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-empty",
							children: t("healthEmptyHint")
						}) : dupesData.groups.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-empty",
							children: t("healthNoDupes")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-dupes-list",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-size-summary iv-meta",
								children: [
									t("healthReclaimable"),
									": ",
									formatBytes(dupesData.reclaimableBytes),
									" · ",
									dupesData.hashedFiles + dupesData.skippedFiles,
									" files"
								]
							}), dupesData.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-dupes-group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-dupes-group-head iv-meta",
									children: [
										group.paths.length,
										" × ",
										formatBytes(group.bytes),
										" → ",
										formatBytes(group.reclaimableBytes)
									]
								}), group.paths.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `iv-dupes-item${path === group.keep ? " keep" : ""}`,
									"data-dupe-path": path,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-ellipsis",
										title: path,
										children: fileName(path)
									}), path === group.keep && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-chip iv-chip--ok",
										children: t("healthSuggestedKeep")
									})]
								}, path))]
							}, group.keep))]
						})
					}),
					tab === "stats" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-health-body",
						"data-health-body": "stats",
						children: statsData === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-empty",
							children: t("healthEmptyHint")
						}) : statsData.projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "iv-empty",
							children: t("healthNoProjects")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-stats-list",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-size-summary iv-meta",
								children: [
									t("healthSizeSummary"),
									": ",
									formatBytes(statsData.totalBytes)
								]
							}), statsData.projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-stats-row",
								"data-stat-project": project.projectId,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "iv-stats-name iv-ellipsis",
									title: project.name,
									children: project.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-stats-facts iv-meta",
									children: [
										project.assets,
										" ",
										t("healthAssets"),
										" · ",
										formatBytes(project.bytes),
										" · ",
										t("healthReferenced"),
										" ",
										formatBytes(project.usedBytes),
										" · ",
										project.timelines,
										" ",
										t("healthTimelines")
									]
								})]
							}, project.projectId))]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/panels/TimelineSegmentPreview.tsx
		/**
		* B-13 时间轴逐段预览：按片段顺序播放视频轨上的素材，显示当前段与总时长。
		*
		* 这里只做逐段播放，不合成；真成片由宿主 ffmpeg 导出。切段时通过 `key` 重挂
		* `<video>`，避免残留上一段的位置与播放状态。
		*/
		/** `m:ss` 文案（`0:03`）。 */
		function formatMs(ms) {
			const total = Math.max(0, Math.round(ms / 1e3));
			return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
		}
		/** 视频轨上带素材的片段，按起点排序。 */
		function collectVideoClips(timeline) {
			if (timeline === void 0) return [];
			const track = timeline.tracks.find((item) => item.kind === "video");
			if (track === void 0) return [];
			return track.clips.filter((clip) => clip.assetPath !== void 0).slice().sort((a, b) => a.startMs - b.startMs);
		}
		/** `/outputs/<文件名>`：宿主把 outputs 目录按文件名暴露给界面。 */
		function outputUrl$1(path) {
			return `/outputs/${encodeURIComponent(path.split(/[\\/]/).pop() ?? "")}`;
		}
		function TimelineSegmentPreview({ timeline, t }) {
			const clips = (0, react.useMemo)(() => collectVideoClips(timeline), [timeline]);
			const [index, setIndex] = (0, react.useState)(0);
			const [playing, setPlaying] = (0, react.useState)(false);
			const videoRef = (0, react.useRef)(null);
			const totalMs = clips.reduce((sum, clip) => sum + clip.durationMs, 0);
			const current = clips[Math.min(index, clips.length - 1)];
			(0, react.useEffect)(() => {
				setIndex(0);
				setPlaying(false);
			}, [timeline?.id]);
			(0, react.useEffect)(() => {
				const video = videoRef.current;
				if (!playing || video === null) return;
				const advance = () => {
					if (index < clips.length - 1) setIndex(index + 1);
					else setPlaying(false);
				};
				video.addEventListener("ended", advance);
				return () => {
					video.removeEventListener("ended", advance);
				};
			}, [
				playing,
				index,
				clips.length
			]);
			(0, react.useEffect)(() => {
				const video = videoRef.current;
				if (video === null) return;
				if (playing) video.play().catch(() => {
					setPlaying(false);
				});
				else video.pause();
			}, [playing, index]);
			if (clips.length === 0 || current === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "iv-seg-preview",
				"data-seg-preview": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "iv-empty",
					children: t("segPreviewEmpty")
				})
			});
			const seek = (next) => {
				if (next < 0 || next >= clips.length) return;
				setIndex(next);
				setPlaying(true);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-seg-preview",
				"data-seg-preview": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-seg-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								onClick: () => {
									setPlaying((value) => !value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: playing ? "pause" : "play",
									size: 11
								}), playing ? t("segPause") : t("segPlay")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "iv-btn iv-btn--ghost iv-btn--sm",
								onClick: () => {
									seek(0);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "undo",
									size: 11
								}), t("segReplay")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "iv-meta",
								"data-seg-counter": "true",
								children: [
									index + 1,
									" / ",
									clips.length,
									" · ",
									t("segTotal"),
									" ",
									formatMs(totalMs)
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
						ref: videoRef,
						className: "iv-seg-video",
						src: outputUrl$1(current.assetPath ?? ""),
						preload: "metadata",
						playsInline: true,
						muted: true
					}, `${current.id}`),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-seg-bar",
						role: "group",
						"aria-label": t("segPreviewTitle"),
						children: clips.map((clip, position) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: `iv-seg-cell${position === index ? " on" : ""}`,
							style: { flexGrow: Math.max(1, clip.durationMs) },
							"aria-label": `${t("segJump")} ${position + 1}`,
							title: `#${position + 1} · ${formatMs(clip.durationMs)}`,
							onClick: () => {
								seek(position);
							}
						}, clip.id))
					})
				]
			});
		}
		//#endregion
		//#region src/client/panels/TaskCard.tsx
		/**
		* B-12 生成结果卡片：任务列表的一行，带缩略图与产物操作。
		*
		* 状态文案/圆点/摘要由调用方算好传入，避免与 Workbench 里的同名辅助函数重复。
		*/
		/** `/outputs/<文件名>`：宿主把 outputs 目录按文件名暴露给界面。 */
		function outputUrl(path) {
			return `/outputs/${encodeURIComponent(path.split(/[\\/]/).pop() ?? "")}`;
		}
		function TaskCard(props) {
			const { api, task, projectId, statusLabel, dotClass, metaText, onPreview, onUseAsReference, onAddToTimeline, onTasksChanged, onAssetsChanged, onNotice, run, t } = props;
			const path = task.outputPath;
			const canOperate = path !== void 0 && task.status !== "running" && task.status !== "queued";
			/** 用原参数重跑一次。 */
			const regenerate = () => {
				const prompt = task.prompt?.trim() ?? "";
				if (prompt === "") {
					onNotice(t("regenerateNoPrompt"), "error");
					return;
				}
				run(async () => {
					await api.generateMedia({
						mediaMode: task.kind,
						prompt,
						projectId,
						model: task.model
					});
					await onTasksChanged();
					await onAssetsChanged();
				});
			};
			/** 把这条产物登记成项目素材。 */
			const register = () => {
				if (path === void 0 || projectId === void 0) return;
				run(async () => {
					if (!(await api.attachAsset({
						projectId,
						path,
						kind: task.kind,
						bytes: task.bytes,
						provider: task.provider,
						model: task.model,
						prompt: task.prompt
					})).created) onNotice(t("alreadyRegistered"), "info");
					await api.assignTask(task.id, projectId);
					await onAssetsChanged();
					await onTasksChanged();
				});
			};
			const cancel = () => {
				run(async () => {
					await api.cancelTask(task.id);
					await onTasksChanged();
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: "iv-row",
				"data-task-card": task.id,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: dotClass,
						"aria-hidden": "true"
					}),
					path === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "iv-tile",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
							name: task.kind === "video" ? "video" : "image",
							size: 13
						})
					}) : task.kind === "video" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
						className: "iv-thumb",
						src: outputUrl(path),
						preload: "metadata",
						muted: true,
						playsInline: true,
						"aria-hidden": "true"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: "iv-thumb",
						src: outputUrl(path),
						alt: ""
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "iv-row-btn",
						"aria-label": `${t("previewOutput")} ${task.id}`,
						disabled: path === void 0,
						onClick: () => {
							if (path !== void 0) onPreview(path, task.kind);
						},
						title: task.error ?? task.prompt ?? path ?? "",
						children: [
							statusLabel,
							" · ",
							metaText
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-row-actions",
						children: [
							task.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								"aria-label": `${t("cancelTask")} ${task.id}`,
								onClick: cancel,
								children: t("cancelTask")
							}),
							path !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								"aria-label": `${t("registerAsAsset")} ${task.id}`,
								title: t("registerAsAsset"),
								disabled: projectId === void 0,
								onClick: register,
								children: t("registerAsAsset")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								title: task.prompt === void 0 ? t("regenerateNoPrompt") : t("regenerateHint"),
								disabled: !canOperate,
								onClick: regenerate,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "refresh",
									size: 11
								}), t("regenerate")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								title: t("useAsRefHint"),
								disabled: !canOperate,
								onClick: () => {
									if (path !== void 0) onUseAsReference(path, task.kind);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "link",
									size: 11
								}), t("useAsReference")]
							}),
							task.kind === "video" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "iv-btn iv-btn--sm",
								title: onAddToTimeline === void 0 ? t("noTimelinesHint") : t("addToTimelineHint"),
								disabled: !canOperate || onAddToTimeline === void 0,
								onClick: () => {
									if (path !== void 0) onAddToTimeline?.(path);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
									name: "film",
									size: 11
								}), t("addToTimeline")]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/Workbench.tsx
		/**
		* Workbench surface: the right-pane tab body.
		*
		* Phase 1 shipped the skeleton and the host health check; this is the first
		* *usable* slice — create and pick a project, register a file from the output
		* directory as its asset, preview it, and remove records again. Everything it
		* does goes through the injected `api` (the `/image-video` channel), so no part
		* of this component reaches into the host directly.
		*
		* Presentation: one design-system sheet (`workbench-style.ts`, class prefix
		* `iv-`) injected once at mount, plus the stroke icon set (`icons.tsx`). All
		* colours resolve through the Harness design tokens with currentColor-mix
		* fallbacks (`R-NFR-3`); no deployment fact is baked into the bundle.
		*/
		/** Mode → dictionary key, in switch order. */
		const MODE_KEYS = {
			quick: "modeQuick",
			workflow: "modeWorkflow",
			timeline: "modeTimeline"
		};
		const MODES = [
			"quick",
			"workflow",
			"timeline"
		];
		/** Mode → icon (segmented switcher). */
		const MODE_ICONS = {
			quick: "bolt",
			workflow: "flow",
			timeline: "film"
		};
		/** Resource kind → icon (resource library rows). */
		const RESOURCE_ICONS = {
			"role": "user",
			"scene": "image",
			"prop": "box",
			"brand": "tag",
			"style": "sparkles",
			"voice": "music",
			"motion-track": "motion"
		};
		/** Timeline track kind → icon (track label column). */
		const TRACK_ICONS = {
			video: "video",
			audio: "music",
			subtitle: "subtitle"
		};
		/** Timeline track kind → NLE 轨号（V1/A1/S1，行业通用记法）。 */
		function trackIdKey(kind) {
			switch (kind) {
				case "video": return "trackVideoId";
				case "audio": return "trackAudioId";
				case "subtitle": return "trackSubtitleId";
			}
		}
		/**
		* 生效默认值的分组（弹层里按「媒体类型 / 图像 / 视频」分块）。
		* 7 个字段一次性平铺会变成一堵表单墙；分组后每组 1–3 项，扫读成本降一个量级。
		* `fields` 用接口字段名（下发 patch 的口径），与 `defaultRows[].field` 对齐。
		*/
		const DEFAULT_GROUPS = [
			{
				key: "defaultsGroupMode",
				fields: ["mediaMode"]
			},
			{
				key: "defaultsGroupImage",
				fields: [
					"imageProvider",
					"imageSize",
					"imageStyle"
				]
			},
			{
				key: "defaultsGroupVideo",
				fields: [
					"videoProvider",
					"videoAspectRatio",
					"videoDuration"
				]
			}
		];
		/**
		* 滚动到某个面板（左栏快捷入口用）。
		*
		* 停靠区四个面板在宽屏下本来就一直可见，`scrollIntoView` 对已在视口内的元素
		* 是"无事发生"——用户点按钮会觉得没反应。所以除了尽可能滚动，还回一手**视觉确认**：
		* 给目标面板加 `iv-pane--flash` 一次性高亮（2 秒渐隐的描边 + 底色）。
		*
		* @param pane - 目标面板的 `data-workbench-pane` 值。
		*/
		function scrollToPane(pane) {
			const target = document.querySelector(`[data-workbench-pane="${pane}"]`);
			if (target === null) return;
			target.scrollIntoView({
				behavior: "smooth",
				block: "nearest"
			});
			target.classList.remove("iv-pane--flash");
			target.offsetWidth;
			target.classList.add("iv-pane--flash");
			target.addEventListener("animationend", () => {
				target.classList.remove("iv-pane--flash");
			}, { once: true });
		}
		/** Save four-state → chip tone. */
		function saveChipClass(state) {
			switch (state) {
				case "saved": return "iv-chip iv-chip--ok";
				case "saving": return "iv-chip iv-chip--run";
				case "dirty": return "iv-chip iv-chip--warn";
				case "failed": return "iv-chip iv-chip--err";
			}
		}
		/** Task status → status-dot tone. */
		function taskDotClass(status) {
			switch (status) {
				case "running": return "iv-dot iv-dot--run";
				case "succeeded": return "iv-dot iv-dot--ok";
				case "failed": return "iv-dot iv-dot--err";
				default: return "iv-dot";
			}
		}
		/** `m:ss.d` of a millisecond offset, for the timeline timecode. */
		function timecode(ms) {
			const total = Math.max(0, ms) / 1e3;
			const minutes = Math.floor(total / 60);
			const seconds = Math.floor(total % 60);
			const tenths = Math.floor(total * 10 % 10);
			return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
		}
		/** Human-readable size for one asset row. */
		function formatBytes(bytes) {
			if (bytes <= 0) return "—";
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
			return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
		}
		/** Resource kinds in picker order. */
		const RESOURCE_KINDS = [
			"role",
			"scene",
			"prop",
			"brand",
			"style",
			"voice",
			"motion-track"
		];
		/**
		* `B-6`：模板描述（客户端侧映射）。`WorkflowTemplate` 只有 `labelKey` 没有
		* `describe`（数据层归 Track A），所以"这张卡是干什么的"由界面补一份；
		* 键即模板 id。
		*/
		const TEMPLATE_HINTS = {
			"quick-image": "templateQuickImageHint",
			"quick-video": "templateQuickVideoHint",
			"storyboard": "templateStoryboardHint",
			"cover": "templateCoverHint"
		};
		/** `B-6`：「快速上手」组的模板 id（A-1 的四个 2 秒模板），其余归「完整链路」。 */
		const QUICK_TEMPLATE_IDS = [
			"quick-image",
			"quick-video",
			"storyboard",
			"cover"
		];
		/** `B-8`：一个资源最多挂几张参考图（与 F2 生成表单同一口径，UI 护栏而非宿主限制）。 */
		const MAX_RESOURCE_REFS = 6;
		/**
		* `B-8`：资源的参考图列表（合并新旧字段）。
		* `A-3` 起新数据写 `assetPaths`；旧数据只有 `assetPath`。合并规则与数据层
		* 注释一致：**有 `assetPaths` 就以它为准**（整组替换语义），旧 `assetPath`
		* 只在没有 `assetPaths` 时兜底——否则删掉一张旧图后，它会被合并视图又放回来。
		* @param resource - 资源记录。
		* @returns 参考图路径（首图视为底图）。
		*/
		function resourceRefs(resource) {
			if (resource.assetPaths !== void 0) return resource.assetPaths;
			return resource.assetPath === void 0 ? [] : [resource.assetPath];
		}
		/**
		* 多参考图上限（`F2`）：首图=底图，其余=风格/脸部参考。
		* 6 是与工具侧 `images[]` 的实用上限对齐的客户端护栏（再多对构图帮助有限、
		* 请求体先变大），不是宿主限制。
		*/
		const MAX_REFERENCE_IMAGES = 6;
		/** 片段 id 生成器（分割/复制用；随机后缀保证同帧内多次操作也不撞 id）。 */
		function nextClipId() {
			return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		}
		/** Localized label for one timeline track kind. */
		function trackKindKey(kind) {
			switch (kind) {
				case "video": return "trackVideo";
				case "audio": return "trackAudio";
				case "subtitle": return "trackSubtitle";
			}
		}
		/** Localized label for one resource kind. */
		function kindKey(kind) {
			switch (kind) {
				case "role": return "kindRole";
				case "scene": return "kindScene";
				case "prop": return "kindProp";
				case "brand": return "kindBrand";
				case "style": return "kindStyle";
				case "motion-track": return "resourceMotionTrack";
				case "voice": return "kindVoice";
			}
		}
		/** Localized label for one task status. */
		function statusKey(status) {
			switch (status) {
				case "queued": return "statusQueued";
				case "running": return "statusRunning";
				case "succeeded": return "statusSucceeded";
				case "failed": return "statusFailed";
				case "cancelled": return "statusCancelled";
				case "imported-idle": return "statusImportedIdle";
			}
		}
		/** `HH:MM` of an ISO stamp, for the task list. */
		function clockTime(iso) {
			const parsed = new Date(iso);
			return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		/** File name of an absolute path. */
		function baseName(path) {
			return path.split("/").pop() ?? path;
		}
		/**
		* `B-10`：把宿主返回的结构化提示词拼成一段可编辑文本。
		* 宿主给了整段 `text` 就优先用它；否则按 主体→风格→材质→细节 拼接，缺字段跳过。
		* 各字段都为空时返回空串——界面据此提示"提取结果为空"，绝不编造内容。
		*/
		function composeExtractedPrompt(prompt) {
			const whole = prompt.text?.trim();
			if (whole !== void 0 && whole !== "") return whole;
			return [
				prompt.subject,
				prompt.style,
				prompt.material,
				prompt.details
			].map((part) => part?.trim() ?? "").filter((part) => part !== "").join(", ");
		}
		/** `B-9`：在选中的资源 id 列表里切换一个 id（保持追加顺序）。 */
		function toggleSelection(current, id) {
			return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id];
		}
		/** `B-9`：融合生图里一组可多选的资源 chip（角色 / 场景 / 物品各一组）。 */
		function FusionGroup(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-fusion-group",
				"data-fusion-group": props.kind,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "iv-meta",
					children: props.label
				}), props.resources.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "iv-meta",
					children: props.emptyHint
				}) : props.resources.map((resource) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: `iv-chip${props.selected.includes(resource.id) ? " iv-chip--ok" : ""}`,
					"aria-pressed": props.selected.includes(resource.id),
					"data-fusion-pick": resource.id,
					onClick: () => props.onToggle(resource.id),
					children: resource.name
				}, resource.id))]
			});
		}
		/**
		* 新建项目的空白成片文档（视频/音频/字幕三轨）。
		* @param project - 文档归属的项目。
		* @returns 尚未落库的时间轴记录。
		*/
		function emptyTimeline(project) {
			const stamp = (/* @__PURE__ */ new Date()).toISOString();
			return {
				schemaVersion: 1,
				id: newWorkbenchId("tml"),
				projectId: project.id,
				name: `${project.name} 成片`,
				frameRate: 30,
				tracks: [
					{
						id: "track-video",
						kind: "video",
						clips: []
					},
					{
						id: "track-audio",
						kind: "audio",
						clips: []
					},
					{
						id: "track-subtitle",
						kind: "subtitle",
						clips: []
					}
				],
				burnSubtitles: true,
				createdAt: stamp,
				updatedAt: stamp
			};
		}
		/**
		* Render the workbench.
		* @param props - seat runtime hooks, the injected API, and localized copy.
		* @returns the workbench surface.
		*/
		function Workbench(props) {
			const { api, kind, t, useTabInfo } = props;
			const { sidebar, tab } = useTabInfo();
			useWorkbenchStyle();
			const apiRef = (0, react.useRef)(api);
			apiRef.current = api;
			const [mode, setMode] = (0, react.useState)("quick");
			const [workflow, setWorkflow] = (0, react.useState)(void 0);
			const [workflowState, setWorkflowState] = (0, react.useState)("saved");
			const [runs, setRuns] = (0, react.useState)([]);
			const [selectedRunId, setSelectedRunId] = (0, react.useState)(void 0);
			const [runBusy, setRunBusy] = (0, react.useState)(false);
			const [timeline, setTimeline] = (0, react.useState)(void 0);
			const [timelineState, setTimelineState] = (0, react.useState)("saved");
			const [clipAssetPath, setClipAssetPath] = (0, react.useState)("");
			const [subtitleDraft, setSubtitleDraft] = (0, react.useState)("");
			const [subtitleBatchDraft, setSubtitleBatchDraft] = (0, react.useState)("");
			const [templateOpen, setTemplateOpen] = (0, react.useState)(false);
			const [diagnostics, setDiagnostics] = (0, react.useState)(void 0);
			const [previewMs, setPreviewMs] = (0, react.useState)(0);
			const [refreshTick, setRefreshTick] = (0, react.useState)(0);
			const [ffmpeg, setFfmpeg] = (0, react.useState)(void 0);
			const [resourceUsage, setResourceUsage] = (0, react.useState)([]);
			const [defaultsDraft, setDefaultsDraft] = (0, react.useState)(void 0);
			const [renderJob, setRenderJob] = (0, react.useState)(void 0);
			const [health, setHealth] = (0, react.useState)({ status: "checking" });
			const [exportResolution, setExportResolution] = (0, react.useState)("default");
			const [exportFps, setExportFps] = (0, react.useState)(30);
			const [exportAspect, setExportAspect] = (0, react.useState)("landscape");
			const [assetRegistered, setAssetRegistered] = (0, react.useState)(false);
			const [projects, setProjects] = (0, react.useState)([]);
			const [activeId, setActiveId] = (0, react.useState)(void 0);
			const [assets, setAssets] = (0, react.useState)([]);
			const [outputs, setOutputs] = (0, react.useState)([]);
			const [tasks, setTasksRaw] = (0, react.useState)([]);
			const setTasks = (value) => {
				setTasksRaw(value);
			};
			const [resources, setResources] = (0, react.useState)([]);
			const [assetFilter, setAssetFilter] = (0, react.useState)("all");
			const [selectedAssetIds, setSelectedAssetIds] = (0, react.useState)([]);
			const [bulkForceIds, setBulkForceIds] = (0, react.useState)(void 0);
			const [resourceTab, setResourceTab] = (0, react.useState)("role");
			const [resourceOtherKind, setResourceOtherKind] = (0, react.useState)("brand");
			const [resourceFilter, setResourceFilter] = (0, react.useState)("");
			const [resourceName, setResourceName] = (0, react.useState)("");
			const [resourceAsset, setResourceAsset] = (0, react.useState)(void 0);
			const [resourceNote, setResourceNote] = (0, react.useState)("");
			const [editingResourceId, setEditingResourceId] = (0, react.useState)(void 0);
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameValue, setRenameValue] = (0, react.useState)("");
			const [saveState, setSaveState] = (0, react.useState)("saved");
			const [selectedId, setSelectedId] = (0, react.useState)(void 0);
			const [previewPath, setPreviewPath] = (0, react.useState)(void 0);
			const [name, setName] = (0, react.useState)("");
			const [confirming, setConfirming] = (0, react.useState)(void 0);
			const [forceTarget, setForceTarget] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const [generatePrompt, setGeneratePrompt] = (0, react.useState)("");
			const [generating, setGenerating] = (0, react.useState)(void 0);
			const [generateTaskId, setGenerateTaskId] = (0, react.useState)(void 0);
			const [generateImages, setGenerateImages] = (0, react.useState)([]);
			const [refDragFrom, setRefDragFrom] = (0, react.useState)(void 0);
			const [refDropAt, setRefDropAt] = (0, react.useState)(void 0);
			const [generateLastFrame, setGenerateLastFrame] = (0, react.useState)(void 0);
			const [generateRefVideo, setGenerateRefVideo] = (0, react.useState)(void 0);
			const [generateRealPerson, setGenerateRealPerson] = (0, react.useState)(false);
			const [generateStartedAt, setGenerateStartedAt] = (0, react.useState)(void 0);
			const [runningGenerations, setRunningGenerations] = (0, react.useState)([]);
			const [generateSize, setGenerateSize] = (0, react.useState)("");
			const [generateAspect, setGenerateAspect] = (0, react.useState)("");
			const [generateDuration, setGenerateDuration] = (0, react.useState)("");
			const [composePrompt, setComposePrompt] = (0, react.useState)("");
			const [composeRoles, setComposeRoles] = (0, react.useState)([]);
			const [composeScenes, setComposeScenes] = (0, react.useState)([]);
			const [composeProps, setComposeProps] = (0, react.useState)([]);
			const [composing, setComposing] = (0, react.useState)(false);
			const [promptDraft, setPromptDraft] = (0, react.useState)("");
			const [promptName, setPromptName] = (0, react.useState)("");
			const [prompts, setPrompts] = (0, react.useState)([]);
			const [extracting, setExtracting] = (0, react.useState)(false);
			/** 生成后刷新当前项目的素材列表。 */
			const refreshAssetsAfterGenerate = async () => {
				if (activeId === void 0) return;
				try {
					setAssets(await apiRef.current.listAssets(activeId));
				} catch {}
			};
			/** 追加一张参考图（`F2`）：按序追加、去重、封顶 6 张。 */
			const addReferenceImage = (path) => {
				if (path === void 0) return;
				if (generateImages.includes(path)) return;
				if (generateImages.length >= MAX_REFERENCE_IMAGES) {
					setNotice({
						text: t("generateRefsFull"),
						tone: "error"
					});
					return;
				}
				setGenerateImages([...generateImages, path]);
				setNotice({
					text: `${t("referenceAsset")}：${baseName(path)}`,
					tone: "info"
				});
			};
			/** 参考图排序（`F2`）：把 from 位置移到 to 位置（拖拽落点或箭头按钮共用）。 */
			const moveReferenceImage = (from, to) => {
				if (from === to || to < 0 || to >= generateImages.length) return;
				const next = [...generateImages];
				const [moved] = next.splice(from, 1);
				if (moved === void 0) return;
				next.splice(to, 0, moved);
				setGenerateImages(next);
			};
			/**
			* 视频参考素材序列（`G4`）：首帧（若有）+ 尾帧 + 参考视频。
			* 与工具 `media[]` 同构；`media` 存在时工具的 `image` 字段被忽略，
			* 所以首帧也必须进这个数组，不能只发 `image`。
			*/
			const buildVideoMedia = () => {
				const entries = [];
				const first = generateImages[0];
				if (first !== void 0) entries.push({
					image: first,
					type: "first_frame"
				});
				if (generateLastFrame !== void 0) entries.push({
					image: generateLastFrame,
					type: "last_frame"
				});
				if (generateRefVideo !== void 0) entries.push({
					video: generateRefVideo,
					type: "reference_video"
				});
				return entries;
			};
			/** 发一次生成（图片同步等待；视频立刻拿 taskId 交给轮询）。 */
			const runGenerate = async (mediaMode) => {
				const prompt = generatePrompt.trim();
				if (prompt === "") return;
				if (activeId === void 0) {
					setNotice({
						text: t("generateNeedsProject"),
						tone: "error"
					});
					return;
				}
				setGenerating(mediaMode);
				setGenerateStartedAt(Date.now());
				try {
					const references = generateImages;
					const first = references[0];
					const videoMedia = mediaMode === "video" ? buildVideoMedia() : [];
					const result = await apiRef.current.generateMedia({
						mediaMode,
						prompt,
						projectId: activeId,
						...references.length === 0 ? {} : mediaMode === "image" ? references.length === 1 ? { image: first } : { images: references } : videoMedia.length === 0 && references.length >= 1 ? { image: first } : {},
						...videoMedia.length > 0 ? { media: videoMedia } : {},
						...mediaMode === "video" && generateRealPerson ? { realPerson: true } : {},
						...mediaMode === "image" ? generateSize.trim() === "" ? {} : { size: generateSize.trim() } : {
							...generateAspect.trim() === "" ? {} : { aspectRatio: generateAspect.trim() },
							...Number(generateDuration) > 0 ? { duration: Number(generateDuration) } : {}
						},
						...mediaMode === "video" ? { wait: false } : {}
					});
					if (result.pending === true && result.taskId !== void 0) {
						setGenerateTaskId(result.taskId);
						return;
					}
					await refreshAssetsAfterGenerate();
					setGeneratePrompt("");
					setNotice({
						text: t("generateDone"),
						tone: "info"
					});
				} catch (error) {
					setNotice({
						text: `${t("generateFailed")}：${error instanceof Error ? error.message : String(error)}`,
						tone: "error"
					});
				} finally {
					if (mediaMode === "image") setGenerating(void 0);
				}
			};
			/** 追踪非阻塞视频生成：任务结束（成功/失败/取消）时收尾。 */
			(0, react.useEffect)(() => {
				if (generateTaskId === void 0) return;
				const row = tasks.find((task) => task.id === generateTaskId);
				if (row === void 0 || row.status === "running") return;
				setGenerateTaskId(void 0);
				setGenerating(void 0);
				if (row.status === "succeeded") {
					refreshAssetsAfterGenerate();
					setGeneratePrompt("");
					setNotice({
						text: t("generateDone"),
						tone: "info"
					});
					return;
				}
				if (row.status === "cancelled") {
					setNotice({
						text: t("generateCancel"),
						tone: "info"
					});
					return;
				}
				setNotice({
					text: `${t("generateFailed")}：${row.error ?? ""}`,
					tone: "error"
				});
			}, [
				generateTaskId,
				tasks,
				activeId
			]);
			(0, react.useEffect)(() => {
				if (generating === void 0) {
					setRunningGenerations([]);
					return;
				}
				let stale = false;
				(async () => {
					try {
						const rows = await apiRef.current.listRunningTasks();
						if (!stale) setRunningGenerations(rows);
					} catch {}
				})();
				return () => {
					stale = true;
				};
			}, [
				generating,
				generateTaskId,
				refreshTick
			]);
			const activeRunning = runningGenerations.find((entry) => entry.id === generateTaskId);
			const elapsedSeconds = useElapsedSeconds((() => {
				if (generating === void 0) return void 0;
				const stamp = activeRunning?.startedAt;
				const parsed = stamp === void 0 ? NaN : Date.parse(stamp);
				return Number.isNaN(parsed) ? generateStartedAt : parsed;
			})());
			const activeProject = projects.find((project) => project.id === activeId);
			(0, react.useEffect)(() => {
				if (mode !== "workflow" || activeProject === void 0) return;
				const project = activeProject;
				(async () => {
					try {
						const existing = (await apiRef.current.listWorkflows(project.id))[0];
						if (existing !== void 0) {
							setWorkflow(existing);
							setWorkflowState("saved");
							return;
						}
						setWorkflow((current) => {
							if (current !== void 0 && current.projectId === project.id) return current;
							const stamp = (/* @__PURE__ */ new Date()).toISOString();
							return {
								schemaVersion: 1,
								id: newWorkbenchId("wfl"),
								projectId: project.id,
								name: `${project.name} 工作流`,
								nodes: [],
								edges: [],
								createdAt: stamp,
								updatedAt: stamp
							};
						});
						setWorkflowState("saved");
					} catch (error) {
						setNotice({
							text: error instanceof Error ? error.message : String(error),
							tone: "error"
						});
					}
				})();
			}, [mode, activeProject]);
			(0, react.useEffect)(() => {
				if (mode !== "workflow" || activeProject === void 0 || workflow === void 0) {
					setRuns([]);
					setSelectedRunId(void 0);
					return;
				}
				const project = activeProject;
				const workflowId = workflow.id;
				let stale = false;
				(async () => {
					try {
						const rows = await apiRef.current.listRuns(project.id, workflowId);
						if (stale) return;
						setRuns(rows);
						setSelectedRunId((current) => current ?? rows[0]?.id);
					} catch (error) {
						if (!stale) setNotice({
							text: error instanceof Error ? error.message : String(error),
							tone: "error"
						});
					}
				})();
				return () => {
					stale = true;
				};
			}, [
				mode,
				activeProject,
				workflow?.id
			]);
			const runningRun = runs.some((run) => run.status === "running");
			(0, react.useEffect)(() => {
				if (mode !== "timeline" || activeProject === void 0) {
					setTimeline(void 0);
					return;
				}
				const project = activeProject;
				let stale = false;
				(async () => {
					try {
						const rows = await apiRef.current.listTimelines(project.id);
						if (stale) return;
						const existing = rows[0];
						if (existing !== void 0) {
							setTimeline(existing);
							setTimelineState("saved");
							return;
						}
						setTimeline((current) => current !== void 0 && current.projectId === project.id ? current : emptyTimeline(project));
						setTimelineState("saved");
					} catch (error) {
						if (!stale) setNotice({
							text: error instanceof Error ? error.message : String(error),
							tone: "error"
						});
					}
				})();
				return () => {
					stale = true;
				};
			}, [mode, activeProject]);
			(0, react.useEffect)(() => {
				if (activeProject === void 0) {
					setResourceUsage([]);
					return;
				}
				const project = activeProject;
				let stale = false;
				(async () => {
					try {
						const rows = await apiRef.current.listResourceUsage({ projectId: project.id });
						if (!stale) setResourceUsage(rows);
					} catch {}
				})();
				return () => {
					stale = true;
				};
			}, [activeProject, resources.length]);
			const recheckFfmpeg = (0, react.useCallback)(async () => {
				try {
					setFfmpeg(await apiRef.current.probeFfmpeg());
				} catch (error) {
					setNotice({
						text: error instanceof Error ? error.message : String(error),
						tone: "error"
					});
				}
			}, []);
			/** 拉一次诊断快照（`B15` 诊断面板；不拦全局 busy，失败静默丢给面板显示）。 */
			const loadDiagnostics = (0, react.useCallback)(async () => {
				try {
					setDiagnostics(await apiRef.current.getDiagnostics());
				} catch (error) {
					setNotice({
						text: error instanceof Error ? error.message : String(error),
						tone: "error"
					});
				}
			}, []);
			(0, react.useEffect)(() => {
				loadDiagnostics();
			}, [loadDiagnostics]);
			(0, react.useEffect)(() => {
				if (mode !== "timeline") return;
				let stale = false;
				(async () => {
					try {
						const probe = await apiRef.current.probeFfmpeg();
						if (!stale) setFfmpeg(probe);
					} catch {}
				})();
				return () => {
					stale = true;
				};
			}, [mode]);
			const renderRunning = renderJob?.status === "running";
			(0, react.useEffect)(() => {
				if (mode !== "timeline" || activeProject === void 0) return;
				const project = activeProject;
				let stale = false;
				(async () => {
					try {
						const jobs = await apiRef.current.listRenders(project.id);
						if (!stale) setRenderJob(jobs[0]);
					} catch {}
				})();
				return () => {
					stale = true;
				};
			}, [mode, activeProject]);
			const timelineDirty = timelineState === "dirty";
			(0, react.useEffect)(() => {
				if (mode !== "timeline" || !timelineDirty || timeline === void 0) return;
				const pending = timeline;
				const timer = setTimeout(() => {
					(async () => {
						setTimelineState("saving");
						try {
							setTimeline(await apiRef.current.saveTimeline({
								id: pending.id,
								projectId: pending.projectId,
								name: pending.name,
								tracks: pending.tracks,
								frameRate: pending.frameRate,
								burnSubtitles: pending.burnSubtitles,
								exportFormat: pending.exportFormat,
								normalizeLoudness: pending.normalizeLoudness
							}));
							setTimelineState("saved");
						} catch (error) {
							setTimelineState("failed");
							setNotice({
								text: error instanceof Error ? error.message : String(error),
								tone: "error"
							});
						}
					})();
				}, 800);
				return () => {
					clearTimeout(timer);
				};
			}, [
				timelineDirty,
				timeline,
				mode
			]);
			const workflowDirty = workflowState === "dirty";
			(0, react.useEffect)(() => {
				if (mode !== "workflow" || !workflowDirty || workflow === void 0) return;
				const pending = workflow;
				const timer = setTimeout(() => {
					(async () => {
						setWorkflowState("saving");
						try {
							setWorkflow(await apiRef.current.saveWorkflow({
								id: pending.id,
								projectId: pending.projectId,
								name: pending.name,
								nodes: pending.nodes,
								edges: pending.edges
							}));
							setWorkflowState("saved");
						} catch (error) {
							setWorkflowState("failed");
							setNotice({
								text: error instanceof Error ? error.message : String(error),
								tone: "error"
							});
						}
					})();
				}, 800);
				return () => {
					clearTimeout(timer);
				};
			}, [
				workflowDirty,
				workflow,
				mode
			]);
			/** 时间轴总时长与当前播放头处的活动片段（顺序预览用）。 */
			const timelineTotal = timeline === void 0 ? MIN_TIMELINE_MS : Math.max(MIN_TIMELINE_MS, timelineDurationMs(timeline.tracks));
			const playheadMs = Math.max(0, Math.min(previewMs, timelineTotal));
			const activeVideo = timeline === void 0 ? void 0 : activeClipAt(timeline.tracks, "video", playheadMs);
			const activeSubtitle = timeline === void 0 ? void 0 : activeClipAt(timeline.tracks, "subtitle", playheadMs);
			/** 时间轴通用改法：换掉某条轨道。 */
			const patchTrack = (trackId, update) => {
				setTimeline((current) => current === void 0 ? current : {
					...current,
					tracks: current.tracks.map((track) => track.id === trackId ? update(track) : track)
				});
				setTimelineState("dirty");
			};
			/** 时间轴通用改法：换掉某个片段（`B14` clip 控件共用）。 */
			const patchClip = (trackId, clipId, update) => {
				patchTrack(trackId, (track) => ({
					...track,
					clips: track.clips.map((clip) => clip.id === clipId ? update(clip) : clip)
				}));
			};
			/** 末尾追加一个 clip（起点接在该轨当前末尾）。 */
			const appendClip = (trackId, clip) => {
				(/* @__PURE__ */ new Date()).toISOString();
				patchTrack(trackId, (track) => {
					const end = track.clips.reduce((longest, existing) => Math.max(longest, existing.startMs + existing.durationMs), 0);
					const id = `clip-${Date.now().toString(36)}-${track.clips.length}`;
					return {
						...track,
						clips: [...track.clips, {
							id,
							startMs: end,
							durationMs: 3e3,
							...clip.assetPath === void 0 ? {} : { assetPath: clip.assetPath },
							...clip.text === void 0 ? {} : { text: clip.text }
						}]
					};
				});
			};
			/**
			* `B-12`：把一条生成产物追加到当前项目时间轴的视频轨。
			*
			* 快速生成模式下时间轴没有载入（`timeline === undefined`），所以先读回该项目已有文档，
			* 没有就新建一份，追加后立即落库 —— 不依赖时间轴模式的去抖保存。
			* @param path - 产物在 outputs 里的路径。
			*/
			const appendToTimeline = (path) => {
				const project = activeProject;
				if (project === void 0) return;
				run(async () => {
					let doc = timeline !== void 0 && timeline.projectId === project.id ? timeline : void 0;
					if (doc === void 0) doc = (await apiRef.current.listTimelines(project.id))[0] ?? emptyTimeline(project);
					const videoTrack = doc.tracks.find((track) => track.kind === "video");
					const end = videoTrack?.clips.reduce((longest, clip) => Math.max(longest, clip.startMs + clip.durationMs), 0) ?? 0;
					const clip = {
						id: nextClipId(),
						startMs: end,
						durationMs: 3e3,
						assetPath: path
					};
					const tracks = videoTrack === void 0 ? [...doc.tracks, {
						id: "track-video",
						kind: "video",
						clips: [clip]
					}] : doc.tracks.map((track) => track.id === videoTrack.id ? {
						...track,
						clips: [...track.clips, clip]
					} : track);
					setTimeline(await apiRef.current.saveTimeline({
						id: doc.id,
						projectId: doc.projectId,
						name: doc.name,
						tracks,
						frameRate: doc.frameRate,
						burnSubtitles: doc.burnSubtitles,
						exportFormat: doc.exportFormat,
						normalizeLoudness: doc.normalizeLoudness
					}));
					setTimelineState("saved");
					setNotice({
						text: t("addToTimelineDone"),
						tone: "info"
					});
				});
			};
			/**
			* 批量字幕（`B15`）：一段台词按句切分、按字数分配时间，一键铺到字幕轨末尾。
			* 复用域层 `planSubtitleClips`（与 Agent 的 `timeline add-subtitles` 同一套规则）。
			*/
			const applyBatchSubtitles = (trackId, script) => {
				if (timeline === void 0) return;
				const subtitleTrack = timeline.tracks.find((track) => track.kind === "subtitle");
				const trackEnd = subtitleTrack === void 0 || subtitleTrack.clips.length === 0 ? 0 : Math.max(...subtitleTrack.clips.map((clip) => clip.startMs + clip.durationMs));
				const totalMs = Math.max(trackEnd + 1e3, timelineDurationMs(timeline.tracks));
				const clips = planSubtitleClips(script.trim(), {
					startMs: trackEnd,
					endMs: Math.max(trackEnd + 1e3, totalMs)
				});
				if (clips.length === 0) {
					setNotice({
						text: t("subtitlesApply"),
						tone: "error"
					});
					return;
				}
				patchTrack(trackId, (track) => ({
					...track,
					clips: [...track.clips, ...clips]
				}));
			};
			/**
			* 把内置模板实例化成工作流记录（`B15` 模板市场）。
			* 两类模板（`WORKFLOW_TEMPLATES` 的 `WorkflowTemplate` 与 `DRAMA_TEMPLATES` 的 `DramaTemplate`）
			* 结构一致：节点 `kind + params?`（缺省参数用 `defaultParams` 补）＋ 下标连线。
			*/
			const instantiateAnyTemplate = (template) => {
				const stamp = (/* @__PURE__ */ new Date()).toISOString();
				const title = template.describe?.split("：")[0] ?? template.id;
				const id = newWorkbenchId("wfl");
				return {
					schemaVersion: 1,
					id,
					projectId: activeProject?.id ?? "",
					name: title,
					nodes: template.nodes.map((node, index) => ({
						id: `${id}-${index}`,
						kind: node.kind,
						position: {
							x: index % 4 * 220,
							y: Math.floor(index / 4) * 160
						},
						params: node.params ?? defaultParams(node.kind)
					})),
					edges: template.edges.map(([from, to]) => ({
						id: `${id}-${from}-${to}`,
						source: `${id}-${from}`,
						target: `${id}-${to}`
					})),
					createdAt: stamp,
					updatedAt: stamp
				};
			};
			/** 拖拽载荷的约定 MIME（素材入轨 / 片段移动各一种，与轨道 drop 对齐）。 */
			const ASSET_DRAG_TYPE = "application/x-iv-asset";
			const CLIP_DRAG_TYPE = "application/x-iv-clip";
			/** 当前拖放悬停的轨道（落点高亮）。 */
			const [dropTrackId, setDropTrackId] = (0, react.useState)(void 0);
			/** 选中的片段（键盘 Delete 与复制按钮用；UI 瞬时状态，不入库）。 */
			const [selectedClipId, setSelectedClipId] = (0, react.useState)(void 0);
			/** 正在拖的手柄（窗口级 mousemove/mouseup 期间活着）。 */
			const [resizing, setResizing] = (0, react.useState)(void 0);
			/** 轨道 lane 的 DOM 引用（量 rect 用：像素 ↔ 毫秒的换算基准）。 */
			const laneRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			/** 顺序播放开关。 */
			const [playing, setPlaying] = (0, react.useState)(false);
			/** 素材行开始拖拽：路径 + 媒体类型放进 dataTransfer。 */
			const onAssetDragStart = (event, asset) => {
				const payload = JSON.stringify({
					path: asset.path,
					kind: asset.kind
				});
				event.dataTransfer.setData(ASSET_DRAG_TYPE, payload);
				event.dataTransfer.setData("text/plain", payload);
				event.dataTransfer.effectAllowed = "copy";
			};
			/** 片段开始拖拽：带上所在轨道与片段 id（换轨/移动都认这个载荷）。 */
			const onClipDragStart = (event, trackId, clipId) => {
				event.dataTransfer.setData(CLIP_DRAG_TYPE, JSON.stringify({
					trackId,
					clipId
				}));
				event.dataTransfer.effectAllowed = "move";
				setSelectedClipId(clipId);
			};
			/** 轨道接受放置：素材 → 入轨；片段 → 移动起点（同种类轨道间接驳）。 */
			const onLaneDrop = (event, track) => {
				event.preventDefault();
				setDropTrackId(void 0);
				const rect = laneRefs.current.get(track.id)?.getBoundingClientRect();
				const dropMs = laneTimeFromClientX(event.clientX, {
					left: rect?.left ?? 0,
					width: rect?.width ?? 0
				}, timelineTotal);
				const clipPayload = event.dataTransfer.getData(CLIP_DRAG_TYPE);
				if (clipPayload !== "") {
					let source = {};
					try {
						source = JSON.parse(clipPayload);
					} catch {
						return;
					}
					if (source.clipId === void 0) return;
					const clipId = source.clipId;
					setTimeline((current) => {
						if (current === void 0) return current;
						let moved;
						let fromTrack;
						for (const candidate of current.tracks) {
							const found = candidate.clips.find((item) => item.id === clipId);
							if (found !== void 0) {
								moved = found;
								fromTrack = candidate;
								break;
							}
						}
						if (moved === void 0 || fromTrack === void 0 || fromTrack.kind !== track.kind) return current;
						const updated = {
							...moved,
							startMs: dropMs
						};
						return {
							...current,
							tracks: current.tracks.map((candidate) => {
								if (candidate.id === fromTrack?.id && candidate.id !== track.id) return {
									...candidate,
									clips: candidate.clips.filter((item) => item.id !== clipId)
								};
								if (candidate.id === track.id) return {
									...candidate,
									clips: candidate.clips.filter((item) => item.id !== clipId).concat(updated)
								};
								return candidate;
							})
						};
					});
					setTimelineState("dirty");
					return;
				}
				const assetPayload = event.dataTransfer.getData(ASSET_DRAG_TYPE) !== "" ? event.dataTransfer.getData(ASSET_DRAG_TYPE) : event.dataTransfer.getData("text/plain");
				if (assetPayload === "") return;
				let asset = {};
				try {
					asset = JSON.parse(assetPayload);
				} catch {
					return;
				}
				if (asset.path === void 0 || track.kind === "subtitle") return;
				if (asset.kind !== "video") return;
				patchTrack(track.id, (current) => ({
					...current,
					clips: current.clips.concat({
						id: `clip-${Date.now().toString(36)}-${current.clips.length}`,
						assetPath: asset.path,
						startMs: dropMs,
						durationMs: 3e3
					})
				}));
			};
			/** 手柄按下：记住起点，随后窗口级 mousemove 实时改片段。 */
			const onHandleMouseDown = (event, trackId, clipId, side) => {
				event.preventDefault();
				event.stopPropagation();
				setResizing({
					trackId,
					clipId,
					side,
					startX: event.clientX
				});
			};
			(0, react.useEffect)(() => {
				if (resizing === void 0) return;
				const lane = laneRefs.current.get(resizing.trackId);
				const onMove = (event) => {
					const usable = ((lane?.getBoundingClientRect())?.width ?? 0) - 16;
					if (usable <= 0) return;
					const deltaMs = (event.clientX - resizing.startX) / usable * timelineTotal;
					patchTrack(resizing.trackId, (current) => ({
						...current,
						clips: current.clips.map((item) => {
							if (item.id !== resizing.clipId) return item;
							return resizing.side === "left" ? {
								...item,
								...resizeClipLeft(item, deltaMs)
							} : {
								...item,
								...resizeClipRight(item, deltaMs)
							};
						})
					}));
				};
				const onUp = () => {
					setResizing(void 0);
				};
				window.addEventListener("mousemove", onMove);
				window.addEventListener("mouseup", onUp);
				return () => {
					window.removeEventListener("mousemove", onMove);
					window.removeEventListener("mouseup", onUp);
				};
			}, [resizing, timelineTotal]);
			/**
			* 复制片段（`B17`）：接域层 `duplicateClip`——与 Agent 的 `copy-clip`
			* 同一套规则（新 id、紧随原片段之后、不重叠）。界面不再自己算一份。
			*/
			const duplicateClip$1 = (clipId) => {
				if (timeline === void 0) return;
				try {
					const result = duplicateClip(timeline.tracks, clipId, nextClipId);
					setTimeline({
						...timeline,
						tracks: result.tracks
					});
					setTimelineState("dirty");
				} catch (error) {
					setNotice({
						text: error instanceof Error ? error.message : String(error),
						tone: "error"
					});
				}
				setSelectedClipId(void 0);
			};
			/**
			* 分割片段（`B17`）：接域层 `splitClipAt`——与 Agent 的 `split-clip` 同一套规则
			* （拆分点必须严格落在片段内部；两半时长之和守恒；右半补源内偏移 `inMs`，
			* 变速时按 `speed` 折算）。拆分点取当前播放头。
			*/
			const splitClip = (clipId) => {
				if (timeline === void 0) return;
				try {
					const result = splitClipAt(timeline.tracks, clipId, playheadMs, nextClipId);
					setTimeline({
						...timeline,
						tracks: result.tracks
					});
					setTimelineState("dirty");
					setSelectedClipId(result.rightId);
				} catch (error) {
					setNotice({
						text: error instanceof Error ? error.message : String(error),
						tone: "error"
					});
				}
			};
			/** 删除选中的片段（键盘 Delete 与垃圾桶按钮共用）。 */
			const removeSelectedClip = () => {
				if (selectedClipId === void 0) return;
				setTimeline((current) => current === void 0 ? current : {
					...current,
					tracks: current.tracks.map((track) => ({
						...track,
						clips: track.clips.filter((clip) => clip.id !== selectedClipId)
					}))
				});
				setTimelineState("dirty");
				setSelectedClipId(void 0);
			};
			/** 播放/暂停：不在任何片段里（或已到尽头）就从头开始；顺序播放跳过空隙。 */
			const togglePlay = () => {
				if (playing) {
					setPlaying(false);
					return;
				}
				if (playheadMs >= timelineTotal || activeVideo === void 0) setPreviewMs(0);
				setPlaying(true);
			};
			const previewMsRef = (0, react.useRef)(previewMs);
			previewMsRef.current = playheadMs;
			(0, react.useEffect)(() => {
				if (!playing || timeline === void 0) return;
				let last = Date.now();
				const timer = setInterval(() => {
					const now = Date.now();
					const delta = now - last;
					last = now;
					const current = previewMsRef.current;
					const active = activeClipAt(timeline.tracks, "video", current);
					let next = current + delta;
					if (active !== void 0 && next >= active.startMs + active.durationMs) {
						const following = nextVideoClipStart(timeline.tracks, active.startMs + active.durationMs);
						if (following === void 0) {
							setPlaying(false);
							previewMsRef.current = timelineTotal;
							setPreviewMs(timelineTotal);
							return;
						}
						next = following;
					}
					if (next >= timelineTotal) {
						setPlaying(false);
						previewMsRef.current = timelineTotal;
						setPreviewMs(timelineTotal);
						return;
					}
					previewMsRef.current = next;
					setPreviewMs(next);
				}, 100);
				return () => {
					clearInterval(timer);
				};
			}, [
				playing,
				timeline,
				timelineTotal
			]);
			(0, react.useEffect)(() => {
				if (mode !== "timeline") setPlaying(false);
			}, [mode]);
			(0, react.useEffect)(() => {
				if (mode !== "timeline") return;
				const onKeyDown = (event) => {
					const target = event.target;
					if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable === true)) return;
					if (event.key === " ") {
						event.preventDefault();
						togglePlay();
						return;
					}
					if (event.key === "Delete" || event.key === "Backspace") {
						if (selectedClipId === void 0) return;
						event.preventDefault();
						removeSelectedClip();
					}
				};
				window.addEventListener("keydown", onKeyDown);
				return () => {
					window.removeEventListener("keydown", onKeyDown);
				};
			});
			const selectedAsset = assets.find((asset) => asset.id === selectedId);
			const registeredPaths = new Set(assets.map((asset) => asset.path));
			const pendingOutputs = outputs.filter((output) => !registeredPaths.has(output.path));
			(0, react.useEffect)(() => {
				if (health.status !== "ok" || health.defaults === void 0) return;
				const defaults = health.defaults;
				setGenerateSize((previous) => previous === "" ? String(defaults.imageSize ?? "") : previous);
				setGenerateAspect((previous) => previous === "" ? String(defaults.videoAspectRatio ?? "") : previous);
				setGenerateDuration((previous) => previous === "" ? String(defaults.videoDuration ?? "") : previous);
			}, [health]);
			const previewTarget = selectedAsset === void 0 ? previewPath : {
				path: selectedAsset.path,
				kind: selectedAsset.kind
			};
			const visibleAssets = assetFilter === "all" ? assets : assets.filter((asset) => asset.kind === assetFilter);
			const activeResourceKind = resourceTab === "other" ? resourceOtherKind : resourceTab;
			const resourceNeedle = resourceFilter.trim();
			const visibleResources = resources.filter((resource) => resource.kind === activeResourceKind && (resourceNeedle === "" || resource.name.includes(resourceNeedle)));
			const composeSelection = [
				...composeRoles,
				...composeScenes,
				...composeProps
			];
			const composePreviewRefs = (() => {
				const seen = /* @__PURE__ */ new Set();
				const paths = [];
				for (const id of composeSelection) {
					const resource = resources.find((candidate) => candidate.id === id);
					if (resource === void 0) continue;
					for (const path of resourceRefs(resource)) {
						if (seen.has(path)) continue;
						seen.add(path);
						paths.push(path);
						if (paths.length >= MAX_REFERENCE_IMAGES) return paths;
					}
				}
				return paths;
			})();
			const composeResourcesOf = (kind) => resources.filter((resource) => resource.kind === kind);
			/** `B-9`：融合生图——资源 id 交宿主解析参考图并生成（A-4 未落地时如实报错）。 */
			const runCompose = async () => {
				const prompt = composePrompt.trim();
				if (prompt === "") {
					setNotice({
						text: t("fusionNeedsPrompt"),
						tone: "error"
					});
					return;
				}
				if (activeId === void 0) {
					setNotice({
						text: t("generateNeedsProject"),
						tone: "error"
					});
					return;
				}
				setComposing(true);
				try {
					const result = await apiRef.current.composeMedia({
						projectId: activeId,
						prompt,
						resourceIds: composeSelection
					});
					await refreshAssetsAfterGenerate();
					setComposePrompt("");
					const suffix = result.path === void 0 ? "" : `：${baseName(result.path)}`;
					setNotice({
						text: `${t("fusionDone")}${suffix}`,
						tone: "info"
					});
				} catch (error) {
					setNotice({
						text: `${t("fusionFailed")}：${error instanceof Error ? error.message : String(error)}`,
						tone: "error"
					});
				} finally {
					setComposing(false);
				}
			};
			(0, react.useEffect)(() => {
				let stale = false;
				(async () => {
					try {
						const rows = await apiRef.current.listPrompts();
						if (!stale) setPrompts(rows);
					} catch {}
				})();
				return () => {
					stale = true;
				};
			}, []);
			/** `B-10`：从选中的图片素材提取结构化提示词（不可用则如实报错，不伪造结果）。 */
			const runExtractPrompt = async () => {
				if (selectedAsset === void 0 || selectedAsset.kind !== "image") {
					setNotice({
						text: t("promptExtractNeedsAsset"),
						tone: "error"
					});
					return;
				}
				setExtracting(true);
				try {
					const text = composeExtractedPrompt(await apiRef.current.extractPrompt({ path: selectedAsset.path }));
					setPromptDraft(text);
					if (promptName.trim() === "") setPromptName(baseName(selectedAsset.path));
					if (text === "") setNotice({
						text: t("promptExtractEmpty"),
						tone: "error"
					});
					else setNotice({
						text: t("promptExtractDone"),
						tone: "info"
					});
				} catch (error) {
					setNotice({
						text: `${t("promptExtractFailed")}：${error instanceof Error ? error.message : String(error)}`,
						tone: "error"
					});
				} finally {
					setExtracting(false);
				}
			};
			/** `B-10`：把提取/编辑后的结果存入提示词库。 */
			const savePromptDraft = async () => {
				const text = promptDraft.trim();
				if (text === "") {
					setNotice({
						text: t("promptNeedsText"),
						tone: "error"
					});
					return;
				}
				const name = promptName.trim() === "" ? t("promptUntitled") : promptName.trim();
				try {
					const saved = await apiRef.current.savePrompt({
						name,
						text
					});
					setPrompts((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
					setNotice({
						text: t("promptSaveDone"),
						tone: "info"
					});
				} catch (error) {
					setNotice({
						text: `${t("promptSaveFailed")}：${error instanceof Error ? error.message : String(error)}`,
						tone: "error"
					});
				}
			};
			/** `B-10`：删除一条提示词。 */
			const removePromptRecord = async (id) => {
				try {
					await apiRef.current.removePrompt(id);
					setPrompts((current) => current.filter((record) => record.id !== id));
				} catch (error) {
					setNotice({
						text: `${t("promptSaveFailed")}：${error instanceof Error ? error.message : String(error)}`,
						tone: "error"
					});
				}
			};
			/** `B-10`：把库里的提示词一键带入生成表单。 */
			const applyPrompt = (text) => {
				setGeneratePrompt(text);
				setNotice({
					text: t("promptApplyDone"),
					tone: "info"
				});
			};
			/** Run one host action, surfacing failure as a notice instead of a crash. */
			const run = (0, react.useCallback)(async (action) => {
				setBusy(true);
				setNotice(void 0);
				try {
					await action();
				} catch (error) {
					setNotice({
						text: error instanceof Error ? error.message : String(error),
						tone: "error"
					});
				} finally {
					setBusy(false);
				}
			}, []);
			const loadProjects = (0, react.useCallback)(async () => {
				const list = await apiRef.current.listProjects();
				setProjects(list);
				setActiveId((previous) => previous !== void 0 && list.some((item) => item.id === previous) ? previous : list[0]?.id);
			}, []);
			const loadOutputs = (0, react.useCallback)(async () => {
				setOutputs(await apiRef.current.listOutputs());
			}, []);
			const loadTasks = (0, react.useCallback)(async () => {
				setTasks(await apiRef.current.listTasks());
			}, []);
			const loadResources = (0, react.useCallback)(async (projectId) => {
				setResources(await apiRef.current.listResources(projectId));
			}, []);
			/** 多选当前仍存在的素材（已删掉的自动退出选择，计数不会虚高）。 */
			const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
			/** 切换某个素材的选中态。 */
			const toggleAssetSelection = (id) => {
				setSelectedAssetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
				setBulkForceIds(void 0);
			};
			/** 批量删除：一次 `assets/remove-many`；被引用的进 skipped 并给"仍要删除"。 */
			const bulkRemoveAssets = (force) => {
				const ids = force ? bulkForceIds ?? [] : selectedAssetIds;
				if (ids.length === 0) return;
				run(async () => {
					const result = await apiRef.current.removeAssets({
						ids,
						...force ? { force: true } : {}
					});
					const skippedIds = new Set(result.skipped.map((entry) => entry.id));
					setSelectedAssetIds((current) => current.filter((id) => skippedIds.has(id)));
					if (activeProject !== void 0) setAssets(await apiRef.current.listAssets(activeProject.id));
					if (result.skipped.length === 0) {
						setBulkForceIds(void 0);
						setNotice({
							text: t("bulkRemoveDone").replace("{n}", String(result.removed)),
							tone: "info"
						});
						return;
					}
					if (!force) setBulkForceIds([...skippedIds]);
					setNotice({
						text: `${t("bulkRemoveDone").replace("{n}", String(result.removed))} · ${t("bulkRemoveSkipped").replace("{n}", String(result.skipped.length))}`,
						tone: "error"
					});
				});
			};
			/** 批量引用：把选中的图片按列表顺序加进生成表单的参考图（封顶 6 张）。 */
			const bulkReferenceAssets = () => {
				const paths = selectedAssets.filter((asset) => asset.kind === "image").map((asset) => asset.path).filter((path) => !generateImages.includes(path));
				if (paths.length === 0) {
					setNotice({
						text: t("bulkReferenceNone"),
						tone: "error"
					});
					return;
				}
				const room = Math.max(0, MAX_REFERENCE_IMAGES - generateImages.length);
				const accepted = paths.slice(0, room);
				if (accepted.length === 0) {
					setNotice({
						text: t("generateRefsFull"),
						tone: "error"
					});
					return;
				}
				setGenerateImages([...generateImages, ...accepted]);
				setNotice({
					text: `${t("bulkReferenceDone").replace("{n}", String(accepted.length))}${accepted.length < paths.length ? ` · ${t("generateRefsFull")}` : ""}`,
					tone: "info"
				});
			};
			const editingResource = resources.find((resource) => resource.id === editingResourceId);
			/**
			* 给资源挂一张参考图（「把选中素材归到该角色」）。
			* `assetPaths` 是整组替换语义（宿主无 append 动作），所以先读当前值再 concat。
			*/
			const attachRefToResource = (resourceId, path) => {
				if (path === void 0) return;
				const resource = resources.find((candidate) => candidate.id === resourceId);
				if (resource === void 0) return;
				const refs = resourceRefs(resource);
				if (refs.includes(path)) {
					setNotice({
						text: t("resourceRefsDuplicate"),
						tone: "error"
					});
					return;
				}
				if (refs.length >= MAX_RESOURCE_REFS) {
					setNotice({
						text: t("resourceRefsFull"),
						tone: "error"
					});
					return;
				}
				run(async () => {
					const updated = await apiRef.current.updateResource({
						id: resourceId,
						assetPaths: [...refs, path]
					});
					setResources((current) => current.map((item) => item.id === resourceId ? updated : item));
					setNotice({
						text: `${t("resourceRefsAdd")}：${baseName(path)}`,
						tone: "info"
					});
				});
			};
			/** 摘掉一张参考图；清空时连旧 `assetPath` 一起清（否则合并视图还会显示它）。 */
			const removeRefFromResource = (resourceId, path) => {
				const resource = resources.find((candidate) => candidate.id === resourceId);
				if (resource === void 0) return;
				const next = resourceRefs(resource).filter((item) => item !== path);
				run(async () => {
					const updated = await apiRef.current.updateResource({
						id: resourceId,
						assetPaths: next.length === 0 ? null : next,
						...next.length === 0 ? { assetPath: null } : {}
					});
					setResources((current) => current.map((item) => item.id === resourceId ? updated : item));
				});
			};
			/** 清空整组参考图（`assetPaths: null` + `assetPath: null`，旧单图一并清）。 */
			const clearResourceRefs = (resourceId) => {
				run(async () => {
					const updated = await apiRef.current.updateResource({
						id: resourceId,
						assetPaths: null,
						assetPath: null
					});
					setResources((current) => current.map((item) => item.id === resourceId ? updated : item));
				});
			};
			(0, react.useEffect)(() => {
				(async () => {
					try {
						const facts = await apiRef.current.health();
						setHealth({
							status: "ok",
							version: facts.version,
							provider: facts.provider,
							...facts.defaults === void 0 ? {} : { defaults: facts.defaults },
							...facts.options === void 0 ? {} : { options: facts.options }
						});
					} catch (error) {
						setHealth({
							status: "failed",
							message: error instanceof Error ? error.message : String(error)
						});
					}
					await run(async () => {
						await loadProjects();
						await loadOutputs();
						await loadTasks();
					});
				})();
			}, [
				loadOutputs,
				loadProjects,
				loadTasks,
				run
			]);
			const pollingActive = runningRun || renderRunning || tasks.some((task) => task.status === "running" || task.status === "queued");
			const modeRef = (0, react.useRef)(mode);
			modeRef.current = mode;
			const activeProjectRef = (0, react.useRef)(activeProject);
			activeProjectRef.current = activeProject;
			const workflowIdRef = (0, react.useRef)(workflow?.id);
			workflowIdRef.current = workflow?.id;
			useUnifiedPolling({
				active: pollingActive,
				enabled: tab.visible,
				onTick: () => {
					(async () => {
						try {
							await loadProjects();
							await loadTasks();
							const project = activeProjectRef.current;
							if (project !== void 0) setAssets(await apiRef.current.listAssets(project.id));
							if (modeRef.current === "timeline" && project !== void 0) setRenderJob((await apiRef.current.listRenders(project.id))[0]);
							if (modeRef.current === "workflow" && project !== void 0) setRuns(await apiRef.current.listRuns(project.id, workflowIdRef.current));
							setRefreshTick((current) => current + 1);
						} catch {}
					})();
				}
			});
			const dirtyRename = renaming && saveState === "dirty";
			(0, react.useEffect)(() => {
				if (!dirtyRename || activeProject === void 0) return;
				const timer = setTimeout(() => {
					run(async () => {
						setSaveState("saving");
						try {
							await apiRef.current.renameProject(activeProject.id, renameValue.trim());
							await loadProjects();
							setSaveState("saved");
						} catch (error) {
							setSaveState("failed");
							throw error;
						}
					});
				}, 900);
				return () => {
					clearTimeout(timer);
				};
			}, [
				dirtyRename,
				activeProject,
				renameValue,
				loadProjects,
				run
			]);
			(0, react.useEffect)(() => {
				(async () => {
					setSelectedId(void 0);
					if (activeId === void 0) {
						setAssets([]);
						setResources([]);
						return;
					}
					try {
						setAssets(await apiRef.current.listAssets(activeId));
						await loadResources(activeId);
					} catch (error) {
						setNotice({
							text: error instanceof Error ? error.message : String(error),
							tone: "error"
						});
					}
				})();
			}, [activeId, loadResources]);
			const defaultRows = health.status === "ok" && health.defaults !== void 0 ? [
				["defaultMediaMode", health.defaults.mediaMode],
				["defaultImageProvider", health.defaults.imageProvider],
				["defaultImageSize", health.defaults.imageSize],
				["defaultImageStyle", health.defaults.imageStyle],
				["defaultVideoProvider", health.defaults.videoProvider],
				["defaultVideoAspectRatio", health.defaults.videoAspectRatio],
				["defaultVideoDuration", health.defaults.videoDuration]
			].map(([key, value]) => ({
				key,
				field: key.replace(/^default/, "").replace(/^./, (character) => character.toLowerCase()),
				value: value === null || value === void 0 || value === "" ? t("none") : String(value)
			})) : [];
			const options = health.status === "ok" ? health.options : void 0;
			const styleLabelKeys = {
				photo: "optStylePhoto",
				illustration: "optStyleIllustration",
				"3d": "optStyle3d",
				anime: "optStyleAnime",
				ink: "optStyleInk"
			};
			const defaultsOptions = (field) => {
				const unset = {
					value: "",
					label: t("none")
				};
				switch (field) {
					case "mediaMode": return [
						unset,
						{
							value: "text",
							label: t("optModeText")
						},
						{
							value: "image",
							label: t("optModeImage")
						},
						{
							value: "video",
							label: t("optModeVideo")
						}
					];
					case "imageProvider": return [unset, ...(options?.imageProviders ?? []).map((provider) => ({
						value: provider,
						label: provider
					}))];
					case "videoProvider": return [unset, ...(options?.videoProviders ?? []).map((provider) => ({
						value: provider,
						label: provider
					}))];
					case "imageSize": return [unset, ...(options?.imageSizes ?? []).map((option) => ({
						value: option.size,
						label: `${option.label} · ${option.size}`
					}))];
					case "imageStyle": return [unset, ...(options?.imageStyles ?? []).map((id) => ({
						value: id,
						label: t(styleLabelKeys[id] ?? "optStylePhoto")
					}))];
					case "videoAspectRatio": return [unset, ...(options?.videoAspectRatios ?? []).map((ratio) => ({
						value: ratio,
						label: ratio
					}))];
					case "videoDuration": {
						const duration = options?.videoDuration;
						if (duration === void 0) return [unset];
						return [unset, ...Array.from({ length: duration.max - duration.min + 1 }, (_, index) => {
							const value = String(duration.min + index);
							return {
								value,
								label: value
							};
						})];
					}
					default: return [unset];
				}
			};
			const hostIsLoopback = (() => {
				if (typeof window === "undefined") return true;
				if (window.location?.protocol === "dsh-app:") return true;
				const host = window.location?.hostname ?? "";
				return host === "" || host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
			})();
			const healthText = health.status === "checking" ? t("healthChecking") : health.status === "ok" ? `${health.version} · ${health.provider}` : t("healthFailed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv",
				"data-workbench-kind": kind,
				"data-workbench-visible": tab.visible ? "true" : "false",
				"data-workbench-refreshed": String(refreshTick),
				"data-workbench-fullscreen": sidebar.fullscreen ? "true" : "false",
				"data-workbench-health": health.status,
				"data-workbench-save": saveState,
				"data-workbench-projects": String(projects.length),
				"data-workbench-assets": String(assets.length),
				"data-workbench-tasks": String(tasks.length),
				"data-workbench-resources": String(resources.length),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "iv-top",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-brand",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-mark",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, { size: 12 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "iv-brand-text",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-brand-name",
										children: "dsh-image-video"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-brand-sub",
										children: t("brandTagline")
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "iv-top-sep",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-proj",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-micro",
										children: t("sectionProject")
									}),
									projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-meta",
										children: t("projectNone")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "iv-select",
										"aria-label": t("sectionProject"),
										value: activeId ?? "",
										onChange: (event) => {
											setActiveId(event.target.value);
										},
										style: { maxWidth: "180px" },
										children: projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: project.id,
											children: project.name
										}, project.id))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "iv-newform",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "iv-input",
											"aria-label": t("newProject"),
											placeholder: t("projectNamePlaceholder"),
											value: name,
											onChange: (event) => {
												setName(event.target.value);
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "iv-btn iv-btn--acc iv-btn--sm",
											disabled: busy || name.trim().length === 0,
											onClick: () => {
												run(async () => {
													const project = await apiRef.current.createProject(name.trim());
													setName("");
													await loadProjects();
													setActiveId(project.id);
												});
											},
											children: t("create")
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-top-meta",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: saveChipClass(saveState),
										title: saveState === "failed" ? t("saveFailed") : void 0,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
											className: "iv-dot",
											"aria-hidden": "true"
										}), t(saveState === "dirty" ? "saveDirty" : saveState === "saving" ? "saveSaving" : saveState === "failed" ? "saveFailed" : "saveSaved")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: `iv-chip${health.status === "ok" ? " iv-chip--ok" : health.status === "checking" ? "" : " iv-chip--err"}`,
										title: health.status === "failed" ? health.message : void 0,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
											className: "iv-dot",
											"aria-hidden": "true"
										}), healthText]
									}),
									activeProject === void 0 || renaming ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm",
										"aria-label": t("rename"),
										title: t("rename"),
										onClick: () => {
											setRenaming(true);
											setRenameValue(activeProject.name);
											setSaveState("saved");
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "pencil" })
									}),
									activeProject === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `iv-btn iv-btn--icon iv-btn--sm${confirming === activeProject.id ? " iv-btn--danger" : " iv-btn--ghost"}`,
										"aria-label": confirming === activeProject.id ? t("confirmRemove") : t("remove"),
										title: confirming === activeProject.id ? t("confirmRemove") : t("remove"),
										disabled: busy,
										onClick: () => {
											if (confirming !== activeProject.id) {
												setConfirming(activeProject.id);
												return;
											}
											setConfirming(void 0);
											run(async () => {
												await apiRef.current.removeProject(activeProject.id);
												await loadProjects();
											});
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: confirming === activeProject.id ? "alert" : "trash" })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm",
										"aria-label": t("refresh"),
										title: t("refresh"),
										disabled: busy,
										onClick: () => {
											run(async () => {
												await loadProjects();
												await loadOutputs();
												await loadTasks();
											});
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "refresh" })
									})
								]
							})
						]
					}),
					renaming && activeProject !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-rename",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "pencil" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "iv-input",
								"aria-label": t("rename"),
								value: renameValue,
								onChange: (event) => {
									setRenameValue(event.target.value);
									const next = event.target.value.trim();
									setSaveState(next === activeProject.name || next === "" ? "saved" : "dirty");
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "iv-btn iv-btn--acc iv-btn--sm",
								disabled: busy || renameValue.trim() === "",
								onClick: () => {
									run(async () => {
										setSaveState("saving");
										try {
											await apiRef.current.renameProject(activeProject.id, renameValue.trim());
											await loadProjects();
											setRenaming(false);
											setSaveState("saved");
										} catch (error) {
											setSaveState("failed");
											throw error;
										}
									});
								},
								children: t("save")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "iv-btn iv-btn--ghost iv-btn--sm",
								onClick: () => {
									setRenaming(false);
									setSaveState("saved");
								},
								children: t("cancel")
							})
						]
					}) : null,
					defaultRows.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-defaults",
						"data-workbench-defaults": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "iv-micro",
								children: t("defaultsTitle")
							}),
							defaultRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "iv-def",
								"data-workbench-default": row.key,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: t(row.key) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: row.value })]
							}, row.key)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "iv-pop",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--ghost iv-btn--sm",
									"data-workbench-defaults-edit": "true",
									onClick: () => {
										setDefaultsDraft(Object.fromEntries(defaultRows.map((row) => [row.field, row.value === t("none") ? "" : row.value])));
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "sliders" }), t("defaultsEdit")]
								}), defaultsDraft === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-pop-panel",
									"data-workbench-defaults-editor": "true",
									role: "dialog",
									"aria-label": t("defaultsTitle"),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "iv-pop-head",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
												name: "sliders",
												size: 14
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "iv-pop-head-txt",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
													className: "iv-pop-head-title",
													children: t("defaultsTitle")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-pop-head-sub",
													children: t("defaultsEditHint")
												})]
											})]
										}),
										DEFAULT_GROUPS.map((group) => {
											const rows = defaultRows.filter((row) => group.fields.includes(row.field));
											if (rows.length === 0) return null;
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pop-group",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-micro iv-pop-group-title",
													children: t(group.key)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "iv-pop-grid",
													children: rows.map((row) => {
														const options = defaultsOptions(row.field);
														const current = defaultsDraft[row.field] ?? "";
														const known = options.some((option) => option.value === current);
														return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(row.key) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: "iv-select",
															"aria-label": t(row.key),
															value: current,
															onChange: (event) => {
																setDefaultsDraft({
																	...defaultsDraft,
																	[row.field]: event.target.value
																});
															},
															children: [known ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: current,
																children: current
															}), options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: option.value,
																children: option.label
															}, option.value))]
														})] }, row.key);
													})
												})]
											}, group.key);
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "iv-pop-foot",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-meta",
													children: t("defaultsEditHint")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "iv-btn iv-btn--acc iv-btn--sm",
													"data-workbench-defaults-save": "true",
													disabled: busy,
													onClick: () => {
														run(async () => {
															const patch = {};
															for (const row of defaultRows) {
																const next = (defaultsDraft[row.field] ?? "").trim();
																if (next === (row.value === t("none") ? "" : row.value)) continue;
																patch[row.field] = next === "" ? null : /duration/i.test(row.field) ? Number(next) : next;
															}
															if (Object.keys(patch).length > 0) await apiRef.current.saveDefaults(patch);
															setDefaultsDraft(void 0);
															const facts = await apiRef.current.health();
															setHealth({
																status: "ok",
																version: facts.version,
																provider: facts.provider,
																...facts.defaults === void 0 ? {} : { defaults: facts.defaults }
															});
															setNotice({
																text: t("defaultsSaved"),
																tone: "info"
															});
														});
													},
													children: t("defaultsSave")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "iv-btn iv-btn--ghost iv-btn--sm",
													"data-workbench-defaults-cancel": "true",
													onClick: () => {
														setDefaultsDraft(void 0);
													},
													children: t("defaultsCancel")
												})
											]
										})
									]
								})]
							})
						]
					}),
					notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: `iv-notice${notice.tone === "error" ? " iv-notice--error" : ""}`,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: notice.tone === "error" ? "alert" : "check" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [notice.tone === "error" ? `${t("failed")}: ` : "", notice.text] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "iv-body",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
							className: "iv-rail",
							"aria-label": t("tabTitle"),
							children: [
								MODES.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: `iv-rail-btn${candidate === mode ? " on" : ""}`,
									"aria-pressed": candidate === mode,
									"aria-label": t(MODE_KEYS[candidate]),
									onClick: () => {
										setMode(candidate);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
										name: MODE_ICONS[candidate],
										size: 15
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-rail-tip",
										children: t(MODE_KEYS[candidate])
									})]
								}, candidate)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-rail-sep",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-rail-btn",
									"aria-label": t("railAssets"),
									onClick: () => {
										scrollToPane("paneAssets");
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
										name: "layers",
										size: 15
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-rail-tip",
										children: t("railAssets")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-rail-btn",
									"aria-label": t("railTasks"),
									onClick: () => {
										scrollToPane("paneTasks");
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
										name: "clock",
										size: 15
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-rail-tip",
										children: t("railTasks")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-rail-btn",
									"aria-label": t("railHealth"),
									onClick: () => {
										scrollToPane("paneHealth");
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
										name: "filter",
										size: 15
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "iv-rail-tip",
										children: t("railHealth")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "iv-rail-bottom",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "iv-rail-btn",
										"aria-label": t("railDefaults"),
										onClick: () => {
											if (defaultsDraft === void 0 && defaultRows.length > 0) setDefaultsDraft(Object.fromEntries(defaultRows.map((row) => [row.field, row.value === t("none") ? "" : row.value])));
											document.querySelector("[data-workbench-defaults]")?.scrollIntoView({
												behavior: "smooth",
												block: "nearest"
											});
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
											name: "sliders",
											size: 15
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "iv-rail-tip",
											children: t("railDefaults")
										})]
									})
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
							className: "iv-main",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "iv-page",
								"aria-label": t(MODE_KEYS[mode]),
								children: [
									mode === "quick" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneBoundary, {
											label: t("modeQuick"),
											t,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-hero",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-hero-top",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-hero-ico",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "bolt",
																size: 19
															})
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: {
																display: "grid",
																gap: "1px"
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
																className: "iv-hero-title",
																children: t("modeQuick")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: busy ? t("busy") : t("emptyHint")
															})]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: "iv-hero-text",
														children: t("modeQuickHint")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-steps",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-step",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-step-n",
																	children: "1"
																}), t("heroStepChat")]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "chevron",
																className: "iv-step-arrow",
																size: 12
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-step",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-step-n",
																	children: "2"
																}), t("heroStepOutputs")]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "chevron",
																className: "iv-step-arrow",
																size: 12
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-step",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-step-n",
																	children: "3"
																}), t("heroStepFile")]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "grid",
															gap: "6px"
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-meta",
																children: [
																	t("generateHeading"),
																	" · ",
																	t("generatePromptLabel")
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																className: "iv-input",
																rows: 3,
																value: generatePrompt,
																placeholder: t("generatePromptPlaceholder"),
																"data-generate-prompt": "true",
																disabled: generating !== void 0,
																onChange: (event) => setGeneratePrompt(event.target.value),
																onKeyDown: (event) => {
																	if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
																	event.preventDefault();
																	if (generating === void 0 && activeId !== void 0) runGenerate("image");
																},
																style: {
																	resize: "vertical",
																	font: "inherit",
																	padding: "6px 8px",
																	borderRadius: "6px"
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																"data-generate-shortcut": "true",
																children: t("generateShortcutHint")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-refs",
																"data-generate-refs": "true",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		style: {
																			display: "flex",
																			gap: "6px",
																			alignItems: "center",
																			flexWrap: "wrap"
																		},
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																				className: "iv-meta",
																				children: [t("generateRefsLabel"), "："]
																			}),
																			generateImages.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-meta",
																				children: t("generateReferenceNone")
																			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				onClick: () => {
																					setGenerateImages([]);
																					setRefDragFrom(void 0);
																					setRefDropAt(void 0);
																				},
																				children: t("generateClearReference")
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				"data-generate-refs-add": "true",
																				disabled: selectedAsset === void 0 || selectedAsset.kind !== "image" || generateImages.length >= MAX_REFERENCE_IMAGES,
																				onClick: () => {
																					addReferenceImage(selectedAsset?.path);
																				},
																				children: t("generateRefsAdd")
																			}),
																			generateImages.length >= MAX_REFERENCE_IMAGES ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-meta",
																				children: t("generateRefsFull")
																			}) : null
																		]
																	}),
																	generateImages.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
																		className: "iv-ref-list",
																		children: generateImages.map((path, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
																			className: "iv-ref-chip",
																			"data-generate-ref": path,
																			"data-generate-ref-index": String(index),
																			"data-ref-drop": refDropAt === index && refDragFrom !== index ? "true" : void 0,
																			draggable: true,
																			onDragStart: (event) => {
																				event.dataTransfer.setData("text/plain", path);
																				event.dataTransfer.effectAllowed = "move";
																				setRefDragFrom(index);
																			},
																			onDragOver: (event) => {
																				if (refDragFrom === void 0) return;
																				event.preventDefault();
																				setRefDropAt(index);
																			},
																			onDrop: (event) => {
																				event.preventDefault();
																				const from = refDragFrom;
																				setRefDragFrom(void 0);
																				setRefDropAt(void 0);
																				if (from !== void 0) moveReferenceImage(from, index);
																			},
																			onDragEnd: () => {
																				setRefDragFrom(void 0);
																				setRefDropAt(void 0);
																			},
																			children: [
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																					className: "iv-ref-order",
																					children: index + 1
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																					className: "iv-ref-role",
																					children: index === 0 ? t("generateRefsBase") : t("generateRefsStyle")
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																					className: "iv-ellipsis",
																					title: path,
																					children: baseName(path)
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: "iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--up",
																					"aria-label": `${t("generateRefsMoveUp")} ${baseName(path)}`,
																					title: t("generateRefsMoveUp"),
																					disabled: index === 0,
																					onClick: () => {
																						moveReferenceImage(index, index - 1);
																					},
																					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																						name: "chevron",
																						size: 11
																					})
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: "iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--down",
																					"aria-label": `${t("generateRefsMoveDown")} ${baseName(path)}`,
																					title: t("generateRefsMoveDown"),
																					disabled: index === generateImages.length - 1,
																					onClick: () => {
																						moveReferenceImage(index, index + 1);
																					},
																					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																						name: "chevron",
																						size: 11
																					})
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: "iv-btn iv-btn--icon iv-btn--sm",
																					"data-generate-ref-remove": path,
																					"aria-label": `${t("remove")} ${baseName(path)}`,
																					title: t("remove"),
																					onClick: () => {
																						setGenerateImages(generateImages.filter((candidate) => candidate !== path));
																					},
																					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																						name: "x",
																						size: 11
																					})
																				})
																			]
																		}, path))
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-meta",
																		children: t("generateRefsHint")
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-vslots",
																"data-video-slots": "true",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		style: {
																			display: "flex",
																			gap: "6px",
																			alignItems: "center",
																			flexWrap: "wrap"
																		},
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																				className: "iv-meta",
																				children: [t("videoLastFrame"), "："]
																			}),
																			generateLastFrame === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-meta",
																				children: t("generateReferenceNone")
																			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-chip",
																				title: generateLastFrame,
																				children: baseName(generateLastFrame)
																			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				onClick: () => {
																					setGenerateLastFrame(void 0);
																				},
																				children: t("resourceClear")
																			})] }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				"data-video-last-frame-use": "true",
																				disabled: selectedAsset === void 0 || selectedAsset.kind !== "image",
																				onClick: () => {
																					setGenerateLastFrame(selectedAsset?.path);
																				},
																				children: t("generateUseSelected")
																			})
																		]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		style: {
																			display: "flex",
																			gap: "6px",
																			alignItems: "center",
																			flexWrap: "wrap"
																		},
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																				className: "iv-meta",
																				children: [t("videoReferenceVideo"), "："]
																			}),
																			generateRefVideo === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-meta",
																				children: t("generateReferenceNone")
																			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "iv-chip",
																				title: generateRefVideo,
																				children: baseName(generateRefVideo)
																			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				onClick: () => {
																					setGenerateRefVideo(void 0);
																					setGenerateRealPerson(false);
																				},
																				children: t("resourceClear")
																			})] }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--ghost iv-btn--sm",
																				"data-video-reference-use": "true",
																				disabled: selectedAsset === void 0 || selectedAsset.kind !== "video",
																				onClick: () => {
																					setGenerateRefVideo(selectedAsset?.path);
																				},
																				children: t("generateUseSelected")
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																				className: "iv-check",
																				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																					type: "checkbox",
																					checked: generateRealPerson,
																					"data-video-real-person": "true",
																					onChange: (event) => {
																						setGenerateRealPerson(event.target.checked);
																					}
																				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("videoRealPerson") })]
																			})
																		]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-meta",
																		children: t("videoEditHint")
																	}),
																	generateLastFrame === void 0 && generateRefVideo === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-meta",
																		"data-video-edit-pending": "true",
																		children: t("videoEditPending")
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px",
																	alignItems: "center",
																	flexWrap: "wrap"
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "iv-meta",
																		children: [t("defaultImageSize"), "："]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		className: "iv-input",
																		style: { width: "96px" },
																		"aria-label": t("defaultImageSize"),
																		value: generateSize,
																		disabled: generating !== void 0,
																		onChange: (event) => setGenerateSize(event.target.value)
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "iv-meta",
																		children: [t("defaultVideoAspectRatio"), "："]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		className: "iv-input",
																		style: { width: "76px" },
																		"aria-label": t("defaultVideoAspectRatio"),
																		value: generateAspect,
																		disabled: generating !== void 0,
																		onChange: (event) => setGenerateAspect(event.target.value)
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "iv-meta",
																		children: [t("defaultVideoDuration"), "："]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		className: "iv-input",
																		style: { width: "56px" },
																		"aria-label": t("defaultVideoDuration"),
																		value: generateDuration,
																		disabled: generating !== void 0,
																		onChange: (event) => setGenerateDuration(event.target.value)
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px",
																	flexWrap: "wrap"
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--acc iv-btn--sm",
																		disabled: generating !== void 0 || activeId === void 0 || generatePrompt.trim() === "",
																		onClick: () => {
																			runGenerate("image");
																		},
																		children: generating === "image" ? t("generating") : t("generateImage")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--sm",
																		disabled: generating !== void 0 || activeId === void 0 || generatePrompt.trim() === "",
																		onClick: () => {
																			runGenerate("video");
																		},
																		children: generating === "video" ? t("generating") : t("generateVideo")
																	}),
																	generateTaskId === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--danger iv-btn--sm",
																		onClick: () => {
																			apiRef.current.cancelTask(generateTaskId);
																		},
																		children: t("generateCancel")
																	})
																]
															}),
															generating === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-genprog",
																"data-generate-progress": "true",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: "iv-chip iv-chip--run",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																		className: "iv-dot",
																		"aria-hidden": "true"
																	}), elapsedSeconds === void 0 ? t("generating") : t("generateElapsed").replace("{sec}", String(elapsedSeconds))]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-progress iv-progress--run",
																	role: "progressbar",
																	"aria-label": t("generateProgress"),
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: t("generateCostHint")
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-fusion",
														"data-fusion": "true",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-fusion-head",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: "iv-chip iv-chip--run",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																		name: "layers",
																		size: 11
																	}), t("fusionTitle")]
																}), composeSelection.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "iv-btn iv-btn--ghost iv-btn--sm",
																	onClick: () => {
																		setComposeRoles([]);
																		setComposeScenes([]);
																		setComposeProps([]);
																	},
																	children: t("fusionClear")
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FusionGroup, {
																kind: "role",
																label: t("fusionRoles"),
																resources: composeResourcesOf("role"),
																selected: composeRoles,
																emptyHint: t("fusionNoResources"),
																onToggle: (id) => setComposeRoles((current) => toggleSelection(current, id))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FusionGroup, {
																kind: "scene",
																label: t("fusionScenes"),
																resources: composeResourcesOf("scene"),
																selected: composeScenes,
																emptyHint: t("fusionNoResources"),
																onToggle: (id) => setComposeScenes((current) => toggleSelection(current, id))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FusionGroup, {
																kind: "prop",
																label: t("fusionProps"),
																resources: composeResourcesOf("prop"),
																selected: composeProps,
																emptyHint: t("fusionNoResources"),
																onToggle: (id) => setComposeProps((current) => toggleSelection(current, id))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																"data-fusion-preview": "true",
																children: composePreviewRefs.length === 0 ? t("fusionPreviewNone") : t("fusionPreview").replace("{n}", String(composePreviewRefs.length))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																className: "iv-input",
																rows: 2,
																value: composePrompt,
																placeholder: t("fusionPromptPlaceholder"),
																"data-fusion-prompt": "true",
																disabled: composing,
																onChange: (event) => setComposePrompt(event.target.value),
																style: {
																	resize: "vertical",
																	font: "inherit",
																	padding: "6px 8px",
																	borderRadius: "6px"
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px",
																	flexWrap: "wrap",
																	alignItems: "center"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "iv-btn iv-btn--acc iv-btn--sm",
																	"data-fusion-run": "true",
																	disabled: composing || activeId === void 0 || composePrompt.trim() === "",
																	onClick: () => {
																		runCompose();
																	},
																	children: composing ? t("fusionRunning") : t("fusionRun")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("fusionHint")
																})]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-prompt-studio",
														"data-prompt-studio": "true",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-fusion-head",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: "iv-chip",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																		name: "sparkles",
																		size: 11
																	}), t("promptTitle")]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("promptSavedCount").replace("{n}", String(prompts.length))
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px",
																	flexWrap: "wrap",
																	alignItems: "center"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "iv-btn iv-btn--sm",
																	"data-prompt-extract": "true",
																	disabled: extracting || selectedAsset === void 0 || selectedAsset.kind !== "image",
																	onClick: () => {
																		runExtractPrompt();
																	},
																	children: extracting ? t("promptExtracting") : t("promptExtract")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	"data-prompt-source": "true",
																	children: selectedAsset === void 0 || selectedAsset.kind !== "image" ? t("promptExtractNeedsAsset") : baseName(selectedAsset.path)
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "grid",
																	gap: "4px"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("promptDraftLabel")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																	className: "iv-input",
																	rows: 2,
																	value: promptDraft,
																	"data-prompt-draft": "true",
																	onChange: (event) => setPromptDraft(event.target.value),
																	style: {
																		resize: "vertical",
																		font: "inherit",
																		padding: "6px 8px",
																		borderRadius: "6px"
																	}
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px",
																	flexWrap: "wrap",
																	alignItems: "center"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	className: "iv-input",
																	style: { width: "160px" },
																	"aria-label": t("promptNameLabel"),
																	placeholder: t("promptNamePlaceholder"),
																	value: promptName,
																	"data-prompt-name": "true",
																	onChange: (event) => setPromptName(event.target.value)
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "iv-btn iv-btn--acc iv-btn--sm",
																	"data-prompt-save": "true",
																	disabled: promptDraft.trim() === "",
																	onClick: () => {
																		savePromptDraft();
																	},
																	children: t("promptSave")
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-prompt-lib",
																"data-prompt-library": "true",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("promptLibrary")
																}), prompts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("promptLibraryEmpty")
																}) : prompts.map((record) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "iv-prompt-row",
																	"data-prompt-item": record.id,
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "iv-ellipsis",
																			title: record.text,
																			children: record.name
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			className: "iv-btn iv-btn--ghost iv-btn--sm",
																			"data-prompt-apply": record.id,
																			onClick: () => applyPrompt(record.text),
																			children: t("promptApply")
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			className: "iv-btn iv-btn--icon iv-btn--sm",
																			"aria-label": `${t("promptRemove")} ${record.name}`,
																			"data-prompt-remove": record.id,
																			onClick: () => {
																				removePromptRecord(record.id);
																			},
																			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																				name: "x",
																				size: 11
																			})
																		})
																	]
																}, record.id))]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: t("promptHint")
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-stats",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-stat",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: outputs.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statOutputs") })]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-stat",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: assets.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statAssets") })]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-stat",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: tasks.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statTasks") })]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-stat",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: resources.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statResources") })]
															})
														]
													}),
													outputs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: "iv-meta",
														children: t("noOutputs")
													}) : null
												]
											})
										})
									}) : null,
									mode === "workflow" && workflow !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneCanvas",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneCanvas"),
											t,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-pane-head",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-pane-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "flow",
																size: 13
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
															className: "iv-pane-title",
															children: t("paneCanvas")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "iv-pane-actions",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: "iv-btn iv-btn--ghost iv-btn--sm",
																"aria-label": t("templateMarket"),
																"aria-expanded": templateOpen,
																"data-workflow-template-toggle": "true",
																onClick: () => {
																	setTemplateOpen((open) => !open);
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																	name: "sparkles",
																	size: 11
																}), t("templateMarket")]
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: saveChipClass(workflowState),
																"data-workflow-save": workflowState,
																role: "status",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																	className: "iv-dot",
																	"aria-hidden": "true"
																}), t(workflowState === "dirty" ? "saveDirty" : workflowState === "saving" ? "saveSaving" : workflowState === "failed" ? "saveFailed" : "saveSaved")]
															})]
														})
													]
												}),
												templateOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-tpl",
													"data-workflow-template-market": "true",
													children: [[{
														group: "templateQuickGroup",
														templates: [...WORKFLOW_TEMPLATES, ...DRAMA_TEMPLATES].filter((template) => QUICK_TEMPLATE_IDS.includes(template.id))
													}, {
														group: "templateFullGroup",
														templates: [...WORKFLOW_TEMPLATES, ...DRAMA_TEMPLATES].filter((template) => !QUICK_TEMPLATE_IDS.includes(template.id))
													}].map((section) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-tpl-group",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-micro iv-tpl-group-title",
															children: t(section.group)
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "iv-tpl-grid",
															children: section.templates.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: "iv-tpl-card",
																"data-workflow-template": template.id,
																onClick: () => {
																	if (activeProject === void 0) return;
																	setWorkflow(instantiateAnyTemplate(template));
																	setWorkflowState("dirty");
																	setTemplateOpen(false);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																		name: "sparkles",
																		size: 12
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-tpl-name",
																		children: template.id === "drama-series" ? t("templateDramaSeries") : t(template.labelKey)
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-tpl-desc",
																		children: template.describe ?? (TEMPLATE_HINTS[template.id] === void 0 ? "" : t(TEMPLATE_HINTS[template.id]))
																	})
																]
															}, template.id))
														})]
													}, section.group)), WORKFLOW_TEMPLATES.length + DRAMA_TEMPLATES.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: "iv-meta",
														children: t("templateMarketEmpty")
													}) : null]
												}) : null,
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowCanvas, {
													record: workflow,
													onChange: (next) => {
														setWorkflow(next);
														setWorkflowState("dirty");
													},
													t,
													run: {
														...(runs.find((run) => run.id === selectedRunId) ?? runs[0]) === void 0 ? {} : { latest: runs.find((run) => run.id === selectedRunId) ?? runs[0] },
														history: runs,
														...selectedRunId === void 0 ? {} : { selectedRunId },
														onSelectRun: setSelectedRunId,
														busy: runBusy,
														onStart: () => {
															run(async () => {
																setRunBusy(true);
																try {
																	const stored = await apiRef.current.saveWorkflow({
																		id: workflow.id,
																		projectId: workflow.projectId,
																		name: workflow.name,
																		nodes: workflow.nodes,
																		edges: workflow.edges
																	});
																	setWorkflow(stored);
																	setWorkflowState("saved");
																	const started = await apiRef.current.runWorkflow(stored.id);
																	setSelectedRunId(started.id);
																	setRuns((current) => [started, ...current]);
																} finally {
																	setRunBusy(false);
																}
															});
														},
														onCancel: () => {
															run(async () => {
																const id = selectedRunId ?? runs[0]?.id;
																if (id === void 0) return;
																await apiRef.current.cancelRun(id);
															});
														},
														onRetry: () => {
															run(async () => {
																const id = selectedRunId ?? runs[0]?.id;
																if (id === void 0) return;
																setRunBusy(true);
																try {
																	const retried = await apiRef.current.retryRun(id);
																	setSelectedRunId(retried.id);
																	setRuns((current) => [retried, ...current]);
																} finally {
																	setRunBusy(false);
																}
															});
														},
														onRunNode: (nodeId) => {
															run(async () => {
																setRunBusy(true);
																try {
																	const stored = await apiRef.current.saveWorkflow({
																		id: workflow.id,
																		projectId: workflow.projectId,
																		name: workflow.name,
																		nodes: workflow.nodes,
																		edges: workflow.edges
																	});
																	setWorkflow(stored);
																	setWorkflowState("saved");
																	const started = await apiRef.current.runWorkflow(stored.id, [nodeId]);
																	setSelectedRunId(started.id);
																	setRuns((current) => [started, ...current]);
																} finally {
																	setRunBusy(false);
																}
															});
														}
													}
												})
											]
										})
									}) : null,
									mode === "timeline" && timeline !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneTimeline",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("timelineTitle"),
											t,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-pane-head",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-pane-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "film",
																size: 13
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
															className: "iv-pane-title",
															children: t("timelineTitle")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-chip",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "clock" }),
																t("timelineTotal"),
																" ",
																Math.round(timelineDurationMs(timeline.tracks) / 1e3),
																"s"
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "iv-pane-actions",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "iv-check",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		"data-timeline-burn": "true",
																		checked: timeline.burnSubtitles,
																		"aria-label": t("burnSubtitles"),
																		onChange: (event) => {
																			const burnSubtitles = event.target.checked;
																			setTimeline((current) => current === void 0 ? current : {
																				...current,
																				burnSubtitles
																			});
																			setTimelineState("dirty");
																		}
																	}), t("burnSubtitles")]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "iv-check",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		"data-timeline-loudness": "true",
																		checked: timeline.normalizeLoudness === true,
																		"aria-label": t("normalizeLoudness"),
																		onChange: (event) => {
																			const normalizeLoudness = event.target.checked;
																			setTimeline((current) => current === void 0 ? current : {
																				...current,
																				normalizeLoudness
																			});
																			setTimelineState("dirty");
																		}
																	}), t("normalizeLoudness")]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: saveChipClass(timelineState),
																	"data-timeline-save": timelineState,
																	role: "status",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																		className: "iv-dot",
																		"aria-hidden": "true"
																	}), t(timelineState === "dirty" ? "saveDirty" : timelineState === "saving" ? "saveSaving" : timelineState === "failed" ? "saveFailed" : "saveSaved")]
																})
															]
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-toolbar",
													"data-timeline-ffmpeg": ffmpeg === void 0 ? "unknown" : ffmpeg.available ? "ok" : ffmpeg.code ?? "unavailable",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: `iv-chip${ffmpeg !== void 0 && ffmpeg.available ? " iv-chip--ok" : ffmpeg === void 0 ? "" : " iv-chip--err"}`,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																className: "iv-dot",
																"aria-hidden": "true"
															}), ffmpeg === void 0 ? "…" : ffmpeg.available ? `${t("ffmpegOk")} ${ffmpeg.version ?? ""}` : t("healthFailed")]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-meta iv-ellipsis",
															style: { flex: 1 },
															title: ffmpeg?.path ?? ffmpeg?.message ?? "",
															children: ffmpeg === void 0 ? "" : ffmpeg.available ? ffmpeg.path ?? "" : ffmpeg.message ?? ""
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--ghost iv-btn--sm",
															onClick: () => {
																recheckFfmpeg();
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "refresh" }), t("ffmpegRecheck")]
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-toolbar iv-seg-wrap",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-meta",
														children: t("segPreviewTitle")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimelineSegmentPreview, {
														timeline,
														t: (key) => t(key)
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-toolbar iv-toolbar--export",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: "iv-field",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-field-label",
																children: t("paramResolution")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "iv-select iv-select--sm",
																"data-timeline-export-resolution": "true",
																"aria-label": t("paramResolution"),
																value: exportResolution,
																onChange: (event) => {
																	setExportResolution(event.target.value);
																	setAssetRegistered(false);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "default",
																		children: t("resolutionDefault")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "480",
																		children: t("resolution480")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "768",
																		children: t("resolution768")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "2k",
																		children: t("resolution2k")
																	})
																]
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: "iv-field",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-field-label",
																children: t("fps")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "iv-select iv-select--sm",
																"data-timeline-export-fps": "true",
																"aria-label": t("fps"),
																value: exportFps,
																onChange: (event) => {
																	setExportFps(Number(event.target.value));
																	setAssetRegistered(false);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: 24,
																		children: "24"
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: 25,
																		children: "25"
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: 30,
																		children: "30"
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: 60,
																		children: "60"
																	})
																]
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: "iv-field",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-field-label",
																children: t("paramRatio")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "iv-select iv-select--sm",
																"data-timeline-export-aspect": "true",
																"aria-label": t("paramRatio"),
																value: exportAspect,
																onChange: (event) => {
																	setExportAspect(event.target.value);
																	setAssetRegistered(false);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "landscape",
																		children: t("ratioLandscape")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "portrait",
																		children: t("ratioPortrait")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "square",
																		children: t("ratioSquare")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "vertical",
																		children: t("ratioVertical")
																	})
																]
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--acc iv-btn--sm",
															"data-timeline-export": "true",
															disabled: renderRunning || timeline.tracks.find((track) => track.kind === "video")?.clips.length === 0,
															onClick: () => {
																setAssetRegistered(false);
																run(async () => {
																	setRenderJob(await apiRef.current.renderTimeline(timeline.id, timeline.projectId, {
																		resolution: exportResolution,
																		fps: exportFps,
																		aspect: exportAspect
																	}));
																});
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "download" }), t("exportStart")]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "iv-btn iv-btn--sm",
															disabled: !renderRunning,
															"data-timeline-export-cancel": "true",
															onClick: () => {
																run(async () => {
																	const id = renderJob?.id;
																	if (id === void 0) return;
																	await apiRef.current.cancelRender(id);
																});
															},
															children: t("exportCancel")
														}),
														renderJob === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: `iv-chip${renderJob.status === "succeeded" ? " iv-chip--ok" : renderJob.status === "running" ? " iv-chip--run" : renderJob.status === "failed" ? " iv-chip--err" : ""}`,
																"data-timeline-render": renderJob.status,
																"data-timeline-render-percent": String(renderJob.percent),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																		className: "iv-dot",
																		"aria-hidden": "true"
																	}),
																	t(renderJob.status === "running" ? "exportRunning" : renderJob.status === "succeeded" ? "exportDone" : "exportFailed"),
																	renderJob.status === "running" ? ` ${renderJob.percent}%` : "",
																	renderJob.outputPath === void 0 ? "" : ` · ${t("exportResult")} ${baseName(renderJob.outputPath)}`,
																	renderJob.error === void 0 ? "" : ` · ${renderJob.error.slice(0, 90)}`
																]
															}),
															renderJob.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-progress",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: `${Math.max(2, renderJob.percent)}%` } })
															}) : null,
															renderJob.status === "succeeded" && renderJob.outputPath !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: "iv-btn iv-btn--sm",
																"data-timeline-register": "true",
																disabled: assetRegistered,
																onClick: () => {
																	run(async () => {
																		await apiRef.current.attachAsset({
																			projectId: timeline.projectId,
																			path: renderJob.outputPath,
																			kind: "video"
																		});
																		setAssetRegistered(true);
																	});
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "layers" }), assetRegistered ? t("alreadyRegistered") : t("registerAsAsset")]
															}) : null
														] })
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-monitor",
													"data-timeline-preview": "true",
													"data-timeline-active-clip": activeVideo?.id ?? "",
													"data-timeline-active-subtitle": activeSubtitle?.id ?? "",
													children: [
														activeVideo?.assetPath === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-meta",
															style: { color: "#9aa0a8" },
															children: t("previewIdle")
														}) : /\.(png|jpe?g|webp|gif)$/i.test(activeVideo.assetPath) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
															src: `/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`,
															alt: ""
														}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
															src: `/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`,
															muted: true
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-mon-tc",
															children: [
																timecode(playheadMs),
																" / ",
																timecode(timelineTotal)
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-mon-badge",
															children: t("monitorProgram")
														}),
														activeSubtitle?.text === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															"data-timeline-subtitle-preview": "true",
															className: "iv-mon-sub",
															style: {
																fontSize: `${Math.max(11, Math.min(26, Math.round((activeSubtitle.style?.fontSize ?? 32) / 2)))}px`,
																color: activeSubtitle.style?.color ?? "#ffffff",
																...(activeSubtitle.style?.position ?? "bottom") === "bottom" ? { bottom: "9px" } : {},
																...activeSubtitle.style?.position === "top" ? { top: "9px" } : {},
																...activeSubtitle.style?.position === "middle" ? {
																	top: "50%",
																	transform: "translateY(-50%)"
																} : {}
															},
															children: activeSubtitle.text
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-transport",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "iv-tp-btn iv-tp-btn--play",
															"data-timeline-play": "true",
															"aria-label": playing ? t("transportPause") : t("transportPlay"),
															title: playing ? t("transportPause") : t("transportPlay"),
															"aria-pressed": playing,
															onClick: togglePlay,
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: playing ? "pause" : "play",
																size: 11
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-tc-now",
															children: timecode(playheadMs)
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "range",
															className: "iv-scrub",
															"data-timeline-playhead": "true",
															min: 0,
															max: Math.max(1, timelineTotal),
															value: playheadMs,
															"aria-label": t("playhead"),
															onChange: (event) => {
																setPreviewMs(Number(event.target.value));
															}
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-tc-total",
															children: ["/ ", timecode(timelineTotal)]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-zoom",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																	name: "search",
																	size: 11
																}),
																t("timelineZoom"),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	className: "iv-scrub",
																	type: "range",
																	min: 0,
																	max: 100,
																	defaultValue: 60,
																	"aria-label": t("timelineZoom")
																})
															]
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-tl",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-ruler",
														"aria-hidden": "true",
														children: [[
															0,
															25,
															50,
															75,
															100
														].map((pct) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { left: `${pct}%` } }, pct)), [
															0,
															25,
															50,
															75,
															100
														].map((pct) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
															style: { left: `${pct}%` },
															children: timecode(timelineTotal * pct / 100)
														}, pct))]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-tracks",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "iv-playhead",
															style: { left: `calc(46px + (100% - 46px) * ${playheadMs / Math.max(1, timelineTotal)})` }
														}), timeline.tracks.map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "iv-track",
															"data-timeline-track": track.kind,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-t-head",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "micro",
																		children: t(trackIdKey(track.kind))
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-t-kind",
																		children: t(trackKindKey(track.kind))
																	}),
																	track.kind === "audio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																		className: "iv-t-fade",
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "micro",
																				children: t("trackFade")
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																				type: "number",
																				className: "iv-input",
																				min: 0,
																				max: MAX_TRACK_FADE_MS,
																				step: 50,
																				value: track.fadeMs ?? 0,
																				"aria-label": t("trackFade"),
																				title: t("trackFade"),
																				"data-timeline-track-fade": track.fadeMs ?? 0,
																				onChange: (event) => {
																					const fadeMs = Number(event.target.value);
																					patchTrack(track.id, (current) => ({
																						...current,
																						fadeMs: Math.max(0, Math.min(MAX_TRACK_FADE_MS, fadeMs))
																					}));
																				}
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																				className: "micro",
																				children: "ms"
																			})
																		]
																	}) : null
																]
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: `iv-t-lane${dropTrackId === track.id ? " iv-t-lane--drop" : ""}`,
																"data-timeline-lane": track.kind,
																ref: (element) => {
																	if (element === null) laneRefs.current.delete(track.id);
																	else laneRefs.current.set(track.id, element);
																},
																onDragOver: (event) => {
																	const clipDrag = event.dataTransfer.types.includes(CLIP_DRAG_TYPE);
																	const assetDrag = event.dataTransfer.types.includes(ASSET_DRAG_TYPE) || event.dataTransfer.types.includes("text/plain");
																	if (clipDrag || assetDrag && track.kind !== "subtitle") {
																		event.preventDefault();
																		setDropTrackId(track.id);
																	}
																},
																onDragLeave: () => {
																	setDropTrackId((current) => current === track.id ? void 0 : current);
																},
																onDrop: (event) => {
																	onLaneDrop(event, track);
																},
																children: [track.clips.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
																	className: "iv-meta",
																	children: t("timelineEmpty")
																}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "iv-clips",
																	children: track.clips.map((clip) => {
																		const ratio = Math.max(1, timelineTotal);
																		const left = clip.startMs / ratio * 100;
																		const width = Math.max(1.5, clip.durationMs / ratio * 100);
																		const splitInside = playheadMs > clip.startMs && playheadMs < clip.startMs + effectiveDurationMs(clip);
																		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																			className: `iv-clip iv-clip--${track.kind}${selectedClipId === clip.id ? " iv-clip--sel" : ""}`,
																			"data-timeline-clip": clip.id,
																			"data-timeline-clip-kind": track.kind,
																			"data-timeline-clip-selected": selectedClipId === clip.id ? "true" : "false",
																			draggable: true,
																			onDragStart: (event) => {
																				onClipDragStart(event, track.id, clip.id);
																			},
																			onClick: () => {
																				setSelectedClipId(clip.id);
																			},
																			style: {
																				left: `${left}%`,
																				width: `${width}%`
																			},
																			children: [
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																					className: "iv-clip-h iv-clip-h--l",
																					"data-timeline-clip-handle": "left",
																					role: "separator",
																					"aria-orientation": "vertical",
																					"aria-label": `${t("clipResizeStart")} ${clip.id}`,
																					onMouseDown: (event) => {
																						onHandleMouseDown(event, track.id, clip.id, "left");
																					}
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																					className: "iv-clip-h iv-clip-h--r",
																					"data-timeline-clip-handle": "right",
																					role: "separator",
																					"aria-orientation": "vertical",
																					"aria-label": `${t("clipResizeEnd")} ${clip.id}`,
																					onMouseDown: (event) => {
																						onHandleMouseDown(event, track.id, clip.id, "right");
																					}
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																					className: "iv-clip-top",
																					children: [
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																							name: TRACK_ICONS[track.kind],
																							size: 11
																						}),
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																							className: "iv-ellipsis",
																							title: clip.assetPath ?? clip.text ?? "",
																							children: track.kind === "subtitle" ? clip.text ?? "" : baseName(clip.assetPath ?? "")
																						}),
																						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																							className: "iv-clip-dur",
																							children: [(clip.durationMs / 1e3).toFixed(1), "s"]
																						})
																					]
																				}),
																				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																					className: "iv-clip-row",
																					children: [
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																							type: "number",
																							className: "iv-input",
																							value: clip.startMs,
																							"aria-label": `${t("clipStart")} ${clip.id}`,
																							onChange: (event) => {
																								const startMs = Number(event.target.value);
																								patchTrack(track.id, (current) => ({
																									...current,
																									clips: current.clips.map((item) => item.id === clip.id ? {
																										...item,
																										startMs
																									} : item)
																								}));
																							}
																						}),
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																							type: "number",
																							className: "iv-input",
																							value: clip.durationMs,
																							"aria-label": `${t("clipDuration")} ${clip.id}`,
																							onChange: (event) => {
																								const durationMs = Number(event.target.value);
																								patchClip(track.id, clip.id, (item) => ({
																									...item,
																									durationMs
																								}));
																							}
																						}),
																						track.kind === "subtitle" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
																							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																								type: "number",
																								className: "iv-input",
																								min: CLIP_SPEED_RANGE.min,
																								max: CLIP_SPEED_RANGE.max,
																								step: .25,
																								value: clip.speed ?? 1,
																								"aria-label": `${t("clipSpeed")} ${clip.id}`,
																								title: t("clipSpeed"),
																								onChange: (event) => {
																									const speed = Number(event.target.value);
																									patchClip(track.id, clip.id, (item) => ({
																										...item,
																										speed: Math.min(CLIP_SPEED_RANGE.max, Math.max(CLIP_SPEED_RANGE.min, speed))
																									}));
																								}
																							}),
																							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																								type: "number",
																								className: "iv-input",
																								min: 0,
																								max: MAX_CLIP_FADE_MS,
																								step: 50,
																								value: clip.fade ?? 0,
																								"aria-label": `${t("clipFade")} ${clip.id}`,
																								title: t("clipFade"),
																								onChange: (event) => {
																									const fade = Number(event.target.value);
																									patchClip(track.id, clip.id, (item) => ({
																										...item,
																										fade: Math.max(0, Math.min(MAX_CLIP_FADE_MS, fade))
																									}));
																								}
																							}),
																							track.kind === "video" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
																								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																									className: "iv-select",
																									value: clip.transition ?? "",
																									"aria-label": `${t("clipTransition")} ${clip.id}`,
																									title: t("clipTransition"),
																									onChange: (event) => {
																										const transition = event.target.value === "" ? void 0 : event.target.value;
																										patchClip(track.id, clip.id, (item) => ({
																											...item,
																											...transition === void 0 ? { transition: void 0 } : { transition }
																										}));
																									},
																									children: [
																										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																											value: "",
																											children: t("none")
																										}),
																										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																											value: "fade",
																											children: t("transitionFade")
																										}),
																										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																											value: "wipeleft",
																											children: t("transitionWipeleft")
																										}),
																										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																											value: "circleopen",
																											children: t("transitionCircleopen")
																										})
																									]
																								}),
																								clip.transition === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																									type: "number",
																									className: "iv-input",
																									min: 0,
																									max: MAX_CLIP_TRANSITION_MS,
																									step: 50,
																									value: clip.transitionDurationMs ?? 400,
																									"aria-label": `${t("clipTransitionDuration")} ${clip.id}`,
																									title: t("clipTransitionDuration"),
																									onChange: (event) => {
																										const transitionDurationMs = Number(event.target.value);
																										patchClip(track.id, clip.id, (item) => ({
																											...item,
																											transitionDurationMs: Math.max(0, Math.min(MAX_CLIP_TRANSITION_MS, transitionDurationMs))
																										}));
																									}
																								}),
																								clip.crop === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																									type: "button",
																									className: "iv-btn iv-btn--sm",
																									"aria-label": `${t("clipCrop")} ${clip.id}`,
																									title: t("clipCrop"),
																									onClick: (event) => {
																										event.stopPropagation();
																										patchClip(track.id, clip.id, (item) => ({
																											...item,
																											crop: {
																												x: 0,
																												y: 0,
																												width: 1920,
																												height: 1080
																											}
																										}));
																									},
																									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																										name: "sliders",
																										size: 11
																									})
																								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																										type: "number",
																										className: "iv-input",
																										min: 0,
																										value: clip.crop.x,
																										"aria-label": `${t("clipCropX")} ${clip.id}`,
																										title: t("clipCropX"),
																										onChange: (event) => {
																											patchClip(track.id, clip.id, (item) => item.crop === void 0 ? item : {
																												...item,
																												crop: {
																													...item.crop,
																													x: Math.max(0, Number(event.target.value))
																												}
																											});
																										}
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																										type: "number",
																										className: "iv-input",
																										min: 0,
																										value: clip.crop.y,
																										"aria-label": `${t("clipCropY")} ${clip.id}`,
																										title: t("clipCropY"),
																										onChange: (event) => {
																											patchClip(track.id, clip.id, (item) => item.crop === void 0 ? item : {
																												...item,
																												crop: {
																													...item.crop,
																													y: Math.max(0, Number(event.target.value))
																												}
																											});
																										}
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																										type: "number",
																										className: "iv-input",
																										min: 2,
																										step: 2,
																										value: clip.crop.width,
																										"aria-label": `${t("clipCropW")} ${clip.id}`,
																										title: t("clipCropW"),
																										onChange: (event) => {
																											patchClip(track.id, clip.id, (item) => item.crop === void 0 ? item : {
																												...item,
																												crop: {
																													...item.crop,
																													width: Math.max(2, Number(event.target.value))
																												}
																											});
																										}
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																										type: "number",
																										className: "iv-input",
																										min: 2,
																										step: 2,
																										value: clip.crop.height,
																										"aria-label": `${t("clipCropH")} ${clip.id}`,
																										title: t("clipCropH"),
																										onChange: (event) => {
																											patchClip(track.id, clip.id, (item) => item.crop === void 0 ? item : {
																												...item,
																												crop: {
																													...item.crop,
																													height: Math.max(2, Number(event.target.value))
																												}
																											});
																										}
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																										type: "button",
																										className: "iv-btn iv-btn--sm",
																										"aria-label": `${t("clipCropRemove")} ${clip.id}`,
																										title: t("clipCropRemove"),
																										onClick: (event) => {
																											event.stopPropagation();
																											patchClip(track.id, clip.id, (item) => ({
																												...item,
																												crop: void 0
																											}));
																										},
																										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																											name: "x",
																											size: 11
																										})
																									})
																								] })
																							] }) : null
																						] }),
																						track.kind === "subtitle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
																							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																								type: "number",
																								className: "iv-input",
																								min: 8,
																								max: 200,
																								value: clip.style?.fontSize ?? 32,
																								"aria-label": `${t("styleFontSize")} ${clip.id}`,
																								onChange: (event) => {
																									const fontSize = Number(event.target.value);
																									patchTrack(track.id, (current) => ({
																										...current,
																										clips: current.clips.map((item) => item.id === clip.id ? {
																											...item,
																											style: {
																												...item.style,
																												fontSize
																											}
																										} : item)
																									}));
																								}
																							}),
																							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																								type: "color",
																								className: "iv-color",
																								value: clip.style?.color ?? "#ffffff",
																								"aria-label": `${t("styleColor")} ${clip.id}`,
																								onChange: (event) => {
																									const color = event.target.value;
																									patchTrack(track.id, (current) => ({
																										...current,
																										clips: current.clips.map((item) => item.id === clip.id ? {
																											...item,
																											style: {
																												...item.style,
																												color
																											}
																										} : item)
																									}));
																								}
																							}),
																							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																								className: "iv-select",
																								value: clip.style?.position ?? "bottom",
																								"aria-label": `${t("stylePosition")} ${clip.id}`,
																								onChange: (event) => {
																									const position = event.target.value;
																									patchTrack(track.id, (current) => ({
																										...current,
																										clips: current.clips.map((item) => item.id === clip.id ? {
																											...item,
																											style: {
																												...item.style,
																												position
																											}
																										} : item)
																									}));
																								},
																								children: [
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																										value: "top",
																										children: "top"
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																										value: "middle",
																										children: "middle"
																									}),
																									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																										value: "bottom",
																										children: "bottom"
																									})
																								]
																							})
																						] }) : null,
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																							type: "button",
																							className: "iv-btn",
																							"data-timeline-clip-split": clip.id,
																							"aria-label": `${t("clipSplit")} ${clip.id}`,
																							title: splitInside ? t("clipSplit") : t("clipSplitOutsideHint"),
																							disabled: !splitInside,
																							onClick: (event) => {
																								event.stopPropagation();
																								splitClip(clip.id);
																							},
																							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																								name: "storyboard",
																								size: 11
																							})
																						}),
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																							type: "button",
																							className: "iv-btn",
																							"aria-label": `${t("clipDuplicate")} ${clip.id}`,
																							title: t("clipDuplicate"),
																							onClick: (event) => {
																								event.stopPropagation();
																								duplicateClip$1(clip.id);
																							},
																							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																								name: "copy",
																								size: 11
																							})
																						}),
																						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																							type: "button",
																							className: "iv-btn",
																							"aria-label": `${t("remove")} ${clip.id}`,
																							onClick: () => {
																								patchTrack(track.id, (current) => ({
																									...current,
																									clips: current.clips.filter((item) => item.id !== clip.id)
																								}));
																							},
																							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																								name: "trash",
																								size: 11
																							})
																						})
																					]
																				})
																			]
																		}, clip.id);
																	})
																}), track.kind === "subtitle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "iv-add-row",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		className: "iv-input",
																		style: {
																			flex: 1,
																			minWidth: "110px"
																		},
																		placeholder: t("subtitlePlaceholder"),
																		"aria-label": t("subtitlePlaceholder"),
																		value: subtitleDraft,
																		onChange: (event) => {
																			setSubtitleDraft(event.target.value);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--sm",
																		disabled: subtitleDraft.trim() === "",
																		"aria-label": t("addSubtitle"),
																		onClick: () => {
																			appendClip(track.id, { text: subtitleDraft.trim() });
																			setSubtitleDraft("");
																		},
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), t("addSubtitle")]
																	})]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "iv-add-row",
																	"data-timeline-subtitles-batch": "true",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																		className: "iv-input",
																		rows: 2,
																		style: {
																			flex: 1,
																			minWidth: "140px",
																			resize: "vertical"
																		},
																		placeholder: t("subtitlesBatchPlaceholder"),
																		"aria-label": t("subtitlesBatchPlaceholder"),
																		"data-timeline-subtitles-batch-input": "true",
																		value: subtitleBatchDraft,
																		onChange: (event) => {
																			setSubtitleBatchDraft(event.target.value);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--sm",
																		disabled: subtitleBatchDraft.trim() === "",
																		"aria-label": t("subtitlesBatch"),
																		"data-timeline-subtitles-batch-apply": "true",
																		onClick: () => {
																			applyBatchSubtitles(track.id, subtitleBatchDraft);
																			setSubtitleBatchDraft("");
																		},
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "subtitle" }), t("subtitlesBatch")]
																	})]
																})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "iv-add-row",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																		className: "iv-select",
																		"aria-label": `${t("pickAsset")} ${track.kind}`,
																		value: clipAssetPath,
																		onChange: (event) => {
																			setClipAssetPath(event.target.value);
																		},
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																			value: "",
																			children: t("pickAsset")
																		}), assets.filter((candidate) => track.kind === "audio" ? candidate.kind === "video" : candidate.kind === track.kind).map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																			value: candidate.path,
																			children: baseName(candidate.path)
																		}, candidate.id))]
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--sm",
																		disabled: clipAssetPath === "",
																		"aria-label": `${t("addClip")} ${track.kind}`,
																		onClick: () => {
																			appendClip(track.id, { assetPath: clipAssetPath });
																			setClipAssetPath("");
																		},
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), t("addClip")]
																	})]
																})]
															})]
														}, track.id))]
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "iv-meta",
													children: t("previewNote")
												})
											]
										})
									}) : null
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-dock",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneHealth",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneHealth"),
											t,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-pane-tile",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
														name: "sliders",
														size: 13
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
													className: "iv-pane-title",
													children: t("paneHealth")
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssetHealthPanel, {
												api: apiRef.current,
												formatBytes,
												t: (key) => t(key)
											})]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneAssets",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneAssets"),
											t,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-pane-head",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-pane-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "layers",
																size: 13
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
															className: "iv-pane-title",
															children: t("paneAssets")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "iv-pane-actions",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "iv-select",
																"aria-label": t("filterAll"),
																value: assetFilter,
																onChange: (event) => {
																	setAssetFilter(event.target.value);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "all",
																		children: t("filterAll")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "image",
																		children: t("filterImage")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "video",
																		children: t("filterVideo")
																	})
																]
															})
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-toolbar",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--sm",
															disabled: busy || activeProject === void 0 || outputs.length === 0,
															onClick: () => {
																run(async () => {
																	const project = activeProject;
																	if (project === void 0) return;
																	const known = new Set(assets.map((asset) => asset.path));
																	const candidate = outputs.find((output) => !known.has(output.path));
																	if (candidate === void 0) {
																		setNotice({
																			text: assets.length === 0 ? t("noOutputs") : t("alreadyRegistered"),
																			tone: "info"
																		});
																		return;
																	}
																	if (!(await apiRef.current.attachAsset({
																		projectId: project.id,
																		path: candidate.path,
																		kind: candidate.kind,
																		bytes: candidate.bytes
																	})).created) setNotice({
																		text: t("alreadyRegistered"),
																		tone: "info"
																	});
																	setAssets(await apiRef.current.listAssets(project.id));
																});
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), t("registerLatest")]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--sm",
															disabled: busy || activeProject === void 0 || pendingOutputs.length === 0,
															title: t("attachAll"),
															onClick: () => {
																run(async () => {
																	const project = activeProject;
																	if (project === void 0) return;
																	if (pendingOutputs.length === 0) {
																		setNotice({
																			text: t("alreadyRegistered"),
																			tone: "info"
																		});
																		return;
																	}
																	const result = await apiRef.current.attachAssets({
																		projectId: project.id,
																		items: pendingOutputs.map((output) => ({
																			path: output.path,
																			kind: output.kind,
																			bytes: output.bytes
																		}))
																	});
																	setAssets(await apiRef.current.listAssets(project.id));
																	setNotice({
																		text: `${t("attachAllDone")}：${result.created}`,
																		tone: "info"
																	});
																});
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), `${t("attachAll")} (${pendingOutputs.length})`]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: "iv-btn iv-btn--sm",
															style: { cursor: "pointer" },
															title: t("importFiles"),
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }),
																t("importFiles"),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "file",
																	multiple: true,
																	accept: "image/*,video/*",
																	style: { display: "none" },
																	onChange: (event) => {
																		const paths = [...event.target.files ?? []].map((file) => file.path).filter((entry) => typeof entry === "string" && entry !== "");
																		event.target.value = "";
																		if (paths.length === 0) {
																			setNotice({
																				text: t("importUnsupported"),
																				tone: "error"
																			});
																			return;
																		}
																		run(async () => {
																			const project = activeProject;
																			if (project === void 0) return;
																			const result = await apiRef.current.importMedia({
																				projectId: project.id,
																				paths
																			});
																			setAssets(await apiRef.current.listAssets(project.id));
																			setNotice({
																				text: `${t("importDone")}：${result.imported}${result.skipped.length > 0 ? ` · ${t("skippedCount")} ${result.skipped.length}` : ""}`,
																				tone: "info"
																			});
																		});
																	}
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--sm",
															disabled: busy || activeProject === void 0,
															"aria-label": t("compactAssets"),
															title: t("compactAssets"),
															onClick: () => {
																run(async () => {
																	const project = activeProject;
																	if (project === void 0) return;
																	const removed = await apiRef.current.compactAssets();
																	setAssets(await apiRef.current.listAssets(project.id));
																	setNotice({
																		text: `${t("compacted")} · ${removed}`,
																		tone: "info"
																	});
																});
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "copy" }), t("compactAssets")]
														})
													]
												}),
												selectedAssets.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-bulk",
													"data-asset-bulk": "true",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-chip iv-chip--run",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																className: "iv-dot",
																"aria-hidden": "true"
															}), t("assetSelectedCount").replace("{n}", String(selectedAssets.length))]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--danger iv-btn--sm",
															"data-bulk-remove": "true",
															disabled: busy,
															onClick: () => {
																bulkRemoveAssets(false);
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "trash",
																size: 11
															}), t("bulkRemove")]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--sm",
															"data-bulk-reference": "true",
															disabled: busy,
															onClick: () => {
																bulkReferenceAssets();
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "plus",
																size: 11
															}), t("bulkReference")]
														}),
														bulkForceIds === void 0 || bulkForceIds.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--danger iv-btn--sm",
															"data-bulk-force-remove": "true",
															disabled: busy,
															onClick: () => {
																bulkRemoveAssets(true);
															},
															children: [
																t("bulkForceRemove"),
																" (",
																bulkForceIds.length,
																")"
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "iv-btn iv-btn--ghost iv-btn--sm",
															onClick: () => {
																setSelectedAssetIds([]);
																setBulkForceIds(void 0);
															},
															children: t("bulkClear")
														})
													]
												}),
												visibleAssets.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-empty",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-empty-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "layers",
																size: 17
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("noAssets") }),
														outputs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("noOutputs") }) : null
													]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VirtualList, {
													className: "iv-list",
													items: visibleAssets,
													renderRow: (asset, _index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
														className: "iv-row",
														"data-active": asset.id === selectedId ? "true" : "false",
														draggable: true,
														"data-asset-draggable": "true",
														onDragStart: (event) => {
															onAssetDragStart(event, asset);
														},
														onClick: () => {
															setPreviewPath(void 0);
															setSelectedId(asset.id);
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
																className: "iv-check iv-row-check",
																onClick: (event) => {
																	event.stopPropagation();
																},
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "checkbox",
																	checked: selectedAssetIds.includes(asset.id),
																	"data-asset-select": asset.id,
																	"aria-label": `${t("assetSelect")} ${baseName(asset.path)}`,
																	onChange: () => {
																		toggleAssetSelection(asset.id);
																	}
																})
															}),
															asset.kind === "image" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
																className: "iv-thumb",
																src: `/outputs/${encodeURIComponent(baseName(asset.path))}`,
																alt: ""
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-tile iv-tile--video",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																	name: "video",
																	size: 13
																})
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: "iv-row-btn",
																"aria-pressed": asset.id === selectedId,
																"aria-label": `${t("panePreview")} ${baseName(asset.path)}`,
																onClick: () => {
																	setPreviewPath(void 0);
																	setSelectedId(asset.id);
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-ellipsis",
																	children: baseName(asset.path)
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: formatBytes(asset.bytes)
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-row-actions",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--icon iv-btn--sm iv-btn--ghost",
																		"aria-label": `${t("referenceAsset")} ${baseName(asset.path)}`,
																		title: t("referenceAsset"),
																		disabled: busy,
																		onClick: (event) => {
																			event.stopPropagation();
																			if (asset.kind === "image") addReferenceImage(asset.path);
																			else setGenerateRefVideo(asset.path);
																		},
																		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																			name: "plus",
																			size: 12
																		})
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: `iv-btn iv-btn--icon iv-btn--sm${confirming === asset.id ? " iv-btn--danger" : " iv-btn--ghost"}`,
																		"aria-label": `${confirming === asset.id ? t("confirmRemove") : t("remove")} ${baseName(asset.path)}`,
																		title: confirming === asset.id ? t("confirmRemove") : t("remove"),
																		disabled: busy,
																		onClick: () => {
																			if (confirming !== asset.id) {
																				setConfirming(asset.id);
																				setForceTarget(void 0);
																				return;
																			}
																			setConfirming(void 0);
																			const force = forceTarget === asset.id;
																			run(async () => {
																				try {
																					await apiRef.current.removeAsset(asset.id, force);
																					setForceTarget(void 0);
																					setAssets(await apiRef.current.listAssets(asset.projectId));
																				} catch (error) {
																					if (!force) setForceTarget(asset.id);
																					throw error;
																				}
																			});
																		},
																		children: confirming === asset.id ? t("confirmRemove") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "trash" })
																	}),
																	forceTarget === asset.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--danger iv-btn--sm",
																		"data-workbench-force-remove": asset.id,
																		"aria-label": `${t("forceRemove")} ${baseName(asset.path)}`,
																		disabled: busy,
																		onClick: () => {
																			run(async () => {
																				await apiRef.current.removeAsset(asset.id, true);
																				setForceTarget(void 0);
																				setAssets(await apiRef.current.listAssets(asset.projectId));
																			});
																		},
																		children: t("forceRemove")
																	}) : null
																]
															})
														]
													}, asset.id)
												})
											]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "panePreview",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("panePreview"),
											t,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-pane-tile",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
														name: "eye",
														size: 13
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
													className: "iv-pane-title",
													children: t("panePreview")
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-body",
												children: [hostIsLoopback ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
													className: "iv-banner",
													"data-workbench-host-hint": "remote",
													style: {
														color: "var(--iv-warn)",
														background: "var(--iv-warn-soft)",
														border: "1px solid color-mix(in srgb, var(--iv-warn) 32%, transparent)",
														borderRadius: "5px",
														padding: "6px 9px",
														fontSize: "10.5px",
														display: "flex",
														alignItems: "flex-start",
														gap: "6px"
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
														name: "alert",
														size: 12
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("hostHintRemote") })]
												}), previewTarget === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-empty",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-empty-tile",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
															name: "eye",
															size: 17
														})
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("previewEmpty") })]
												}) : previewTarget.kind === "video" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
													src: `/outputs/${encodeURIComponent(baseName(previewTarget.path))}`,
													controls: true
												}, previewTarget.path) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
													alt: baseName(previewTarget.path),
													src: `/outputs/${encodeURIComponent(baseName(previewTarget.path))}`
												})]
											})]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneResources",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneResources"),
											t,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-head",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-pane-tile",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
															name: "tag",
															size: 13
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
														className: "iv-pane-title",
														children: t("paneResources")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "iv-pane-actions",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															className: "iv-input",
															style: { width: "96px" },
															"aria-label": t("resourceFilterPlaceholder"),
															placeholder: t("resourceFilterPlaceholder"),
															"data-resource-filter": "true",
															value: resourceFilter,
															onChange: (event) => {
																setResourceFilter(event.target.value);
															}
														})
													})
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-body",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-tabs",
														role: "tablist",
														"aria-label": t("resourceLibraries"),
														children: [[
															"role",
															"scene",
															"prop"
														].map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															role: "tab",
															"aria-selected": resourceTab === kind,
															className: `iv-tab${resourceTab === kind ? " on" : ""}`,
															"data-resource-tab": kind,
															onClick: () => {
																setResourceTab(kind);
																setResourceFilter("");
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: RESOURCE_ICONS[kind],
																size: 11
															}), t(kindKey(kind))]
														}, kind)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: "iv-select iv-select--sm",
															"aria-label": t("resourceTabOther"),
															"data-resource-tab": "other",
															value: resourceTab === "other" ? resourceOtherKind : "",
															onChange: (event) => {
																setResourceTab("other");
																setResourceOtherKind(event.target.value);
																setResourceFilter("");
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "",
																disabled: true,
																children: t("resourceTabOther")
															}), RESOURCE_KINDS.filter((kind) => kind !== "role" && kind !== "scene" && kind !== "prop").map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: kind,
																children: t(kindKey(kind))
															}, kind))]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-add-row",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: t(kindKey(activeResourceKind))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																className: "iv-input",
																style: {
																	flex: 1,
																	minWidth: "78px"
																},
																"aria-label": t("resourceNamePlaceholder"),
																placeholder: t("resourceNamePlaceholder"),
																value: resourceName,
																onChange: (event) => {
																	setResourceName(event.target.value);
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																className: "iv-input",
																style: {
																	flex: 1,
																	minWidth: "78px"
																},
																"aria-label": t("notePlaceholder"),
																placeholder: t("notePlaceholder"),
																value: resourceNote,
																onChange: (event) => {
																	setResourceNote(event.target.value);
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: "iv-btn iv-btn--acc iv-btn--sm",
																disabled: busy || activeProject === void 0 || resourceName.trim() === "",
																onClick: () => {
																	run(async () => {
																		const project = activeProject;
																		if (project === void 0) return;
																		const note = resourceNote.trim();
																		await apiRef.current.createResource({
																			projectId: project.id,
																			kind: activeResourceKind,
																			name: resourceName.trim(),
																			...note === "" ? {} : { note },
																			...resourceAsset === void 0 ? {} : { assetPath: resourceAsset }
																		});
																		setResourceAsset(void 0);
																		setResourceName("");
																		setResourceNote("");
																		await loadResources(project.id);
																	});
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), t("addResource")]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-add-row",
														style: { marginTop: "4px" },
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "iv-meta",
																children: [t("resourceReference"), "："]
															}),
															resourceAsset === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: t("generateReferenceNone")
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-chip",
																title: resourceAsset,
																children: baseName(resourceAsset)
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: "iv-btn iv-btn--ghost iv-btn--sm",
																onClick: () => setResourceAsset(void 0),
																children: t("resourceClear")
															})] }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: "iv-btn iv-btn--ghost iv-btn--sm",
																disabled: selectedAsset === void 0,
																onClick: () => setResourceAsset(selectedAsset?.path),
																children: t("resourceUseSelected")
															})
														]
													}),
													editingResource === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-refs-editor",
														"data-resource-refs-editor": editingResource.id,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-add-row",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-meta",
																	children: t("resourceRefsEditorTitle").replace("{name}", editingResource.name)
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "iv-count",
																	children: t("resourceRefsCount").replace("{n}", String(resourceRefs(editingResource).length))
																})]
															}),
															resourceRefs(editingResource).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-meta",
																children: t("resourceRefsNone")
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
																className: "iv-ref-list",
																children: resourceRefs(editingResource).map((path, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
																	className: "iv-ref-chip",
																	"data-resource-ref": path,
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "iv-ref-order",
																			children: index + 1
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "iv-ref-role",
																			children: index === 0 ? t("generateRefsBase") : t("generateRefsStyle")
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "iv-ellipsis",
																			title: path,
																			children: baseName(path)
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			className: "iv-btn iv-btn--icon iv-btn--sm",
																			"data-resource-ref-remove": path,
																			"aria-label": `${t("resourceRefsRemove")} ${baseName(path)}`,
																			title: t("resourceRefsRemove"),
																			disabled: busy,
																			onClick: () => {
																				removeRefFromResource(editingResource.id, path);
																			},
																			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																				name: "x",
																				size: 11
																			})
																		})
																	]
																}, path))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "iv-add-row",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--sm",
																		"data-resource-refs-add": "true",
																		disabled: busy || selectedAsset === void 0 || resourceRefs(editingResource).includes(selectedAsset.path) || resourceRefs(editingResource).length >= MAX_RESOURCE_REFS,
																		onClick: () => {
																			attachRefToResource(editingResource.id, selectedAsset?.path);
																		},
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																			name: "plus",
																			size: 11
																		}), t("resourceRefsAdd")]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--ghost iv-btn--sm",
																		"data-resource-refs-clear": "true",
																		disabled: busy || resourceRefs(editingResource).length === 0,
																		onClick: () => {
																			clearResourceRefs(editingResource.id);
																		},
																		children: t("resourceRefsClear")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "iv-btn iv-btn--ghost iv-btn--sm",
																		onClick: () => {
																			setEditingResourceId(void 0);
																		},
																		children: t("cancel")
																	})
																]
															})
														]
													}),
													visibleResources.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-empty",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-empty-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "tag",
																size: 17
															})
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("noResources") })]
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VirtualList, {
														className: "iv-list",
														items: visibleResources,
														renderRow: (resource, _index) => {
															const refs = resourceRefs(resource);
															return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
																className: "iv-row",
																onClick: () => {
																	const first = refs[0];
																	if (first === void 0) return;
																	setPreviewPath({
																		path: first,
																		kind: "image"
																	});
																	setSelectedId(void 0);
																},
																children: [
																	refs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "iv-tile",
																		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																			name: RESOURCE_ICONS[resource.kind],
																			size: 13
																		})
																	}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "iv-thumb-wrap",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
																			className: "iv-thumb",
																			src: `/outputs/${encodeURIComponent(baseName(refs[0]))}`,
																			alt: ""
																		}), refs.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			className: "iv-thumb-more",
																			children: ["+", refs.length - 1]
																		}) : null]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "iv-row-main iv-ellipsis",
																		title: resource.note ?? "",
																		children: [
																			t(kindKey(resource.kind)),
																			" · ",
																			resource.name,
																			resource.note === void 0 ? "" : ` · ${resource.note}`
																		]
																	}),
																	(() => {
																		const used = resourceUsage.filter((entry) => entry.resourceId === resource.id);
																		const latest = used[0];
																		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "iv-badge",
																			"data-resource-usage": resource.id,
																			title: latest?.assetPath ?? "",
																			children: used.length === 0 ? t("resourceUnused") : `${t("resourceUsedBy")} ${used.length} ${t("resourceUseUnit")}${latest === void 0 ? "" : ` · ${baseName(latest.assetPath)}`}`
																		});
																	})(),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		className: "iv-row-actions",
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--icon iv-btn--sm iv-btn--ghost",
																				"data-resource-attach": resource.id,
																				"aria-label": `${t("resourceAttachSelected")} · ${resource.name}`,
																				title: t("resourceAttachSelected"),
																				disabled: busy || selectedAsset === void 0 || refs.includes(selectedAsset.path) || refs.length >= MAX_RESOURCE_REFS,
																				onClick: (event) => {
																					event.stopPropagation();
																					attachRefToResource(resource.id, selectedAsset?.path);
																				},
																				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																					name: "plus",
																					size: 12
																				})
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--icon iv-btn--sm iv-btn--ghost",
																				"data-resource-refs-manage": resource.id,
																				"aria-label": `${t("resourceRefsManage")} · ${resource.name}`,
																				title: t("resourceRefsManage"),
																				disabled: busy,
																				onClick: (event) => {
																					event.stopPropagation();
																					setEditingResourceId((current) => current === resource.id ? void 0 : resource.id);
																				},
																				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																					name: "sliders",
																					size: 12
																				})
																			}),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: `iv-btn iv-btn--icon iv-btn--sm${confirming === resource.id ? " iv-btn--danger" : " iv-btn--ghost"}`,
																				"aria-label": `${confirming === resource.id ? t("confirmRemove") : t("remove")} ${resource.name}`,
																				title: confirming === resource.id ? t("confirmRemove") : t("remove"),
																				disabled: busy,
																				onClick: () => {
																					if (confirming !== resource.id) {
																						setConfirming(resource.id);
																						setForceTarget(void 0);
																						return;
																					}
																					setConfirming(void 0);
																					const force = forceTarget === resource.id;
																					run(async () => {
																						try {
																							await apiRef.current.removeResource(resource.id, force);
																							setForceTarget(void 0);
																							if (activeProject !== void 0) await loadResources(activeProject.id);
																						} catch (error) {
																							if (!force) setForceTarget(resource.id);
																							throw error;
																						}
																					});
																				},
																				children: confirming === resource.id ? t("confirmRemove") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "trash" })
																			}),
																			forceTarget === resource.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: "iv-btn iv-btn--danger iv-btn--sm",
																				"data-workbench-force-remove": resource.id,
																				"aria-label": `${t("forceRemove")} ${resource.name}`,
																				disabled: busy,
																				onClick: () => {
																					run(async () => {
																						await apiRef.current.removeResource(resource.id, true);
																						setForceTarget(void 0);
																						if (activeProject !== void 0) await loadResources(activeProject.id);
																					});
																				},
																				children: t("forceRemove")
																			}) : null
																		]
																	})
																]
															}, resource.id);
														}
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneTasks",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneTasks"),
											t,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-pane-tile",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
														name: "clock",
														size: 13
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
													className: "iv-pane-title",
													children: t("paneTasks")
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "iv-pane-body",
												children: tasks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "iv-empty",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-empty-tile",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
															name: "clock",
															size: 17
														})
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("noTasks") })]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VirtualList, {
													className: "iv-list",
													items: tasks,
													renderRow: (task, _index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskCard, {
														api: apiRef.current,
														task,
														projectId: activeProject?.id,
														statusLabel: t(statusKey(task.status)),
														dotClass: taskDotClass(task.status),
														metaText: `${task.model ?? "—"} · ${formatBytes(task.bytes ?? 0)} · ${clockTime(task.createdAt)}`,
														onPreview: (path, kind) => {
															setPreviewPath({
																path,
																kind
															});
															setSelectedId(assets.find((asset) => asset.path === path)?.id);
														},
														onUseAsReference: (path, kind) => {
															if (kind === "image") addReferenceImage(path);
															else setGenerateRefVideo(path);
														},
														onAddToTimeline: activeProject === void 0 ? void 0 : appendToTimeline,
														onTasksChanged: loadTasks,
														onAssetsChanged: refreshAssetsAfterGenerate,
														onNotice: (text, tone) => {
															setNotice({
																text,
																tone
															});
														},
														run: (action) => {
															run(action);
														},
														t
													}, task.id)
												})
											})]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneDiagnostics",
										"data-workbench-planned": "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PaneBoundary, {
											label: t("paneDiagnostics"),
											t,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-pane-head",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-pane-tile",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
															name: "sliders",
															size: 13
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
														className: "iv-pane-title",
														children: t("paneDiagnostics")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "iv-pane-actions",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-btn iv-btn--ghost iv-btn--sm",
															"aria-label": t("diagRefresh"),
															onClick: () => {
																loadDiagnostics();
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: "refresh",
																size: 11
															}), t("diagRefresh")]
														})
													})
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "iv-diag",
												"data-diagnostics-panel": "true",
												children: diagnostics === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "iv-meta",
													children: "…"
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-diag-row",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-diag-k",
															children: t("diagOutputs")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-diag-v",
															children: [
																diagnostics.outputs.files,
																" files · ",
																formatBytes(diagnostics.outputs.bytes),
																"· ",
																diagnostics.outputs.referenced,
																" ",
																t("resourceUsedBy").toLowerCase(),
																diagnostics.outputs.oldestAt === void 0 ? "" : ` · ${clockTime(diagnostics.outputs.oldestAt)} ~ ${clockTime(diagnostics.outputs.newestAt ?? "")}`
															]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-diag-row",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-diag-k",
															children: t("diagRenders")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "iv-diag-v",
															children: [
																diagnostics.renders.running,
																" running · ",
																diagnostics.renders.queued,
																" queued",
																diagnostics.renders.stats === void 0 ? "" : ` · ${t("diagRenderFinished")} ${diagnostics.renders.stats.finished} · ${t("diagRenderFailed")} ${diagnostics.renders.stats.failed}${diagnostics.renders.stats.durationMs === void 0 ? "" : ` · ${t("diagRenderP50")} ${diagnostics.renders.stats.durationMs.p50}ms / ${t("diagRenderP90")} ${diagnostics.renders.stats.durationMs.p90}ms`}`
															]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "iv-diag-row",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-diag-k",
															children: t("diagErrors")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-diag-v",
															children: diagnostics.errors.errorCount === 0 ? t("diagErrorsNone") : `${diagnostics.errors.errorCount}${diagnostics.errors.errors.length === 0 ? "" : ` · ${diagnostics.errors.errors[0]?.message ?? ""}`}`
														})]
													})
												] })
											})]
										})
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
						className: "iv-status",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dot",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("statusReady") }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("statOutputs"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: outputs.length })
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("statAssets"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: assets.length })
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("statTasks"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: tasks.length })
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-status-right",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hostIsLoopback ? "127.0.0.1" : window.location?.hostname ?? "" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-mono",
									children: kind
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Dictionary namespace owned by this plugin's browser half. */
		const NS = "image-video-workbench";
		/** English copy. */
		const en = {
			tabTitle: "dsh-image-video workbench",
			guideDescription: "Projects, media assets and generation tasks for image and video work.",
			sectionProject: "Project",
			projectNone: "No project yet",
			saveSaved: "Saved",
			saveSaving: "Saving…",
			saveDirty: "Unsaved changes",
			saveFailed: "Save failed",
			modeQuick: "Quick create",
			templateQuickImage: "Quick image",
			templateQuickVideo: "Quick video",
			templateStoryboard: "Storyboard",
			templateCover: "Cover image",
			templateProductionLine: "Production line",
			resourceReference: "Reference (makeup shot)",
			resourceUseSelected: "Use selected asset",
			resourceClear: "Clear",
			attachAll: "Register all new",
			skippedCount: "skipped",
			attachAllDone: "Registered",
			importFiles: "Import files…",
			importDone: "Imported",
			importUnsupported: "Cannot read file paths here — importing needs the desktop app.",
			generateReferenceLabel: "Reference image",
			generateReferenceNone: "None (text-to-image / text-to-video)",
			generateUseSelected: "Use selected asset",
			generateClearReference: "Clear reference",
			referenceAsset: "Reference in prompt",
			generateHeading: "Generate here",
			generatePromptLabel: "Prompt",
			generatePromptPlaceholder: "Describe the shot you want…",
			generateShortcutHint: "⌘/Ctrl + Enter to generate",
			generateImage: "Generate image",
			generateVideo: "Generate video",
			generating: "Generating…",
			generateCancel: "Cancel",
			generateDone: "Generated and filed as an asset",
			generateFailed: "Generation failed",
			generateNeedsProject: "Pick a project at the top first, otherwise the result cannot be filed.",
			generateCostHint: "Runs against the effective parameters — this is a real provider call.",
			modeWorkflow: "Workflow",
			modeTimeline: "Timeline",
			paneAssets: "Media assets",
			paneResources: "Resources",
			panePreview: "Preview",
			paneTasks: "Tasks",
			paneHealth: "Library health",
			emptyHint: "Projects, assets, the task ledger and a runnable node canvas are all available.",
			healthChecking: "Connecting to host…",
			healthFailed: "Host unavailable",
			panePlanned: "Not runnable yet — planned for a later phase",
			newProject: "New project",
			projectNamePlaceholder: "Project name",
			create: "Create",
			remove: "Remove",
			confirmRemove: "Confirm remove",
			refresh: "Refresh",
			noOutputs: "No media in the output directory yet",
			registerLatest: "Register latest output",
			noAssets: "No assets in this project yet",
			previewEmpty: "Select an asset to preview it",
			busy: "Working…",
			failed: "Operation failed",
			noTasks: "No tasks recorded yet",
			registerAsAsset: "Register as asset",
			statusQueued: "Queued",
			statusRunning: "Running",
			statusSucceeded: "Succeeded",
			statusFailed: "Failed",
			statusCancelled: "Cancelled",
			cancelTask: "Cancel task",
			defaultsEditHint: "Leave \"Not set\" to follow settings",
			defaultsGroupMode: "Media type",
			defaultsGroupImage: "Image",
			defaultsGroupVideo: "Video",
			optModeText: "Text",
			optModeImage: "Image",
			optModeVideo: "Video",
			optStylePhoto: "Photo",
			optStyleIllustration: "Illustration",
			optStyle3d: "3D render",
			optStyleAnime: "Anime",
			optStyleInk: "Ink painting",
			defaultsSaved: "Defaults saved",
			defaultsCancel: "Cancel",
			defaultsSave: "Save defaults",
			defaultsEdit: "Edit",
			resourceUseUnit: "artifacts",
			resourceUsedBy: "Used by",
			resourceUnused: "Not used by any artifact yet",
			statusImportedIdle: "Imported (not running)",
			resourceMotionTrack: "Motion track",
			paramTrack: "Track resource",
			forceRemove: "Delete anyway",
			hostHintRemote: "Preview needs a local host: /outputs is only served on loopback. Open this app via http://127.0.0.1:… instead.",
			none: "not set",
			defaultMediaMode: "Composer mode",
			defaultVideoDuration: "Video duration",
			defaultVideoAspectRatio: "Video ratio",
			defaultVideoProvider: "Video provider",
			defaultImageStyle: "Image style",
			defaultImageSize: "Image size",
			defaultImageProvider: "Image provider",
			defaultsTitle: "Effective defaults",
			exportResult: "Result",
			exportFailed: "Export failed",
			exportDone: "Exported",
			exportRunning: "Exporting",
			exportCancel: "Cancel export",
			exportStart: "Export video",
			ffmpegRecheck: "Re-check ffmpeg",
			ffmpegOk: "ffmpeg",
			stylePosition: "Position",
			styleColor: "Color",
			styleFontSize: "Size",
			playhead: "Playhead",
			previewNote: "Sequence preview: picks the clip at the playhead, no transcoding. Export may differ by a frame or two.",
			previewIdle: "No clip at this time",
			burnSubtitles: "Burn subtitles into the video",
			pickAsset: "Asset",
			timelineTitle: "Timeline",
			subtitlePlaceholder: "Subtitle text",
			timelineTotal: "Total",
			clipDuration: "Duration (ms)",
			clipStart: "Start (ms)",
			timelineEmpty: "No clips yet — add from the assets on the right",
			addSubtitle: "Add subtitle",
			addClip: "Add to track",
			trackSubtitle: "Subtitle track",
			trackAudio: "Audio track",
			trackVideo: "Video track",
			templateReferenceRemake: "Reference video remake (compare)",
			templateImageToVideo: "Image -> video -> subtitle -> render",
			templateCopyToVideo: "Copy -> storyboard -> image -> video",
			templateApply: "Apply template",
			templateTitle: "Template",
			runArtifacts: "artifacts",
			statusSkipped: "Skipped",
			runNone: "No run yet",
			runTitle: "Run",
			runRetry: "Retry failed nodes",
			runCancel: "Cancel run",
			runStart: "Run workflow",
			issuePlanned: "planned node cannot run",
			issueCycle: "graph has a cycle",
			issueDangling: "edge points at a missing node",
			issueSelfLoop: "node connects to itself",
			issuePort: "port types do not match",
			issueRequired: "required parameter is empty",
			validationOk: "Graph is runnable",
			validationTitle: "Graph check",
			compacted: "Merged duplicate records",
			compactAssets: "Merge duplicate records",
			paneCanvas: "Workflow canvas",
			canvasEdgesCount: "links",
			canvasNodesCount: "nodes",
			canvasNoParams: "This node has no parameters yet",
			canvasSelfLoop: "A node cannot connect to itself",
			nodeCreativeInput: "Creative input",
			nodeScript: "Script",
			nodeStoryboard: "Storyboard",
			nodeAssetReference: "Asset reference",
			nodeResourceReference: "Resource reference",
			nodeMotionTrack: "Motion track",
			nodeImageGenerate: "Image generate",
			nodeVideoGenerate: "Video generate",
			nodePreview: "Preview",
			nodePublishAsset: "Publish asset",
			nodeSubtitle: "Subtitle",
			nodeRender: "Render",
			nodeLipSync: "Lip sync",
			nodeFaceSwap: "Face swap",
			nodeVoiceSynthesize: "Voice synthesize",
			plannedLipSync: "Host does not expose lip-sync yet",
			plannedFaceSwap: "Host does not expose face swap yet",
			plannedVoice: "Per D6 this release keeps voice metadata only; no TTS yet",
			canvasPalette: "Node library",
			canvasAdd: "Add to canvas",
			canvasParams: "Node parameters",
			canvasFit: "Fit view",
			canvasEmpty: "Add nodes from the library on the left",
			canvasPlannedTag: "not available",
			canvasTransient: "Workflow is kept on this machine; project storage lands with the host endpoint",
			paramBrief: "Creative brief",
			paramScript: "Copy",
			paramShots: "Shots",
			paramNote: "Note",
			paramAsset: "Asset",
			paramResource: "Resource",
			paramModel: "Model (blank = host default)",
			paramPrompt: "Prompt",
			paramRatio: "Aspect ratio",
			paramDuration: "Duration (s)",
			paramResolution: "Resolution",
			paramReferenceVideo: "Reference video",
			paramCompare: "Also render a comparison clip",
			paramAssetName: "Asset name",
			ratioSquare: "1:1",
			ratioPortrait: "3:4",
			ratioLandscape: "16:9",
			ratioVertical: "9:16",
			resolutionDefault: "Model default",
			resolution480: "480P",
			resolution768: "768P",
			resolution2k: "2K",
			rename: "Rename",
			save: "Save",
			cancel: "Cancel",
			resourceNamePlaceholder: "Name",
			notePlaceholder: "Note (optional)",
			noResources: "No resources in this project yet",
			addResource: "Add resource",
			alreadyRegistered: "Already registered in this project",
			previewOutput: "Preview output",
			filterAll: "All media",
			filterImage: "Images",
			filterVideo: "Videos",
			kindRole: "Role",
			kindScene: "Scene",
			kindProp: "Prop",
			kindBrand: "Brand",
			kindStyle: "Style",
			kindVoice: "Voice",
			brandTagline: "Media production workbench",
			modeQuickHint: "Generate images or videos straight from the composer. Once a file lands in the local output directory, file it into the active project from the Media assets panel in one click.",
			statOutputs: "Outputs",
			statAssets: "Assets",
			statTasks: "Tasks",
			statResources: "Resources",
			heroStepChat: "Generate in chat",
			heroStepOutputs: "Lands in outputs",
			heroStepFile: "File into project",
			railAssets: "Media assets",
			railTasks: "Tasks",
			railHealth: "Library health",
			railDefaults: "Effective defaults",
			statusReady: "Ready",
			monitorProgram: "Program",
			transportPlay: "Play",
			timelineZoom: "Zoom",
			trackVideoId: "V1",
			trackAudioId: "A1",
			trackSubtitleId: "S1",
			paneError: "This panel hit an error",
			paneErrorRetry: "Retry",
			canvasUndo: "Undo",
			canvasRedo: "Redo",
			canvasCopy: "Copy nodes",
			canvasPaste: "Paste nodes",
			canvasPasteEmpty: "Clipboard is empty — select nodes and copy first",
			canvasDeleteSelected: "Delete selected nodes",
			canvasRunNode: "Run this node (with downstream)",
			canvasSelected: "selected",
			nodeErrorDetails: "Error details",
			clipDuplicate: "Duplicate clip",
			transportPause: "Pause",
			clipResizeStart: "Drag to change clip start",
			clipResizeEnd: "Drag to change clip duration",
			fps: "FPS",
			clipSpeed: "Speed",
			clipFade: "Fade (ms)",
			clipTransition: "Transition",
			clipTransitionDuration: "Transition duration (ms)",
			clipCrop: "Crop",
			clipCropX: "Crop X",
			clipCropY: "Crop Y",
			clipCropW: "Crop width",
			clipCropH: "Crop height",
			clipCropRemove: "Remove crop",
			trackFade: "Fade",
			normalizeLoudness: "Normalize loudness",
			transitionFade: "Fade",
			transitionWipeleft: "Wipe left",
			transitionCircleopen: "Circle open",
			subtitlesBatch: "Batch subtitles",
			subtitlesBatchPlaceholder: "Paste a script — auto-split into timed subtitles",
			subtitlesApply: "Lay subtitles",
			templateMarket: "Template market",
			templateMarketEmpty: "Pick a template to scaffold a workflow",
			templateDramaSeries: "Drama series (single episode)",
			paneDiagnostics: "Diagnostics",
			diagOutputs: "Outputs",
			diagRenders: "Renders",
			diagRenderP50: "p50",
			diagRenderP90: "p90",
			diagRenderFinished: "finished",
			diagRenderFailed: "failed",
			diagErrors: "Recent errors",
			diagErrorsNone: "No errors recorded",
			diagRefresh: "Refresh",
			generateRefsLabel: "Reference images (ordered)",
			generateRefsHint: "First = base image, the rest = style / face references. Up to 6 — drag a chip or use the arrows to reorder.",
			generateRefsAdd: "Add selected asset",
			generateRefsFull: "At most 6 reference images",
			generateRefsMoveUp: "Move earlier",
			generateRefsMoveDown: "Move later",
			generateRefsBase: "base",
			generateRefsStyle: "ref",
			generateElapsed: "Generating · {sec}s",
			generateProgress: "Generation progress",
			videoLastFrame: "Last frame image",
			videoReferenceVideo: "Reference video",
			videoEditHint: "Video generation only: the last frame goes out as media[].type=last_frame; a reference video as reference_video (keeps the original framing and motion, rewrites content from your prompt).",
			videoRealPerson: "The reference video shows a real person",
			videoEditPending: "Last frame / reference video ride along in the request (media field) — they take effect once the host forwards them on media/generate.",
			resourceLibraries: "Libraries",
			resourceTabOther: "Other",
			resourceFilterPlaceholder: "Filter by name",
			clipSplit: "Split at playhead",
			clipSplitOutsideHint: "The playhead is outside this clip",
			templateQuickGroup: "Quick start",
			templateFullGroup: "Full pipeline",
			templateQuickImageHint: "One line → a first-frame image (2 nodes)",
			templateQuickVideoHint: "One line → first frame → a 5s video (3 nodes)",
			templateStoryboardHint: "Brief → script → storyboard → first frame (4 nodes)",
			templateCoverHint: "One line → a vertical cover image (2 nodes)",
			assetSelect: "Select asset",
			assetSelectedCount: "{n} selected",
			bulkRemove: "Delete selected",
			bulkReference: "Reference selected",
			bulkClear: "Clear selection",
			bulkRemoveDone: "Deleted {n} assets",
			bulkRemoveSkipped: "{n} skipped",
			bulkForceRemove: "Force delete selected",
			bulkReferenceDone: "Referenced {n} into the generate form",
			bulkReferenceNone: "No image assets in the selection",
			resourceRefsManage: "Manage references",
			resourceRefsEditorTitle: "References of {name}",
			resourceRefsAdd: "Attach selected asset",
			resourceRefsRemove: "Remove reference",
			resourceRefsClear: "Clear references",
			resourceRefsFull: "At most 6 references per resource",
			resourceRefsCount: "{n} references",
			resourceRefsDuplicate: "Already attached to this resource",
			resourceAttachSelected: "Attach the selected asset to this resource",
			resourceRefsNone: "No reference image yet",
			fusionTitle: "Fusion generation",
			fusionHint: "Pick roles, scenes and props, then compose them into one shot with a single prompt. Needs the host endpoint media/compose (A-4).",
			fusionPromptPlaceholder: "Describe how the selected roles, scenes and props come together…",
			fusionRoles: "Roles",
			fusionScenes: "Scenes",
			fusionProps: "Props",
			fusionNoResources: "Nothing to pick yet — add resources first.",
			fusionPreview: "{n} reference images will be used",
			fusionPreviewNone: "No reference images — falls back to plain text-to-image",
			fusionRun: "Compose & generate",
			fusionRunning: "Composing…",
			fusionDone: "Composed and filed as an asset",
			fusionFailed: "Fusion failed",
			fusionNeedsPrompt: "Write a prompt first",
			fusionClear: "Clear selection",
			promptTitle: "Prompt studio",
			promptHint: "Extract a structured prompt from a selected image, edit it, then save it to the prompt library. Needs the host endpoint prompts/extract (A-5).",
			promptExtract: "Extract prompt",
			promptExtracting: "Extracting…",
			promptExtractNeedsAsset: "Select an image asset first",
			promptExtractDone: "Prompt extracted — edit it below",
			promptExtractFailed: "Extraction failed",
			promptExtractEmpty: "The extractor returned nothing — try another image",
			promptDraftLabel: "Extracted prompt (editable)",
			promptNameLabel: "Prompt name",
			promptNamePlaceholder: "e.g. soft cinematic portrait",
			promptUntitled: "Untitled prompt",
			promptSave: "Save to library",
			promptSaveDone: "Saved to the prompt library",
			promptSaveFailed: "Could not save",
			promptNeedsText: "Nothing to save yet",
			promptLibrary: "Prompt library",
			promptLibraryEmpty: "No saved prompts yet",
			promptApply: "Use in form",
			promptApplyDone: "Loaded into the prompt box",
			promptRemove: "Delete prompt",
			promptSavedCount: "{n} prompts",
			composeNeedsPrompt: "Describe your scene before fusing.",
			composeEmptyHint: "No resources of this kind yet — create one under Resources.",
			composeSelected: "Selected",
			composeSelectHint: "Pick a few resources from the columns above to fuse.",
			composePromptPlaceholder: "Describe the final look: style, mood, details…",
			composeDone: "Fused into",
			composeAssetCreated: "new asset",
			composeBusy: "Fusing…",
			composeRun: "Fuse and generate",
			healthSize: "Size report",
			healthDupes: "Duplicates",
			healthStats: "Per-project",
			healthRun: "Run report",
			healthRunning: "Scanning…",
			healthEmptyHint: "Run the report to see asset health.",
			healthSizeSummary: "Total",
			healthMedian: "median",
			healthUnused: "unused",
			healthNoDupes: "No duplicates found.",
			healthReclaimable: "Reclaimable",
			healthSuggestedKeep: "suggested keep",
			healthNoProjects: "No projects yet.",
			healthAssets: "assets",
			healthReferenced: "referenced",
			healthTimelines: "timelines",
			regenerate: "Regenerate",
			regenerateHint: "Run this prompt again with the same model.",
			regenerateNoPrompt: "This task has no prompt to regenerate from.",
			useAsReference: "Use as reference",
			useAsRefHint: "Put this output into the quick-generate reference slots.",
			addToTimeline: "Add to timeline",
			addToTimelineHint: "Append this clip to the current project timeline.",
			addToTimelineDone: "Appended to the timeline.",
			noTimelinesHint: "No timeline in this project yet.",
			segPreviewTitle: "Segment preview",
			segPreviewEmpty: "No video clips on the timeline yet.",
			segPlay: "Play",
			segPause: "Pause",
			segReplay: "Replay",
			segTotal: "total",
			segJump: "Jump to segment"
		};
		/** Simplified Chinese copy. */
		const zh = {
			tabTitle: "dsh-image-video 工作台",
			guideDescription: "图片与视频创作的项目、媒体素材与生成任务。",
			sectionProject: "项目",
			projectNone: "还没有项目",
			saveSaved: "已保存",
			saveSaving: "保存中…",
			saveDirty: "有未保存改动",
			saveFailed: "保存失败",
			modeQuick: "快速创作",
			templateQuickImage: "快速出图",
			templateQuickVideo: "快速出片",
			templateStoryboard: "图文分镜",
			templateCover: "封面图",
			templateProductionLine: "生产线",
			resourceReference: "参考图（定妆照）",
			resourceUseSelected: "用选中素材",
			resourceClear: "清除",
			attachAll: "登记全部未登记",
			skippedCount: "跳过",
			attachAllDone: "已登记",
			importFiles: "导入文件…",
			importDone: "已导入",
			importUnsupported: "这里拿不到文件路径——批量导入需在桌面应用里使用。",
			generateReferenceLabel: "参考图",
			generateReferenceNone: "未指定（纯文生图 / 文生视频）",
			generateUseSelected: "用选中素材",
			generateClearReference: "清除参考",
			referenceAsset: "引用到提示词",
			generateHeading: "直接生成",
			generatePromptLabel: "提示词",
			generatePromptPlaceholder: "描述你想要的画面…",
			generateShortcutHint: "⌘/Ctrl + Enter 生成",
			generateImage: "生成图片",
			generateVideo: "生成视频",
			generating: "生成中…",
			generateCancel: "取消生成",
			generateDone: "已生成，并登记为项目素材",
			generateFailed: "生成失败",
			generateNeedsProject: "先在顶部选一个项目，生成结果才好归档。",
			generateCostHint: "按当前生效参数真实调用服务商（会产生费用）。",
			modeWorkflow: "专业工作流",
			modeTimeline: "时间轴精剪",
			paneAssets: "媒体素材",
			paneResources: "创作资源",
			panePreview: "预览",
			paneTasks: "任务",
			paneHealth: "素材库体检",
			emptyHint: "项目、素材、资源与任务账本已可用；「专业工作流」模式里是可直接运行的节点画布。",
			healthChecking: "正在连接宿主…",
			healthFailed: "宿主未就绪",
			panePlanned: "暂不可运行——排在后续阶段",
			newProject: "新建项目",
			projectNamePlaceholder: "项目名称",
			create: "创建",
			remove: "删除",
			confirmRemove: "确认删除",
			refresh: "刷新",
			noOutputs: "outputs 目录里还没有产物",
			registerLatest: "登记最新产物",
			noAssets: "这个项目还没有素材",
			previewEmpty: "选中素材后可在此预览",
			busy: "处理中…",
			failed: "操作失败",
			noTasks: "还没有任务记录",
			registerAsAsset: "登记为素材",
			statusQueued: "排队中",
			statusRunning: "运行中",
			statusSucceeded: "成功",
			statusFailed: "失败",
			statusCancelled: "已取消",
			cancelTask: "取消任务",
			defaultsEditHint: "选「未设置」= 跟随设置",
			defaultsGroupMode: "媒体类型",
			defaultsGroupImage: "图像",
			defaultsGroupVideo: "视频",
			optModeText: "文本",
			optModeImage: "图片",
			optModeVideo: "视频",
			optStylePhoto: "摄影",
			optStyleIllustration: "插画",
			optStyle3d: "3D 渲染",
			optStyleAnime: "动漫",
			optStyleInk: "水墨",
			defaultsSaved: "默认值已保存",
			defaultsCancel: "取消",
			defaultsSave: "保存默认值",
			defaultsEdit: "编辑",
			resourceUseUnit: "次产物",
			resourceUsedBy: "被用到",
			resourceUnused: "还没被任何产物用过",
			statusImportedIdle: "已导入（未运行）",
			resourceMotionTrack: "轨迹",
			paramTrack: "轨迹资源",
			forceRemove: "仍要删除",
			hostHintRemote: "预览需要本机访问宿主：/outputs 只在回环地址注册。请改用 http://127.0.0.1:… 打开本应用。",
			none: "未设置",
			defaultMediaMode: "输入模式",
			defaultVideoDuration: "视频时长",
			defaultVideoAspectRatio: "视频比例",
			defaultVideoProvider: "视频服务商",
			defaultImageStyle: "图片风格",
			defaultImageSize: "图片尺寸",
			defaultImageProvider: "图片服务商",
			defaultsTitle: "当前生效参数",
			exportResult: "产物",
			exportFailed: "导出失败",
			exportDone: "导出完成",
			exportRunning: "导出中",
			exportCancel: "取消导出",
			exportStart: "导出成片",
			ffmpegRecheck: "重新检查 ffmpeg",
			ffmpegOk: "ffmpeg",
			stylePosition: "位置",
			styleColor: "颜色",
			styleFontSize: "字号",
			playhead: "播放头",
			previewNote: "顺序预览：按播放头取当前片段，不做转码；导出（T5-5）可能有一两帧差异。",
			previewIdle: "这个时间点没有画面",
			burnSubtitles: "导出时烧录字幕",
			pickAsset: "选择素材",
			timelineTitle: "时间轴",
			subtitlePlaceholder: "字幕文本",
			timelineTotal: "总时长",
			clipDuration: "时长(ms)",
			clipStart: "起点(ms)",
			timelineEmpty: "还没有片段——从右侧素材里加入",
			addSubtitle: "加入字幕",
			addClip: "加入轨道",
			trackSubtitle: "字幕轨",
			trackAudio: "音频轨",
			trackVideo: "视频轨",
			templateReferenceRemake: "参考视频复刻（含对比片）",
			templateImageToVideo: "图片→视频→字幕→渲染",
			templateCopyToVideo: "文案→分镜→图→视频",
			templateApply: "套用模板",
			templateTitle: "模板",
			runArtifacts: "个产物",
			statusSkipped: "已跳过",
			runNone: "还没有运行记录",
			runTitle: "运行",
			runRetry: "重试失败节点",
			runCancel: "取消运行",
			runStart: "运行流程",
			issuePlanned: "预留节点不可运行",
			issueCycle: "图里有环",
			issueDangling: "连线指向不存在的节点",
			issueSelfLoop: "节点连到自己",
			issuePort: "端口类型不匹配",
			issueRequired: "必填参数为空",
			validationOk: "图可运行",
			validationTitle: "图校验",
			compacted: "已整理重复记录",
			compactAssets: "整理重复记录",
			paneCanvas: "工作流画布",
			canvasEdgesCount: "条连线",
			canvasNodesCount: "个节点",
			canvasNoParams: "这个节点暂时没有参数",
			canvasSelfLoop: "节点不能连到自己",
			nodeCreativeInput: "创作输入",
			nodeScript: "脚本",
			nodeStoryboard: "分镜",
			nodeAssetReference: "素材引用",
			nodeResourceReference: "资源引用",
			nodeMotionTrack: "运动轨迹",
			nodeImageGenerate: "图片生成",
			nodeVideoGenerate: "视频生成",
			nodePreview: "预览",
			nodePublishAsset: "发布素材",
			nodeSubtitle: "字幕",
			nodeRender: "渲染",
			nodeLipSync: "口型同步",
			nodeFaceSwap: "换脸",
			nodeVoiceSynthesize: "语音合成",
			plannedLipSync: "宿主尚未提供口型/唇形能力",
			plannedFaceSwap: "宿主尚未提供换脸能力",
			plannedVoice: "D6 本期只做音色元数据，未接 TTS",
			canvasPalette: "节点库",
			canvasAdd: "加入画布",
			canvasParams: "节点参数",
			canvasFit: "适配窗口",
			canvasEmpty: "从左侧节点库添加节点",
			canvasPlannedTag: "未提供",
			canvasTransient: "工作流暂存在本机（项目存储随宿主端点接入）",
			paramBrief: "创作诉求",
			paramScript: "文案",
			paramShots: "分镜数",
			paramNote: "备注",
			paramAsset: "素材",
			paramResource: "资源",
			paramModel: "模型（留空用宿主默认）",
			paramPrompt: "提示词",
			paramRatio: "比例",
			paramDuration: "时长（秒）",
			paramResolution: "分辨率",
			paramReferenceVideo: "参考视频",
			paramCompare: "同时生成对比片",
			paramAssetName: "素材名",
			ratioSquare: "1:1",
			ratioPortrait: "3:4",
			ratioLandscape: "16:9",
			ratioVertical: "9:16",
			resolutionDefault: "模型默认",
			resolution480: "480P",
			resolution768: "768P",
			resolution2k: "2K",
			rename: "改名",
			save: "保存",
			cancel: "取消",
			resourceNamePlaceholder: "名称",
			notePlaceholder: "备注（可选）",
			noResources: "这个项目还没有创作资源",
			addResource: "新建资源",
			alreadyRegistered: "该产物已登记过",
			previewOutput: "预览产出",
			filterAll: "全部素材",
			filterImage: "只看图片",
			filterVideo: "只看视频",
			kindRole: "角色",
			kindScene: "场景",
			kindProp: "道具",
			kindBrand: "品牌",
			kindStyle: "风格",
			kindVoice: "音色",
			brandTagline: "媒体创作工作台",
			modeQuickHint: "在中间对话区直接出图或出片；产物落在本机输出目录后，可在「媒体素材」面板一键登记进当前项目。",
			statOutputs: "输出产物",
			statAssets: "媒体素材",
			statTasks: "生成任务",
			statResources: "创作资源",
			heroStepChat: "对话区生成",
			heroStepOutputs: "落入输出目录",
			heroStepFile: "登记进项目",
			railAssets: "媒体素材",
			railTasks: "生成任务",
			railHealth: "素材库体检",
			railDefaults: "生效默认值",
			statusReady: "就绪",
			monitorProgram: "节目监视器",
			transportPlay: "播放",
			timelineZoom: "缩放",
			trackVideoId: "V1",
			trackAudioId: "A1",
			trackSubtitleId: "S1",
			paneError: "该面板出错",
			paneErrorRetry: "重试",
			canvasUndo: "撤销",
			canvasRedo: "重做",
			canvasCopy: "复制节点",
			canvasPaste: "粘贴节点",
			canvasPasteEmpty: "剪贴板是空的——先选中节点再复制",
			canvasDeleteSelected: "删除选中节点",
			canvasRunNode: "运行此节点（含下游）",
			canvasSelected: "已选中",
			nodeErrorDetails: "错误详情",
			clipDuplicate: "复制片段",
			transportPause: "暂停",
			clipResizeStart: "拖动改变片段起点",
			clipResizeEnd: "拖动改变片段时长",
			fps: "帧率",
			clipSpeed: "变速",
			clipFade: "淡入淡出(ms)",
			clipTransition: "转场",
			clipTransitionDuration: "转场时长(ms)",
			clipCrop: "裁剪",
			clipCropX: "裁剪X",
			clipCropY: "裁剪Y",
			clipCropW: "裁剪宽",
			clipCropH: "裁剪高",
			clipCropRemove: "移除裁剪",
			trackFade: "淡入淡出",
			normalizeLoudness: "响度归一化",
			transitionFade: "淡入",
			transitionWipeleft: "左擦除",
			transitionCircleopen: "圆形展开",
			subtitlesBatch: "批量字幕",
			subtitlesBatchPlaceholder: "粘贴一段台词——自动按句切分成字幕",
			subtitlesApply: "铺字幕",
			templateMarket: "模板市场",
			templateMarketEmpty: "选一个模板来搭好工作流骨架",
			templateDramaSeries: "漫剧/连续剧（单集）",
			paneDiagnostics: "诊断",
			diagOutputs: "输出占用",
			diagRenders: "渲染",
			diagRenderP50: "p50",
			diagRenderP90: "p90",
			diagRenderFinished: "完成",
			diagRenderFailed: "失败",
			diagErrors: "最近错误",
			diagErrorsNone: "暂无错误记录",
			diagRefresh: "刷新",
			generateRefsLabel: "参考图（按序）",
			generateRefsHint: "首图=底图，其余为风格/脸部参考；最多 6 张，可拖拽 chip 或用箭头排序。",
			generateRefsAdd: "加入选中素材",
			generateRefsFull: "最多 6 张参考图",
			generateRefsMoveUp: "前移",
			generateRefsMoveDown: "后移",
			generateRefsBase: "底图",
			generateRefsStyle: "参考",
			generateElapsed: "生成中 · {sec}s",
			generateProgress: "生成进度",
			videoLastFrame: "尾帧图",
			videoReferenceVideo: "参考视频",
			videoEditHint: "仅视频生成生效：尾帧图按 media[].type=last_frame 提交；参考视频按 reference_video 提交（保留原片构图与动作，按提示词改写内容）。",
			videoRealPerson: "参考视频含真人出镜",
			videoEditPending: "尾帧/参考视频已随请求透传（media 字段），待宿主 media/generate 转发后生效。",
			resourceLibraries: "物料分栏",
			resourceTabOther: "其他",
			resourceFilterPlaceholder: "按名称筛选",
			clipSplit: "在播放头分割",
			clipSplitOutsideHint: "播放头不在这个片段内",
			templateQuickGroup: "快速上手",
			templateFullGroup: "完整链路",
			templateQuickImageHint: "一句话 → 首帧图（2 节点）",
			templateQuickVideoHint: "一句话 → 首帧图 → 5 秒视频（3 节点）",
			templateStoryboardHint: "创意 → 文案 → 分镜 → 首帧图（4 节点）",
			templateCoverHint: "一句话 → 竖版封面图（2 节点）",
			assetSelect: "选择素材",
			assetSelectedCount: "已选 {n}",
			bulkRemove: "批量删除",
			bulkReference: "批量引用",
			bulkClear: "清除选择",
			bulkRemoveDone: "已删除 {n} 个素材",
			bulkRemoveSkipped: "{n} 个跳过",
			bulkForceRemove: "仍要删除选中",
			bulkReferenceDone: "已引用 {n} 张到生成表单",
			bulkReferenceNone: "选中的没有图片素材",
			resourceRefsManage: "管理参考图",
			resourceRefsEditorTitle: "「{name}」的参考图",
			resourceRefsAdd: "挂选中素材",
			resourceRefsRemove: "移除参考图",
			resourceRefsClear: "清空参考图",
			resourceRefsFull: "一个资源最多 6 张参考图",
			resourceRefsCount: "{n} 张参考图",
			resourceRefsDuplicate: "该素材已挂在这个资源上",
			resourceAttachSelected: "把选中素材挂到这个资源",
			resourceRefsNone: "还没有参考图",
			fusionTitle: "融合生图",
			fusionHint: "选角色、场景和物品，用一段提示词拼装成一张画面。依赖宿主端点 media/compose（A-4）。",
			fusionPromptPlaceholder: "描述选中的角色、场景、物品如何组合…",
			fusionRoles: "角色",
			fusionScenes: "场景",
			fusionProps: "物品",
			fusionNoResources: "还没有可选的资源，先去创建。",
			fusionPreview: "将使用 {n} 张参考图",
			fusionPreviewNone: "没有参考图，将降级为纯文生",
			fusionRun: "融合生成",
			fusionRunning: "融合生成中…",
			fusionDone: "已融合生成并登记素材",
			fusionFailed: "融合生成失败",
			fusionNeedsPrompt: "先写一段提示词",
			fusionClear: "清空选择",
			promptTitle: "提示词工坊",
			promptHint: "从选中的图片提取结构化提示词，可编辑后存入提示词库。依赖宿主端点 prompts/extract（A-5）。",
			promptExtract: "提取提示词",
			promptExtracting: "提取中…",
			promptExtractNeedsAsset: "先选一张图片素材",
			promptExtractDone: "已提取，可在下方编辑",
			promptExtractFailed: "提取失败",
			promptExtractEmpty: "提取结果为空，换一张图试试",
			promptDraftLabel: "提取结果（可编辑）",
			promptNameLabel: "提示词名称",
			promptNamePlaceholder: "例如：柔和电影感人像",
			promptUntitled: "未命名提示词",
			promptSave: "存入提示词库",
			promptSaveDone: "已存入提示词库",
			promptSaveFailed: "存入失败",
			promptNeedsText: "还没有可保存的内容",
			promptLibrary: "提示词库",
			promptLibraryEmpty: "提示词库还是空的",
			promptApply: "带入生成表单",
			promptApplyDone: "已带入提示词框",
			promptRemove: "删除提示词",
			promptSavedCount: "{n} 条提示词",
			composeNeedsPrompt: "融合生图前先写一段描述。",
			composeEmptyHint: "这类资源还没有——去「资源库」新建吧。",
			composeSelected: "已选",
			composeSelectHint: "从上方列里挑几个要融合的资源。",
			composePromptPlaceholder: "描述最终画面：风格、氛围、细节…",
			composeDone: "已融合成",
			composeAssetCreated: "新素材",
			composeBusy: "融合中…",
			composeRun: "融合并生成",
			healthSize: "体积排行",
			healthDupes: "重复素材",
			healthStats: "项目统计",
			healthRun: "跑体检",
			healthRunning: "扫描中…",
			healthEmptyHint: "点按钮查看素材库体检报告。",
			healthSizeSummary: "总计",
			healthMedian: "中位数",
			healthUnused: "未使用",
			healthNoDupes: "没有重复素材。",
			healthReclaimable: "可回收",
			healthSuggestedKeep: "建议保留",
			healthNoProjects: "还没有项目。",
			healthAssets: "素材",
			healthReferenced: "被引用",
			healthTimelines: "时间轴",
			regenerate: "重新生成",
			regenerateHint: "用相同模型再跑一次这条提示词。",
			regenerateNoPrompt: "这条任务没有可复用的提示词。",
			useAsReference: "用作参考图",
			useAsRefHint: "把这条产物放进快速生成的参考图槽位。",
			addToTimeline: "加入时间轴",
			addToTimelineHint: "把这段视频追加到当前项目的时间轴。",
			addToTimelineDone: "已追加到时间轴。",
			noTimelinesHint: "当前项目还没有时间轴。",
			segPreviewTitle: "逐段预览",
			segPreviewEmpty: "时间轴上还没有视频片段。",
			segPlay: "播放",
			segPause: "暂停",
			segReplay: "重播",
			segTotal: "总长",
			segJump: "跳到第"
		};
		//#endregion
		//#region src/client/plugin.ts
		/** Implementation identity: unique in the tab registry, and the key both seats register under. */
		const WORKBENCH_TAB_ID = "dsh-image-video";
		/** Tab type discriminator. Its own kind, so no built-in kind is shadowed. */
		const WORKBENCH_TAB_KIND = "dsh-image-video-workbench";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"sidebarRightTabs",
			"connection"
		];
		/**
		* Register the workbench dictionaries, the tab type, and its body seat.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "image-video-workbench: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: WORKBENCH_TAB_ID,
				kind: WORKBENCH_TAB_KIND,
				title: () => t("tabTitle"),
				guide: [{
					id: "open-workbench",
					order: 60,
					title: () => t("tabTitle"),
					description: () => t("guideDescription")
				}]
			}), "image-video-workbench: tab type");
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: WORKBENCH_TAB_ID,
				locale: NS,
				inject: () => ({
					kind: WORKBENCH_TAB_KIND,
					api: createWorkbenchApi(requireConnection(ctx))
				})
			}, Workbench));
		}
		/**
		* Read the client connection service.
		*
		* `inject` already waits for it, so a miss here means the deployment wired the
		* browser half without its RPC counterpart — worth a named error rather than a
		* TypeError on the first click.
		* @param ctx - client root context.
		* @returns the connection handle.
		*/
		function requireConnection(ctx) {
			const connection = ctx.get("connection");
			if (connection === void 0) throw new Error("image-video-workbench: connection service is unavailable");
			return connection;
		}
		//#endregion
		exports.WORKBENCH_TAB_ID = WORKBENCH_TAB_ID;
		exports.WORKBENCH_TAB_KIND = WORKBENCH_TAB_KIND;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=plugin.js.map