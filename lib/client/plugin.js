window.__ModuleLoader__.load({
	id: "dsh-image-video",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
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
				attachAsset: async (input) => (await call("assets/attach", input)).asset,
				removeAsset: async (id) => (await call("assets/remove", { id })).removed,
				listOutputs: async (limit) => (await call("outputs/list", { limit })).outputs
			};
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
		const PILL = {
			border: HAIRLINE,
			borderRadius: "999px",
			padding: "0 8px",
			fontSize: "12px",
			opacity: .8
		};
		const BUTTON = {
			border: HAIRLINE,
			borderRadius: "6px",
			padding: "3px 9px",
			color: "inherit",
			background: "transparent",
			cursor: "pointer",
			fontSize: "12px"
		};
		const INPUT = {
			border: HAIRLINE,
			borderRadius: "6px",
			padding: "3px 8px",
			color: "inherit",
			background: "transparent",
			fontSize: "12px",
			minWidth: "110px"
		};
		const PANE = {
			border: HAIRLINE,
			borderRadius: "8px",
			padding: "10px",
			minHeight: "88px"
		};
		const PANE_TITLE = {
			margin: "0 0 6px",
			fontSize: "13px",
			fontWeight: 600
		};
		const MUTED = {
			margin: 0,
			fontSize: "12px",
			opacity: .65
		};
		/** Human-readable size for one asset row. */
		function formatBytes(bytes) {
			if (bytes <= 0) return "—";
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
			return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
		}
		/** File name of an absolute path. */
		function baseName(path) {
			return path.split("/").pop() ?? path;
		}
		/**
		* Render the workbench.
		* @param props - seat runtime hooks, the injected API, and localized copy.
		* @returns the workbench surface.
		*/
		function Workbench(props) {
			const { api, kind, t, useTabInfo } = props;
			const { sidebar, tab } = useTabInfo();
			const apiRef = (0, react.useRef)(api);
			apiRef.current = api;
			const [mode, setMode] = (0, react.useState)("quick");
			const [health, setHealth] = (0, react.useState)({ status: "checking" });
			const [projects, setProjects] = (0, react.useState)([]);
			const [activeId, setActiveId] = (0, react.useState)(void 0);
			const [assets, setAssets] = (0, react.useState)([]);
			const [outputs, setOutputs] = (0, react.useState)([]);
			const [selectedId, setSelectedId] = (0, react.useState)(void 0);
			const [name, setName] = (0, react.useState)("");
			const [confirming, setConfirming] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const activeProject = projects.find((project) => project.id === activeId);
			const selectedAsset = assets.find((asset) => asset.id === selectedId);
			/** Run one host action, surfacing failure as a notice instead of a crash. */
			const run = (0, react.useCallback)(async (action) => {
				setBusy(true);
				setNotice(void 0);
				try {
					await action();
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
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
			(0, react.useEffect)(() => {
				(async () => {
					try {
						const facts = await apiRef.current.health();
						setHealth({
							status: "ok",
							version: facts.version,
							provider: facts.provider
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
					});
				})();
			}, [
				loadOutputs,
				loadProjects,
				run
			]);
			(0, react.useEffect)(() => {
				(async () => {
					setSelectedId(void 0);
					if (activeId === void 0) {
						setAssets([]);
						return;
					}
					try {
						setAssets(await apiRef.current.listAssets(activeId));
					} catch (error) {
						setNotice(error instanceof Error ? error.message : String(error));
					}
				})();
			}, [activeId]);
			const healthText = health.status === "checking" ? t("healthChecking") : health.status === "ok" ? `${health.version} · ${health.provider}` : t("healthFailed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: SURFACE,
				"data-workbench-kind": kind,
				"data-workbench-visible": tab.visible ? "true" : "false",
				"data-workbench-fullscreen": sidebar.fullscreen ? "true" : "false",
				"data-workbench-health": health.status,
				"data-workbench-projects": String(projects.length),
				"data-workbench-assets": String(assets.length),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: "6px",
							flexWrap: "wrap"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								style: { fontSize: "13px" },
								children: t("sectionProject")
							}),
							projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: "13px",
									opacity: .7
								},
								children: t("projectNone")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								"aria-label": t("sectionProject"),
								value: activeId ?? "",
								onChange: (event) => {
									setActiveId(event.target.value);
								},
								style: INPUT,
								children: projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: project.id,
									children: project.name
								}, project.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": t("newProject"),
								placeholder: t("projectNamePlaceholder"),
								value: name,
								onChange: (event) => {
									setName(event.target.value);
								},
								style: INPUT
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: BUTTON,
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
							}),
							activeProject === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: BUTTON,
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
								children: confirming === activeProject.id ? t("confirmRemove") : t("remove")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: PILL,
								title: health.status === "failed" ? health.message : void 0,
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
						style: {
							display: "flex",
							gap: "6px"
						},
						"aria-label": t("tabTitle"),
						children: [MODES.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": candidate === mode,
							onClick: () => {
								setMode(candidate);
							},
							style: {
								...BUTTON,
								background: candidate === mode ? "color-mix(in srgb, currentColor 10%, transparent)" : "transparent"
							},
							children: t(MODE_KEYS[candidate])
						}, candidate)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: {
								...BUTTON,
								marginLeft: "auto"
							},
							disabled: busy,
							onClick: () => {
								run(async () => {
									await loadProjects();
									await loadOutputs();
								});
							},
							children: t("refresh")
						})]
					}),
					notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: {
							...MUTED,
							opacity: .9
						},
						role: "status",
						children: [
							t("failed"),
							": ",
							notice
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						"aria-label": t(MODE_KEYS[mode]),
						style: PANE,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: MUTED,
							children: [
								busy ? t("busy") : t("emptyHint"),
								" · ",
								outputs.length === 0 ? t("noOutputs") : `${outputs.length} output(s)`
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: "8px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								"data-workbench-pane": "paneAssets",
								"data-workbench-planned": "false",
								style: PANE,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: PANE_TITLE,
										children: t("paneAssets")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											...BUTTON,
											marginBottom: "6px"
										},
										disabled: busy || activeProject === void 0 || outputs.length === 0,
										onClick: () => {
											run(async () => {
												const project = activeProject;
												if (project === void 0) return;
												const known = new Set(assets.map((asset) => asset.path));
												const candidate = outputs.find((output) => !known.has(output.path));
												if (candidate === void 0) {
													setNotice(t("noOutputs"));
													return;
												}
												await apiRef.current.attachAsset({
													projectId: project.id,
													path: candidate.path,
													kind: candidate.kind,
													bytes: candidate.bytes
												});
												setAssets(await apiRef.current.listAssets(project.id));
											});
										},
										children: t("registerLatest")
									}),
									assets.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: MUTED,
										children: t("noAssets")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
										style: {
											margin: 0,
											padding: 0,
											listStyle: "none",
											display: "grid",
											gap: "4px"
										},
										children: assets.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: "6px",
												fontSize: "12px"
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												"aria-pressed": asset.id === selectedId,
												"aria-label": `${t("panePreview")} ${baseName(asset.path)}`,
												onClick: () => {
													setSelectedId(asset.id);
												},
												style: {
													...BUTTON,
													flex: 1,
													textAlign: "left",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap"
												},
												children: [
													asset.kind === "video" ? "🎬" : "🖼️",
													" ",
													baseName(asset.path),
													" · ",
													formatBytes(asset.bytes)
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": `${confirming === asset.id ? t("confirmRemove") : t("remove")} ${baseName(asset.path)}`,
												style: BUTTON,
												disabled: busy,
												onClick: () => {
													if (confirming !== asset.id) {
														setConfirming(asset.id);
														return;
													}
													setConfirming(void 0);
													run(async () => {
														await apiRef.current.removeAsset(asset.id);
														setAssets(await apiRef.current.listAssets(asset.projectId));
													});
												},
												children: confirming === asset.id ? t("confirmRemove") : t("remove")
											})]
										}, asset.id))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								"data-workbench-pane": "panePreview",
								"data-workbench-planned": "false",
								style: PANE,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: PANE_TITLE,
									children: t("panePreview")
								}), selectedAsset === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: MUTED,
									children: t("previewEmpty")
								}) : selectedAsset.kind === "video" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
									src: `/outputs/${encodeURIComponent(baseName(selectedAsset.path))}`,
									controls: true,
									style: {
										width: "100%",
										borderRadius: "6px"
									}
								}, selectedAsset.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									alt: baseName(selectedAsset.path),
									src: `/outputs/${encodeURIComponent(baseName(selectedAsset.path))}`,
									style: {
										width: "100%",
										borderRadius: "6px"
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								"data-workbench-pane": "paneResources",
								"data-workbench-planned": "true",
								style: PANE,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: PANE_TITLE,
									children: t("paneResources")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: MUTED,
									children: t("panePlanned")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								"data-workbench-pane": "paneTasks",
								"data-workbench-planned": "true",
								style: PANE,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: PANE_TITLE,
									children: t("paneTasks")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: MUTED,
									children: t("panePlanned")
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
			modeWorkflow: "Workflow",
			modeTimeline: "Timeline",
			paneAssets: "Media assets",
			paneResources: "Resources",
			panePreview: "Preview",
			paneTasks: "Tasks",
			emptyHint: "Skeleton only — projects, assets, tasks and the node canvas arrive in later phases.",
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
			failed: "Operation failed"
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
			failed: "操作失败"
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