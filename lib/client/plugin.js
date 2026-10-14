window.__ModuleLoader__.load({
	id: "dsh-image-video",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/Workbench.tsx
		/**
		* Workbench skeleton, browser half: the surface shape the later phases fill in —
		* header (project name, save state, mode switch, host health), the current mode's
		* working area, and the four panes (media assets / resources / preview / tasks).
		*
		* It reads the seat's own tab information (`useTabInfo`) so the right-pane
		* integration is observable on its own, and asks the host half for its health
		* over the workbench RPC channel on mount — that answer is the end-to-end proof
		* that the browser half, the channel and the host half agree.
		*
		* Colours stay theme-neutral (`currentColor` + `color-mix`) until the theme pass
		* (`R-NFR-3`) switches every surface to the Harness CSS variables.
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
		/** Panes in grid order: the two entry points first, then the working surfaces. */
		const PANES = [
			{
				label: "paneAssets",
				planned: true
			},
			{
				label: "paneResources",
				planned: true
			},
			{
				label: "panePreview",
				planned: false
			},
			{
				label: "paneTasks",
				planned: false
			}
		];
		const SURFACE = {
			display: "flex",
			flexDirection: "column",
			gap: "12px",
			padding: "12px",
			font: "inherit",
			color: "inherit",
			height: "100%",
			boxSizing: "border-box",
			overflow: "auto"
		};
		/** One theme-neutral hairline; the theme pass replaces it with a Harness token. */
		const HAIRLINE = "1px solid color-mix(in srgb, currentColor 18%, transparent)";
		/** One pill in the header row. */
		const PILL = {
			border: HAIRLINE,
			borderRadius: "999px",
			padding: "0 8px",
			fontSize: "12px",
			opacity: .8
		};
		/**
		* Render the workbench skeleton.
		* @param props - seat runtime hooks, the injected face, and localized copy.
		* @returns the skeleton surface.
		*/
		function Workbench(props) {
			const { kind, t, useTabInfo, health } = props;
			const [mode, setMode] = (0, react.useState)("quick");
			const [healthState, setHealthState] = (0, react.useState)({ status: "checking" });
			const { sidebar, tab } = useTabInfo();
			const healthRef = (0, react.useRef)(health);
			healthRef.current = health;
			(0, react.useEffect)(() => {
				let alive = true;
				healthRef.current().then((value) => {
					if (alive) setHealthState({
						status: "ok",
						health: value
					});
				}, (error) => {
					if (alive) setHealthState({
						status: "failed",
						message: error instanceof Error ? error.message : String(error)
					});
				});
				return () => {
					alive = false;
				};
			}, []);
			const healthText = healthState.status === "checking" ? t("healthChecking") : healthState.status === "ok" ? `${healthState.health.version} · ${healthState.health.provider}` : t("healthFailed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: SURFACE,
				"data-workbench-kind": kind,
				"data-workbench-visible": tab.visible ? "true" : "false",
				"data-workbench-fullscreen": sidebar.fullscreen ? "true" : "false",
				"data-workbench-health": healthState.status,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: "8px",
							flexWrap: "wrap"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								style: { fontSize: "13px" },
								children: t("sectionProject")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: "13px",
									opacity: .7
								},
								children: t("projectNone")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: PILL,
								children: t("saveSaved")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: PILL,
								title: healthState.status === "failed" ? healthState.message : void 0,
								children: healthText
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									marginLeft: "auto",
									fontSize: "12px",
									opacity: .55
								},
								children: kind
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
						style: {
							display: "flex",
							gap: "6px"
						},
						"aria-label": t("tabTitle"),
						children: MODES.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": candidate === mode,
							onClick: () => {
								setMode(candidate);
							},
							style: {
								border: HAIRLINE,
								borderRadius: "6px",
								padding: "4px 10px",
								color: "inherit",
								cursor: "pointer",
								background: candidate === mode ? "color-mix(in srgb, currentColor 10%, transparent)" : "transparent"
							},
							children: t(MODE_KEYS[candidate])
						}, candidate))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						"aria-label": t(MODE_KEYS[mode]),
						style: {
							border: HAIRLINE,
							borderRadius: "8px",
							padding: "10px",
							minHeight: "72px"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								margin: 0,
								fontSize: "12px",
								opacity: .7
							},
							children: t("emptyHint")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: "8px"
						},
						children: PANES.map((pane) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							"data-workbench-pane": pane.label,
							"data-workbench-planned": pane.planned ? "true" : "false",
							style: {
								border: HAIRLINE,
								borderRadius: "8px",
								padding: "10px",
								minHeight: "88px"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: {
									margin: "0 0 6px",
									fontSize: "13px",
									fontWeight: 600
								},
								children: t(pane.label)
							}), pane.planned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									margin: 0,
									fontSize: "12px",
									opacity: .6
								},
								children: t("panePlanned")
							}) : null]
						}, pane.label))
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
			modeWorkflow: "Workflow",
			modeTimeline: "Timeline",
			paneAssets: "Media assets",
			paneResources: "Resources",
			panePreview: "Preview",
			paneTasks: "Tasks",
			emptyHint: "Skeleton only — projects, assets, tasks and the node canvas arrive in later phases.",
			healthChecking: "Connecting to host…",
			healthFailed: "Host unavailable",
			panePlanned: "Not runnable yet — planned for a later phase"
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
			modeWorkflow: "专业工作流",
			modeTimeline: "时间轴精剪",
			paneAssets: "媒体素材",
			paneResources: "创作资源",
			panePreview: "预览",
			paneTasks: "任务",
			emptyHint: "目前只是骨架——项目、素材、任务与节点画布在后续阶段落地。",
			healthChecking: "正在连接宿主…",
			healthFailed: "宿主未就绪",
			panePlanned: "暂不可运行——排在后续阶段"
		};
		//#endregion
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
					health: () => workbenchHealth(ctx)
				})
			}, Workbench));
		}
		/**
		* Ask the host for the workbench health facts over the shared channel.
		* @param ctx - client context carrying the `connection` service.
		* @returns the host's answer, unwrapped; throws the reported message on refusal.
		*/
		async function workbenchHealth(ctx) {
			const connection = ctx.get("connection");
			if (connection === void 0) throw new Error("image-video-workbench: connection service is unavailable");
			const result = await connection.rpc.call(WORKBENCH_RPC_CHANNEL, "health", {});
			if (!result.ok) throw new Error(result.error?.message ?? "workbench health check failed");
			return result.value;
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