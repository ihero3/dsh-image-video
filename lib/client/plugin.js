window.__ModuleLoader__.load({
	id: "dsh-image-video",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		require("react-dom");
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
				renderTimeline: async (timelineId, projectId) => (await call("timelines/render", projectId === void 0 ? { timelineId } : {
					timelineId,
					projectId
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
				runWorkflow: async (workflowId) => (await call("workflows/run", { workflowId })).run,
				listRuns: async (projectId, workflowId) => (await call("workflows/runs", {
					projectId,
					workflowId
				})).runs,
				cancelRun: async (runId) => (await call("workflows/run-cancel", { runId })).cancelled,
				retryRun: async (runId) => (await call("workflows/run-retry", { runId })).run,
				cancelTask: async (id) => (await call("tasks/cancel", { id })).cancelled,
				assignTask: async (id, projectId) => (await call("tasks/assign", {
					id,
					projectId
				})).task,
				listOutputs: async (limit) => (await call("outputs/list", { limit })).outputs
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
		//#endregion
		//#region src/workbench/timeline.ts
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
			return tracks.filter((track) => track.kind === kind).flatMap((track) => track.clips).find((clip) => timeMs >= clip.startMs && timeMs < clip.startMs + clip.durationMs);
		}
		/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
		function timelineDurationMs(tracks) {
			return tracks.reduce((longest, track) => track.clips.reduce((trackLongest, clip) => Math.max(trackLongest, clip.startMs + clip.durationMs), longest), 0);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/classcat@5.0.5/node_modules/classcat/index.js
		function cc(names) {
			if (typeof names === "string" || typeof names === "number") return "" + names;
			let out = "";
			if (Array.isArray(names)) {
				for (let i = 0, tmp; i < names.length; i++) if ((tmp = cc(names[i])) !== "") out += (out && " ") + tmp;
			} else for (let k in names) if (names[k]) out += (out && " ") + k;
			return out;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-dispatch@3.0.1/node_modules/d3-dispatch/src/dispatch.js
		var noop = { value: () => {} };
		function dispatch() {
			for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
				if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
				_[t] = [];
			}
			return new Dispatch(_);
		}
		function Dispatch(_) {
			this._ = _;
		}
		function parseTypenames$1(typenames, types) {
			return typenames.trim().split(/^|\s+/).map(function(t) {
				var name = "", i = t.indexOf(".");
				if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
				if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
				return {
					type: t,
					name
				};
			});
		}
		Dispatch.prototype = dispatch.prototype = {
			constructor: Dispatch,
			on: function(typename, callback) {
				var _ = this._, T = parseTypenames$1(typename + "", _), t, i = -1, n = T.length;
				if (arguments.length < 2) {
					while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
					return;
				}
				if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
				while (++i < n) if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
				else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
				return this;
			},
			copy: function() {
				var copy = {}, _ = this._;
				for (var t in _) copy[t] = _[t].slice();
				return new Dispatch(copy);
			},
			call: function(type, that) {
				if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
				if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
				for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
			},
			apply: function(type, that, args) {
				if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
				for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
			}
		};
		function get$1(type, name) {
			for (var i = 0, n = type.length, c; i < n; ++i) if ((c = type[i]).name === name) return c.value;
		}
		function set$1(type, name, callback) {
			for (var i = 0, n = type.length; i < n; ++i) if (type[i].name === name) {
				type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
				break;
			}
			if (callback != null) type.push({
				name,
				value: callback
			});
			return type;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/matcher.js
		function matcher_default(selector) {
			return function() {
				return this.matches(selector);
			};
		}
		function childMatcher(selector) {
			return function(node) {
				return node.matches(selector);
			};
		}
		var namespaces_default = {
			svg: "http://www.w3.org/2000/svg",
			xhtml: "http://www.w3.org/1999/xhtml",
			xlink: "http://www.w3.org/1999/xlink",
			xml: "http://www.w3.org/XML/1998/namespace",
			xmlns: "http://www.w3.org/2000/xmlns/"
		};
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/namespace.js
		function namespace_default(name) {
			var prefix = name += "", i = prefix.indexOf(":");
			if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
			return namespaces_default.hasOwnProperty(prefix) ? {
				space: namespaces_default[prefix],
				local: name
			} : name;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/sourceEvent.js
		function sourceEvent_default(event) {
			let sourceEvent;
			while (sourceEvent = event.sourceEvent) event = sourceEvent;
			return event;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/pointer.js
		function pointer_default(event, node) {
			event = sourceEvent_default(event);
			if (node === void 0) node = event.currentTarget;
			if (node) {
				var svg = node.ownerSVGElement || node;
				if (svg.createSVGPoint) {
					var point = svg.createSVGPoint();
					point.x = event.clientX, point.y = event.clientY;
					point = point.matrixTransform(node.getScreenCTM().inverse());
					return [point.x, point.y];
				}
				if (node.getBoundingClientRect) {
					var rect = node.getBoundingClientRect();
					return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
				}
			}
			return [event.pageX, event.pageY];
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selector.js
		function none() {}
		function selector_default(selector) {
			return selector == null ? none : function() {
				return this.querySelector(selector);
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/select.js
		function select_default$2(select) {
			if (typeof select !== "function") select = selector_default(select);
			for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
				if ("__data__" in node) subnode.__data__ = node.__data__;
				subgroup[i] = subnode;
			}
			return new Selection$1(subgroups, this._parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/array.js
		function array(x) {
			return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selectorAll.js
		function empty() {
			return [];
		}
		function selectorAll_default(selector) {
			return selector == null ? empty : function() {
				return this.querySelectorAll(selector);
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/selectAll.js
		function arrayAll(select) {
			return function() {
				return array(select.apply(this, arguments));
			};
		}
		function selectAll_default$1(select) {
			if (typeof select === "function") select = arrayAll(select);
			else select = selectorAll_default(select);
			for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
				subgroups.push(select.call(node, node.__data__, i, group));
				parents.push(node);
			}
			return new Selection$1(subgroups, parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/selectChild.js
		var find = Array.prototype.find;
		function childFind(match) {
			return function() {
				return find.call(this.children, match);
			};
		}
		function childFirst() {
			return this.firstElementChild;
		}
		function selectChild_default(match) {
			return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/selectChildren.js
		var filter = Array.prototype.filter;
		function children() {
			return Array.from(this.children);
		}
		function childrenFilter(match) {
			return function() {
				return filter.call(this.children, match);
			};
		}
		function selectChildren_default(match) {
			return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/filter.js
		function filter_default$1(match) {
			if (typeof match !== "function") match = matcher_default(match);
			for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group[i]) && match.call(node, node.__data__, i, group)) subgroup.push(node);
			return new Selection$1(subgroups, this._parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/sparse.js
		function sparse_default(update) {
			return new Array(update.length);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/enter.js
		function enter_default() {
			return new Selection$1(this._enter || this._groups.map(sparse_default), this._parents);
		}
		function EnterNode(parent, datum) {
			this.ownerDocument = parent.ownerDocument;
			this.namespaceURI = parent.namespaceURI;
			this._next = null;
			this._parent = parent;
			this.__data__ = datum;
		}
		EnterNode.prototype = {
			constructor: EnterNode,
			appendChild: function(child) {
				return this._parent.insertBefore(child, this._next);
			},
			insertBefore: function(child, next) {
				return this._parent.insertBefore(child, next);
			},
			querySelector: function(selector) {
				return this._parent.querySelector(selector);
			},
			querySelectorAll: function(selector) {
				return this._parent.querySelectorAll(selector);
			}
		};
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/constant.js
		function constant_default$3(x) {
			return function() {
				return x;
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/data.js
		function bindIndex(parent, group, enter, update, exit, data) {
			var i = 0, node, groupLength = group.length, dataLength = data.length;
			for (; i < dataLength; ++i) if (node = group[i]) {
				node.__data__ = data[i];
				update[i] = node;
			} else enter[i] = new EnterNode(parent, data[i]);
			for (; i < groupLength; ++i) if (node = group[i]) exit[i] = node;
		}
		function bindKey(parent, group, enter, update, exit, data, key) {
			var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
			for (i = 0; i < groupLength; ++i) if (node = group[i]) {
				keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
				if (nodeByKeyValue.has(keyValue)) exit[i] = node;
				else nodeByKeyValue.set(keyValue, node);
			}
			for (i = 0; i < dataLength; ++i) {
				keyValue = key.call(parent, data[i], i, data) + "";
				if (node = nodeByKeyValue.get(keyValue)) {
					update[i] = node;
					node.__data__ = data[i];
					nodeByKeyValue.delete(keyValue);
				} else enter[i] = new EnterNode(parent, data[i]);
			}
			for (i = 0; i < groupLength; ++i) if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) exit[i] = node;
		}
		function datum(node) {
			return node.__data__;
		}
		function data_default(value, key) {
			if (!arguments.length) return Array.from(this, datum);
			var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
			if (typeof value !== "function") value = constant_default$3(value);
			for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
				var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength);
				bind(parent, group, enterGroup, updateGroup, exit[j] = new Array(groupLength), data, key);
				for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) if (previous = enterGroup[i0]) {
					if (i0 >= i1) i1 = i0 + 1;
					while (!(next = updateGroup[i1]) && ++i1 < dataLength);
					previous._next = next || null;
				}
			}
			update = new Selection$1(update, parents);
			update._enter = enter;
			update._exit = exit;
			return update;
		}
		function arraylike(data) {
			return typeof data === "object" && "length" in data ? data : Array.from(data);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/exit.js
		function exit_default() {
			return new Selection$1(this._exit || this._groups.map(sparse_default), this._parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/join.js
		function join_default(onenter, onupdate, onexit) {
			var enter = this.enter(), update = this, exit = this.exit();
			if (typeof onenter === "function") {
				enter = onenter(enter);
				if (enter) enter = enter.selection();
			} else enter = enter.append(onenter + "");
			if (onupdate != null) {
				update = onupdate(update);
				if (update) update = update.selection();
			}
			if (onexit == null) exit.remove();
			else onexit(exit);
			return enter && update ? enter.merge(update).order() : update;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/merge.js
		function merge_default$1(context) {
			var selection = context.selection ? context.selection() : context;
			for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge[i] = node;
			for (; j < m0; ++j) merges[j] = groups0[j];
			return new Selection$1(merges, this._parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/order.js
		function order_default() {
			for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) if (node = group[i]) {
				if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
				next = node;
			}
			return this;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/sort.js
		function sort_default(compare) {
			if (!compare) compare = ascending;
			function compareNode(a, b) {
				return a && b ? compare(a.__data__, b.__data__) : !a - !b;
			}
			for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
				for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group[i]) sortgroup[i] = node;
				sortgroup.sort(compareNode);
			}
			return new Selection$1(sortgroups, this._parents).order();
		}
		function ascending(a, b) {
			return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/call.js
		function call_default() {
			var callback = arguments[0];
			arguments[0] = this;
			callback.apply(null, arguments);
			return this;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/nodes.js
		function nodes_default() {
			return Array.from(this);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/node.js
		function node_default() {
			for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
				var node = group[i];
				if (node) return node;
			}
			return null;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/size.js
		function size_default() {
			let size = 0;
			for (const node of this) ++size;
			return size;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/empty.js
		function empty_default() {
			return !this.node();
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/each.js
		function each_default(callback) {
			for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) if (node = group[i]) callback.call(node, node.__data__, i, group);
			return this;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/attr.js
		function attrRemove$1(name) {
			return function() {
				this.removeAttribute(name);
			};
		}
		function attrRemoveNS$1(fullname) {
			return function() {
				this.removeAttributeNS(fullname.space, fullname.local);
			};
		}
		function attrConstant$1(name, value) {
			return function() {
				this.setAttribute(name, value);
			};
		}
		function attrConstantNS$1(fullname, value) {
			return function() {
				this.setAttributeNS(fullname.space, fullname.local, value);
			};
		}
		function attrFunction$1(name, value) {
			return function() {
				var v = value.apply(this, arguments);
				if (v == null) this.removeAttribute(name);
				else this.setAttribute(name, v);
			};
		}
		function attrFunctionNS$1(fullname, value) {
			return function() {
				var v = value.apply(this, arguments);
				if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
				else this.setAttributeNS(fullname.space, fullname.local, v);
			};
		}
		function attr_default$1(name, value) {
			var fullname = namespace_default(name);
			if (arguments.length < 2) {
				var node = this.node();
				return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
			}
			return this.each((value == null ? fullname.local ? attrRemoveNS$1 : attrRemove$1 : typeof value === "function" ? fullname.local ? attrFunctionNS$1 : attrFunction$1 : fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/window.js
		function window_default(node) {
			return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/style.js
		function styleRemove$1(name) {
			return function() {
				this.style.removeProperty(name);
			};
		}
		function styleConstant$1(name, value, priority) {
			return function() {
				this.style.setProperty(name, value, priority);
			};
		}
		function styleFunction$1(name, value, priority) {
			return function() {
				var v = value.apply(this, arguments);
				if (v == null) this.style.removeProperty(name);
				else this.style.setProperty(name, v, priority);
			};
		}
		function style_default$1(name, value, priority) {
			return arguments.length > 1 ? this.each((value == null ? styleRemove$1 : typeof value === "function" ? styleFunction$1 : styleConstant$1)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
		}
		function styleValue(node, name) {
			return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/property.js
		function propertyRemove(name) {
			return function() {
				delete this[name];
			};
		}
		function propertyConstant(name, value) {
			return function() {
				this[name] = value;
			};
		}
		function propertyFunction(name, value) {
			return function() {
				var v = value.apply(this, arguments);
				if (v == null) delete this[name];
				else this[name] = v;
			};
		}
		function property_default(name, value) {
			return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/classed.js
		function classArray(string) {
			return string.trim().split(/^|\s+/);
		}
		function classList(node) {
			return node.classList || new ClassList(node);
		}
		function ClassList(node) {
			this._node = node;
			this._names = classArray(node.getAttribute("class") || "");
		}
		ClassList.prototype = {
			add: function(name) {
				if (this._names.indexOf(name) < 0) {
					this._names.push(name);
					this._node.setAttribute("class", this._names.join(" "));
				}
			},
			remove: function(name) {
				var i = this._names.indexOf(name);
				if (i >= 0) {
					this._names.splice(i, 1);
					this._node.setAttribute("class", this._names.join(" "));
				}
			},
			contains: function(name) {
				return this._names.indexOf(name) >= 0;
			}
		};
		function classedAdd(node, names) {
			var list = classList(node), i = -1, n = names.length;
			while (++i < n) list.add(names[i]);
		}
		function classedRemove(node, names) {
			var list = classList(node), i = -1, n = names.length;
			while (++i < n) list.remove(names[i]);
		}
		function classedTrue(names) {
			return function() {
				classedAdd(this, names);
			};
		}
		function classedFalse(names) {
			return function() {
				classedRemove(this, names);
			};
		}
		function classedFunction(names, value) {
			return function() {
				(value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
			};
		}
		function classed_default(name, value) {
			var names = classArray(name + "");
			if (arguments.length < 2) {
				var list = classList(this.node()), i = -1, n = names.length;
				while (++i < n) if (!list.contains(names[i])) return false;
				return true;
			}
			return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/text.js
		function textRemove() {
			this.textContent = "";
		}
		function textConstant$1(value) {
			return function() {
				this.textContent = value;
			};
		}
		function textFunction$1(value) {
			return function() {
				var v = value.apply(this, arguments);
				this.textContent = v == null ? "" : v;
			};
		}
		function text_default$1(value) {
			return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction$1 : textConstant$1)(value)) : this.node().textContent;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/html.js
		function htmlRemove() {
			this.innerHTML = "";
		}
		function htmlConstant(value) {
			return function() {
				this.innerHTML = value;
			};
		}
		function htmlFunction(value) {
			return function() {
				var v = value.apply(this, arguments);
				this.innerHTML = v == null ? "" : v;
			};
		}
		function html_default(value) {
			return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/raise.js
		function raise() {
			if (this.nextSibling) this.parentNode.appendChild(this);
		}
		function raise_default() {
			return this.each(raise);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/lower.js
		function lower() {
			if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
		}
		function lower_default() {
			return this.each(lower);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/creator.js
		function creatorInherit(name) {
			return function() {
				var document = this.ownerDocument, uri = this.namespaceURI;
				return uri === "http://www.w3.org/1999/xhtml" && document.documentElement.namespaceURI === "http://www.w3.org/1999/xhtml" ? document.createElement(name) : document.createElementNS(uri, name);
			};
		}
		function creatorFixed(fullname) {
			return function() {
				return this.ownerDocument.createElementNS(fullname.space, fullname.local);
			};
		}
		function creator_default(name) {
			var fullname = namespace_default(name);
			return (fullname.local ? creatorFixed : creatorInherit)(fullname);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/append.js
		function append_default(name) {
			var create = typeof name === "function" ? name : creator_default(name);
			return this.select(function() {
				return this.appendChild(create.apply(this, arguments));
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/insert.js
		function constantNull() {
			return null;
		}
		function insert_default(name, before) {
			var create = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
			return this.select(function() {
				return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/remove.js
		function remove() {
			var parent = this.parentNode;
			if (parent) parent.removeChild(this);
		}
		function remove_default$1() {
			return this.each(remove);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/clone.js
		function selection_cloneShallow() {
			var clone = this.cloneNode(false), parent = this.parentNode;
			return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
		}
		function selection_cloneDeep() {
			var clone = this.cloneNode(true), parent = this.parentNode;
			return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
		}
		function clone_default(deep) {
			return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/datum.js
		function datum_default(value) {
			return arguments.length ? this.property("__data__", value) : this.node().__data__;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/on.js
		function contextListener(listener) {
			return function(event) {
				listener.call(this, event, this.__data__);
			};
		}
		function parseTypenames(typenames) {
			return typenames.trim().split(/^|\s+/).map(function(t) {
				var name = "", i = t.indexOf(".");
				if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
				return {
					type: t,
					name
				};
			});
		}
		function onRemove(typename) {
			return function() {
				var on = this.__on;
				if (!on) return;
				for (var j = 0, i = -1, m = on.length, o; j < m; ++j) if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) this.removeEventListener(o.type, o.listener, o.options);
				else on[++i] = o;
				if (++i) on.length = i;
				else delete this.__on;
			};
		}
		function onAdd(typename, value, options) {
			return function() {
				var on = this.__on, o, listener = contextListener(value);
				if (on) {
					for (var j = 0, m = on.length; j < m; ++j) if ((o = on[j]).type === typename.type && o.name === typename.name) {
						this.removeEventListener(o.type, o.listener, o.options);
						this.addEventListener(o.type, o.listener = listener, o.options = options);
						o.value = value;
						return;
					}
				}
				this.addEventListener(typename.type, listener, options);
				o = {
					type: typename.type,
					name: typename.name,
					value,
					listener,
					options
				};
				if (!on) this.__on = [o];
				else on.push(o);
			};
		}
		function on_default$1(typename, value, options) {
			var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;
			if (arguments.length < 2) {
				var on = this.node().__on;
				if (on) {
					for (var j = 0, m = on.length, o; j < m; ++j) for (i = 0, o = on[j]; i < n; ++i) if ((t = typenames[i]).type === o.type && t.name === o.name) return o.value;
				}
				return;
			}
			on = value ? onAdd : onRemove;
			for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
			return this;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/dispatch.js
		function dispatchEvent(node, type, params) {
			var window = window_default(node), event = window.CustomEvent;
			if (typeof event === "function") event = new event(type, params);
			else {
				event = window.document.createEvent("Event");
				if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
				else event.initEvent(type, false, false);
			}
			node.dispatchEvent(event);
		}
		function dispatchConstant(type, params) {
			return function() {
				return dispatchEvent(this, type, params);
			};
		}
		function dispatchFunction(type, params) {
			return function() {
				return dispatchEvent(this, type, params.apply(this, arguments));
			};
		}
		function dispatch_default(type, params) {
			return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type, params));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/iterator.js
		function* iterator_default() {
			for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) if (node = group[i]) yield node;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/selection/index.js
		var root = [null];
		function Selection$1(groups, parents) {
			this._groups = groups;
			this._parents = parents;
		}
		function selection() {
			return new Selection$1([[document.documentElement]], root);
		}
		function selection_selection() {
			return this;
		}
		Selection$1.prototype = selection.prototype = {
			constructor: Selection$1,
			select: select_default$2,
			selectAll: selectAll_default$1,
			selectChild: selectChild_default,
			selectChildren: selectChildren_default,
			filter: filter_default$1,
			data: data_default,
			enter: enter_default,
			exit: exit_default,
			join: join_default,
			merge: merge_default$1,
			selection: selection_selection,
			order: order_default,
			sort: sort_default,
			call: call_default,
			nodes: nodes_default,
			node: node_default,
			size: size_default,
			empty: empty_default,
			each: each_default,
			attr: attr_default$1,
			style: style_default$1,
			property: property_default,
			classed: classed_default,
			text: text_default$1,
			html: html_default,
			raise: raise_default,
			lower: lower_default,
			append: append_default,
			insert: insert_default,
			remove: remove_default$1,
			clone: clone_default,
			datum: datum_default,
			on: on_default$1,
			dispatch: dispatch_default,
			[Symbol.iterator]: iterator_default
		};
		//#endregion
		//#region ../../node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js
		function select_default$1(selector) {
			return typeof selector === "string" ? new Selection$1([[document.querySelector(selector)]], [document.documentElement]) : new Selection$1([[selector]], root);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-drag@3.0.0/node_modules/d3-drag/src/noevent.js
		const nonpassive = { passive: false };
		const nonpassivecapture = {
			capture: true,
			passive: false
		};
		function nopropagation$1(event) {
			event.stopImmediatePropagation();
		}
		function noevent_default$1(event) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-drag@3.0.0/node_modules/d3-drag/src/nodrag.js
		function nodrag_default(view) {
			var root = view.document.documentElement, selection = select_default$1(view).on("dragstart.drag", noevent_default$1, nonpassivecapture);
			if ("onselectstart" in root) selection.on("selectstart.drag", noevent_default$1, nonpassivecapture);
			else {
				root.__noselect = root.style.MozUserSelect;
				root.style.MozUserSelect = "none";
			}
		}
		function yesdrag(view, noclick) {
			var root = view.document.documentElement, selection = select_default$1(view).on("dragstart.drag", null);
			if (noclick) {
				selection.on("click.drag", noevent_default$1, nonpassivecapture);
				setTimeout(function() {
					selection.on("click.drag", null);
				}, 0);
			}
			if ("onselectstart" in root) selection.on("selectstart.drag", null);
			else {
				root.style.MozUserSelect = root.__noselect;
				delete root.__noselect;
			}
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-drag@3.0.0/node_modules/d3-drag/src/constant.js
		var constant_default$2 = (x) => () => x;
		//#endregion
		//#region ../../node_modules/.pnpm/d3-drag@3.0.0/node_modules/d3-drag/src/event.js
		function DragEvent(type, { sourceEvent, subject, target, identifier, active, x, y, dx, dy, dispatch }) {
			Object.defineProperties(this, {
				type: {
					value: type,
					enumerable: true,
					configurable: true
				},
				sourceEvent: {
					value: sourceEvent,
					enumerable: true,
					configurable: true
				},
				subject: {
					value: subject,
					enumerable: true,
					configurable: true
				},
				target: {
					value: target,
					enumerable: true,
					configurable: true
				},
				identifier: {
					value: identifier,
					enumerable: true,
					configurable: true
				},
				active: {
					value: active,
					enumerable: true,
					configurable: true
				},
				x: {
					value: x,
					enumerable: true,
					configurable: true
				},
				y: {
					value: y,
					enumerable: true,
					configurable: true
				},
				dx: {
					value: dx,
					enumerable: true,
					configurable: true
				},
				dy: {
					value: dy,
					enumerable: true,
					configurable: true
				},
				_: { value: dispatch }
			});
		}
		DragEvent.prototype.on = function() {
			var value = this._.on.apply(this._, arguments);
			return value === this._ ? this : value;
		};
		//#endregion
		//#region ../../node_modules/.pnpm/d3-drag@3.0.0/node_modules/d3-drag/src/drag.js
		function defaultFilter$1(event) {
			return !event.ctrlKey && !event.button;
		}
		function defaultContainer() {
			return this.parentNode;
		}
		function defaultSubject(event, d) {
			return d == null ? {
				x: event.x,
				y: event.y
			} : d;
		}
		function defaultTouchable$1() {
			return navigator.maxTouchPoints || "ontouchstart" in this;
		}
		function drag_default() {
			var filter = defaultFilter$1, container = defaultContainer, subject = defaultSubject, touchable = defaultTouchable$1, gestures = {}, listeners = dispatch("start", "drag", "end"), active = 0, mousedownx, mousedowny, mousemoving, touchending, clickDistance2 = 0;
			function drag(selection) {
				selection.on("mousedown.drag", mousedowned).filter(touchable).on("touchstart.drag", touchstarted).on("touchmove.drag", touchmoved, nonpassive).on("touchend.drag touchcancel.drag", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
			}
			function mousedowned(event, d) {
				if (touchending || !filter.call(this, event, d)) return;
				var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
				if (!gesture) return;
				select_default$1(event.view).on("mousemove.drag", mousemoved, nonpassivecapture).on("mouseup.drag", mouseupped, nonpassivecapture);
				nodrag_default(event.view);
				nopropagation$1(event);
				mousemoving = false;
				mousedownx = event.clientX;
				mousedowny = event.clientY;
				gesture("start", event);
			}
			function mousemoved(event) {
				noevent_default$1(event);
				if (!mousemoving) {
					var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
					mousemoving = dx * dx + dy * dy > clickDistance2;
				}
				gestures.mouse("drag", event);
			}
			function mouseupped(event) {
				select_default$1(event.view).on("mousemove.drag mouseup.drag", null);
				yesdrag(event.view, mousemoving);
				noevent_default$1(event);
				gestures.mouse("end", event);
			}
			function touchstarted(event, d) {
				if (!filter.call(this, event, d)) return;
				var touches = event.changedTouches, c = container.call(this, event, d), n = touches.length, i, gesture;
				for (i = 0; i < n; ++i) if (gesture = beforestart(this, c, event, d, touches[i].identifier, touches[i])) {
					nopropagation$1(event);
					gesture("start", event, touches[i]);
				}
			}
			function touchmoved(event) {
				var touches = event.changedTouches, n = touches.length, i, gesture;
				for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
					noevent_default$1(event);
					gesture("drag", event, touches[i]);
				}
			}
			function touchended(event) {
				var touches = event.changedTouches, n = touches.length, i, gesture;
				if (touchending) clearTimeout(touchending);
				touchending = setTimeout(function() {
					touchending = null;
				}, 500);
				for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
					nopropagation$1(event);
					gesture("end", event, touches[i]);
				}
			}
			function beforestart(that, container, event, d, identifier, touch) {
				var dispatch = listeners.copy(), p = pointer_default(touch || event, container), dx, dy, s;
				if ((s = subject.call(that, new DragEvent("beforestart", {
					sourceEvent: event,
					target: drag,
					identifier,
					active,
					x: p[0],
					y: p[1],
					dx: 0,
					dy: 0,
					dispatch
				}), d)) == null) return;
				dx = s.x - p[0] || 0;
				dy = s.y - p[1] || 0;
				return function gesture(type, event, touch) {
					var p0 = p, n;
					switch (type) {
						case "start":
							gestures[identifier] = gesture, n = active++;
							break;
						case "end": delete gestures[identifier], --active;
						case "drag":
							p = pointer_default(touch || event, container), n = active;
							break;
					}
					dispatch.call(type, that, new DragEvent(type, {
						sourceEvent: event,
						subject: s,
						target: drag,
						identifier,
						active: n,
						x: p[0] + dx,
						y: p[1] + dy,
						dx: p[0] - p0[0],
						dy: p[1] - p0[1],
						dispatch
					}), d);
				};
			}
			drag.filter = function(_) {
				return arguments.length ? (filter = typeof _ === "function" ? _ : constant_default$2(!!_), drag) : filter;
			};
			drag.container = function(_) {
				return arguments.length ? (container = typeof _ === "function" ? _ : constant_default$2(_), drag) : container;
			};
			drag.subject = function(_) {
				return arguments.length ? (subject = typeof _ === "function" ? _ : constant_default$2(_), drag) : subject;
			};
			drag.touchable = function(_) {
				return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default$2(!!_), drag) : touchable;
			};
			drag.on = function() {
				var value = listeners.on.apply(listeners, arguments);
				return value === listeners ? drag : value;
			};
			drag.clickDistance = function(_) {
				return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
			};
			return drag;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/define.js
		function define_default(constructor, factory, prototype) {
			constructor.prototype = factory.prototype = prototype;
			prototype.constructor = constructor;
		}
		function extend(parent, definition) {
			var prototype = Object.create(parent.prototype);
			for (var key in definition) prototype[key] = definition[key];
			return prototype;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/color.js
		function Color() {}
		var darker = .7;
		var brighter = 1 / darker;
		var reI = "\\s*([+-]?\\d+)\\s*", reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", reHex = /^#([0-9a-f]{3,8})$/, reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`), reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`), reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`), reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`), reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`), reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
		var named = {
			aliceblue: 15792383,
			antiquewhite: 16444375,
			aqua: 65535,
			aquamarine: 8388564,
			azure: 15794175,
			beige: 16119260,
			bisque: 16770244,
			black: 0,
			blanchedalmond: 16772045,
			blue: 255,
			blueviolet: 9055202,
			brown: 10824234,
			burlywood: 14596231,
			cadetblue: 6266528,
			chartreuse: 8388352,
			chocolate: 13789470,
			coral: 16744272,
			cornflowerblue: 6591981,
			cornsilk: 16775388,
			crimson: 14423100,
			cyan: 65535,
			darkblue: 139,
			darkcyan: 35723,
			darkgoldenrod: 12092939,
			darkgray: 11119017,
			darkgreen: 25600,
			darkgrey: 11119017,
			darkkhaki: 12433259,
			darkmagenta: 9109643,
			darkolivegreen: 5597999,
			darkorange: 16747520,
			darkorchid: 10040012,
			darkred: 9109504,
			darksalmon: 15308410,
			darkseagreen: 9419919,
			darkslateblue: 4734347,
			darkslategray: 3100495,
			darkslategrey: 3100495,
			darkturquoise: 52945,
			darkviolet: 9699539,
			deeppink: 16716947,
			deepskyblue: 49151,
			dimgray: 6908265,
			dimgrey: 6908265,
			dodgerblue: 2003199,
			firebrick: 11674146,
			floralwhite: 16775920,
			forestgreen: 2263842,
			fuchsia: 16711935,
			gainsboro: 14474460,
			ghostwhite: 16316671,
			gold: 16766720,
			goldenrod: 14329120,
			gray: 8421504,
			green: 32768,
			greenyellow: 11403055,
			grey: 8421504,
			honeydew: 15794160,
			hotpink: 16738740,
			indianred: 13458524,
			indigo: 4915330,
			ivory: 16777200,
			khaki: 15787660,
			lavender: 15132410,
			lavenderblush: 16773365,
			lawngreen: 8190976,
			lemonchiffon: 16775885,
			lightblue: 11393254,
			lightcoral: 15761536,
			lightcyan: 14745599,
			lightgoldenrodyellow: 16448210,
			lightgray: 13882323,
			lightgreen: 9498256,
			lightgrey: 13882323,
			lightpink: 16758465,
			lightsalmon: 16752762,
			lightseagreen: 2142890,
			lightskyblue: 8900346,
			lightslategray: 7833753,
			lightslategrey: 7833753,
			lightsteelblue: 11584734,
			lightyellow: 16777184,
			lime: 65280,
			limegreen: 3329330,
			linen: 16445670,
			magenta: 16711935,
			maroon: 8388608,
			mediumaquamarine: 6737322,
			mediumblue: 205,
			mediumorchid: 12211667,
			mediumpurple: 9662683,
			mediumseagreen: 3978097,
			mediumslateblue: 8087790,
			mediumspringgreen: 64154,
			mediumturquoise: 4772300,
			mediumvioletred: 13047173,
			midnightblue: 1644912,
			mintcream: 16121850,
			mistyrose: 16770273,
			moccasin: 16770229,
			navajowhite: 16768685,
			navy: 128,
			oldlace: 16643558,
			olive: 8421376,
			olivedrab: 7048739,
			orange: 16753920,
			orangered: 16729344,
			orchid: 14315734,
			palegoldenrod: 15657130,
			palegreen: 10025880,
			paleturquoise: 11529966,
			palevioletred: 14381203,
			papayawhip: 16773077,
			peachpuff: 16767673,
			peru: 13468991,
			pink: 16761035,
			plum: 14524637,
			powderblue: 11591910,
			purple: 8388736,
			rebeccapurple: 6697881,
			red: 16711680,
			rosybrown: 12357519,
			royalblue: 4286945,
			saddlebrown: 9127187,
			salmon: 16416882,
			sandybrown: 16032864,
			seagreen: 3050327,
			seashell: 16774638,
			sienna: 10506797,
			silver: 12632256,
			skyblue: 8900331,
			slateblue: 6970061,
			slategray: 7372944,
			slategrey: 7372944,
			snow: 16775930,
			springgreen: 65407,
			steelblue: 4620980,
			tan: 13808780,
			teal: 32896,
			thistle: 14204888,
			tomato: 16737095,
			turquoise: 4251856,
			violet: 15631086,
			wheat: 16113331,
			white: 16777215,
			whitesmoke: 16119285,
			yellow: 16776960,
			yellowgreen: 10145074
		};
		define_default(Color, color, {
			copy(channels) {
				return Object.assign(new this.constructor(), this, channels);
			},
			displayable() {
				return this.rgb().displayable();
			},
			hex: color_formatHex,
			formatHex: color_formatHex,
			formatHex8: color_formatHex8,
			formatHsl: color_formatHsl,
			formatRgb: color_formatRgb,
			toString: color_formatRgb
		});
		function color_formatHex() {
			return this.rgb().formatHex();
		}
		function color_formatHex8() {
			return this.rgb().formatHex8();
		}
		function color_formatHsl() {
			return hslConvert(this).formatHsl();
		}
		function color_formatRgb() {
			return this.rgb().formatRgb();
		}
		function color(format) {
			var m, l;
			format = (format + "").trim().toLowerCase();
			return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
		}
		function rgbn(n) {
			return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
		}
		function rgba(r, g, b, a) {
			if (a <= 0) r = g = b = NaN;
			return new Rgb(r, g, b, a);
		}
		function rgbConvert(o) {
			if (!(o instanceof Color)) o = color(o);
			if (!o) return new Rgb();
			o = o.rgb();
			return new Rgb(o.r, o.g, o.b, o.opacity);
		}
		function rgb(r, g, b, opacity) {
			return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
		}
		function Rgb(r, g, b, opacity) {
			this.r = +r;
			this.g = +g;
			this.b = +b;
			this.opacity = +opacity;
		}
		define_default(Rgb, rgb, extend(Color, {
			brighter(k) {
				k = k == null ? brighter : Math.pow(brighter, k);
				return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
			},
			darker(k) {
				k = k == null ? darker : Math.pow(darker, k);
				return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
			},
			rgb() {
				return this;
			},
			clamp() {
				return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
			},
			displayable() {
				return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
			},
			hex: rgb_formatHex,
			formatHex: rgb_formatHex,
			formatHex8: rgb_formatHex8,
			formatRgb: rgb_formatRgb,
			toString: rgb_formatRgb
		}));
		function rgb_formatHex() {
			return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
		}
		function rgb_formatHex8() {
			return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
		}
		function rgb_formatRgb() {
			const a = clampa(this.opacity);
			return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
		}
		function clampa(opacity) {
			return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
		}
		function clampi(value) {
			return Math.max(0, Math.min(255, Math.round(value) || 0));
		}
		function hex(value) {
			value = clampi(value);
			return (value < 16 ? "0" : "") + value.toString(16);
		}
		function hsla(h, s, l, a) {
			if (a <= 0) h = s = l = NaN;
			else if (l <= 0 || l >= 1) h = s = NaN;
			else if (s <= 0) h = NaN;
			return new Hsl(h, s, l, a);
		}
		function hslConvert(o) {
			if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
			if (!(o instanceof Color)) o = color(o);
			if (!o) return new Hsl();
			if (o instanceof Hsl) return o;
			o = o.rgb();
			var r = o.r / 255, g = o.g / 255, b = o.b / 255, min = Math.min(r, g, b), max = Math.max(r, g, b), h = NaN, s = max - min, l = (max + min) / 2;
			if (s) {
				if (r === max) h = (g - b) / s + (g < b) * 6;
				else if (g === max) h = (b - r) / s + 2;
				else h = (r - g) / s + 4;
				s /= l < .5 ? max + min : 2 - max - min;
				h *= 60;
			} else s = l > 0 && l < 1 ? 0 : h;
			return new Hsl(h, s, l, o.opacity);
		}
		function hsl(h, s, l, opacity) {
			return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
		}
		function Hsl(h, s, l, opacity) {
			this.h = +h;
			this.s = +s;
			this.l = +l;
			this.opacity = +opacity;
		}
		define_default(Hsl, hsl, extend(Color, {
			brighter(k) {
				k = k == null ? brighter : Math.pow(brighter, k);
				return new Hsl(this.h, this.s, this.l * k, this.opacity);
			},
			darker(k) {
				k = k == null ? darker : Math.pow(darker, k);
				return new Hsl(this.h, this.s, this.l * k, this.opacity);
			},
			rgb() {
				var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < .5 ? l : 1 - l) * s, m1 = 2 * l - m2;
				return new Rgb(hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2), hsl2rgb(h, m1, m2), hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2), this.opacity);
			},
			clamp() {
				return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
			},
			displayable() {
				return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
			},
			formatHsl() {
				const a = clampa(this.opacity);
				return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
			}
		}));
		function clamph(value) {
			value = (value || 0) % 360;
			return value < 0 ? value + 360 : value;
		}
		function clampt(value) {
			return Math.max(0, Math.min(1, value || 0));
		}
		function hsl2rgb(h, m1, m2) {
			return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/constant.js
		var constant_default$1 = (x) => () => x;
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/color.js
		function linear(a, d) {
			return function(t) {
				return a + t * d;
			};
		}
		function exponential(a, b, y) {
			return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
				return Math.pow(a + t * b, y);
			};
		}
		function gamma(y) {
			return (y = +y) === 1 ? nogamma : function(a, b) {
				return b - a ? exponential(a, b, y) : constant_default$1(isNaN(a) ? b : a);
			};
		}
		function nogamma(a, b) {
			var d = b - a;
			return d ? linear(a, d) : constant_default$1(isNaN(a) ? b : a);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/rgb.js
		var rgb_default = (function rgbGamma(y) {
			var color = gamma(y);
			function rgb$1(start, end) {
				var r = color((start = rgb(start)).r, (end = rgb(end)).r), g = color(start.g, end.g), b = color(start.b, end.b), opacity = nogamma(start.opacity, end.opacity);
				return function(t) {
					start.r = r(t);
					start.g = g(t);
					start.b = b(t);
					start.opacity = opacity(t);
					return start + "";
				};
			}
			rgb$1.gamma = rgbGamma;
			return rgb$1;
		})(1);
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/numberArray.js
		function numberArray_default(a, b) {
			if (!b) b = [];
			var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
			return function(t) {
				for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
				return c;
			};
		}
		function isNumberArray(x) {
			return ArrayBuffer.isView(x) && !(x instanceof DataView);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/array.js
		function genericArray(a, b) {
			var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x = new Array(na), c = new Array(nb), i;
			for (i = 0; i < na; ++i) x[i] = value_default(a[i], b[i]);
			for (; i < nb; ++i) c[i] = b[i];
			return function(t) {
				for (i = 0; i < na; ++i) c[i] = x[i](t);
				return c;
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/date.js
		function date_default(a, b) {
			var d = /* @__PURE__ */ new Date();
			return a = +a, b = +b, function(t) {
				return d.setTime(a * (1 - t) + b * t), d;
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/number.js
		function number_default(a, b) {
			return a = +a, b = +b, function(t) {
				return a * (1 - t) + b * t;
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/object.js
		function object_default(a, b) {
			var i = {}, c = {}, k;
			if (a === null || typeof a !== "object") a = {};
			if (b === null || typeof b !== "object") b = {};
			for (k in b) if (k in a) i[k] = value_default(a[k], b[k]);
			else c[k] = b[k];
			return function(t) {
				for (k in i) c[k] = i[k](t);
				return c;
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/string.js
		var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, reB = new RegExp(reA.source, "g");
		function zero(b) {
			return function() {
				return b;
			};
		}
		function one(b) {
			return function(t) {
				return b(t) + "";
			};
		}
		function string_default(a, b) {
			var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
			a = a + "", b = b + "";
			while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
				if ((bs = bm.index) > bi) {
					bs = b.slice(bi, bs);
					if (s[i]) s[i] += bs;
					else s[++i] = bs;
				}
				if ((am = am[0]) === (bm = bm[0])) if (s[i]) s[i] += bm;
				else s[++i] = bm;
				else {
					s[++i] = null;
					q.push({
						i,
						x: number_default(am, bm)
					});
				}
				bi = reB.lastIndex;
			}
			if (bi < b.length) {
				bs = b.slice(bi);
				if (s[i]) s[i] += bs;
				else s[++i] = bs;
			}
			return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
				for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
				return s.join("");
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/value.js
		function value_default(a, b) {
			var t = typeof b, c;
			return b == null || t === "boolean" ? constant_default$1(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/decompose.js
		var degrees = 180 / Math.PI;
		var identity$2 = {
			translateX: 0,
			translateY: 0,
			rotate: 0,
			skewX: 0,
			scaleX: 1,
			scaleY: 1
		};
		function decompose_default(a, b, c, d, e, f) {
			var scaleX, scaleY, skewX;
			if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
			if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
			if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
			if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
			return {
				translateX: e,
				translateY: f,
				rotate: Math.atan2(b, a) * degrees,
				skewX: Math.atan(skewX) * degrees,
				scaleX,
				scaleY
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/parse.js
		var svgNode;
		function parseCss(value) {
			const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
			return m.isIdentity ? identity$2 : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
		}
		function parseSvg(value) {
			if (value == null) return identity$2;
			if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
			svgNode.setAttribute("transform", value);
			if (!(value = svgNode.transform.baseVal.consolidate())) return identity$2;
			value = value.matrix;
			return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/index.js
		function interpolateTransform(parse, pxComma, pxParen, degParen) {
			function pop(s) {
				return s.length ? s.pop() + " " : "";
			}
			function translate(xa, ya, xb, yb, s, q) {
				if (xa !== xb || ya !== yb) {
					var i = s.push("translate(", null, pxComma, null, pxParen);
					q.push({
						i: i - 4,
						x: number_default(xa, xb)
					}, {
						i: i - 2,
						x: number_default(ya, yb)
					});
				} else if (xb || yb) s.push("translate(" + xb + pxComma + yb + pxParen);
			}
			function rotate(a, b, s, q) {
				if (a !== b) {
					if (a - b > 180) b += 360;
					else if (b - a > 180) a += 360;
					q.push({
						i: s.push(pop(s) + "rotate(", null, degParen) - 2,
						x: number_default(a, b)
					});
				} else if (b) s.push(pop(s) + "rotate(" + b + degParen);
			}
			function skewX(a, b, s, q) {
				if (a !== b) q.push({
					i: s.push(pop(s) + "skewX(", null, degParen) - 2,
					x: number_default(a, b)
				});
				else if (b) s.push(pop(s) + "skewX(" + b + degParen);
			}
			function scale(xa, ya, xb, yb, s, q) {
				if (xa !== xb || ya !== yb) {
					var i = s.push(pop(s) + "scale(", null, ",", null, ")");
					q.push({
						i: i - 4,
						x: number_default(xa, xb)
					}, {
						i: i - 2,
						x: number_default(ya, yb)
					});
				} else if (xb !== 1 || yb !== 1) s.push(pop(s) + "scale(" + xb + "," + yb + ")");
			}
			return function(a, b) {
				var s = [], q = [];
				a = parse(a), b = parse(b);
				translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
				rotate(a.rotate, b.rotate, s, q);
				skewX(a.skewX, b.skewX, s, q);
				scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
				a = b = null;
				return function(t) {
					var i = -1, n = q.length, o;
					while (++i < n) s[(o = q[i]).i] = o.x(t);
					return s.join("");
				};
			};
		}
		var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
		var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");
		//#endregion
		//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/zoom.js
		var epsilon2 = 1e-12;
		function cosh(x) {
			return ((x = Math.exp(x)) + 1 / x) / 2;
		}
		function sinh(x) {
			return ((x = Math.exp(x)) - 1 / x) / 2;
		}
		function tanh(x) {
			return ((x = Math.exp(2 * x)) - 1) / (x + 1);
		}
		var zoom_default$1 = (function zoomRho(rho, rho2, rho4) {
			function zoom(p0, p1) {
				var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
				if (d2 < epsilon2) {
					S = Math.log(w1 / w0) / rho;
					i = function(t) {
						return [
							ux0 + t * dx,
							uy0 + t * dy,
							w0 * Math.exp(rho * t * S)
						];
					};
				} else {
					var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
					S = (Math.log(Math.sqrt(b1 * b1 + 1) - b1) - r0) / rho;
					i = function(t) {
						var s = t * S, coshr0 = cosh(r0), u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
						return [
							ux0 + u * dx,
							uy0 + u * dy,
							w0 * coshr0 / cosh(rho * s + r0)
						];
					};
				}
				i.duration = S * 1e3 * rho / Math.SQRT2;
				return i;
			}
			zoom.rho = function(_) {
				var _1 = Math.max(.001, +_), _2 = _1 * _1;
				return zoomRho(_1, _2, _2 * _2);
			};
			return zoom;
		})(Math.SQRT2, 2, 4);
		//#endregion
		//#region ../../node_modules/.pnpm/d3-timer@3.0.1/node_modules/d3-timer/src/timer.js
		var frame = 0, timeout = 0, interval = 0, pokeDelay = 1e3, taskHead, taskTail, clockLast = 0, clockNow = 0, clockSkew = 0, clock = typeof performance === "object" && performance.now ? performance : Date, setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
			setTimeout(f, 17);
		};
		function now() {
			return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
		}
		function clearNow() {
			clockNow = 0;
		}
		function Timer() {
			this._call = this._time = this._next = null;
		}
		Timer.prototype = timer.prototype = {
			constructor: Timer,
			restart: function(callback, delay, time) {
				if (typeof callback !== "function") throw new TypeError("callback is not a function");
				time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
				if (!this._next && taskTail !== this) {
					if (taskTail) taskTail._next = this;
					else taskHead = this;
					taskTail = this;
				}
				this._call = callback;
				this._time = time;
				sleep();
			},
			stop: function() {
				if (this._call) {
					this._call = null;
					this._time = Infinity;
					sleep();
				}
			}
		};
		function timer(callback, delay, time) {
			var t = new Timer();
			t.restart(callback, delay, time);
			return t;
		}
		function timerFlush() {
			now();
			++frame;
			var t = taskHead, e;
			while (t) {
				if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
				t = t._next;
			}
			--frame;
		}
		function wake() {
			clockNow = (clockLast = clock.now()) + clockSkew;
			frame = timeout = 0;
			try {
				timerFlush();
			} finally {
				frame = 0;
				nap();
				clockNow = 0;
			}
		}
		function poke() {
			var now = clock.now(), delay = now - clockLast;
			if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
		}
		function nap() {
			var t0, t1 = taskHead, t2, time = Infinity;
			while (t1) if (t1._call) {
				if (time > t1._time) time = t1._time;
				t0 = t1, t1 = t1._next;
			} else {
				t2 = t1._next, t1._next = null;
				t1 = t0 ? t0._next = t2 : taskHead = t2;
			}
			taskTail = t0;
			sleep(time);
		}
		function sleep(time) {
			if (frame) return;
			if (timeout) timeout = clearTimeout(timeout);
			if (time - clockNow > 24) {
				if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
				if (interval) interval = clearInterval(interval);
			} else {
				if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
				frame = 1, setFrame(wake);
			}
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-timer@3.0.1/node_modules/d3-timer/src/timeout.js
		function timeout_default(callback, delay, time) {
			var t = new Timer();
			delay = delay == null ? 0 : +delay;
			t.restart((elapsed) => {
				t.stop();
				callback(elapsed + delay);
			}, delay, time);
			return t;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/schedule.js
		var emptyOn = dispatch("start", "end", "cancel", "interrupt");
		var emptyTween = [];
		function schedule_default(node, name, id, index, group, timing) {
			var schedules = node.__transition;
			if (!schedules) node.__transition = {};
			else if (id in schedules) return;
			create(node, id, {
				name,
				index,
				group,
				on: emptyOn,
				tween: emptyTween,
				time: timing.time,
				delay: timing.delay,
				duration: timing.duration,
				ease: timing.ease,
				timer: null,
				state: 0
			});
		}
		function init(node, id) {
			var schedule = get(node, id);
			if (schedule.state > 0) throw new Error("too late; already scheduled");
			return schedule;
		}
		function set(node, id) {
			var schedule = get(node, id);
			if (schedule.state > 3) throw new Error("too late; already running");
			return schedule;
		}
		function get(node, id) {
			var schedule = node.__transition;
			if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
			return schedule;
		}
		function create(node, id, self) {
			var schedules = node.__transition, tween;
			schedules[id] = self;
			self.timer = timer(schedule, 0, self.time);
			function schedule(elapsed) {
				self.state = 1;
				self.timer.restart(start, self.delay, self.time);
				if (self.delay <= elapsed) start(elapsed - self.delay);
			}
			function start(elapsed) {
				var i, j, n, o;
				if (self.state !== 1) return stop();
				for (i in schedules) {
					o = schedules[i];
					if (o.name !== self.name) continue;
					if (o.state === 3) return timeout_default(start);
					if (o.state === 4) {
						o.state = 6;
						o.timer.stop();
						o.on.call("interrupt", node, node.__data__, o.index, o.group);
						delete schedules[i];
					} else if (+i < id) {
						o.state = 6;
						o.timer.stop();
						o.on.call("cancel", node, node.__data__, o.index, o.group);
						delete schedules[i];
					}
				}
				timeout_default(function() {
					if (self.state === 3) {
						self.state = 4;
						self.timer.restart(tick, self.delay, self.time);
						tick(elapsed);
					}
				});
				self.state = 2;
				self.on.call("start", node, node.__data__, self.index, self.group);
				if (self.state !== 2) return;
				self.state = 3;
				tween = new Array(n = self.tween.length);
				for (i = 0, j = -1; i < n; ++i) if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) tween[++j] = o;
				tween.length = j + 1;
			}
			function tick(elapsed) {
				var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = 5, 1), i = -1, n = tween.length;
				while (++i < n) tween[i].call(node, t);
				if (self.state === 5) {
					self.on.call("end", node, node.__data__, self.index, self.group);
					stop();
				}
			}
			function stop() {
				self.state = 6;
				self.timer.stop();
				delete schedules[id];
				for (var i in schedules) return;
				delete node.__transition;
			}
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/interrupt.js
		function interrupt_default$1(node, name) {
			var schedules = node.__transition, schedule, active, empty = true, i;
			if (!schedules) return;
			name = name == null ? null : name + "";
			for (i in schedules) {
				if ((schedule = schedules[i]).name !== name) {
					empty = false;
					continue;
				}
				active = schedule.state > 2 && schedule.state < 5;
				schedule.state = 6;
				schedule.timer.stop();
				schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
				delete schedules[i];
			}
			if (empty) delete node.__transition;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/selection/interrupt.js
		function interrupt_default(name) {
			return this.each(function() {
				interrupt_default$1(this, name);
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/tween.js
		function tweenRemove(id, name) {
			var tween0, tween1;
			return function() {
				var schedule = set(this, id), tween = schedule.tween;
				if (tween !== tween0) {
					tween1 = tween0 = tween;
					for (var i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
						tween1 = tween1.slice();
						tween1.splice(i, 1);
						break;
					}
				}
				schedule.tween = tween1;
			};
		}
		function tweenFunction(id, name, value) {
			var tween0, tween1;
			if (typeof value !== "function") throw new Error();
			return function() {
				var schedule = set(this, id), tween = schedule.tween;
				if (tween !== tween0) {
					tween1 = (tween0 = tween).slice();
					for (var t = {
						name,
						value
					}, i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
						tween1[i] = t;
						break;
					}
					if (i === n) tween1.push(t);
				}
				schedule.tween = tween1;
			};
		}
		function tween_default(name, value) {
			var id = this._id;
			name += "";
			if (arguments.length < 2) {
				var tween = get(this.node(), id).tween;
				for (var i = 0, n = tween.length, t; i < n; ++i) if ((t = tween[i]).name === name) return t.value;
				return null;
			}
			return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
		}
		function tweenValue(transition, name, value) {
			var id = transition._id;
			transition.each(function() {
				var schedule = set(this, id);
				(schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
			});
			return function(node) {
				return get(node, id).value[name];
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/interpolate.js
		function interpolate_default(a, b) {
			var c;
			return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/attr.js
		function attrRemove(name) {
			return function() {
				this.removeAttribute(name);
			};
		}
		function attrRemoveNS(fullname) {
			return function() {
				this.removeAttributeNS(fullname.space, fullname.local);
			};
		}
		function attrConstant(name, interpolate, value1) {
			var string00, string1 = value1 + "", interpolate0;
			return function() {
				var string0 = this.getAttribute(name);
				return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
			};
		}
		function attrConstantNS(fullname, interpolate, value1) {
			var string00, string1 = value1 + "", interpolate0;
			return function() {
				var string0 = this.getAttributeNS(fullname.space, fullname.local);
				return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
			};
		}
		function attrFunction(name, interpolate, value) {
			var string00, string10, interpolate0;
			return function() {
				var string0, value1 = value(this), string1;
				if (value1 == null) return void this.removeAttribute(name);
				string0 = this.getAttribute(name);
				string1 = value1 + "";
				return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
			};
		}
		function attrFunctionNS(fullname, interpolate, value) {
			var string00, string10, interpolate0;
			return function() {
				var string0, value1 = value(this), string1;
				if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
				string0 = this.getAttributeNS(fullname.space, fullname.local);
				string1 = value1 + "";
				return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
			};
		}
		function attr_default(name, value) {
			var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
			return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname) : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/attrTween.js
		function attrInterpolate(name, i) {
			return function(t) {
				this.setAttribute(name, i.call(this, t));
			};
		}
		function attrInterpolateNS(fullname, i) {
			return function(t) {
				this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
			};
		}
		function attrTweenNS(fullname, value) {
			var t0, i0;
			function tween() {
				var i = value.apply(this, arguments);
				if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
				return t0;
			}
			tween._value = value;
			return tween;
		}
		function attrTween(name, value) {
			var t0, i0;
			function tween() {
				var i = value.apply(this, arguments);
				if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
				return t0;
			}
			tween._value = value;
			return tween;
		}
		function attrTween_default(name, value) {
			var key = "attr." + name;
			if (arguments.length < 2) return (key = this.tween(key)) && key._value;
			if (value == null) return this.tween(key, null);
			if (typeof value !== "function") throw new Error();
			var fullname = namespace_default(name);
			return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/delay.js
		function delayFunction(id, value) {
			return function() {
				init(this, id).delay = +value.apply(this, arguments);
			};
		}
		function delayConstant(id, value) {
			return value = +value, function() {
				init(this, id).delay = value;
			};
		}
		function delay_default(value) {
			var id = this._id;
			return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id, value)) : get(this.node(), id).delay;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/duration.js
		function durationFunction(id, value) {
			return function() {
				set(this, id).duration = +value.apply(this, arguments);
			};
		}
		function durationConstant(id, value) {
			return value = +value, function() {
				set(this, id).duration = value;
			};
		}
		function duration_default(value) {
			var id = this._id;
			return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id, value)) : get(this.node(), id).duration;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/ease.js
		function easeConstant(id, value) {
			if (typeof value !== "function") throw new Error();
			return function() {
				set(this, id).ease = value;
			};
		}
		function ease_default(value) {
			var id = this._id;
			return arguments.length ? this.each(easeConstant(id, value)) : get(this.node(), id).ease;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/easeVarying.js
		function easeVarying(id, value) {
			return function() {
				var v = value.apply(this, arguments);
				if (typeof v !== "function") throw new Error();
				set(this, id).ease = v;
			};
		}
		function easeVarying_default(value) {
			if (typeof value !== "function") throw new Error();
			return this.each(easeVarying(this._id, value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/filter.js
		function filter_default(match) {
			if (typeof match !== "function") match = matcher_default(match);
			for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group[i]) && match.call(node, node.__data__, i, group)) subgroup.push(node);
			return new Transition(subgroups, this._parents, this._name, this._id);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/merge.js
		function merge_default(transition) {
			if (transition._id !== this._id) throw new Error();
			for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge[i] = node;
			for (; j < m0; ++j) merges[j] = groups0[j];
			return new Transition(merges, this._parents, this._name, this._id);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/on.js
		function start(name) {
			return (name + "").trim().split(/^|\s+/).every(function(t) {
				var i = t.indexOf(".");
				if (i >= 0) t = t.slice(0, i);
				return !t || t === "start";
			});
		}
		function onFunction(id, name, listener) {
			var on0, on1, sit = start(name) ? init : set;
			return function() {
				var schedule = sit(this, id), on = schedule.on;
				if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
				schedule.on = on1;
			};
		}
		function on_default(name, listener) {
			var id = this._id;
			return arguments.length < 2 ? get(this.node(), id).on.on(name) : this.each(onFunction(id, name, listener));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/remove.js
		function removeFunction(id) {
			return function() {
				var parent = this.parentNode;
				for (var i in this.__transition) if (+i !== id) return;
				if (parent) parent.removeChild(this);
			};
		}
		function remove_default() {
			return this.on("end.remove", removeFunction(this._id));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/select.js
		function select_default(select) {
			var name = this._name, id = this._id;
			if (typeof select !== "function") select = selector_default(select);
			for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
				if ("__data__" in node) subnode.__data__ = node.__data__;
				subgroup[i] = subnode;
				schedule_default(subgroup[i], name, id, i, subgroup, get(node, id));
			}
			return new Transition(subgroups, this._parents, name, id);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/selectAll.js
		function selectAll_default(select) {
			var name = this._name, id = this._id;
			if (typeof select !== "function") select = selectorAll_default(select);
			for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
				for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) if (child = children[k]) schedule_default(child, name, id, k, children, inherit);
				subgroups.push(children);
				parents.push(node);
			}
			return new Transition(subgroups, parents, name, id);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/selection.js
		var Selection = selection.prototype.constructor;
		function selection_default() {
			return new Selection(this._groups, this._parents);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/style.js
		function styleNull(name, interpolate) {
			var string00, string10, interpolate0;
			return function() {
				var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
				return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
			};
		}
		function styleRemove(name) {
			return function() {
				this.style.removeProperty(name);
			};
		}
		function styleConstant(name, interpolate, value1) {
			var string00, string1 = value1 + "", interpolate0;
			return function() {
				var string0 = styleValue(this, name);
				return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
			};
		}
		function styleFunction(name, interpolate, value) {
			var string00, string10, interpolate0;
			return function() {
				var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
				if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
				return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
			};
		}
		function styleMaybeRemove(id, name) {
			var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
			return function() {
				var schedule = set(this, id), on = schedule.on, listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : void 0;
				if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
				schedule.on = on1;
			};
		}
		function style_default(name, value, priority) {
			var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
			return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove(name)) : typeof value === "function" ? this.styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant(name, i, value), priority).on("end.style." + name, null);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/styleTween.js
		function styleInterpolate(name, i, priority) {
			return function(t) {
				this.style.setProperty(name, i.call(this, t), priority);
			};
		}
		function styleTween(name, value, priority) {
			var t, i0;
			function tween() {
				var i = value.apply(this, arguments);
				if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
				return t;
			}
			tween._value = value;
			return tween;
		}
		function styleTween_default(name, value, priority) {
			var key = "style." + (name += "");
			if (arguments.length < 2) return (key = this.tween(key)) && key._value;
			if (value == null) return this.tween(key, null);
			if (typeof value !== "function") throw new Error();
			return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/text.js
		function textConstant(value) {
			return function() {
				this.textContent = value;
			};
		}
		function textFunction(value) {
			return function() {
				var value1 = value(this);
				this.textContent = value1 == null ? "" : value1;
			};
		}
		function text_default(value) {
			return this.tween("text", typeof value === "function" ? textFunction(tweenValue(this, "text", value)) : textConstant(value == null ? "" : value + ""));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/textTween.js
		function textInterpolate(i) {
			return function(t) {
				this.textContent = i.call(this, t);
			};
		}
		function textTween(value) {
			var t0, i0;
			function tween() {
				var i = value.apply(this, arguments);
				if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
				return t0;
			}
			tween._value = value;
			return tween;
		}
		function textTween_default(value) {
			var key = "text";
			if (arguments.length < 1) return (key = this.tween(key)) && key._value;
			if (value == null) return this.tween(key, null);
			if (typeof value !== "function") throw new Error();
			return this.tween(key, textTween(value));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/transition.js
		function transition_default$1() {
			var name = this._name, id0 = this._id, id1 = newId();
			for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
				var inherit = get(node, id0);
				schedule_default(node, name, id1, i, group, {
					time: inherit.time + inherit.delay + inherit.duration,
					delay: 0,
					duration: inherit.duration,
					ease: inherit.ease
				});
			}
			return new Transition(groups, this._parents, name, id1);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/end.js
		function end_default() {
			var on0, on1, that = this, id = that._id, size = that.size();
			return new Promise(function(resolve, reject) {
				var cancel = { value: reject }, end = { value: function() {
					if (--size === 0) resolve();
				} };
				that.each(function() {
					var schedule = set(this, id), on = schedule.on;
					if (on !== on0) {
						on1 = (on0 = on).copy();
						on1._.cancel.push(cancel);
						on1._.interrupt.push(cancel);
						on1._.end.push(end);
					}
					schedule.on = on1;
				});
				if (size === 0) resolve();
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/transition/index.js
		var id = 0;
		function Transition(groups, parents, name, id) {
			this._groups = groups;
			this._parents = parents;
			this._name = name;
			this._id = id;
		}
		function transition(name) {
			return selection().transition(name);
		}
		function newId() {
			return ++id;
		}
		var selection_prototype = selection.prototype;
		Transition.prototype = transition.prototype = {
			constructor: Transition,
			select: select_default,
			selectAll: selectAll_default,
			selectChild: selection_prototype.selectChild,
			selectChildren: selection_prototype.selectChildren,
			filter: filter_default,
			merge: merge_default,
			selection: selection_default,
			transition: transition_default$1,
			call: selection_prototype.call,
			nodes: selection_prototype.nodes,
			node: selection_prototype.node,
			size: selection_prototype.size,
			empty: selection_prototype.empty,
			each: selection_prototype.each,
			on: on_default,
			attr: attr_default,
			attrTween: attrTween_default,
			style: style_default,
			styleTween: styleTween_default,
			text: text_default,
			textTween: textTween_default,
			remove: remove_default,
			tween: tween_default,
			delay: delay_default,
			duration: duration_default,
			ease: ease_default,
			easeVarying: easeVarying_default,
			end: end_default,
			[Symbol.iterator]: selection_prototype[Symbol.iterator]
		};
		//#endregion
		//#region ../../node_modules/.pnpm/d3-ease@3.0.1/node_modules/d3-ease/src/cubic.js
		function cubicInOut(t) {
			return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/selection/transition.js
		var defaultTiming = {
			time: null,
			delay: 0,
			duration: 250,
			ease: cubicInOut
		};
		function inherit(node, id) {
			var timing;
			while (!(timing = node.__transition) || !(timing = timing[id])) if (!(node = node.parentNode)) throw new Error(`transition ${id} not found`);
			return timing;
		}
		function transition_default(name) {
			var id, timing;
			if (name instanceof Transition) id = name._id, name = name._name;
			else id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
			for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) schedule_default(node, name, id, i, group, timing || inherit(node, id));
			return new Transition(groups, this._parents, name, id);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-transition@3.0.1_d3-selection@3.0.0/node_modules/d3-transition/src/selection/index.js
		selection.prototype.interrupt = interrupt_default;
		selection.prototype.transition = transition_default;
		//#endregion
		//#region ../../node_modules/.pnpm/d3-zoom@3.0.0/node_modules/d3-zoom/src/constant.js
		var constant_default = (x) => () => x;
		//#endregion
		//#region ../../node_modules/.pnpm/d3-zoom@3.0.0/node_modules/d3-zoom/src/event.js
		function ZoomEvent(type, { sourceEvent, target, transform, dispatch }) {
			Object.defineProperties(this, {
				type: {
					value: type,
					enumerable: true,
					configurable: true
				},
				sourceEvent: {
					value: sourceEvent,
					enumerable: true,
					configurable: true
				},
				target: {
					value: target,
					enumerable: true,
					configurable: true
				},
				transform: {
					value: transform,
					enumerable: true,
					configurable: true
				},
				_: { value: dispatch }
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-zoom@3.0.0/node_modules/d3-zoom/src/transform.js
		function Transform(k, x, y) {
			this.k = k;
			this.x = x;
			this.y = y;
		}
		Transform.prototype = {
			constructor: Transform,
			scale: function(k) {
				return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
			},
			translate: function(x, y) {
				return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
			},
			apply: function(point) {
				return [point[0] * this.k + this.x, point[1] * this.k + this.y];
			},
			applyX: function(x) {
				return x * this.k + this.x;
			},
			applyY: function(y) {
				return y * this.k + this.y;
			},
			invert: function(location) {
				return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
			},
			invertX: function(x) {
				return (x - this.x) / this.k;
			},
			invertY: function(y) {
				return (y - this.y) / this.k;
			},
			rescaleX: function(x) {
				return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
			},
			rescaleY: function(y) {
				return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
			},
			toString: function() {
				return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
			}
		};
		var identity$1 = new Transform(1, 0, 0);
		transform.prototype = Transform.prototype;
		function transform(node) {
			while (!node.__zoom) if (!(node = node.parentNode)) return identity$1;
			return node.__zoom;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-zoom@3.0.0/node_modules/d3-zoom/src/noevent.js
		function nopropagation(event) {
			event.stopImmediatePropagation();
		}
		function noevent_default(event) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
		//#endregion
		//#region ../../node_modules/.pnpm/d3-zoom@3.0.0/node_modules/d3-zoom/src/zoom.js
		function defaultFilter(event) {
			return (!event.ctrlKey || event.type === "wheel") && !event.button;
		}
		function defaultExtent() {
			var e = this;
			if (e instanceof SVGElement) {
				e = e.ownerSVGElement || e;
				if (e.hasAttribute("viewBox")) {
					e = e.viewBox.baseVal;
					return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
				}
				return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
			}
			return [[0, 0], [e.clientWidth, e.clientHeight]];
		}
		function defaultTransform() {
			return this.__zoom || identity$1;
		}
		function defaultWheelDelta(event) {
			return -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002) * (event.ctrlKey ? 10 : 1);
		}
		function defaultTouchable() {
			return navigator.maxTouchPoints || "ontouchstart" in this;
		}
		function defaultConstrain(transform, extent, translateExtent) {
			var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0], dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0], dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1], dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
			return transform.translate(dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1), dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1));
		}
		function zoom_default() {
			var filter = defaultFilter, extent = defaultExtent, constrain = defaultConstrain, wheelDelta = defaultWheelDelta, touchable = defaultTouchable, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate = zoom_default$1, listeners = dispatch("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
			function zoom(selection) {
				selection.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
			}
			zoom.transform = function(collection, transform, point, event) {
				var selection = collection.selection ? collection.selection() : collection;
				selection.property("__zoom", defaultTransform);
				if (collection !== selection) schedule(collection, transform, point, event);
				else selection.interrupt().each(function() {
					gesture(this, arguments).event(event).start().zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform).end();
				});
			};
			zoom.scaleBy = function(selection, k, p, event) {
				zoom.scaleTo(selection, function() {
					return this.__zoom.k * (typeof k === "function" ? k.apply(this, arguments) : k);
				}, p, event);
			};
			zoom.scaleTo = function(selection, k, p, event) {
				zoom.transform(selection, function() {
					var e = extent.apply(this, arguments), t0 = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t0.invert(p0), k1 = typeof k === "function" ? k.apply(this, arguments) : k;
					return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
				}, p, event);
			};
			zoom.translateBy = function(selection, x, y, event) {
				zoom.transform(selection, function() {
					return constrain(this.__zoom.translate(typeof x === "function" ? x.apply(this, arguments) : x, typeof y === "function" ? y.apply(this, arguments) : y), extent.apply(this, arguments), translateExtent);
				}, null, event);
			};
			zoom.translateTo = function(selection, x, y, p, event) {
				zoom.transform(selection, function() {
					var e = extent.apply(this, arguments), t = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
					return constrain(identity$1.translate(p0[0], p0[1]).scale(t.k).translate(typeof x === "function" ? -x.apply(this, arguments) : -x, typeof y === "function" ? -y.apply(this, arguments) : -y), e, translateExtent);
				}, p, event);
			};
			function scale(transform, k) {
				k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
				return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
			}
			function translate(transform, p0, p1) {
				var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
				return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
			}
			function centroid(extent) {
				return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
			}
			function schedule(transition, transform, point, event) {
				transition.on("start.zoom", function() {
					gesture(this, arguments).event(event).start();
				}).on("interrupt.zoom end.zoom", function() {
					gesture(this, arguments).event(event).end();
				}).tween("zoom", function() {
					var that = this, args = arguments, g = gesture(that, args).event(event), e = extent.apply(that, args), p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a = that.__zoom, b = typeof transform === "function" ? transform.apply(that, args) : transform, i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
					return function(t) {
						if (t === 1) t = b;
						else {
							var l = i(t), k = w / l[2];
							t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k);
						}
						g.zoom(null, t);
					};
				});
			}
			function gesture(that, args, clean) {
				return !clean && that.__zooming || new Gesture(that, args);
			}
			function Gesture(that, args) {
				this.that = that;
				this.args = args;
				this.active = 0;
				this.sourceEvent = null;
				this.extent = extent.apply(that, args);
				this.taps = 0;
			}
			Gesture.prototype = {
				event: function(event) {
					if (event) this.sourceEvent = event;
					return this;
				},
				start: function() {
					if (++this.active === 1) {
						this.that.__zooming = this;
						this.emit("start");
					}
					return this;
				},
				zoom: function(key, transform) {
					if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
					if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
					if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
					this.that.__zoom = transform;
					this.emit("zoom");
					return this;
				},
				end: function() {
					if (--this.active === 0) {
						delete this.that.__zooming;
						this.emit("end");
					}
					return this;
				},
				emit: function(type) {
					var d = select_default$1(this.that).datum();
					listeners.call(type, this.that, new ZoomEvent(type, {
						sourceEvent: this.sourceEvent,
						target: zoom,
						type,
						transform: this.that.__zoom,
						dispatch: listeners
					}), d);
				}
			};
			function wheeled(event, ...args) {
				if (!filter.apply(this, arguments)) return;
				var g = gesture(this, args).event(event), t = this.__zoom, k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))), p = pointer_default(event);
				if (g.wheel) {
					if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) g.mouse[1] = t.invert(g.mouse[0] = p);
					clearTimeout(g.wheel);
				} else if (t.k === k) return;
				else {
					g.mouse = [p, t.invert(p)];
					interrupt_default$1(this);
					g.start();
				}
				noevent_default(event);
				g.wheel = setTimeout(wheelidled, wheelDelay);
				g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
				function wheelidled() {
					g.wheel = null;
					g.end();
				}
			}
			function mousedowned(event, ...args) {
				if (touchending || !filter.apply(this, arguments)) return;
				var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v = select_default$1(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer_default(event, currentTarget), x0 = event.clientX, y0 = event.clientY;
				nodrag_default(event.view);
				nopropagation(event);
				g.mouse = [p, this.__zoom.invert(p)];
				interrupt_default$1(this);
				g.start();
				function mousemoved(event) {
					noevent_default(event);
					if (!g.moved) {
						var dx = event.clientX - x0, dy = event.clientY - y0;
						g.moved = dx * dx + dy * dy > clickDistance2;
					}
					g.event(event).zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer_default(event, currentTarget), g.mouse[1]), g.extent, translateExtent));
				}
				function mouseupped(event) {
					v.on("mousemove.zoom mouseup.zoom", null);
					yesdrag(event.view, g.moved);
					noevent_default(event);
					g.event(event).end();
				}
			}
			function dblclicked(event, ...args) {
				if (!filter.apply(this, arguments)) return;
				var t0 = this.__zoom, p0 = pointer_default(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t0.invert(p0), k1 = t0.k * (event.shiftKey ? .5 : 2), t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);
				noevent_default(event);
				if (duration > 0) select_default$1(this).transition().duration(duration).call(schedule, t1, p0, event);
				else select_default$1(this).call(zoom.transform, t1, p0, event);
			}
			function touchstarted(event, ...args) {
				if (!filter.apply(this, arguments)) return;
				var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
				nopropagation(event);
				for (i = 0; i < n; ++i) {
					t = touches[i], p = pointer_default(t, this);
					p = [
						p,
						this.__zoom.invert(p),
						t.identifier
					];
					if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
					else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
				}
				if (touchstarting) touchstarting = clearTimeout(touchstarting);
				if (started) {
					if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
						touchstarting = null;
					}, touchDelay);
					interrupt_default$1(this);
					g.start();
				}
			}
			function touchmoved(event, ...args) {
				if (!this.__zooming) return;
				var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
				noevent_default(event);
				for (i = 0; i < n; ++i) {
					t = touches[i], p = pointer_default(t, this);
					if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
					else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
				}
				t = g.that.__zoom;
				if (g.touch1) {
					var p0 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
					t = scale(t, Math.sqrt(dp / dl));
					p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
					l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
				} else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
				else return;
				g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
			}
			function touchended(event, ...args) {
				if (!this.__zooming) return;
				var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
				nopropagation(event);
				if (touchending) clearTimeout(touchending);
				touchending = setTimeout(function() {
					touchending = null;
				}, touchDelay);
				for (i = 0; i < n; ++i) {
					t = touches[i];
					if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
					else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
				}
				if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
				if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
				else {
					g.end();
					if (g.taps === 2) {
						t = pointer_default(t, this);
						if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
							var p = select_default$1(this).on("dblclick.zoom");
							if (p) p.apply(this, arguments);
						}
					}
				}
			}
			zoom.wheelDelta = function(_) {
				return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant_default(+_), zoom) : wheelDelta;
			};
			zoom.filter = function(_) {
				return arguments.length ? (filter = typeof _ === "function" ? _ : constant_default(!!_), zoom) : filter;
			};
			zoom.touchable = function(_) {
				return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default(!!_), zoom) : touchable;
			};
			zoom.extent = function(_) {
				return arguments.length ? (extent = typeof _ === "function" ? _ : constant_default([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
			};
			zoom.scaleExtent = function(_) {
				return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
			};
			zoom.translateExtent = function(_) {
				return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
			};
			zoom.constrain = function(_) {
				return arguments.length ? (constrain = _, zoom) : constrain;
			};
			zoom.duration = function(_) {
				return arguments.length ? (duration = +_, zoom) : duration;
			};
			zoom.interpolate = function(_) {
				return arguments.length ? (interpolate = _, zoom) : interpolate;
			};
			zoom.on = function() {
				var value = listeners.on.apply(listeners, arguments);
				return value === listeners ? zoom : value;
			};
			zoom.clickDistance = function(_) {
				return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
			};
			zoom.tapDistance = function(_) {
				return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
			};
			return zoom;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/@xyflow+system@0.0.83/node_modules/@xyflow/system/dist/esm/index.js
		const errorMessages = {
			error001: (lib = "react") => `Seems like you have not used ${lib === "svelte" ? "SvelteFlowProvider" : "ReactFlowProvider"} as an ancestor. Help: https://${lib}flow.dev/error#001`,
			error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
			error003: (nodeType) => `Node type "${nodeType}" not found. Using fallback type "default".`,
			error004: () => "The parent container needs a width and a height to render the graph.",
			error005: () => "Only child nodes can use a parent extent.",
			error006: () => "Can't create edge. An edge needs a source and a target.",
			error007: (id) => `The old edge with id=${id} does not exist.`,
			error009: (type) => `Marker type "${type}" doesn't exist.`,
			error008: (handleType, { id, sourceHandle, targetHandle }) => `Couldn't create edge for ${handleType} handle id: "${handleType === "source" ? sourceHandle : targetHandle}", edge id: ${id}.`,
			error010: () => "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
			error011: (edgeType) => `Edge type "${edgeType}" not found. Using fallback type "default".`,
			error012: (id) => `Node with id "${id}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
			error013: (lib = "react") => `It seems that you haven't loaded the styles. Please import '@xyflow/${lib}/dist/style.css' or base.css to make sure everything is working properly.`,
			error014: () => "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
			error015: () => "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs.",
			error016: (id) => `Edge with id "${id}" does not exist, it may have been removed. This can happen when an edge is deleted before the "onEdgeClick" handler is called.`
		};
		const infiniteExtent = [[Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY], [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]];
		const elementSelectionKeys = [
			"Enter",
			" ",
			"Escape"
		];
		const defaultAriaLabelConfig = {
			"node.a11yDescription.default": "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
			"node.a11yDescription.keyboardDisabled": "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
			"node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) => `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
			"edge.a11yDescription.default": "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
			"controls.ariaLabel": "Control Panel",
			"controls.zoomIn.ariaLabel": "Zoom In",
			"controls.zoomOut.ariaLabel": "Zoom Out",
			"controls.fitView.ariaLabel": "Fit View",
			"controls.interactive.ariaLabel": "Toggle Interactivity",
			"minimap.ariaLabel": "Mini Map",
			"handle.ariaLabel": "Handle"
		};
		/**
		* The `ConnectionMode` is used to set the mode of connection between nodes.
		* The `Strict` mode is the default one and only allows source to target edges.
		* `Loose` mode allows source to source and target to target edges as well.
		*
		* @public
		*/
		var ConnectionMode;
		(function(ConnectionMode) {
			ConnectionMode["Strict"] = "strict";
			ConnectionMode["Loose"] = "loose";
		})(ConnectionMode || (ConnectionMode = {}));
		/**
		* This enum is used to set the different modes of panning the viewport when the
		* user scrolls. The `Free` mode allows the user to pan in any direction by scrolling
		* with a device like a trackpad. The `Vertical` and `Horizontal` modes restrict
		* scroll panning to only the vertical or horizontal axis, respectively.
		*
		* @public
		*/
		var PanOnScrollMode;
		(function(PanOnScrollMode) {
			PanOnScrollMode["Free"] = "free";
			PanOnScrollMode["Vertical"] = "vertical";
			PanOnScrollMode["Horizontal"] = "horizontal";
		})(PanOnScrollMode || (PanOnScrollMode = {}));
		var SelectionMode;
		(function(SelectionMode) {
			SelectionMode["Partial"] = "partial";
			SelectionMode["Full"] = "full";
		})(SelectionMode || (SelectionMode = {}));
		const initialConnection = {
			inProgress: false,
			isValid: null,
			from: null,
			fromHandle: null,
			fromPosition: null,
			fromNode: null,
			to: null,
			toHandle: null,
			toPosition: null,
			toNode: null,
			pointer: null
		};
		/**
		* If you set the `connectionLineType` prop on your [`<ReactFlow />`](/api-reference/react-flow#connection-connectionLineType)
		*component, it will dictate the style of connection line rendered when creating
		*new edges.
		*
		* @public
		*
		* @remarks If you choose to render a custom connection line component, this value will be
		*passed to your component as part of its [`ConnectionLineComponentProps`](/api-reference/types/connection-line-component-props).
		*/
		var ConnectionLineType;
		(function(ConnectionLineType) {
			ConnectionLineType["Bezier"] = "default";
			ConnectionLineType["Straight"] = "straight";
			ConnectionLineType["Step"] = "step";
			ConnectionLineType["SmoothStep"] = "smoothstep";
			ConnectionLineType["SimpleBezier"] = "simplebezier";
		})(ConnectionLineType || (ConnectionLineType = {}));
		/**
		* Edges may optionally have a marker on either end. The MarkerType type enumerates
		* the options available to you when configuring a given marker.
		*
		* @public
		*/
		var MarkerType;
		(function(MarkerType) {
			MarkerType["Arrow"] = "arrow";
			MarkerType["ArrowClosed"] = "arrowclosed";
		})(MarkerType || (MarkerType = {}));
		/**
		* While [`PanelPosition`](/api-reference/types/panel-position) can be used to place a
		* component in the corners of a container, the `Position` enum is less precise and used
		* primarily in relation to edges and handles.
		*
		* @public
		*/
		var Position;
		(function(Position) {
			Position["Left"] = "left";
			Position["Top"] = "top";
			Position["Right"] = "right";
			Position["Bottom"] = "bottom";
		})(Position || (Position = {}));
		const oppositePosition = {
			[Position.Left]: Position.Right,
			[Position.Right]: Position.Left,
			[Position.Top]: Position.Bottom,
			[Position.Bottom]: Position.Top
		};
		/**
		* Test whether an object is usable as an Edge
		* @public
		* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
		* @param element - The element to test
		* @returns A boolean indicating whether the element is an Edge
		*/
		const isEdgeBase = (element) => !!element && typeof element === "object" && "id" in element && "source" in element && "target" in element;
		/**
		* Test whether an object is usable as a Node
		* @public
		* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
		* @param element - The element to test
		* @returns A boolean indicating whether the element is an Node
		*/
		const isNodeBase = (element) => !!element && typeof element === "object" && "id" in element && "position" in element && !("source" in element) && !("target" in element);
		const isInternalNodeBase = (element) => !!element && typeof element === "object" && "id" in element && "internals" in element && !("source" in element) && !("target" in element);
		const getNodePositionWithOrigin = (node, nodeOrigin = [0, 0]) => {
			const { width, height } = getNodeDimensions(node);
			const origin = node.origin ?? nodeOrigin;
			const offsetX = width * origin[0];
			const offsetY = height * origin[1];
			return {
				x: node.position.x - offsetX,
				y: node.position.y - offsetY
			};
		};
		/**
		* Returns the bounding box that contains all the given nodes in an array. This can
		* be useful when combined with [`getViewportForBounds`](/api-reference/utils/get-viewport-for-bounds)
		* to calculate the correct transform to fit the given nodes in a viewport.
		* @public
		* @remarks Useful when combined with {@link getViewportForBounds} to calculate the correct transform to fit the given nodes in a viewport.
		* @param nodes - Nodes to calculate the bounds for.
		* @returns Bounding box enclosing all nodes.
		*
		* @remarks This function was previously called `getRectOfNodes`
		*
		* @example
		* ```js
		*import { getNodesBounds } from '@xyflow/react';
		*
		*const nodes = [
		*  {
		*    id: 'a',
		*    position: { x: 0, y: 0 },
		*    data: { label: 'a' },
		*    width: 50,
		*    height: 25,
		*  },
		*  {
		*    id: 'b',
		*    position: { x: 100, y: 100 },
		*    data: { label: 'b' },
		*    width: 50,
		*    height: 25,
		*  },
		*];
		*
		*const bounds = getNodesBounds(nodes);
		*```
		*/
		const getNodesBounds = (nodes, params = { nodeOrigin: [0, 0] }) => {
			if (nodes.length === 0) return {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			};
			let hasNode = false;
			const box = nodes.reduce((currBox, nodeOrId) => {
				const isId = typeof nodeOrId === "string";
				let currentNode = !params.nodeLookup && !isId ? nodeOrId : void 0;
				if (params.nodeLookup) currentNode = isId ? params.nodeLookup.get(nodeOrId) : !isInternalNodeBase(nodeOrId) ? params.nodeLookup.get(nodeOrId.id) : nodeOrId;
				if (!currentNode) return currBox;
				hasNode = true;
				return getBoundsOfBoxes(currBox, nodeToBox(currentNode, params.nodeOrigin));
			}, {
				x: Infinity,
				y: Infinity,
				x2: -Infinity,
				y2: -Infinity
			});
			return hasNode ? boxToRect(box) : {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			};
		};
		/**
		* Determines a bounding box that contains all given nodes in an array
		* @internal
		*/
		const getInternalNodesBounds = (nodeLookup, params = {}) => {
			let box = {
				x: Infinity,
				y: Infinity,
				x2: -Infinity,
				y2: -Infinity
			};
			let hasVisibleNodes = false;
			nodeLookup.forEach((node) => {
				if (params.filter === void 0 || params.filter(node)) {
					box = getBoundsOfBoxes(box, nodeToBox(node));
					hasVisibleNodes = true;
				}
			});
			return hasVisibleNodes ? boxToRect(box) : {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			};
		};
		const getNodesInside = (nodes, rect, [tx, ty, tScale] = [
			0,
			0,
			1
		], partially = false, excludeNonSelectableNodes = false) => {
			const paneX = (rect.x - tx) / tScale;
			const paneY = (rect.y - ty) / tScale;
			const paneWidth = rect.width / tScale;
			const paneHeight = rect.height / tScale;
			const visibleNodes = [];
			for (const node of nodes.values()) {
				const { measured, selectable = true, hidden = false } = node;
				if (excludeNonSelectableNodes && !selectable || hidden) continue;
				const width = measured.width ?? node.width ?? node.initialWidth ?? 0;
				const height = measured.height ?? node.height ?? node.initialHeight ?? 0;
				const { x, y } = node.internals.positionAbsolute;
				const overlappingArea = getRectsOverlappingArea(paneX, paneY, paneWidth, paneHeight, x, y, width, height);
				const area = width * height;
				const partiallyVisible = partially && overlappingArea > 0;
				if (!node.internals.handleBounds || partiallyVisible || overlappingArea >= area || node.dragging) visibleNodes.push(node);
			}
			return visibleNodes;
		};
		/**
		* This utility filters an array of edges, keeping only those where either the source or target
		* node is present in the given array of nodes.
		* @public
		* @param nodes - Nodes you want to get the connected edges for.
		* @param edges - All edges.
		* @returns Array of edges that connect any of the given nodes with each other.
		*
		* @example
		* ```js
		*import { getConnectedEdges } from '@xyflow/react';
		*
		*const nodes = [
		*  { id: 'a', position: { x: 0, y: 0 } },
		*  { id: 'b', position: { x: 100, y: 0 } },
		*];
		*
		*const edges = [
		*  { id: 'a->c', source: 'a', target: 'c' },
		*  { id: 'c->d', source: 'c', target: 'd' },
		*];
		*
		*const connectedEdges = getConnectedEdges(nodes, edges);
		* // => [{ id: 'a->c', source: 'a', target: 'c' }]
		*```
		*/
		const getConnectedEdges = (nodes, edges) => {
			const nodeIds = /* @__PURE__ */ new Set();
			nodes.forEach((node) => {
				nodeIds.add(node.id);
			});
			return edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
		};
		function getFitViewNodes(nodeLookup, options) {
			const fitViewNodes = /* @__PURE__ */ new Map();
			const optionNodeIds = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
			nodeLookup.forEach((n) => {
				let isVisible;
				if (options?.includeHiddenNodes) {
					const { width, height } = getNodeDimensions(n);
					isVisible = width > 0 && height > 0;
				} else isVisible = Boolean(n.measured.width && n.measured.height && !n.hidden);
				if (isVisible && (!optionNodeIds || optionNodeIds.has(n.id))) fitViewNodes.set(n.id, n);
			});
			return fitViewNodes;
		}
		async function fitViewport({ nodes, width, height, panZoom, minZoom, maxZoom }, options) {
			if (nodes.size === 0) return true;
			const viewport = getViewportForBounds(getInternalNodesBounds(getFitViewNodes(nodes, options)), width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? .1);
			await panZoom.setViewport(viewport, {
				duration: options?.duration,
				ease: options?.ease,
				interpolate: options?.interpolate
			});
			return true;
		}
		/**
		* This function calculates the next position of a node, taking into account the node's extent, parent node, and origin.
		*
		* @internal
		* @returns position, positionAbsolute
		*/
		function calculateNodePosition({ nodeId, nextPosition, nodeLookup, nodeOrigin = [0, 0], nodeExtent, onError }) {
			const node = nodeLookup.get(nodeId);
			const parentNode = node.parentId ? nodeLookup.get(node.parentId) : void 0;
			const { x: parentX, y: parentY } = parentNode ? parentNode.internals.positionAbsolute : {
				x: 0,
				y: 0
			};
			const origin = node.origin ?? nodeOrigin;
			let extent = node.extent || nodeExtent;
			if (node.extent === "parent" && !node.expandParent) if (!parentNode) onError?.("005", errorMessages["error005"]());
			else {
				const { width: parentWidth, height: parentHeight } = getNodeDimensions(parentNode);
				if (parentWidth && parentHeight) extent = [[parentX, parentY], [parentX + parentWidth, parentY + parentHeight]];
			}
			else if (parentNode && isCoordinateExtent(node.extent)) extent = [[node.extent[0][0] + parentX, node.extent[0][1] + parentY], [node.extent[1][0] + parentX, node.extent[1][1] + parentY]];
			const positionAbsolute = isCoordinateExtent(extent) ? clampPosition(nextPosition, extent, node.measured) : nextPosition;
			if (node.measured.width === void 0 || node.measured.height === void 0) onError?.("015", errorMessages["error015"]());
			return {
				position: {
					x: positionAbsolute.x - parentX + (node.measured.width ?? 0) * origin[0],
					y: positionAbsolute.y - parentY + (node.measured.height ?? 0) * origin[1]
				},
				positionAbsolute
			};
		}
		/**
		* Pass in nodes & edges to delete, get arrays of nodes and edges that actually can be deleted
		* @internal
		* @param param.nodesToRemove - The nodes to remove
		* @param param.edgesToRemove - The edges to remove
		* @param param.nodes - All nodes
		* @param param.edges - All edges
		* @param param.onBeforeDelete - Callback to check which nodes and edges can be deleted
		* @returns nodes: nodes that can be deleted, edges: edges that can be deleted
		*/
		async function getElementsToRemove({ nodesToRemove = [], edgesToRemove = [], nodes, edges, onBeforeDelete }) {
			const nodeIds = new Set(nodesToRemove.map((node) => node.id));
			const matchingNodes = [];
			for (const node of nodes) {
				if (node.deletable === false) continue;
				const isIncluded = nodeIds.has(node.id);
				const parentHit = !isIncluded && node.parentId && matchingNodes.find((n) => n.id === node.parentId);
				if (isIncluded || parentHit) matchingNodes.push(node);
			}
			const edgeIds = new Set(edgesToRemove.map((edge) => edge.id));
			const deletableEdges = edges.filter((edge) => edge.deletable !== false);
			const matchingEdges = getConnectedEdges(matchingNodes, deletableEdges);
			for (const edge of deletableEdges) if (edgeIds.has(edge.id) && !matchingEdges.find((e) => e.id === edge.id)) matchingEdges.push(edge);
			if (!onBeforeDelete) return {
				edges: matchingEdges,
				nodes: matchingNodes
			};
			const onBeforeDeleteResult = await onBeforeDelete({
				nodes: matchingNodes,
				edges: matchingEdges
			});
			if (typeof onBeforeDeleteResult === "boolean") return onBeforeDeleteResult ? {
				edges: matchingEdges,
				nodes: matchingNodes
			} : {
				edges: [],
				nodes: []
			};
			return onBeforeDeleteResult;
		}
		const clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);
		const clampPosition = (position = {
			x: 0,
			y: 0
		}, extent, dimensions) => ({
			x: clamp(position.x, extent[0][0], extent[1][0] - (dimensions?.width ?? 0)),
			y: clamp(position.y, extent[0][1], extent[1][1] - (dimensions?.height ?? 0))
		});
		function clampPositionToParent(childPosition, childDimensions, parent) {
			const { width: parentWidth, height: parentHeight } = getNodeDimensions(parent);
			const { x: parentX, y: parentY } = parent.internals.positionAbsolute;
			return clampPosition(childPosition, [[parentX, parentY], [parentX + parentWidth, parentY + parentHeight]], childDimensions);
		}
		/**
		* Calculates the velocity of panning when the mouse is close to the edge of the canvas
		* @internal
		* @param value - One dimensional poition of the mouse (x or y)
		* @param min - Minimal position on canvas before panning starts
		* @param max - Maximal position on canvas before panning starts
		* @returns - A number between 0 and 1 that represents the velocity of panning
		*/
		const calcAutoPanVelocity = (value, min, max) => {
			if (value < min) return clamp(Math.abs(value - min), 1, min) / min;
			else if (value > max) return -clamp(Math.abs(value - max), 1, min) / min;
			return 0;
		};
		const calcAutoPan = (pos, bounds, speed = 15, distance = 40) => {
			return [calcAutoPanVelocity(pos.x, distance, bounds.width - distance) * speed, calcAutoPanVelocity(pos.y, distance, bounds.height - distance) * speed];
		};
		const getBoundsOfBoxes = (box1, box2) => ({
			x: Math.min(box1.x, box2.x),
			y: Math.min(box1.y, box2.y),
			x2: Math.max(box1.x2, box2.x2),
			y2: Math.max(box1.y2, box2.y2)
		});
		const rectToBox = ({ x, y, width, height }) => ({
			x,
			y,
			x2: x + width,
			y2: y + height
		});
		const boxToRect = ({ x, y, x2, y2 }) => ({
			x,
			y,
			width: x2 - x,
			height: y2 - y
		});
		const nodeToRect = (node, nodeOrigin = [0, 0]) => {
			const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
			return {
				x,
				y,
				width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
				height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
			};
		};
		const nodeToBox = (node, nodeOrigin = [0, 0]) => {
			const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
			return {
				x,
				y,
				x2: x + (node.measured?.width ?? node.width ?? node.initialWidth ?? 0),
				y2: y + (node.measured?.height ?? node.height ?? node.initialHeight ?? 0)
			};
		};
		const getBoundsOfRects = (rect1, rect2) => boxToRect(getBoundsOfBoxes(rectToBox(rect1), rectToBox(rect2)));
		const getRectsOverlappingArea = (aX, aY, aWidth, aHeight, bX, bY, bWidth, bHeight) => {
			const xOverlap = Math.max(0, Math.min(aX + aWidth, bX + bWidth) - Math.max(aX, bX));
			const yOverlap = Math.max(0, Math.min(aY + aHeight, bY + bHeight) - Math.max(aY, bY));
			return Math.ceil(xOverlap * yOverlap);
		};
		const getOverlappingArea = (rectA, rectB) => getRectsOverlappingArea(rectA.x, rectA.y, rectA.width, rectA.height, rectB.x, rectB.y, rectB.width, rectB.height);
		const isRectObject = (obj) => isNumeric(obj.width) && isNumeric(obj.height) && isNumeric(obj.x) && isNumeric(obj.y);
		const isNumeric = (n) => !isNaN(n) && isFinite(n);
		const createDevWarn = (lib, helpUrl) => (id, message) => {};
		const snapPosition = (position, snapGrid = [1, 1]) => {
			return {
				x: snapGrid[0] * Math.round(position.x / snapGrid[0]),
				y: snapGrid[1] * Math.round(position.y / snapGrid[1])
			};
		};
		const pointToRendererPoint = ({ x, y }, [tx, ty, tScale], snapToGrid = false, snapGrid = [1, 1]) => {
			const position = {
				x: (x - tx) / tScale,
				y: (y - ty) / tScale
			};
			return snapToGrid ? snapPosition(position, snapGrid) : position;
		};
		const rendererPointToPoint = ({ x, y }, [tx, ty, tScale]) => {
			return {
				x: x * tScale + tx,
				y: y * tScale + ty
			};
		};
		/**
		* Parses a single padding value to a number
		* @internal
		* @param padding - Padding to parse
		* @param viewport - Width or height of the viewport
		* @returns The padding in pixels
		*/
		function parsePadding(padding, viewport) {
			if (typeof padding === "number") return Math.floor((viewport - viewport / (1 + padding)) * .5);
			if (typeof padding === "string" && padding.endsWith("px")) {
				const paddingValue = parseFloat(padding);
				if (!Number.isNaN(paddingValue)) return Math.floor(paddingValue);
			}
			if (typeof padding === "string" && padding.endsWith("%")) {
				const paddingValue = parseFloat(padding);
				if (!Number.isNaN(paddingValue)) return Math.floor(viewport * paddingValue * .01);
			}
			console.error(`The padding value "${padding}" is invalid. Please provide a number or a string with a valid unit (px or %).`);
			return 0;
		}
		/**
		* Parses the paddings to an object with top, right, bottom, left, x and y paddings
		* @internal
		* @param padding - Padding to parse
		* @param width - Width of the viewport
		* @param height - Height of the viewport
		* @returns An object with the paddings in pixels
		*/
		function parsePaddings(padding, width, height) {
			if (typeof padding === "string" || typeof padding === "number") {
				const paddingY = parsePadding(padding, height);
				const paddingX = parsePadding(padding, width);
				return {
					top: paddingY,
					right: paddingX,
					bottom: paddingY,
					left: paddingX,
					x: paddingX * 2,
					y: paddingY * 2
				};
			}
			if (typeof padding === "object") {
				const top = parsePadding(padding.top ?? padding.y ?? 0, height);
				const bottom = parsePadding(padding.bottom ?? padding.y ?? 0, height);
				const left = parsePadding(padding.left ?? padding.x ?? 0, width);
				const right = parsePadding(padding.right ?? padding.x ?? 0, width);
				return {
					top,
					right,
					bottom,
					left,
					x: left + right,
					y: top + bottom
				};
			}
			return {
				top: 0,
				right: 0,
				bottom: 0,
				left: 0,
				x: 0,
				y: 0
			};
		}
		/**
		* Calculates the resulting paddings if the new viewport is applied
		* @internal
		* @param bounds - Bounds to fit inside viewport
		* @param x - X position of the viewport
		* @param y - Y position of the viewport
		* @param zoom - Zoom level of the viewport
		* @param width - Width of the viewport
		* @param height - Height of the viewport
		* @returns An object with the minimum padding required to fit the bounds inside the viewport
		*/
		function calculateAppliedPaddings(bounds, x, y, zoom, width, height) {
			const { x: left, y: top } = rendererPointToPoint(bounds, [
				x,
				y,
				zoom
			]);
			const { x: boundRight, y: boundBottom } = rendererPointToPoint({
				x: bounds.x + bounds.width,
				y: bounds.y + bounds.height
			}, [
				x,
				y,
				zoom
			]);
			const right = width - boundRight;
			const bottom = height - boundBottom;
			return {
				left: Math.floor(left),
				top: Math.floor(top),
				right: Math.floor(right),
				bottom: Math.floor(bottom)
			};
		}
		/**
		* Returns a viewport that encloses the given bounds with padding.
		* @public
		* @remarks You can determine bounds of nodes with {@link getNodesBounds} and {@link getBoundsOfRects}
		* @param bounds - Bounds to fit inside viewport.
		* @param width - Width of the viewport.
		* @param height  - Height of the viewport.
		* @param minZoom - Minimum zoom level of the resulting viewport.
		* @param maxZoom - Maximum zoom level of the resulting viewport.
		* @param padding - Padding around the bounds.
		* @returns A transformed {@link Viewport} that encloses the given bounds which you can pass to e.g. {@link setViewport}.
		* @example
		* const { x, y, zoom } = getViewportForBounds(
		* { x: 0, y: 0, width: 100, height: 100},
		* 1200, 800, 0.5, 2);
		*/
		const getViewportForBounds = (bounds, width, height, minZoom, maxZoom, padding) => {
			const p = parsePaddings(padding, width, height);
			const xZoom = (width - p.x) / bounds.width;
			const yZoom = (height - p.y) / bounds.height;
			const clampedZoom = clamp(Math.min(xZoom, yZoom), minZoom, maxZoom);
			const boundsCenterX = bounds.x + bounds.width / 2;
			const boundsCenterY = bounds.y + bounds.height / 2;
			const x = width / 2 - boundsCenterX * clampedZoom;
			const y = height / 2 - boundsCenterY * clampedZoom;
			const newPadding = calculateAppliedPaddings(bounds, x, y, clampedZoom, width, height);
			const offset = {
				left: Math.min(newPadding.left - p.left, 0),
				top: Math.min(newPadding.top - p.top, 0),
				right: Math.min(newPadding.right - p.right, 0),
				bottom: Math.min(newPadding.bottom - p.bottom, 0)
			};
			return {
				x: x - offset.left + offset.right,
				y: y - offset.top + offset.bottom,
				zoom: clampedZoom
			};
		};
		const isMacOs = () => typeof navigator !== "undefined" && navigator?.userAgent?.indexOf("Mac") >= 0;
		function isCoordinateExtent(extent) {
			return extent !== void 0 && extent !== null && extent !== "parent";
		}
		function getNodeDimensions(node) {
			return {
				width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
				height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
			};
		}
		function nodeHasDimensions(node) {
			return (node.measured?.width ?? node.width ?? node.initialWidth) !== void 0 && (node.measured?.height ?? node.height ?? node.initialHeight) !== void 0;
		}
		/**
		* Convert child position to absolute position
		*
		* @internal
		* @param position
		* @param parentId
		* @param nodeLookup
		* @param nodeOrigin
		* @returns an internal node with an absolute position
		*/
		function evaluateAbsolutePosition(position, dimensions = {
			width: 0,
			height: 0
		}, parentId, nodeLookup, nodeOrigin) {
			const positionAbsolute = { ...position };
			const parent = nodeLookup.get(parentId);
			if (parent) {
				const origin = parent.origin || nodeOrigin;
				positionAbsolute.x += parent.internals.positionAbsolute.x - (dimensions.width ?? 0) * origin[0];
				positionAbsolute.y += parent.internals.positionAbsolute.y - (dimensions.height ?? 0) * origin[1];
			}
			return positionAbsolute;
		}
		function areSetsEqual(a, b) {
			if (a.size !== b.size) return false;
			for (const item of a) if (!b.has(item)) return false;
			return true;
		}
		/**
		* Polyfill for Promise.withResolvers until we can use it in all browsers
		* @internal
		*/
		function withResolvers() {
			let resolve;
			let reject;
			return {
				promise: new Promise((res, rej) => {
					resolve = res;
					reject = rej;
				}),
				resolve,
				reject
			};
		}
		function mergeAriaLabelConfig(partial) {
			return {
				...defaultAriaLabelConfig,
				...partial || {}
			};
		}
		function getConnectionStatus(isValid) {
			return isValid === null ? null : isValid ? "valid" : "invalid";
		}
		function getPointerPosition(event, { snapGrid = [0, 0], snapToGrid = false, transform, containerBounds }) {
			const { x, y } = getEventPosition(event);
			const pointerPos = pointToRendererPoint({
				x: x - (containerBounds?.left ?? 0),
				y: y - (containerBounds?.top ?? 0)
			}, transform);
			const { x: xSnapped, y: ySnapped } = snapToGrid ? snapPosition(pointerPos, snapGrid) : pointerPos;
			return {
				xSnapped,
				ySnapped,
				...pointerPos
			};
		}
		const getDimensions = (node) => ({
			width: node.offsetWidth,
			height: node.offsetHeight
		});
		const getHostForElement = (element) => element?.getRootNode?.() || window?.document;
		const inputTags = [
			"INPUT",
			"SELECT",
			"TEXTAREA"
		];
		function isInputDOMNode(event) {
			const target = event.composedPath?.()?.[0] || event.target;
			if (target?.nodeType !== 1) return false;
			return inputTags.includes(target.nodeName) || target.hasAttribute("contenteditable") || !!target.closest(".nokey");
		}
		const isMouseEvent = (event) => "clientX" in event;
		const getEventPosition = (event, bounds) => {
			const isMouse = isMouseEvent(event);
			const evtX = isMouse ? event.clientX : event.touches?.[0].clientX;
			const evtY = isMouse ? event.clientY : event.touches?.[0].clientY;
			return {
				x: evtX - (bounds?.left ?? 0),
				y: evtY - (bounds?.top ?? 0)
			};
		};
		const getHandleBounds = (type, nodeElement, nodeBounds, zoom, nodeId) => {
			const handles = nodeElement.querySelectorAll(`.${type}`);
			if (!handles || !handles.length) return null;
			return Array.from(handles).map((handle) => {
				const handleBounds = handle.getBoundingClientRect();
				return {
					id: handle.getAttribute("data-handleid"),
					type,
					nodeId,
					position: handle.getAttribute("data-handlepos"),
					x: (handleBounds.left - nodeBounds.left) / zoom,
					y: (handleBounds.top - nodeBounds.top) / zoom,
					...getDimensions(handle)
				};
			});
		};
		function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY }) {
			const centerX = sourceX * .125 + sourceControlX * .375 + targetControlX * .375 + targetX * .125;
			const centerY = sourceY * .125 + sourceControlY * .375 + targetControlY * .375 + targetY * .125;
			return [
				centerX,
				centerY,
				Math.abs(centerX - sourceX),
				Math.abs(centerY - sourceY)
			];
		}
		function calculateControlOffset(distance, curvature) {
			if (distance >= 0) return .5 * distance;
			return curvature * 25 * Math.sqrt(-distance);
		}
		function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
			switch (pos) {
				case Position.Left: return [x1 - calculateControlOffset(x1 - x2, c), y1];
				case Position.Right: return [x1 + calculateControlOffset(x2 - x1, c), y1];
				case Position.Top: return [x1, y1 - calculateControlOffset(y1 - y2, c)];
				case Position.Bottom: return [x1, y1 + calculateControlOffset(y2 - y1, c)];
			}
		}
		/**
		* The `getBezierPath` util returns everything you need to render a bezier edge
		*between two nodes.
		* @public
		* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
		* and `offsetX`, `offsetY` between source handle and label.
		* - `path`: the path to use in an SVG `<path>` element.
		* - `labelX`: the `x` position you can use to render a label for this edge.
		* - `labelY`: the `y` position you can use to render a label for this edge.
		* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
		* middle of this path.
		* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
		* middle of this path.
		* @example
		* ```js
		*  const source = { x: 0, y: 20 };
		*  const target = { x: 150, y: 100 };
		*
		*  const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
		*    sourceX: source.x,
		*    sourceY: source.y,
		*    sourcePosition: Position.Right,
		*    targetX: target.x,
		*    targetY: target.y,
		*    targetPosition: Position.Left,
		*});
		*```
		*
		* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to
		*work with multiple edge paths at once.
		*/
		function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = .25 }) {
			const [sourceControlX, sourceControlY] = getControlWithCurvature({
				pos: sourcePosition,
				x1: sourceX,
				y1: sourceY,
				x2: targetX,
				y2: targetY,
				c: curvature
			});
			const [targetControlX, targetControlY] = getControlWithCurvature({
				pos: targetPosition,
				x1: targetX,
				y1: targetY,
				x2: sourceX,
				y2: sourceY,
				c: curvature
			});
			const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourceControlX,
				sourceControlY,
				targetControlX,
				targetControlY
			});
			return [
				`M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
				labelX,
				labelY,
				offsetX,
				offsetY
			];
		}
		function getEdgeCenter({ sourceX, sourceY, targetX, targetY }) {
			const xOffset = Math.abs(targetX - sourceX) / 2;
			const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
			const yOffset = Math.abs(targetY - sourceY) / 2;
			return [
				centerX,
				targetY < sourceY ? targetY + yOffset : targetY - yOffset,
				xOffset,
				yOffset
			];
		}
		/**
		* Returns the z-index for an edge based on the node it connects and whether it is selected.
		* By default, edges are rendered below nodes. This behaviour is different for edges that are
		* connected to nodes with a parent, as they are rendered above the parent node.
		*/
		function getElevatedEdgeZIndex({ sourceNode, targetNode, selected = false, zIndex = 0, elevateOnSelect = false, zIndexMode = "basic" }) {
			if (zIndexMode === "manual") return zIndex;
			return (elevateOnSelect && selected ? zIndex + 1e3 : zIndex) + Math.max(sourceNode.parentId || elevateOnSelect && sourceNode.selected ? sourceNode.internals.z : 0, targetNode.parentId || elevateOnSelect && targetNode.selected ? targetNode.internals.z : 0);
		}
		function isEdgeVisible({ sourceNode, targetNode, width, height, transform }) {
			const edgeBox = getBoundsOfBoxes(nodeToBox(sourceNode), nodeToBox(targetNode));
			if (edgeBox.x === edgeBox.x2) edgeBox.x2 += 1;
			if (edgeBox.y === edgeBox.y2) edgeBox.y2 += 1;
			return getOverlappingArea({
				x: -transform[0] / transform[2],
				y: -transform[1] / transform[2],
				width: width / transform[2],
				height: height / transform[2]
			}, boxToRect(edgeBox)) > 0;
		}
		/**
		* The default edge ID generator function. Generates an ID based on the source, target, and handles.
		* @public
		* @param params - The connection or edge to generate an ID for.
		* @returns The generated edge ID.
		*/
		const getEdgeId = ({ source, sourceHandle, target, targetHandle }) => `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
		const connectionExists = (edge, edges) => {
			return edges.some((el) => el.source === edge.source && el.target === edge.target && (el.sourceHandle === edge.sourceHandle || !el.sourceHandle && !edge.sourceHandle) && (el.targetHandle === edge.targetHandle || !el.targetHandle && !edge.targetHandle));
		};
		/**
		* This util is a convenience function to add a new Edge to an array of edges. It also performs some validation to make sure you don't add an invalid edge or duplicate an existing one.
		* @public
		* @param edgeParams - Either an `Edge` or a `Connection` you want to add.
		* @param edges - The array of all current edges.
		* @param options - Optional configuration object.
		* @returns A new array of edges with the new edge added.
		*
		* @remarks If an edge with the same `target` and `source` already exists (and the same
		*`targetHandle` and `sourceHandle` if those are set), then this util won't add
		*a new edge even if the `id` property is different.
		*
		*/
		const addEdge$1 = (edgeParams, edges, options = {}) => {
			if (!edgeParams.source || !edgeParams.target) {
				options.onError?.("006", errorMessages["error006"]());
				return edges;
			}
			const edgeIdGenerator = options.getEdgeId || getEdgeId;
			let edge;
			if (isEdgeBase(edgeParams)) edge = { ...edgeParams };
			else edge = {
				...edgeParams,
				id: edgeIdGenerator(edgeParams)
			};
			if (connectionExists(edge, edges)) return edges;
			if (edge.sourceHandle === null) delete edge.sourceHandle;
			if (edge.targetHandle === null) delete edge.targetHandle;
			return edges.concat(edge);
		};
		/**
		* Calculates the straight line path between two points.
		* @public
		* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
		* and `offsetX`, `offsetY` between source handle and label.
		*
		* - `path`: the path to use in an SVG `<path>` element.
		* - `labelX`: the `x` position you can use to render a label for this edge.
		* - `labelY`: the `y` position you can use to render a label for this edge.
		* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
		* middle of this path.
		* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
		* middle of this path.
		* @example
		* ```js
		*  const source = { x: 0, y: 20 };
		*  const target = { x: 150, y: 100 };
		*
		*  const [path, labelX, labelY, offsetX, offsetY] = getStraightPath({
		*    sourceX: source.x,
		*    sourceY: source.y,
		*    sourcePosition: Position.Right,
		*    targetX: target.x,
		*    targetY: target.y,
		*    targetPosition: Position.Left,
		*  });
		* ```
		* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
		*/
		function getStraightPath({ sourceX, sourceY, targetX, targetY }) {
			const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
				sourceX,
				sourceY,
				targetX,
				targetY
			});
			return [
				`M ${sourceX},${sourceY}L ${targetX},${targetY}`,
				labelX,
				labelY,
				offsetX,
				offsetY
			];
		}
		const handleDirections = {
			[Position.Left]: {
				x: -1,
				y: 0
			},
			[Position.Right]: {
				x: 1,
				y: 0
			},
			[Position.Top]: {
				x: 0,
				y: -1
			},
			[Position.Bottom]: {
				x: 0,
				y: 1
			}
		};
		const getDirection = ({ source, sourcePosition = Position.Bottom, target }) => {
			if (sourcePosition === Position.Left || sourcePosition === Position.Right) return source.x < target.x ? {
				x: 1,
				y: 0
			} : {
				x: -1,
				y: 0
			};
			return source.y < target.y ? {
				x: 0,
				y: 1
			} : {
				x: 0,
				y: -1
			};
		};
		const distance = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
		function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition }) {
			const sourceDir = handleDirections[sourcePosition];
			const targetDir = handleDirections[targetPosition];
			const sourceGapped = {
				x: source.x + sourceDir.x * offset,
				y: source.y + sourceDir.y * offset
			};
			const targetGapped = {
				x: target.x + targetDir.x * offset,
				y: target.y + targetDir.y * offset
			};
			const dir = getDirection({
				source: sourceGapped,
				sourcePosition,
				target: targetGapped
			});
			const dirAccessor = dir.x !== 0 ? "x" : "y";
			const currDir = dir[dirAccessor];
			let points = [];
			let centerX, centerY;
			const sourceGapOffset = {
				x: 0,
				y: 0
			};
			const targetGapOffset = {
				x: 0,
				y: 0
			};
			const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
				sourceX: source.x,
				sourceY: source.y,
				targetX: target.x,
				targetY: target.y
			});
			if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
				if (dirAccessor === "x") {
					centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
					centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
				} else {
					centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
					centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
				}
				const verticalSplit = [{
					x: centerX,
					y: sourceGapped.y
				}, {
					x: centerX,
					y: targetGapped.y
				}];
				const horizontalSplit = [{
					x: sourceGapped.x,
					y: centerY
				}, {
					x: targetGapped.x,
					y: centerY
				}];
				if (sourceDir[dirAccessor] === currDir) points = dirAccessor === "x" ? verticalSplit : horizontalSplit;
				else points = dirAccessor === "x" ? horizontalSplit : verticalSplit;
			} else {
				const sourceTarget = [{
					x: sourceGapped.x,
					y: targetGapped.y
				}];
				const targetSource = [{
					x: targetGapped.x,
					y: sourceGapped.y
				}];
				if (dirAccessor === "x") points = sourceDir.x === currDir ? targetSource : sourceTarget;
				else points = sourceDir.y === currDir ? sourceTarget : targetSource;
				if (sourcePosition === targetPosition) {
					const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
					if (diff <= offset) {
						const gapOffset = Math.min(offset - 1, offset - diff);
						if (sourceDir[dirAccessor] === currDir) sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
						else targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
					}
				}
				if (sourcePosition !== targetPosition) {
					const dirAccessorOpposite = dirAccessor === "x" ? "y" : "x";
					const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
					const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
					const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
					if (sourceDir[dirAccessor] === 1 && (!isSameDir && sourceGtTargetOppo || isSameDir && sourceLtTargetOppo) || sourceDir[dirAccessor] !== 1 && (!isSameDir && sourceLtTargetOppo || isSameDir && sourceGtTargetOppo)) points = dirAccessor === "x" ? sourceTarget : targetSource;
				}
				const sourceGapPoint = {
					x: sourceGapped.x + sourceGapOffset.x,
					y: sourceGapped.y + sourceGapOffset.y
				};
				const targetGapPoint = {
					x: targetGapped.x + targetGapOffset.x,
					y: targetGapped.y + targetGapOffset.y
				};
				if (Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x)) >= Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y))) {
					centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
					centerY = points[0].y;
				} else {
					centerX = points[0].x;
					centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
				}
			}
			const gappedSource = {
				x: sourceGapped.x + sourceGapOffset.x,
				y: sourceGapped.y + sourceGapOffset.y
			};
			const gappedTarget = {
				x: targetGapped.x + targetGapOffset.x,
				y: targetGapped.y + targetGapOffset.y
			};
			return [
				[
					source,
					...gappedSource.x !== points[0].x || gappedSource.y !== points[0].y ? [gappedSource] : [],
					...points,
					...gappedTarget.x !== points[points.length - 1].x || gappedTarget.y !== points[points.length - 1].y ? [gappedTarget] : [],
					target
				],
				centerX,
				centerY,
				defaultOffsetX,
				defaultOffsetY
			];
		}
		function getBend(a, b, c, size) {
			const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
			const { x, y } = b;
			if (a.x === x && x === c.x || a.y === y && y === c.y) return `L${x} ${y}`;
			if (a.y === y) {
				const xDir = a.x < c.x ? -1 : 1;
				const yDir = a.y < c.y ? 1 : -1;
				return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
			}
			const xDir = a.x < c.x ? 1 : -1;
			return `L ${x},${y + bendSize * (a.y < c.y ? -1 : 1)}Q ${x},${y} ${x + bendSize * xDir},${y}`;
		}
		/**
		* The `getSmoothStepPath` util returns everything you need to render a stepped path
		* between two nodes. The `borderRadius` property can be used to choose how rounded
		* the corners of those steps are.
		* @public
		* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
		* and `offsetX`, `offsetY` between source handle and label.
		*
		* - `path`: the path to use in an SVG `<path>` element.
		* - `labelX`: the `x` position you can use to render a label for this edge.
		* - `labelY`: the `y` position you can use to render a label for this edge.
		* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
		* middle of this path.
		* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
		* middle of this path.
		* @example
		* ```js
		*  const source = { x: 0, y: 20 };
		*  const target = { x: 150, y: 100 };
		*
		*  const [path, labelX, labelY, offsetX, offsetY] = getSmoothStepPath({
		*    sourceX: source.x,
		*    sourceY: source.y,
		*    sourcePosition: Position.Right,
		*    targetX: target.x,
		*    targetY: target.y,
		*    targetPosition: Position.Left,
		*  });
		* ```
		* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
		*/
		function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = .5 }) {
			const [points, labelX, labelY, offsetX, offsetY] = getPoints({
				source: {
					x: sourceX,
					y: sourceY
				},
				sourcePosition,
				target: {
					x: targetX,
					y: targetY
				},
				targetPosition,
				center: {
					x: centerX,
					y: centerY
				},
				offset,
				stepPosition
			});
			let path = `M${points[0].x} ${points[0].y}`;
			for (let i = 1; i < points.length - 1; i++) path += getBend(points[i - 1], points[i], points[i + 1], borderRadius);
			path += `L${points[points.length - 1].x} ${points[points.length - 1].y}`;
			return [
				path,
				labelX,
				labelY,
				offsetX,
				offsetY
			];
		}
		function isNodeInitialized(node) {
			return node && !!(node.internals.handleBounds || node.handles?.length) && !!(node.measured.width || node.width || node.initialWidth);
		}
		function getEdgePosition(params) {
			const { sourceNode, targetNode } = params;
			if (!isNodeInitialized(sourceNode) || !isNodeInitialized(targetNode)) return null;
			const sourceHandleBounds = sourceNode.internals.handleBounds || toHandleBounds(sourceNode.handles);
			const targetHandleBounds = targetNode.internals.handleBounds || toHandleBounds(targetNode.handles);
			const sourceHandle = getHandle$1(sourceHandleBounds?.source ?? [], params.sourceHandle);
			const targetHandle = getHandle$1(params.connectionMode === ConnectionMode.Strict ? targetHandleBounds?.target ?? [] : (targetHandleBounds?.target ?? []).concat(targetHandleBounds?.source ?? []), params.targetHandle);
			if (!sourceHandle || !targetHandle) {
				params.onError?.("008", errorMessages["error008"](!sourceHandle ? "source" : "target", {
					id: params.id,
					sourceHandle: params.sourceHandle,
					targetHandle: params.targetHandle
				}));
				return null;
			}
			const sourcePosition = sourceHandle?.position || Position.Bottom;
			const targetPosition = targetHandle?.position || Position.Top;
			const source = getHandlePosition(sourceNode, sourceHandle, sourcePosition);
			const target = getHandlePosition(targetNode, targetHandle, targetPosition);
			return {
				sourceX: source.x,
				sourceY: source.y,
				targetX: target.x,
				targetY: target.y,
				sourcePosition,
				targetPosition
			};
		}
		function toHandleBounds(handles) {
			if (!handles) return null;
			const source = [];
			const target = [];
			for (const handle of handles) {
				handle.width = handle.width ?? 1;
				handle.height = handle.height ?? 1;
				if (handle.type === "source") source.push(handle);
				else if (handle.type === "target") target.push(handle);
			}
			return {
				source,
				target
			};
		}
		function getHandlePosition(node, handle, fallbackPosition = Position.Left, center = false) {
			const x = (handle?.x ?? 0) + node.internals.positionAbsolute.x;
			const y = (handle?.y ?? 0) + node.internals.positionAbsolute.y;
			const { width, height } = handle ?? getNodeDimensions(node);
			if (center) return {
				x: x + width / 2,
				y: y + height / 2
			};
			switch (handle?.position ?? fallbackPosition) {
				case Position.Top: return {
					x: x + width / 2,
					y
				};
				case Position.Right: return {
					x: x + width,
					y: y + height / 2
				};
				case Position.Bottom: return {
					x: x + width / 2,
					y: y + height
				};
				case Position.Left: return {
					x,
					y: y + height / 2
				};
			}
		}
		function getHandle$1(bounds, handleId) {
			if (!bounds) return null;
			return (!handleId ? bounds[0] : bounds.find((d) => d.id === handleId)) || null;
		}
		function getMarkerId(marker, id) {
			if (!marker) return "";
			if (typeof marker === "string") return marker;
			return `${id ? `${id}__` : ""}${Object.keys(marker).sort().map((key) => `${key}=${marker[key]}`).join("&")}`;
		}
		function createMarkerIds(edges, { id, defaultColor, defaultMarkerStart, defaultMarkerEnd }) {
			const ids = /* @__PURE__ */ new Set();
			return edges.reduce((markers, edge) => {
				[edge.markerStart || defaultMarkerStart, edge.markerEnd || defaultMarkerEnd].forEach((marker) => {
					if (marker && typeof marker === "object") {
						const markerId = getMarkerId(marker, id);
						if (!ids.has(markerId)) {
							markers.push({
								id: markerId,
								color: marker.color || defaultColor,
								...marker
							});
							ids.add(markerId);
						}
					}
				});
				return markers;
			}, []).sort((a, b) => a.id.localeCompare(b.id));
		}
		const SELECTED_NODE_Z = 1e3;
		const ROOT_PARENT_Z_INCREMENT = 10;
		const defaultOptions = {
			nodeOrigin: [0, 0],
			nodeExtent: infiniteExtent,
			elevateNodesOnSelect: true,
			zIndexMode: "basic",
			defaults: {}
		};
		const adoptUserNodesDefaultOptions = {
			...defaultOptions,
			checkEquality: true
		};
		function mergeObjects(base, incoming) {
			const result = { ...base };
			for (const key in incoming) if (incoming[key] !== void 0) result[key] = incoming[key];
			return result;
		}
		function updateAbsolutePositions(nodeLookup, parentLookup, options) {
			const _options = mergeObjects(defaultOptions, options);
			for (const node of nodeLookup.values()) if (node.parentId) updateChildNode(node, nodeLookup, parentLookup, _options);
			else {
				const clampedPosition = clampPosition(getNodePositionWithOrigin(node, _options.nodeOrigin), isCoordinateExtent(node.extent) ? node.extent : _options.nodeExtent, getNodeDimensions(node));
				node.internals.positionAbsolute = clampedPosition;
			}
		}
		function parseHandles(userNode, internalNode) {
			if (!userNode.handles) return !userNode.measured ? void 0 : internalNode?.internals.handleBounds;
			const source = [];
			const target = [];
			for (const handle of userNode.handles) {
				const handleBounds = {
					id: handle.id,
					width: handle.width ?? 1,
					height: handle.height ?? 1,
					nodeId: userNode.id,
					x: handle.x,
					y: handle.y,
					position: handle.position,
					type: handle.type
				};
				if (handle.type === "source") source.push(handleBounds);
				else if (handle.type === "target") target.push(handleBounds);
			}
			return {
				source,
				target
			};
		}
		function isManualZIndexMode(zIndexMode) {
			return zIndexMode === "manual";
		}
		function adoptUserNodes(nodes, nodeLookup, parentLookup, options = {}) {
			const _options = mergeObjects(adoptUserNodesDefaultOptions, options);
			const rootParentIndex = { i: 0 };
			const tmpLookup = new Map(nodeLookup);
			const selectedNodeZ = _options?.elevateNodesOnSelect && !isManualZIndexMode(_options.zIndexMode) ? SELECTED_NODE_Z : 0;
			let nodesInitialized = nodes.length > 0;
			let hasSelectedNodes = false;
			nodeLookup.clear();
			parentLookup.clear();
			for (const userNode of nodes) {
				let internalNode = tmpLookup.get(userNode.id);
				if (_options.checkEquality && userNode === internalNode?.internals.userNode) nodeLookup.set(userNode.id, internalNode);
				else {
					const clampedPosition = clampPosition(getNodePositionWithOrigin(userNode, _options.nodeOrigin), isCoordinateExtent(userNode.extent) ? userNode.extent : _options.nodeExtent, getNodeDimensions(userNode));
					internalNode = {
						..._options.defaults,
						...userNode,
						measured: {
							width: userNode.measured?.width,
							height: userNode.measured?.height
						},
						internals: {
							positionAbsolute: clampedPosition,
							handleBounds: parseHandles(userNode, internalNode),
							z: calculateZ(userNode, selectedNodeZ, _options.zIndexMode),
							userNode
						}
					};
					nodeLookup.set(userNode.id, internalNode);
				}
				if ((internalNode.measured === void 0 || internalNode.measured.width === void 0 || internalNode.measured.height === void 0) && !internalNode.hidden) nodesInitialized = false;
				if (userNode.parentId) updateChildNode(internalNode, nodeLookup, parentLookup, options, rootParentIndex);
				hasSelectedNodes ||= userNode.selected ?? false;
			}
			return {
				nodesInitialized,
				hasSelectedNodes
			};
		}
		function updateParentLookup(node, parentLookup) {
			if (!node.parentId) return;
			const childNodes = parentLookup.get(node.parentId);
			if (childNodes) childNodes.set(node.id, node);
			else parentLookup.set(node.parentId, new Map([[node.id, node]]));
		}
		/**
		* Updates positionAbsolute and zIndex of a child node and the parentLookup.
		*/
		function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex) {
			const { elevateNodesOnSelect, nodeOrigin, nodeExtent, zIndexMode } = mergeObjects(defaultOptions, options);
			const parentId = node.parentId;
			const parentNode = nodeLookup.get(parentId);
			if (!parentNode) {
				console.warn(`Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
				return;
			}
			updateParentLookup(node, parentLookup);
			if (rootParentIndex && !parentNode.parentId && parentNode.internals.rootParentIndex === void 0 && zIndexMode === "auto") {
				parentNode.internals.rootParentIndex = ++rootParentIndex.i;
				parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
			}
			if (rootParentIndex && parentNode.internals.rootParentIndex !== void 0) rootParentIndex.i = parentNode.internals.rootParentIndex;
			const { x, y, z } = calculateChildXYZ(node, parentNode, nodeOrigin, nodeExtent, elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0, zIndexMode);
			const { positionAbsolute } = node.internals;
			const positionChanged = x !== positionAbsolute.x || y !== positionAbsolute.y;
			if (positionChanged || z !== node.internals.z) nodeLookup.set(node.id, {
				...node,
				internals: {
					...node.internals,
					positionAbsolute: positionChanged ? {
						x,
						y
					} : positionAbsolute,
					z
				}
			});
		}
		function calculateZ(node, selectedNodeZ, zIndexMode) {
			const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;
			if (isManualZIndexMode(zIndexMode)) return zIndex;
			return zIndex + (node.selected ? selectedNodeZ : 0);
		}
		function calculateChildXYZ(childNode, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode) {
			const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
			const childDimensions = getNodeDimensions(childNode);
			const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
			const clampedPosition = isCoordinateExtent(childNode.extent) ? clampPosition(positionWithOrigin, childNode.extent, childDimensions) : positionWithOrigin;
			let absolutePosition = clampPosition({
				x: parentX + clampedPosition.x,
				y: parentY + clampedPosition.y
			}, nodeExtent, childDimensions);
			if (childNode.extent === "parent") absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
			const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
			const parentZ = parentNode.internals.z ?? 0;
			return {
				x: absolutePosition.x,
				y: absolutePosition.y,
				z: parentZ >= childZ ? parentZ + 1 : childZ
			};
		}
		function handleExpandParent(children, nodeLookup, parentLookup, nodeOrigin = [0, 0]) {
			const changes = [];
			const parentExpansions = /* @__PURE__ */ new Map();
			for (const child of children) {
				const parent = nodeLookup.get(child.parentId);
				if (!parent) continue;
				const expandedRect = getBoundsOfRects(parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent), child.rect);
				parentExpansions.set(child.parentId, {
					expandedRect,
					parent
				});
			}
			if (parentExpansions.size > 0) parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
				const positionAbsolute = parent.internals.positionAbsolute;
				const dimensions = getNodeDimensions(parent);
				const origin = parent.origin ?? nodeOrigin;
				const xChange = expandedRect.x < positionAbsolute.x ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x)) : 0;
				const yChange = expandedRect.y < positionAbsolute.y ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y)) : 0;
				const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
				const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
				const widthChange = (newWidth - dimensions.width) * origin[0];
				const heightChange = (newHeight - dimensions.height) * origin[1];
				if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
					changes.push({
						id: parentId,
						type: "position",
						position: {
							x: parent.position.x - xChange + widthChange,
							y: parent.position.y - yChange + heightChange
						}
					});
					parentLookup.get(parentId)?.forEach((childNode) => {
						if (!children.some((child) => child.id === childNode.id)) changes.push({
							id: childNode.id,
							type: "position",
							position: {
								x: childNode.position.x + xChange,
								y: childNode.position.y + yChange
							}
						});
					});
				}
				if (dimensions.width < expandedRect.width || dimensions.height < expandedRect.height || xChange || yChange) changes.push({
					id: parentId,
					type: "dimensions",
					setAttributes: true,
					dimensions: {
						width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
						height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0)
					}
				});
			});
			return changes;
		}
		function updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode) {
			const viewportNode = domNode?.querySelector(".xyflow__viewport");
			let updatedInternals = false;
			if (!viewportNode) return {
				changes: [],
				updatedInternals
			};
			const changes = [];
			const style = window.getComputedStyle(viewportNode);
			const { m22: zoom } = new window.DOMMatrixReadOnly(style.transform);
			const parentExpandChildren = [];
			for (const update of updates.values()) {
				const node = nodeLookup.get(update.id);
				if (!node) continue;
				if (node.hidden) {
					nodeLookup.set(node.id, {
						...node,
						internals: {
							...node.internals,
							handleBounds: void 0
						}
					});
					updatedInternals = true;
					continue;
				}
				const dimensions = getDimensions(update.nodeElement);
				const dimensionChanged = node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
				if (!!(dimensions.width && dimensions.height && (dimensionChanged || !node.internals.handleBounds || update.force))) {
					const nodeBounds = update.nodeElement.getBoundingClientRect();
					const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
					let { positionAbsolute } = node.internals;
					if (node.parentId && node.extent === "parent") {
						const parentNode = nodeLookup.get(node.parentId);
						if (parentNode) positionAbsolute = clampPositionToParent(positionAbsolute, dimensions, parentNode);
					} else if (extent) positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
					const newNode = {
						...node,
						measured: dimensions,
						internals: {
							...node.internals,
							positionAbsolute,
							handleBounds: {
								source: getHandleBounds("source", update.nodeElement, nodeBounds, zoom, node.id),
								target: getHandleBounds("target", update.nodeElement, nodeBounds, zoom, node.id)
							}
						}
					};
					nodeLookup.set(node.id, newNode);
					if (node.parentId) updateChildNode(newNode, nodeLookup, parentLookup, {
						nodeOrigin,
						zIndexMode
					});
					updatedInternals = true;
					if (dimensionChanged) {
						changes.push({
							id: node.id,
							type: "dimensions",
							dimensions
						});
						if (node.expandParent && node.parentId) parentExpandChildren.push({
							id: node.id,
							parentId: node.parentId,
							rect: nodeToRect(newNode, nodeOrigin)
						});
					}
				}
			}
			if (parentExpandChildren.length > 0) {
				const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
				changes.push(...parentExpandChanges);
			}
			return {
				changes,
				updatedInternals
			};
		}
		async function panBy({ delta, panZoom, transform, translateExtent, width, height }) {
			if (!panZoom || !delta.x && !delta.y) return false;
			const nextViewport = await panZoom.setViewportConstrained({
				x: transform[0] + delta.x,
				y: transform[1] + delta.y,
				zoom: transform[2]
			}, [[0, 0], [width, height]], translateExtent);
			return !!nextViewport && (nextViewport.x !== transform[0] || nextViewport.y !== transform[1] || nextViewport.k !== transform[2]);
		}
		/**
		* this function adds the connection to the connectionLookup
		* at the following keys: nodeId-type-handleId, nodeId-type and nodeId
		* @param type type of the connection
		* @param connection connection that should be added to the lookup
		* @param connectionKey at which key the connection should be added
		* @param connectionLookup reference to the connection lookup
		* @param nodeId nodeId of the connection
		* @param handleId handleId of the connection
		*/
		function addConnectionToLookup(type, connection, connectionKey, connectionLookup, nodeId, handleId) {
			let key = nodeId;
			const nodeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
			connectionLookup.set(key, nodeMap.set(connectionKey, connection));
			key = `${nodeId}-${type}`;
			const typeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
			connectionLookup.set(key, typeMap.set(connectionKey, connection));
			if (handleId) {
				key = `${nodeId}-${type}-${handleId}`;
				const handleMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
				connectionLookup.set(key, handleMap.set(connectionKey, connection));
			}
		}
		function updateConnectionLookup(connectionLookup, edgeLookup, edges) {
			connectionLookup.clear();
			edgeLookup.clear();
			for (const edge of edges) {
				const { source: sourceNode, target: targetNode, sourceHandle = null, targetHandle = null } = edge;
				const connection = {
					edgeId: edge.id,
					source: sourceNode,
					target: targetNode,
					sourceHandle,
					targetHandle
				};
				const sourceKey = `${sourceNode}-${sourceHandle}--${targetNode}-${targetHandle}`;
				addConnectionToLookup("source", connection, `${targetNode}-${targetHandle}--${sourceNode}-${sourceHandle}`, connectionLookup, sourceNode, sourceHandle);
				addConnectionToLookup("target", connection, sourceKey, connectionLookup, targetNode, targetHandle);
				edgeLookup.set(edge.id, edge);
			}
		}
		function isParentSelected(node, nodeLookup) {
			if (!node.parentId) return false;
			const parentNode = nodeLookup.get(node.parentId);
			if (!parentNode) return false;
			if (parentNode.selected) return true;
			return isParentSelected(parentNode, nodeLookup);
		}
		function hasSelector(target, selector, domNode) {
			let current = target;
			do {
				if (current?.matches?.(selector)) return true;
				if (current === domNode) return false;
				current = current?.parentElement;
			} while (current);
			return false;
		}
		function getDragItems(nodeLookup, nodesDraggable, mousePos, nodeId) {
			const dragItems = /* @__PURE__ */ new Map();
			for (const [id, node] of nodeLookup) if ((node.selected || node.id === nodeId) && (!node.parentId || !isParentSelected(node, nodeLookup)) && (node.draggable || nodesDraggable && typeof node.draggable === "undefined")) {
				const internalNode = nodeLookup.get(id);
				if (internalNode) dragItems.set(id, {
					id,
					position: internalNode.position || {
						x: 0,
						y: 0
					},
					distance: {
						x: mousePos.x - internalNode.internals.positionAbsolute.x,
						y: mousePos.y - internalNode.internals.positionAbsolute.y
					},
					extent: internalNode.extent,
					parentId: internalNode.parentId,
					origin: internalNode.origin,
					expandParent: internalNode.expandParent,
					internals: { positionAbsolute: internalNode.internals.positionAbsolute || {
						x: 0,
						y: 0
					} },
					measured: {
						width: internalNode.measured.width ?? 0,
						height: internalNode.measured.height ?? 0
					}
				});
			}
			return dragItems;
		}
		function getEventHandlerParams({ nodeId, dragItems, nodeLookup, dragging = true }) {
			const nodesFromDragItems = [];
			for (const [id, dragItem] of dragItems) {
				const node = nodeLookup.get(id)?.internals.userNode;
				if (node) nodesFromDragItems.push({
					...node,
					position: dragItem.position,
					dragging
				});
			}
			if (!nodeId) return [nodesFromDragItems[0], nodesFromDragItems];
			const node = nodeLookup.get(nodeId)?.internals.userNode;
			return [!node ? nodesFromDragItems[0] : {
				...node,
				position: dragItems.get(nodeId)?.position || node.position,
				dragging
			}, nodesFromDragItems];
		}
		/**
		* If a selection is being dragged we want to apply the same snap offset to all nodes in the selection.
		* This function calculates the snap offset based on the first node in the selection.
		*/
		function calculateSnapOffset({ dragItems, snapGrid, x, y }) {
			const refDragItem = dragItems.values().next().value;
			if (!refDragItem) return null;
			const refPos = {
				x: x - refDragItem.distance.x,
				y: y - refDragItem.distance.y
			};
			const refPosSnapped = snapPosition(refPos, snapGrid);
			return {
				x: refPosSnapped.x - refPos.x,
				y: refPosSnapped.y - refPos.y
			};
		}
		function XYDrag({ onNodeMouseDown, getStoreItems, onDragStart, onDrag, onDragStop }) {
			let lastPos = {
				x: null,
				y: null
			};
			let autoPanId = 0;
			let dragItems = /* @__PURE__ */ new Map();
			let autoPanStarted = false;
			let mousePosition = {
				x: 0,
				y: 0
			};
			let containerBounds = null;
			let dragStarted = false;
			let d3Selection = null;
			let abortDrag = false;
			let nodePositionsChanged = false;
			let dragEvent = null;
			function update({ noDragClassName, handleSelector, domNode, isSelectable, nodeId, nodeClickDistance = 0 }) {
				d3Selection = select_default$1(domNode);
				function updateNodes({ x, y }) {
					const { nodeLookup, nodeExtent, snapGrid, snapToGrid, nodeOrigin, onNodeDrag, onSelectionDrag, onError, updateNodePositions } = getStoreItems();
					lastPos = {
						x,
						y
					};
					let hasChange = false;
					const isMultiDrag = dragItems.size > 1;
					const nodesBox = isMultiDrag && nodeExtent ? rectToBox(getInternalNodesBounds(dragItems)) : null;
					const multiDragSnapOffset = isMultiDrag && snapToGrid ? calculateSnapOffset({
						dragItems,
						snapGrid,
						x,
						y
					}) : null;
					for (const [id, dragItem] of dragItems) {
						if (!nodeLookup.has(id)) continue;
						let nextPosition = {
							x: x - dragItem.distance.x,
							y: y - dragItem.distance.y
						};
						if (snapToGrid) nextPosition = multiDragSnapOffset ? {
							x: Math.round(nextPosition.x + multiDragSnapOffset.x),
							y: Math.round(nextPosition.y + multiDragSnapOffset.y)
						} : snapPosition(nextPosition, snapGrid);
						let adjustedNodeExtent = null;
						if (isMultiDrag && nodeExtent && !dragItem.extent && nodesBox) {
							const { positionAbsolute } = dragItem.internals;
							const x1 = positionAbsolute.x - nodesBox.x + nodeExtent[0][0];
							const x2 = positionAbsolute.x + dragItem.measured.width - nodesBox.x2 + nodeExtent[1][0];
							const y1 = positionAbsolute.y - nodesBox.y + nodeExtent[0][1];
							const y2 = positionAbsolute.y + dragItem.measured.height - nodesBox.y2 + nodeExtent[1][1];
							adjustedNodeExtent = [[x1, y1], [x2, y2]];
						}
						const { position, positionAbsolute } = calculateNodePosition({
							nodeId: id,
							nextPosition,
							nodeLookup,
							nodeExtent: adjustedNodeExtent ? adjustedNodeExtent : nodeExtent,
							nodeOrigin,
							onError
						});
						hasChange = hasChange || dragItem.position.x !== position.x || dragItem.position.y !== position.y;
						dragItem.position = position;
						dragItem.internals.positionAbsolute = positionAbsolute;
					}
					nodePositionsChanged = nodePositionsChanged || hasChange;
					if (!hasChange) return;
					updateNodePositions(dragItems, true);
					if (dragEvent && (onDrag || onNodeDrag || !nodeId && onSelectionDrag)) {
						const [currentNode, currentNodes] = getEventHandlerParams({
							nodeId,
							dragItems,
							nodeLookup
						});
						onDrag?.(dragEvent, dragItems, currentNode, currentNodes);
						onNodeDrag?.(dragEvent, currentNode, currentNodes);
						if (!nodeId) onSelectionDrag?.(dragEvent, currentNodes);
					}
				}
				async function autoPan() {
					if (!containerBounds) return;
					const { transform, panBy, autoPanSpeed, autoPanOnNodeDrag } = getStoreItems();
					if (!autoPanOnNodeDrag) {
						autoPanStarted = false;
						cancelAnimationFrame(autoPanId);
						return;
					}
					const [xMovement, yMovement] = calcAutoPan(mousePosition, containerBounds, autoPanSpeed);
					if (xMovement !== 0 || yMovement !== 0) {
						lastPos.x = (lastPos.x ?? 0) - xMovement / transform[2];
						lastPos.y = (lastPos.y ?? 0) - yMovement / transform[2];
						if (await panBy({
							x: xMovement,
							y: yMovement
						})) updateNodes(lastPos);
					}
					autoPanId = requestAnimationFrame(autoPan);
				}
				function startDrag(event) {
					const { nodeLookup, multiSelectionActive, nodesDraggable, transform, snapGrid, snapToGrid, selectNodesOnDrag, onNodeDragStart, onSelectionDragStart, unselectNodesAndEdges } = getStoreItems();
					dragStarted = true;
					if ((!selectNodesOnDrag || !isSelectable) && !multiSelectionActive && nodeId) {
						if (!nodeLookup.get(nodeId)?.selected) unselectNodesAndEdges();
					}
					if (isSelectable && selectNodesOnDrag && nodeId) onNodeMouseDown?.(nodeId);
					const pointerPos = getPointerPosition(event.sourceEvent, {
						transform,
						snapGrid,
						snapToGrid,
						containerBounds
					});
					lastPos = pointerPos;
					dragItems = getDragItems(nodeLookup, nodesDraggable, pointerPos, nodeId);
					if (dragItems.size > 0 && (onDragStart || onNodeDragStart || !nodeId && onSelectionDragStart)) {
						const [currentNode, currentNodes] = getEventHandlerParams({
							nodeId,
							dragItems,
							nodeLookup
						});
						onDragStart?.(event.sourceEvent, dragItems, currentNode, currentNodes);
						onNodeDragStart?.(event.sourceEvent, currentNode, currentNodes);
						if (!nodeId) onSelectionDragStart?.(event.sourceEvent, currentNodes);
					}
				}
				const d3DragInstance = drag_default().clickDistance(nodeClickDistance).on("start", (event) => {
					const { domNode, nodeDragThreshold, transform, snapGrid, snapToGrid } = getStoreItems();
					containerBounds = domNode?.getBoundingClientRect() || null;
					abortDrag = false;
					nodePositionsChanged = false;
					dragEvent = event.sourceEvent;
					if (nodeDragThreshold === 0) startDrag(event);
					lastPos = getPointerPosition(event.sourceEvent, {
						transform,
						snapGrid,
						snapToGrid,
						containerBounds
					});
					mousePosition = getEventPosition(event.sourceEvent, containerBounds);
				}).on("drag", (event) => {
					const { autoPanOnNodeDrag, transform, snapGrid, snapToGrid, nodeDragThreshold, nodeLookup } = getStoreItems();
					const pointerPos = getPointerPosition(event.sourceEvent, {
						transform,
						snapGrid,
						snapToGrid,
						containerBounds
					});
					dragEvent = event.sourceEvent;
					if (event.sourceEvent.type === "touchmove" && event.sourceEvent.touches.length > 1 || nodeId && !nodeLookup.has(nodeId)) abortDrag = true;
					if (abortDrag) return;
					if (!autoPanStarted && autoPanOnNodeDrag && dragStarted) {
						autoPanStarted = true;
						autoPan();
					}
					if (!dragStarted) {
						const currentMousePosition = getEventPosition(event.sourceEvent, containerBounds);
						const x = currentMousePosition.x - mousePosition.x;
						const y = currentMousePosition.y - mousePosition.y;
						if (Math.sqrt(x * x + y * y) > nodeDragThreshold) startDrag(event);
					}
					if ((lastPos.x !== pointerPos.xSnapped || lastPos.y !== pointerPos.ySnapped) && dragItems && dragStarted) {
						mousePosition = getEventPosition(event.sourceEvent, containerBounds);
						updateNodes(pointerPos);
					}
				}).on("end", (event) => {
					if (!dragStarted || abortDrag) {
						if (abortDrag && dragItems.size > 0) getStoreItems().updateNodePositions(dragItems, false);
						return;
					}
					autoPanStarted = false;
					dragStarted = false;
					cancelAnimationFrame(autoPanId);
					if (dragItems.size > 0) {
						const { nodeLookup, updateNodePositions, onNodeDragStop, onSelectionDragStop } = getStoreItems();
						if (nodePositionsChanged) {
							updateNodePositions(dragItems, false);
							nodePositionsChanged = false;
						}
						if (onDragStop || onNodeDragStop || !nodeId && onSelectionDragStop) {
							const [currentNode, currentNodes] = getEventHandlerParams({
								nodeId,
								dragItems,
								nodeLookup,
								dragging: false
							});
							onDragStop?.(event.sourceEvent, dragItems, currentNode, currentNodes);
							onNodeDragStop?.(event.sourceEvent, currentNode, currentNodes);
							if (!nodeId) onSelectionDragStop?.(event.sourceEvent, currentNodes);
						}
					}
				}).filter((event) => {
					const target = event.target;
					return !event.button && (!noDragClassName || !hasSelector(target, `.${noDragClassName}`, domNode)) && (!handleSelector || hasSelector(target, handleSelector, domNode));
				});
				d3Selection.call(d3DragInstance);
			}
			function destroy() {
				d3Selection?.on(".drag", null);
			}
			return {
				update,
				destroy
			};
		}
		function getNodesWithinDistance(position, nodeLookup, distance) {
			const nodes = [];
			const rect = {
				x: position.x - distance,
				y: position.y - distance,
				width: distance * 2,
				height: distance * 2
			};
			for (const node of nodeLookup.values()) if (getOverlappingArea(rect, nodeToRect(node)) > 0) nodes.push(node);
			return nodes;
		}
		const ADDITIONAL_DISTANCE = 250;
		function getClosestHandle(position, connectionRadius, nodeLookup, fromHandle) {
			let closestHandles = [];
			let minDistance = Infinity;
			const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);
			for (const node of closeNodes) {
				const allHandles = [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
				for (const handle of allHandles) {
					if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) continue;
					const { x, y } = getHandlePosition(node, handle, handle.position, true);
					const distance = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
					if (distance > connectionRadius) continue;
					if (distance < minDistance) {
						closestHandles = [{
							...handle,
							x,
							y
						}];
						minDistance = distance;
					} else if (distance === minDistance) closestHandles.push({
						...handle,
						x,
						y
					});
				}
			}
			if (!closestHandles.length) return null;
			if (closestHandles.length > 1) {
				const oppositeHandleType = fromHandle.type === "source" ? "target" : "source";
				return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
			}
			return closestHandles[0];
		}
		function getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode, withAbsolutePosition = false) {
			const node = nodeLookup.get(nodeId);
			if (!node) return null;
			const handles = connectionMode === "strict" ? node.internals.handleBounds?.[handleType] : [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
			const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;
			return handle && withAbsolutePosition ? {
				...handle,
				...getHandlePosition(node, handle, handle.position, true)
			} : handle;
		}
		function getHandleType(edgeUpdaterType, handleDomNode) {
			if (edgeUpdaterType) return edgeUpdaterType;
			else if (handleDomNode?.classList.contains("target")) return "target";
			else if (handleDomNode?.classList.contains("source")) return "source";
			return null;
		}
		function isConnectionValid(isInsideConnectionRadius, isHandleValid) {
			let isValid = null;
			if (isHandleValid) isValid = true;
			else if (isInsideConnectionRadius && !isHandleValid) isValid = false;
			return isValid;
		}
		const alwaysValid = () => true;
		function onPointerDown(event, { connectionMode, connectionRadius, handleId, nodeId, edgeUpdaterType, isTarget, domNode, nodeLookup, lib, autoPanOnConnect, flowId, panBy, cancelConnection, onConnectStart, onConnect, onConnectEnd, isValidConnection = alwaysValid, onReconnectEnd, updateConnection, getTransform, getFromHandle, autoPanSpeed, dragThreshold = 1, handleDomNode }) {
			const doc = getHostForElement(event.target);
			let autoPanId = 0;
			let closestHandle;
			const { x, y } = getEventPosition(event);
			const handleType = getHandleType(edgeUpdaterType, handleDomNode);
			const containerBounds = domNode?.getBoundingClientRect();
			let connectionStarted = false;
			if (!containerBounds || !handleType) return;
			const fromHandleInternal = getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode);
			if (!fromHandleInternal) return;
			let position = getEventPosition(event, containerBounds);
			let autoPanStarted = false;
			let connection = null;
			let isValid = false;
			let resultHandleDomNode = null;
			function autoPan() {
				if (!autoPanOnConnect || !containerBounds) return;
				const [x, y] = calcAutoPan(position, containerBounds, autoPanSpeed);
				panBy({
					x,
					y
				});
				autoPanId = requestAnimationFrame(autoPan);
			}
			const fromHandle = {
				...fromHandleInternal,
				nodeId,
				type: handleType,
				position: fromHandleInternal.position
			};
			const fromInternalNode = nodeLookup.get(nodeId);
			let previousConnection = {
				inProgress: true,
				isValid: null,
				from: getHandlePosition(fromInternalNode, fromHandle, Position.Left, true),
				fromHandle,
				fromPosition: fromHandle.position,
				fromNode: fromInternalNode,
				to: position,
				toHandle: null,
				toPosition: oppositePosition[fromHandle.position],
				toNode: null,
				pointer: position
			};
			function startConnection() {
				connectionStarted = true;
				updateConnection(previousConnection);
				onConnectStart?.(event, {
					nodeId,
					handleId,
					handleType
				});
			}
			if (dragThreshold === 0) startConnection();
			function onPointerMove(event) {
				if (!connectionStarted) {
					const { x: evtX, y: evtY } = getEventPosition(event);
					const dx = evtX - x;
					const dy = evtY - y;
					if (!(dx * dx + dy * dy > dragThreshold * dragThreshold)) return;
					startConnection();
				}
				if (!getFromHandle() || !fromHandle) {
					onPointerUp(event);
					return;
				}
				const transform = getTransform();
				position = getEventPosition(event, containerBounds);
				closestHandle = getClosestHandle(pointToRendererPoint(position, transform, false, [1, 1]), connectionRadius, nodeLookup, fromHandle);
				if (!autoPanStarted) {
					autoPan();
					autoPanStarted = true;
				}
				const result = isValidHandle(event, {
					handle: closestHandle,
					connectionMode,
					fromNodeId: nodeId,
					fromHandleId: handleId,
					fromType: isTarget ? "target" : "source",
					isValidConnection,
					doc,
					lib,
					flowId,
					nodeLookup
				});
				resultHandleDomNode = result.handleDomNode;
				connection = result.connection;
				isValid = isConnectionValid(!!closestHandle, result.isValid);
				const fromInternalNode = nodeLookup.get(nodeId);
				const from = fromInternalNode ? getHandlePosition(fromInternalNode, fromHandle, Position.Left, true) : previousConnection.from;
				const newConnection = {
					...previousConnection,
					from,
					isValid,
					to: result.toHandle && isValid ? rendererPointToPoint({
						x: result.toHandle.x,
						y: result.toHandle.y
					}, transform) : position,
					toHandle: result.toHandle,
					toPosition: isValid && result.toHandle ? result.toHandle.position : oppositePosition[fromHandle.position],
					toNode: result.toHandle ? nodeLookup.get(result.toHandle.nodeId) : null,
					pointer: position
				};
				updateConnection(newConnection);
				previousConnection = newConnection;
			}
			function onPointerUp(event) {
				if ("touches" in event && event.touches.length > 0) return;
				if (connectionStarted) {
					if ((closestHandle || resultHandleDomNode) && connection && isValid) onConnect?.(connection);
					const { inProgress, ...connectionState } = previousConnection;
					const finalConnectionState = {
						...connectionState,
						toPosition: previousConnection.toHandle ? previousConnection.toPosition : null
					};
					onConnectEnd?.(event, finalConnectionState);
					if (edgeUpdaterType) onReconnectEnd?.(event, finalConnectionState);
				}
				cancelConnection();
				cancelAnimationFrame(autoPanId);
				autoPanStarted = false;
				isValid = false;
				connection = null;
				resultHandleDomNode = null;
				doc.removeEventListener("mousemove", onPointerMove);
				doc.removeEventListener("mouseup", onPointerUp);
				doc.removeEventListener("touchmove", onPointerMove);
				doc.removeEventListener("touchend", onPointerUp);
			}
			doc.addEventListener("mousemove", onPointerMove);
			doc.addEventListener("mouseup", onPointerUp);
			doc.addEventListener("touchmove", onPointerMove);
			doc.addEventListener("touchend", onPointerUp);
		}
		function isValidHandle(event, { handle, connectionMode, fromNodeId, fromHandleId, fromType, doc, lib, flowId, isValidConnection = alwaysValid, nodeLookup }) {
			const isTarget = fromType === "target";
			const handleDomNode = handle ? doc.querySelector(`.${lib}-flow__handle[data-id="${flowId}-${handle?.nodeId}-${handle?.id}-${handle?.type}"]`) : null;
			const { x, y } = getEventPosition(event);
			const handleBelow = doc.elementFromPoint(x, y);
			const handleToCheck = handleBelow?.classList.contains(`${lib}-flow__handle`) ? handleBelow : handleDomNode;
			const result = {
				handleDomNode: handleToCheck,
				isValid: false,
				connection: null,
				toHandle: null
			};
			if (handleToCheck) {
				const handleType = getHandleType(void 0, handleToCheck);
				const handleNodeId = handleToCheck.getAttribute("data-nodeid");
				const handleId = handleToCheck.getAttribute("data-handleid");
				const connectable = handleToCheck.classList.contains("connectable");
				const connectableEnd = handleToCheck.classList.contains("connectableend");
				if (!handleNodeId || !handleType) return result;
				const connection = {
					source: isTarget ? handleNodeId : fromNodeId,
					sourceHandle: isTarget ? handleId : fromHandleId,
					target: isTarget ? fromNodeId : handleNodeId,
					targetHandle: isTarget ? fromHandleId : handleId
				};
				result.connection = connection;
				result.isValid = connectable && connectableEnd && (connectionMode === ConnectionMode.Strict ? isTarget && handleType === "source" || !isTarget && handleType === "target" : handleNodeId !== fromNodeId || handleId !== fromHandleId) && isValidConnection(connection);
				result.toHandle = getHandle(handleNodeId, handleType, handleId, nodeLookup, connectionMode, true);
			}
			return result;
		}
		const XYHandle = {
			onPointerDown,
			isValid: isValidHandle
		};
		function XYMinimap({ domNode, panZoom, getTransform, getViewScale }) {
			const selection = select_default$1(domNode);
			function update({ translateExtent, width, height, zoomStep = 1, pannable = true, zoomable = true, inversePan = false }) {
				const zoomHandler = (event) => {
					if (event.sourceEvent.type !== "wheel" || !panZoom) return;
					const transform = getTransform();
					const factor = event.sourceEvent.ctrlKey && isMacOs() ? 10 : 1;
					const pinchDelta = -event.sourceEvent.deltaY * (event.sourceEvent.deltaMode === 1 ? .05 : event.sourceEvent.deltaMode ? 1 : .002) * zoomStep;
					const nextZoom = transform[2] * Math.pow(2, pinchDelta * factor);
					panZoom.scaleTo(nextZoom);
				};
				let panStart = [0, 0];
				const panStartHandler = (event) => {
					if (event.sourceEvent.type === "mousedown" || event.sourceEvent.type === "touchstart") panStart = [event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX, event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY];
				};
				const panHandler = (event) => {
					const transform = getTransform();
					if (event.sourceEvent.type !== "mousemove" && event.sourceEvent.type !== "touchmove" || !panZoom) return;
					const panCurrent = [event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX, event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY];
					const panDelta = [panCurrent[0] - panStart[0], panCurrent[1] - panStart[1]];
					panStart = panCurrent;
					const moveScale = getViewScale() * Math.max(transform[2], Math.log(transform[2])) * (inversePan ? -1 : 1);
					const position = {
						x: transform[0] - panDelta[0] * moveScale,
						y: transform[1] - panDelta[1] * moveScale
					};
					const extent = [[0, 0], [width, height]];
					panZoom.setViewportConstrained({
						x: position.x,
						y: position.y,
						zoom: transform[2]
					}, extent, translateExtent);
				};
				const zoomAndPanHandler = zoom_default().on("start", panStartHandler).on("zoom", pannable ? panHandler : null).on("zoom.wheel", zoomable ? zoomHandler : null);
				selection.call(zoomAndPanHandler, {});
			}
			function destroy() {
				selection.on("zoom", null);
			}
			return {
				update,
				destroy,
				pointer: pointer_default
			};
		}
		const transformToViewport = (transform) => ({
			x: transform.x,
			y: transform.y,
			zoom: transform.k
		});
		const viewportToTransform = ({ x, y, zoom }) => identity$1.translate(x, y).scale(zoom);
		const isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);
		const isRightClickPan = (panOnDrag, usedButton) => usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);
		const defaultEase = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
		const getD3Transition = (selection, duration = 0, ease = defaultEase, onEnd = () => {}) => {
			const hasDuration = typeof duration === "number" && duration > 0;
			if (!hasDuration) onEnd();
			return hasDuration ? selection.transition().duration(duration).ease(ease).on("end", onEnd) : selection;
		};
		const wheelDelta = (event) => {
			const factor = event.ctrlKey && isMacOs() ? 10 : 1;
			return -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002) * factor;
		};
		function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd }) {
			return (event) => {
				if (isWrappedWithClass(event, noWheelClassName)) {
					if (event.ctrlKey) event.preventDefault();
					return false;
				}
				event.preventDefault();
				event.stopImmediatePropagation();
				const currentZoom = d3Selection.property("__zoom").k || 1;
				if (event.ctrlKey && zoomOnPinch) {
					const point = pointer_default(event);
					const pinchDelta = wheelDelta(event);
					const zoom = currentZoom * Math.pow(2, pinchDelta);
					d3Zoom.scaleTo(d3Selection, zoom, point, event);
					return;
				}
				const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
				let deltaX = panOnScrollMode === PanOnScrollMode.Vertical ? 0 : event.deltaX * deltaNormalize;
				let deltaY = panOnScrollMode === PanOnScrollMode.Horizontal ? 0 : event.deltaY * deltaNormalize;
				if (!isMacOs() && event.shiftKey && panOnScrollMode !== PanOnScrollMode.Vertical) {
					deltaX = event.deltaY * deltaNormalize;
					deltaY = 0;
				}
				d3Zoom.translateBy(d3Selection, -(deltaX / currentZoom) * panOnScrollSpeed, -(deltaY / currentZoom) * panOnScrollSpeed, { internal: true });
				const nextViewport = transformToViewport(d3Selection.property("__zoom"));
				clearTimeout(zoomPanValues.panScrollTimeout);
				if (!zoomPanValues.isPanScrolling) {
					zoomPanValues.isPanScrolling = true;
					onPanZoomStart?.(event, nextViewport);
				} else onPanZoom?.(event, nextViewport);
				zoomPanValues.panScrollTimeout = setTimeout(() => {
					onPanZoomEnd?.(event, nextViewport);
					zoomPanValues.isPanScrolling = false;
				}, 150);
			};
		}
		function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }) {
			return function(event, d) {
				const isWheel = event.type === "wheel";
				const preventZoom = !preventScrolling && isWheel && !event.ctrlKey;
				const hasNoWheelClass = isWrappedWithClass(event, noWheelClassName);
				if (event.ctrlKey && isWheel && hasNoWheelClass) event.preventDefault();
				if (preventZoom || hasNoWheelClass) return null;
				event.preventDefault();
				d3ZoomHandler.call(this, event, d);
			};
		}
		function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }) {
			return (event) => {
				if (event.sourceEvent?.internal) return;
				const viewport = transformToViewport(event.transform);
				zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
				zoomPanValues.isZoomingOrPanning = true;
				zoomPanValues.prevViewport = viewport;
				if (event.sourceEvent?.type === "mousedown") onDraggingChange(true);
				if (onPanZoomStart) onPanZoomStart?.(event.sourceEvent, viewport);
			};
		}
		function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom }) {
			return (event) => {
				zoomPanValues.usedRightMouseButton = !!(onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0));
				if (!event.sourceEvent?.sync) onTransformChange([
					event.transform.x,
					event.transform.y,
					event.transform.k
				]);
				if (onPanZoom && !event.sourceEvent?.internal) onPanZoom?.(event.sourceEvent, transformToViewport(event.transform));
			};
		}
		function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu }) {
			return (event) => {
				if (event.sourceEvent?.internal) return;
				zoomPanValues.isZoomingOrPanning = false;
				if (onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) && !zoomPanValues.usedRightMouseButton && event.sourceEvent) onPaneContextMenu(event.sourceEvent);
				zoomPanValues.usedRightMouseButton = false;
				onDraggingChange(false);
				if (onPanZoomEnd) {
					const viewport = transformToViewport(event.transform);
					zoomPanValues.prevViewport = viewport;
					clearTimeout(zoomPanValues.timerId);
					zoomPanValues.timerId = setTimeout(() => {
						onPanZoomEnd?.(event.sourceEvent, viewport);
					}, panOnScroll ? 150 : 0);
				}
			};
		}
		function createFilter({ panActivationKeyPressed, zoomActivationKeyPressed, zoomOnScroll, zoomOnPinch, panOnDrag, panOnScroll, zoomOnDoubleClick, userSelectionActive, noWheelClassName, noPanClassName, lib, connectionInProgress }) {
			return (event) => {
				const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
				const pinchZoom = zoomOnPinch && event.ctrlKey;
				const isWheelEvent = event.type === "wheel";
				if (event.button === 1 && event.type === "mousedown" && (isWrappedWithClass(event, `${lib}-flow__node`) || isWrappedWithClass(event, `${lib}-flow__edge`) || isWrappedWithClass(event, `${lib}-flow__selection`) || isWrappedWithClass(event, `${lib}-flow__nodesselection`))) return true;
				if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) return false;
				if (userSelectionActive) return false;
				if (connectionInProgress && !isWheelEvent) return false;
				if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) return false;
				if (isWrappedWithClass(event, noPanClassName) && (!isWheelEvent || panOnScroll && isWheelEvent && !zoomActivationKeyPressed)) return false;
				if (!zoomOnPinch && event.ctrlKey && isWheelEvent) return false;
				if (!zoomOnPinch && event.type === "touchstart" && event.touches?.length > 1) {
					event.preventDefault();
					return false;
				}
				if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) return false;
				if (!panOnDrag && (event.type === "mousedown" || event.type === "touchstart")) return false;
				if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === "mousedown") return false;
				const buttonAllowed = Array.isArray(panOnDrag) && panOnDrag.includes(event.button) || !event.button || event.button <= 1;
				return (!event.ctrlKey || isWheelEvent || panActivationKeyPressed) && buttonAllowed;
			};
		}
		function XYPanZoom({ domNode, minZoom, maxZoom, translateExtent, viewport, onPanZoom, onPanZoomStart, onPanZoomEnd, onDraggingChange }) {
			const zoomPanValues = {
				isZoomingOrPanning: false,
				usedRightMouseButton: false,
				prevViewport: {},
				mouseButton: 0,
				timerId: void 0,
				panScrollTimeout: void 0,
				isPanScrolling: false
			};
			const bbox = domNode.getBoundingClientRect();
			let cachedExtent = [[0, 0], [bbox.width, bbox.height]];
			(typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) cachedExtent = [[0, 0], [entry.contentRect.width, entry.contentRect.height]];
			}) : null)?.observe(domNode);
			const d3ZoomInstance = zoom_default().extent(() => cachedExtent).scaleExtent([minZoom, maxZoom]).translateExtent(translateExtent);
			const d3Selection = select_default$1(domNode).call(d3ZoomInstance);
			setViewportConstrained({
				x: viewport.x,
				y: viewport.y,
				zoom: clamp(viewport.zoom, minZoom, maxZoom)
			}, [[0, 0], [bbox.width, bbox.height]], translateExtent);
			const d3ZoomHandler = d3Selection.on("wheel.zoom");
			const d3DblClickZoomHandler = d3Selection.on("dblclick.zoom");
			d3ZoomInstance.wheelDelta(wheelDelta);
			async function setTransform(transform, options) {
				if (d3Selection) return new Promise((resolve) => {
					d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).transform(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), transform);
				});
				return false;
			}
			function update({ noWheelClassName, noPanClassName, onPaneContextMenu, userSelectionActive, panOnScroll, panOnDrag, panOnScrollMode, panOnScrollSpeed, preventScrolling, zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, panActivationKeyPressed = false, zoomActivationKeyPressed, lib, onTransformChange, connectionInProgress, paneClickDistance, selectionOnDrag }) {
				if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) destroy();
				const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;
				d3ZoomInstance.clickDistance(selectionOnDrag ? Infinity : !isNumeric(paneClickDistance) || paneClickDistance < 0 ? 0 : paneClickDistance);
				const wheelHandler = isPanOnScroll ? createPanOnScrollHandler({
					zoomPanValues,
					noWheelClassName,
					d3Selection,
					d3Zoom: d3ZoomInstance,
					panOnScrollMode,
					panOnScrollSpeed,
					zoomOnPinch,
					onPanZoomStart,
					onPanZoom,
					onPanZoomEnd
				}) : createZoomOnScrollHandler({
					noWheelClassName,
					preventScrolling,
					d3ZoomHandler
				});
				d3Selection.on("wheel.zoom", wheelHandler, { passive: false });
				const startHandler = createPanZoomStartHandler({
					zoomPanValues,
					onDraggingChange,
					onPanZoomStart
				});
				d3ZoomInstance.on("start", startHandler);
				const panZoomHandler = createPanZoomHandler({
					zoomPanValues,
					panOnDrag,
					onPaneContextMenu: !!onPaneContextMenu,
					onPanZoom,
					onTransformChange
				});
				d3ZoomInstance.on("zoom", panZoomHandler);
				const panZoomEndHandler = createPanZoomEndHandler({
					zoomPanValues,
					panOnDrag,
					panOnScroll,
					onPaneContextMenu,
					onPanZoomEnd,
					onDraggingChange
				});
				d3ZoomInstance.on("end", panZoomEndHandler);
				const filter = createFilter({
					panActivationKeyPressed,
					zoomActivationKeyPressed,
					panOnDrag,
					zoomOnScroll,
					panOnScroll,
					zoomOnDoubleClick,
					zoomOnPinch,
					userSelectionActive,
					noPanClassName,
					noWheelClassName,
					lib,
					connectionInProgress
				});
				d3ZoomInstance.filter(filter);
				if (zoomOnDoubleClick) d3Selection.on("dblclick.zoom", d3DblClickZoomHandler);
				else d3Selection.on("dblclick.zoom", null);
			}
			function destroy() {
				d3ZoomInstance.on("zoom", null);
			}
			async function setViewportConstrained(viewport, extent, translateExtent) {
				const nextTransform = viewportToTransform(viewport);
				const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent);
				if (contrainedTransform) await setTransform(contrainedTransform);
				return contrainedTransform;
			}
			async function setViewport(viewport, options) {
				const nextTransform = viewportToTransform(viewport);
				await setTransform(nextTransform, options);
				return nextTransform;
			}
			function syncViewport(viewport) {
				if (d3Selection) {
					const nextTransform = viewportToTransform(viewport);
					const currentTransform = d3Selection.property("__zoom");
					if (currentTransform.k !== viewport.zoom || currentTransform.x !== viewport.x || currentTransform.y !== viewport.y) d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
				}
			}
			function getViewport() {
				const transform$1 = d3Selection ? transform(d3Selection.node()) : {
					x: 0,
					y: 0,
					k: 1
				};
				return {
					x: transform$1.x,
					y: transform$1.y,
					zoom: transform$1.k
				};
			}
			async function scaleTo(zoom, options) {
				if (d3Selection) return new Promise((resolve) => {
					d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).scaleTo(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), zoom);
				});
				return false;
			}
			async function scaleBy(factor, options) {
				if (d3Selection) return new Promise((resolve) => {
					d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).scaleBy(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), factor);
				});
				return false;
			}
			function setScaleExtent(scaleExtent) {
				d3ZoomInstance?.scaleExtent(scaleExtent);
			}
			function setTranslateExtent(translateExtent) {
				d3ZoomInstance?.translateExtent(translateExtent);
			}
			function setClickDistance(distance) {
				const validDistance = !isNumeric(distance) || distance < 0 ? 0 : distance;
				d3ZoomInstance?.clickDistance(validDistance);
			}
			return {
				update,
				destroy,
				setViewport,
				setViewportConstrained,
				getViewport,
				scaleTo,
				scaleBy,
				setScaleExtent,
				setTranslateExtent,
				syncViewport,
				setClickDistance
			};
		}
		/**
		* Used to determine the variant of the resize control
		*
		* @public
		*/
		var ResizeControlVariant;
		(function(ResizeControlVariant) {
			ResizeControlVariant["Line"] = "line";
			ResizeControlVariant["Handle"] = "handle";
		})(ResizeControlVariant || (ResizeControlVariant = {}));
		/**
		* Get all connecting edges for a given set of nodes
		* @param width - new width of the node
		* @param prevWidth - previous width of the node
		* @param height - new height of the node
		* @param prevHeight - previous height of the node
		* @param affectsX - whether to invert the resize direction for the x axis
		* @param affectsY - whether to invert the resize direction for the y axis
		* @returns array of two numbers representing the direction of the resize for each axis, 0 = no change, 1 = increase, -1 = decrease
		*/
		function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY }) {
			const deltaWidth = width - prevWidth;
			const deltaHeight = height - prevHeight;
			const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
			if (deltaWidth && affectsX) direction[0] = direction[0] * -1;
			if (deltaHeight && affectsY) direction[1] = direction[1] * -1;
			return direction;
		}
		/**
		* Parses the control position that is being dragged to dimensions that are being resized
		* @param controlPosition - position of the control that is being dragged
		* @returns isHorizontal, isVertical, affectsX, affectsY,
		*/
		function getControlDirection(controlPosition) {
			return {
				isHorizontal: controlPosition.includes("right") || controlPosition.includes("left"),
				isVertical: controlPosition.includes("bottom") || controlPosition.includes("top"),
				affectsX: controlPosition.includes("left"),
				affectsY: controlPosition.includes("top")
			};
		}
		function getLowerExtentClamp(lowerExtent, lowerBound) {
			return Math.max(0, lowerBound - lowerExtent);
		}
		function getUpperExtentClamp(upperExtent, upperBound) {
			return Math.max(0, upperExtent - upperBound);
		}
		function getSizeClamp(size, minSize, maxSize) {
			return Math.max(0, minSize - size, size - maxSize);
		}
		function xor(a, b) {
			return a ? !b : b;
		}
		/**
		* Calculates new width & height and x & y of node after resize based on pointer position
		* @description - Buckle up, this is a chunky one... If you want to determine the new dimensions of a node after a resize,
		* you have to account for all possible restrictions: min/max width/height of the node, the maximum extent the node is allowed
		* to move in (in this case: resize into) determined by the parent node, the minimal extent determined by child nodes
		* with expandParent or extent: 'parent' set and oh yeah, these things also have to work with keepAspectRatio!
		* The way this is done is by determining how much each of these restricting actually restricts the resize and then applying the
		* strongest restriction. Because the resize affects x, y and width, height and width, height of a opposing side with keepAspectRatio,
		* the resize amount is always kept in distX & distY amount (the distance in mouse movement)
		* Instead of clamping each value, we first calculate the biggest 'clamp' (for the lack of a better name) and then apply it to all values.
		* To complicate things nodeOrigin has to be taken into account as well. This is done by offsetting the nodes as if their origin is [0, 0],
		* then calculating the restrictions as usual
		* @param startValues - starting values of resize
		* @param controlDirection - dimensions affected by the resize
		* @param pointerPosition - the current pointer position corrected for snapping
		* @param boundaries - minimum and maximum dimensions of the node
		* @param keepAspectRatio - prevent changes of asprect ratio
		* @returns x, y, width and height of the node after resize
		*/
		function getDimensionsAfterResize(startValues, controlDirection, pointerPosition, boundaries, keepAspectRatio, nodeOrigin, extent, childExtent) {
			let { affectsX, affectsY } = controlDirection;
			const { isHorizontal, isVertical } = controlDirection;
			const isDiagonal = isHorizontal && isVertical;
			const { xSnapped, ySnapped } = pointerPosition;
			const { minWidth, maxWidth, minHeight, maxHeight } = boundaries;
			const { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio } = startValues;
			let distX = Math.floor(isHorizontal ? xSnapped - startValues.pointerX : 0);
			let distY = Math.floor(isVertical ? ySnapped - startValues.pointerY : 0);
			const newWidth = startWidth + (affectsX ? -distX : distX);
			const newHeight = startHeight + (affectsY ? -distY : distY);
			const originOffsetX = -nodeOrigin[0] * startWidth;
			const originOffsetY = -nodeOrigin[1] * startHeight;
			let clampX = getSizeClamp(newWidth, minWidth, maxWidth);
			let clampY = getSizeClamp(newHeight, minHeight, maxHeight);
			if (extent) {
				let xExtentClamp = 0;
				let yExtentClamp = 0;
				if (affectsX && distX < 0) xExtentClamp = getLowerExtentClamp(startX + distX + originOffsetX, extent[0][0]);
				else if (!affectsX && distX > 0) xExtentClamp = getUpperExtentClamp(startX + newWidth + originOffsetX, extent[1][0]);
				if (affectsY && distY < 0) yExtentClamp = getLowerExtentClamp(startY + distY + originOffsetY, extent[0][1]);
				else if (!affectsY && distY > 0) yExtentClamp = getUpperExtentClamp(startY + newHeight + originOffsetY, extent[1][1]);
				clampX = Math.max(clampX, xExtentClamp);
				clampY = Math.max(clampY, yExtentClamp);
			}
			if (childExtent) {
				let xExtentClamp = 0;
				let yExtentClamp = 0;
				if (affectsX && distX > 0) xExtentClamp = getUpperExtentClamp(startX + distX, childExtent[0][0]);
				else if (!affectsX && distX < 0) xExtentClamp = getLowerExtentClamp(startX + newWidth, childExtent[1][0]);
				if (affectsY && distY > 0) yExtentClamp = getUpperExtentClamp(startY + distY, childExtent[0][1]);
				else if (!affectsY && distY < 0) yExtentClamp = getLowerExtentClamp(startY + newHeight, childExtent[1][1]);
				clampX = Math.max(clampX, xExtentClamp);
				clampY = Math.max(clampY, yExtentClamp);
			}
			if (keepAspectRatio) {
				if (isHorizontal) {
					const aspectHeightClamp = getSizeClamp(newWidth / aspectRatio, minHeight, maxHeight) * aspectRatio;
					clampX = Math.max(clampX, aspectHeightClamp);
					if (extent) {
						let aspectExtentClamp = 0;
						if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) aspectExtentClamp = getUpperExtentClamp(startY + originOffsetY + newWidth / aspectRatio, extent[1][1]) * aspectRatio;
						else aspectExtentClamp = getLowerExtentClamp(startY + originOffsetY + (affectsX ? distX : -distX) / aspectRatio, extent[0][1]) * aspectRatio;
						clampX = Math.max(clampX, aspectExtentClamp);
					}
					if (childExtent) {
						let aspectExtentClamp = 0;
						if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) aspectExtentClamp = getLowerExtentClamp(startY + newWidth / aspectRatio, childExtent[1][1]) * aspectRatio;
						else aspectExtentClamp = getUpperExtentClamp(startY + (affectsX ? distX : -distX) / aspectRatio, childExtent[0][1]) * aspectRatio;
						clampX = Math.max(clampX, aspectExtentClamp);
					}
				}
				if (isVertical) {
					const aspectWidthClamp = getSizeClamp(newHeight * aspectRatio, minWidth, maxWidth) / aspectRatio;
					clampY = Math.max(clampY, aspectWidthClamp);
					if (extent) {
						let aspectExtentClamp = 0;
						if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) aspectExtentClamp = getUpperExtentClamp(startX + newHeight * aspectRatio + originOffsetX, extent[1][0]) / aspectRatio;
						else aspectExtentClamp = getLowerExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio + originOffsetX, extent[0][0]) / aspectRatio;
						clampY = Math.max(clampY, aspectExtentClamp);
					}
					if (childExtent) {
						let aspectExtentClamp = 0;
						if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) aspectExtentClamp = getLowerExtentClamp(startX + newHeight * aspectRatio, childExtent[1][0]) / aspectRatio;
						else aspectExtentClamp = getUpperExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio, childExtent[0][0]) / aspectRatio;
						clampY = Math.max(clampY, aspectExtentClamp);
					}
				}
			}
			distY = distY + (distY < 0 ? clampY : -clampY);
			distX = distX + (distX < 0 ? clampX : -clampX);
			if (keepAspectRatio) if (isDiagonal) if (newWidth > newHeight * aspectRatio) distY = (xor(affectsX, affectsY) ? -distX : distX) / aspectRatio;
			else distX = (xor(affectsX, affectsY) ? -distY : distY) * aspectRatio;
			else if (isHorizontal) {
				distY = distX / aspectRatio;
				affectsY = affectsX;
			} else {
				distX = distY * aspectRatio;
				affectsX = affectsY;
			}
			const x = affectsX ? startX + distX : startX;
			const y = affectsY ? startY + distY : startY;
			return {
				width: startWidth + (affectsX ? -distX : distX),
				height: startHeight + (affectsY ? -distY : distY),
				x: nodeOrigin[0] * distX * (!affectsX ? 1 : -1) + x,
				y: nodeOrigin[1] * distY * (!affectsY ? 1 : -1) + y
			};
		}
		const initPrevValues$1 = {
			width: 0,
			height: 0,
			x: 0,
			y: 0
		};
		const initStartValues = {
			...initPrevValues$1,
			pointerX: 0,
			pointerY: 0,
			aspectRatio: 1
		};
		function nodeToChildExtent(child, parent, nodeOrigin) {
			const x = parent.position.x + child.position.x;
			const y = parent.position.y + child.position.y;
			const width = child.measured.width ?? 0;
			const height = child.measured.height ?? 0;
			const originOffsetX = nodeOrigin[0] * width;
			const originOffsetY = nodeOrigin[1] * height;
			return [[x - originOffsetX, y - originOffsetY], [x + width - originOffsetX, y + height - originOffsetY]];
		}
		function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }) {
			const selection = select_default$1(domNode);
			let params = {
				controlDirection: getControlDirection("bottom-right"),
				boundaries: {
					minWidth: 0,
					minHeight: 0,
					maxWidth: Number.MAX_VALUE,
					maxHeight: Number.MAX_VALUE
				},
				resizeDirection: void 0,
				keepAspectRatio: false
			};
			function update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize }) {
				let prevValues = { ...initPrevValues$1 };
				let startValues = { ...initStartValues };
				params = {
					boundaries,
					resizeDirection,
					keepAspectRatio,
					controlDirection: getControlDirection(controlPosition)
				};
				let node = void 0;
				let containerBounds = null;
				let childNodes = [];
				let parentNode = void 0;
				let nodeExtent = void 0;
				let childExtent = void 0;
				const dragHandler = drag_default().on("start", (event) => {
					const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, paneDomNode } = getStoreItems();
					node = nodeLookup.get(nodeId);
					if (!node) return;
					containerBounds = paneDomNode?.getBoundingClientRect() ?? null;
					const { xSnapped, ySnapped } = getPointerPosition(event.sourceEvent, {
						transform,
						snapGrid,
						snapToGrid,
						containerBounds
					});
					prevValues = {
						width: node.measured.width ?? 0,
						height: node.measured.height ?? 0,
						x: node.position.x ?? 0,
						y: node.position.y ?? 0
					};
					startValues = {
						...prevValues,
						pointerX: xSnapped,
						pointerY: ySnapped,
						aspectRatio: prevValues.width / prevValues.height
					};
					parentNode = void 0;
					nodeExtent = isCoordinateExtent(node.extent) ? node.extent : void 0;
					if (node.parentId && (node.extent === "parent" || node.expandParent)) parentNode = nodeLookup.get(node.parentId);
					if (parentNode && node.extent === "parent") nodeExtent = [[0, 0], [parentNode.measured.width, parentNode.measured.height]];
					childNodes = [];
					childExtent = void 0;
					for (const [childId, child] of nodeLookup) if (child.parentId === nodeId) {
						childNodes.push({
							id: childId,
							position: { ...child.position },
							extent: child.extent
						});
						if (child.extent === "parent" || child.expandParent) {
							const extent = nodeToChildExtent(child, node, child.origin ?? nodeOrigin);
							if (childExtent) childExtent = [[Math.min(extent[0][0], childExtent[0][0]), Math.min(extent[0][1], childExtent[0][1])], [Math.max(extent[1][0], childExtent[1][0]), Math.max(extent[1][1], childExtent[1][1])]];
							else childExtent = extent;
						}
					}
					onResizeStart?.(event, { ...prevValues });
				}).on("drag", (event) => {
					const { transform, snapGrid, snapToGrid, nodeOrigin: storeNodeOrigin } = getStoreItems();
					const pointerPosition = getPointerPosition(event.sourceEvent, {
						transform,
						snapGrid,
						snapToGrid,
						containerBounds
					});
					const childChanges = [];
					if (!node) return;
					const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues;
					const change = {};
					const nodeOrigin = node.origin ?? storeNodeOrigin;
					const { width, height, x, y } = getDimensionsAfterResize(startValues, params.controlDirection, pointerPosition, params.boundaries, params.keepAspectRatio, nodeOrigin, nodeExtent, childExtent);
					const isWidthChange = width !== prevWidth;
					const isHeightChange = height !== prevHeight;
					const isXPosChange = x !== prevX && isWidthChange;
					const isYPosChange = y !== prevY && isHeightChange;
					if (!isXPosChange && !isYPosChange && !isWidthChange && !isHeightChange) return;
					const lastValid = {
						prevValues: { ...prevValues },
						startX: startValues.x,
						startY: startValues.y,
						childNodes: childNodes.map((child) => ({
							...child,
							position: { ...child.position }
						}))
					};
					if (isXPosChange || isYPosChange || nodeOrigin[0] === 1 || nodeOrigin[1] === 1) {
						change.x = isXPosChange ? x : prevValues.x;
						change.y = isYPosChange ? y : prevValues.y;
						prevValues.x = change.x;
						prevValues.y = change.y;
						if (childNodes.length > 0) {
							const xChange = x - prevX;
							const yChange = y - prevY;
							for (const childNode of childNodes) {
								childNode.position = {
									x: childNode.position.x - xChange + nodeOrigin[0] * (width - prevWidth),
									y: childNode.position.y - yChange + nodeOrigin[1] * (height - prevHeight)
								};
								childChanges.push(childNode);
							}
						}
					}
					if (isWidthChange || isHeightChange) {
						change.width = isWidthChange && (!params.resizeDirection || params.resizeDirection === "horizontal") ? width : prevValues.width;
						change.height = isHeightChange && (!params.resizeDirection || params.resizeDirection === "vertical") ? height : prevValues.height;
						prevValues.width = change.width;
						prevValues.height = change.height;
					}
					if (parentNode && node.expandParent) {
						const xLimit = nodeOrigin[0] * (change.width ?? 0);
						if (change.x && change.x < xLimit) {
							prevValues.x = xLimit;
							startValues.x = startValues.x - (change.x - xLimit);
						}
						const yLimit = nodeOrigin[1] * (change.height ?? 0);
						if (change.y && change.y < yLimit) {
							prevValues.y = yLimit;
							startValues.y = startValues.y - (change.y - yLimit);
						}
					}
					const direction = getResizeDirection({
						width: prevValues.width,
						prevWidth,
						height: prevValues.height,
						prevHeight,
						affectsX: params.controlDirection.affectsX,
						affectsY: params.controlDirection.affectsY
					});
					const nextValues = {
						...prevValues,
						direction
					};
					if (shouldResize?.(event, nextValues) === false) {
						prevValues = lastValid.prevValues;
						startValues.x = lastValid.startX;
						startValues.y = lastValid.startY;
						childNodes.forEach((child, i) => {
							child.position = lastValid.childNodes[i].position;
						});
						return;
					}
					onResize?.(event, nextValues);
					onChange(change, childChanges);
				}).on("end", (event) => {
					onResizeEnd?.(event, { ...prevValues });
					onEnd?.({ ...prevValues });
				});
				selection.call(dragHandler);
			}
			function destroy() {
				selection.on(".drag", null);
			}
			return {
				update,
				destroy
			};
		}
		//#endregion
		//#region ../../node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
		/**
		* @license React
		* use-sync-external-store-shim.production.js
		*
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*/
		var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJSMin(((exports) => {
			var React$1 = require("react");
			function is(x, y) {
				return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
			}
			var objectIs = "function" === typeof Object.is ? Object.is : is, useState = React$1.useState, useEffect = React$1.useEffect, useLayoutEffect = React$1.useLayoutEffect, useDebugValue = React$1.useDebugValue;
			function useSyncExternalStore$2(subscribe, getSnapshot) {
				var value = getSnapshot(), _useState = useState({ inst: {
					value,
					getSnapshot
				} }), inst = _useState[0].inst, forceUpdate = _useState[1];
				useLayoutEffect(function() {
					inst.value = value;
					inst.getSnapshot = getSnapshot;
					checkIfSnapshotChanged(inst) && forceUpdate({ inst });
				}, [
					subscribe,
					value,
					getSnapshot
				]);
				useEffect(function() {
					checkIfSnapshotChanged(inst) && forceUpdate({ inst });
					return subscribe(function() {
						checkIfSnapshotChanged(inst) && forceUpdate({ inst });
					});
				}, [subscribe]);
				useDebugValue(value);
				return value;
			}
			function checkIfSnapshotChanged(inst) {
				var latestGetSnapshot = inst.getSnapshot;
				inst = inst.value;
				try {
					var nextValue = latestGetSnapshot();
					return !objectIs(inst, nextValue);
				} catch (error) {
					return !0;
				}
			}
			function useSyncExternalStore$1(subscribe, getSnapshot) {
				return getSnapshot();
			}
			var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
			exports.useSyncExternalStore = void 0 !== React$1.useSyncExternalStore ? React$1.useSyncExternalStore : shim;
		}));
		//#endregion
		//#region ../../node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/shim/index.js
		var require_shim = /* @__PURE__ */ __commonJSMin(((exports, module) => {
			module.exports = require_use_sync_external_store_shim_production();
		}));
		//#endregion
		//#region ../../node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
		/**
		* @license React
		* use-sync-external-store-shim/with-selector.production.js
		*
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*/
		var require_with_selector_production = /* @__PURE__ */ __commonJSMin(((exports) => {
			var React = require("react"), shim = require_shim();
			function is(x, y) {
				return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
			}
			var objectIs = "function" === typeof Object.is ? Object.is : is, useSyncExternalStore = shim.useSyncExternalStore, useRef = React.useRef, useEffect = React.useEffect, useMemo = React.useMemo, useDebugValue = React.useDebugValue;
			exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
				var instRef = useRef(null);
				if (null === instRef.current) {
					var inst = {
						hasValue: !1,
						value: null
					};
					instRef.current = inst;
				} else inst = instRef.current;
				instRef = useMemo(function() {
					function memoizedSelector(nextSnapshot) {
						if (!hasMemo) {
							hasMemo = !0;
							memoizedSnapshot = nextSnapshot;
							nextSnapshot = selector(nextSnapshot);
							if (void 0 !== isEqual && inst.hasValue) {
								var currentSelection = inst.value;
								if (isEqual(currentSelection, nextSnapshot)) return memoizedSelection = currentSelection;
							}
							return memoizedSelection = nextSnapshot;
						}
						currentSelection = memoizedSelection;
						if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
						var nextSelection = selector(nextSnapshot);
						if (void 0 !== isEqual && isEqual(currentSelection, nextSelection)) return memoizedSnapshot = nextSnapshot, currentSelection;
						memoizedSnapshot = nextSnapshot;
						return memoizedSelection = nextSelection;
					}
					var hasMemo = !1, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
					return [function() {
						return memoizedSelector(getSnapshot());
					}, null === maybeGetServerSnapshot ? void 0 : function() {
						return memoizedSelector(maybeGetServerSnapshot());
					}];
				}, [
					getSnapshot,
					getServerSnapshot,
					selector,
					isEqual
				]);
				var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
				useEffect(function() {
					inst.hasValue = !0;
					inst.value = value;
				}, [value]);
				useDebugValue(value);
				return value;
			};
		}));
		//#endregion
		//#region ../../node_modules/.pnpm/zustand@4.5.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/vanilla.mjs
		var import_with_selector = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
			module.exports = require_with_selector_production();
		})))(), 1);
		const createStoreImpl = (createState) => {
			let state;
			const listeners = /* @__PURE__ */ new Set();
			const setState = (partial, replace) => {
				const nextState = typeof partial === "function" ? partial(state) : partial;
				if (!Object.is(nextState, state)) {
					const previousState = state;
					state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
					listeners.forEach((listener) => listener(state, previousState));
				}
			};
			const getState = () => state;
			const getInitialState = () => initialState;
			const subscribe = (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			};
			const destroy = () => {
				if (({}.env ? {}.env.MODE : void 0) !== "production") console.warn("[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected.");
				listeners.clear();
			};
			const api = {
				setState,
				getState,
				getInitialState,
				subscribe,
				destroy
			};
			const initialState = state = createState(setState, getState, api);
			return api;
		};
		const createStore$1 = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;
		//#endregion
		//#region ../../node_modules/.pnpm/zustand@4.5.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/traditional.mjs
		const { useDebugValue } = react.default;
		const { useSyncExternalStoreWithSelector } = import_with_selector.default;
		const identity = (arg) => arg;
		function useStoreWithEqualityFn(api, selector = identity, equalityFn) {
			const slice = useSyncExternalStoreWithSelector(api.subscribe, api.getState, api.getServerState || api.getInitialState, selector, equalityFn);
			useDebugValue(slice);
			return slice;
		}
		const createWithEqualityFnImpl = (createState, defaultEqualityFn) => {
			const api = createStore$1(createState);
			const useBoundStoreWithEqualityFn = (selector, equalityFn = defaultEqualityFn) => useStoreWithEqualityFn(api, selector, equalityFn);
			Object.assign(useBoundStoreWithEqualityFn, api);
			return useBoundStoreWithEqualityFn;
		};
		const createWithEqualityFn = (createState, defaultEqualityFn) => createState ? createWithEqualityFnImpl(createState, defaultEqualityFn) : createWithEqualityFnImpl;
		//#endregion
		//#region ../../node_modules/.pnpm/zustand@4.5.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/shallow.mjs
		function shallow$1(objA, objB) {
			if (Object.is(objA, objB)) return true;
			if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) return false;
			if (objA instanceof Map && objB instanceof Map) {
				if (objA.size !== objB.size) return false;
				for (const [key, value] of objA) if (!Object.is(value, objB.get(key))) return false;
				return true;
			}
			if (objA instanceof Set && objB instanceof Set) {
				if (objA.size !== objB.size) return false;
				for (const value of objA) if (!objB.has(value)) return false;
				return true;
			}
			const keysA = Object.keys(objA);
			if (keysA.length !== Object.keys(objB).length) return false;
			for (const keyA of keysA) if (!Object.prototype.hasOwnProperty.call(objB, keyA) || !Object.is(objA[keyA], objB[keyA])) return false;
			return true;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/@xyflow+react@12.12.0_@type_049fda8e489a1a01e7bb16c2d1151725/node_modules/@xyflow/react/dist/esm/index.js
		const StoreContext = (0, react.createContext)(null);
		const Provider$1 = StoreContext.Provider;
		const zustandErrorMessage = errorMessages["error001"]("react");
		/**
		* This hook can be used to subscribe to internal state changes of the React Flow
		* component. The `useStore` hook is re-exported from the [Zustand](https://github.com/pmndrs/zustand)
		* state management library, so you should check out their docs for more details.
		*
		* @public
		* @param selector - A selector function that returns a slice of the flow's internal state.
		* Extracting or transforming just the state you need is a good practice to avoid unnecessary
		* re-renders.
		* @param equalityFn - A function to compare the previous and next value. This is incredibly useful
		* for preventing unnecessary re-renders. Good sensible defaults are using `Object.is` or importing
		* `zustand/shallow`, but you can be as granular as you like.
		* @returns The selected state slice.
		*
		* @example
		* ```ts
		* const nodes = useStore((state) => state.nodes);
		* ```
		*
		* @remarks This hook should only be used if there is no other way to access the internal
		* state. For many of the common use cases, there are dedicated hooks available
		* such as {@link useReactFlow}, {@link useViewport}, etc.
		*/
		function useStore(selector, equalityFn) {
			const store = (0, react.useContext)(StoreContext);
			if (store === null) throw new Error(zustandErrorMessage);
			return useStoreWithEqualityFn(store, selector, equalityFn);
		}
		/**
		* In some cases, you might need to access the store directly. This hook returns the store object which can be used on demand to access the state or dispatch actions.
		*
		* @returns The store object.
		* @example
		* ```ts
		* const store = useStoreApi();
		* ```
		*
		* @remarks This hook should only be used if there is no other way to access the internal
		* state. For many of the common use cases, there are dedicated hooks available
		* such as {@link useReactFlow}, {@link useViewport}, etc.
		*/
		function useStoreApi() {
			const store = (0, react.useContext)(StoreContext);
			if (store === null) throw new Error(zustandErrorMessage);
			return (0, react.useMemo)(() => ({
				getState: store.getState,
				setState: store.setState,
				subscribe: store.subscribe
			}), [store]);
		}
		const style = { display: "none" };
		const ariaLiveStyle = {
			position: "absolute",
			width: 1,
			height: 1,
			margin: -1,
			border: 0,
			padding: 0,
			overflow: "hidden",
			clip: "rect(0px, 0px, 0px, 0px)",
			clipPath: "inset(100%)"
		};
		const ARIA_NODE_DESC_KEY = "react-flow__node-desc";
		const ARIA_EDGE_DESC_KEY = "react-flow__edge-desc";
		const ARIA_LIVE_MESSAGE = "react-flow__aria-live";
		const ariaLiveSelector = (s) => s.ariaLiveMessage;
		const ariaLabelConfigSelector = (s) => s.ariaLabelConfig;
		function AriaLiveMessage({ rfId }) {
			const ariaLiveMessage = useStore(ariaLiveSelector);
			return (0, react_jsx_runtime.jsx)("div", {
				id: `${ARIA_LIVE_MESSAGE}-${rfId}`,
				"aria-live": "assertive",
				"aria-atomic": "true",
				style: ariaLiveStyle,
				children: ariaLiveMessage
			});
		}
		function A11yDescriptions({ rfId, disableKeyboardA11y }) {
			const ariaLabelConfig = useStore(ariaLabelConfigSelector);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("div", {
					id: `${ARIA_NODE_DESC_KEY}-${rfId}`,
					style,
					children: disableKeyboardA11y ? ariaLabelConfig["node.a11yDescription.default"] : ariaLabelConfig["node.a11yDescription.keyboardDisabled"]
				}),
				(0, react_jsx_runtime.jsx)("div", {
					id: `${ARIA_EDGE_DESC_KEY}-${rfId}`,
					style,
					children: ariaLabelConfig["edge.a11yDescription.default"]
				}),
				!disableKeyboardA11y && (0, react_jsx_runtime.jsx)(AriaLiveMessage, { rfId })
			] });
		}
		/**
		* The `<Panel />` component helps you position content above the viewport.
		* It is used internally by the [`<MiniMap />`](/api-reference/components/minimap)
		* and [`<Controls />`](/api-reference/components/controls) components.
		*
		* @public
		*
		* @example
		* ```jsx
		*import { ReactFlow, Background, Panel } from '@xyflow/react';
		*
		*export default function Flow() {
		*  return (
		*    <ReactFlow nodes={[]} fitView>
		*      <Panel position="top-left">top-left</Panel>
		*      <Panel position="top-center">top-center</Panel>
		*      <Panel position="top-right">top-right</Panel>
		*      <Panel position="bottom-left">bottom-left</Panel>
		*      <Panel position="bottom-center">bottom-center</Panel>
		*      <Panel position="bottom-right">bottom-right</Panel>
		*    </ReactFlow>
		*  );
		*}
		*```
		*/
		const Panel = (0, react.forwardRef)(({ position = "top-left", children, className, style, ...rest }, ref) => {
			return (0, react_jsx_runtime.jsx)("div", {
				className: cc([
					"react-flow__panel",
					className,
					...`${position}`.split("-")
				]),
				style,
				ref,
				...rest,
				children
			});
		});
		Panel.displayName = "Panel";
		const link = `https://reactflow.dev?utm_source=attribution`;
		/**
		* React Flow is independent and entirely funded by its users.
		* If you hide the attribution, please support our work by subscribing to React Flow Pro: https://reactflow.dev/remove-attribution
		*/
		function Attribution({ proOptions, position = "bottom-right" }) {
			(0, react.useEffect)(() => {}, []);
			if (proOptions?.hideAttribution) return null;
			return (0, react_jsx_runtime.jsx)(Panel, {
				position,
				className: "react-flow__attribution",
				"data-message": `Please only hide this attribution when you are subscribed to React Flow Pro: ${link}`,
				children: (0, react_jsx_runtime.jsx)("a", {
					href: link,
					target: "_blank",
					rel: "noopener noreferrer",
					"aria-label": "React Flow attribution",
					children: "React Flow"
				})
			});
		}
		const selector$l = (s) => {
			const selectedNodes = [];
			const selectedEdges = [];
			for (const [, node] of s.nodeLookup) if (node.selected) selectedNodes.push(node.internals.userNode);
			for (const [, edge] of s.edgeLookup) if (edge.selected) selectedEdges.push(edge);
			return {
				selectedNodes,
				selectedEdges
			};
		};
		const selectId = (obj) => obj.id;
		function areEqual$1(a, b) {
			return shallow$1(a.selectedNodes.map(selectId), b.selectedNodes.map(selectId)) && shallow$1(a.selectedEdges.map(selectId), b.selectedEdges.map(selectId));
		}
		function SelectionListenerInner({ onSelectionChange }) {
			const store = useStoreApi();
			const { selectedNodes, selectedEdges } = useStore(selector$l, areEqual$1);
			(0, react.useEffect)(() => {
				const params = {
					nodes: selectedNodes,
					edges: selectedEdges
				};
				onSelectionChange?.(params);
				store.getState().onSelectionChangeHandlers.forEach((fn) => fn(params));
			}, [
				selectedNodes,
				selectedEdges,
				onSelectionChange
			]);
			return null;
		}
		const changeSelector = (s) => !!s.onSelectionChangeHandlers;
		function SelectionListener({ onSelectionChange }) {
			const storeHasSelectionChangeHandlers = useStore(changeSelector);
			if (onSelectionChange || storeHasSelectionChangeHandlers) return (0, react_jsx_runtime.jsx)(SelectionListenerInner, { onSelectionChange });
			return null;
		}
		const defaultNodeOrigin = [0, 0];
		const defaultViewport = {
			x: 0,
			y: 0,
			zoom: 1
		};
		const fieldsToTrack = [...[
			"nodes",
			"edges",
			"defaultNodes",
			"defaultEdges",
			"onConnect",
			"onConnectStart",
			"onConnectEnd",
			"onClickConnectStart",
			"onClickConnectEnd",
			"nodesDraggable",
			"autoPanOnNodeFocus",
			"nodesConnectable",
			"nodesFocusable",
			"edgesFocusable",
			"edgesReconnectable",
			"elevateNodesOnSelect",
			"elevateEdgesOnSelect",
			"minZoom",
			"maxZoom",
			"nodeExtent",
			"onNodesChange",
			"onEdgesChange",
			"elementsSelectable",
			"connectionMode",
			"snapGrid",
			"snapToGrid",
			"translateExtent",
			"connectOnClick",
			"defaultEdgeOptions",
			"fitView",
			"fitViewOptions",
			"onNodesDelete",
			"onEdgesDelete",
			"onDelete",
			"onNodeDrag",
			"onNodeDragStart",
			"onNodeDragStop",
			"onSelectionDrag",
			"onSelectionDragStart",
			"onSelectionDragStop",
			"onMoveStart",
			"onMove",
			"onMoveEnd",
			"noPanClassName",
			"nodeOrigin",
			"autoPanOnConnect",
			"autoPanOnNodeDrag",
			"onError",
			"connectionRadius",
			"isValidConnection",
			"selectNodesOnDrag",
			"nodeDragThreshold",
			"connectionDragThreshold",
			"onBeforeDelete",
			"debug",
			"autoPanSpeed",
			"ariaLabelConfig",
			"zIndexMode"
		], "rfId"];
		const selector$k = (s) => ({
			setNodes: s.setNodes,
			setEdges: s.setEdges,
			setMinZoom: s.setMinZoom,
			setMaxZoom: s.setMaxZoom,
			setTranslateExtent: s.setTranslateExtent,
			setNodeExtent: s.setNodeExtent,
			reset: s.reset,
			setDefaultNodesAndEdges: s.setDefaultNodesAndEdges
		});
		const initPrevValues = {
			translateExtent: infiniteExtent,
			nodeOrigin: defaultNodeOrigin,
			minZoom: .5,
			maxZoom: 2,
			elementsSelectable: true,
			noPanClassName: "nopan",
			rfId: "1"
		};
		function StoreUpdater(props) {
			const { setNodes, setEdges, setMinZoom, setMaxZoom, setTranslateExtent, setNodeExtent, reset, setDefaultNodesAndEdges } = useStore(selector$k, shallow$1);
			const store = useStoreApi();
			(0, react.useEffect)(() => {
				setDefaultNodesAndEdges(props.defaultNodes, props.defaultEdges);
				return () => {
					previousFields.current = initPrevValues;
					reset();
				};
			}, []);
			const previousFields = (0, react.useRef)(initPrevValues);
			(0, react.useEffect)(() => {
				for (const fieldName of fieldsToTrack) {
					const fieldValue = props[fieldName];
					if (fieldValue === previousFields.current[fieldName]) continue;
					if (typeof props[fieldName] === "undefined") continue;
					if (fieldName === "nodes") setNodes(fieldValue);
					else if (fieldName === "edges") setEdges(fieldValue);
					else if (fieldName === "minZoom") setMinZoom(fieldValue);
					else if (fieldName === "maxZoom") setMaxZoom(fieldValue);
					else if (fieldName === "translateExtent") setTranslateExtent(fieldValue);
					else if (fieldName === "nodeExtent") setNodeExtent(fieldValue);
					else if (fieldName === "ariaLabelConfig") store.setState({ ariaLabelConfig: mergeAriaLabelConfig(fieldValue) });
					else if (fieldName === "fitView") store.setState({ fitViewQueued: fieldValue });
					else if (fieldName === "fitViewOptions") store.setState({ fitViewOptions: fieldValue });
					else store.setState({ [fieldName]: fieldValue });
				}
				previousFields.current = props;
			}, fieldsToTrack.map((fieldName) => props[fieldName]));
			return null;
		}
		function getMediaQuery() {
			if (typeof window === "undefined" || !window.matchMedia) return null;
			return window.matchMedia("(prefers-color-scheme: dark)");
		}
		/**
		* Hook for receiving the current color mode class 'dark' or 'light'.
		*
		* @internal
		* @param colorMode - The color mode to use ('dark', 'light' or 'system')
		*/
		function useColorModeClass(colorMode) {
			const [colorModeClass, setColorModeClass] = (0, react.useState)(colorMode === "system" ? null : colorMode);
			(0, react.useEffect)(() => {
				if (colorMode !== "system") {
					setColorModeClass(colorMode);
					return;
				}
				const mediaQuery = getMediaQuery();
				const updateColorModeClass = () => setColorModeClass(mediaQuery?.matches ? "dark" : "light");
				updateColorModeClass();
				mediaQuery?.addEventListener("change", updateColorModeClass);
				return () => {
					mediaQuery?.removeEventListener("change", updateColorModeClass);
				};
			}, [colorMode]);
			return colorModeClass !== null ? colorModeClass : getMediaQuery()?.matches ? "dark" : "light";
		}
		const defaultDoc = typeof document !== "undefined" ? document : null;
		/**
		* This hook lets you listen for specific key codes and tells you whether they are
		* currently pressed or not.
		*
		* @public
		* @param options - Options
		*
		* @example
		* ```tsx
		*import { useKeyPress } from '@xyflow/react';
		*
		*export default function () {
		*  const spacePressed = useKeyPress('Space');
		*  const cmdAndSPressed = useKeyPress(['Meta+s', 'Strg+s']);
		*
		*  return (
		*    <div>
		*     {spacePressed && <p>Space pressed!</p>}
		*     {cmdAndSPressed && <p>Cmd + S pressed!</p>}
		*    </div>
		*  );
		*}
		*```
		*/
		function useKeyPress(keyCode = null, options = {
			target: defaultDoc,
			actInsideInputWithModifier: true
		}) {
			const [keyPressed, setKeyPressed] = (0, react.useState)(false);
			const modifierPressed = (0, react.useRef)(false);
			const pressedKeys = (0, react.useRef)(/* @__PURE__ */ new Set([]));
			const [keyCodes, keysToWatch] = (0, react.useMemo)(() => {
				if (keyCode !== null) {
					const keys = (Array.isArray(keyCode) ? keyCode : [keyCode]).filter((kc) => typeof kc === "string").map((kc) => kc.replace(/\+/g, "\n").replace("\n\n", "\n+").split("\n"));
					return [keys, keys.reduce((res, item) => res.concat(...item), [])];
				}
				return [[], []];
			}, [keyCode]);
			(0, react.useEffect)(() => {
				const target = options?.target ?? defaultDoc;
				const actInsideInputWithModifier = options?.actInsideInputWithModifier ?? true;
				if (keyCode !== null) {
					const downHandler = (event) => {
						modifierPressed.current = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
						if ((!modifierPressed.current || modifierPressed.current && !actInsideInputWithModifier) && isInputDOMNode(event)) return false;
						const keyOrCode = useKeyOrCode(event.code, keysToWatch);
						pressedKeys.current.add(event[keyOrCode]);
						if (isMatchingKey(keyCodes, pressedKeys.current, false)) {
							const target = event.composedPath?.()?.[0] || event.target;
							const isInteractiveElement = target?.nodeName === "BUTTON" || target?.nodeName === "A";
							if (options.preventDefault !== false && (modifierPressed.current || !isInteractiveElement)) event.preventDefault();
							setKeyPressed(true);
						}
					};
					const upHandler = (event) => {
						const keyOrCode = useKeyOrCode(event.code, keysToWatch);
						if (isMatchingKey(keyCodes, pressedKeys.current, true)) {
							setKeyPressed(false);
							pressedKeys.current.clear();
						} else pressedKeys.current.delete(event[keyOrCode]);
						if (event.key === "Meta") pressedKeys.current.clear();
						modifierPressed.current = false;
					};
					const resetHandler = () => {
						pressedKeys.current.clear();
						setKeyPressed(false);
					};
					target?.addEventListener("keydown", downHandler);
					target?.addEventListener("keyup", upHandler);
					window.addEventListener("blur", resetHandler);
					window.addEventListener("contextmenu", resetHandler);
					return () => {
						target?.removeEventListener("keydown", downHandler);
						target?.removeEventListener("keyup", upHandler);
						window.removeEventListener("blur", resetHandler);
						window.removeEventListener("contextmenu", resetHandler);
					};
				}
			}, [keyCode, setKeyPressed]);
			return keyPressed;
		}
		function isMatchingKey(keyCodes, pressedKeys, isUp) {
			return keyCodes.filter((keys) => isUp || keys.length === pressedKeys.size).some((keys) => keys.every((k) => pressedKeys.has(k)));
		}
		function useKeyOrCode(eventCode, keysToWatch) {
			return keysToWatch.includes(eventCode) ? "code" : "key";
		}
		/**
		* Hook for getting viewport helper functions.
		*
		* @internal
		* @returns viewport helper functions
		*/
		const useViewportHelper = () => {
			const store = useStoreApi();
			return (0, react.useMemo)(() => {
				return {
					zoomIn: async (options) => {
						const { panZoom } = store.getState();
						return panZoom ? panZoom.scaleBy(1.2, options) : false;
					},
					zoomOut: async (options) => {
						const { panZoom } = store.getState();
						return panZoom ? panZoom.scaleBy(1 / 1.2, options) : false;
					},
					zoomTo: async (zoomLevel, options) => {
						const { panZoom } = store.getState();
						return panZoom ? panZoom.scaleTo(zoomLevel, options) : false;
					},
					getZoom: () => store.getState().transform[2],
					setViewport: async (viewport, options) => {
						const { transform: [tX, tY, tZoom], panZoom } = store.getState();
						if (!panZoom) return false;
						await panZoom.setViewport({
							x: viewport.x ?? tX,
							y: viewport.y ?? tY,
							zoom: viewport.zoom ?? tZoom
						}, options);
						return true;
					},
					getViewport: () => {
						const [x, y, zoom] = store.getState().transform;
						return {
							x,
							y,
							zoom
						};
					},
					setCenter: async (x, y, options) => {
						return store.getState().setCenter(x, y, options);
					},
					fitBounds: async (bounds, options) => {
						const { width, height, minZoom, maxZoom, panZoom } = store.getState();
						const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, options?.padding ?? .1);
						if (!panZoom) return false;
						await panZoom.setViewport(viewport, {
							duration: options?.duration,
							ease: options?.ease,
							interpolate: options?.interpolate
						});
						return true;
					},
					screenToFlowPosition: (clientPosition, options = {}) => {
						const { transform, snapGrid, snapToGrid, domNode } = store.getState();
						if (!domNode) return clientPosition;
						const { x: domX, y: domY } = domNode.getBoundingClientRect();
						const correctedPosition = {
							x: clientPosition.x - domX,
							y: clientPosition.y - domY
						};
						const _snapGrid = options.snapGrid ?? snapGrid;
						return pointToRendererPoint(correctedPosition, transform, options.snapToGrid ?? snapToGrid, _snapGrid);
					},
					flowToScreenPosition: (flowPosition) => {
						const { transform, domNode } = store.getState();
						if (!domNode) return flowPosition;
						const { x: domX, y: domY } = domNode.getBoundingClientRect();
						const rendererPosition = rendererPointToPoint(flowPosition, transform);
						return {
							x: rendererPosition.x + domX,
							y: rendererPosition.y + domY
						};
					}
				};
			}, []);
		};
		function applyChanges(changes, elements) {
			const updatedElements = [];
			const changesMap = /* @__PURE__ */ new Map();
			const addItemChanges = [];
			for (const change of changes) if (change.type === "add") {
				addItemChanges.push(change);
				continue;
			} else if (change.type === "remove" || change.type === "replace") changesMap.set(change.id, [change]);
			else {
				const elementChanges = changesMap.get(change.id);
				if (elementChanges) elementChanges.push(change);
				else changesMap.set(change.id, [change]);
			}
			for (const element of elements) {
				const changes = changesMap.get(element.id);
				if (!changes) {
					updatedElements.push(element);
					continue;
				}
				if (changes[0].type === "remove") continue;
				if (changes[0].type === "replace") {
					updatedElements.push({ ...changes[0].item });
					continue;
				}
				/**
				* For other types of changes, we want to start with a shallow copy of the
				* object so React knows this element has changed. Sequential changes will
				* each _mutate_ this object, so there's only ever one copy.
				*/
				const updatedElement = { ...element };
				for (const change of changes) applyChange(change, updatedElement);
				updatedElements.push(updatedElement);
			}
			if (addItemChanges.length) addItemChanges.forEach((change) => {
				if (change.index !== void 0) updatedElements.splice(change.index, 0, { ...change.item });
				else updatedElements.push({ ...change.item });
			});
			return updatedElements;
		}
		function applyChange(change, element) {
			switch (change.type) {
				case "select":
					element.selected = change.selected;
					break;
				case "position":
					if (typeof change.position !== "undefined") element.position = change.position;
					if (typeof change.dragging !== "undefined") element.dragging = change.dragging;
					break;
				case "dimensions":
					if (typeof change.dimensions !== "undefined") {
						element.measured = { ...change.dimensions };
						if (change.setAttributes) {
							if (change.setAttributes === true || change.setAttributes === "width") element.width = change.dimensions.width;
							if (change.setAttributes === true || change.setAttributes === "height") element.height = change.dimensions.height;
						}
					}
					if (typeof change.resizing === "boolean") element.resizing = change.resizing;
					break;
			}
		}
		/**
		* Drop in function that applies node changes to an array of nodes.
		* @public
		* @param changes - Array of changes to apply.
		* @param nodes - Array of nodes to apply the changes to.
		* @returns Array of updated nodes.
		* @example
		*```tsx
		*import { useState, useCallback } from 'react';
		*import { ReactFlow, applyNodeChanges, type Node, type Edge, type OnNodesChange } from '@xyflow/react';
		*
		*export default function Flow() {
		*  const [nodes, setNodes] = useState<Node[]>([]);
		*  const [edges, setEdges] = useState<Edge[]>([]);
		*  const onNodesChange: OnNodesChange = useCallback(
		*    (changes) => {
		*      setNodes((oldNodes) => applyNodeChanges(changes, oldNodes));
		*    },
		*    [setNodes],
		*  );
		*
		*  return (
		*    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
		*  );
		*}
		*```
		* @remarks Various events on the <ReactFlow /> component can produce an {@link NodeChange}
		* that describes how to update the edges of your flow in some way.
		* If you don't need any custom behaviour, this util can be used to take an array
		* of these changes and apply them to your edges.
		*/
		function applyNodeChanges(changes, nodes) {
			return applyChanges(changes, nodes);
		}
		/**
		* Drop in function that applies edge changes to an array of edges.
		* @public
		* @param changes - Array of changes to apply.
		* @param edges - Array of edge to apply the changes to.
		* @returns Array of updated edges.
		* @example
		* ```tsx
		*import { useState, useCallback } from 'react';
		*import { ReactFlow, applyEdgeChanges } from '@xyflow/react';
		*
		*export default function Flow() {
		*  const [nodes, setNodes] = useState([]);
		*  const [edges, setEdges] = useState([]);
		*  const onEdgesChange = useCallback(
		*    (changes) => {
		*      setEdges((oldEdges) => applyEdgeChanges(changes, oldEdges));
		*    },
		*    [setEdges],
		*  );
		*
		*  return (
		*    <ReactFlow nodes={nodes} edges={edges} onEdgesChange={onEdgesChange} />
		*  );
		*}
		*```
		* @remarks Various events on the <ReactFlow /> component can produce an {@link EdgeChange}
		* that describes how to update the edges of your flow in some way.
		* If you don't need any custom behaviour, this util can be used to take an array
		* of these changes and apply them to your edges.
		*/
		function applyEdgeChanges(changes, edges) {
			return applyChanges(changes, edges);
		}
		function createSelectionChange(id, selected) {
			return {
				id,
				type: "select",
				selected
			};
		}
		function getSelectionChanges(items, selectedIds = /* @__PURE__ */ new Set(), mutateItem = false) {
			const changes = [];
			for (const [id, item] of items) {
				const willBeSelected = selectedIds.has(id);
				if (!(item.selected === void 0 && !willBeSelected) && item.selected !== willBeSelected) {
					if (mutateItem) item.selected = willBeSelected;
					changes.push(createSelectionChange(item.id, willBeSelected));
				}
			}
			return changes;
		}
		function getElementsDiffChanges({ items = [], lookup }) {
			const changes = [];
			const itemsLookup = new Map(items.map((item) => [item.id, item]));
			for (const [index, item] of items.entries()) {
				const lookupItem = lookup.get(item.id);
				const storeItem = lookupItem?.internals?.userNode ?? lookupItem;
				if (storeItem !== void 0 && storeItem !== item) changes.push({
					id: item.id,
					item,
					type: "replace"
				});
				if (storeItem === void 0) changes.push({
					item,
					type: "add",
					index
				});
			}
			for (const [id] of lookup) if (itemsLookup.get(id) === void 0) changes.push({
				id,
				type: "remove"
			});
			return changes;
		}
		function elementToRemoveChange(item) {
			return {
				id: item.id,
				type: "remove"
			};
		}
		const defaultOnError = createDevWarn("React Flow", "https://reactflow.dev/");
		function addEdge(edgeParams, edges, options = {}) {
			return addEdge$1(edgeParams, edges, {
				...options,
				onError: options.onError ?? defaultOnError
			});
		}
		/**
		* Test whether an object is usable as an [`Node`](/api-reference/types/node).
		* In TypeScript this is a type guard that will narrow the type of whatever you pass in to
		* [`Node`](/api-reference/types/node) if it returns `true`.
		*
		* @public
		* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
		* @param element - The element to test.
		* @returns Tests whether the provided value can be used as a `Node`. If you're using TypeScript,
		* this function acts as a type guard and will narrow the type of the value to `Node` if it returns
		* `true`.
		*
		* @example
		* ```js
		*import { isNode } from '@xyflow/react';
		*
		*if (isNode(node)) {
		* // ...
		*}
		*```
		*/
		const isNode = (element) => isNodeBase(element);
		/**
		* Test whether an object is usable as an [`Edge`](/api-reference/types/edge).
		* In TypeScript this is a type guard that will narrow the type of whatever you pass in to
		* [`Edge`](/api-reference/types/edge) if it returns `true`.
		*
		* @public
		* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
		* @param element - The element to test
		* @returns Tests whether the provided value can be used as an `Edge`. If you're using TypeScript,
		* this function acts as a type guard and will narrow the type of the value to `Edge` if it returns
		* `true`.
		*
		* @example
		* ```js
		*import { isEdge } from '@xyflow/react';
		*
		*if (isEdge(edge)) {
		* // ...
		*}
		*```
		*/
		const isEdge = (element) => isEdgeBase(element);
		function fixedForwardRef(render) {
			return (0, react.forwardRef)(render);
		}
		const useIsomorphicLayoutEffect = typeof window !== "undefined" ? react.useLayoutEffect : react.useEffect;
		/**
		* This hook returns a queue that can be used to batch updates.
		*
		* @param runQueue - a function that gets called when the queue is flushed
		* @internal
		*
		* @returns a Queue object
		*/
		function useQueue(runQueue) {
			const [serial, setSerial] = (0, react.useState)(BigInt(0));
			const [queue] = (0, react.useState)(() => createQueue(() => setSerial((n) => n + BigInt(1))));
			useIsomorphicLayoutEffect(() => {
				const queueItems = queue.get();
				if (queueItems.length) {
					runQueue(queueItems);
					queue.reset();
				}
			}, [serial]);
			return queue;
		}
		function createQueue(cb) {
			let queue = [];
			return {
				get: () => queue,
				reset: () => {
					queue = [];
				},
				push: (item) => {
					queue.push(item);
					cb();
				}
			};
		}
		const BatchContext = (0, react.createContext)(null);
		/**
		* This is a context provider that holds and processes the node and edge update queues
		* that are needed to handle setNodes, addNodes, setEdges and addEdges.
		*
		* @internal
		*/
		function BatchProvider({ children }) {
			const store = useStoreApi();
			const nodeQueue = useQueue((0, react.useCallback)((queueItems) => {
				const { nodes = [], setNodes, hasDefaultNodes, onNodesChange, nodeLookup, fitViewQueued, onNodesChangeMiddlewareMap } = store.getState();
				let next = nodes;
				for (const payload of queueItems) next = typeof payload === "function" ? payload(next) : payload;
				let changes = getElementsDiffChanges({
					items: next,
					lookup: nodeLookup
				});
				for (const middleware of onNodesChangeMiddlewareMap.values()) changes = middleware(changes);
				if (hasDefaultNodes) setNodes(next);
				if (changes.length > 0) onNodesChange?.(changes);
				else if (fitViewQueued) window.requestAnimationFrame(() => {
					const { fitViewQueued, nodes, setNodes } = store.getState();
					if (fitViewQueued) setNodes(nodes);
				});
			}, []));
			const edgeQueue = useQueue((0, react.useCallback)((queueItems) => {
				const { edges = [], setEdges, hasDefaultEdges, onEdgesChange, edgeLookup } = store.getState();
				let next = edges;
				for (const payload of queueItems) next = typeof payload === "function" ? payload(next) : payload;
				if (hasDefaultEdges) setEdges(next);
				else if (onEdgesChange) onEdgesChange(getElementsDiffChanges({
					items: next,
					lookup: edgeLookup
				}));
			}, []));
			const value = (0, react.useMemo)(() => ({
				nodeQueue,
				edgeQueue
			}), []);
			return (0, react_jsx_runtime.jsx)(BatchContext.Provider, {
				value,
				children
			});
		}
		function useBatchContext() {
			const batchContext = (0, react.useContext)(BatchContext);
			if (!batchContext) throw new Error("useBatchContext must be used within a BatchProvider");
			return batchContext;
		}
		const selector$j = (s) => !!s.panZoom;
		/**
		* This hook returns a ReactFlowInstance that can be used to update nodes and edges, manipulate the viewport, or query the current state of the flow.
		*
		* @public
		* @example
		* ```jsx
		*import { useCallback, useState } from 'react';
		*import { useReactFlow } from '@xyflow/react';
		*
		*export function NodeCounter() {
		*  const reactFlow = useReactFlow();
		*  const [count, setCount] = useState(0);
		*  const countNodes = useCallback(() => {
		*    setCount(reactFlow.getNodes().length);
		*    // you need to pass it as a dependency if you are using it with useEffect or useCallback
		*    // because at the first render, it's not initialized yet and some functions might not work.
		*  }, [reactFlow]);
		*
		*  return (
		*    <div>
		*      <button onClick={countNodes}>Update count</button>
		*      <p>There are {count} nodes in the flow.</p>
		*    </div>
		*  );
		*}
		*```
		*/
		function useReactFlow() {
			const viewportHelper = useViewportHelper();
			const store = useStoreApi();
			const batchContext = useBatchContext();
			const viewportInitialized = useStore(selector$j);
			const generalHelper = (0, react.useMemo)(() => {
				const getInternalNode = (id) => store.getState().nodeLookup.get(id);
				const setNodes = (payload) => {
					batchContext.nodeQueue.push(payload);
				};
				const setEdges = (payload) => {
					batchContext.edgeQueue.push(payload);
				};
				const getNodeRect = (node) => {
					const { nodeLookup, nodeOrigin } = store.getState();
					const nodeToUse = isNode(node) ? node : nodeLookup.get(node.id);
					const position = nodeToUse.parentId ? evaluateAbsolutePosition(nodeToUse.position, nodeToUse.measured, nodeToUse.parentId, nodeLookup, nodeOrigin) : nodeToUse.position;
					return nodeToRect({
						...nodeToUse,
						position,
						width: nodeToUse.measured?.width ?? nodeToUse.width,
						height: nodeToUse.measured?.height ?? nodeToUse.height
					});
				};
				const updateNode = (id, nodeUpdate, options = { replace: false }) => {
					setNodes((prevNodes) => prevNodes.map((node) => {
						if (node.id === id) {
							const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
							return options.replace && isNode(nextNode) ? nextNode : {
								...node,
								...nextNode
							};
						}
						return node;
					}));
				};
				const updateEdge = (id, edgeUpdate, options = { replace: false }) => {
					setEdges((prevEdges) => prevEdges.map((edge) => {
						if (edge.id === id) {
							const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
							return options.replace && isEdge(nextEdge) ? nextEdge : {
								...edge,
								...nextEdge
							};
						}
						return edge;
					}));
				};
				return {
					getNodes: () => store.getState().nodes.map((n) => ({ ...n })),
					getNode: (id) => getInternalNode(id)?.internals.userNode,
					getInternalNode,
					getEdges: () => {
						const { edges = [] } = store.getState();
						return edges.map((e) => ({ ...e }));
					},
					getEdge: (id) => store.getState().edgeLookup.get(id),
					setNodes,
					setEdges,
					addNodes: (payload) => {
						const newNodes = Array.isArray(payload) ? payload : [payload];
						batchContext.nodeQueue.push((nodes) => [...nodes, ...newNodes]);
					},
					addEdges: (payload) => {
						const newEdges = Array.isArray(payload) ? payload : [payload];
						batchContext.edgeQueue.push((edges) => [...edges, ...newEdges]);
					},
					toObject: () => {
						const { nodes = [], edges = [], transform } = store.getState();
						const [x, y, zoom] = transform;
						return {
							nodes: nodes.map((n) => ({ ...n })),
							edges: edges.map((e) => ({ ...e })),
							viewport: {
								x,
								y,
								zoom
							}
						};
					},
					deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
						const { nodes, edges, onNodesDelete, onEdgesDelete, triggerNodeChanges, triggerEdgeChanges, onDelete, onBeforeDelete } = store.getState();
						const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
							nodesToRemove,
							edgesToRemove,
							nodes,
							edges,
							onBeforeDelete
						});
						const hasMatchingEdges = matchingEdges.length > 0;
						const hasMatchingNodes = matchingNodes.length > 0;
						if (hasMatchingEdges) {
							const edgeChanges = matchingEdges.map(elementToRemoveChange);
							onEdgesDelete?.(matchingEdges);
							triggerEdgeChanges(edgeChanges);
						}
						if (hasMatchingNodes) {
							const nodeChanges = matchingNodes.map(elementToRemoveChange);
							onNodesDelete?.(matchingNodes);
							triggerNodeChanges(nodeChanges);
						}
						if (hasMatchingNodes || hasMatchingEdges) onDelete?.({
							nodes: matchingNodes,
							edges: matchingEdges
						});
						return {
							deletedNodes: matchingNodes,
							deletedEdges: matchingEdges
						};
					},
					/**
					* Partial is defined as "the 2 nodes/areas are intersecting partially".
					* If a is contained in b or b is contained in a, they are both
					* considered fully intersecting.
					*/
					getIntersectingNodes: (nodeOrRect, partially = true, nodes) => {
						const isRect = isRectObject(nodeOrRect);
						const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
						const hasNodesOption = nodes !== void 0;
						if (!nodeRect) return [];
						return (nodes || store.getState().nodes).filter((n) => {
							const internalNode = store.getState().nodeLookup.get(n.id);
							if (internalNode && !isRect && (n.id === nodeOrRect.id || !internalNode.internals.positionAbsolute)) return false;
							const currNodeRect = nodeToRect(hasNodesOption ? n : internalNode);
							const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
							return partially && overlappingArea > 0 || overlappingArea >= currNodeRect.width * currNodeRect.height || overlappingArea >= nodeRect.width * nodeRect.height;
						});
					},
					isNodeIntersecting: (nodeOrRect, area, partially = true) => {
						const nodeRect = isRectObject(nodeOrRect) ? nodeOrRect : getNodeRect(nodeOrRect);
						if (!nodeRect) return false;
						const overlappingArea = getOverlappingArea(nodeRect, area);
						return partially && overlappingArea > 0 || overlappingArea >= area.width * area.height || overlappingArea >= nodeRect.width * nodeRect.height;
					},
					updateNode,
					updateNodeData: (id, dataUpdate, options = { replace: false }) => {
						updateNode(id, (node) => {
							const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
							return options.replace ? {
								...node,
								data: nextData
							} : {
								...node,
								data: {
									...node.data,
									...nextData
								}
							};
						}, options);
					},
					updateEdge,
					updateEdgeData: (id, dataUpdate, options = { replace: false }) => {
						updateEdge(id, (edge) => {
							const nextData = typeof dataUpdate === "function" ? dataUpdate(edge) : dataUpdate;
							return options.replace ? {
								...edge,
								data: nextData
							} : {
								...edge,
								data: {
									...edge.data,
									...nextData
								}
							};
						}, options);
					},
					getNodesBounds: (nodes) => {
						const { nodeLookup, nodeOrigin } = store.getState();
						return getNodesBounds(nodes, {
							nodeLookup,
							nodeOrigin
						});
					},
					getHandleConnections: ({ type, id, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}-${type}${id ? `-${id}` : ""}`)?.values() ?? []),
					getNodeConnections: ({ type, handleId, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}${type ? handleId ? `-${type}-${handleId}` : `-${type}` : ""}`)?.values() ?? []),
					fitView: async (options) => {
						const fitViewResolver = store.getState().fitViewResolver ?? withResolvers();
						store.setState({
							fitViewQueued: true,
							fitViewOptions: options,
							fitViewResolver
						});
						batchContext.nodeQueue.push((nodes) => [...nodes]);
						return fitViewResolver.promise;
					}
				};
			}, []);
			return (0, react.useMemo)(() => {
				return {
					...generalHelper,
					...viewportHelper,
					viewportInitialized
				};
			}, [viewportInitialized]);
		}
		const selected = (item) => item.selected;
		const win$1 = typeof window !== "undefined" ? window : void 0;
		/**
		* Hook for handling global key events.
		*
		* @internal
		*/
		function useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode }) {
			const store = useStoreApi();
			const { deleteElements } = useReactFlow();
			const deleteKeyPressed = useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false });
			const multiSelectionKeyPressed = useKeyPress(multiSelectionKeyCode, { target: win$1 });
			(0, react.useEffect)(() => {
				if (deleteKeyPressed) {
					const { edges, nodes } = store.getState();
					deleteElements({
						nodes: nodes.filter(selected),
						edges: edges.filter(selected)
					});
					store.setState({ nodesSelectionActive: false });
				}
			}, [deleteKeyPressed]);
			(0, react.useEffect)(() => {
				store.setState({ multiSelectionActive: multiSelectionKeyPressed });
			}, [multiSelectionKeyPressed]);
		}
		/**
		* Hook for handling resize events.
		*
		* @internal
		*/
		function useResizeHandler(domNode) {
			const store = useStoreApi();
			(0, react.useEffect)(() => {
				const updateDimensions = () => {
					if (!domNode.current || !(domNode.current.checkVisibility?.() ?? true)) return false;
					const size = getDimensions(domNode.current);
					if (size.height === 0 || size.width === 0) store.getState().onError?.("004", errorMessages["error004"]());
					store.setState({
						width: size.width || 500,
						height: size.height || 500
					});
				};
				if (domNode.current) {
					updateDimensions();
					window.addEventListener("resize", updateDimensions);
					const resizeObserver = new ResizeObserver(() => updateDimensions());
					resizeObserver.observe(domNode.current);
					return () => {
						window.removeEventListener("resize", updateDimensions);
						if (resizeObserver && domNode.current) resizeObserver.unobserve(domNode.current);
					};
				}
			}, []);
		}
		const containerStyle = {
			position: "absolute",
			width: "100%",
			height: "100%",
			top: 0,
			left: 0
		};
		const selector$i = (s) => ({
			userSelectionActive: s.userSelectionActive,
			lib: s.lib,
			connectionInProgress: s.connection.inProgress
		});
		function ZoomPane({ onPaneContextMenu, zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panActivationKeyPressed, panOnScrollSpeed = .5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, defaultViewport, translateExtent, minZoom, maxZoom, zoomActivationKeyCode, preventScrolling = true, children, noWheelClassName, noPanClassName, onViewportChange, isControlledViewport, paneClickDistance, selectionOnDrag }) {
			const store = useStoreApi();
			const zoomPane = (0, react.useRef)(null);
			const { userSelectionActive, lib, connectionInProgress } = useStore(selector$i, shallow$1);
			const zoomActivationKeyPressed = useKeyPress(zoomActivationKeyCode);
			const panZoom = (0, react.useRef)();
			useResizeHandler(zoomPane);
			const onTransformChange = (0, react.useCallback)((transform) => {
				onViewportChange?.({
					x: transform[0],
					y: transform[1],
					zoom: transform[2]
				});
				if (!isControlledViewport) store.setState({ transform });
			}, [onViewportChange, isControlledViewport]);
			(0, react.useEffect)(() => {
				if (zoomPane.current) {
					panZoom.current = XYPanZoom({
						domNode: zoomPane.current,
						minZoom,
						maxZoom,
						translateExtent,
						viewport: defaultViewport,
						onDraggingChange: (paneDragging) => store.setState((prevState) => prevState.paneDragging === paneDragging ? prevState : { paneDragging }),
						onPanZoomStart: (event, vp) => {
							const { onViewportChangeStart, onMoveStart } = store.getState();
							onMoveStart?.(event, vp);
							onViewportChangeStart?.(vp);
						},
						onPanZoom: (event, vp) => {
							const { onViewportChange, onMove } = store.getState();
							onMove?.(event, vp);
							onViewportChange?.(vp);
						},
						onPanZoomEnd: (event, vp) => {
							const { onViewportChangeEnd, onMoveEnd } = store.getState();
							onMoveEnd?.(event, vp);
							onViewportChangeEnd?.(vp);
						}
					});
					const { x, y, zoom } = panZoom.current.getViewport();
					store.setState({
						panZoom: panZoom.current,
						transform: [
							x,
							y,
							zoom
						],
						domNode: zoomPane.current.closest(".react-flow")
					});
					return () => {
						panZoom.current?.destroy();
					};
				}
			}, []);
			(0, react.useEffect)(() => {
				panZoom.current?.update({
					onPaneContextMenu,
					zoomOnScroll,
					zoomOnPinch,
					panOnScroll,
					panActivationKeyPressed,
					panOnScrollSpeed,
					panOnScrollMode,
					zoomOnDoubleClick,
					panOnDrag,
					zoomActivationKeyPressed,
					preventScrolling,
					noPanClassName,
					userSelectionActive,
					noWheelClassName,
					lib,
					onTransformChange,
					connectionInProgress,
					selectionOnDrag,
					paneClickDistance
				});
			}, [
				onPaneContextMenu,
				zoomOnScroll,
				zoomOnPinch,
				panOnScroll,
				panActivationKeyPressed,
				panOnScrollSpeed,
				panOnScrollMode,
				zoomOnDoubleClick,
				panOnDrag,
				zoomActivationKeyPressed,
				preventScrolling,
				noPanClassName,
				userSelectionActive,
				noWheelClassName,
				lib,
				onTransformChange,
				connectionInProgress,
				selectionOnDrag,
				paneClickDistance
			]);
			return (0, react_jsx_runtime.jsx)("div", {
				className: "react-flow__renderer",
				ref: zoomPane,
				style: containerStyle,
				children
			});
		}
		const selector$h = (s) => ({
			userSelectionActive: s.userSelectionActive,
			userSelectionRect: s.userSelectionRect
		});
		function UserSelection() {
			const { userSelectionActive, userSelectionRect } = useStore(selector$h, shallow$1);
			if (!(userSelectionActive && userSelectionRect)) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: "react-flow__selection react-flow__container",
				style: {
					width: userSelectionRect.width,
					height: userSelectionRect.height,
					transform: `translate(${userSelectionRect.x}px, ${userSelectionRect.y}px)`
				}
			});
		}
		const wrapHandler = (handler, containerRef) => {
			return (event) => {
				if (event.target !== containerRef.current) return;
				handler?.(event);
			};
		};
		const selector$g = (s) => ({
			userSelectionActive: s.userSelectionActive,
			elementsSelectable: s.elementsSelectable,
			dragging: s.paneDragging,
			panBy: s.panBy,
			autoPanSpeed: s.autoPanSpeed
		});
		function Pane({ isSelecting, selectionKeyPressed, selectionMode = SelectionMode.Full, panOnDrag, autoPanOnSelection, paneClickDistance, selectionOnDrag, onSelectionStart, onSelectionEnd, onPaneClick, onPaneContextMenu, onPaneScroll, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, children }) {
			const autoPanId = (0, react.useRef)(0);
			const store = useStoreApi();
			const { userSelectionActive, elementsSelectable, dragging, panBy, autoPanSpeed } = useStore(selector$g, shallow$1);
			const isSelectionEnabled = elementsSelectable && (isSelecting || userSelectionActive);
			const container = (0, react.useRef)(null);
			const containerBounds = (0, react.useRef)();
			const selectedNodeIds = (0, react.useRef)(/* @__PURE__ */ new Set());
			const selectedEdgeIds = (0, react.useRef)(/* @__PURE__ */ new Set());
			const connectionEndedOnPane = (0, react.useRef)(false);
			const selectionInProgress = (0, react.useRef)(false);
			const position = (0, react.useRef)({
				x: 0,
				y: 0
			});
			const autoPanStarted = (0, react.useRef)(false);
			const onClick = (event) => {
				if (selectionInProgress.current || connectionEndedOnPane.current || store.getState().connection.inProgress) {
					selectionInProgress.current = false;
					connectionEndedOnPane.current = false;
					return;
				}
				onPaneClick?.(event);
				store.getState().resetSelectedElements();
				store.setState({ nodesSelectionActive: false });
			};
			const onContextMenu = (event) => {
				if (Array.isArray(panOnDrag) && panOnDrag?.includes(2)) {
					event.preventDefault();
					return;
				}
				onPaneContextMenu?.(event);
			};
			const onWheel = onPaneScroll ? (event) => onPaneScroll(event) : void 0;
			const onClickCapture = (event) => {
				if (selectionInProgress.current) {
					event.stopPropagation();
					selectionInProgress.current = false;
				}
			};
			const onPointerDownCapture = (event) => {
				if (event.pointerType === "touch" && panOnDrag !== false && !selectionKeyPressed) return;
				const { domNode, transform } = store.getState();
				containerBounds.current = domNode?.getBoundingClientRect();
				if (!containerBounds.current) return;
				const eventTargetIsContainer = event.target === container.current;
				if (!eventTargetIsContainer && !!event.target.closest(".nokey") || !isSelecting || !(selectionOnDrag && eventTargetIsContainer || selectionKeyPressed) || event.button !== 0 || !event.isPrimary) return;
				event.target?.setPointerCapture?.(event.pointerId);
				selectionInProgress.current = false;
				const { x, y } = getEventPosition(event.nativeEvent, containerBounds.current);
				const userSelectionStartPosition = pointToRendererPoint({
					x,
					y
				}, transform);
				store.setState({ userSelectionRect: {
					width: 0,
					height: 0,
					startX: userSelectionStartPosition.x,
					startY: userSelectionStartPosition.y,
					x,
					y
				} });
				if (!eventTargetIsContainer) {
					event.stopPropagation();
					event.preventDefault();
				}
			};
			function commitUserSelectionRect(mouseX, mouseY) {
				const { userSelectionRect } = store.getState();
				if (!userSelectionRect) return;
				const { transform, nodeLookup, edgeLookup, connectionLookup, triggerNodeChanges, triggerEdgeChanges, defaultEdgeOptions } = store.getState();
				const userStartPosition = {
					x: userSelectionRect.startX,
					y: userSelectionRect.startY
				};
				const { x: screenStartX, y: screenStartY } = rendererPointToPoint(userStartPosition, transform);
				const nextUserSelectRect = {
					startX: userStartPosition.x,
					startY: userStartPosition.y,
					x: mouseX < screenStartX ? mouseX : screenStartX,
					y: mouseY < screenStartY ? mouseY : screenStartY,
					width: Math.abs(mouseX - screenStartX),
					height: Math.abs(mouseY - screenStartY)
				};
				const prevSelectedNodeIds = selectedNodeIds.current;
				const prevSelectedEdgeIds = selectedEdgeIds.current;
				selectedNodeIds.current = new Set(getNodesInside(nodeLookup, nextUserSelectRect, transform, selectionMode === SelectionMode.Partial, true).map((node) => node.id));
				selectedEdgeIds.current = /* @__PURE__ */ new Set();
				const edgesSelectable = defaultEdgeOptions?.selectable ?? true;
				for (const nodeId of selectedNodeIds.current) {
					const connections = connectionLookup.get(nodeId);
					if (!connections) continue;
					for (const { edgeId } of connections.values()) {
						const edge = edgeLookup.get(edgeId);
						if (edge && (edge.selectable ?? edgesSelectable)) selectedEdgeIds.current.add(edgeId);
					}
				}
				if (!areSetsEqual(prevSelectedNodeIds, selectedNodeIds.current)) triggerNodeChanges(getSelectionChanges(nodeLookup, selectedNodeIds.current, true));
				if (!areSetsEqual(prevSelectedEdgeIds, selectedEdgeIds.current)) triggerEdgeChanges(getSelectionChanges(edgeLookup, selectedEdgeIds.current));
				store.setState({
					userSelectionRect: nextUserSelectRect,
					userSelectionActive: true,
					nodesSelectionActive: false
				});
			}
			function autoPan() {
				if (!autoPanOnSelection || !containerBounds.current) return;
				const [x, y] = calcAutoPan(position.current, containerBounds.current, autoPanSpeed);
				panBy({
					x,
					y
				}).then((panned) => {
					if (!selectionInProgress.current || !panned) {
						autoPanId.current = requestAnimationFrame(autoPan);
						return;
					}
					const { x: mx, y: my } = position.current;
					commitUserSelectionRect(mx, my);
					autoPanId.current = requestAnimationFrame(autoPan);
				});
			}
			const cleanupAutoPan = () => {
				cancelAnimationFrame(autoPanId.current);
				autoPanId.current = 0;
				autoPanStarted.current = false;
			};
			(0, react.useEffect)(() => {
				return () => cleanupAutoPan();
			}, []);
			const onPointerMove = (event) => {
				const { userSelectionRect, transform, resetSelectedElements } = store.getState();
				if (!containerBounds.current || !userSelectionRect) return;
				const { x: mouseX, y: mouseY } = getEventPosition(event.nativeEvent, containerBounds.current);
				position.current = {
					x: mouseX,
					y: mouseY
				};
				const screenStart = rendererPointToPoint({
					x: userSelectionRect.startX,
					y: userSelectionRect.startY
				}, transform);
				if (!selectionInProgress.current) {
					const requiredDistance = selectionKeyPressed ? 0 : paneClickDistance;
					if (Math.hypot(mouseX - screenStart.x, mouseY - screenStart.y) <= requiredDistance) return;
					resetSelectedElements();
					onSelectionStart?.(event);
				}
				selectionInProgress.current = true;
				if (!autoPanStarted.current) {
					autoPan();
					autoPanStarted.current = true;
				}
				commitUserSelectionRect(mouseX, mouseY);
			};
			const onPointerUp = (event) => {
				if (!isSelectionEnabled) {
					if (event.target === container.current && store.getState().connection.inProgress) connectionEndedOnPane.current = true;
					return;
				}
				if (event.button !== 0) return;
				event.target?.releasePointerCapture?.(event.pointerId);
				if (!userSelectionActive && event.target === container.current && store.getState().userSelectionRect) onClick?.(event);
				store.setState({
					userSelectionActive: false,
					userSelectionRect: null
				});
				if (selectionInProgress.current) {
					onSelectionEnd?.(event);
					store.setState({ nodesSelectionActive: selectedNodeIds.current.size > 0 });
				}
				cleanupAutoPan();
			};
			const onPointerCancel = (event) => {
				event.target?.releasePointerCapture?.(event.pointerId);
				cleanupAutoPan();
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: cc(["react-flow__pane", {
					draggable: panOnDrag === true || Array.isArray(panOnDrag) && panOnDrag.includes(0),
					dragging,
					selection: isSelecting
				}]),
				onClick: isSelectionEnabled ? void 0 : wrapHandler(onClick, container),
				onContextMenu: wrapHandler(onContextMenu, container),
				onWheel: wrapHandler(onWheel, container),
				onPointerEnter: isSelectionEnabled ? void 0 : onPaneMouseEnter,
				onPointerMove: isSelectionEnabled ? onPointerMove : onPaneMouseMove,
				onPointerUp,
				onPointerCancel: isSelectionEnabled ? onPointerCancel : void 0,
				onPointerDownCapture: isSelectionEnabled ? onPointerDownCapture : void 0,
				onClickCapture: isSelectionEnabled ? onClickCapture : void 0,
				onPointerLeave: onPaneMouseLeave,
				ref: container,
				style: containerStyle,
				children: [children, (0, react_jsx_runtime.jsx)(UserSelection, {})]
			});
		}
		function handleNodeClick({ id, store, unselect = false, nodeRef }) {
			const { addSelectedNodes, unselectNodesAndEdges, multiSelectionActive, nodeLookup, onError } = store.getState();
			const node = nodeLookup.get(id);
			if (!node) {
				onError?.("012", errorMessages["error012"](id));
				return;
			}
			store.setState({ nodesSelectionActive: false });
			if (!node.selected) addSelectedNodes([id]);
			else if (unselect || node.selected && multiSelectionActive) {
				unselectNodesAndEdges({
					nodes: [node],
					edges: []
				});
				requestAnimationFrame(() => nodeRef?.current?.blur());
			}
		}
		/**
		* Hook for calling XYDrag helper from @xyflow/system.
		*
		* @internal
		*/
		function useDrag({ nodeRef, disabled = false, noDragClassName, handleSelector, nodeId, isSelectable, nodeClickDistance }) {
			const store = useStoreApi();
			const [dragging, setDragging] = (0, react.useState)(false);
			const xyDrag = (0, react.useRef)();
			(0, react.useEffect)(() => {
				if (disabled) return;
				xyDrag.current = XYDrag({
					getStoreItems: () => store.getState(),
					onNodeMouseDown: (id) => {
						handleNodeClick({
							id,
							store,
							nodeRef
						});
					},
					onDragStart: () => {
						setDragging(true);
					},
					onDragStop: () => {
						setDragging(false);
					}
				});
				return () => {
					xyDrag.current?.destroy();
					xyDrag.current = void 0;
				};
			}, [
				disabled,
				store,
				nodeRef
			]);
			(0, react.useEffect)(() => {
				if (disabled || !nodeRef.current || !xyDrag.current) return;
				xyDrag.current.update({
					noDragClassName,
					handleSelector,
					domNode: nodeRef.current,
					isSelectable,
					nodeId,
					nodeClickDistance
				});
			}, [
				noDragClassName,
				handleSelector,
				disabled,
				isSelectable,
				nodeRef,
				nodeId,
				nodeClickDistance
			]);
			return dragging;
		}
		const selectedAndDraggable = (nodesDraggable) => (n) => n.selected && (n.draggable || nodesDraggable && typeof n.draggable === "undefined");
		/**
		* Hook for updating node positions by passing a direction and factor
		*
		* @internal
		* @returns function for updating node positions
		*/
		function useMoveSelectedNodes() {
			const store = useStoreApi();
			return (0, react.useCallback)((params) => {
				const { nodeExtent, snapToGrid, snapGrid, nodesDraggable, onError, updateNodePositions, nodeLookup, nodeOrigin } = store.getState();
				const nodeUpdates = /* @__PURE__ */ new Map();
				const isSelected = selectedAndDraggable(nodesDraggable);
				const xVelo = snapToGrid ? snapGrid[0] : 5;
				const yVelo = snapToGrid ? snapGrid[1] : 5;
				const xDiff = params.direction.x * xVelo * params.factor;
				const yDiff = params.direction.y * yVelo * params.factor;
				for (const [, node] of nodeLookup) {
					if (!isSelected(node)) continue;
					let nextPosition = {
						x: node.internals.positionAbsolute.x + xDiff,
						y: node.internals.positionAbsolute.y + yDiff
					};
					if (snapToGrid) nextPosition = snapPosition(nextPosition, snapGrid);
					const { position, positionAbsolute } = calculateNodePosition({
						nodeId: node.id,
						nextPosition,
						nodeLookup,
						nodeExtent,
						nodeOrigin,
						onError
					});
					node.position = position;
					node.internals.positionAbsolute = positionAbsolute;
					nodeUpdates.set(node.id, node);
				}
				updateNodePositions(nodeUpdates);
			}, []);
		}
		const NodeIdContext = (0, react.createContext)(null);
		const Provider = NodeIdContext.Provider;
		NodeIdContext.Consumer;
		/**
		* You can use this hook to get the id of the node it is used inside. It is useful
		* if you need the node's id deeper in the render tree but don't want to manually
		* drill down the id as a prop.
		*
		* @public
		* @returns The id for a node in the flow.
		*
		* @example
		*```jsx
		*import { useNodeId } from '@xyflow/react';
		*
		*export default function CustomNode() {
		*  return (
		*    <div>
		*      <span>This node has an id of </span>
		*      <NodeIdDisplay />
		*    </div>
		*  );
		*}
		*
		*function NodeIdDisplay() {
		*  const nodeId = useNodeId();
		*
		*  return <span>{nodeId}</span>;
		*}
		*```
		*/
		const useNodeId = () => {
			return (0, react.useContext)(NodeIdContext);
		};
		const selector$f = (s) => ({
			connectOnClick: s.connectOnClick,
			noPanClassName: s.noPanClassName,
			rfId: s.rfId
		});
		const HandleConfigContext = (0, react.createContext)(null);
		function HandleConfigProvider({ children }) {
			const config = useStore(selector$f, shallow$1);
			return (0, react_jsx_runtime.jsx)(HandleConfigContext.Provider, {
				value: config,
				children
			});
		}
		function useHandleConfig() {
			const config = (0, react.useContext)(HandleConfigContext);
			if (!config) throw new Error("useHandleConfig must be used within a HandleConfigProvider");
			return config;
		}
		const idleConnectingState = {
			connectingFrom: false,
			connectingTo: false,
			clickConnecting: false,
			isPossibleEndHandle: true,
			connectionInProcess: false,
			clickConnectionInProcess: false,
			valid: false
		};
		const connectingSelector = (nodeId, handleId, type) => (state) => {
			const { connectionClickStartHandle: clickHandle, connectionMode, connection } = state;
			const { fromHandle, toHandle, isValid } = connection;
			if (!fromHandle && !clickHandle) return idleConnectingState;
			const connectingTo = toHandle?.nodeId === nodeId && toHandle?.id === handleId && toHandle?.type === type;
			return {
				connectingFrom: fromHandle?.nodeId === nodeId && fromHandle?.id === handleId && fromHandle?.type === type,
				connectingTo,
				clickConnecting: clickHandle?.nodeId === nodeId && clickHandle?.id === handleId && clickHandle?.type === type,
				isPossibleEndHandle: connectionMode === ConnectionMode.Strict ? fromHandle?.type !== type : nodeId !== fromHandle?.nodeId || handleId !== fromHandle?.id,
				connectionInProcess: !!fromHandle,
				clickConnectionInProcess: !!clickHandle,
				valid: connectingTo && isValid
			};
		};
		function HandleComponent({ type = "source", position = Position.Top, isValidConnection, isConnectable = true, isConnectableStart = true, isConnectableEnd = true, id, onConnect, children, className, onMouseDown, onTouchStart, ...rest }, ref) {
			const handleId = id || null;
			const isTarget = type === "target";
			const store = useStoreApi();
			const nodeId = useNodeId();
			const { connectOnClick, noPanClassName, rfId } = useHandleConfig();
			const { connectingFrom, connectingTo, clickConnecting, isPossibleEndHandle, connectionInProcess, clickConnectionInProcess, valid } = useStore(connectingSelector(nodeId, handleId, type), shallow$1);
			if (!nodeId) store.getState().onError?.("010", errorMessages["error010"]());
			const onConnectExtended = (params) => {
				const { defaultEdgeOptions, onConnect: onConnectAction, hasDefaultEdges } = store.getState();
				const edgeParams = {
					...defaultEdgeOptions,
					...params
				};
				if (hasDefaultEdges) {
					const { edges, setEdges, onError } = store.getState();
					setEdges(addEdge(edgeParams, edges, { onError }));
				}
				onConnectAction?.(edgeParams);
				onConnect?.(edgeParams);
			};
			const onPointerDown = (event) => {
				if (!nodeId) return;
				const isMouseTriggered = isMouseEvent(event.nativeEvent);
				if (isConnectableStart && (isMouseTriggered && event.button === 0 || !isMouseTriggered)) {
					const currentStore = store.getState();
					XYHandle.onPointerDown(event.nativeEvent, {
						handleDomNode: event.currentTarget,
						autoPanOnConnect: currentStore.autoPanOnConnect,
						connectionMode: currentStore.connectionMode,
						connectionRadius: currentStore.connectionRadius,
						domNode: currentStore.domNode,
						nodeLookup: currentStore.nodeLookup,
						lib: currentStore.lib,
						isTarget,
						handleId,
						nodeId,
						flowId: currentStore.rfId,
						panBy: currentStore.panBy,
						cancelConnection: currentStore.cancelConnection,
						onConnectStart: currentStore.onConnectStart,
						onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
						updateConnection: currentStore.updateConnection,
						onConnect: onConnectExtended,
						isValidConnection: isValidConnection || ((...args) => store.getState().isValidConnection?.(...args) ?? true),
						getTransform: () => store.getState().transform,
						getFromHandle: () => store.getState().connection.fromHandle,
						autoPanSpeed: currentStore.autoPanSpeed,
						dragThreshold: currentStore.connectionDragThreshold
					});
				}
				if (isMouseTriggered) onMouseDown?.(event);
				else onTouchStart?.(event);
			};
			const onClick = (event) => {
				const { onClickConnectStart, onClickConnectEnd, connectionClickStartHandle, connectionMode, isValidConnection: isValidConnectionStore, lib, rfId: flowId, nodeLookup, connection: connectionState } = store.getState();
				if (!nodeId || !connectionClickStartHandle && !isConnectableStart) return;
				if (!connectionClickStartHandle) {
					onClickConnectStart?.(event.nativeEvent, {
						nodeId,
						handleId,
						handleType: type
					});
					store.setState({ connectionClickStartHandle: {
						nodeId,
						type,
						id: handleId
					} });
					return;
				}
				const doc = getHostForElement(event.target);
				const isValidConnectionHandler = isValidConnection || isValidConnectionStore;
				const { connection, isValid } = XYHandle.isValid(event.nativeEvent, {
					handle: {
						nodeId,
						id: handleId,
						type
					},
					connectionMode,
					fromNodeId: connectionClickStartHandle.nodeId,
					fromHandleId: connectionClickStartHandle.id || null,
					fromType: connectionClickStartHandle.type,
					isValidConnection: isValidConnectionHandler,
					flowId,
					doc,
					lib,
					nodeLookup
				});
				if (isValid && connection) onConnectExtended(connection);
				const connectionClone = structuredClone(connectionState);
				delete connectionClone.inProgress;
				connectionClone.toPosition = connectionClone.toHandle ? connectionClone.toHandle.position : null;
				onClickConnectEnd?.(event, connectionClone);
				store.setState({ connectionClickStartHandle: null });
			};
			return (0, react_jsx_runtime.jsx)("div", {
				"data-handleid": handleId,
				"data-nodeid": nodeId,
				"data-handlepos": position,
				"data-id": `${rfId}-${nodeId}-${handleId}-${type}`,
				className: cc([
					"react-flow__handle",
					`react-flow__handle-${position}`,
					"nodrag",
					noPanClassName,
					className,
					{
						source: !isTarget,
						target: isTarget,
						connectable: isConnectable,
						connectablestart: isConnectableStart,
						connectableend: isConnectableEnd,
						clickconnecting: clickConnecting,
						connectingfrom: connectingFrom,
						connectingto: connectingTo,
						valid,
						connectionindicator: isConnectable && (!connectionInProcess || isPossibleEndHandle) && (connectionInProcess || clickConnectionInProcess ? isConnectableEnd : isConnectableStart)
					}
				]),
				onMouseDown: onPointerDown,
				onTouchStart: onPointerDown,
				onClick: connectOnClick ? onClick : void 0,
				ref,
				...rest,
				children
			});
		}
		/**
		* The `<Handle />` component is used in your [custom nodes](/learn/customization/custom-nodes)
		* to define connection points.
		*
		*@public
		*
		*@example
		*
		*```jsx
		*import { Handle, Position } from '@xyflow/react';
		*
		*export function CustomNode({ data }) {
		*  return (
		*    <>
		*      <div style={{ padding: '10px 20px' }}>
		*        {data.label}
		*      </div>
		*
		*      <Handle type="target" position={Position.Left} />
		*      <Handle type="source" position={Position.Right} />
		*    </>
		*  );
		*};
		*```
		*/
		const Handle = (0, react.memo)(fixedForwardRef(HandleComponent));
		function InputNode({ data, isConnectable, sourcePosition = Position.Bottom }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [data?.label, (0, react_jsx_runtime.jsx)(Handle, {
				type: "source",
				position: sourcePosition,
				isConnectable
			})] });
		}
		function DefaultNode({ data, isConnectable, targetPosition = Position.Top, sourcePosition = Position.Bottom }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)(Handle, {
					type: "target",
					position: targetPosition,
					isConnectable
				}),
				data?.label,
				(0, react_jsx_runtime.jsx)(Handle, {
					type: "source",
					position: sourcePosition,
					isConnectable
				})
			] });
		}
		function GroupNode() {
			return null;
		}
		function OutputNode({ data, isConnectable, targetPosition = Position.Top }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Handle, {
				type: "target",
				position: targetPosition,
				isConnectable
			}), data?.label] });
		}
		const arrowKeyDiffs = {
			ArrowUp: {
				x: 0,
				y: -1
			},
			ArrowDown: {
				x: 0,
				y: 1
			},
			ArrowLeft: {
				x: -1,
				y: 0
			},
			ArrowRight: {
				x: 1,
				y: 0
			}
		};
		const builtinNodeTypes = {
			input: InputNode,
			default: DefaultNode,
			output: OutputNode,
			group: GroupNode
		};
		function getNodeInlineStyleDimensions(node) {
			if (node.internals.handleBounds === void 0) return {
				width: node.width ?? node.initialWidth ?? node.style?.width,
				height: node.height ?? node.initialHeight ?? node.style?.height
			};
			return {
				width: node.width ?? node.style?.width,
				height: node.height ?? node.style?.height
			};
		}
		const selector$e = (s) => {
			const { width, height, x, y } = getInternalNodesBounds(s.nodeLookup, { filter: (node) => !!node.selected });
			return {
				width: isNumeric(width) ? width : null,
				height: isNumeric(height) ? height : null,
				userSelectionActive: s.userSelectionActive,
				transformString: `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]}) translate(${x}px,${y}px)`
			};
		};
		function NodesSelection({ onSelectionContextMenu, noPanClassName, disableKeyboardA11y }) {
			const store = useStoreApi();
			const { width, height, transformString, userSelectionActive } = useStore(selector$e, shallow$1);
			const moveSelectedNodes = useMoveSelectedNodes();
			const nodeRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!disableKeyboardA11y) nodeRef.current?.focus({ preventScroll: true });
			}, [disableKeyboardA11y]);
			const shouldRender = !userSelectionActive && width !== null && height !== null;
			useDrag({
				nodeRef,
				disabled: !shouldRender
			});
			if (!shouldRender) return null;
			const onContextMenu = onSelectionContextMenu ? (event) => {
				onSelectionContextMenu(event, store.getState().nodes.filter((n) => n.selected));
			} : void 0;
			const onKeyDown = (event) => {
				if (Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
					event.preventDefault();
					moveSelectedNodes({
						direction: arrowKeyDiffs[event.key],
						factor: event.shiftKey ? 4 : 1
					});
				}
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: cc([
					"react-flow__nodesselection",
					"react-flow__container",
					noPanClassName
				]),
				style: { transform: transformString },
				children: (0, react_jsx_runtime.jsx)("div", {
					ref: nodeRef,
					className: "react-flow__nodesselection-rect",
					onContextMenu,
					tabIndex: disableKeyboardA11y ? void 0 : -1,
					onKeyDown: disableKeyboardA11y ? void 0 : onKeyDown,
					style: {
						width,
						height
					}
				})
			});
		}
		const win = typeof window !== "undefined" ? window : void 0;
		const selector$d = (s) => {
			return {
				nodesSelectionActive: s.nodesSelectionActive,
				userSelectionActive: s.userSelectionActive
			};
		};
		function FlowRendererComponent({ children, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, paneClickDistance, deleteKeyCode, selectionKeyCode, selectionOnDrag, selectionMode, onSelectionStart, onSelectionEnd, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, elementsSelectable, zoomOnScroll, zoomOnPinch, panOnScroll: _panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag: _panOnDrag, autoPanOnSelection, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, onSelectionContextMenu, noWheelClassName, noPanClassName, disableKeyboardA11y, onViewportChange, isControlledViewport }) {
			const { nodesSelectionActive, userSelectionActive } = useStore(selector$d, shallow$1);
			const selectionKeyPressed = useKeyPress(selectionKeyCode, { target: win });
			const panActivationKeyPressed = useKeyPress(panActivationKeyCode, { target: win });
			const panOnDrag = panActivationKeyPressed || _panOnDrag;
			const panOnScroll = panActivationKeyPressed || _panOnScroll;
			const _selectionOnDrag = selectionOnDrag && panOnDrag !== true;
			const isSelecting = selectionKeyPressed || userSelectionActive || _selectionOnDrag;
			useGlobalKeyHandler({
				deleteKeyCode,
				multiSelectionKeyCode
			});
			return (0, react_jsx_runtime.jsx)(ZoomPane, {
				onPaneContextMenu,
				elementsSelectable,
				zoomOnScroll,
				zoomOnPinch,
				panOnScroll,
				panActivationKeyPressed,
				panOnScrollSpeed,
				panOnScrollMode,
				zoomOnDoubleClick,
				panOnDrag: !selectionKeyPressed && panOnDrag,
				defaultViewport,
				translateExtent,
				minZoom,
				maxZoom,
				zoomActivationKeyCode,
				preventScrolling,
				noWheelClassName,
				noPanClassName,
				onViewportChange,
				isControlledViewport,
				paneClickDistance,
				selectionOnDrag: _selectionOnDrag,
				children: (0, react_jsx_runtime.jsxs)(Pane, {
					onSelectionStart,
					onSelectionEnd,
					onPaneClick,
					onPaneMouseEnter,
					onPaneMouseMove,
					onPaneMouseLeave,
					onPaneContextMenu,
					onPaneScroll,
					panOnDrag,
					autoPanOnSelection,
					isSelecting: !!isSelecting,
					selectionMode,
					selectionKeyPressed,
					paneClickDistance,
					selectionOnDrag: _selectionOnDrag,
					children: [children, nodesSelectionActive && (0, react_jsx_runtime.jsx)(NodesSelection, {
						onSelectionContextMenu,
						noPanClassName,
						disableKeyboardA11y
					})]
				})
			});
		}
		FlowRendererComponent.displayName = "FlowRenderer";
		const FlowRenderer = (0, react.memo)(FlowRendererComponent);
		const selector$c = (onlyRenderVisible) => (s) => {
			return onlyRenderVisible ? getNodesInside(s.nodeLookup, {
				x: 0,
				y: 0,
				width: s.width,
				height: s.height
			}, s.transform, true).map((node) => node.id) : Array.from(s.nodeLookup.keys());
		};
		/**
		* Hook for getting the visible node ids from the store.
		*
		* @internal
		* @param onlyRenderVisible
		* @returns array with visible node ids
		*/
		function useVisibleNodeIds(onlyRenderVisible) {
			return useStore((0, react.useCallback)(selector$c(onlyRenderVisible), [onlyRenderVisible]), shallow$1);
		}
		const selector$b = (s) => s.updateNodeInternals;
		function useResizeObserver() {
			const updateNodeInternals = useStore(selector$b);
			const [resizeObserver] = (0, react.useState)(() => {
				if (typeof ResizeObserver === "undefined") return null;
				return new ResizeObserver((entries) => {
					const updates = /* @__PURE__ */ new Map();
					entries.forEach((entry) => {
						const id = entry.target.getAttribute("data-id");
						updates.set(id, {
							id,
							nodeElement: entry.target,
							force: true
						});
					});
					updateNodeInternals(updates);
				});
			});
			(0, react.useEffect)(() => {
				return () => {
					resizeObserver?.disconnect();
				};
			}, [resizeObserver]);
			return resizeObserver;
		}
		/**
		* Hook to handle the resize observation + internal updates for the passed node.
		*
		* @internal
		* @returns nodeRef - reference to the node element
		*/
		function useNodeObserver({ node, nodeType, hasDimensions, resizeObserver }) {
			const store = useStoreApi();
			const nodeRef = (0, react.useRef)(null);
			const observedNode = (0, react.useRef)(null);
			const prevSourcePosition = (0, react.useRef)(node.sourcePosition);
			const prevTargetPosition = (0, react.useRef)(node.targetPosition);
			const prevType = (0, react.useRef)(nodeType);
			const isInitialized = hasDimensions && !!node.internals.handleBounds;
			(0, react.useEffect)(() => {
				if (nodeRef.current && !node.hidden && (!isInitialized || observedNode.current !== nodeRef.current)) {
					if (observedNode.current) resizeObserver?.unobserve(observedNode.current);
					resizeObserver?.observe(nodeRef.current);
					observedNode.current = nodeRef.current;
				}
			}, [isInitialized, node.hidden]);
			(0, react.useEffect)(() => {
				return () => {
					if (observedNode.current) {
						resizeObserver?.unobserve(observedNode.current);
						observedNode.current = null;
					}
				};
			}, []);
			(0, react.useEffect)(() => {
				if (nodeRef.current) {
					const typeChanged = prevType.current !== nodeType;
					const sourcePosChanged = prevSourcePosition.current !== node.sourcePosition;
					const targetPosChanged = prevTargetPosition.current !== node.targetPosition;
					if (typeChanged || sourcePosChanged || targetPosChanged) {
						prevType.current = nodeType;
						prevSourcePosition.current = node.sourcePosition;
						prevTargetPosition.current = node.targetPosition;
						store.getState().updateNodeInternals(new Map([[node.id, {
							id: node.id,
							nodeElement: nodeRef.current,
							force: true
						}]]));
					}
				}
			}, [
				node.id,
				nodeType,
				node.sourcePosition,
				node.targetPosition
			]);
			return nodeRef;
		}
		function NodeWrapper({ id, onClick, onMouseEnter, onMouseMove, onMouseLeave, onContextMenu, onDoubleClick, nodesDraggable, elementsSelectable, nodesConnectable, nodesFocusable, resizeObserver, noDragClassName, noPanClassName, disableKeyboardA11y, rfId, nodeTypes, nodeClickDistance, onError }) {
			const { node, internals, isParent } = useStore((s) => {
				const node = s.nodeLookup.get(id);
				const isParent = s.parentLookup.has(id);
				return {
					node,
					internals: node.internals,
					isParent
				};
			}, shallow$1);
			let nodeType = node.type || "default";
			let NodeComponent = nodeTypes?.[nodeType] || builtinNodeTypes[nodeType];
			if (NodeComponent === void 0) {
				onError?.("003", errorMessages["error003"](nodeType));
				nodeType = "default";
				NodeComponent = nodeTypes?.["default"] || builtinNodeTypes.default;
			}
			const isDraggable = !!(node.draggable || nodesDraggable && typeof node.draggable === "undefined");
			const isSelectable = !!(node.selectable || elementsSelectable && typeof node.selectable === "undefined");
			const isConnectable = !!(node.connectable || nodesConnectable && typeof node.connectable === "undefined");
			const isFocusable = !!(node.focusable || nodesFocusable && typeof node.focusable === "undefined");
			const store = useStoreApi();
			const hasDimensions = nodeHasDimensions(node);
			const nodeRef = useNodeObserver({
				node,
				nodeType,
				hasDimensions,
				resizeObserver
			});
			const dragging = useDrag({
				nodeRef,
				disabled: node.hidden || !isDraggable,
				noDragClassName,
				handleSelector: node.dragHandle,
				nodeId: id,
				isSelectable,
				nodeClickDistance
			});
			const moveSelectedNodes = useMoveSelectedNodes();
			if (node.hidden) return null;
			const nodeDimensions = getNodeDimensions(node);
			const inlineDimensions = getNodeInlineStyleDimensions(node);
			const hasPointerEvents = isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave;
			const onMouseEnterHandler = onMouseEnter ? (event) => onMouseEnter(event, { ...internals.userNode }) : void 0;
			const onMouseMoveHandler = onMouseMove ? (event) => onMouseMove(event, { ...internals.userNode }) : void 0;
			const onMouseLeaveHandler = onMouseLeave ? (event) => onMouseLeave(event, { ...internals.userNode }) : void 0;
			const onContextMenuHandler = onContextMenu ? (event) => onContextMenu(event, { ...internals.userNode }) : void 0;
			const onDoubleClickHandler = onDoubleClick ? (event) => onDoubleClick(event, { ...internals.userNode }) : void 0;
			const onSelectNodeHandler = (event) => {
				const { selectNodesOnDrag, nodeDragThreshold } = store.getState();
				if (isSelectable && (!selectNodesOnDrag || !isDraggable || nodeDragThreshold > 0)) handleNodeClick({
					id,
					store,
					nodeRef
				});
				if (onClick) onClick(event, { ...internals.userNode });
			};
			const onKeyDown = (event) => {
				if (isInputDOMNode(event.nativeEvent) || disableKeyboardA11y) return;
				if (elementSelectionKeys.includes(event.key) && isSelectable) handleNodeClick({
					id,
					store,
					unselect: event.key === "Escape",
					nodeRef
				});
				else if (isDraggable && node.selected && Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
					event.preventDefault();
					const { ariaLabelConfig } = store.getState();
					store.setState({ ariaLiveMessage: ariaLabelConfig["node.a11yDescription.ariaLiveMessage"]({
						direction: event.key.replace("Arrow", "").toLowerCase(),
						x: ~~internals.positionAbsolute.x,
						y: ~~internals.positionAbsolute.y
					}) });
					moveSelectedNodes({
						direction: arrowKeyDiffs[event.key],
						factor: event.shiftKey ? 4 : 1
					});
				}
			};
			const onFocus = () => {
				if (disableKeyboardA11y || !nodeRef.current?.matches(":focus-visible")) return;
				const { transform, width, height, autoPanOnNodeFocus, setCenter } = store.getState();
				if (!autoPanOnNodeFocus) return;
				if (!(getNodesInside(new Map([[id, node]]), {
					x: 0,
					y: 0,
					width,
					height
				}, transform, true).length > 0)) setCenter(node.position.x + nodeDimensions.width / 2, node.position.y + nodeDimensions.height / 2, { zoom: transform[2] });
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: cc([
					"react-flow__node",
					`react-flow__node-${nodeType}`,
					{ [noPanClassName]: isDraggable },
					node.className,
					{
						selected: node.selected,
						selectable: isSelectable,
						parent: isParent,
						draggable: isDraggable,
						dragging
					}
				]),
				ref: nodeRef,
				style: {
					zIndex: internals.z,
					transform: `translate(${internals.positionAbsolute.x}px,${internals.positionAbsolute.y}px)`,
					pointerEvents: hasPointerEvents ? "all" : "none",
					visibility: hasDimensions ? "visible" : "hidden",
					...node.style,
					...inlineDimensions
				},
				"data-id": id,
				"data-testid": `rf__node-${id}`,
				onMouseEnter: onMouseEnterHandler,
				onMouseMove: onMouseMoveHandler,
				onMouseLeave: onMouseLeaveHandler,
				onContextMenu: onContextMenuHandler,
				onClick: onSelectNodeHandler,
				onDoubleClick: onDoubleClickHandler,
				onKeyDown: isFocusable ? onKeyDown : void 0,
				tabIndex: isFocusable ? 0 : void 0,
				onFocus: isFocusable ? onFocus : void 0,
				role: node.ariaRole ?? (isFocusable ? "group" : void 0),
				"aria-roledescription": "node",
				"aria-describedby": disableKeyboardA11y ? void 0 : `${ARIA_NODE_DESC_KEY}-${rfId}`,
				"aria-label": node.ariaLabel,
				...node.domAttributes,
				children: (0, react_jsx_runtime.jsx)(Provider, {
					value: id,
					children: (0, react_jsx_runtime.jsx)(NodeComponent, {
						id,
						data: node.data,
						type: nodeType,
						positionAbsoluteX: internals.positionAbsolute.x,
						positionAbsoluteY: internals.positionAbsolute.y,
						selected: node.selected ?? false,
						selectable: isSelectable,
						draggable: isDraggable,
						deletable: node.deletable ?? true,
						isConnectable,
						sourcePosition: node.sourcePosition,
						targetPosition: node.targetPosition,
						dragging,
						dragHandle: node.dragHandle,
						zIndex: internals.z,
						parentId: node.parentId,
						...nodeDimensions
					})
				})
			});
		}
		var NodeWrapper$1 = (0, react.memo)(NodeWrapper);
		const selector$a = (s) => ({
			nodesConnectable: s.nodesConnectable,
			nodesFocusable: s.nodesFocusable,
			elementsSelectable: s.elementsSelectable,
			onError: s.onError
		});
		function NodeRendererComponent(props) {
			const { nodesConnectable, nodesFocusable, elementsSelectable, onError } = useStore(selector$a, shallow$1);
			const nodeIds = useVisibleNodeIds(props.onlyRenderVisibleElements);
			const resizeObserver = useResizeObserver();
			return (0, react_jsx_runtime.jsx)("div", {
				className: "react-flow__nodes",
				style: containerStyle,
				children: nodeIds.map((nodeId) => {
					return (0, react_jsx_runtime.jsx)(NodeWrapper$1, {
						id: nodeId,
						nodeTypes: props.nodeTypes,
						nodeExtent: props.nodeExtent,
						onClick: props.onNodeClick,
						onMouseEnter: props.onNodeMouseEnter,
						onMouseMove: props.onNodeMouseMove,
						onMouseLeave: props.onNodeMouseLeave,
						onContextMenu: props.onNodeContextMenu,
						onDoubleClick: props.onNodeDoubleClick,
						noDragClassName: props.noDragClassName,
						noPanClassName: props.noPanClassName,
						rfId: props.rfId,
						disableKeyboardA11y: props.disableKeyboardA11y,
						resizeObserver,
						nodesDraggable: props.nodesDraggable ?? true,
						nodesConnectable,
						nodesFocusable,
						elementsSelectable,
						nodeClickDistance: props.nodeClickDistance,
						onError
					}, nodeId);
				})
			});
		}
		NodeRendererComponent.displayName = "NodeRenderer";
		const NodeRenderer = (0, react.memo)(NodeRendererComponent);
		/**
		* Hook for getting the visible edge ids from the store.
		*
		* @internal
		* @param onlyRenderVisible
		* @returns array with visible edge ids
		*/
		function useVisibleEdgeIds(onlyRenderVisible) {
			return useStore((0, react.useCallback)((s) => {
				if (!onlyRenderVisible) return s.edges.map((edge) => edge.id);
				const visibleEdgeIds = [];
				if (s.width && s.height) for (const edge of s.edges) {
					const sourceNode = s.nodeLookup.get(edge.source);
					const targetNode = s.nodeLookup.get(edge.target);
					if (sourceNode && targetNode && isEdgeVisible({
						sourceNode,
						targetNode,
						width: s.width,
						height: s.height,
						transform: s.transform
					})) visibleEdgeIds.push(edge.id);
				}
				return visibleEdgeIds;
			}, [onlyRenderVisible]), shallow$1);
		}
		const ArrowSymbol = ({ color = "none", strokeWidth = 1 }) => {
			return (0, react_jsx_runtime.jsx)("polyline", {
				className: "arrow",
				style: {
					strokeWidth,
					...color && { stroke: color }
				},
				strokeLinecap: "round",
				fill: "none",
				strokeLinejoin: "round",
				points: "-5,-4 0,0 -5,4"
			});
		};
		const ArrowClosedSymbol = ({ color = "none", strokeWidth = 1 }) => {
			return (0, react_jsx_runtime.jsx)("polyline", {
				className: "arrowclosed",
				style: {
					strokeWidth,
					...color && {
						stroke: color,
						fill: color
					}
				},
				strokeLinecap: "round",
				strokeLinejoin: "round",
				points: "-5,-4 0,0 -5,4 -5,-4"
			});
		};
		const MarkerSymbols = {
			[MarkerType.Arrow]: ArrowSymbol,
			[MarkerType.ArrowClosed]: ArrowClosedSymbol
		};
		function useMarkerSymbol(type) {
			const store = useStoreApi();
			return (0, react.useMemo)(() => {
				if (!Object.prototype.hasOwnProperty.call(MarkerSymbols, type)) {
					store.getState().onError?.("009", errorMessages["error009"](type));
					return null;
				}
				return MarkerSymbols[type];
			}, [type]);
		}
		const Marker = ({ id, type, color, width = 12.5, height = 12.5, markerUnits = "strokeWidth", strokeWidth, orient = "auto-start-reverse" }) => {
			const Symbol = useMarkerSymbol(type);
			if (!Symbol) return null;
			return (0, react_jsx_runtime.jsx)("marker", {
				className: "react-flow__arrowhead",
				id,
				markerWidth: `${width}`,
				markerHeight: `${height}`,
				viewBox: "-10 -10 20 20",
				markerUnits,
				orient,
				refX: "0",
				refY: "0",
				children: (0, react_jsx_runtime.jsx)(Symbol, {
					color,
					strokeWidth
				})
			});
		};
		const MarkerDefinitions = ({ defaultColor, rfId }) => {
			const edges = useStore((s) => s.edges);
			const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
			const markers = (0, react.useMemo)(() => {
				return createMarkerIds(edges, {
					id: rfId,
					defaultColor,
					defaultMarkerStart: defaultEdgeOptions?.markerStart,
					defaultMarkerEnd: defaultEdgeOptions?.markerEnd
				});
			}, [
				edges,
				defaultEdgeOptions,
				rfId,
				defaultColor
			]);
			if (!markers.length) return null;
			return (0, react_jsx_runtime.jsx)("svg", {
				className: "react-flow__marker",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("defs", { children: markers.map((marker) => (0, react_jsx_runtime.jsx)(Marker, {
					id: marker.id,
					type: marker.type,
					color: marker.color,
					width: marker.width,
					height: marker.height,
					markerUnits: marker.markerUnits,
					strokeWidth: marker.strokeWidth,
					orient: marker.orient
				}, marker.id)) })
			});
		};
		MarkerDefinitions.displayName = "MarkerDefinitions";
		var MarkerDefinitions$1 = (0, react.memo)(MarkerDefinitions);
		function EdgeTextComponent({ x, y, label, labelStyle, labelShowBg = true, labelBgStyle, labelBgPadding = [2, 4], labelBgBorderRadius = 2, children, className, ...rest }) {
			const [edgeTextBbox, setEdgeTextBbox] = (0, react.useState)({
				x: 1,
				y: 0,
				width: 0,
				height: 0
			});
			const edgeTextClasses = cc(["react-flow__edge-textwrapper", className]);
			const edgeTextRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (edgeTextRef.current) {
					const textBbox = edgeTextRef.current.getBBox();
					setEdgeTextBbox({
						x: textBbox.x,
						y: textBbox.y,
						width: textBbox.width,
						height: textBbox.height
					});
				}
			}, [label]);
			if (!label) return null;
			return (0, react_jsx_runtime.jsxs)("g", {
				transform: `translate(${x - edgeTextBbox.width / 2} ${y - edgeTextBbox.height / 2})`,
				className: edgeTextClasses,
				visibility: edgeTextBbox.width ? "visible" : "hidden",
				...rest,
				children: [
					labelShowBg && (0, react_jsx_runtime.jsx)("rect", {
						width: edgeTextBbox.width + 2 * labelBgPadding[0],
						x: -labelBgPadding[0],
						y: -labelBgPadding[1],
						height: edgeTextBbox.height + 2 * labelBgPadding[1],
						className: "react-flow__edge-textbg",
						style: labelBgStyle,
						rx: labelBgBorderRadius,
						ry: labelBgBorderRadius
					}),
					(0, react_jsx_runtime.jsx)("text", {
						className: "react-flow__edge-text",
						y: edgeTextBbox.height / 2,
						dy: "0.3em",
						ref: edgeTextRef,
						style: labelStyle,
						children: label
					}),
					children
				]
			});
		}
		EdgeTextComponent.displayName = "EdgeText";
		/**
		* You can use the `<EdgeText />` component as a helper component to display text
		* within your custom edges.
		*
		* @public
		*
		* @example
		* ```jsx
		* import { EdgeText } from '@xyflow/react';
		*
		* export function CustomEdgeLabel({ label }) {
		*   return (
		*     <EdgeText
		*       x={100}
		*       y={100}
		*       label={label}
		*       labelStyle={{ fill: 'white' }}
		*       labelShowBg
		*       labelBgStyle={{ fill: 'red' }}
		*       labelBgPadding={[2, 4]}
		*       labelBgBorderRadius={2}
		*     />
		*   );
		* }
		*```
		*/
		const EdgeText = (0, react.memo)(EdgeTextComponent);
		/**
		* The `<BaseEdge />` component gets used internally for all the edges. It can be
		* used inside a custom edge and handles the invisible helper edge and the edge label
		* for you.
		*
		* @public
		* @example
		* ```jsx
		*import { BaseEdge } from '@xyflow/react';
		*
		*export function CustomEdge({ sourceX, sourceY, targetX, targetY, ...props }) {
		*  const [edgePath] = getStraightPath({
		*    sourceX,
		*    sourceY,
		*    targetX,
		*    targetY,
		*  });
		*
		*  return <BaseEdge path={edgePath} {...props} />;
		*}
		*```
		*
		* @remarks If you want to use an edge marker with the [`<BaseEdge />`](/api-reference/components/base-edge) component,
		* you can pass the `markerStart` or `markerEnd` props passed to your custom edge
		* through to the [`<BaseEdge />`](/api-reference/components/base-edge) component.
		* You can see all the props passed to a custom edge by looking at the [`EdgeProps`](/api-reference/types/edge-props) type.
		*/
		function BaseEdge({ path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth = 20, ...props }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("path", {
					...props,
					d: path,
					fill: "none",
					className: cc(["react-flow__edge-path", props.className])
				}),
				interactionWidth ? (0, react_jsx_runtime.jsx)("path", {
					d: path,
					fill: "none",
					strokeOpacity: 0,
					strokeWidth: interactionWidth,
					className: "react-flow__edge-interaction"
				}) : null,
				label && isNumeric(labelX) && isNumeric(labelY) ? (0, react_jsx_runtime.jsx)(EdgeText, {
					x: labelX,
					y: labelY,
					label,
					labelStyle,
					labelShowBg,
					labelBgStyle,
					labelBgPadding,
					labelBgBorderRadius
				}) : null
			] });
		}
		function getControl({ pos, x1, y1, x2, y2 }) {
			if (pos === Position.Left || pos === Position.Right) return [.5 * (x1 + x2), y1];
			return [x1, .5 * (y1 + y2)];
		}
		/**
		* The `getSimpleBezierPath` util returns everything you need to render a simple
		* bezier edge between two nodes.
		* @public
		* @returns
		* - `path`: the path to use in an SVG `<path>` element.
		* - `labelX`: the `x` position you can use to render a label for this edge.
		* - `labelY`: the `y` position you can use to render a label for this edge.
		* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
		* middle of this path.
		* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
		* middle of this path.
		*/
		function getSimpleBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top }) {
			const [sourceControlX, sourceControlY] = getControl({
				pos: sourcePosition,
				x1: sourceX,
				y1: sourceY,
				x2: targetX,
				y2: targetY
			});
			const [targetControlX, targetControlY] = getControl({
				pos: targetPosition,
				x1: targetX,
				y1: targetY,
				x2: sourceX,
				y2: sourceY
			});
			const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourceControlX,
				sourceControlY,
				targetControlX,
				targetControlY
			});
			return [
				`M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
				labelX,
				labelY,
				offsetX,
				offsetY
			];
		}
		function createSimpleBezierEdge(params) {
			return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth }) => {
				const [path, labelX, labelY] = getSimpleBezierPath({
					sourceX,
					sourceY,
					sourcePosition,
					targetX,
					targetY,
					targetPosition
				});
				return (0, react_jsx_runtime.jsx)(BaseEdge, {
					id: params.isInternal ? void 0 : id,
					path,
					labelX,
					labelY,
					label,
					labelStyle,
					labelShowBg,
					labelBgStyle,
					labelBgPadding,
					labelBgBorderRadius,
					style,
					markerEnd,
					markerStart,
					interactionWidth
				});
			});
		}
		const SimpleBezierEdge = createSimpleBezierEdge({ isInternal: false });
		const SimpleBezierEdgeInternal = createSimpleBezierEdge({ isInternal: true });
		SimpleBezierEdge.displayName = "SimpleBezierEdge";
		SimpleBezierEdgeInternal.displayName = "SimpleBezierEdgeInternal";
		function createSmoothStepEdge(params) {
			return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, sourcePosition = Position.Bottom, targetPosition = Position.Top, markerEnd, markerStart, pathOptions, interactionWidth }) => {
				const [path, labelX, labelY] = getSmoothStepPath({
					sourceX,
					sourceY,
					sourcePosition,
					targetX,
					targetY,
					targetPosition,
					borderRadius: pathOptions?.borderRadius,
					offset: pathOptions?.offset,
					stepPosition: pathOptions?.stepPosition
				});
				return (0, react_jsx_runtime.jsx)(BaseEdge, {
					id: params.isInternal ? void 0 : id,
					path,
					labelX,
					labelY,
					label,
					labelStyle,
					labelShowBg,
					labelBgStyle,
					labelBgPadding,
					labelBgBorderRadius,
					style,
					markerEnd,
					markerStart,
					interactionWidth
				});
			});
		}
		/**
		* Component that can be used inside a custom edge to render a smooth step edge.
		*
		* @public
		* @example
		*
		* ```tsx
		* import { SmoothStepEdge } from '@xyflow/react';
		*
		* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
		*   return (
		*     <SmoothStepEdge
		*       sourceX={sourceX}
		*       sourceY={sourceY}
		*       targetX={targetX}
		*       targetY={targetY}
		*       sourcePosition={sourcePosition}
		*       targetPosition={targetPosition}
		*     />
		*   );
		* }
		* ```
		*/
		const SmoothStepEdge = createSmoothStepEdge({ isInternal: false });
		/**
		* @internal
		*/
		const SmoothStepEdgeInternal = createSmoothStepEdge({ isInternal: true });
		SmoothStepEdge.displayName = "SmoothStepEdge";
		SmoothStepEdgeInternal.displayName = "SmoothStepEdgeInternal";
		function createStepEdge(params) {
			return (0, react.memo)(({ id, ...props }) => {
				const _id = params.isInternal ? void 0 : id;
				return (0, react_jsx_runtime.jsx)(SmoothStepEdge, {
					...props,
					id: _id,
					pathOptions: (0, react.useMemo)(() => ({
						borderRadius: 0,
						offset: props.pathOptions?.offset
					}), [props.pathOptions?.offset])
				});
			});
		}
		/**
		* Component that can be used inside a custom edge to render a step edge.
		*
		* @public
		* @example
		*
		* ```tsx
		* import { StepEdge } from '@xyflow/react';
		*
		* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
		*   return (
		*     <StepEdge
		*       sourceX={sourceX}
		*       sourceY={sourceY}
		*       targetX={targetX}
		*       targetY={targetY}
		*       sourcePosition={sourcePosition}
		*       targetPosition={targetPosition}
		*     />
		*   );
		* }
		* ```
		*/
		const StepEdge = createStepEdge({ isInternal: false });
		/**
		* @internal
		*/
		const StepEdgeInternal = createStepEdge({ isInternal: true });
		StepEdge.displayName = "StepEdge";
		StepEdgeInternal.displayName = "StepEdgeInternal";
		function createStraightEdge(params) {
			return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth }) => {
				const [path, labelX, labelY] = getStraightPath({
					sourceX,
					sourceY,
					targetX,
					targetY
				});
				return (0, react_jsx_runtime.jsx)(BaseEdge, {
					id: params.isInternal ? void 0 : id,
					path,
					labelX,
					labelY,
					label,
					labelStyle,
					labelShowBg,
					labelBgStyle,
					labelBgPadding,
					labelBgBorderRadius,
					style,
					markerEnd,
					markerStart,
					interactionWidth
				});
			});
		}
		/**
		* Component that can be used inside a custom edge to render a straight line.
		*
		* @public
		* @example
		*
		* ```tsx
		* import { StraightEdge } from '@xyflow/react';
		*
		* function CustomEdge({ sourceX, sourceY, targetX, targetY }) {
		*   return (
		*     <StraightEdge
		*       sourceX={sourceX}
		*       sourceY={sourceY}
		*       targetX={targetX}
		*       targetY={targetY}
		*     />
		*   );
		* }
		* ```
		*/
		const StraightEdge = createStraightEdge({ isInternal: false });
		/**
		* @internal
		*/
		const StraightEdgeInternal = createStraightEdge({ isInternal: true });
		StraightEdge.displayName = "StraightEdge";
		StraightEdgeInternal.displayName = "StraightEdgeInternal";
		function createBezierEdge(params) {
			return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, sourcePosition = Position.Bottom, targetPosition = Position.Top, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, pathOptions, interactionWidth }) => {
				const [path, labelX, labelY] = getBezierPath({
					sourceX,
					sourceY,
					sourcePosition,
					targetX,
					targetY,
					targetPosition,
					curvature: pathOptions?.curvature
				});
				return (0, react_jsx_runtime.jsx)(BaseEdge, {
					id: params.isInternal ? void 0 : id,
					path,
					labelX,
					labelY,
					label,
					labelStyle,
					labelShowBg,
					labelBgStyle,
					labelBgPadding,
					labelBgBorderRadius,
					style,
					markerEnd,
					markerStart,
					interactionWidth
				});
			});
		}
		/**
		* Component that can be used inside a custom edge to render a bezier curve.
		*
		* @public
		* @example
		*
		* ```tsx
		* import { BezierEdge } from '@xyflow/react';
		*
		* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
		*   return (
		*     <BezierEdge
		*       sourceX={sourceX}
		*       sourceY={sourceY}
		*       targetX={targetX}
		*       targetY={targetY}
		*       sourcePosition={sourcePosition}
		*       targetPosition={targetPosition}
		*     />
		*   );
		* }
		* ```
		*/
		const BezierEdge = createBezierEdge({ isInternal: false });
		/**
		* @internal
		*/
		const BezierEdgeInternal = createBezierEdge({ isInternal: true });
		BezierEdge.displayName = "BezierEdge";
		BezierEdgeInternal.displayName = "BezierEdgeInternal";
		const builtinEdgeTypes = {
			default: BezierEdgeInternal,
			straight: StraightEdgeInternal,
			step: StepEdgeInternal,
			smoothstep: SmoothStepEdgeInternal,
			simplebezier: SimpleBezierEdgeInternal
		};
		const nullPosition = {
			sourceX: null,
			sourceY: null,
			targetX: null,
			targetY: null,
			sourcePosition: null,
			targetPosition: null,
			zIndex: void 0
		};
		const shiftX = (x, shift, position) => {
			if (position === Position.Left) return x - shift;
			if (position === Position.Right) return x + shift;
			return x;
		};
		const shiftY = (y, shift, position) => {
			if (position === Position.Top) return y - shift;
			if (position === Position.Bottom) return y + shift;
			return y;
		};
		const EdgeUpdaterClassName = "react-flow__edgeupdater";
		/**
		* @internal
		*/
		function EdgeAnchor({ position, centerX, centerY, radius = 10, onMouseDown, onMouseEnter, onMouseOut, type }) {
			return (0, react_jsx_runtime.jsx)("circle", {
				onMouseDown,
				onMouseEnter,
				onMouseOut,
				className: cc([EdgeUpdaterClassName, `${EdgeUpdaterClassName}-${type}`]),
				cx: shiftX(centerX, radius, position),
				cy: shiftY(centerY, radius, position),
				r: radius,
				stroke: "transparent",
				fill: "transparent"
			});
		}
		function EdgeUpdateAnchors({ isReconnectable, reconnectRadius, edge, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, onReconnect, onReconnectStart, onReconnectEnd, setReconnecting, setUpdateHover }) {
			const store = useStoreApi();
			const handleEdgeUpdater = (event, oppositeHandle) => {
				if (event.button !== 0) return;
				const { autoPanOnConnect, domNode, connectionMode, connectionRadius, lib, onConnectStart, cancelConnection, nodeLookup, rfId: flowId, panBy, updateConnection } = store.getState();
				const isTarget = oppositeHandle.type === "target";
				const _onReconnectEnd = (evt, connectionState) => {
					setReconnecting(false);
					onReconnectEnd?.(evt, edge, oppositeHandle.type, connectionState);
				};
				const onConnectEdge = (connection) => onReconnect?.(edge, connection);
				const _onConnectStart = (_event, params) => {
					setReconnecting(true);
					onReconnectStart?.(event, edge, oppositeHandle.type);
					onConnectStart?.(_event, params);
				};
				XYHandle.onPointerDown(event.nativeEvent, {
					autoPanOnConnect,
					connectionMode,
					connectionRadius,
					domNode,
					handleId: oppositeHandle.id,
					nodeId: oppositeHandle.nodeId,
					nodeLookup,
					isTarget,
					edgeUpdaterType: oppositeHandle.type,
					lib,
					flowId,
					cancelConnection,
					panBy,
					isValidConnection: (...args) => store.getState().isValidConnection?.(...args) ?? true,
					onConnect: onConnectEdge,
					onConnectStart: _onConnectStart,
					onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
					onReconnectEnd: _onReconnectEnd,
					updateConnection,
					getTransform: () => store.getState().transform,
					getFromHandle: () => store.getState().connection.fromHandle,
					dragThreshold: store.getState().connectionDragThreshold,
					handleDomNode: event.currentTarget
				});
			};
			const onReconnectSourceMouseDown = (event) => handleEdgeUpdater(event, {
				nodeId: edge.target,
				id: edge.targetHandle ?? null,
				type: "target"
			});
			const onReconnectTargetMouseDown = (event) => handleEdgeUpdater(event, {
				nodeId: edge.source,
				id: edge.sourceHandle ?? null,
				type: "source"
			});
			const onReconnectMouseEnter = () => setUpdateHover(true);
			const onReconnectMouseOut = () => setUpdateHover(false);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(isReconnectable === true || isReconnectable === "source") && (0, react_jsx_runtime.jsx)(EdgeAnchor, {
				position: sourcePosition,
				centerX: sourceX,
				centerY: sourceY,
				radius: reconnectRadius,
				onMouseDown: onReconnectSourceMouseDown,
				onMouseEnter: onReconnectMouseEnter,
				onMouseOut: onReconnectMouseOut,
				type: "source"
			}), (isReconnectable === true || isReconnectable === "target") && (0, react_jsx_runtime.jsx)(EdgeAnchor, {
				position: targetPosition,
				centerX: targetX,
				centerY: targetY,
				radius: reconnectRadius,
				onMouseDown: onReconnectTargetMouseDown,
				onMouseEnter: onReconnectMouseEnter,
				onMouseOut: onReconnectMouseOut,
				type: "target"
			})] });
		}
		function EdgeWrapper({ id, edgesFocusable, edgesReconnectable, elementsSelectable, onClick, onDoubleClick, onContextMenu, onMouseEnter, onMouseMove, onMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, rfId, edgeTypes, noPanClassName, onError, disableKeyboardA11y }) {
			let edge = useStore((s) => s.edgeLookup.get(id));
			const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
			edge = defaultEdgeOptions ? {
				...defaultEdgeOptions,
				...edge
			} : edge;
			let edgeType = edge.type || "default";
			let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType];
			if (EdgeComponent === void 0) {
				onError?.("011", errorMessages["error011"](edgeType));
				edgeType = "default";
				EdgeComponent = edgeTypes?.["default"] || builtinEdgeTypes.default;
			}
			const isFocusable = !!(edge.focusable || edgesFocusable && typeof edge.focusable === "undefined");
			const isReconnectable = typeof onReconnect !== "undefined" && (edge.reconnectable || edgesReconnectable && typeof edge.reconnectable === "undefined");
			const isSelectable = !!(edge.selectable || elementsSelectable && typeof edge.selectable === "undefined");
			const edgeRef = (0, react.useRef)(null);
			const [updateHover, setUpdateHover] = (0, react.useState)(false);
			const [reconnecting, setReconnecting] = (0, react.useState)(false);
			const store = useStoreApi();
			const { zIndex = edge.zIndex, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useStore((0, react.useCallback)((store) => {
				const sourceNode = store.nodeLookup.get(edge.source);
				const targetNode = store.nodeLookup.get(edge.target);
				if (!sourceNode || !targetNode) return nullPosition;
				const edgePosition = getEdgePosition({
					id,
					sourceNode,
					targetNode,
					sourceHandle: edge.sourceHandle || null,
					targetHandle: edge.targetHandle || null,
					connectionMode: store.connectionMode,
					onError
				});
				const zIndex = getElevatedEdgeZIndex({
					selected: edge.selected,
					zIndex: edge.zIndex,
					sourceNode,
					targetNode,
					elevateOnSelect: store.elevateEdgesOnSelect,
					zIndexMode: store.zIndexMode
				});
				return {
					...edgePosition || nullPosition,
					zIndex
				};
			}, [
				edge.source,
				edge.target,
				edge.sourceHandle,
				edge.targetHandle,
				edge.selected,
				edge.zIndex,
				onError
			]), shallow$1);
			const markerStartUrl = (0, react.useMemo)(() => edge.markerStart ? `url('#${getMarkerId(edge.markerStart, rfId)}')` : void 0, [edge.markerStart, rfId]);
			const markerEndUrl = (0, react.useMemo)(() => edge.markerEnd ? `url('#${getMarkerId(edge.markerEnd, rfId)}')` : void 0, [edge.markerEnd, rfId]);
			if (edge.hidden || sourceX === null || sourceY === null || targetX === null || targetY === null) return null;
			const onEdgeClick = (event) => {
				const { addSelectedEdges, unselectNodesAndEdges, multiSelectionActive } = store.getState();
				if (isSelectable) {
					store.setState({ nodesSelectionActive: false });
					if (edge.selected && multiSelectionActive) {
						unselectNodesAndEdges({
							nodes: [],
							edges: [edge]
						});
						edgeRef.current?.blur();
					} else addSelectedEdges([id]);
				}
				if (onClick) onClick(event, edge);
			};
			const onEdgeDoubleClick = onDoubleClick ? (event) => {
				onDoubleClick(event, { ...edge });
			} : void 0;
			const onEdgeContextMenu = onContextMenu ? (event) => {
				onContextMenu(event, { ...edge });
			} : void 0;
			const onEdgeMouseEnter = onMouseEnter ? (event) => {
				onMouseEnter(event, { ...edge });
			} : void 0;
			const onEdgeMouseMove = onMouseMove ? (event) => {
				onMouseMove(event, { ...edge });
			} : void 0;
			const onEdgeMouseLeave = onMouseLeave ? (event) => {
				onMouseLeave(event, { ...edge });
			} : void 0;
			const onKeyDown = (event) => {
				if (!disableKeyboardA11y && elementSelectionKeys.includes(event.key) && isSelectable) {
					const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
					if (event.key === "Escape") {
						edgeRef.current?.blur();
						unselectNodesAndEdges({ edges: [edge] });
					} else addSelectedEdges([id]);
				}
			};
			return (0, react_jsx_runtime.jsx)("svg", {
				style: { zIndex },
				children: (0, react_jsx_runtime.jsxs)("g", {
					className: cc([
						"react-flow__edge",
						`react-flow__edge-${edgeType}`,
						edge.className,
						noPanClassName,
						{
							selected: edge.selected,
							animated: edge.animated,
							inactive: !isSelectable && !onClick,
							updating: updateHover,
							selectable: isSelectable
						}
					]),
					onClick: onEdgeClick,
					onDoubleClick: onEdgeDoubleClick,
					onContextMenu: onEdgeContextMenu,
					onMouseEnter: onEdgeMouseEnter,
					onMouseMove: onEdgeMouseMove,
					onMouseLeave: onEdgeMouseLeave,
					onKeyDown: isFocusable ? onKeyDown : void 0,
					tabIndex: isFocusable ? 0 : void 0,
					role: edge.ariaRole ?? (isFocusable ? "group" : "img"),
					"aria-roledescription": "edge",
					"data-id": id,
					"data-testid": `rf__edge-${id}`,
					"aria-label": edge.ariaLabel === null ? void 0 : edge.ariaLabel || `Edge from ${edge.source} to ${edge.target}`,
					"aria-describedby": isFocusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : void 0,
					ref: edgeRef,
					...edge.domAttributes,
					children: [!reconnecting && (0, react_jsx_runtime.jsx)(EdgeComponent, {
						id,
						source: edge.source,
						target: edge.target,
						type: edge.type,
						selected: edge.selected,
						animated: edge.animated,
						selectable: isSelectable,
						deletable: edge.deletable ?? true,
						label: edge.label,
						labelStyle: edge.labelStyle,
						labelShowBg: edge.labelShowBg,
						labelBgStyle: edge.labelBgStyle,
						labelBgPadding: edge.labelBgPadding,
						labelBgBorderRadius: edge.labelBgBorderRadius,
						sourceX,
						sourceY,
						targetX,
						targetY,
						sourcePosition,
						targetPosition,
						data: edge.data,
						style: edge.style,
						sourceHandleId: edge.sourceHandle,
						targetHandleId: edge.targetHandle,
						markerStart: markerStartUrl,
						markerEnd: markerEndUrl,
						pathOptions: "pathOptions" in edge ? edge.pathOptions : void 0,
						interactionWidth: edge.interactionWidth
					}), isReconnectable && (0, react_jsx_runtime.jsx)(EdgeUpdateAnchors, {
						edge,
						isReconnectable,
						reconnectRadius,
						onReconnect,
						onReconnectStart,
						onReconnectEnd,
						sourceX,
						sourceY,
						targetX,
						targetY,
						sourcePosition,
						targetPosition,
						setUpdateHover,
						setReconnecting
					})]
				})
			});
		}
		var EdgeWrapper$1 = (0, react.memo)(EdgeWrapper);
		const selector$9 = (s) => ({
			edgesFocusable: s.edgesFocusable,
			edgesReconnectable: s.edgesReconnectable,
			elementsSelectable: s.elementsSelectable,
			connectionMode: s.connectionMode,
			onError: s.onError
		});
		function EdgeRendererComponent({ defaultMarkerColor, onlyRenderVisibleElements, rfId, edgeTypes, noPanClassName, onReconnect, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, onEdgeClick, reconnectRadius, onEdgeDoubleClick, onReconnectStart, onReconnectEnd, disableKeyboardA11y }) {
			const { edgesFocusable, edgesReconnectable, elementsSelectable, onError } = useStore(selector$9, shallow$1);
			const edgeIds = useVisibleEdgeIds(onlyRenderVisibleElements);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "react-flow__edges",
				children: [(0, react_jsx_runtime.jsx)(MarkerDefinitions$1, {
					defaultColor: defaultMarkerColor,
					rfId
				}), edgeIds.map((id) => {
					return (0, react_jsx_runtime.jsx)(EdgeWrapper$1, {
						id,
						edgesFocusable,
						edgesReconnectable,
						elementsSelectable,
						noPanClassName,
						onReconnect,
						onContextMenu: onEdgeContextMenu,
						onMouseEnter: onEdgeMouseEnter,
						onMouseMove: onEdgeMouseMove,
						onMouseLeave: onEdgeMouseLeave,
						onClick: onEdgeClick,
						reconnectRadius,
						onDoubleClick: onEdgeDoubleClick,
						onReconnectStart,
						onReconnectEnd,
						rfId,
						onError,
						edgeTypes,
						disableKeyboardA11y
					}, id);
				})]
			});
		}
		EdgeRendererComponent.displayName = "EdgeRenderer";
		const EdgeRenderer = (0, react.memo)(EdgeRendererComponent);
		const toTransformString = (transform) => `translate(${transform[0]}px,${transform[1]}px) scale(${transform[2]})`;
		function Viewport({ children }) {
			const store = useStoreApi();
			const viewportRef = (0, react.useRef)(null);
			const [initialTransform] = (0, react.useState)(() => store.getState().transform);
			useIsomorphicLayoutEffect(() => {
				let prevTransform = null;
				const applyTransform = () => {
					const transform = store.getState().transform;
					if (prevTransform && transform[0] === prevTransform[0] && transform[1] === prevTransform[1] && transform[2] === prevTransform[2]) return;
					prevTransform = transform;
					if (viewportRef.current) viewportRef.current.style.transform = toTransformString(transform);
				};
				applyTransform();
				return store.subscribe(applyTransform);
			}, [store]);
			return (0, react_jsx_runtime.jsx)("div", {
				ref: viewportRef,
				className: "react-flow__viewport xyflow__viewport react-flow__container",
				style: { transform: toTransformString(initialTransform) },
				children
			});
		}
		/**
		* Hook for calling onInit handler.
		*
		* @internal
		*/
		function useOnInitHandler(onInit) {
			const rfInstance = useReactFlow();
			const isInitialized = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (!isInitialized.current && rfInstance.viewportInitialized && onInit) {
					setTimeout(() => onInit(rfInstance), 1);
					isInitialized.current = true;
				}
			}, [onInit, rfInstance.viewportInitialized]);
		}
		const selector$8 = (state) => state.panZoom?.syncViewport;
		/**
		* Hook for syncing the viewport with the panzoom instance.
		*
		* @internal
		* @param viewport
		*/
		function useViewportSync(viewport) {
			const syncViewport = useStore(selector$8);
			const store = useStoreApi();
			(0, react.useEffect)(() => {
				if (viewport) {
					syncViewport?.(viewport);
					store.setState({ transform: [
						viewport.x,
						viewport.y,
						viewport.zoom
					] });
				}
			}, [viewport, syncViewport]);
			return null;
		}
		function storeSelector$1(s) {
			return s.connection.inProgress ? {
				...s.connection,
				to: pointToRendererPoint(s.connection.to, s.transform)
			} : { ...s.connection };
		}
		function getSelector(connectionSelector) {
			if (connectionSelector) {
				const combinedSelector = (s) => {
					return connectionSelector(storeSelector$1(s));
				};
				return combinedSelector;
			}
			return storeSelector$1;
		}
		/**
		* The `useConnection` hook returns the current connection when there is an active
		* connection interaction. If no connection interaction is active, it returns null
		* for every property. A typical use case for this hook is to colorize handles
		* based on a certain condition (e.g. if the connection is valid or not).
		*
		* @public
		* @param connectionSelector - An optional selector function used to extract a slice of the
		* `ConnectionState` data. Using a selector can prevent component re-renders where data you don't
		* otherwise care about might change. If a selector is not provided, the entire `ConnectionState`
		* object is returned unchanged.
		* @example
		*
		* ```tsx
		*import { useConnection } from '@xyflow/react';
		*
		*function App() {
		*  const connection = useConnection();
		*
		*  return (
		*    <div> {connection ? `Someone is trying to make a connection from ${connection.fromNode} to this one.` : 'There are currently no incoming connections!'}
		*
		*   </div>
		*   );
		* }
		* ```
		*
		* @returns ConnectionState
		*/
		function useConnection(connectionSelector) {
			return useStore(getSelector(connectionSelector), shallow$1);
		}
		const selector$7 = (s) => ({
			nodesConnectable: s.nodesConnectable,
			isValid: s.connection.isValid,
			inProgress: s.connection.inProgress,
			width: s.width,
			height: s.height
		});
		function ConnectionLineWrapper({ containerStyle, style, type, component }) {
			const { nodesConnectable, width, height, isValid, inProgress } = useStore(selector$7, shallow$1);
			if (!!!(width && nodesConnectable && inProgress)) return null;
			return (0, react_jsx_runtime.jsx)("svg", {
				style: containerStyle,
				width,
				height,
				className: "react-flow__connectionline react-flow__container",
				children: (0, react_jsx_runtime.jsx)("g", {
					className: cc(["react-flow__connection", getConnectionStatus(isValid)]),
					children: (0, react_jsx_runtime.jsx)(ConnectionLine, {
						style,
						type,
						CustomComponent: component,
						isValid
					})
				})
			});
		}
		const ConnectionLine = ({ style, type = ConnectionLineType.Bezier, CustomComponent, isValid }) => {
			const { inProgress, from, fromNode, fromHandle, fromPosition, to, toNode, toHandle, toPosition, pointer } = useConnection();
			if (!inProgress) return;
			if (CustomComponent) return (0, react_jsx_runtime.jsx)(CustomComponent, {
				connectionLineType: type,
				connectionLineStyle: style,
				fromNode,
				fromHandle,
				fromX: from.x,
				fromY: from.y,
				toX: to.x,
				toY: to.y,
				fromPosition,
				toPosition,
				connectionStatus: getConnectionStatus(isValid),
				toNode,
				toHandle,
				pointer
			});
			let path = "";
			const pathParams = {
				sourceX: from.x,
				sourceY: from.y,
				sourcePosition: fromPosition,
				targetX: to.x,
				targetY: to.y,
				targetPosition: toPosition
			};
			switch (type) {
				case ConnectionLineType.Bezier:
					[path] = getBezierPath(pathParams);
					break;
				case ConnectionLineType.SimpleBezier:
					[path] = getSimpleBezierPath(pathParams);
					break;
				case ConnectionLineType.Step:
					[path] = getSmoothStepPath({
						...pathParams,
						borderRadius: 0
					});
					break;
				case ConnectionLineType.SmoothStep:
					[path] = getSmoothStepPath(pathParams);
					break;
				default: [path] = getStraightPath(pathParams);
			}
			return (0, react_jsx_runtime.jsx)("path", {
				d: path,
				fill: "none",
				className: "react-flow__connection-path",
				style
			});
		};
		ConnectionLine.displayName = "ConnectionLine";
		const emptyTypes = {};
		function useNodeOrEdgeTypesWarning(nodeOrEdgeTypes = emptyTypes) {
			(0, react.useRef)(nodeOrEdgeTypes);
			useStoreApi();
			(0, react.useEffect)(() => {}, [nodeOrEdgeTypes]);
		}
		function useStylesLoadedWarning() {
			useStoreApi();
			(0, react.useRef)(false);
			(0, react.useEffect)(() => {}, []);
		}
		function GraphViewComponent({ nodeTypes, edgeTypes, onInit, onNodeClick, onEdgeClick, onNodeDoubleClick, onEdgeDoubleClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onSelectionContextMenu, onSelectionStart, onSelectionEnd, connectionLineType, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, selectionKeyCode, selectionOnDrag, selectionMode, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, deleteKeyCode, onlyRenderVisibleElements, elementsSelectable, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, defaultMarkerColor, zoomOnScroll, zoomOnPinch, panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag, autoPanOnSelection, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance, nodeClickDistance, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, noDragClassName, noWheelClassName, noPanClassName, disableKeyboardA11y, nodeExtent, rfId, viewport, onViewportChange, nodesDraggable }) {
			useNodeOrEdgeTypesWarning(nodeTypes);
			useNodeOrEdgeTypesWarning(edgeTypes);
			useStylesLoadedWarning();
			useOnInitHandler(onInit);
			useViewportSync(viewport);
			return (0, react_jsx_runtime.jsx)(FlowRenderer, {
				onPaneClick,
				onPaneMouseEnter,
				onPaneMouseMove,
				onPaneMouseLeave,
				onPaneContextMenu,
				onPaneScroll,
				paneClickDistance,
				deleteKeyCode,
				selectionKeyCode,
				selectionOnDrag,
				selectionMode,
				onSelectionStart,
				onSelectionEnd,
				multiSelectionKeyCode,
				panActivationKeyCode,
				zoomActivationKeyCode,
				elementsSelectable,
				zoomOnScroll,
				zoomOnPinch,
				zoomOnDoubleClick,
				panOnScroll,
				panOnScrollSpeed,
				panOnScrollMode,
				panOnDrag,
				autoPanOnSelection,
				defaultViewport,
				translateExtent,
				minZoom,
				maxZoom,
				onSelectionContextMenu,
				preventScrolling,
				noDragClassName,
				noWheelClassName,
				noPanClassName,
				disableKeyboardA11y,
				onViewportChange,
				isControlledViewport: !!viewport,
				children: (0, react_jsx_runtime.jsxs)(Viewport, { children: [
					(0, react_jsx_runtime.jsx)(EdgeRenderer, {
						edgeTypes,
						onEdgeClick,
						onEdgeDoubleClick,
						onReconnect,
						onReconnectStart,
						onReconnectEnd,
						onlyRenderVisibleElements,
						onEdgeContextMenu,
						onEdgeMouseEnter,
						onEdgeMouseMove,
						onEdgeMouseLeave,
						reconnectRadius,
						defaultMarkerColor,
						noPanClassName,
						disableKeyboardA11y,
						rfId
					}),
					(0, react_jsx_runtime.jsx)(ConnectionLineWrapper, {
						style: connectionLineStyle,
						type: connectionLineType,
						component: connectionLineComponent,
						containerStyle: connectionLineContainerStyle
					}),
					(0, react_jsx_runtime.jsx)("div", { className: "react-flow__edgelabel-renderer" }),
					(0, react_jsx_runtime.jsx)(NodeRenderer, {
						nodeTypes,
						onNodeClick,
						onNodeDoubleClick,
						onNodeMouseEnter,
						onNodeMouseMove,
						onNodeMouseLeave,
						onNodeContextMenu,
						nodeClickDistance,
						onlyRenderVisibleElements,
						noPanClassName,
						noDragClassName,
						disableKeyboardA11y,
						nodeExtent,
						rfId,
						nodesDraggable
					}),
					(0, react_jsx_runtime.jsx)("div", { className: "react-flow__viewport-portal" })
				] })
			});
		}
		GraphViewComponent.displayName = "GraphView";
		const GraphView = (0, react.memo)(GraphViewComponent);
		const devWarn = createDevWarn("React Flow", "https://reactflow.dev/");
		const getInitialState = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom = .5, maxZoom = 2, nodeOrigin, nodeExtent, zIndexMode = "basic" } = {}) => {
			const nodeLookup = /* @__PURE__ */ new Map();
			const parentLookup = /* @__PURE__ */ new Map();
			const connectionLookup = /* @__PURE__ */ new Map();
			const edgeLookup = /* @__PURE__ */ new Map();
			const storeEdges = defaultEdges ?? edges ?? [];
			const storeNodes = defaultNodes ?? nodes ?? [];
			const storeNodeOrigin = nodeOrigin ?? [0, 0];
			const storeNodeExtent = nodeExtent ?? infiniteExtent;
			updateConnectionLookup(connectionLookup, edgeLookup, storeEdges);
			const { nodesInitialized } = adoptUserNodes(storeNodes, nodeLookup, parentLookup, {
				nodeOrigin: storeNodeOrigin,
				nodeExtent: storeNodeExtent,
				zIndexMode
			});
			let transform = [
				0,
				0,
				1
			];
			if (fitView && width && height) {
				const { x, y, zoom } = getViewportForBounds(getInternalNodesBounds(nodeLookup, { filter: (node) => !!((node.width || node.initialWidth) && (node.height || node.initialHeight)) }), width, height, minZoom, maxZoom, fitViewOptions?.padding ?? .1);
				transform = [
					x,
					y,
					zoom
				];
			}
			return {
				rfId: "1",
				width: width ?? 0,
				height: height ?? 0,
				transform,
				nodes: storeNodes,
				nodesInitialized,
				nodeLookup,
				parentLookup,
				edges: storeEdges,
				edgeLookup,
				connectionLookup,
				onNodesChange: null,
				onEdgesChange: null,
				hasDefaultNodes: defaultNodes !== void 0,
				hasDefaultEdges: defaultEdges !== void 0,
				panZoom: null,
				minZoom,
				maxZoom,
				translateExtent: infiniteExtent,
				nodeExtent: storeNodeExtent,
				nodesSelectionActive: false,
				userSelectionActive: false,
				userSelectionRect: null,
				connectionMode: ConnectionMode.Strict,
				domNode: null,
				paneDragging: false,
				noPanClassName: "nopan",
				nodeOrigin: storeNodeOrigin,
				nodeDragThreshold: 1,
				connectionDragThreshold: 1,
				snapGrid: [15, 15],
				snapToGrid: false,
				nodesDraggable: true,
				nodesConnectable: true,
				nodesFocusable: true,
				edgesFocusable: true,
				edgesReconnectable: true,
				elementsSelectable: true,
				elevateNodesOnSelect: true,
				elevateEdgesOnSelect: true,
				selectNodesOnDrag: true,
				multiSelectionActive: false,
				fitViewQueued: fitView ?? false,
				fitViewOptions,
				fitViewResolver: null,
				connection: { ...initialConnection },
				connectionClickStartHandle: null,
				connectOnClick: true,
				ariaLiveMessage: "",
				autoPanOnConnect: true,
				autoPanOnNodeDrag: true,
				autoPanOnNodeFocus: true,
				autoPanSpeed: 15,
				connectionRadius: 20,
				onError: devWarn,
				isValidConnection: void 0,
				onSelectionChangeHandlers: [],
				lib: "react",
				debug: false,
				ariaLabelConfig: defaultAriaLabelConfig,
				zIndexMode,
				defaultEdgeOptions: void 0,
				onNodesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
				onEdgesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
				onNodesDelete: void 0,
				onEdgesDelete: void 0,
				onDelete: void 0,
				onBeforeDelete: void 0,
				onViewportChangeStart: void 0,
				onViewportChange: void 0,
				onViewportChangeEnd: void 0,
				onNodeDragStart: void 0,
				onNodeDrag: void 0,
				onNodeDragStop: void 0,
				onSelectionDragStart: void 0,
				onSelectionDrag: void 0,
				onSelectionDragStop: void 0,
				onMoveStart: void 0,
				onMove: void 0,
				onMoveEnd: void 0,
				onConnect: void 0,
				onConnectStart: void 0,
				onConnectEnd: void 0,
				onClickConnectStart: void 0,
				onClickConnectEnd: void 0
			};
		};
		const createStore = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) => createWithEqualityFn((set, get) => {
			async function resolveFitView() {
				const { nodeLookup, panZoom, fitViewOptions, fitViewResolver, width, height, minZoom, maxZoom } = get();
				if (!panZoom) return;
				await fitViewport({
					nodes: nodeLookup,
					width,
					height,
					panZoom,
					minZoom,
					maxZoom
				}, fitViewOptions);
				fitViewResolver?.resolve(true);
				/**
				* wait for the fitViewport to resolve before deleting the resolver,
				* we want to reuse the old resolver if the user calls fitView again in the mean time
				*/
				set({ fitViewResolver: null });
			}
			return {
				...getInitialState({
					nodes,
					edges,
					width,
					height,
					fitView,
					fitViewOptions,
					minZoom,
					maxZoom,
					nodeOrigin,
					nodeExtent,
					defaultNodes,
					defaultEdges,
					zIndexMode
				}),
				setNodes: (nodes) => {
					const { nodeLookup, parentLookup, nodeOrigin, nodeExtent, elevateNodesOnSelect, fitViewQueued, zIndexMode, nodesSelectionActive } = get();
					const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, nodeLookup, parentLookup, {
						nodeOrigin,
						nodeExtent,
						elevateNodesOnSelect,
						checkEquality: true,
						zIndexMode
					});
					const nextNodesSelectionActive = nodesSelectionActive && hasSelectedNodes;
					if (fitViewQueued && nodesInitialized) {
						resolveFitView();
						set({
							nodes,
							nodesInitialized,
							fitViewQueued: false,
							fitViewOptions: void 0,
							nodesSelectionActive: nextNodesSelectionActive
						});
					} else set({
						nodes,
						nodesInitialized,
						nodesSelectionActive: nextNodesSelectionActive
					});
				},
				setEdges: (edges) => {
					const { connectionLookup, edgeLookup } = get();
					updateConnectionLookup(connectionLookup, edgeLookup, edges);
					set({ edges });
				},
				setDefaultNodesAndEdges: (nodes, edges) => {
					if (nodes) {
						const { setNodes } = get();
						setNodes(nodes);
						set({ hasDefaultNodes: true });
					}
					if (edges) {
						const { setEdges } = get();
						setEdges(edges);
						set({ hasDefaultEdges: true });
					}
				},
				updateNodeInternals: (updates) => {
					const { triggerNodeChanges, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, debug, fitViewQueued, zIndexMode } = get();
					const { changes, updatedInternals } = updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode);
					if (!updatedInternals) return;
					updateAbsolutePositions(nodeLookup, parentLookup, {
						nodeOrigin,
						nodeExtent,
						zIndexMode
					});
					if (fitViewQueued) {
						resolveFitView();
						set({
							fitViewQueued: false,
							fitViewOptions: void 0
						});
					} else set({});
					if (changes?.length > 0) {
						if (debug) console.log("React Flow: trigger node changes", changes);
						triggerNodeChanges?.(changes);
					}
				},
				updateNodePositions: (nodeDragItems, dragging = false) => {
					const parentExpandChildren = [];
					let changes = [];
					const { nodeLookup, triggerNodeChanges, connection, updateConnection, onNodesChangeMiddlewareMap } = get();
					for (const [id, dragItem] of nodeDragItems) {
						const node = nodeLookup.get(id);
						const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);
						const change = {
							id,
							type: "position",
							position: expandParent ? {
								x: Math.max(0, dragItem.position.x),
								y: Math.max(0, dragItem.position.y)
							} : dragItem.position,
							dragging
						};
						if (node && connection.inProgress && connection.fromNode.id === node.id) {
							const updatedFrom = getHandlePosition(node, connection.fromHandle, Position.Left, true);
							updateConnection({
								...connection,
								from: updatedFrom
							});
						}
						if (expandParent && node.parentId) parentExpandChildren.push({
							id,
							parentId: node.parentId,
							rect: {
								...dragItem.internals.positionAbsolute,
								width: dragItem.measured.width ?? 0,
								height: dragItem.measured.height ?? 0
							}
						});
						changes.push(change);
					}
					if (parentExpandChildren.length > 0) {
						const { parentLookup, nodeOrigin } = get();
						const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
						changes.push(...parentExpandChanges);
					}
					for (const middleware of onNodesChangeMiddlewareMap.values()) changes = middleware(changes);
					triggerNodeChanges(changes);
				},
				triggerNodeChanges: (changes) => {
					const { onNodesChange, setNodes, nodes, hasDefaultNodes, debug } = get();
					if (changes?.length) {
						if (hasDefaultNodes) setNodes(applyNodeChanges(changes, nodes));
						if (debug) console.log("React Flow: trigger node changes", changes);
						onNodesChange?.(changes);
					}
				},
				triggerEdgeChanges: (changes) => {
					const { onEdgesChange, setEdges, edges, hasDefaultEdges, debug } = get();
					if (changes?.length) {
						if (hasDefaultEdges) setEdges(applyEdgeChanges(changes, edges));
						if (debug) console.log("React Flow: trigger edge changes", changes);
						onEdgesChange?.(changes);
					}
				},
				addSelectedNodes: (selectedNodeIds) => {
					const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
					if (multiSelectionActive) {
						triggerNodeChanges(selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true)));
						return;
					}
					triggerNodeChanges(getSelectionChanges(nodeLookup, new Set([...selectedNodeIds]), true));
					triggerEdgeChanges(getSelectionChanges(edgeLookup));
				},
				addSelectedEdges: (selectedEdgeIds) => {
					const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
					if (multiSelectionActive) {
						triggerEdgeChanges(selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true)));
						return;
					}
					triggerEdgeChanges(getSelectionChanges(edgeLookup, new Set([...selectedEdgeIds])));
					triggerNodeChanges(getSelectionChanges(nodeLookup, /* @__PURE__ */ new Set(), true));
				},
				unselectNodesAndEdges: ({ nodes, edges } = {}) => {
					const { edges: storeEdges, nodes: storeNodes, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
					const nodesToUnselect = nodes ? nodes : storeNodes;
					const edgesToUnselect = edges ? edges : storeEdges;
					const nodeChanges = [];
					for (const node of nodesToUnselect) {
						if (!node.selected) continue;
						const internalNode = nodeLookup.get(node.id);
						if (internalNode) internalNode.selected = false;
						nodeChanges.push(createSelectionChange(node.id, false));
					}
					const edgeChanges = [];
					for (const edge of edgesToUnselect) {
						if (!edge.selected) continue;
						edgeChanges.push(createSelectionChange(edge.id, false));
					}
					triggerNodeChanges(nodeChanges);
					triggerEdgeChanges(edgeChanges);
				},
				setMinZoom: (minZoom) => {
					const { panZoom, maxZoom } = get();
					panZoom?.setScaleExtent([minZoom, maxZoom]);
					set({ minZoom });
				},
				setMaxZoom: (maxZoom) => {
					const { panZoom, minZoom } = get();
					panZoom?.setScaleExtent([minZoom, maxZoom]);
					set({ maxZoom });
				},
				setTranslateExtent: (translateExtent) => {
					get().panZoom?.setTranslateExtent(translateExtent);
					set({ translateExtent });
				},
				resetSelectedElements: () => {
					const { edges, nodes, triggerNodeChanges, triggerEdgeChanges, elementsSelectable } = get();
					if (!elementsSelectable) return;
					const nodeChanges = nodes.reduce((res, node) => node.selected ? [...res, createSelectionChange(node.id, false)] : res, []);
					const edgeChanges = edges.reduce((res, edge) => edge.selected ? [...res, createSelectionChange(edge.id, false)] : res, []);
					triggerNodeChanges(nodeChanges);
					triggerEdgeChanges(edgeChanges);
				},
				setNodeExtent: (nextNodeExtent) => {
					const { nodes, nodeLookup, parentLookup, nodeOrigin, elevateNodesOnSelect, nodeExtent, zIndexMode } = get();
					if (nextNodeExtent[0][0] === nodeExtent[0][0] && nextNodeExtent[0][1] === nodeExtent[0][1] && nextNodeExtent[1][0] === nodeExtent[1][0] && nextNodeExtent[1][1] === nodeExtent[1][1]) return;
					adoptUserNodes(nodes, nodeLookup, parentLookup, {
						nodeOrigin,
						nodeExtent: nextNodeExtent,
						elevateNodesOnSelect,
						checkEquality: false,
						zIndexMode
					});
					set({ nodeExtent: nextNodeExtent });
				},
				panBy: (delta) => {
					const { transform, width, height, panZoom, translateExtent } = get();
					return panBy({
						delta,
						panZoom,
						transform,
						translateExtent,
						width,
						height
					});
				},
				setCenter: async (x, y, options) => {
					const { width, height, maxZoom, panZoom } = get();
					if (!panZoom) return false;
					const nextZoom = typeof options?.zoom !== "undefined" ? options.zoom : maxZoom;
					await panZoom.setViewport({
						x: width / 2 - x * nextZoom,
						y: height / 2 - y * nextZoom,
						zoom: nextZoom
					}, {
						duration: options?.duration,
						ease: options?.ease,
						interpolate: options?.interpolate
					});
					return true;
				},
				cancelConnection: () => {
					set({ connection: { ...initialConnection } });
				},
				updateConnection: (connection) => {
					set({ connection });
				},
				reset: () => set({ ...getInitialState() })
			};
		}, Object.is);
		/**
		* The `<ReactFlowProvider />` component is a [context provider](https://react.dev/learn/passing-data-deeply-with-context#)
		* that makes it possible to access a flow's internal state outside of the
		* [`<ReactFlow />`](/api-reference/react-flow) component. Many of the hooks we
		* provide rely on this component to work.
		* @public
		*
		* @example
		* ```tsx
		*import { ReactFlow, ReactFlowProvider, useNodes } from '@xyflow/react'
		*
		*export default function Flow() {
		*  return (
		*    <ReactFlowProvider>
		*      <ReactFlow nodes={...} edges={...} />
		*      <Sidebar />
		*    </ReactFlowProvider>
		*  );
		*}
		*
		*function Sidebar() {
		*  // This hook will only work if the component it's used in is a child of a
		*  // <ReactFlowProvider />.
		*  const nodes = useNodes()
		*
		*  return <aside>do something with nodes</aside>;
		*}
		*```
		*
		* @remarks If you're using a router and want your flow's state to persist across routes,
		* it's vital that you place the `<ReactFlowProvider />` component _outside_ of
		* your router. If you have multiple flows on the same page you will need to use a separate
		* `<ReactFlowProvider />` for each flow.
		*/
		function ReactFlowProvider({ initialNodes: nodes, initialEdges: edges, defaultNodes, defaultEdges, initialWidth: width, initialHeight: height, initialMinZoom: minZoom, initialMaxZoom: maxZoom, initialFitViewOptions: fitViewOptions, fitView, nodeOrigin, nodeExtent, zIndexMode, children }) {
			const [store] = (0, react.useState)(() => createStore({
				nodes,
				edges,
				defaultNodes,
				defaultEdges,
				width,
				height,
				fitView,
				minZoom,
				maxZoom,
				fitViewOptions,
				nodeOrigin,
				nodeExtent,
				zIndexMode
			}));
			return (0, react_jsx_runtime.jsx)(Provider$1, {
				value: store,
				children: (0, react_jsx_runtime.jsx)(BatchProvider, { children: (0, react_jsx_runtime.jsx)(HandleConfigProvider, { children }) })
			});
		}
		function Wrapper({ children, nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) {
			if ((0, react.useContext)(StoreContext)) return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children });
			return (0, react_jsx_runtime.jsx)(ReactFlowProvider, {
				initialNodes: nodes,
				initialEdges: edges,
				defaultNodes,
				defaultEdges,
				initialWidth: width,
				initialHeight: height,
				fitView,
				initialFitViewOptions: fitViewOptions,
				initialMinZoom: minZoom,
				initialMaxZoom: maxZoom,
				nodeOrigin,
				nodeExtent,
				zIndexMode,
				children
			});
		}
		const wrapperStyle = {
			width: "100%",
			height: "100%",
			overflow: "hidden",
			position: "relative",
			zIndex: 0
		};
		function ReactFlow({ nodes, edges, defaultNodes, defaultEdges, className, nodeTypes, edgeTypes, onNodeClick, onEdgeClick, onInit, onMove, onMoveStart, onMoveEnd, onConnect, onConnectStart, onConnectEnd, onClickConnectStart, onClickConnectEnd, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onNodeDoubleClick, onNodeDragStart, onNodeDrag, onNodeDragStop, onNodesDelete, onEdgesDelete, onDelete, onSelectionChange, onSelectionDragStart, onSelectionDrag, onSelectionDragStop, onSelectionContextMenu, onSelectionStart, onSelectionEnd, onBeforeDelete, connectionMode, connectionLineType = ConnectionLineType.Bezier, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, deleteKeyCode = "Backspace", selectionKeyCode = "Shift", selectionOnDrag = false, selectionMode = SelectionMode.Full, panActivationKeyCode = "Space", multiSelectionKeyCode = isMacOs() ? "Meta" : "Control", zoomActivationKeyCode = isMacOs() ? "Meta" : "Control", snapToGrid, snapGrid, onlyRenderVisibleElements = false, selectNodesOnDrag, nodesDraggable, autoPanOnNodeFocus, nodesConnectable, nodesFocusable, nodeOrigin = defaultNodeOrigin, edgesFocusable, edgesReconnectable, elementsSelectable = true, defaultViewport: defaultViewport$1 = defaultViewport, minZoom = .5, maxZoom = 2, translateExtent = infiniteExtent, preventScrolling = true, nodeExtent, defaultMarkerColor = "#b1b1b7", zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = .5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance = 1, nodeClickDistance = 0, children, onReconnect, onReconnectStart, onReconnectEnd, onEdgeContextMenu, onEdgeDoubleClick, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius = 10, onNodesChange, onEdgesChange, noDragClassName = "nodrag", noWheelClassName = "nowheel", noPanClassName = "nopan", fitView, fitViewOptions, connectOnClick, attributionPosition, proOptions, defaultEdgeOptions, elevateNodesOnSelect = true, elevateEdgesOnSelect = false, disableKeyboardA11y = false, autoPanOnConnect, autoPanOnNodeDrag, autoPanOnSelection = true, autoPanSpeed, connectionRadius, isValidConnection, onError, style, id, nodeDragThreshold, connectionDragThreshold, viewport, onViewportChange, width, height, colorMode = "light", debug, onScroll, ariaLabelConfig, zIndexMode = "basic", ...rest }, ref) {
			const rfId = id || "1";
			const colorModeClassName = useColorModeClass(colorMode);
			const wrapperOnScroll = (0, react.useCallback)((e) => {
				e.currentTarget.scrollTo({
					top: 0,
					left: 0,
					behavior: "instant"
				});
				onScroll?.(e);
			}, [onScroll]);
			return (0, react_jsx_runtime.jsx)("div", {
				"data-testid": "rf__wrapper",
				...rest,
				onScroll: wrapperOnScroll,
				style: {
					...style,
					...wrapperStyle
				},
				ref,
				className: cc([
					"react-flow",
					className,
					colorModeClassName
				]),
				id,
				role: "application",
				children: (0, react_jsx_runtime.jsxs)(Wrapper, {
					nodes,
					edges,
					width,
					height,
					fitView,
					fitViewOptions,
					minZoom,
					maxZoom,
					nodeOrigin,
					nodeExtent,
					zIndexMode,
					children: [
						(0, react_jsx_runtime.jsx)(StoreUpdater, {
							nodes,
							edges,
							defaultNodes,
							defaultEdges,
							onConnect,
							onConnectStart,
							onConnectEnd,
							onClickConnectStart,
							onClickConnectEnd,
							nodesDraggable,
							autoPanOnNodeFocus,
							nodesConnectable,
							nodesFocusable,
							edgesFocusable,
							edgesReconnectable,
							elementsSelectable,
							elevateNodesOnSelect,
							elevateEdgesOnSelect,
							minZoom,
							maxZoom,
							nodeExtent,
							onNodesChange,
							onEdgesChange,
							snapToGrid,
							snapGrid,
							connectionMode,
							translateExtent,
							connectOnClick,
							defaultEdgeOptions,
							fitView,
							fitViewOptions,
							onNodesDelete,
							onEdgesDelete,
							onDelete,
							onNodeDragStart,
							onNodeDrag,
							onNodeDragStop,
							onSelectionDrag,
							onSelectionDragStart,
							onSelectionDragStop,
							onMove,
							onMoveStart,
							onMoveEnd,
							noPanClassName,
							nodeOrigin,
							rfId,
							autoPanOnConnect,
							autoPanOnNodeDrag,
							autoPanSpeed,
							onError,
							connectionRadius,
							isValidConnection,
							selectNodesOnDrag,
							nodeDragThreshold,
							connectionDragThreshold,
							onBeforeDelete,
							debug,
							ariaLabelConfig,
							zIndexMode
						}),
						(0, react_jsx_runtime.jsx)(GraphView, {
							onInit,
							onNodeClick,
							onEdgeClick,
							onNodeMouseEnter,
							onNodeMouseMove,
							onNodeMouseLeave,
							onNodeContextMenu,
							onNodeDoubleClick,
							nodeTypes,
							edgeTypes,
							connectionLineType,
							connectionLineStyle,
							connectionLineComponent,
							connectionLineContainerStyle,
							selectionKeyCode,
							selectionOnDrag,
							selectionMode,
							deleteKeyCode,
							multiSelectionKeyCode,
							panActivationKeyCode,
							zoomActivationKeyCode,
							onlyRenderVisibleElements,
							defaultViewport: defaultViewport$1,
							translateExtent,
							minZoom,
							maxZoom,
							preventScrolling,
							zoomOnScroll,
							zoomOnPinch,
							zoomOnDoubleClick,
							panOnScroll,
							panOnScrollSpeed,
							panOnScrollMode,
							panOnDrag,
							autoPanOnSelection,
							onPaneClick,
							onPaneMouseEnter,
							onPaneMouseMove,
							onPaneMouseLeave,
							onPaneScroll,
							onPaneContextMenu,
							paneClickDistance,
							nodeClickDistance,
							onSelectionContextMenu,
							onSelectionStart,
							onSelectionEnd,
							onReconnect,
							onReconnectStart,
							onReconnectEnd,
							onEdgeContextMenu,
							onEdgeDoubleClick,
							onEdgeMouseEnter,
							onEdgeMouseMove,
							onEdgeMouseLeave,
							reconnectRadius,
							defaultMarkerColor,
							noDragClassName,
							noWheelClassName,
							noPanClassName,
							rfId,
							disableKeyboardA11y,
							nodeExtent,
							viewport,
							onViewportChange,
							nodesDraggable
						}),
						(0, react_jsx_runtime.jsx)(SelectionListener, { onSelectionChange }),
						children,
						(0, react_jsx_runtime.jsx)(Attribution, {
							proOptions,
							position: attributionPosition
						}),
						(0, react_jsx_runtime.jsx)(A11yDescriptions, {
							rfId,
							disableKeyboardA11y
						})
					]
				})
			});
		}
		/**
		* The `<ReactFlow />` component is the heart of your React Flow application.
		* It renders your nodes and edges and handles user interaction
		*
		* @public
		*
		* @example
		* ```tsx
		*import { ReactFlow } from '@xyflow/react'
		*
		*export default function Flow() {
		*  return (<ReactFlow
		*    nodes={...}
		*    edges={...}
		*    onNodesChange={...}
		*    ...
		*  />);
		*}
		*```
		*/
		var index = fixedForwardRef(ReactFlow);
		/**
		* This hook makes it easy to prototype a controlled flow where you manage the
		* state of nodes and edges outside the `ReactFlowInstance`. You can think of it
		* like React's `useState` hook with an additional helper callback.
		*
		* @public
		* @returns
		* - `nodes`: The current array of nodes. You might pass this directly to the `nodes` prop of your
		* `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
		* for example.
		* - `setNodes`: A function that you can use to update the nodes. You can pass it a new array of
		* nodes or a callback that receives the current array of nodes and returns a new array of nodes.
		* This is the same as the second element of the tuple returned by React's `useState` hook.
		* - `onNodesChange`: A handy callback that can take an array of `NodeChanges` and update the nodes
		* state accordingly. You'll typically pass this directly to the `onNodesChange` prop of your
		* `<ReactFlow />` component.
		* @example
		*
		*```tsx
		*import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
		*
		*const initialNodes = [];
		*const initialEdges = [];
		*
		*export default function () {
		*  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
		*  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
		*
		*  return (
		*    <ReactFlow
		*      nodes={nodes}
		*      edges={edges}
		*      onNodesChange={onNodesChange}
		*      onEdgesChange={onEdgesChange}
		*    />
		*  );
		*}
		*```
		*
		* @remarks This hook was created to make prototyping easier and our documentation
		* examples clearer. Although it is OK to use this hook in production, in
		* practice you may want to use a more sophisticated state management solution
		* like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
		*
		*/
		function useNodesState(initialNodes) {
			const [nodes, setNodes] = (0, react.useState)(initialNodes);
			return [
				nodes,
				setNodes,
				(0, react.useCallback)((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
			];
		}
		/**
		* This hook makes it easy to prototype a controlled flow where you manage the
		* state of nodes and edges outside the `ReactFlowInstance`. You can think of it
		* like React's `useState` hook with an additional helper callback.
		*
		* @public
		* @returns
		* - `edges`: The current array of edges. You might pass this directly to the `edges` prop of your
		* `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
		* for example.
		*
		* - `setEdges`: A function that you can use to update the edges. You can pass it a new array of
		* edges or a callback that receives the current array of edges and returns a new array of edges.
		* This is the same as the second element of the tuple returned by React's `useState` hook.
		*
		* - `onEdgesChange`: A handy callback that can take an array of `EdgeChanges` and update the edges
		* state accordingly. You'll typically pass this directly to the `onEdgesChange` prop of your
		* `<ReactFlow />` component.
		* @example
		*
		*```tsx
		*import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
		*
		*const initialNodes = [];
		*const initialEdges = [];
		*
		*export default function () {
		*  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
		*  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
		*
		*  return (
		*    <ReactFlow
		*      nodes={nodes}
		*      edges={edges}
		*      onNodesChange={onNodesChange}
		*      onEdgesChange={onEdgesChange}
		*    />
		*  );
		*}
		*```
		*
		* @remarks This hook was created to make prototyping easier and our documentation
		* examples clearer. Although it is OK to use this hook in production, in
		* practice you may want to use a more sophisticated state management solution
		* like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
		*
		*/
		function useEdgesState(initialEdges) {
			const [edges, setEdges] = (0, react.useState)(initialEdges);
			return [
				edges,
				setEdges,
				(0, react.useCallback)((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
			];
		}
		errorMessages["error014"]();
		function LinePattern({ dimensions, lineWidth, variant, className }) {
			return (0, react_jsx_runtime.jsx)("path", {
				strokeWidth: lineWidth,
				d: `M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}`,
				className: cc([
					"react-flow__background-pattern",
					variant,
					className
				])
			});
		}
		function DotPattern({ radius, className }) {
			return (0, react_jsx_runtime.jsx)("circle", {
				cx: radius,
				cy: radius,
				r: radius,
				className: cc([
					"react-flow__background-pattern",
					"dots",
					className
				])
			});
		}
		/**
		* The three variants are exported as an enum for convenience. You can either import
		* the enum and use it like `BackgroundVariant.Lines` or you can use the raw string
		* value directly.
		* @public
		*/
		var BackgroundVariant;
		(function(BackgroundVariant) {
			BackgroundVariant["Lines"] = "lines";
			BackgroundVariant["Dots"] = "dots";
			BackgroundVariant["Cross"] = "cross";
		})(BackgroundVariant || (BackgroundVariant = {}));
		const defaultSize = {
			[BackgroundVariant.Dots]: 1,
			[BackgroundVariant.Lines]: 1,
			[BackgroundVariant.Cross]: 6
		};
		const selector$3 = (s) => ({
			transform: s.transform,
			patternId: `pattern-${s.rfId}`
		});
		function BackgroundComponent({ id, variant = BackgroundVariant.Dots, gap = 20, size, lineWidth = 1, offset = 0, color, bgColor, style, className, patternClassName }) {
			const ref = (0, react.useRef)(null);
			const { transform, patternId } = useStore(selector$3, shallow$1);
			const patternSize = size || defaultSize[variant];
			const isDots = variant === BackgroundVariant.Dots;
			const isCross = variant === BackgroundVariant.Cross;
			const gapXY = Array.isArray(gap) ? gap : [gap, gap];
			const scaledGap = [gapXY[0] * transform[2] || 1, gapXY[1] * transform[2] || 1];
			const scaledSize = patternSize * transform[2];
			const offsetXY = Array.isArray(offset) ? offset : [offset, offset];
			const patternDimensions = isCross ? [scaledSize, scaledSize] : scaledGap;
			const scaledOffset = [offsetXY[0] * transform[2] + patternDimensions[0] / 2, offsetXY[1] * transform[2] + patternDimensions[1] / 2];
			const _patternId = `${patternId}${id ? id : ""}`;
			return (0, react_jsx_runtime.jsxs)("svg", {
				className: cc(["react-flow__background", className]),
				style: {
					...style,
					...containerStyle,
					"--xy-background-color-props": bgColor,
					"--xy-background-pattern-color-props": color
				},
				ref,
				"data-testid": "rf__background",
				children: [(0, react_jsx_runtime.jsx)("pattern", {
					id: _patternId,
					x: transform[0] % scaledGap[0],
					y: transform[1] % scaledGap[1],
					width: scaledGap[0],
					height: scaledGap[1],
					patternUnits: "userSpaceOnUse",
					patternTransform: `translate(-${scaledOffset[0]},-${scaledOffset[1]})`,
					children: isDots ? (0, react_jsx_runtime.jsx)(DotPattern, {
						radius: scaledSize / 2,
						className: patternClassName
					}) : (0, react_jsx_runtime.jsx)(LinePattern, {
						dimensions: patternDimensions,
						lineWidth,
						variant,
						className: patternClassName
					})
				}), (0, react_jsx_runtime.jsx)("rect", {
					x: "0",
					y: "0",
					width: "100%",
					height: "100%",
					fill: `url(#${_patternId})`
				})]
			});
		}
		BackgroundComponent.displayName = "Background";
		/**
		* The `<Background />` component makes it convenient to render different types of backgrounds common in node-based UIs. It comes with three variants: lines, dots and cross.
		*
		* @example
		*
		* A simple example of how to use the Background component.
		*
		* ```tsx
		* import { useState } from 'react';
		* import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
		*
		* export default function Flow() {
		*   return (
		*     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
		*       <Background color="#ccc" variant={BackgroundVariant.Dots} />
		*     </ReactFlow>
		*   );
		* }
		* ```
		*
		* @example
		*
		* In this example you can see how to combine multiple backgrounds
		*
		* ```tsx
		* import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
		* import '@xyflow/react/dist/style.css';
		*
		* export default function Flow() {
		*   return (
		*     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
		*       <Background
		*         id="1"
		*         gap={10}
		*         color="#f1f1f1"
		*         variant={BackgroundVariant.Lines}
		*       />
		*       <Background
		*         id="2"
		*         gap={100}
		*         color="#ccc"
		*         variant={BackgroundVariant.Lines}
		*       />
		*     </ReactFlow>
		*   );
		* }
		* ```
		*
		* @remarks
		*
		* When combining multiple <Background /> components it’s important to give each of them a unique id prop!
		*
		*/
		const Background = (0, react.memo)(BackgroundComponent);
		function PlusIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 32 32",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" })
			});
		}
		function MinusIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 32 5",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M0 0h32v4.2H0z" })
			});
		}
		function FitViewIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 32 30",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" })
			});
		}
		function LockIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 25 32",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" })
			});
		}
		function UnlockIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 25 32",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" })
			});
		}
		/**
		* You can add buttons to the control panel by using the `<ControlButton />` component
		* and pass it as a child to the [`<Controls />`](/api-reference/components/controls) component.
		*
		* @public
		* @example
		*```jsx
		*import { MagicWand } from '@radix-ui/react-icons'
		*import { ReactFlow, Controls, ControlButton } from '@xyflow/react'
		*
		*export default function Flow() {
		*  return (
		*    <ReactFlow nodes={[...]} edges={[...]}>
		*      <Controls>
		*        <ControlButton onClick={() => alert('Something magical just happened. ✨')}>
		*          <MagicWand />
		*        </ControlButton>
		*      </Controls>
		*    </ReactFlow>
		*  )
		*}
		*```
		*/
		function ControlButton({ children, className, ...rest }) {
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: cc(["react-flow__controls-button", className]),
				...rest,
				children
			});
		}
		const selector$2 = (s) => ({
			isInteractive: s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
			minZoomReached: s.transform[2] <= s.minZoom,
			maxZoomReached: s.transform[2] >= s.maxZoom,
			ariaLabelConfig: s.ariaLabelConfig
		});
		function ControlsComponent({ style, showZoom = true, showFitView = true, showInteractive = true, fitViewOptions, onZoomIn, onZoomOut, onFitView, onInteractiveChange, className, children, position = "bottom-left", orientation = "vertical", "aria-label": ariaLabel }) {
			const store = useStoreApi();
			const { isInteractive, minZoomReached, maxZoomReached, ariaLabelConfig } = useStore(selector$2, shallow$1);
			const { zoomIn, zoomOut, fitView } = useReactFlow();
			const onZoomInHandler = () => {
				zoomIn();
				onZoomIn?.();
			};
			const onZoomOutHandler = () => {
				zoomOut();
				onZoomOut?.();
			};
			const onFitViewHandler = () => {
				fitView(fitViewOptions);
				onFitView?.();
			};
			const onToggleInteractivity = () => {
				store.setState({
					nodesDraggable: !isInteractive,
					nodesConnectable: !isInteractive,
					elementsSelectable: !isInteractive
				});
				onInteractiveChange?.(!isInteractive);
			};
			return (0, react_jsx_runtime.jsxs)(Panel, {
				className: cc([
					"react-flow__controls",
					orientation === "horizontal" ? "horizontal" : "vertical",
					className
				]),
				position,
				style,
				"data-testid": "rf__controls",
				"aria-label": ariaLabel ?? ariaLabelConfig["controls.ariaLabel"],
				children: [
					showZoom && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(ControlButton, {
						onClick: onZoomInHandler,
						className: "react-flow__controls-zoomin",
						title: ariaLabelConfig["controls.zoomIn.ariaLabel"],
						"aria-label": ariaLabelConfig["controls.zoomIn.ariaLabel"],
						disabled: maxZoomReached,
						children: (0, react_jsx_runtime.jsx)(PlusIcon, {})
					}), (0, react_jsx_runtime.jsx)(ControlButton, {
						onClick: onZoomOutHandler,
						className: "react-flow__controls-zoomout",
						title: ariaLabelConfig["controls.zoomOut.ariaLabel"],
						"aria-label": ariaLabelConfig["controls.zoomOut.ariaLabel"],
						disabled: minZoomReached,
						children: (0, react_jsx_runtime.jsx)(MinusIcon, {})
					})] }),
					showFitView && (0, react_jsx_runtime.jsx)(ControlButton, {
						className: "react-flow__controls-fitview",
						onClick: onFitViewHandler,
						title: ariaLabelConfig["controls.fitView.ariaLabel"],
						"aria-label": ariaLabelConfig["controls.fitView.ariaLabel"],
						children: (0, react_jsx_runtime.jsx)(FitViewIcon, {})
					}),
					showInteractive && (0, react_jsx_runtime.jsx)(ControlButton, {
						className: "react-flow__controls-interactive",
						onClick: onToggleInteractivity,
						title: ariaLabelConfig["controls.interactive.ariaLabel"],
						"aria-label": ariaLabelConfig["controls.interactive.ariaLabel"],
						children: isInteractive ? (0, react_jsx_runtime.jsx)(UnlockIcon, {}) : (0, react_jsx_runtime.jsx)(LockIcon, {})
					}),
					children
				]
			});
		}
		ControlsComponent.displayName = "Controls";
		/**
		* The `<Controls />` component renders a small panel that contains convenient
		* buttons to zoom in, zoom out, fit the view, and lock the viewport.
		*
		* @public
		* @example
		*```tsx
		*import { ReactFlow, Controls } from '@xyflow/react'
		*
		*export default function Flow() {
		*  return (
		*    <ReactFlow nodes={[...]} edges={[...]}>
		*      <Controls />
		*    </ReactFlow>
		*  )
		*}
		*```
		*
		* @remarks To extend or customise the controls, you can use the [`<ControlButton />`](/api-reference/components/control-button) component
		*
		*/
		const Controls = (0, react.memo)(ControlsComponent);
		function MiniMapNodeComponent({ id, x, y, width, height, style, color, strokeColor, strokeWidth, className, borderRadius, shapeRendering, selected, onClick }) {
			const { background, backgroundColor } = style || {};
			const fill = color || background || backgroundColor;
			return (0, react_jsx_runtime.jsx)("rect", {
				className: cc([
					"react-flow__minimap-node",
					{ selected },
					className
				]),
				x,
				y,
				rx: borderRadius,
				ry: borderRadius,
				width,
				height,
				style: {
					fill,
					stroke: strokeColor,
					strokeWidth
				},
				shapeRendering,
				onClick: onClick ? (event) => onClick(event, id) : void 0
			});
		}
		const MiniMapNode = (0, react.memo)(MiniMapNodeComponent);
		const selectorNodeIds = (s) => s.nodes.map((node) => node.id);
		const getAttrFunction = (func) => func instanceof Function ? func : () => func;
		function MiniMapNodes({ nodeStrokeColor, nodeColor, nodeClassName = "", nodeBorderRadius = 5, nodeStrokeWidth, nodeComponent: NodeComponent = MiniMapNode, onClick }) {
			const nodeIds = useStore(selectorNodeIds, shallow$1);
			const nodeColorFunc = getAttrFunction(nodeColor);
			const nodeStrokeColorFunc = getAttrFunction(nodeStrokeColor);
			const nodeClassNameFunc = getAttrFunction(nodeClassName);
			const shapeRendering = typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: nodeIds.map((nodeId) => (0, react_jsx_runtime.jsx)(NodeComponentWrapper, {
				id: nodeId,
				nodeColorFunc,
				nodeStrokeColorFunc,
				nodeClassNameFunc,
				nodeBorderRadius,
				nodeStrokeWidth,
				NodeComponent,
				onClick,
				shapeRendering
			}, nodeId)) });
		}
		function NodeComponentWrapperInner({ id, nodeColorFunc, nodeStrokeColorFunc, nodeClassNameFunc, nodeBorderRadius, nodeStrokeWidth, shapeRendering, NodeComponent, onClick }) {
			const { node, x, y, width, height } = useStore((s) => {
				const node = s.nodeLookup.get(id);
				if (!node) return {
					node: void 0,
					x: 0,
					y: 0,
					width: 0,
					height: 0
				};
				const userNode = node.internals.userNode;
				const { x, y } = node.internals.positionAbsolute;
				const { width, height } = getNodeDimensions(userNode);
				return {
					node: userNode,
					x,
					y,
					width,
					height
				};
			}, shallow$1);
			if (!node || node.hidden || !nodeHasDimensions(node)) return null;
			return (0, react_jsx_runtime.jsx)(NodeComponent, {
				x,
				y,
				width,
				height,
				style: node.style,
				selected: !!node.selected,
				className: nodeClassNameFunc(node),
				color: nodeColorFunc(node),
				borderRadius: nodeBorderRadius,
				strokeColor: nodeStrokeColorFunc(node),
				strokeWidth: nodeStrokeWidth,
				shapeRendering,
				onClick,
				id: node.id
			});
		}
		const NodeComponentWrapper = (0, react.memo)(NodeComponentWrapperInner);
		var MiniMapNodes$1 = (0, react.memo)(MiniMapNodes);
		const defaultWidth = 200;
		const defaultHeight = 150;
		const filterHidden = (node) => !node.hidden;
		const selector$1 = (s) => {
			const viewBB = {
				x: -s.transform[0] / s.transform[2],
				y: -s.transform[1] / s.transform[2],
				width: s.width / s.transform[2],
				height: s.height / s.transform[2]
			};
			let hasVisibleNode = false;
			for (const node of s.nodeLookup.values()) if (!node.hidden) {
				hasVisibleNode = true;
				break;
			}
			return {
				viewBB,
				boundingRect: hasVisibleNode ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB) : viewBB,
				rfId: s.rfId,
				panZoom: s.panZoom,
				translateExtent: s.translateExtent,
				flowWidth: s.width,
				flowHeight: s.height,
				ariaLabelConfig: s.ariaLabelConfig
			};
		};
		const rectEqual = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
		const areEqual = (a, b) => rectEqual(a.viewBB, b.viewBB) && rectEqual(a.boundingRect, b.boundingRect) && a.rfId === b.rfId && a.panZoom === b.panZoom && a.translateExtent === b.translateExtent && a.flowWidth === b.flowWidth && a.flowHeight === b.flowHeight && a.ariaLabelConfig === b.ariaLabelConfig;
		const ARIA_LABEL_KEY = "react-flow__minimap-desc";
		function MiniMapComponent({ style, className, nodeStrokeColor, nodeColor, nodeClassName = "", nodeBorderRadius = 5, nodeStrokeWidth, nodeComponent, bgColor, maskColor, maskStrokeColor, maskStrokeWidth, position = "bottom-right", onClick, onNodeClick, pannable = false, zoomable = false, ariaLabel, inversePan, zoomStep = 1, offsetScale = 5 }) {
			const store = useStoreApi();
			const svg = (0, react.useRef)(null);
			const { boundingRect, panZoom, viewBB, rfId, translateExtent, flowWidth, flowHeight, ariaLabelConfig } = useStore(selector$1, areEqual);
			const elementWidth = style?.width ?? defaultWidth;
			const elementHeight = style?.height ?? defaultHeight;
			const scaledWidth = boundingRect.width / elementWidth;
			const scaledHeight = boundingRect.height / elementHeight;
			const viewScale = Math.max(scaledWidth, scaledHeight);
			const viewWidth = viewScale * elementWidth;
			const viewHeight = viewScale * elementHeight;
			const offset = offsetScale * viewScale;
			const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
			const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
			const width = viewWidth + offset * 2;
			const height = viewHeight + offset * 2;
			const labelledBy = `${ARIA_LABEL_KEY}-${rfId}`;
			const viewScaleRef = (0, react.useRef)(0);
			const minimapInstance = (0, react.useRef)();
			viewScaleRef.current = viewScale;
			(0, react.useEffect)(() => {
				const currentPanZoom = store.getState().panZoom;
				if (svg.current && currentPanZoom) {
					minimapInstance.current = XYMinimap({
						domNode: svg.current,
						panZoom: currentPanZoom,
						getTransform: () => store.getState().transform,
						getViewScale: () => viewScaleRef.current
					});
					return () => {
						minimapInstance.current?.destroy();
					};
				}
			}, [panZoom]);
			(0, react.useEffect)(() => {
				minimapInstance.current?.update({
					translateExtent,
					width: flowWidth,
					height: flowHeight,
					inversePan,
					pannable,
					zoomStep,
					zoomable
				});
			}, [
				pannable,
				zoomable,
				inversePan,
				zoomStep,
				translateExtent,
				flowWidth,
				flowHeight
			]);
			const onSvgClick = onClick ? (event) => {
				const [x, y] = minimapInstance.current?.pointer(event) || [0, 0];
				onClick(event, {
					x,
					y
				});
			} : void 0;
			const nodeClickHandler = (0, react.useCallback)((event, nodeId) => {
				const node = store.getState().nodeLookup.get(nodeId).internals.userNode;
				onNodeClick?.(event, node);
			}, [onNodeClick]);
			const onSvgNodeClick = onNodeClick ? nodeClickHandler : void 0;
			const _ariaLabel = ariaLabel ?? ariaLabelConfig["minimap.ariaLabel"];
			return (0, react_jsx_runtime.jsx)(Panel, {
				position,
				style: {
					...style,
					"--xy-minimap-background-color-props": typeof bgColor === "string" ? bgColor : void 0,
					"--xy-minimap-mask-background-color-props": typeof maskColor === "string" ? maskColor : void 0,
					"--xy-minimap-mask-stroke-color-props": typeof maskStrokeColor === "string" ? maskStrokeColor : void 0,
					"--xy-minimap-mask-stroke-width-props": typeof maskStrokeWidth === "number" ? maskStrokeWidth * viewScale : void 0,
					"--xy-minimap-node-background-color-props": typeof nodeColor === "string" ? nodeColor : void 0,
					"--xy-minimap-node-stroke-color-props": typeof nodeStrokeColor === "string" ? nodeStrokeColor : void 0,
					"--xy-minimap-node-stroke-width-props": typeof nodeStrokeWidth === "number" ? nodeStrokeWidth : void 0
				},
				className: cc(["react-flow__minimap", className]),
				"data-testid": "rf__minimap",
				children: (0, react_jsx_runtime.jsxs)("svg", {
					width: elementWidth,
					height: elementHeight,
					viewBox: `${x} ${y} ${width} ${height}`,
					className: "react-flow__minimap-svg",
					role: "img",
					"aria-labelledby": labelledBy,
					ref: svg,
					onClick: onSvgClick,
					children: [
						_ariaLabel && (0, react_jsx_runtime.jsx)("title", {
							id: labelledBy,
							children: _ariaLabel
						}),
						(0, react_jsx_runtime.jsx)(MiniMapNodes$1, {
							onClick: onSvgNodeClick,
							nodeColor,
							nodeStrokeColor,
							nodeBorderRadius,
							nodeClassName,
							nodeStrokeWidth,
							nodeComponent
						}),
						(0, react_jsx_runtime.jsx)("path", {
							className: "react-flow__minimap-mask",
							d: `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z`,
							fillRule: "evenodd",
							pointerEvents: "none"
						})
					]
				})
			});
		}
		MiniMapComponent.displayName = "MiniMap";
		(0, react.memo)(MiniMapComponent);
		const scaleSelector = (calculateScale) => (store) => calculateScale ? `${Math.max(1 / store.transform[2], 1)}` : void 0;
		const defaultPositions = {
			[ResizeControlVariant.Line]: "right",
			[ResizeControlVariant.Handle]: "bottom-right"
		};
		function ResizeControl({ nodeId, position, variant = ResizeControlVariant.Handle, className, style = void 0, children, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, resizeDirection, autoScale = true, shouldResize, onResizeStart, onResize, onResizeEnd }) {
			const contextNodeId = useNodeId();
			const id = typeof nodeId === "string" ? nodeId : contextNodeId;
			const store = useStoreApi();
			const resizeControlRef = (0, react.useRef)(null);
			const isHandleControl = variant === ResizeControlVariant.Handle;
			const scale = useStore((0, react.useCallback)(scaleSelector(isHandleControl && autoScale), [isHandleControl, autoScale]), shallow$1);
			const resizer = (0, react.useRef)(null);
			const controlPosition = position ?? defaultPositions[variant];
			(0, react.useEffect)(() => {
				if (!resizeControlRef.current || !id) return;
				if (!resizer.current) resizer.current = XYResizer({
					domNode: resizeControlRef.current,
					nodeId: id,
					getStoreItems: () => {
						const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, domNode } = store.getState();
						return {
							nodeLookup,
							transform,
							snapGrid,
							snapToGrid,
							nodeOrigin,
							paneDomNode: domNode
						};
					},
					onChange: (change, childChanges) => {
						const { triggerNodeChanges, nodeLookup, parentLookup, nodeOrigin } = store.getState();
						const changes = [];
						const nextPosition = {
							x: change.x,
							y: change.y
						};
						const node = nodeLookup.get(id);
						if (node && node.expandParent && node.parentId) {
							const origin = node.origin ?? nodeOrigin;
							const width = change.width ?? node.measured.width ?? 0;
							const height = change.height ?? node.measured.height ?? 0;
							const parentExpandChanges = handleExpandParent([{
								id: node.id,
								parentId: node.parentId,
								rect: {
									width,
									height,
									...evaluateAbsolutePosition({
										x: change.x ?? node.position.x,
										y: change.y ?? node.position.y
									}, {
										width,
										height
									}, node.parentId, nodeLookup, origin)
								}
							}], nodeLookup, parentLookup, nodeOrigin);
							changes.push(...parentExpandChanges);
							nextPosition.x = change.x ? Math.max(origin[0] * width, change.x) : void 0;
							nextPosition.y = change.y ? Math.max(origin[1] * height, change.y) : void 0;
						}
						if (nextPosition.x !== void 0 && nextPosition.y !== void 0) {
							const positionChange = {
								id,
								type: "position",
								position: { ...nextPosition }
							};
							changes.push(positionChange);
						}
						if (change.width !== void 0 && change.height !== void 0) {
							const dimensionChange = {
								id,
								type: "dimensions",
								resizing: true,
								setAttributes: !resizeDirection ? true : resizeDirection === "horizontal" ? "width" : "height",
								dimensions: {
									width: change.width,
									height: change.height
								}
							};
							changes.push(dimensionChange);
						}
						for (const childChange of childChanges) {
							const positionChange = {
								...childChange,
								type: "position"
							};
							changes.push(positionChange);
						}
						triggerNodeChanges(changes);
					},
					onEnd: ({ width, height }) => {
						const dimensionChange = {
							id,
							type: "dimensions",
							resizing: false,
							dimensions: {
								width,
								height
							}
						};
						store.getState().triggerNodeChanges([dimensionChange]);
					}
				});
				resizer.current.update({
					controlPosition,
					boundaries: {
						minWidth,
						minHeight,
						maxWidth,
						maxHeight
					},
					keepAspectRatio,
					resizeDirection,
					onResizeStart,
					onResize,
					onResizeEnd,
					shouldResize
				});
				return () => {
					resizer.current?.destroy();
				};
			}, [
				controlPosition,
				minWidth,
				minHeight,
				maxWidth,
				maxHeight,
				keepAspectRatio,
				onResizeStart,
				onResize,
				onResizeEnd,
				shouldResize
			]);
			return (0, react_jsx_runtime.jsx)("div", {
				className: cc([
					"react-flow__resize-control",
					"nodrag",
					...controlPosition.split("-"),
					variant,
					className
				]),
				ref: resizeControlRef,
				style: {
					...style,
					scale,
					...color && { [isHandleControl ? "backgroundColor" : "borderColor"]: color }
				},
				children
			});
		}
		(0, react.memo)(ResizeControl);
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
			chevron: "M9.5 5.5 16 12l-6.5 6.5"
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
		const WORKBENCH_STYLE_VERSION = "2026-10-18.2";
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
.iv-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-add-row .iv-select{flex:1;min-width:110px}

/* ============ 列表 ============ */
.iv-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0}
.iv-row{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:var(--iv-r);
  border:1px solid transparent;font-size:11.5px;transition:background .1s ease}
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
.iv-thumb{width:30px;height:20px;border-radius:3px;object-fit:cover;flex:none;background:var(--iv-monitor);
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
.iv-clips{display:flex;flex-wrap:wrap;gap:4px}
.iv-clip{display:flex;flex-direction:column;gap:3px;min-width:0;flex-basis:0;min-height:34px;
  padding:3px 7px 3px 9px;border-radius:3px;border:1px solid var(--iv-line-2);background:var(--iv-panel);
  font-size:10.5px;position:relative;overflow:hidden}
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
.iv-inspector{display:grid;gap:5px;border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:7px 9px;background:var(--iv-panel-2)}
.iv-inspector-head{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;
  color:var(--iv-tx3);text-transform:uppercase}
.iv-field{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px;align-items:center;font-size:11px}
.iv-field>span{color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-field .iv-input,.iv-field .iv-select{height:21px;font-size:11px}
.iv-field textarea.iv-input{height:auto}

/* ---- xyflow 节点卡片（画布内） ---- */
.iv-node{min-width:148px;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel);
  color:var(--iv-tx);font-size:11px;overflow:hidden}
.iv-node[data-workflow-node-selected=true]{border-color:var(--iv-acc);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 20%,transparent)}
.iv-node[data-availability=planned]{border-style:dashed}
.iv-node[data-invalid=true]{border-color:var(--iv-danger)}
.iv-node-head{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--iv-panel-3);
  border-bottom:1px solid var(--iv-line);font-weight:600}
.iv-node-head .iv-ico{color:var(--iv-acc)}
.iv-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-node-planned{margin-left:auto;display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:500;
  color:var(--iv-tx3);white-space:nowrap}
.iv-node-body{padding:5px 8px;display:grid;gap:2px;font-size:10px;color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis}

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
		//#endregion
		//#region src/client/WorkflowCanvas.tsx
		/**
		* 工作流画布（`T4-1`/`T4-2`）。
		*
		* 边界按 `R-FLW-1`：画布**只做交互**——节点位置、连线、选择、缩放平移、适配窗口。
		* 执行、参数校验（除"必填"以外的语义校验）、调度与持久化都在宿主侧；
		* 本组件把画布维度的事实收敛成一个 `WorkflowRecord` 交给上层（`T4-1` 单一事实源），
		* 且**选择状态只在本地**，不进 `WorkflowRecord`（UI 瞬时选择不入库）。
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
		/** 节点卡片：本地化种类名 + 参数摘要（用参数标签而不是键名）+ 左右连接点。 */
		function WorkflowNodeCard({ data, selected, t }) {
			const spec = nodeSpec(data.kind);
			const planned = spec.availability !== "runnable";
			const summary = spec.params.filter((field) => data.params[field.id] !== "" && data.params[field.id] !== false && data.params[field.id] !== void 0).slice(0, 2).map((field) => `${t(field.labelKey)}=${String(data.params[field.id]).slice(0, 14)}`).join(" · ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-node",
				"data-workflow-node": data.kind,
				"data-workflow-node-selected": selected ? "true" : "false",
				"data-workflow-node-availability": spec.availability,
				"data-workflow-node-invalid": data.invalid === true ? "true" : "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Handle, {
						type: "target",
						position: Position.Left
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
							}) : null
						]
					}),
					summary === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "iv-node-body",
						children: summary
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Handle, {
						type: "source",
						position: Position.Right
					})
				]
			});
		}
		/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
		function CanvasSurface({ record, onChange, t, run }) {
			const [nodes, setNodes, onNodesChange] = useNodesState(toCanvasNodes(record));
			const [edges, setEdges, onEdgesChange] = useEdgesState(toCanvasEdges(record));
			const [selectedId, setSelectedId] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [templateId, setTemplateId] = (0, react.useState)(WORKFLOW_TEMPLATES[0]?.id ?? "");
			const { fitView } = useReactFlow();
			const lastPushed = (0, react.useRef)("");
			const seededId = (0, react.useRef)(record.id);
			(0, react.useEffect)(() => {
				if (seededId.current === record.id) return;
				seededId.current = record.id;
				setNodes(toCanvasNodes(record));
				setEdges(toCanvasEdges(record));
				setSelectedId(void 0);
			}, [
				record,
				setNodes,
				setEdges
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
			const nodeTypes = (0, react.useMemo)(() => ({ workbench: (nodeProps) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowNodeCard, {
				...nodeProps,
				t
			}) }), [t]);
			const selected = nodes.find((node) => node.id === selectedId);
			const addNode = (0, react.useCallback)((kind) => {
				setNodes((current) => {
					const index = current.length;
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
						}
					};
					setSelectedId(node.id);
					return [...current, node];
				});
			}, [setNodes]);
			const updateParam = (0, react.useCallback)((id, key, value) => {
				setNodes((current) => current.map((node) => node.id === id ? {
					...node,
					data: {
						...node.data,
						params: {
							...node.data.params,
							[key]: value
						}
					}
				} : node));
			}, [setNodes]);
			const onConnect = (0, react.useCallback)((connection) => {
				if (connection.source === connection.target) {
					setError(t("canvasSelfLoop"));
					return;
				}
				setError(void 0);
				setEdges((current) => addEdge({
					...connection,
					id: `${connection.source}-${connection.target}`
				}, current));
			}, [setEdges, t]);
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
				setNodes(built);
				setEdges(template.edges.map(([from, to]) => ({
					id: `${built[from]?.id ?? from}->${built[to]?.id ?? to}`,
					source: built[from]?.id ?? String(from),
					target: built[to]?.id ?? String(to)
				})));
				setSelectedId(void 0);
				setError(void 0);
			}, [setNodes, setEdges]);
			const removeSelected = (0, react.useCallback)(() => {
				if (selectedId === void 0) return;
				setNodes((current) => current.filter((node) => node.id !== selectedId));
				setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
				setSelectedId(void 0);
			}, [
				selectedId,
				setNodes,
				setEdges
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "iv-canvas-main",
				"data-workflow-canvas": "true",
				"data-workflow-nodes": String(nodes.length),
				"data-workflow-edges": String(edges.length),
				"data-workflow-selected": selectedId ?? "",
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "iv-btn iv-btn--sm",
									"data-workflow-action": "delete-node",
									disabled: selectedId === void 0,
									onClick: removeSelected,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "trash" }), t("canvasDeleteNode")]
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
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(index, {
								nodes,
								edges,
								nodeTypes,
								onNodesChange,
								onEdgesChange,
								onConnect,
								onNodeClick: (_event, node) => {
									setSelectedId(node.id);
								},
								onPaneClick: () => {
									setSelectedId(void 0);
								},
								fitView: true,
								proOptions: { hideAttribution: false },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Background, { gap: 18 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Controls, { showInteractive: false })]
							})
						}),
						selected === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "iv-meta",
							children: t("canvasEmpty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "iv-inspector",
							"data-workflow-inspector": selected.id,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "iv-inspector-head",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
											name: NODE_ICONS[selected.data.kind],
											size: 13
										}),
										t("canvasParams"),
										" · ",
										selected.data.kind
									]
								}),
								nodeSpec(selected.data.kind).availability !== "runnable" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "iv-meta",
									"data-workflow-planned-note": "true",
									style: { color: "var(--iv-warn)" },
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
											name: "sparkles",
											size: 12
										}),
										" ",
										t(nodeSpec(selected.data.kind).reasonKey)
									]
								}) : null,
								nodeSpec(selected.data.kind).params.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "iv-meta",
									children: t("canvasNoParams")
								}) : nodeSpec(selected.data.kind).params.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "iv-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(field.labelKey) }), field.type === "boolean" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										"data-workflow-param": field.id,
										checked: selected.data.params[field.id] === true,
										onChange: (event) => {
											updateParam(selected.id, field.id, event.target.checked);
										}
									}) : field.type === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "iv-select",
										"data-workflow-param": field.id,
										value: String(selected.data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selected.id, field.id, event.target.value);
										},
										children: (field.options ?? []).map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: option.value,
											children: t(option.labelKey)
										}, option.value))
									}) : field.type === "textarea" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "iv-input iv-textarea",
										"data-workflow-param": field.id,
										rows: 2,
										value: String(selected.data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selected.id, field.id, event.target.value);
										}
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "iv-input",
										"data-workflow-param": field.id,
										type: field.type === "number" ? "number" : "text",
										value: String(selected.data.params[field.id] ?? ""),
										onChange: (event) => {
											updateParam(selected.id, field.id, field.type === "number" ? Number(event.target.value) : event.target.value);
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReactFlowProvider, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasSurface, { ...props }) });
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
			const [previewMs, setPreviewMs] = (0, react.useState)(0);
			const [refreshTick, setRefreshTick] = (0, react.useState)(0);
			const [ffmpeg, setFfmpeg] = (0, react.useState)(void 0);
			const [resourceUsage, setResourceUsage] = (0, react.useState)([]);
			const [defaultsDraft, setDefaultsDraft] = (0, react.useState)(void 0);
			const [renderJob, setRenderJob] = (0, react.useState)(void 0);
			const [health, setHealth] = (0, react.useState)({ status: "checking" });
			const [projects, setProjects] = (0, react.useState)([]);
			const [activeId, setActiveId] = (0, react.useState)(void 0);
			const [assets, setAssets] = (0, react.useState)([]);
			const [outputs, setOutputs] = (0, react.useState)([]);
			const [tasks, setTasks] = (0, react.useState)([]);
			const [resources, setResources] = (0, react.useState)([]);
			const [assetFilter, setAssetFilter] = (0, react.useState)("all");
			const [resourceKind, setResourceKind] = (0, react.useState)("role");
			const [resourceName, setResourceName] = (0, react.useState)("");
			const [resourceNote, setResourceNote] = (0, react.useState)("");
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
				if (!runningRun || activeProject === void 0) return;
				const project = activeProject;
				const workflowId = workflow?.id;
				const timer = setInterval(() => {
					(async () => {
						try {
							setRuns(await apiRef.current.listRuns(project.id, workflowId));
						} catch {}
					})();
				}, 2500);
				return () => {
					clearInterval(timer);
				};
			}, [
				runningRun,
				activeProject,
				workflow?.id
			]);
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
						const stamp = (/* @__PURE__ */ new Date()).toISOString();
						setTimeline((current) => {
							if (current !== void 0 && current.projectId === project.id) return current;
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
						});
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
				const load = async () => {
					try {
						const jobs = await apiRef.current.listRenders(project.id);
						if (!stale) setRenderJob(jobs[0]);
					} catch {}
				};
				load();
				if (!renderRunning) return () => {
					stale = true;
				};
				const timer = setInterval(() => {
					load();
				}, 2e3);
				return () => {
					stale = true;
					clearInterval(timer);
				};
			}, [
				mode,
				activeProject,
				renderRunning
			]);
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
								burnSubtitles: pending.burnSubtitles
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
			const timelineTotal = timeline === void 0 ? 0 : timelineDurationMs(timeline.tracks);
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
			const selectedAsset = assets.find((asset) => asset.id === selectedId);
			const previewTarget = selectedAsset === void 0 ? previewPath : {
				path: selectedAsset.path,
				kind: selectedAsset.kind
			};
			const visibleAssets = assetFilter === "all" ? assets : assets.filter((asset) => asset.kind === assetFilter);
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
			(0, react.useEffect)(() => {
				if (!tab.visible) return;
				const timer = setInterval(() => {
					(async () => {
						try {
							await loadProjects();
							await loadTasks();
							if (activeProject !== void 0) setAssets(await apiRef.current.listAssets(activeProject.id));
							setRefreshTick((current) => current + 1);
						} catch {}
					})();
				}, 5e3);
				return () => {
					clearInterval(timer);
				};
			}, [
				tab.visible,
				activeProject?.id,
				loadProjects,
				loadTasks
			]);
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
									}) : null,
									mode === "workflow" && workflow !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneCanvas",
										"data-workbench-planned": "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "iv-pane-actions",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: saveChipClass(workflowState),
														"data-workflow-save": workflowState,
														role: "status",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
															className: "iv-dot",
															"aria-hidden": "true"
														}), t(workflowState === "dirty" ? "saveDirty" : workflowState === "saving" ? "saveSaving" : workflowState === "failed" ? "saveFailed" : "saveSaved")]
													})
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowCanvas, {
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
												}
											}
										})]
									}) : null,
									mode === "timeline" && timeline !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneTimeline",
										"data-workbench-planned": "false",
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
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
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
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: saveChipClass(timelineState),
															"data-timeline-save": timelineState,
															role: "status",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
																className: "iv-dot",
																"aria-hidden": "true"
															}), t(timelineState === "dirty" ? "saveDirty" : timelineState === "saving" ? "saveSaving" : timelineState === "failed" ? "saveFailed" : "saveSaved")]
														})]
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
												className: "iv-toolbar",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: "iv-btn iv-btn--acc iv-btn--sm",
														"data-timeline-export": "true",
														disabled: renderRunning || timeline.tracks.find((track) => track.kind === "video")?.clips.length === 0,
														onClick: () => {
															run(async () => {
																setRenderJob(await apiRef.current.renderTimeline(timeline.id, timeline.projectId));
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
													renderJob === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
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
													}), renderJob.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "iv-progress",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: `${Math.max(2, renderJob.percent)}%` } })
													}) : null] })
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
														"aria-label": t("transportPlay"),
														title: t("transportPlay"),
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
															name: "play",
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
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "micro",
																children: t(trackIdKey(track.kind))
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "iv-t-kind",
																children: t(trackKindKey(track.kind))
															})]
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "iv-t-lane",
															children: [track.clips.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
																className: "iv-meta",
																children: t("timelineEmpty")
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: "iv-clips",
																children: track.clips.map((clip) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: `iv-clip iv-clip--${track.kind}`,
																	"data-timeline-clip": clip.id,
																	"data-timeline-clip-kind": track.kind,
																	style: { flexGrow: String(Math.max(.6, clip.durationMs / 1e3)) },
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
																					patchTrack(track.id, (current) => ({
																						...current,
																						clips: current.clips.map((item) => item.id === clip.id ? {
																							...item,
																							durationMs
																						} : item)
																					}));
																				}
																			}),
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
																	})]
																}, clip.id))
															}), track.kind === "subtitle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
									}) : null
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "iv-dock",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneAssets",
										"data-workbench-planned": "false",
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
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
												})]
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
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "iv-list",
												children: visibleAssets.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
													className: "iv-row",
													"data-active": asset.id === selectedId ? "true" : "false",
													children: [
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
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
															}), forceTarget === asset.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
															}) : null]
														})
													]
												}, asset.id))
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "panePreview",
										"data-workbench-planned": "false",
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
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneResources",
										"data-workbench-planned": "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "iv-pane-head",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "iv-pane-tile",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
													name: "tag",
													size: 13
												})
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
												className: "iv-pane-title",
												children: t("paneResources")
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "iv-pane-body",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-add-row",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
														className: "iv-select",
														"aria-label": t("paneResources"),
														value: resourceKind,
														onChange: (event) => {
															setResourceKind(event.target.value);
														},
														children: RESOURCE_KINDS.map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: kind,
															children: t(kindKey(kind))
														}, kind))
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
																	kind: resourceKind,
																	name: resourceName.trim(),
																	...note === "" ? {} : { note }
																});
																setResourceName("");
																setResourceNote("");
																await loadResources(project.id);
															});
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { name: "plus" }), t("addResource")]
													})
												]
											}), resources.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "iv-empty",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "iv-empty-tile",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
														name: "tag",
														size: 17
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("noResources") })]
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "iv-list",
												children: resources.map((resource) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
													className: "iv-row",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "iv-tile",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {
																name: RESOURCE_ICONS[resource.kind],
																size: 13
															})
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
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
															}), forceTarget === resource.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
															}) : null]
														})
													]
												}, resource.id))
											})]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "iv-pane",
										"data-workbench-pane": "paneTasks",
										"data-workbench-planned": "false",
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
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "iv-list",
												children: tasks.map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
													className: "iv-row",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: taskDotClass(task.status),
															"aria-hidden": "true"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: "iv-row-btn",
															"aria-label": `${t("previewOutput")} ${task.id}`,
															disabled: task.outputPath === void 0,
															onClick: () => {
																const path = task.outputPath;
																if (path === void 0) return;
																setPreviewPath({
																	path,
																	kind: task.kind
																});
																setSelectedId(assets.find((asset) => asset.path === path)?.id);
															},
															title: task.error ?? task.prompt ?? task.outputPath ?? "",
															children: [
																t(statusKey(task.status)),
																" · ",
																task.model ?? "—",
																" · ",
																formatBytes(task.bytes ?? 0),
																" · ",
																clockTime(task.createdAt)
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "iv-row-actions",
															children: [task.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: "iv-btn iv-btn--sm",
																"aria-label": `${t("cancelTask")} ${task.id}`,
																title: t("cancelTask"),
																disabled: busy,
																onClick: () => {
																	run(async () => {
																		await apiRef.current.cancelTask(task.id);
																		await loadTasks();
																	});
																},
																children: t("cancelTask")
															}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: "iv-btn iv-btn--sm",
																"aria-label": `${t("registerAsAsset")} ${task.id}`,
																title: t("registerAsAsset"),
																disabled: busy || activeProject === void 0 || task.outputPath === void 0,
																onClick: () => {
																	run(async () => {
																		const project = activeProject;
																		const path = task.outputPath;
																		if (project === void 0 || path === void 0) return;
																		if (!(await apiRef.current.attachAsset({
																			projectId: project.id,
																			path,
																			kind: task.kind,
																			bytes: task.bytes,
																			provider: task.provider,
																			model: task.model,
																			prompt: task.prompt
																		})).created) setNotice({
																			text: t("alreadyRegistered"),
																			tone: "info"
																		});
																		await apiRef.current.assignTask(task.id, project.id);
																		setAssets(await apiRef.current.listAssets(project.id));
																		await loadTasks();
																	});
																},
																children: t("registerAsAsset")
															})]
														})
													]
												}, task.id))
											})
										})]
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
			previewTitle: "Sequence preview",
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
			runHistory: "History",
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
			canvasSaved: "Canvas saved",
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
			canvasDeleteNode: "Delete node",
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
			palettePlanned: "Planned",
			railAssets: "Media assets",
			railTasks: "Tasks",
			railDefaults: "Effective defaults",
			statusReady: "Ready",
			monitorProgram: "Program",
			transportPlay: "Play",
			timelineZoom: "Zoom",
			trackVideoId: "V1",
			trackAudioId: "A1",
			trackSubtitleId: "S1"
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
			emptyHint: "项目、素材、资源与任务账本已可用；「专业工作流」模式里是节点画布（执行与项目存储随后端接入）。",
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
			previewTitle: "顺序预览",
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
			runHistory: "历史运行",
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
			canvasSaved: "画布已保存",
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
			canvasDeleteNode: "删除节点",
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
			palettePlanned: "规划中",
			railAssets: "媒体素材",
			railTasks: "生成任务",
			railDefaults: "生效默认值",
			statusReady: "就绪",
			monitorProgram: "节目监视器",
			transportPlay: "播放",
			timelineZoom: "缩放",
			trackVideoId: "V1",
			trackAudioId: "A1",
			trackSubtitleId: "S1"
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