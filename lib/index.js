import z from "@deepseek-ai/schemastery";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineTool } from "@deepseek-ai/dsh-tools";
import "@deepseek-ai/cordis";
import sharp from "sharp";
//#region src/config.ts
/**
* 插件配置类型与 Schemastery schema。所有部署可变参数都通过 Config 暴露，
* 不存在硬编码可调参数；切换服务商只需改 `provider` 字段，HMR 自动重载。
* @module dsh-image-video/config
*/
/** 服务商凭证 schema，复用于 threerouter/wanx/seedance。apiKey 可空（未激活的 provider 留空）。 */
const ProviderCredentialsSchema = z.object({
	apiKey: z.string().default("").description("服务商 API Key；未激活的 provider 可留空"),
	baseURL: z.string().default("").description("自定义接口地址，留空使用默认端点")
});
/** 插件配置 schema，默认服务商为 threerouter（图片+视频统一入口），wanx/seedance 可选。 */
const Config = z.object({
	provider: z.union([
		"threerouter",
		"wanx",
		"minimax",
		"seedance"
	]).default("threerouter").description("激活的生成服务商"),
	threerouter: ProviderCredentialsSchema.default({ apiKey: "" }).description("Threerouter 凭证（默认服务商，聚合器）"),
	wanx: ProviderCredentialsSchema.default({ apiKey: "" }).description("万象（wanx）凭证"),
	minimax: ProviderCredentialsSchema.default({ apiKey: "" }).description("MiniMax 官方平台凭证（仅视频）"),
	seedance: ProviderCredentialsSchema.default({ apiKey: "" }).description("Seedance2.5 凭证"),
	defaultImageProvider: z.union([
		"",
		"threerouter",
		"wanx",
		"minimax",
		"seedance"
	]).default("").description("默认图片服务商，留空跟随激活服务商"),
	defaultVideoProvider: z.union([
		"",
		"threerouter",
		"wanx",
		"minimax",
		"seedance"
	]).default("").description("默认视频服务商，留空跟随激活服务商"),
	defaultImageModel: z.string().default("").description("默认图片模型，留空使用服务商内置默认模型"),
	defaultVideoModel: z.string().default("").description("默认视频模型，留空使用服务商内置默认模型"),
	defaultImageSize: z.string().default("3:4").description("默认图片尺寸/比例，如 3:4（qwen/wan 系自动换算为宽*高，threerouter/方舟换算为宽x高）"),
	defaultVideoDuration: z.number().default(5).min(1).max(30).description("默认视频时长（秒），上限 30，由上游模型校验具体能力"),
	imageTransport: z.union([
		"auto",
		"async",
		"sync"
	]).default("auto").description("图片提交传输：auto 优先异步（幂等+超时找回）并按需降级，async 强制异步，sync 强制同步单次提交"),
	imageUnknownStatePolicy: z.union(["fail", "resubmit-same-key"]).default("fail").description("提交状态未知时的策略：fail 不重提（默认），resubmit-same-key 用同一幂等键重提一次（服务端按键去重）"),
	timeoutMs: z.number().default(6e4).min(1e3).description("单次 HTTP 请求超时（毫秒）"),
	pollIntervalMs: z.number().default(5e3).min(1e3).description("视频任务轮询间隔（毫秒）"),
	pollTimeoutMs: z.number().default(6e5).min(1e4).description("视频任务整体超时（毫秒）"),
	retryTimes: z.number().default(3).min(0).max(10).description("可重试错误的最大重试次数（仅读取类请求；生图提交永远不重试）"),
	outputsDir: z.string().default("./outputs").description("生成媒体落地目录（插件唯一解析点，启动时打绝对路径日志）"),
	watermark: z.object({
		enabled: z.boolean().default(true).description("是否对最终图片合成品牌水印"),
		text: z.string().default("Threerouter").description("水印文字"),
		opacity: z.number().default(.68).min(0).max(1).description("主文字不透明度"),
		position: z.union([
			"bottom-right",
			"bottom-left",
			"top-right",
			"top-left"
		]).default("bottom-right").description("水印位置"),
		fontSizeRatio: z.number().default(.032).min(.005).max(.2).description("字号占图片宽度比例"),
		marginXRatio: z.number().default(.028).min(0).max(.3).description("水平留白占比"),
		marginYRatio: z.number().default(.012).min(0).max(.3).description("垂直留白占比"),
		glowEnabled: z.boolean().default(true).description("是否加柔光"),
		glowColor: z.string().default("#ffffff").description("柔光颜色"),
		glowBlurRatio: z.number().default(.18).min(0).max(1).description("柔光半径占字号比例")
	}).default({
		enabled: true,
		text: "Threerouter",
		opacity: .68,
		position: "bottom-right",
		fontSizeRatio: .032,
		marginXRatio: .028,
		marginYRatio: .012,
		glowEnabled: true,
		glowColor: "#ffffff",
		glowBlurRatio: .18
	}).description("图片最终结果的品牌水印后处理（内存内合成，只落盘最终图）")
});
/**
* 读取指定服务商的凭证，不校验 key 非空。供候选服务商构建时的 key 过滤
* （resolveModelCandidates 用它跳过未配置 key 的候选），不抛错。
*/
function peekProviderCredentials(config, provider) {
	return provider === "threerouter" ? config.threerouter : provider === "wanx" ? config.wanx : provider === "minimax" ? config.minimax : config.seedance;
}
/**
* 解析指定服务商的凭证，校验非空。供按模型自动路由的生成工具使用：
* composer 选中某服务商分组下的模型时，工具以该服务商的凭证直连。
* @param config - 已校验的插件配置。
* @param provider - 目标服务商。
* @returns 服务商凭证与端点。
* @throws 当该服务商未配置 API Key 时（报错指明缺 key 的 provider 字段）。
*/
function resolveProviderCredentials(config, provider) {
	const creds = peekProviderCredentials(config, provider);
	if (!creds.apiKey || creds.apiKey.trim().length === 0) throw new Error(`dsh-image-video: 服务商 ${provider} 未配置 API Key，请在配置中设置 ${provider}.apiKey`);
	return {
		provider,
		apiKey: creds.apiKey,
		baseURL: creds.baseURL?.trim() || defaultBaseURL(provider)
	};
}
/** 服务商默认接口地址。 */
function defaultBaseURL(provider) {
	switch (provider) {
		case "threerouter": return "https://api.threerouter.com/v1";
		case "wanx": return "https://dashscope.aliyuncs.com/api/v1";
		case "minimax": return "https://api.minimaxi.com/v1";
		case "seedance": return "https://ark.cn-beijing.volces.com/api/v3";
	}
}
//#endregion
//#region src/media-route.ts
/**
* outputs/ 媒体 HTTP 路由：把本地 outputs 目录经 webServer 服务以只读方式
* 暴露给渲染进程，供桌面客户端 keyed toolview 内嵌 <video>/<img> 直接加载
* 生成结果，替代"给出本地路径、让用户自行用本地播放器打开"的体验。
*
* 上游 `webServer` 服务（@deepseek-ai/dsh-host-webserver）在本插件中按结构类型
* 引用：`ctx.inject(['webServer'], cb)` 无需类型 augment，`ctx.get('webServer')`
* 返回 any，本文件声明本地 `MediaWebServer` 最小结构接口做断言，
* 不新增对上游 host 包的依赖。
*
* 安全边界：
*   - 仅当 webServer 绑定在 127.0.0.1（本机回环）时注册路由；0.0.0.0 时跳过，
*     避免生成的媒体文件暴露到局域网。
*   - 文件名校验：URL 解码后必须是不含路径分隔符的单段文件名，且 resolve 后
*     仍落在 outputsDir 内，杜绝 ../ 目录遍历。
*   - 扩展名白名单映射 Content-Type，白名单外一律 404。
*
* @module dsh-image-video/media-route
*/
/** outputs 媒体路由前缀（prefix 匹配 /outputs 与 /outputs/<文件名>）。 */
const OUTPUTS_ROUTE_PATH = "/outputs";
/** 扩展名 → Content-Type 白名单；表外扩展名一律 404。 */
const CONTENT_TYPES = {
	".mp4": "video/mp4",
	".mov": "video/quicktime",
	".webm": "video/webm",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif"
};
/**
* 校验 URL 解码后的路径段是否为 outputs/ 内的合法单段文件名。
* 拒绝空段、相对段（. / ..）、任何形式的路径分隔符与 NUL 字节；再以 resolve
* 归一化双重确认结果仍位于 outputsDir 内（防御分隔符/大小写差异导致的绕过）。
* @param raw - decodeURIComponent 之后的原始段。
* @param outputsDir - 归一化后的 outputs 绝对目录。
* @returns 合法文件名；不合法返回 undefined。
*/
function safeOutputFileName(raw, outputsDir) {
	if (raw === "" || raw === "." || raw === ".." || raw.includes("\0")) return void 0;
	if (raw.includes("/") || raw.includes("\\") || raw.includes(sep)) return void 0;
	if (basename(raw) !== raw) return void 0;
	const root = resolve(outputsDir);
	const full = resolve(root, raw);
	return full === root || full.startsWith(root + sep) ? raw : void 0;
}
/**
* 扩展名（含点、忽略大小写）→ Content-Type；白名单外返回 undefined。
* @param ext - 如 '.mp4'。
*/
function contentTypeForExtension(ext) {
	return CONTENT_TYPES[ext.toLowerCase()];
}
/**
* 解析 Range 请求头（bytes=start-end / bytes=start- / bytes=-suffix）。
* 只取第一段（视频播放器均发单段请求）；末字节越界截断到文件尾。
* @param header - Range 头原文；undefined 或非 bytes 单位返回 undefined（按全量处理）。
* @param size - 资源总字节数。
* @returns 可满足的闭区间；头非法或区间不可满足时返回 undefined。
*/
function parseRange(header, size) {
	if (header === void 0 || !header.startsWith("bytes=")) return void 0;
	const spec = (header.slice(6).split(",")[0] ?? "").trim();
	const dash = spec.indexOf("-");
	if (dash === -1) return void 0;
	const startText = spec.slice(0, dash).trim();
	const endText = spec.slice(dash + 1).trim();
	if (startText === "" && endText === "") return void 0;
	let start;
	let end;
	if (startText === "") {
		const suffix = Number(endText);
		if (!Number.isInteger(suffix) || suffix <= 0 || size === 0) return void 0;
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(startText);
		if (!Number.isInteger(start) || start < 0) return void 0;
		end = endText === "" ? size - 1 : Number(endText);
		if (!Number.isInteger(end)) return void 0;
		if (end >= size) end = size - 1;
	}
	if (start > end || start >= size) return void 0;
	return {
		start,
		end
	};
}
/**
* 创建 outputs 路由 handler：GET/HEAD 流式返回媒体文件，GET 支持 Range 206
* 分段加载（视频进度条拖动依赖）。白名单外扩展名、越界路径、不存在的文件
* 一律 404；URL 解码失败 400；非 GET/HEAD 405。
* @param outputsDir - outputs 目录（相对路径按进程 cwd 归一化）。
*/
function createOutputsRouteHandler(outputsDir) {
	const root = resolve(outputsDir);
	return async (req, res) => {
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405, { Allow: "GET, HEAD" });
			res.end();
			return;
		}
		let raw;
		try {
			raw = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname.replace(/^\/outputs\/?/, ""));
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const name = safeOutputFileName(raw, root);
		const contentType = name === void 0 ? void 0 : contentTypeForExtension(extname(name));
		if (name === void 0 || contentType === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		let size;
		try {
			const info = await stat(resolve(root, name));
			if (!info.isFile()) {
				res.writeHead(404);
				res.end();
				return;
			}
			size = info.size;
		} catch {
			res.writeHead(404);
			res.end();
			return;
		}
		const range = req.method === "GET" ? parseRange(req.headers.range, size) : void 0;
		if (req.method === "GET" && req.headers.range !== void 0 && range === void 0) {
			res.writeHead(416, { "Content-Range": `bytes */${size}` });
			res.end();
			return;
		}
		const headers = {
			"Content-Type": contentType,
			"Content-Length": range === void 0 ? size : range.end - range.start + 1,
			"Accept-Ranges": "bytes",
			"Cache-Control": "no-store"
		};
		if (range !== void 0) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
		res.writeHead(range === void 0 ? 200 : 206, headers);
		if (req.method === "HEAD" || size === 0) {
			res.end();
			return;
		}
		const stream = createReadStream(resolve(root, name), range === void 0 ? void 0 : {
			start: range.start,
			end: range.end
		});
		res.on("close", () => {
			stream.destroy();
		});
		stream.on("error", () => {
			if (!res.headersSent) res.writeHead(500);
			res.destroy();
		});
		stream.pipe(res);
	};
}
/**
* 把 outputs 媒体路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时
* 返回 undefined 且不注册，生成的媒体不暴露到非本机网络。
* @param webServer - webServer 服务实例。
* @param outputsDir - outputs 目录（相对路径按进程 cwd 归一化）。
* @returns 路由注销函数；未注册返回 undefined。
*/
function registerOutputsRoute(webServer, outputsDir) {
	if (webServer.host !== "127.0.0.1") return void 0;
	return webServer.register({
		kind: "prefix",
		path: OUTPUTS_ROUTE_PATH,
		handler: createOutputsRouteHandler(outputsDir)
	});
}
//#endregion
//#region src/http-client.ts
/** 所有生成相关错误的基类，携带友好中文提示与分类标记。 */
var GenerationError = class extends Error {
	kind;
	/** 是否值得重试：仅超时与网络抖动重试，鉴权/配额/任务逻辑错误立即失败。 */
	retryable;
	/** 原始 HTTP 状态码，任务级错误可能为 undefined。 */
	status;
	/** 服务端 Retry-After 建议的等待时间（毫秒）。 */
	retryAfterMs;
	/**
	* 服务端返回的机器可读错误码（形如 `{"error":{"code":"IDEMPOTENCY_IN_PROGRESS"}}`）。
	* 生图事务靠它区分「提交未落地（可回退候选）」与「提交状态未知（绝不重提）」，
	* 因此必须比 message 文本更可靠地保留下来。
	*/
	code;
	constructor(kind, message, retryable, status, retryAfterMs, code) {
		super(message);
		this.name = "GenerationError";
		this.kind = kind;
		this.retryable = retryable;
		this.status = status;
		if (retryAfterMs !== void 0) this.retryAfterMs = retryAfterMs;
		if (code !== void 0 && code !== "") this.code = code;
	}
};
/**
* 判定错误是否为「异步图片端点在本环境不可用」：功能未开启（未配对象存储）或
* 该分组平台不支持 Images API。两者都在创建任务前返回 404，因此降级到同步
* 单次提交不会产生重复生成。
*/
function isAsyncImageUnavailableError(err) {
	if (!(err instanceof GenerationError) || err.status !== 404) return false;
	return /async image tasks are not enabled|not supported for this platform/i.test(err.message);
}
/** 判定错误是否为「同一幂等键首次提交仍在进行中」：任务已存在，应凭 request_id 找回而非重提。 */
function isIdempotencyInProgressError(err) {
	return err instanceof GenerationError && err.code === "IDEMPOTENCY_IN_PROGRESS";
}
/** 判定错误是否为「同一幂等键被用于不同请求体」：客户端事务 ID 复用，必须响亮失败。 */
function isIdempotencyConflictError(err) {
	return err instanceof GenerationError && err.code === "IDEMPOTENCY_KEY_CONFLICT";
}
/**
* 判定错误是否为「提交状态未知」——客户端无法确认请求是否已在服务端创建任务。
* 超时、连接中断、502/503 都属于此类：**绝不允许自动重提或换模型**，只能凭
* request_id 反查（见 image-transaction.ts）。
*/
function isUnknownSubmitStateError(err) {
	if (isCancelledError(err)) return false;
	if (!(err instanceof GenerationError)) return true;
	if (err.status !== void 0 && err.status >= 500) return true;
	return err.kind === "timeout" || err.kind === "network";
}
/**
* 判定错误是否为「调用方主动取消」。取消同样可能发生在请求已抵达服务端之后，
* 因此不视为「未提交」——只是不再做任何自动动作（找回/重提都不做）。
*/
function isCancelledError(err) {
	return err instanceof GenerationError && /已被取消/.test(err.message);
}
/**
* 判定错误是否由服务端**在创建任务之前**返回——按 threerouter 的 HTTP 契约
* （docs/ASYNC_IMAGE_TASKS.md「HTTP status code contract」），400/401/403/404/413/429
* 都在落库之前拦截，因此这类错误可以安全地回退到下一候选服务商或降级传输；
* 409 例外（IN_PROGRESS 时任务已存在），5xx/超时同样例外。
*/
function isDefinitelyNoTaskError(err) {
	if (!(err instanceof GenerationError)) return false;
	if (err.status === void 0) return false;
	return err.status >= 400 && err.status < 500 && err.status !== 409;
}
/**
* 判定错误是否为「模型不被该服务商接受」类，供工具层在候选服务商间回退。
* 实测形态（2026-09）：
* - threerouter：目录中无可用渠道的模型 → HTTP 503 capacity_error
*   "No available media generation channels"（网关按模型找渠道，未知模型即无渠道）；
* - threerouter：分组未开通生图 → HTTP 403 permission_error
*   "Image generation is not enabled for this group"（文档语义：401=Key 无效，
*   403=无该分组/模型权限或未开通生图 allow_image_generation——属于「该候选
*   无法服务此请求」，应换下一候选，而非响亮终止）；
* - 部分服务商：HTTP 400/404 + 模型不存在类消息（"model not found" / "模型不存在"）；
* - 能力缺失：如「不支持图片生成」。
* 注意区分语义相近的参数级 400——如 "model X does not support duration 1s"
* （时长档位问题，模型本身可用），该类消息不命中本判定，不触发换家。
* 其余 5xx（无 capacity_error 语义）、Key 无效（401）、配额（429）、超时一律不成立：
* 响亮失败，避免用别家的 key 静默掩盖本服务商的配置问题。
*/
function isModelNotAcceptedError(err) {
	if (!(err instanceof GenerationError)) return false;
	const message = err.message ?? "";
	const modelMissing = /not\s*found|not\s*exist|does\s*not\s*exist|unknown\s*model|invalid\s*model|不存在|未找到|未开通|无效的?模型/i.test(message);
	const capabilityMissing = message.includes("不支持");
	if (err.kind === "task") return modelMissing || capabilityMissing;
	if (err.kind === "network") return /no available media generation channels|capacity_error/i.test(message);
	if (err.kind === "auth") return /image generation is not enabled|not enabled for this group|allow_image_generation|未开通生图|无该分组|无该模型权限/i.test(message);
	return false;
}
/** 重试退避基数（毫秒），指数退避：base * 2^attempt。 */
const RETRY_BACKOFF_MS = 1e3;
/**
* 执行单次 HTTP 请求，带超时控制。不处理重试。
* @throws {GenerationError} 超时或网络错误（可重试）。
*/
async function singleRequest(opts) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
	const onExternalAbort = () => controller.abort();
	opts.signal?.addEventListener("abort", onExternalAbort);
	try {
		const init = {
			method: opts.method,
			headers: opts.headers,
			signal: controller.signal
		};
		if (opts.method === "POST" && opts.body !== void 0) init.body = JSON.stringify(opts.body);
		const res = await fetch(opts.url, init);
		const data = await parseBody(res);
		return {
			ok: true,
			status: res.status,
			data,
			headers: res.headers
		};
	} catch (err) {
		if (controller.signal.aborted && !opts.signal?.aborted) throw new GenerationError("timeout", `请求超时（${opts.timeoutMs}ms），URL: ${opts.url}`, true);
		if (opts.signal?.aborted) throw new GenerationError("timeout", "任务已被取消", false);
		throw new GenerationError("network", `网络请求失败：${err instanceof Error ? err.message : String(err)}`, true);
	} finally {
		clearTimeout(timeoutId);
		opts.signal?.removeEventListener("abort", onExternalAbort);
	}
}
/** 解析响应体为 JSON，空体返回 null。 */
async function parseBody(res) {
	const text = await res.text();
	if (text.length === 0) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
/**
* 分类 HTTP 响应错误，生成友好中文提示。
* 内部实现，不在 execute 外部直接调用。通过 `classifyErrorForTest` 导出用于单元测试。
*/
/**
* 解析 Retry-After 响应头为毫秒（支持秒数与 HTTP 日期两种形态），上限 180s。
* 导出供适配器读取 202/409 上的服务端建议轮询间隔。
*/
function parseRetryAfterMs(value) {
	if (value === null || value === void 0) return void 0;
	const seconds = Number(value.trim());
	if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1e3, 18e4);
	const timestamp = Date.parse(value);
	if (!Number.isNaN(timestamp)) return Math.min(Math.max(0, timestamp - Date.now()), 18e4);
}
function classifyHttpError(status, data, url, retryAfterHeader) {
	const errMsg = extractErrorMessage(data);
	const code = extractErrorCode(data);
	if (status === 401) return new GenerationError("auth", `鉴权失败（HTTP 401）：API Key 无效。${errMsg}`, false, status, void 0, code);
	if (status === 403) return new GenerationError("auth", `权限失败（HTTP 403）：分组/模型未开通该能力，请联系服务方开通。${errMsg}`, false, status, void 0, code);
	if (status === 429) {
		const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
		return new GenerationError("quota", `配额耗尽（HTTP 429）：请求频率或额度超限，请稍后重试或检查账户余额。${errMsg}`, true, status, retryAfterMs, code);
	}
	if (status === 409) {
		const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
		return new GenerationError("task", `幂等冲突（HTTP 409）：${errMsg || "同一幂等键的请求已存在"}`, false, status, retryAfterMs, code);
	}
	if (status >= 500) return new GenerationError("network", `服务端错误（HTTP ${status}），将重试。${errMsg}`, true, status, void 0, code);
	return new GenerationError("task", `任务报错（HTTP ${status}）：${errMsg || "服务端返回错误"}，URL: ${url}`, false, status, void 0, code);
}
/**
* 从响应体提取机器可读错误码，兼容 `{"error":{"code":…}}`、`{"error":{"type":…}}`
* 与顶层 `code` / `type`。threerouter 网关的异步图片契约用的是
* `{"error":{"type":code,"code":code,"message":msg}}`。
*/
function extractErrorCode(data) {
	if (data === null || typeof data !== "object") return void 0;
	const obj = data;
	const pick = (value) => typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
	const error = obj.error;
	if (error !== null && typeof error === "object") {
		const errObj = error;
		return pick(errObj.code) ?? pick(errObj.type);
	}
	return pick(obj.code) ?? pick(obj.type);
}
/** 从服务商响应体提取错误消息，兼容常见结构。 */
function extractErrorMessage(data) {
	if (data === null || typeof data !== "object") return "";
	const obj = data;
	const message = obj.message ?? obj.error_message ?? obj.msg;
	if (typeof message === "string") return message;
	const error = obj.error;
	if (typeof error === "string") return error;
	if (error !== null && typeof error === "object") {
		const errObj = error;
		if (typeof errObj.message === "string") return errObj.message;
		if (typeof errObj.code === "string") return `错误码: ${errObj.code}`;
	}
	if (typeof obj.code === "string") return `错误码: ${obj.code}`;
	return "";
}
/**
* 统一 HTTP 请求入口：执行请求，分类异常，对可重试错误按指数退避重试。
* 鉴权失败与任务逻辑错误立即抛出；配额错误按 Retry-After 和 retryTimes 有限重试。
* @returns 解析后的响应数据。
* @throws {GenerationError} 分类后的生成错误。
*/
async function request(opts) {
	return (await requestFull(opts)).data;
}
/**
* 与 {@link request} 相同的重试/分类语义，但返回完整响应（含 status 与 headers）。
*
* 存在的唯一理由：生图事务必须读到 `X-Idempotency-Replayed`（本次是幂等回放、
* 没有真正新建任务）与 `Retry-After`（409 进行中的锁窗口）——这两条信息只在
* 响应头上，`request()` 会把它们丢掉。
* @throws {GenerationError} 分类后的生成错误。
*/
async function requestFull(opts) {
	let lastError;
	for (let attempt = 0; attempt <= opts.retryTimes; attempt++) {
		if (opts.signal?.aborted) throw new GenerationError("timeout", "任务已被取消", false);
		try {
			const result = await singleRequest(opts);
			if (result.status >= 200 && result.status < 300) return result;
			throw classifyHttpError(result.status, result.data, opts.url, result.headers.get("retry-after"));
		} catch (err) {
			if (err instanceof GenerationError) {
				if (!err.retryable) throw err;
				lastError = err;
				if (attempt < opts.retryTimes) {
					await sleep(err.retryAfterMs ?? RETRY_BACKOFF_MS * Math.pow(2, attempt), opts.signal);
					continue;
				}
			} else lastError = new GenerationError("network", `未知错误：${err instanceof Error ? err.message : String(err)}`, true);
		}
	}
	throw lastError ?? new GenerationError("network", "请求失败且未捕获具体错误", true);
}
/**
* 下载二进制媒体到 Uint8Array。重试逻辑同 request。
* @param url - 媒体下载地址。
* @param opts - 超时、重试、取消信号。
* @returns 媒体字节与 Content-Type。
* @throws {GenerationError} 下载失败。
*/
async function downloadMedia(url, opts) {
	let lastError;
	for (let attempt = 0; attempt <= opts.retryTimes; attempt++) {
		if (opts.signal?.aborted) throw new GenerationError("timeout", "下载任务已被取消", false);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
		const onExternalAbort = () => controller.abort();
		opts.signal?.addEventListener("abort", onExternalAbort);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (!res.ok) {
				const data = await parseBody(res);
				throw classifyHttpError(res.status, data, url, res.headers.get("retry-after"));
			}
			const buffer = await res.arrayBuffer();
			return {
				data: new Uint8Array(buffer),
				contentType: res.headers.get("content-type") ?? "application/octet-stream"
			};
		} catch (err) {
			if (err instanceof GenerationError) {
				if (!err.retryable) throw err;
				lastError = err;
			} else if (controller.signal.aborted && !opts.signal?.aborted) lastError = new GenerationError("timeout", `下载超时（${opts.timeoutMs}ms）`, true);
			else lastError = new GenerationError("network", `下载失败：${err instanceof Error ? err.message : String(err)}`, true);
			if (attempt < opts.retryTimes) await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt), opts.signal);
		} finally {
			clearTimeout(timeoutId);
			opts.signal?.removeEventListener("abort", onExternalAbort);
		}
	}
	throw lastError ?? new GenerationError("network", "下载失败", true);
}
/** 可被取消的延时。 */
function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new GenerationError("timeout", "任务已被取消", false));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new GenerationError("timeout", "任务已被取消", false));
		}, { once: true });
	});
}
//#endregion
//#region src/media.ts
/**
* 媒体渲染与输出模块：下载生成结果到 outputs/ 目录。
* 图片字节经 attachment 服务持久化，附件引用走 presentationMeta（UI-only 通道），
* 模型只接收文本摘要；视频返回本地文件链接。
* @module dsh-image-video/media
*/
/**
* 把配置里的 outputsDir 解析为**绝对路径**。插件只在 apply() 里调用一次，
* 之后所有落盘（生成、下载、水印后处理）与只读 media 路由都使用同一个解析结果，
* 从根本上杜绝「模型结果在 A 目录、后处理结果在 B 目录」这类旁路产物。
* @param outputsDir - 配置值（可为相对路径）。
* @returns 绝对目录路径。
*/
function resolveOutputsDir(outputsDir) {
	return resolve(outputsDir);
}
/**
* 把最终媒体字节写入 outputsDir（唯一落盘入口）。
*
* 「唯一入口」是刻意的设计约束：图片生成的后处理（水印）在内存里完成后再调用
* 本函数，因此磁盘上只可能出现一份文件、且内容就是最终结果——交互流展示的
* 附件与本地文件必然一致。
* @param data - 最终字节。
* @param contentType - 最终 MIME 类型。
* @param outputsDir - 输出目录（绝对路径，见 resolveOutputsDir）。
* @param fallbackExt - Content-Type 无法识别时的扩展名。
* @param sourceUrl - 上游来源地址（base64 形态留空）。
* @returns 保存结果。
*/
async function writeOutputFile(data, contentType, outputsDir, fallbackExt, sourceUrl = "") {
	const dir = resolve(outputsDir);
	await mkdir(dir, { recursive: true });
	const ext = extFromContentType(contentType, fallbackExt);
	const filename = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
	const localPath = resolve(dir, filename);
	await writeFile(localPath, data);
	return {
		localPath,
		sourceUrl,
		contentType,
		bytes: data.byteLength,
		data
	};
}
/** 下载媒体字节到内存（不落盘）。后处理链路的第一步。 */
async function fetchMediaBytes(url, opts) {
	return await downloadMedia(url, opts);
}
/** 解码服务商直接返回的 base64 图片为内存字节（不落盘）。 */
function decodeBase64Media(base64, mediaType) {
	return {
		data: new Uint8Array(Buffer.from(base64, "base64")),
		contentType: mediaType
	};
}
/**
* 下载媒体并保存到 outputs/ 目录。
* @param url - 服务商返回的媒体下载 URL。
* @param outputsDir - 配置的输出目录。
* @param ext - 文件扩展名（如 .png、.mp4）。
* @param opts - HTTP 下载选项。
* @returns 保存结果。
*/
async function downloadAndSave(url, outputsDir, fallbackExt, opts) {
	const { data, contentType } = await downloadMedia(url, opts);
	return await writeOutputFile(data, contentType, outputsDir, fallbackExt, url);
}
/** 从扩展名推断图片 MIME 类型；未知扩展名回退 image/png，由服务商对无法识别的字节响亮报错。 */
function imageMimeFromPath(path) {
	switch (extname(path).toLowerCase()) {
		case ".png": return "image/png";
		case ".jpg":
		case ".jpeg": return "image/jpeg";
		case ".webp": return "image/webp";
		case ".gif": return "image/gif";
		case ".bmp": return "image/bmp";
		default: return "image/png";
	}
}
/**
* 解析 generate_video 的 image 入参为服务商可直接消费的图片引用。
* http(s) URL 与 data URL 原样返回；其余按本地文件路径读取并编码为 data URL。
* @param input - http(s) URL、data URL 或本地文件路径。
* @returns 服务商可直接消费的图片引用。
* @throws 本地路径不存在或不可读时原样抛出 Node fs 错误。
*/
async function resolveImageReference(input) {
	const ref = input.trim();
	if (/^(https?|data):/.test(ref)) return ref;
	const data = await readFile(ref);
	return `data:${imageMimeFromPath(ref)};base64,${data.toString("base64")}`;
}
const execFileAsync = promisify(execFile);
/** 首帧压缩阈值：data URL 解码后字节数超过该值才压缩（小图直接提交）。 */
const FIRST_FRAME_COMPRESS_THRESHOLD = 15e5;
/** 压缩后长边上限：视频输出最高 768P~2K，长边 1600 绰绰有余。 */
const FIRST_FRAME_LONG_EDGE = 1600;
/**
* 视频首帧压缩：超大的本地图片 data URL 在提交前经 ffmpeg 缩放转 JPEG。
* 实测（2026-09-14）：~3MB 原图转 data URL 提交会被网关长时间消化直至提交超时，
* 压到 ~150KB 后秒收；视频输出本就 ≤768P/1080P，压图不损观感。
* 仅处理 data:image/ 形态且解码后超过阈值的引用；ffmpeg 不可用或执行失败时
* 原样返回（不阻塞提交，只是慢），http(s) URL 不处理。
*/
async function compressVideoFirstFrame(ref) {
	if (!ref.startsWith("data:image/")) return ref;
	const commaIdx = ref.indexOf(",");
	if (commaIdx < 0) return ref;
	const header = ref.slice(0, commaIdx);
	const b64 = ref.slice(commaIdx + 1);
	if (Math.floor(b64.length * 3 / 4) <= FIRST_FRAME_COMPRESS_THRESHOLD) return ref;
	const inExt = header.includes("jpeg") || header.includes("jpg") ? ".jpg" : header.includes("webp") ? ".webp" : ".png";
	const dir = tmpdir();
	const inPath = join(dir, `dsh-frame-${randomBytes(6).toString("hex")}${inExt}`);
	const outPath = join(dir, `dsh-frame-${randomBytes(6).toString("hex")}.jpg`);
	try {
		await writeFile(inPath, Buffer.from(b64, "base64"));
		await execFileAsync("ffmpeg", [
			"-y",
			"-v",
			"error",
			"-i",
			inPath,
			"-vf",
			`scale='min(${FIRST_FRAME_LONG_EDGE},iw)':-2`,
			"-q:v",
			"3",
			outPath
		]);
		const out = await readFile(outPath);
		if (out.byteLength === 0) return ref;
		return `data:image/jpeg;base64,${out.toString("base64")}`;
	} catch {
		return ref;
	} finally {
		await unlink(inPath).catch(() => {});
		await unlink(outPath).catch(() => {});
	}
}
/** 参考视频压缩阈值：本地视频超过该字节数时先经 ffmpeg 转码再编码为 data URL。 */
const REFERENCE_VIDEO_COMPRESS_THRESHOLD = 2e6;
/** 参考视频原始字节上限：超出后不再提交（threerouter 无上传端点，巨型请求体会被网关拒绝）。 */
const REFERENCE_VIDEO_MAX_BYTES = 6e6;
/** 参考视频长边上限：产出最高 1080P，参考段压到 720p 档足够表达动作与构图。 */
const REFERENCE_VIDEO_LONG_EDGE = 1280;
/** 参考视频时长上限（秒）：wan3.0-video 的 reference_video 要求单段不超过 15 秒。 */
const REFERENCE_VIDEO_MAX_SECONDS = 15;
/** 从扩展名推断视频 MIME；未知扩展名回退 video/mp4（wan3.0-video 只接受 mp4 参考段）。 */
function videoMimeFromPath(path) {
	switch (extname(path).toLowerCase()) {
		case ".webm": return "video/webm";
		case ".mov": return "video/quicktime";
		default: return "video/mp4";
	}
}
/**
* 参考视频 ffmpeg 转码：裁到 {@link REFERENCE_VIDEO_MAX_SECONDS} 秒内、长边压到
* {@link REFERENCE_VIDEO_LONG_EDGE}、CRF 32。ffmpeg 缺失或执行失败返回原字节，
* 由上游体积上限兜底拒绝（不静默提交巨型请求体）。
*/
async function compressReferenceVideo(bytes, sourcePath) {
	const dir = tmpdir();
	const inPath = join(dir, `dsh-refvid-${randomBytes(6).toString("hex")}${extname(sourcePath) || ".mp4"}`);
	const outPath = join(dir, `dsh-refvid-${randomBytes(6).toString("hex")}.mp4`);
	try {
		await writeFile(inPath, bytes);
		await execFileAsync("ffmpeg", [
			"-y",
			"-v",
			"error",
			"-i",
			inPath,
			"-t",
			String(REFERENCE_VIDEO_MAX_SECONDS),
			"-vf",
			`scale='min(${REFERENCE_VIDEO_LONG_EDGE},iw)':-2`,
			"-c:v",
			"libx264",
			"-crf",
			"32",
			"-preset",
			"veryfast",
			"-c:a",
			"aac",
			"-b:a",
			"96k",
			outPath
		]);
		const out = await readFile(outPath);
		return out.byteLength > 0 ? out : bytes;
	} catch {
		return bytes;
	} finally {
		await unlink(inPath).catch(() => {});
		await unlink(outPath).catch(() => {});
	}
}
/**
* 解析参考视频为服务商可直接消费的引用：http(s) URL 原样透传；本地文件读取后按需
* 转码并编码为 data URL。threerouter 没有上传端点（2026-09-22 探测 /v1/files 等全 404），
* 本地视频只能以 data URL 提交，而网关对超大请求体会拒绝，因此在客户端完成压缩。
* @param input - http(s) URL、data URL 或本地文件路径。
* @returns 适配器可直接消费的参考视频引用。
* @throws 本地文件超过 {@link REFERENCE_VIDEO_MAX_BYTES} 时抛错，避免提交必然失败的巨型请求体。
*/
async function resolveReferenceVideo(input) {
	const ref = input.trim();
	if (/^(https?|data):/.test(ref)) return ref;
	const original = await readFile(ref);
	const payload = original.byteLength > REFERENCE_VIDEO_COMPRESS_THRESHOLD ? await compressReferenceVideo(original, ref) : original;
	if (payload.byteLength > REFERENCE_VIDEO_MAX_BYTES) {
		const mb = (payload.byteLength / 1024 / 1024).toFixed(1);
		throw new Error(`参考视频体积 ${mb}MB 超过 ${REFERENCE_VIDEO_MAX_BYTES / 1024 / 1024}MB 上限：threerouter 无上传端点，本地视频只能以 data URL 提交，过大的请求体会被网关拒绝。请先裁短/压缩该视频（建议 ≤15 秒、720p 以内），或改传公网 http(s) URL。`);
	}
	return `data:${videoMimeFromPath(ref)};base64,${payload.toString("base64")}`;
}
/**
* 视频参考素材解析：把工具参数数组解析为适配器可直接消费的 `{url, type}` 形态。
* 图片先压缩再编码为 data URL（已有 data URL 跳过压缩），视频经
* {@link resolveReferenceVideo} 处理；参考视频用于 wan3.0-video 的视频编辑
* （原片动作 + 自然语言指令替换主体/元素）。
* @param ms - 原始媒体数组。
* @returns 适配器可直接消费的媒体数组。
* @throws 条目既无 image 也无 video 时抛错，避免静默丢素材。
*/
async function resolveVideoMedia(ms) {
	return await Promise.all(ms.map(async (m) => {
		const video = typeof m.video === "string" && m.video.trim() !== "" ? m.video : void 0;
		if (video !== void 0) return {
			url: await resolveReferenceVideo(video),
			type: m.type ?? "reference_video"
		};
		const image = typeof m.image === "string" && m.image.trim() !== "" ? m.image : void 0;
		if (image === void 0) throw new Error("media 条目必须提供 image（参考图）或 video（参考视频）之一");
		const position = m.position?.toLowerCase();
		const type = m.type ?? (position === "first_frame" || position === "0s" ? "first_frame" : position === "last_frame" ? "last_frame" : "reference_image");
		return {
			url: await compressVideoFirstFrame(await resolveImageReference(image)),
			type
		};
	}));
}
/** 从 Content-Type 推断图片媒体类型（attachment 服务要求精确类型）。 */
function toImageMediaType(contentType) {
	return toImageMediaTypeForTest(contentType);
}
/** 单元测试导出：实现与 toImageMediaType 相同，测试直接调用避免类型依赖循环。 */
function toImageMediaTypeForTest(contentType) {
	const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
	if (ct.includes("png")) return "image/png";
	if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
	if (ct.includes("webp")) return "image/webp";
	if (ct.includes("gif")) return "image/gif";
	return "image/png";
}
/** 从 Content-Type 推断文件扩展名。 */
function extFromContentType(contentType, fallback) {
	const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
	if (ct.includes("png")) return ".png";
	if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
	if (ct.includes("webp")) return ".webp";
	if (ct.includes("gif")) return ".gif";
	if (ct.includes("mp4")) return ".mp4";
	if (ct.includes("quicktime") || ct.includes("mov")) return ".mov";
	return fallback;
}
/**
* 保存图片字节到 attachment 服务，返回可被 presentationMeta 引用的附件引用。
* `attachments` 由调用方保证非 undefined（generate_image 工具经 `ctx.inject` 注入），
* 此处不做运行时回退——依赖关系在调用栈上游即已明确。
*
* 图片不再作为模型可见的 image ContentBlock 注入工具结果：纯文本模型无法接收
* image 块（llm 适配器会序列化成 image_url，网关不支持时 400）。附件引用改为
* 经 `output.presentationMeta` 走 UI-only 通道持久化，对模型不可见。
* @param attachments - attachment 服务实例。
* @param data - 图片字节。
* @param contentType - 图片 Content-Type。
* @param name - 显示名称。
* @returns 持久化后的图片附件引用。
*/
async function saveImageAttachment(attachments, data, contentType, name) {
	const mediaType = toImageMediaType(contentType);
	return attachments.saveImage({
		data,
		mediaType,
		name
	});
}
/**
* 构造模型可见的图片生成摘要文本（纯文本，不含图片字节）。
* 标准输出固定包含：提示词、服务商、**实际使用的模型**、尺寸、提交次数、
* 传输方式、后处理与透明告知——「这张图怎么来的、用了谁、提交了几次、
* 有没有打水印」直接看结果即可，无需查配置或服务商后台。
* @param fields - 生成输出中的展示字段。
* @returns 供工具结果 render 返回的文本块。
*/
function createImageSummaryText(fields) {
	const size = fields.width !== void 0 && fields.height !== void 0 ? `${fields.width}×${fields.height}` : "未知尺寸";
	const model = fields.model && fields.model.length > 0 ? fields.model : "服务商内置默认";
	const mode = fields.mode ? `，模式：${fields.mode === "image-to-image" ? "图生图" : "文生图"}` : "";
	const submit = fields.submitAttempts === void 0 ? "" : `，提交次数：${fields.submitAttempts}`;
	const transport = fields.transport === void 0 ? "" : `，传输：${fields.transport}`;
	const postprocess = fields.postprocess && fields.postprocess.length > 0 ? `，后处理：${fields.postprocess.join(" + ")}` : "";
	const promptBlock = fields.prompt && fields.prompt.length > 0 ? `\n提示词：${fields.prompt}` : "";
	const requestBlock = fields.requestId === void 0 ? "" : `\nrequest_id：${fields.requestId}`;
	const notesBlock = fields.notes && fields.notes.length > 0 ? `\n透明告知：\n${fields.notes.map((note) => `- ${note}`).join("\n")}` : "";
	return [{
		type: "text",
		text: `图片已生成并保存到本地：${fields.localPath}（服务商：${fields.provider}，模型：${model}${mode}，尺寸：${size}，大小：${(fields.bytes / 1024).toFixed(1)} KB${submit}${transport}${postprocess}）${promptBlock}${requestBlock}${notesBlock}`
	}];
}
/**
* 创建视频渲染块。DSH 无原生视频内容块，
* 返回文本块含本地文件路径，供用户点击打开；同时把**提示词、服务商、实际模型、
* 透明告知**写进可见文本，与客户端 keyed toolview 的内嵌播放器（消费
* presentationMeta.localPath/prompt）共同构成固定标准输出：
* 「提示词 + 播放器 + 结果块」，任何人安装插件即可见，无需任何配置。
* @param localPath - 落地文件路径。
* @param bytes - 文件字节数。
* @param sourceUrl - 上游源地址。
* @param details - 展示字段（提示词/服务商/模型/模式/时长/分辨率/透明告知）。
*/
function createVideoContent(localPath, bytes, sourceUrl, details = {}) {
	const sizeKb = (bytes / 1024).toFixed(1);
	const model = details.model && details.model.length > 0 ? details.model : "服务商内置默认";
	const lines = [
		"视频已生成并保存到本地：",
		`- 文件路径：${localPath}`,
		`- 文件大小：${sizeKb} KB`,
		...details.prompt && details.prompt.length > 0 ? [`- 提示词：${details.prompt}`] : [],
		...details.provider ? [`- 服务商：${details.provider}`] : [],
		`- 模型：${model}`,
		...details.mode ? [`- 生成模式：${details.mode}`] : [],
		...details.duration !== void 0 ? [`- 时长参数：${details.duration} 秒`] : [],
		...details.resolution ? [`- 分辨率：${details.resolution}`] : [],
		`- 源地址：${sourceUrl}`
	];
	const notesBlock = details.notes && details.notes.length > 0 ? `\n\n透明告知：\n${details.notes.map((note) => `- ${note}`).join("\n")}` : "";
	return [{
		type: "text",
		text: `${lines.join("\n")}${notesBlock}\n\n请用本地播放器打开上述文件路径查看视频。`
	}];
}
//#endregion
//#region src/runtime-defaults.ts
/** 创建内存态运行时默认值存储。 */
function createRuntimeDefaultsStore() {
	let current = {};
	return {
		get: () => ({ ...current }),
		patch(patch) {
			const next = { ...current };
			for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key];
			else next[key] = value;
			current = next;
			return { ...current };
		},
		reset() {
			current = {};
		}
	};
}
/** 图片风格选项：id 即协议值，label 供下拉 UI 展示；'' = 自动（不拼接后缀）。 */
const IMAGE_STYLE_OPTIONS = [
	{
		id: "",
		label: "自动"
	},
	{
		id: "photo",
		label: "摄影"
	},
	{
		id: "illustration",
		label: "插画"
	},
	{
		id: "3d",
		label: "3D 渲染"
	},
	{
		id: "anime",
		label: "动漫"
	},
	{
		id: "ink",
		label: "水墨"
	}
];
/** 风格 id → 英文提示词后缀（对所有服务商通用：直接拼接进 prompt，不改 API 参数）。 */
const STYLE_SUFFIXES = {
	photo: "photorealistic style, professional photography, high detail",
	illustration: "flat illustration style, clean vector art",
	"3d": "3D render style, octane render, soft studio lighting",
	anime: "anime style, cel shading, vibrant colors",
	ink: "Chinese ink painting style, expressive brush strokes"
};
/**
* 把风格 id 拼接为英文提示词后缀（生成服务端通用做法：对所有 provider 生效）。
* @param prompt - 原始提示词。
* @param style - 风格 id；undefined / '' / 白名单外一律原样返回。
* @returns 实际发给服务商的提示词。
*/
function applyImageStyle(prompt, style) {
	if (style === void 0 || style === "") return prompt;
	const suffix = STYLE_SUFFIXES[style];
	if (suffix === void 0) return prompt;
	const trimmed = prompt.trim();
	if (/[,,，、]$/.test(trimmed)) return `${trimmed} ${suffix}`;
	return `${trimmed}, ${suffix}`;
}
/** 图片尺寸白名单（'宽*高'）；'' 由协议层表示「自动（清除覆盖）」，不在表内。 */
const IMAGE_SIZE_OPTIONS = [
	{
		id: "1:1",
		label: "1:1",
		size: "1024*1024"
	},
	{
		id: "4:3",
		label: "4:3",
		size: "1152*864"
	},
	{
		id: "3:4",
		label: "3:4",
		size: "1152*1536"
	},
	{
		id: "16:9",
		label: "16:9",
		size: "1280*720"
	},
	{
		id: "9:16",
		label: "9:16",
		size: "720*1280"
	}
];
/** 视频宽高比白名单。 */
const VIDEO_ASPECT_RATIOS = [
	"16:9",
	"9:16",
	"1:1"
];
/** 视频时长上下限（与 generate_video 工具的强制规范一致）。 */
const MIN_VIDEO_DURATION = 1;
const MAX_VIDEO_DURATION$1 = 30;
/** 合法服务商清单（与 config.ts 的 Provider 联合一一对应），供协议层白名单校验。 */
const PROVIDERS = [
	"threerouter",
	"wanx",
	"minimax",
	"seedance"
];
/** 值是否为合法服务商（'' / 未知值均拒绝）。 */
function isProvider(value) {
	return PROVIDERS.includes(value);
}
/**
* 模型家族规则：按厂商关键词对显式 model 参数做小写包含匹配，得到该模型的家族
* 候选服务商。维护点按「厂商」而非「模型 id」——新模型（wan3.0、qwen-video、
* minimax 新版本等）自动命中家族规则，无需逐个登记。
*
* 家族事实（2026-09）：threerouter 是聚合器，出所有家族的模型（wan/minimax/seedance
* 及文本/图片模型）；wanx（阿里百炼）、minimax（官方平台，仅视频）、seedance（火山方舟）
* 是家族直连商。规则数组顺序即匹配优先级（更具体的家族在前）。
*/
const MODEL_FAMILY_RULES = [
	{
		family: "minimax",
		keywords: ["minimax", "hailuo"],
		providers: ["minimax", "threerouter"],
		kinds: ["video", "image"]
	},
	{
		family: "seedance",
		keywords: [
			"doubao",
			"seedance",
			"seedream"
		],
		providers: ["seedance", "threerouter"],
		kinds: ["image", "video"]
	},
	{
		family: "wan",
		keywords: ["wan"],
		providers: ["wanx", "threerouter"],
		kinds: ["image", "video"]
	}
];
/**
* 不支持自定义时长的视频模型集合：上游按模型内置档位出片，请求携带 duration 会被
* 原样拒绝（"duration customization is not supported"）。工具层对命中模型丢弃
* duration，并在结果 notes 中透明注明。列表按上游实测维护（2026-09 实测
* wan2.2-t2v-plus 与 wan2.7-t2v 均拒绝；wan3.0-video / wan2.2-i2v-plus 尚未验证，
* 暂保持透传，验证后再入表）。
*/
const VIDEO_DURATION_UNSUPPORTED = /* @__PURE__ */ new Set(["wan2.2-t2v-plus", "wan2.7-t2v"]);
/**
* 未显式指定 resolution 时的模型默认档位：Threerouter 的 MiniMax 系要求请求携带
* resolution（缺失时上游 400），注入默认档位避免默认路径失败；wan 系上游按模型
* 默认处理，无需注入。
*/
const VIDEO_MODEL_DEFAULT_RESOLUTION = {
	"minimax-h3": "768P",
	"MiniMax-H3": "768P"
};
/**
* 支持多关键帧（media[]）的视频模型列表，按优先序排列。
* media 存在且未显式指定模型时自动选择首项；当前只有 wan3.0-video。
* 后续新增模型（如 seedance 多帧支持）直接追加即可。
*/
const MULTI_FRAME_CAPABLE_MODELS = [
	"MiniMax-H3",
	"minimax-h3",
	"wan3.0-video"
];
/**
* 支持参考视频（视频编辑）的视频模型列表，按优先序排列。
* wan3.0-video 是 All-in-One 视频模型：按 `input.media[].type` 与提示词意图自动路由任务类型，
* `reference_video` 素材 + 编辑意图提示词（"替换""改成""去掉"等）即「保留原片构图与动作、
* 只改写指定元素」，因此视频编辑只声明模型名即可，不需要额外的控制参数。
*/
const REFERENCE_VIDEO_CAPABLE_MODELS = ["wan3.0-video"];
/**
* 构建候选服务商序列（工具层按序尝试提交，回退语义见工具实现）：
* ① 配置链服务商（会话选定 > settings 默认 > 激活服务商）——配置优先原则；
* ② 显式 model 参数命中 {@link MODEL_FAMILY_RULES} 时的家族候选（直连商在前）；
* ③ threerouter 聚合器兜底——其目录覆盖所有家族的模型，永远作为最后候选。
* 未配置 key 的候选一律跳过（不会在提交阶段撞「未配置 API Key」）。
* @param kind - 生成类型（minimax 家族仅参与视频候选）。
* @param explicitModel - 工具显式 model 参数；undefined / 空串表示未指定（无家族匹配）。
* @param configChain - 配置链解析出的服务商（可为 undefined）。
* @param hasKey - 判断服务商是否已配置 key（工具层以 peekProviderCredentials 实现）。
* @returns 去重后的候选服务商有序列表；可能为空 = 没有任何已配置凭证（工具层响亮报错）。
*/
function resolveModelCandidates(kind, explicitModel, configChain, hasKey) {
	if (kind === "video") return hasKey("threerouter") ? ["threerouter"] : [];
	const candidates = [];
	const push = (provider) => {
		if (!candidates.includes(provider) && hasKey(provider)) candidates.push(provider);
	};
	if (configChain) push(configChain);
	if (explicitModel) {
		const lower = explicitModel.toLowerCase();
		for (const rule of MODEL_FAMILY_RULES) {
			if (!rule.kinds.includes(kind)) continue;
			if (rule.keywords.some((keyword) => lower.includes(keyword))) {
				for (const provider of rule.providers) push(provider);
				break;
			}
		}
	}
	push("threerouter");
	return candidates;
}
/** defaults 路由路径（exact 匹配；桌面渲染进程同源调用）。 */
const DEFAULTS_ROUTE_PATH = "/image-video/defaults";
/**
* 从插件持久 config 提取 settings 默认值，作为 defaults 路由合并视图的回落层。
* 白名单/范围守卫：服务商须命中 PROVIDERS 白名单（空串 = 跟随激活服务商，不
* 提取）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须 1-10 整数；
* settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用内置默认），
* 避免把非法持久值经合并视图当作生效值回显。
* @param config - 已由 Schemastery 填充默认值的插件配置。
*/
function extractPersistedDefaults(config) {
	const persisted = {};
	if (isProvider(config.defaultImageProvider)) persisted.imageProvider = config.defaultImageProvider;
	if (IMAGE_SIZE_OPTIONS.some((option) => option.size === config.defaultImageSize)) persisted.imageSize = config.defaultImageSize;
	if (isProvider(config.defaultVideoProvider)) persisted.videoProvider = config.defaultVideoProvider;
	if (Number.isInteger(config.defaultVideoDuration) && config.defaultVideoDuration >= MIN_VIDEO_DURATION && config.defaultVideoDuration <= MAX_VIDEO_DURATION$1) persisted.videoDuration = config.defaultVideoDuration;
	return persisted;
}
/**
* 合并为响应视图：运行时覆盖优先，缺失回落 settings 持久默认，两者皆无 → null。
* 风格与视频比例是纯运行时概念（settings 无对应持久字段），始终取覆盖层。
*/
function toView(defaults, persisted) {
	return {
		imageProvider: defaults.imageProvider ?? persisted.imageProvider ?? null,
		imageSize: defaults.imageSize ?? persisted.imageSize ?? null,
		imageStyle: defaults.imageStyle ?? null,
		videoProvider: defaults.videoProvider ?? persisted.videoProvider ?? null,
		videoAspectRatio: defaults.videoAspectRatio ?? null,
		videoDuration: defaults.videoDuration ?? persisted.videoDuration ?? null
	};
}
/**
* 校验并归一化 POST body 为存储 patch。严格协议：仅接受六个已知键；
* null 清除覆盖；'' 表示「自动」（归一化为 null）；其余值按字段白名单/范围校验。
* @param body - 已 JSON.parse 的请求体（可能是任意值）。
* @returns 归一化后的 patch；校验失败返回错误信息（字符串）。
*/
function parseDefaultsPatch(body) {
	if (typeof body !== "object" || body === null || Array.isArray(body)) return {
		ok: false,
		error: "请求体必须是 JSON 对象"
	};
	const record = body;
	const KNOWN_KEYS = [
		"imageProvider",
		"imageSize",
		"imageStyle",
		"videoProvider",
		"videoAspectRatio",
		"videoDuration"
	];
	for (const key of Object.keys(record)) if (!KNOWN_KEYS.includes(key)) return {
		ok: false,
		error: `未知字段: ${key}`
	};
	const patch = {};
	for (const key of KNOWN_KEYS) {
		const value = record[key];
		if (value === void 0) continue;
		if (value === null || value === "") {
			patch[key] = null;
			continue;
		}
		if (key === "imageProvider" || key === "videoProvider") {
			if (typeof value !== "string" || !isProvider(value)) return {
				ok: false,
				error: `${key} 必须是 ${PROVIDERS.join(" / ")} 之一`
			};
			patch[key] = value;
			continue;
		}
		if (key === "imageSize") {
			if (typeof value !== "string" || !IMAGE_SIZE_OPTIONS.some((option) => option.size === value)) return {
				ok: false,
				error: `imageSize 必须是白名单尺寸之一: ${IMAGE_SIZE_OPTIONS.map((o) => o.size).join(" / ")}`
			};
			patch[key] = value;
			continue;
		}
		if (key === "imageStyle") {
			if (typeof value !== "string" || !IMAGE_STYLE_OPTIONS.some((option) => option.id === value && option.id !== "")) return {
				ok: false,
				error: `imageStyle 必须是白名单风格之一: ${IMAGE_STYLE_OPTIONS.filter((o) => o.id !== "").map((o) => o.id).join(" / ")}`
			};
			patch[key] = value;
			continue;
		}
		if (key === "videoAspectRatio") {
			if (typeof value !== "string" || !VIDEO_ASPECT_RATIOS.includes(value)) return {
				ok: false,
				error: `videoAspectRatio 必须是 ${VIDEO_ASPECT_RATIOS.join(" / ")} 之一`
			};
			patch[key] = value;
			continue;
		}
		if (typeof value !== "number" || !Number.isInteger(value) || value < MIN_VIDEO_DURATION || value > MAX_VIDEO_DURATION$1) return {
			ok: false,
			error: `videoDuration 必须是 ${MIN_VIDEO_DURATION}-${MAX_VIDEO_DURATION$1} 的整数秒`
		};
		patch[key] = value;
	}
	return {
		ok: true,
		patch
	};
}
/**
* 创建 defaults 路由 handler。GET 返回「运行时覆盖 ?? settings 持久默认」合并
* 视图；POST 校验写入并返回合并视图；非 GET/POST 405；请求体不可解析或校验
* 失败 400。
* @param store - 运行时默认值存储。
* @param persisted - settings 持久默认回落层（{@link extractPersistedDefaults}
*   提取；未提供时用空对象，即不回落）。
*/
function createDefaultsRouteHandler(store, persisted = {}) {
	return async (req, res) => {
		const sendJson = (status, payload) => {
			res.writeHead(status, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store"
			});
			res.end(JSON.stringify(payload));
		};
		if (req.method === "GET") {
			sendJson(200, toView(store.get(), persisted));
			return;
		}
		if (req.method !== "POST") {
			res.writeHead(405, { Allow: "GET, POST" });
			res.end();
			return;
		}
		const chunks = [];
		const body = await new Promise((resolve) => {
			req.on("data", (chunk) => chunks.push(chunk));
			req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
			req.on("error", () => resolve(""));
		});
		let parsed;
		try {
			parsed = body === "" ? void 0 : JSON.parse(body);
		} catch {
			sendJson(400, { error: "请求体不是合法 JSON" });
			return;
		}
		const result = parseDefaultsPatch(parsed);
		if (!result.ok) {
			sendJson(400, { error: result.error });
			return;
		}
		sendJson(200, toView(store.patch(result.patch), persisted));
	};
}
/**
* 把 defaults 路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时返回
* undefined 且不注册——运行时覆盖值属本机会话状态，不暴露到局域网。
* @param webServer - webServer 服务实例（结构类型，见 media-route.ts）。
* @param store - 运行时默认值存储。
* @param persisted - settings 持久默认回落层（同 {@link createDefaultsRouteHandler}）。
* @returns 路由注销函数；未注册返回 undefined。
*/
function registerDefaultsRoute(webServer, store, persisted = {}) {
	if (webServer.host !== "127.0.0.1") return void 0;
	return webServer.register({
		kind: "exact",
		path: DEFAULTS_ROUTE_PATH,
		handler: createDefaultsRouteHandler(store, persisted)
	});
}
//#endregion
//#region src/task-manager.ts
/** 连续查询失败阈值：超过即认为轮询链路已断，交回上层收口（任务仍在服务端）。 */
const MAX_CONSECUTIVE_QUERY_FAILURES = 5;
/**
* 任务管理器：管理所有进行中的生成任务轮询。
* 在 apply() 中实例化，通过 ctx.effect 注册卸载清理。
*/
var TaskManager = class {
	/** 进行中的任务，key 为 taskId。 */
	active = /* @__PURE__ */ new Map();
	/** 配置引用。 */
	config;
	constructor(ctx, config) {
		this.config = config;
		ctx.effect(() => () => {
			for (const task of this.active.values()) task.controller.abort();
			this.active.clear();
		});
	}
	/**
	* 轮询任务直到完成、失败或超时。
	* 使用 AbortSignal 支持外部取消（插件卸载或工具调用超时）。
	* 轮询过程中不产生中间输出，仅最终结果返回给模型，不阻塞对话上下文。
	* @param taskId - 服务商返回的任务 ID。
	* @param query - 查询实现：适配器实例（用其 queryTask）或直接的查询函数。
	* @param httpOpts - HTTP 请求选项（含凭证与超时）。
	* @param externalSignal - 外部取消信号（工具执行上下文的 exec.signal）。
	* @returns 媒体 URL 与耗时。
	* @throws {GenerationError} 任务失败、超时或被取消（超时错误带 task_id）。
	*/
	async pollUntilDone(taskId, query, httpOpts, externalSignal) {
		const controller = new AbortController();
		const startTime = Date.now();
		const queryFn = typeof query === "function" ? query : (id, opts) => query.queryTask(id, opts);
		const onExternalAbort = () => controller.abort();
		externalSignal?.addEventListener("abort", onExternalAbort);
		const task = {
			controller,
			taskId,
			label: `${httpOpts.baseURL}#${taskId}`
		};
		this.active.set(taskId, task);
		try {
			const deadline = startTime + this.config.pollTimeoutMs;
			let consecutiveFailures = 0;
			while (Date.now() < deadline) {
				if (controller.signal.aborted) throw new GenerationError("timeout", "生成任务已被取消", false);
				const httpOptsWithSignal = {
					...httpOpts,
					timeoutMs: Math.min(httpOpts.timeoutMs, 3e4),
					signal: controller.signal
				};
				let result;
				try {
					result = await queryFn(taskId, httpOptsWithSignal);
					consecutiveFailures = 0;
				} catch (err) {
					if (controller.signal.aborted) throw err;
					if (!this.isTransientQueryError(err)) throw err;
					consecutiveFailures += 1;
					if (consecutiveFailures >= MAX_CONSECUTIVE_QUERY_FAILURES) throw new GenerationError("timeout", `查询图片/视频任务状态连续失败 ${consecutiveFailures} 次（task_id=${taskId}）：${err instanceof Error ? err.message : String(err)}。任务未丢失，可用 request_id 稍后找回`, false);
					await this.sleep(this.config.pollIntervalMs, controller.signal);
					continue;
				}
				if (result.status === "succeeded") return {
					mediaUrl: result.mediaUrl,
					elapsedMs: Date.now() - startTime
				};
				if (result.status === "failed") throw new GenerationError("task", result.error, false);
				await this.sleep(this.config.pollIntervalMs, controller.signal);
			}
			throw new GenerationError("timeout", `生成任务轮询超时（${this.config.pollTimeoutMs}ms）：task_id=${taskId} 仍在服务端执行/缓存，本次不重新提交（避免重复扣费），可稍后用 request_id 找回`, false);
		} finally {
			this.active.delete(taskId);
			externalSignal?.removeEventListener("abort", onExternalAbort);
		}
	}
	/** 获取当前进行中的任务数，供状态展示。 */
	get activeCount() {
		return this.active.size;
	}
	/**
	* 判定查询阶段的错误是否属于「瞬时故障、值得继续轮询」。
	* 可重试分类（网络/超时/5xx/限流）与不可重试的鉴权/参数错误区分开：
	* 后者继续轮询只会白等，立即抛出。
	*/
	isTransientQueryError(err) {
		if (!(err instanceof GenerationError)) return true;
		if (err.retryable) return true;
		if (err.status !== void 0 && err.status >= 500) return true;
		return false;
	}
	/** 可被取消的延时；信号触发时立即 reject。 */
	sleep(ms, signal) {
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(new GenerationError("timeout", "生成任务已被取消", false));
				return;
			}
			const timer = setTimeout(resolve, ms);
			signal.addEventListener("abort", () => {
				clearTimeout(timer);
				reject(new GenerationError("timeout", "生成任务已被取消", false));
			}, { once: true });
		});
	}
};
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-attachment@0.1.1-rc.2_@deepseek-ai+cordis@4.0.1_@deepseek-ai+dsh-brand_75c4d5bd4bb11efc15437276d91208a8/node_modules/@deepseek-ai/dsh-attachment/lib/index.js
/** Attachment identifier brand. @module @deepseek-ai/dsh-attachment/brand */
/**
* Brand a validated storage identifier.
* @param value - backend-produced opaque identifier.
* @returns the branded identifier.
*/
function AttachmentId(value) {
	return value;
}
//#endregion
//#region src/watermark.ts
/**
* 品牌水印后处理（正式实现，非临时脚本）。
*
* 位置：图片生成流程的**后处理阶段**——模型原始字节下载到内存后、写入 outputs/
* 与 attachment 之前完成合成。因此：
*   - 磁盘上只有一份文件（最终图），不存在「原图 + 水印图」两份产物；
*   - 交互流展示的附件与文件是同一份字节，用户看到的就是最终结果；
*   - 不依赖工作目录、不需要任何外部脚本或 Python 环境。
*
* 合成方式：sharp 把一段 SVG 合到原图上（librsvg 负责文字栅格化）。
* 语义要点：
*   - 尺寸全部按图片宽度/高度的**比例**表达，同一套配置对任意尺寸出图观感一致；
*   - 右下角（默认）与四角位置均支持，左右用 text-anchor 对齐、上下用基线偏移；
*   - 文字过宽（超窄图）时自动缩号，保证水印不会横向溢出画面；
*   - 失败**开放**：水印是装饰性后处理，任何异常都不能让用户的付费结果丢失，
*     因此失败时原样返回模型原图并回报原因。
* @module dsh-image-video/watermark
*/
/**
* 给图片加品牌水印。
* @param data - 模型返回的原始图片字节。
* @param contentType - 原始 MIME 类型（决定输出编码，保持与上游一致的格式）。
* @param config - 水印配置（enabled=false 时直接原样返回）。
* @returns 处理结果（含 applied / note，供结果层如实告知）。
*/
async function applyImageWatermark(data, contentType, config) {
	if (!config.enabled) return {
		data,
		contentType,
		applied: false,
		note: "品牌水印已在配置中关闭（watermark.enabled=false）"
	};
	const text = config.text.trim();
	if (text === "") return {
		data,
		contentType,
		applied: false,
		note: "品牌水印文本为空，已跳过水印后处理"
	};
	try {
		const image = sharp(data).rotate();
		const meta = await image.metadata();
		const width = meta.width ?? 0;
		const height = meta.height ?? 0;
		if (width <= 0 || height <= 0) return {
			data,
			contentType,
			applied: false,
			note: "品牌水印未合成：无法读取图片尺寸（格式异常），已保留模型原图"
		};
		const svg = buildWatermarkSvg(width, height, text, config);
		const composited = image.composite([{
			input: Buffer.from(svg),
			blend: "over"
		}]);
		const normalized = contentType.toLowerCase();
		const output = normalized.includes("png") ? await composited.png().toBuffer() : normalized.includes("webp") ? await composited.webp({ quality: 95 }).toBuffer() : await composited.jpeg({ quality: 95 }).toBuffer();
		return {
			data: new Uint8Array(output),
			contentType: normalized.includes("png") ? "image/png" : normalized.includes("webp") ? "image/webp" : "image/jpeg",
			applied: true
		};
	} catch (err) {
		return {
			data,
			contentType,
			applied: false,
			note: `品牌水印未合成（${err instanceof Error ? err.message : String(err)}），已保留模型原图`
		};
	}
}
/**
* 构造水印 SVG。导出供单测直接断言坐标/字号等几何决策，无需真的解码图片。
* @param width - 图片宽度（像素）。
* @param height - 图片高度（像素）。
* @param text - 水印文字（已 trim，非空）。
* @param config - 水印配置。
*/
function buildWatermarkSvg(width, height, text, config) {
	const marginX = Math.max(4, Math.round(width * config.marginXRatio));
	const marginY = Math.max(4, Math.round(height * config.marginYRatio));
	const fontSize = fitFontSize(text, width, marginX, config.fontSizeRatio);
	const letterSpacing = Math.max(1, Math.round(fontSize * .08));
	const right = config.position.endsWith("right");
	const bottom = config.position.startsWith("bottom");
	const x = right ? width - marginX : marginX;
	const y = bottom ? Math.max(fontSize, height - marginY - Math.round(fontSize * .18)) : marginY + fontSize;
	const anchor = right ? "end" : "start";
	const escaped = escapeXml(text);
	const glowStd = Math.max(1, fontSize * config.glowBlurRatio);
	return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs>${config.glowEnabled ? `<filter id="wm-glow" x="-50%" y="-150%" width="200%" height="400%"><feGaussianBlur stdDeviation="${glowStd.toFixed(2)}"/></filter>` : ""}</defs>${config.glowEnabled ? `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${config.glowColor}" opacity="${clamp01(config.opacity * .72)}" filter="url(#wm-glow)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="${fontSize}px" font-weight="500" letter-spacing="${letterSpacing}px">${escaped}</text>` : ""}${`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#ffffff" opacity="${clamp01(config.opacity)}" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="${fontSize}px" font-weight="500" letter-spacing="${letterSpacing}px">${escaped}</text>`}</svg>`;
}
/**
* 计算字号：基准为 `宽度 × fontSizeRatio`，并保证估算文字宽度不超过
* 可用宽度（图片宽度减两侧留白）的 95%，避免窄图上水印横向溢出。
* @param text - 水印文字。
* @param width - 图片宽度。
* @param marginX - 单侧水平留白。
* @param fontSizeRatio - 字号占图片宽度的比例。
* @returns 最终字号（像素，至少 10px）。
*/
function fitFontSize(text, width, marginX, fontSizeRatio) {
	const base = Math.max(10, Math.round(width * fontSizeRatio));
	const available = Math.max(1, width - marginX * 2);
	if (text.length * base * .7 <= available * .95) return base;
	const scaled = Math.floor(available * .95 / (text.length * .7));
	return Math.max(10, scaled);
}
/** 把 [0,1] 之外的值收敛回区间（配置已由 schema 校验，此处防御脏值）。 */
function clamp01(value) {
	if (!Number.isFinite(value)) return .68;
	return Math.min(1, Math.max(0, value));
}
/** XML 转义：水印文字来自配置，仍需防止破坏 SVG 结构。 */
function escapeXml(value) {
	return value.replace(/[<>&'"]/g, (char) => char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === "&" ? "&amp;" : char === "'" ? "&apos;" : "&quot;");
}
//#endregion
//#region src/image-transaction.ts
/** 创建事务账本。 */
function createImageTransaction(input) {
	return {
		requestId: input.requestId,
		provider: input.provider,
		model: input.model,
		transport: input.transport,
		status: "idle",
		submitAttempts: 0,
		recoveryLookups: 0
	};
}
/** 提交预算上限：默认 1；同键重提策略下允许 2（第二次必须复用同一个幂等键）。 */
function submitBudget(options) {
	return options?.allowSameKeyRetry === true ? 2 : 1;
}
/**
* 消费一次提交预算。达到上限后再次调用一律抛错——这是「一次请求只生成一张」
* 的硬闸门：任何异常路径都不可能在同一个事务里再发一次新的计费请求。
* @throws {GenerationError} 当本事务已用尽提交预算。
*/
function consumeSubmitBudget(tx, options) {
	if (tx.submitAttempts >= submitBudget(options)) throw new GenerationError("task", "dsh-image-video：本次生成事务已提交过一次生图请求，拒绝重复提交（防止重复扣费）", false);
	tx.submitAttempts += 1;
	tx.status = "submitting";
	tx.submitStartedAt = Date.now();
}
/** 标记提交阶段结束（成功或失败都会调用，供结果元数据展示耗时）。 */
function finishSubmit(tx) {
	tx.submitFinishedAt = Date.now();
}
/**
* 判定当前失败是否允许回退到**下一个候选服务商**。
*
* 与 `isModelNotAcceptedError` 的区别在于多了一层事务状态门：
* - 状态必须停在 `failed`——即服务端明确表示「没有创建任务」；
*   状态为 `unknown` 时绝不换家（否则可能两家各生成一张、各扣一次费）。
* - 提交次数必须恰好为 1（未被同键重提污染）。
* - 5xx 只有实证的「无可用渠道」形态才允许换家：网关按模型查渠道发生在调用上游
*   之前，无渠道即无任务；其余 5xx 一律视为未知状态。
* @param err - 提交抛出的错误。
* @param tx - 当前事务账本。
* @returns 是否允许换下一个候选服务商。
*/
function canFallbackToNextProvider(err, tx) {
	if (tx.status !== "failed") return false;
	if (tx.submitAttempts !== 1) return false;
	if (isCancelledError(err)) return false;
	if (isIdempotencyConflictError(err)) return false;
	if (!isModelNotAcceptedError(err)) return false;
	if (err instanceof GenerationError && err.status !== void 0 && err.status >= 500) return /no available media generation channels|capacity_error/i.test(err.message);
	return true;
}
/** 导出事务摘要（缺省字段不出现在结果里，避免噪音）。 */
function reportTransaction(tx) {
	return {
		requestId: tx.requestId,
		transport: tx.transport,
		submitAttempts: tx.submitAttempts,
		recoveryLookups: tx.recoveryLookups,
		status: tx.status,
		...tx.taskId === void 0 ? {} : { taskId: tx.taskId },
		...tx.replayed === void 0 ? {} : { replayed: tx.replayed },
		...tx.degraded === void 0 ? {} : { degraded: tx.degraded }
	};
}
/**
* 构造「提交状态未知」错误。文案必须做到三件事：说清事实（可能已在计费）、
* 说清客户端已经做了什么（按幂等键查过了、没查到）、给可执行的下一步
* （凭 requestId 找回，或用户明确要求后重试）。
*/
function unknownStateError(tx, cause) {
	const causeText = cause instanceof Error ? cause.message : String(cause);
	return new GenerationError("timeout", `图片请求已提交但客户端未收到结果（提交状态未知）。为避免重复扣费，本次不会自动重新生成，也不会自动换模型。已按幂等键反查 ${String(tx.recoveryLookups)} 次，未查到对应任务。request_id=${tx.requestId}（服务端保留 24 小时，可用 generate_image 的 recoverRequestId 参数找回）。原始错误：${causeText}`, false);
}
/**
* 执行图片生成事务：**最多一次提交**，提交后轮询结果；提交结果未知时凭幂等键
* 找回原任务，而不是重新生成。
*
* 分支与依据（服务端 HTTP 契约表）：
* - 202 接受 → 轮询 `task_id`；`X-Idempotency-Replayed` 为真表示本次未新建任务。
* - 409 `IDEMPOTENCY_IN_PROGRESS` → 任务已存在 → 按 Retry-After 等一下再反查。
* - 409 `IDEMPOTENCY_KEY_CONFLICT` → 幂等键被复用于不同请求体（客户端 bug）→ 响亮失败。
* - 404 异步端点不可用 → 抛 {@link AsyncTransportUnavailableError}，由调用方降级同步
*   （服务端在创建任务前返回，降级不会重复生成）。
* - 4xx 其他（400/401/403/413/429）→ 明确没建任务 → 状态置 `failed`，允许换候选。
* - 超时 / 断连 / 5xx → 状态置 `unknown` → 反查；查到就继续等，查不到按策略处理。
*
* @returns 提交结果与最终使用的传输方式。
* @throws {AsyncTransportUnavailableError} 异步端点在本环境不可用（请降级同步）。
* @throws {GenerationError} 其他分类错误；`tx.status` 反映是否允许换候选。
*/
async function runImageTransaction(deps) {
	const { tx, adapter, params, httpOpts } = deps;
	const note = deps.onNote ?? (() => {});
	const api = adapter.imageAsync;
	if (tx.transport === "async" && api === void 0) throw new GenerationError("task", `服务商 ${tx.provider} 不支持异步图片传输（缺少 imageAsync 能力）`, false);
	if (tx.transport === "sync" || api === void 0) return await runSyncAttempt(deps);
	let accepted;
	try {
		accepted = await submitAsyncOnce(tx, api, params, httpOpts, note);
	} catch (err) {
		return await handleSubmitFailure(deps, err);
	}
	if (accepted === void 0) throw new GenerationError("task", "生图事务内部错误：提交结果缺失", false);
	const mediaUrl = await awaitTask(deps, accepted.taskId);
	tx.status = "succeeded";
	return {
		submit: {
			taskId: accepted.taskId,
			async: false,
			mediaUrl,
			mediaType: "image",
			...accepted.model === void 0 ? {} : { model: accepted.model }
		},
		transport: "async"
	};
}
/**
* 提交失败后的分流：明确没建任务的错误直接抛出（允许换候选），
* 状态未知的错误先凭幂等键反查原任务，绝不重提。
* @returns 找回成功时的事务结果。
* @throws {AsyncTransportUnavailableError} 异步端点不可用（调用方降级同步）。
* @throws {GenerationError} 分类后的失败；`tx.status` 标明是否允许换候选。
*/
async function handleSubmitFailure(deps, err) {
	const { tx } = deps;
	const note = deps.onNote ?? (() => {});
	if (isCancelledError(err)) {
		tx.status = "unknown";
		throw err;
	}
	if (isIdempotencyConflictError(err)) {
		tx.status = "failed";
		throw new GenerationError("task", `生图提交被服务端拒绝：幂等键被用于不同请求体（request_id=${tx.requestId}）。这是客户端事务 ID 复用问题，请把该 request_id 提供给插件维护者排查`, false, err instanceof GenerationError ? err.status : void 0, void 0, err instanceof GenerationError ? err.code : void 0);
	}
	if (isAsyncImageUnavailableError(err)) {
		tx.status = "failed";
		tx.degraded = true;
		throw new AsyncTransportUnavailableError(err instanceof Error ? err.message : String(err));
	}
	if (isIdempotencyInProgressError(err)) {
		tx.status = "unknown";
		const retryAfterMs = err instanceof GenerationError ? err.retryAfterMs : void 0;
		note("服务端报告同一幂等键的提交仍在进行中：任务已存在，改为凭 request_id 找回原任务（不重新生成）");
		return await recoverResult(deps, err, retryAfterMs);
	}
	if (isDefinitelyNoTaskError(err)) {
		tx.status = "failed";
		throw err;
	}
	tx.status = "unknown";
	note("提交结果未知（超时/断连/5xx）：不重新提交、不换模型，先凭 request_id 反查原任务");
	return await recoverResult(deps, err);
}
/**
* 凭幂等键找回原任务：查到就继续轮询它（不产生新的生成请求），查不到按策略处理。
*
* 404 有两重含义（服务端契约）：该键无记录，**或**记录仍在进行中、响应体尚未落库——
* 因此必须按预算重试若干次再下结论，不能一次 404 就断定任务不存在。
* @throws {GenerationError} 找回无果且策略为 fail 时的「状态未知」错误。
*/
async function recoverResult(deps, cause, firstDelayMs) {
	const { tx, httpOpts } = deps;
	const note = deps.onNote ?? (() => {});
	const sleep = deps.sleep ?? defaultSleep;
	const api = deps.adapter.imageAsync;
	if (api === void 0) throw unknownStateError(tx, cause);
	let delay = firstDelayMs ?? deps.recovery.delayMs;
	for (let attempt = 0; attempt < deps.recovery.attempts; attempt++) {
		await sleep(delay, httpOpts.signal);
		tx.recoveryLookups += 1;
		let found;
		try {
			found = await api.findByRequest(tx.requestId, httpOpts);
		} catch (lookupErr) {
			note(`按 request_id 反查失败（第 ${String(tx.recoveryLookups)} 次）：${lookupErr instanceof Error ? lookupErr.message : String(lookupErr)}`);
			delay = deps.recovery.delayMs;
			continue;
		}
		if (found !== void 0) {
			tx.taskId = found.taskId;
			tx.status = "accepted";
			note(`已凭 request_id 找回原任务 ${found.taskId}：继续等待该任务结果，未产生新的生成请求`);
			const mediaUrl = await awaitTask(deps, found.taskId);
			tx.status = "succeeded";
			return {
				submit: {
					taskId: found.taskId,
					async: false,
					mediaUrl,
					mediaType: "image",
					...tx.model === void 0 ? {} : { model: tx.model }
				},
				transport: "async"
			};
		}
		delay = deps.recovery.delayMs;
	}
	if (deps.unknownStatePolicy === "resubmit-same-key" && tx.submitAttempts < submitBudget({ allowSameKeyRetry: true })) {
		note("反查无果且策略允许：用同一个幂等键重新提交（服务端按键去重，不会重复生成）");
		let accepted;
		try {
			accepted = await submitAsyncOnce(tx, api, deps.params, httpOpts, note, { allowSameKeyRetry: true });
		} catch (resubmitErr) {
			tx.status = "unknown";
			throw unknownStateError(tx, resubmitErr);
		}
		const mediaUrl = await awaitTask(deps, accepted.taskId);
		tx.status = "succeeded";
		return {
			submit: {
				taskId: accepted.taskId,
				async: false,
				mediaUrl,
				mediaType: "image",
				...accepted.model === void 0 ? {} : { model: accepted.model }
			},
			transport: "async"
		};
	}
	throw unknownStateError(tx, cause);
}
/**
* 轮询任务直到有结果。走到这里任务已确定存在（有 taskId），因此失败不再涉及
* 「是否重复生成」：只需把任务句柄带进错误，供用户稍后找回或直接判定任务失败。
*/
async function awaitTask(deps, taskId) {
	try {
		return (await deps.poll(taskId, deps.httpOpts.signal)).mediaUrl;
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		if (err instanceof GenerationError && err.kind === "task") {
			deps.tx.status = "failed";
			throw new GenerationError("task", `图片任务执行失败：${detail}（task_id=${taskId}，request_id=${deps.tx.requestId}；本次只提交过一次，不会自动重新生成）`, false);
		}
		deps.tx.status = "failed";
		throw new GenerationError("timeout", `图片任务已创建（task_id=${taskId}，request_id=${deps.tx.requestId}）但客户端未等到结果：${detail}。任务仍在服务端执行/缓存，可直接用 recoverRequestId 找回，无需重新生成`, false);
	}
}
/**
* 消费提交预算并执行一次异步提交。服务端 202 即代表任务已落库，
* 因此 `tx.taskId` 在此刻成为确定事实。
*/
async function submitAsyncOnce(tx, api, params, httpOpts, note, options) {
	consumeSubmitBudget(tx, options);
	try {
		const accepted = await api.submit(params, httpOpts);
		tx.taskId = accepted.taskId;
		tx.status = "accepted";
		if (accepted.replayed === true) {
			tx.replayed = true;
			note(`服务端幂等回放：本次没有新建任务，直接复用原任务 ${accepted.taskId}`);
		}
		return {
			taskId: accepted.taskId,
			...accepted.model === void 0 ? {} : { model: accepted.model }
		};
	} finally {
		finishSubmit(tx);
	}
}
/**
* 同步传输分支：调适配器的同步提交（内部强制 `retryTimes: 0`），拿到结果或任务句柄。
* 同步端点没有幂等键记录，因此未知状态一律直接失败——**绝不重提**。
*/
async function runSyncAttempt(deps) {
	const { tx, adapter, params, httpOpts } = deps;
	const note = deps.onNote ?? (() => {});
	consumeSubmitBudget(tx);
	let submit;
	try {
		submit = await adapter.submitImage(params, {
			...httpOpts,
			retryTimes: 0
		});
		tx.status = "accepted";
		if (submit.async && submit.taskId !== "") tx.taskId = submit.taskId;
		finishSubmit(tx);
	} catch (err) {
		finishSubmit(tx);
		if (isCancelledError(err)) {
			tx.status = "unknown";
			throw err;
		}
		if (isDefinitelyNoTaskError(err)) {
			tx.status = "failed";
			throw err;
		}
		if (isModelNotAcceptedError(err) && !isUnknownSubmitStateError(err)) {
			tx.status = "failed";
			throw err;
		}
		if (isModelNotAcceptedError(err)) {
			tx.status = "failed";
			throw err;
		}
		tx.status = "unknown";
		throw new GenerationError("timeout", `同步图片请求已提交但客户端未收到结果（提交状态未知）。同步端点没有幂等键记录，为避免重复扣费，本次不会自动重新生成，也不会自动换模型。request_id=${tx.requestId}。原始错误：${err instanceof Error ? err.message : String(err)}`, false);
	}
	if (submit.async && submit.taskId !== "") {
		note(`服务商同步端点返回了异步任务形态，改为轮询任务 ${submit.taskId}`);
		const mediaUrl = await awaitTask(deps, submit.taskId);
		tx.status = "succeeded";
		return {
			submit: {
				...submit,
				async: false,
				mediaUrl
			},
			transport: "sync"
		};
	}
	if (submit.mediaBase64 === void 0 && (submit.mediaUrl === void 0 || submit.mediaUrl === "")) {
		tx.status = "failed";
		throw new GenerationError("task", "生成失败：服务端既未返回图片 URL 也未返回图片数据", false);
	}
	tx.status = "succeeded";
	return {
		submit,
		transport: "sync"
	};
}
/** 异步图片传输在本环境不可用（功能未开启 / 分组平台不支持）：调用方应降级同步。 */
var AsyncTransportUnavailableError = class extends GenerationError {
	constructor(detail) {
		super("task", `异步图片端点在本环境不可用（${detail}）。将降级为同步单次提交：同步路径没有幂等键记录，因此客户端不会自动重试，也不会在提交超时后重新生成`, false, 404, void 0, CODE_ASYNC_UNAVAILABLE);
		this.name = "AsyncTransportUnavailableError";
	}
};
/** 异步端点不可用的错误码（工具层据此决定降级）。 */
const CODE_ASYNC_UNAVAILABLE = "ASYNC_IMAGE_UNAVAILABLE";
/** 可被取消的等待。 */
function defaultSleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new GenerationError("timeout", "任务已被取消", false));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new GenerationError("timeout", "任务已被取消", false));
		}, { once: true });
	});
}
/** 传输能力探测缓存有效期：服务端上线/开启对象存储后自动恢复，无需重启客户端。 */
const TRANSPORT_PROBE_TTL_MS = 6e5;
/** 默认找回预算：5 次、间隔 5 秒（服务端提交响应通常秒级落库）。 */
const DEFAULT_RECOVERY_BUDGET = {
	attempts: 5,
	delayMs: 5e3
};
/**
* 依据配置与探测缓存决定本次调用的传输方式。
* - `sync`：强制同步（无幂等，仅单次提交保障）。
* - `async`：强制异步；端点不可用时响亮失败（上线验收用这个口径）。
* - `auto`：优先异步，服务商不支持或近期探测到不可用时降级同步。
*/
function resolveImageTransport(configured, adapter, probe, now = Date.now()) {
	if (configured === "sync") return "sync";
	if (adapter.imageAsync === void 0) return "sync";
	if (configured === "async") return "async";
	if (probe !== void 0 && probe.unavailableUntil > now) return "sync";
	return "async";
}
//#endregion
//#region src/image-preflight.ts
/** 尺寸写法白名单：宽*高 / 宽x高 / 比例 / 常见档位别名。 */
const SIZE_PATTERN = /^(?:\d+[*xX]\d+|\d+:\d+|\d+K|auto)$/i;
/**
* 视频模型特征：`t2v` / `i2v` / `v2v` / `flf2v` / 独立 `video` 词段。
* 只匹配**分段**出现（横杠/下划线/点号分隔），避免误伤 `wide-video-editing`
* 之类含子串的图片模型名。
*/
const VIDEO_MODEL_PATTERN = /(?:^|[-_.])(?:t2v|i2v|v2v|flf2v|video)(?:[-_.]|$)/i;
/**
* 执行调用前预检查。任何**确定无法成功**的输入在这里直接失败，绝不带着错误
* 参数去打一次真金白银的生成请求。
* @param input - 已解析的调用决策。
* @returns 预检查结论。
* @throws {GenerationError} 尺寸写法无法识别、模型明显是视频模型、异步传输不被支持。
*/
function resolveImagePreflight(input) {
	const { provider, model, size, config } = input;
	const trimmedSize = size.trim();
	if (trimmedSize === "") throw new GenerationError("task", "生图参数错误：尺寸为空。请给出 宽*高（如 1024*1024）、比例（如 3:4）或 1K/2K/auto", false);
	if (!SIZE_PATTERN.test(trimmedSize)) throw new GenerationError("task", `生图参数错误：无法识别的尺寸写法「${trimmedSize}」。支持 宽*高（1024*1024）、宽x高（1024x1024）、比例（3:4）或 1K/2K/4K/auto`, false);
	if (model !== void 0 && model.trim() !== "" && looksLikeVideoModel(model, config)) throw new GenerationError("task", `生图参数错误：模型「${model}」是视频模型（或等于配置 defaultVideoModel=${config.defaultVideoModel}），不能用于 generate_image。生图请用图片模型（如 qwen-image-3.0 / qwen-image-3.0-pro），或修正配置中的 defaultImageModel`, false);
	if (input.transport === "async" && !input.adapterSupportsAsync) throw new GenerationError("task", `生图配置错误：服务商 ${provider} 不支持异步图片传输，但 imageTransport=async 要求它。可改用 threerouter（唯一实现异步图片网关的服务商），或把 imageTransport 改为 auto/sync`, false);
	return {
		provider,
		model: model === void 0 || model.trim() === "" ? void 0 : model,
		size: trimmedSize,
		mode: input.hasReferenceImage ? "image-to-image" : "text-to-image",
		transport: input.transport,
		watermark: {
			enabled: config.watermark.enabled,
			text: config.watermark.text
		}
	};
}
/**
* 模型名是否明显属于视频模型。命中条件之一即可，且**显式配置优先**：
* 当用户把 defaultImageModel 明确设成该名字时不再拦截（用户的显式选择胜过启发式）。
* @param model - 模型名。
* @param config - 插件配置。
* @returns 是否判定为视频模型。
*/
function looksLikeVideoModel(model, config) {
	const name = model.trim();
	if (name === "") return false;
	const explicitImageModel = config.defaultImageModel.trim();
	if (explicitImageModel !== "" && name === explicitImageModel) return false;
	const videoModel = config.defaultVideoModel.trim();
	if (videoModel !== "" && name === videoModel) return true;
	return VIDEO_MODEL_PATTERN.test(name);
}
/**
* 把预检查结论格式化为一行透明告知，写进工具结果 notes：
* 「本次用了谁、什么模型、什么尺寸、走哪条传输、要不要打水印」一句话说完，
* 用户不必查配置或翻服务商后台。
*/
function formatPreflightNote(preflight) {
	const model = preflight.model ?? "（服务商内置默认）";
	const mode = preflight.mode === "image-to-image" ? "图生图" : "文生图";
	const watermark = preflight.watermark.enabled ? `开（${preflight.watermark.text}）` : "关";
	return `调用前预检查通过：服务商=${preflight.provider}，模型=${model}，模式=${mode}，尺寸=${preflight.size}，传输=${preflight.transport}，品牌水印=${watermark}`;
}
//#endregion
//#region src/providers/types.ts
/** 将 HttpOpts 转换为 RequestOptions。 */
function toRequestOpts(method, url, headers, body, opts) {
	return {
		method,
		url,
		headers,
		body,
		timeoutMs: opts.timeoutMs,
		retryTimes: opts.retryTimes,
		signal: opts.signal
	};
}
/**
* 尺寸分隔符归一化：配置默认值沿用百炼风格 "1024*1024"（星号），
* 而 threerouter（OpenAI 风格）与火山方舟均要求 "1024x1024"（字母 x）。
* 非 `宽x高` 形态（如 "1K"/"2K"/"auto"）原样返回。
*/
function normalizeImageSize(size) {
	return /^\d+\*\d+$/.test(size.trim()) ? size.trim().replace(/\*/g, "x") : size.trim();
}
/**
* 阿里系（千问 qwen-image-* / 万相 wan*-image 等，DashScope 与经 threerouter 透传皆同）
* 原生尺寸归一化：上游要求 `宽*高` 且不接受比例写法（2026-09-14 实测：`3:4` 原样
* 透传被 400 "Expected format: '<width>*<height>'"）。比例写法按长边 1536、32 对齐
* 换算（3:4 → 1152*1536；16:9 → 1536*864；1:1 → 1024*1024）；WxH / W*H 统一 `*` 分隔。
*/
function aliImageSize(size) {
	const ratio = /^(\d+):(\d+)$/.exec(size.trim());
	if (ratio) {
		const a = Number(ratio[1]);
		const b = Number(ratio[2]);
		if (a > 0 && b > 0) {
			if (a === b) return "1024*1024";
			const long = 1536;
			return `${a > b ? long : Math.round(long * a / b / 32) * 32}*${a > b ? Math.round(long * b / a / 32) * 32 : long}`;
		}
	}
	return size.trim().replace(/[xX]/g, "*");
}
//#endregion
//#region src/providers/wanx.ts
/**
* 万象（wanx）适配器：基于阿里云百炼 DashScope 异步 API。
* 文生图与文生视频均采用「提交任务 → 轮询查询 → 下载结果」异步模式。
* 鉴权统一 Bearer Token，X-DashScope-Async: enable 标记异步调用。
* @module dsh-image-video/providers/wanx
*/
/** 万象默认文生图模型（通义万相）。 */
const DEFAULT_IMAGE_MODEL$3 = "wanx2.1-t2i-turbo";
/** 万象图生图默认模型（image2image 图编辑：按 prompt 描述编辑参考图）。 */
const DEFAULT_IMAGE_EDIT_MODEL$2 = "wanx2.1-imageedit";
/** 万象默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL$3 = "wan2.2-t2v-plus";
/** 万象默认图生视频模型（首帧驱动）。 */
const DEFAULT_IMAGE_TO_VIDEO_MODEL = "wan2.2-i2v-plus";
/** DashScope 请求头。 */
function dashscopeHeaders(apiKey, requestId) {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${apiKey}`,
		"X-DashScope-Async": "enable",
		...requestId ? {
			"Idempotency-Key": requestId,
			"X-Request-Id": requestId
		} : {}
	};
}
/** 查询任务公共头（无 Async 标记）。 */
function queryHeaders(apiKey) {
	return { "Authorization": `Bearer ${apiKey}` };
}
/**
* 提交图片任务：带参考图走 image2image 图编辑（wanx2.1-imageedit，description_edit：
* 按 prompt 描述编辑参考图，异步任务），否则走文生图（wanx2.1-t2i-turbo，异步任务）。
* 两者同为「提交任务 → 轮询 → 下载」模式，复用同一 queryTask。
*/
async function submitImage$3(params, opts) {
	const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL$2 : DEFAULT_IMAGE_MODEL$3);
	if (params.image) {
		const editUrl = `${opts.baseURL}/services/aigc/image2image/image-synthesis`;
		const editBody = {
			model: effectiveModel,
			input: {
				function: "description_edit",
				prompt: params.prompt,
				base_image_url: params.image
			}
		};
		const taskId = (await request(toRequestOpts("POST", editUrl, dashscopeHeaders(opts.apiKey, params.requestId), editBody, opts)))?.output?.task_id;
		if (!taskId) throw new Error("万象 图生图：未返回 task_id");
		return {
			taskId,
			async: true,
			mediaType: "image",
			model: effectiveModel
		};
	}
	const url = `${opts.baseURL}/services/aigc/text2image/image-synthesis`;
	const body = {
		model: effectiveModel,
		input: { prompt: params.prompt },
		parameters: {
			size: params.size ? aliImageSize(params.size) : void 0,
			n: 1
		}
	};
	const taskId = (await request(toRequestOpts("POST", url, dashscopeHeaders(opts.apiKey), body, opts)))?.output?.task_id;
	if (!taskId) throw new Error("万象 文生图：未返回 task_id");
	return {
		taskId,
		async: true,
		mediaType: "image",
		model: effectiveModel
	};
}
/**
* 提交视频任务。存在 image 时为首帧驱动的图生视频：img_url 携带首帧引用
* （公网 URL 或 base64 data URL），模型默认取图生视频模型，构图由首帧决定，
* 不传 aspect_ratio；纯文生保持原有参数。resolution 为可选分辨率档位，按模型支持透传。
* wan 系模型（wan2.2-t2v-plus / wan2.7-t2v 等）不支持自定义时长：命中能力表时
* 丢弃 duration（SubmitResult.droppedDuration 标记，结果层在 notes 注明）。
*/
async function submitVideo$3(params, opts) {
	const url = `${opts.baseURL}/services/aigc/video-generation/video-synthesis`;
	const input = { prompt: params.prompt };
	if (params.image) input.img_url = params.image;
	const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_TO_VIDEO_MODEL : DEFAULT_VIDEO_MODEL$3);
	const droppedDuration = VIDEO_DURATION_UNSUPPORTED.has(effectiveModel);
	const parameters = {};
	if (!droppedDuration) parameters.duration = params.duration;
	if (params.resolution) parameters.resolution = params.resolution;
	if (!params.image) {
		parameters.aspect_ratio = params.aspectRatio ?? "16:9";
		parameters.audio = false;
	}
	const body = {
		model: effectiveModel,
		input,
		parameters
	};
	const taskId = (await request(toRequestOpts("POST", url, dashscopeHeaders(opts.apiKey), body, opts)))?.output?.task_id;
	if (!taskId) throw new Error("万象 文生视频：未返回 task_id");
	return {
		taskId,
		async: true,
		mediaType: "video",
		model: effectiveModel,
		...droppedDuration ? { droppedDuration } : {}
	};
}
/** 查询任务状态。 */
async function queryTask$3(taskId, opts) {
	const output = (await request(toRequestOpts("GET", `${opts.baseURL}/tasks/${taskId}`, queryHeaders(opts.apiKey), void 0, opts)))?.output;
	if (!output) return {
		status: "failed",
		error: "万象 查询返回为空"
	};
	switch (output.task_status) {
		case "PENDING":
		case "RUNNING": return { status: output.task_status === "PENDING" ? "pending" : "running" };
		case "SUCCEEDED": {
			const imageUrl = output.results?.[0]?.url ?? output.image_url;
			const mediaUrl = output.video_url ?? imageUrl;
			if (!mediaUrl) return {
				status: "failed",
				error: "万象 任务成功但未返回媒体 URL"
			};
			return {
				status: "succeeded",
				mediaUrl
			};
		}
		case "FAILED": return {
			status: "failed",
			error: output.message ?? "万象 任务执行失败"
		};
		case "CANCELED": return {
			status: "failed",
			error: "万象 任务已取消"
		};
		case "UNKNOWN": return {
			status: "failed",
			error: "万象 任务不存在或已过期"
		};
		default: return {
			status: "failed",
			error: `万象 未知任务状态: ${output.task_status}`
		};
	}
}
/** 万象适配器实例。 */
const wanxAdapter = {
	submitImage: submitImage$3,
	submitVideo: submitVideo$3,
	queryTask: queryTask$3
};
//#endregion
//#region src/providers/seedance.ts
/**
* Seedance2.5 适配器：基于火山引擎方舟 Ark API。
* 文生图/图生图走同步 /images/generations 接口（即时返回 URL，24h 有效需立即下载；
* Seedream 4.0 起支持 image 参考图入参做图生图，3.0 不支持——带参考图时默认模型
* 切换为 Seedream 4.0）；文生视频走异步 /contents/generations/tasks 接口
* （提交 → 轮询 → 下载）。鉴权统一 Bearer Token。
* @module dsh-image-video/providers/seedance
*/
/** Seedance 默认文生图模型（即梦/Seedream）。 */
const DEFAULT_IMAGE_MODEL$2 = "doubao-seedream-3-0-t2i-250415";
/** Seedance 图生图默认模型（Seedream 3.0 不支持 image 入参，4.0 起支持单图生图）。 */
const DEFAULT_IMAGE_EDIT_MODEL$1 = "doubao-seedream-4-0-250828";
/** Seedance 默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL$2 = "doubao-seedance-1-0-pro-250428";
/** Ark API 请求头。 */
function arkHeaders(apiKey) {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${apiKey}`
	};
}
/**
* 提交图片任务（同步接口，直接返回图片 URL）。带参考图走图生图：Seedream 4.0+ 的
* image 入参（URL 或 data URL），显式关闭组图与水印；尺寸分隔符归一化为方舟要求的
* `宽x高`（配置默认值为百炼风格的 `*`）。不带参考图为文生图。
*/
async function submitImage$2(params, opts) {
	const url = `${opts.baseURL}/images/generations`;
	const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL$1 : DEFAULT_IMAGE_MODEL$2);
	const body = {
		model: effectiveModel,
		prompt: params.prompt,
		...params.image ? {
			image: params.image,
			sequential_image_generation: "disabled",
			watermark: false
		} : { watermark: false },
		...params.size ? { size: normalizeImageSize(params.size) } : {},
		n: 1,
		response_format: "url"
	};
	const mediaUrl = (await request(toRequestOpts("POST", url, arkHeaders(opts.apiKey), body, opts)))?.data?.[0]?.url;
	if (!mediaUrl) throw new Error("Seedance 图片生成：未返回图片 URL");
	return {
		taskId: "",
		async: false,
		mediaUrl,
		mediaType: "image",
		model: effectiveModel
	};
}
/**
* 提交视频任务（异步接口，返回任务 ID）。存在 image 时为首帧驱动的图生视频，
* 按 Ark content 数组协议追加 image_url 块；resolution 为可选分辨率档位，按模型支持透传。
*/
async function submitVideo$2(params, opts) {
	const url = `${opts.baseURL}/contents/generations/tasks`;
	const content = [{
		type: "text",
		text: params.prompt
	}];
	if (params.image) content.push({
		type: "image_url",
		image_url: { url: params.image }
	});
	const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL$2;
	const body = {
		model: effectiveModel,
		content,
		...params.duration ? { duration: `${params.duration}s` } : {},
		...params.resolution ? { resolution: params.resolution } : {}
	};
	const taskId = (await request(toRequestOpts("POST", url, arkHeaders(opts.apiKey), body, opts)))?.id;
	if (!taskId) throw new Error("Seedance 文生视频：未返回 task_id");
	return {
		taskId,
		async: true,
		mediaType: "video",
		model: effectiveModel
	};
}
/** 查询异步任务状态。 */
async function queryTask$2(taskId, opts) {
	const data = await request(toRequestOpts("GET", `${opts.baseURL}/contents/generations/tasks/${taskId}`, arkHeaders(opts.apiKey), void 0, opts));
	switch (data?.status) {
		case "queued": return { status: "pending" };
		case "running":
		case "processing": return { status: "running" };
		case "succeeded": {
			const raw = data.content?.video_url;
			const videoUrl = typeof raw === "string" ? raw : raw?.url;
			if (!videoUrl) return {
				status: "failed",
				error: "Seedance 任务成功但未返回视频 URL"
			};
			return {
				status: "succeeded",
				mediaUrl: videoUrl
			};
		}
		case "failed": return {
			status: "failed",
			error: data.error?.message ?? "Seedance 任务执行失败"
		};
		default: return {
			status: "failed",
			error: `Seedance 未知任务状态: ${data?.status ?? "空"}`
		};
	}
}
/** Seedance 适配器实例。 */
const seedanceAdapter = {
	submitImage: submitImage$2,
	submitVideo: submitVideo$2,
	queryTask: queryTask$2
};
//#endregion
//#region src/providers/threerouter.ts
/**
* Threerouter 适配器：基于 threerouter.com 统一媒体生成 API。
* 生图（文生图 + 图生图）两条传输：
*   1. 异步（推荐，`imageTransport: async`）——POST /images/generations/async 返回
*      202 + task_id，GET /images/tasks/{task_id} 轮询，响应丢失时
*      GET /images/generations/by-request/{request_id} 凭幂等键找回原任务。
*      提交携带 `Idempotency-Key`，服务端保证同一键只创建一次任务。
*   2. 同步（`imageTransport: sync` / 异步端点在本环境不可用时降级）——
*      POST /images/generations 直接返回 OpenAI 标准结构 data[0].url / b64_json，
*      兼容统一入口顶层 url / urls 形态。同步路径无幂等保证，因此**永不自动重提**。
* 视频走 POST /media/generations 创建 → GET /media/{id} 轮询 → GET /media/{id}/content 下载，
* 请求显式携带 media_kind=video。鉴权统一 Bearer Token。
* 服务端契约见 docs/threerouter-async-image-contract.md。
* @module dsh-image-video/providers/threerouter
*/
/** Threerouter 默认文生图模型（千问图像 3.0，服务端模态注册表收录；旧默认 wan2.1-image 未收录会按文本派发）。 */
const DEFAULT_IMAGE_MODEL$1 = "qwen-image-3.0";
/** Threerouter 图生图默认模型（千问图像 3.0 Pro，支持 image 参考图入参，文档快速上手示例同款）。 */
const DEFAULT_IMAGE_EDIT_MODEL = "qwen-image-3.0-pro";
/** Threerouter 默认文生视频模型（MiniMax 系，支持 4-15 秒自定义时长）。账号可用模型见 threerouter.com 控制台。 */
const DEFAULT_VIDEO_MODEL$1 = "minimax-h3";
/**
* 阿里系（千问/万相）模型判定：这些上游要求 `宽*高` 原生格式，比例写法需在
* 客户端换算（共享 aliImageSize，见 types.ts）；其余模型保持 `*`→`x` 归一化。
*/
function isAliNativeImageModel(model) {
	return /qwen|wan/i.test(model);
}
/**
* 幂等键请求头。服务端契约：`Idempotency-Key` 头优先于 body 的 `request_id`。
* 客户端只发头、不发 body 字段——同步端点的请求体会原样转发上游，而 OpenAI 系
* 上游对未知顶层参数是严格拒绝的（`Unrecognized request argument`），
* 只有异步端点会在下发前摘掉 `request_id`。
*/
function threerouterHeaders(apiKey, requestId) {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${apiKey}`,
		...requestId ? { "Idempotency-Key": requestId } : {}
	};
}
/**
* 生图请求体：同步 `/images/generations` 与异步 `/images/generations/async`
* 使用完全相同的 payload（服务端契约：异步端点接受与同步端点同样的请求体）。
*/
function imageRequestBody(params, effectiveModel) {
	return {
		model: effectiveModel,
		prompt: params.prompt,
		n: 1,
		response_format: "url",
		...params.images !== void 0 && params.images.length > 0 ? {
			image: params.images[0],
			image_urls: params.images
		} : params.image ? { image: params.image } : {},
		...params.size ? { size: isAliNativeImageModel(effectiveModel) ? aliImageSize(params.size) : normalizeImageSize(params.size) } : {}
	};
}
/** 生图实际使用的模型：显式 model > 参考图默认（Pro）> 文生图默认。 */
function effectiveImageModel(params) {
	return params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL : DEFAULT_IMAGE_MODEL$1);
}
/** 从任务响应里取图片 URL：优先顶层 image_url，再回退 result.data[0].url。 */
function imageTaskMediaUrl(data) {
	const top = typeof data?.image_url === "string" && data.image_url !== "" ? data.image_url : void 0;
	if (top !== void 0) return top;
	const first = data?.result?.data?.[0]?.url;
	return typeof first === "string" && first !== "" ? first : void 0;
}
/**
* 把网关返回的失败对象拼成可读错误：`{type, code, message}` 三件套按有的拼，
* 并带上 http_status（异步任务失败时上游状态码在这里，不在任务状态里）。
*/
function extractImageTaskError(data) {
	const error = data?.error;
	let detail = "";
	if (typeof error === "string") detail = error;
	else if (error !== null && typeof error === "object") {
		const obj = error;
		detail = [typeof obj.code === "string" ? obj.code : typeof obj.type === "string" ? obj.type : "", typeof obj.message === "string" ? obj.message : ""].filter((part) => part !== "").join(": ");
	}
	if (detail === "") detail = "Threerouter 图片任务执行失败";
	return data?.http_status ? `${detail}（上游 HTTP ${data.http_status}）` : detail;
}
/**
* 提交图片任务（文生图 + 图生图统一端点 /images/generations，同步返回）。
* 参考图经 `image` 字段传入（data URL 或公网 URL，服务端亦接受 image_url / image_urls
* 数组形态，此处用最简的单字符串形态）；响应兼容 OpenAI 标准结构（data[0].url /
* b64_json）、统一入口顶层 url / urls、失败形态（status:'failed' + error）与异步
* 任务形态（status:'processing' + id，交由工具层轮询 GET /media/{id}）。
* size：qwen 系按上游要求归一化为 `宽*高`（实测 `3:4` 原样透传会被 400），
* 其余模型 `*`→`x`（配置默认值为百炼风格）；超时对齐官方建议抬到 ≥600s
* （千问图像 prompt_extend + 思考模式实测约 5 分钟出图）。
*
* 重试策略：**同步生图请求永不自动重试**（`retryTimes: 0`）。此端点一旦提交，
* 上游可能已开始生成并计费；客户端超时/断连时无法确认结果，重提就是重复扣费。
* 需要幂等与超时找回时请走 `imageTransport: async`。
*/
async function submitImage$1(params, opts) {
	const url = `${opts.baseURL}/images/generations`;
	const effectiveModel = effectiveImageModel(params);
	const reqOpts = toRequestOpts("POST", url, threerouterHeaders(opts.apiKey, params.requestId), imageRequestBody(params, effectiveModel), {
		...opts,
		retryTimes: 0
	});
	reqOpts.timeoutMs = Math.max(reqOpts.timeoutMs, 6e5);
	const data = await request(reqOpts);
	const first = data?.data?.[0];
	const topLevelUrl = data?.url ?? (Array.isArray(data?.urls) ? data.urls[0] : void 0);
	const mediaUrl = first?.url ?? (typeof topLevelUrl === "string" && topLevelUrl !== "" ? topLevelUrl : void 0);
	const base = {
		taskId: "",
		async: false,
		mediaType: "image",
		model: effectiveModel
	};
	if (mediaUrl) return {
		...base,
		mediaUrl
	};
	if (first?.b64_json) return {
		...base,
		mediaBase64: {
			data: first.b64_json,
			mediaType: "image/png"
		}
	};
	const errMsg = typeof data?.error === "string" ? data.error : data?.error !== null && typeof data?.error === "object" && typeof data.error.message === "string" ? data.error.message : "";
	if (data?.status === "failed") throw new Error(`Threerouter 生图：上游失败。${errMsg}`);
	if (data?.id && (!data.status || data.status === "processing" || data.status === "pending")) return {
		taskId: data.id,
		async: true,
		mediaType: "image",
		model: effectiveModel
	};
	throw new Error(params.image ? "Threerouter 图生图：响应未包含图片数据" : "Threerouter 文生图：响应未包含图片数据");
}
/**
* 异步提交图片任务：`POST /images/generations/async` → 202 + task_id。
*
* 与同步提交的本质区别：**服务端在返回 202 时就已落库任务**，生成脱离客户端
* 连接继续执行，因此提交响应丢失（超时/断连/502）时任务仍然存在，可凭
* `Idempotency-Key` 反查找回（见 findByRequestImageTask）——这正是「绝不重复生成」
* 的落点。请求本身携带幂等键，重复提交也只会返回同一个 task_id。
*
* `retryTimes: 0`：提交是「可能创建任务」的写操作，任何自动重试都由事务层
* 在确认状态后显式决定，不能藏在 HTTP 层。
*/
async function submitImageAsync(params, opts) {
	const url = `${opts.baseURL}/images/generations/async`;
	const effectiveModel = effectiveImageModel(params);
	const res = await requestFull(toRequestOpts("POST", url, threerouterHeaders(opts.apiKey, params.requestId), imageRequestBody(params, effectiveModel), {
		...opts,
		retryTimes: 0
	}));
	const data = res.data;
	const taskId = typeof data?.task_id === "string" && data.task_id !== "" ? data.task_id : typeof data?.id === "string" ? data.id : "";
	if (taskId === "") throw new GenerationError("task", "Threerouter 异步生图：202 响应未包含 task_id，无法轮询（服务端契约异常）", false, res.status);
	const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
	return {
		taskId,
		model: effectiveModel,
		...typeof data?.request_id === "string" && data.request_id !== "" ? { requestId: data.request_id } : {},
		...res.headers.get("x-idempotency-replayed") === "true" ? { replayed: true } : {},
		...retryAfterMs !== void 0 ? { retryAfterSec: Math.max(1, Math.round(retryAfterMs / 1e3)) } : {}
	};
}
/**
* 查询异步图片任务：`GET /images/tasks/{task_id}`。
* 状态口径以服务端契约为准：`processing` → 继续轮询；`succeeded`（旧值
* `completed`，同时出现在 legacy_status）→ 取 image_url / result.data[0].url；
* `failed` → 带出 error 与 http_status。`accepted`/`queued`/`cancelled` 服务端
* 不会产生，出现时按运行中/失败保守处理而不是空等。
*/
async function queryImageTask(taskId, opts) {
	const data = await request(toRequestOpts("GET", `${opts.baseURL}/images/tasks/${encodeURIComponent(taskId)}`, threerouterHeaders(opts.apiKey), void 0, opts));
	switch (data?.status) {
		case "processing":
		case "pending": return { status: "running" };
		case "succeeded":
		case "completed": {
			const mediaUrl = imageTaskMediaUrl(data);
			if (mediaUrl === void 0) return {
				status: "failed",
				error: `Threerouter 图片任务已完成但未返回图片 URL（task ${taskId}）`
			};
			return {
				status: "succeeded",
				mediaUrl
			};
		}
		case "failed":
		case "cancelled": return {
			status: "failed",
			error: extractImageTaskError(data)
		};
		default: return {
			status: "failed",
			error: `Threerouter 未知图片任务状态: ${data?.status ?? "空"}（task ${taskId}）`
		};
	}
}
/**
* 凭幂等键找回原任务：`GET /images/generations/by-request/{request_id}`。
*
* 提交响应因超时/断连/502 丢失时，客户端手里只剩幂等键——这是唯一能在
* **不重新生成**的前提下确认任务是否存在并继续等待的通道。服务端契约：
* 200 返回与轮询端点相同的任务对象（含 request_id）；404 表示该键无记录
* （从未成功提交，或记录已过期）。404 返回 undefined 而不是抛错，由上层
* 的事务策略决定下一步（默认响亮失败并要求用户确认，而不是自动重提）。
*/
async function findByRequestImageTask(requestId, opts) {
	const url = `${opts.baseURL}/images/generations/by-request/${encodeURIComponent(requestId)}`;
	try {
		const data = await request(toRequestOpts("GET", url, threerouterHeaders(opts.apiKey), void 0, opts));
		const taskId = typeof data?.task_id === "string" && data.task_id !== "" ? data.task_id : typeof data?.id === "string" ? data.id : "";
		return taskId === "" ? void 0 : { taskId };
	} catch (err) {
		if (err instanceof GenerationError && err.status === 404) return void 0;
		throw err;
	}
}
/**
* 提交视频任务（media_kind=video）。存在 image 时为首帧驱动的图生视频，
* 请求携带 image 字段（服务端按此字段路由到图生视频通道），此时构图由首帧决定，不再传 ratio；
* 纯文生时保持 ratio。resolution 为可选分辨率档位，MiniMax 系要求显式携带（缺失时上游 400），
* 未指定时注入模型默认档位；wan 系模型不支持自定义时长，命中能力表时丢弃 duration
* （SubmitResult.droppedDuration 标记，结果层在 notes 注明）。
*/
async function submitVideo$1(params, opts) {
	const url = `${opts.baseURL}/media/generations`;
	const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL$1;
	const body = {
		model: effectiveModel,
		prompt: params.prompt,
		media_kind: "video"
	};
	const droppedDuration = VIDEO_DURATION_UNSUPPORTED.has(effectiveModel);
	if (!droppedDuration) body.duration = params.duration;
	if (params.media) body.media = params.media.map(({ url: mediaUrl, type, position }) => ({
		type: type ?? (position?.toLowerCase() === "first_frame" || position === "0s" ? "first_frame" : position?.toLowerCase() === "last_frame" ? "last_frame" : "reference_image"),
		url: mediaUrl
	}));
	else if (params.image) body.image = params.image;
	else if (params.aspectRatio) body.ratio = params.aspectRatio;
	const resolution = params.resolution ?? VIDEO_MODEL_DEFAULT_RESOLUTION[effectiveModel];
	if (resolution) body.resolution = resolution;
	const reqOpts = toRequestOpts("POST", url, threerouterHeaders(opts.apiKey), body, opts);
	reqOpts.timeoutMs = Math.max(reqOpts.timeoutMs, 3e5);
	const data = await request(reqOpts);
	if (!data?.id) throw new Error("Threerouter 文生视频：未返回任务 ID");
	return {
		taskId: data.id,
		async: true,
		mediaType: "video",
		model: effectiveModel,
		...droppedDuration ? { droppedDuration } : {}
	};
}
/** 查询异步视频任务状态。完成后优先使用响应 url，缺失时回退 /content 302 端点。 */
async function queryTask$1(taskId, opts) {
	const data = await request(toRequestOpts("GET", `${opts.baseURL}/media/${taskId}`, threerouterHeaders(opts.apiKey), void 0, opts));
	switch (data?.status) {
		case "processing": return { status: "running" };
		case "succeeded": return {
			status: "succeeded",
			mediaUrl: typeof data.url === "string" && data.url.length > 0 ? data.url : `${opts.baseURL}/media/${taskId}/content`
		};
		case "failed": return {
			status: "failed",
			error: extractVideoTaskError(data.error)
		};
		case "cancelled": return {
			status: "failed",
			error: "Threerouter 任务已取消"
		};
		default: return {
			status: "failed",
			error: `Threerouter 未知任务状态: ${data?.status ?? "空"}`
		};
	}
}
/** 从视频任务失败响应中提取错误信息，兼容 string 与对象两种形态。 */
function extractVideoTaskError(error) {
	if (typeof error === "string" && error.length > 0) return error;
	if (error !== null && typeof error === "object") {
		const obj = error;
		if (typeof obj.message === "string") return obj.message;
	}
	return "Threerouter 任务执行失败";
}
/** Threerouter 适配器实例：统一入口同时支持文生图与文生视频。 */
const threerouterAdapter = {
	submitImage: submitImage$1,
	submitVideo: submitVideo$1,
	queryTask: queryTask$1,
	imageAsync: {
		submit: submitImageAsync,
		query: queryImageTask,
		findByRequest: findByRequestImageTask
	}
};
//#endregion
//#region src/providers/minimax.ts
/**
* MiniMax 官方平台适配器：视频基于 video-generation v2 API，图片基于
* image_generation API（同步返回 base64，无下载 URL）。
* 创建走 POST /video_generation（异步，返回 task_id），轮询走
* GET /query/video_generation，完成后经 file.download_url（或 files/retrieve
* 换取下载地址）落盘。鉴权统一 Bearer Token。
* 注意：本适配器按官方文档实现（2026-09），尚无平台 key 实测——字段语义以
* https://platform.minimaxi.com/docs/api-reference 为准，
* 取得 MINIMAX_API_KEY 后应在真实账号上验证一轮。
* 图片：文生图 + subject_reference 主体一致性图生图（当前每次仅支持 1 张参考图），
* 响应为 data.image_base64（裸 base64，无 URL 模式），结果层直接落盘。
* @module dsh-image-video/providers/minimax
*/
/** MiniMax 官方默认文生视频模型（Hailuo 系）。 */
const DEFAULT_VIDEO_MODEL = "MiniMax-Hailuo-02";
/** MiniMax 官方默认图片模型（image_generation）。 */
const DEFAULT_IMAGE_MODEL = "image-01";
/** 未显式指定分辨率时的默认档位（Hailuo-02 支持 768P/1080P，768P 档时长兼容性最好）。 */
const DEFAULT_RESOLUTION = "768P";
/** 从 "宽*高"/"宽x高" 尺寸推导 MiniMax 的 aspect_ratio（约分），无法解析回落 "1:1"。 */
function deriveAspectRatio(size) {
	const match = /^(\d+)[*x](\d+)$/i.exec(size.trim());
	if (!match || match[1] === void 0 || match[2] === void 0) return "1:1";
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!width || !height) return "1:1";
	let a = width;
	let b = height;
	while (b !== 0) {
		const t = b;
		b = a % b;
		a = t;
	}
	return `${width / a}:${height / a}`;
}
/** MiniMax API 请求头。 */
function minimaxHeaders(apiKey) {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${apiKey}`
	};
}
/** 校验 base_resp，非零状态码按 task 级错误抛出（消息保留原始 status_msg 供分类器判定）。 */
function assertBaseResp(baseResp, api) {
	const code = baseResp?.status_code;
	if (code !== void 0 && code !== 0) throw new GenerationError("task", `MiniMax ${api} 业务错误（${code}）：${baseResp?.status_msg ?? "未提供错误说明"}`, false);
}
/**
* 提交图片任务（同步接口，直接返回 base64）。带参考图走 subject_reference
* 主体一致性图生图（type: character，当前每次仅支持 1 张参考图，保留主体特征
* 按 prompt 换场景）；aspect_ratio 由尺寸约分推导（MiniMax 无像素尺寸概念）。
* 注意：官方示例 image_file 仅展示网络 URL，本地图片转 data URL 传入待实测。
*/
async function submitImage(params, opts) {
	const url = `${opts.baseURL}/image_generation`;
	const effectiveModel = params.model ?? DEFAULT_IMAGE_MODEL;
	const body = {
		model: effectiveModel,
		prompt: params.prompt,
		aspect_ratio: deriveAspectRatio(params.size),
		response_format: "base64",
		...params.image ? { subject_reference: [{
			type: "character",
			image_file: params.image
		}] } : {}
	};
	const data = await request(toRequestOpts("POST", url, minimaxHeaders(opts.apiKey), body, opts));
	assertBaseResp(data?.base_resp, "image_generation");
	const base64 = data?.data?.image_base64?.[0];
	if (!base64) throw new Error("MiniMax 图片生成：未返回图片数据");
	return {
		taskId: "",
		async: false,
		mediaType: "image",
		model: effectiveModel,
		mediaBase64: {
			data: base64,
			mediaType: "image/jpeg"
		}
	};
}
/**
* 提交视频任务（异步）。存在 image 时为首帧驱动的图生视频（first_frame_image）；
* resolution 缺省注入 768P；duration 透传（Hailuo 系支持自定义时长档位，
* 不支持档位时上游报错，响亮失败不静默改写）。
*/
async function submitVideo(params, opts) {
	const url = `${opts.baseURL}/video_generation`;
	const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL;
	const body = {
		model: effectiveModel,
		prompt: params.prompt,
		...params.image ? { first_frame_image: params.image } : {},
		...params.duration ? { duration: params.duration } : {},
		resolution: params.resolution ?? DEFAULT_RESOLUTION
	};
	const data = await request(toRequestOpts("POST", url, minimaxHeaders(opts.apiKey), body, opts));
	assertBaseResp(data?.base_resp, "video_generation");
	const taskId = data?.task_id;
	if (!taskId) throw new Error("MiniMax 文生视频：未返回 task_id");
	return {
		taskId,
		async: true,
		mediaType: "video",
		model: effectiveModel
	};
}
/** 查询异步任务状态；Success 时解析下载地址，必要时经 files/retrieve 二次换取。 */
async function queryTask(taskId, opts) {
	const data = await request(toRequestOpts("GET", `${opts.baseURL}/query/video_generation?task_id=${encodeURIComponent(taskId)}`, minimaxHeaders(opts.apiKey), void 0, opts));
	switch (data?.status) {
		case "Queueing": return { status: "pending" };
		case "Processing": return { status: "running" };
		case "Success": {
			let downloadUrl = data.file?.download_url;
			if (!downloadUrl && data.file_id !== void 0) downloadUrl = (await request(toRequestOpts("GET", `${opts.baseURL}/files/retrieve?file_id=${encodeURIComponent(String(data.file_id))}`, minimaxHeaders(opts.apiKey), void 0, opts)))?.file?.download_url;
			if (!downloadUrl) return {
				status: "failed",
				error: "MiniMax 任务成功但未返回视频下载地址"
			};
			return {
				status: "succeeded",
				mediaUrl: downloadUrl
			};
		}
		case "Fail": return {
			status: "failed",
			error: data.base_resp?.status_msg ?? data.fail_reason ?? "MiniMax 任务执行失败"
		};
		default: return {
			status: "failed",
			error: `MiniMax 未知任务状态: ${data?.status ?? "空"}`
		};
	}
}
/** MiniMax 适配器实例。 */
const minimaxAdapter = {
	submitImage,
	submitVideo,
	queryTask
};
//#endregion
//#region src/tools/generate-image.ts
/**
* 判断当前调用路由是否声明支持图片输入，与官方 read_image 的能力门一致：
* 解析会话当前 provider/model 后经 llm 服务读取输入模态。任何环节缺服务或
* 解析失败都视为「不支持」，从而回退纯文本摘要——绝不向纯文本模型注入 image
* 块触发网关 400。@param ctx 插件上下文。@param exec 工具执行上下文。
* @returns 路由是否声明了 image 输入模态。
*/
async function routeAcceptsImages(ctx, exec) {
	const routed = exec.agent?.session.requestHeader()?.config;
	const provider = routed?.provider ?? exec.agent?.options.provider;
	const model = routed?.model ?? exec.agent?.options.model;
	const llm = ctx.get("llm");
	if (provider === void 0 || model === void 0 || llm === void 0) return false;
	try {
		return (await llm.resolveModelInfo(provider, model, exec.signal)).inputModalities?.includes("image") === true;
	} catch {
		return false;
	}
}
/**
* 把工具输出里的 image 字段重建为 attachment 持久化引用，供 `image` 内容块携带。
* execute 返回的是 schema 校验后的明文对象（attachmentId 为字符串），此处补上品牌化 ID
* 并还原为 durable 引用，与官方 read_image 的 imageRefFromValue 保持一致。
*/
function imageAttachmentRef(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name }
	};
}
/**
/**
* 从当前会话最后一条用户消息读取已持久化图片，并转为服务商可消费的 data URL。
* 粘贴图片进入对话后，输入框已经由宿主 attachment 服务持久化；这里不再要求用户
* 复制路径，也不扫描历史图片，严格只取本轮最新用户消息中的图片，顺序保持不变。
*/
async function resolveConversationImages(exec, attachments) {
	const latest = [...exec.agent?.session.deriveMessages() ?? []].reverse().find((message) => message.role === "user");
	if (latest === void 0) return [];
	const refs = latest.content.filter((block) => block.type === "image").map((block) => block.attachment);
	if (refs.length === 0) return [];
	const resolved = [];
	for (const ref of refs) {
		const stored = await attachments.readImage(ref, exec.signal);
		resolved.push(`data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString("base64")}`);
	}
	return resolved;
}
/**
* 创建 generate_image 工具定义。
* 工具参数：prompt（必填，找回模式除外）、image（单图）、images（多参考图）、size、model、recoverRequestId。
*/
function createGenerateImageTool(deps) {
	const { config, taskManager, attachments, ctx, runtimeDefaults, outputsDir } = deps;
	/**
	* 异步传输能力探测缓存（按服务商）：某个服务商的异步端点被判为不可用后，
	* 在 TTL（10 分钟）内直接走同步，省掉每次调用一次的 404 往返；TTL 过后自动
	* 重新探测——服务端上线异步能力后无需重启客户端即可切换。
	*/
	const transportProbe = /* @__PURE__ */ new Map();
	const adapterFor = (p) => p === "threerouter" ? threerouterAdapter : p === "wanx" ? wanxAdapter : p === "minimax" ? minimaxAdapter : seedanceAdapter;
	/** 轮询实现：异步传输查网关图片任务端点，同步传输沿用适配器自身的任务查询。 */
	const pollFor = (adapter, transport, httpOpts) => {
		const api = adapter.imageAsync;
		const query = transport === "async" && api !== void 0 ? (taskId, opts) => api.query(taskId, opts) : adapter;
		return async (taskId, signal) => await taskManager.pollUntilDone(taskId, query, {
			...httpOpts,
			...signal === void 0 ? {} : { signal }
		}, signal);
	};
	/**
	* 尝试一个候选服务商：预检查 → 单次提交（async 优先）→ 必要时降级同步。
	* 失败时把事务账本一并带回，让调用方按 `canFallbackToNextProvider` 判定
	* 「能否安全换家」——未知状态绝不允许换家。
	*/
	const attemptCandidate = async (candidate, input) => {
		const { requestId, model, size, imageReference, imageReferences, prompt, exec, notes } = input;
		const adapter = adapterFor(candidate);
		const creds = resolveProviderCredentials(config, candidate);
		const httpOpts = {
			apiKey: creds.apiKey,
			baseURL: creds.baseURL,
			timeoutMs: config.timeoutMs,
			retryTimes: config.retryTimes,
			signal: exec.signal
		};
		const configuredTransport = resolveImageTransport(config.imageTransport, adapter, transportProbe.get(candidate));
		if (config.imageTransport === "auto" && configuredTransport === "sync" && adapter.imageAsync !== void 0) notes.push("该服务商的异步图片端点近期探测为不可用（生图功能未开启或分组平台不支持），本次直接走同步单次提交；服务端恢复后 10 分钟内自动切回异步");
		const preflight = resolveImagePreflight({
			provider: candidate,
			model,
			size,
			hasReferenceImage: imageReference !== void 0 || imageReferences.length > 0,
			transport: configuredTransport,
			adapterSupportsAsync: adapter.imageAsync !== void 0,
			config
		});
		notes.push(formatPreflightNote(preflight));
		const params = {
			prompt,
			size,
			model,
			requestId,
			...imageReferences.length > 0 ? { images: imageReferences } : imageReference === void 0 ? {} : { image: imageReference }
		};
		const run = async (transport, tx) => await runImageTransaction({
			tx,
			adapter,
			params,
			httpOpts,
			poll: pollFor(adapter, transport, httpOpts),
			unknownStatePolicy: config.imageUnknownStatePolicy === "resubmit-same-key" ? "resubmit-same-key" : "fail",
			recovery: DEFAULT_RECOVERY_BUDGET,
			onNote: (note) => {
				notes.push(note);
			}
		});
		let tx = createImageTransaction({
			requestId,
			provider: candidate,
			model,
			transport: configuredTransport
		});
		try {
			return {
				ok: true,
				result: (await run(configuredTransport, tx)).submit,
				tx,
				preflight
			};
		} catch (err) {
			if (err instanceof AsyncTransportUnavailableError && config.imageTransport === "auto") {
				transportProbe.set(candidate, { unavailableUntil: Date.now() + TRANSPORT_PROBE_TTL_MS });
				notes.push(`异步图片端点不可用，已降级为同步单次提交：${err.message}`);
				notes.push("降级说明：同步端点没有幂等键记录，因此不会自动重试，提交超时后也不会重新生成");
				const syncTx = createImageTransaction({
					requestId,
					provider: candidate,
					model,
					transport: "sync"
				});
				try {
					return {
						ok: true,
						result: (await run("sync", syncTx)).submit,
						tx: syncTx,
						preflight
					};
				} catch (syncErr) {
					return {
						ok: false,
						error: syncErr,
						tx: syncTx
					};
				}
			}
			return {
				ok: false,
				error: err,
				tx
			};
		}
	};
	/**
	* 交付结果：内存下载 → 水印后处理 → 只落盘最终图 → 写最终字节附件。
	* 图片生成与「凭 request_id 找回」共用本函数，保证两条路径的产出一致。
	*/
	const deliverImage = async (source, exec, notes) => {
		if (source.mediaUrl === void 0 && source.mediaBase64 === void 0) throw new Error("生成失败：服务端既未返回图片 URL 也未返回图片数据");
		const media = source.mediaBase64 !== void 0 ? decodeBase64Media(source.mediaBase64.data, source.mediaBase64.mediaType) : await fetchMediaBytes(source.mediaUrl, {
			timeoutMs: config.timeoutMs,
			retryTimes: config.retryTimes,
			signal: exec.signal
		});
		const watermark = await applyImageWatermark(media.data, media.contentType, config.watermark);
		if (watermark.note !== void 0) notes.push(watermark.note);
		return {
			saved: await writeOutputFile(watermark.data, watermark.contentType, outputsDir, ".png", source.mediaUrl ?? ""),
			postprocess: watermark.applied ? [`品牌水印 ${config.watermark.text}（${config.watermark.position}）`] : []
		};
	};
	return defineTool({
		name: "generate_image",
		description: "根据文本提示词生成图片；传入 image 参考图即为图生图（threerouter 统一生图端点按提示词编辑、Seedream 参考编辑、MiniMax 保留主体特征换场景——主体一致性）。服务商选择：配置链服务商优先（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；显式指定模型时按模型家族自动路由（wan/wanx→百炼直连，doubao/seedream/seedance→火山方舟，minimax→MiniMax 官方），候选仅在「服务端明确拒绝该模型且未创建任务」时按序回退，threerouter 永远兜底。一次调用只提交一次生成请求：默认走 threerouter 异步图片端点（携带幂等键），提交结果未知时凭同一 request_id 找回原任务，绝不自动重提、绝不自动换模型、不生成多张候选；需要多个版本时请分别发起多次调用。生成结果经品牌水印后处理（可配置）后保存到客户端统一 outputs 目录（对话内附最终图片附件）。不要自行编写脚本、不要直接调用服务商 API、不要把结果写到 outputs 之外。参数：prompt（提示词，必填；仅找回模式可省略）、image（单张参考图本地路径/URL，可选）; images（多参考图数组，直接粘贴到对话的图片会自动作为参考图，首图为底图，其余为脸部/风格参考）、size（尺寸或比例，可选，默认 3:4；qwen/wan 系自动换算为宽*高）、model（模型名，可选，留空用配置 defaultImageModel 或服务商内置默认模型）、recoverRequestId（可选：凭上一次调用的 request_id 找回结果，不产生新的生成请求）。",
		parameters: {
			prompt: {
				type: "string",
				description: "描述要生成的图片内容，支持中英文。仅当使用 recoverRequestId 找回模式时可省略。"
			},
			image: {
				type: "string",
				description: "单张参考图（本地文件路径或 http(s) URL）。"
			},
			images: {
				type: "array",
				items: { type: "string" },
				description: "多张参考图路径/URL；首图为底图，其余按顺序作为编辑、脸部或风格参考。若省略，自动读取本轮对话中粘贴的图片。"
			},
			size: {
				type: "string",
				description: "图片尺寸，如 1024*1024、1280*720。留空使用配置默认值。"
			},
			model: {
				type: "string",
				description: "指定模型名称。留空使用配置 defaultImageModel 或服务商默认模型。"
			},
			recoverRequestId: {
				type: "string",
				description: "仅用于找回：上一次调用返回的 request_id。凭它取回已提交任务的结果（服务端保留 24 小时），不会重新生成。"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					provider: {
						type: "string",
						required: true
					},
					prompt: {
						type: "string",
						description: "本次实际使用的提示词；找回模式下为服务端任务回显值或空串。"
					},
					mode: {
						type: "string",
						enum: ["text-to-image", "image-to-image"],
						required: true
					},
					localPath: {
						type: "string",
						required: true
					},
					sourceUrl: {
						type: "string",
						required: true
					},
					bytes: {
						type: "integer",
						required: true
					},
					model: {
						type: "string",
						description: "实际发给上游的模型名（含服务商内置默认），供用户核对本次到底用了哪个模型。"
					},
					transport: {
						type: "string",
						enum: ["async", "sync"],
						description: "本次使用的提交传输：async=网关异步任务（有幂等与找回），sync=同步单次提交。"
					},
					submitAttempts: {
						type: "integer",
						description: "本次生成事务的物理提交次数：正常为 1，仅同键重提策略下为 2（服务端按键去重）。"
					},
					recoveryLookups: {
						type: "integer",
						description: "凭 request_id 反查原任务的次数（只读查询，不计费）。"
					},
					requestId: {
						type: "string",
						description: "本次生成事务的幂等键：可用 recoverRequestId 参数找回结果。"
					},
					taskId: {
						type: "string",
						description: "服务端任务 ID（async 传输或服务商异步任务形态下有值）。"
					},
					postprocess: {
						type: "array",
						items: { type: "string" },
						description: "后处理链路（如品牌水印）；无后处理时省略。"
					},
					notes: {
						type: "array",
						items: { type: "string" }
					},
					image: {
						type: "object",
						additionalProperties: false,
						description: "内嵌图片附件引用（模型可见）。路由支持图片输入时 render 一并注入 image 块使对话内嵌显示；否则省略。",
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								],
								required: true
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					},
					previewImage: {
						type: "object",
						additionalProperties: false,
						description: "最终图片的附件引用（UI-only，始终提供）：与 localPath 是同一份后处理后的字节。",
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								],
								required: true
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					}
				}
			},
			render: (_args, value) => {
				const v = value;
				const dimensions = v.previewImage ?? v.image;
				const content = createImageSummaryText({
					provider: v.provider,
					localPath: v.localPath,
					bytes: v.bytes,
					...v.prompt === void 0 ? {} : { prompt: v.prompt },
					mode: v.mode,
					...v.model === void 0 ? {} : { model: v.model },
					...v.notes === void 0 ? {} : { notes: v.notes },
					...v.postprocess === void 0 ? {} : { postprocess: v.postprocess },
					...v.submitAttempts === void 0 ? {} : { submitAttempts: v.submitAttempts },
					...v.transport === void 0 ? {} : { transport: v.transport },
					...v.requestId === void 0 ? {} : { requestId: v.requestId },
					...dimensions === void 0 ? {} : {
						width: dimensions.width,
						height: dimensions.height
					}
				});
				if (v.image !== void 0) content.push({
					type: "image",
					attachment: imageAttachmentRef(v.image)
				});
				return content;
			},
			presentationMeta: (_args, value) => {
				const v = value;
				const preview = v.previewImage ?? v.image;
				return {
					provider: v.provider,
					model: v.model,
					mode: v.mode,
					prompt: v.prompt,
					localPath: v.localPath,
					sourceUrl: v.sourceUrl,
					bytes: v.bytes,
					transport: v.transport,
					submitAttempts: v.submitAttempts,
					requestId: v.requestId,
					...v.taskId === void 0 ? {} : { taskId: v.taskId },
					...v.postprocess === void 0 ? {} : { postprocess: v.postprocess },
					...v.notes ? { notes: v.notes } : {},
					...preview === void 0 ? {} : { image: preview }
				};
			}
		},
		async execute(args, exec) {
			const typedArgs = args;
			if (typedArgs.recoverRequestId !== void 0 && typedArgs.recoverRequestId.trim() !== "") return await recoverByRequestId(typedArgs.recoverRequestId.trim());
			const rawPrompt = typedArgs.prompt?.trim() ?? "";
			if (rawPrompt === "") throw new Error("generate_image：prompt 必填（仅使用 recoverRequestId 找回模式时可省略）");
			const runtime = runtimeDefaults.get();
			const prompt = applyImageStyle(rawPrompt, runtime.imageStyle);
			const conversationReferences = await resolveConversationImages(exec, attachments);
			const explicitReferences = Array.isArray(typedArgs.images) ? await Promise.all(typedArgs.images.filter((value) => typeof value === "string" && value.trim() !== "").map(resolveImageReference)) : [];
			const resolvedReferences = explicitReferences.length > 0 ? explicitReferences : conversationReferences;
			const imageReference = typedArgs.image ? await resolveImageReference(typedArgs.image) : void 0;
			const imageReferences = imageReference !== void 0 ? [imageReference] : resolvedReferences;
			const model = typedArgs.model || config.defaultImageModel || void 0;
			const size = typedArgs.size ?? runtime.imageSize ?? config.defaultImageSize;
			const candidates = resolveModelCandidates("image", model, runtime.imageProvider ?? (config.defaultImageProvider === "" ? void 0 : config.defaultImageProvider) ?? config.provider, (p) => peekProviderCredentials(config, p).apiKey.trim().length > 0);
			if (candidates.length === 0) throw new Error("dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey");
			const requestId = randomUUID();
			const notes = [];
			const attempts = [];
			let chosen;
			let lastError;
			for (const candidate of candidates) {
				const attempt = await attemptCandidate(candidate, {
					requestId,
					model,
					size,
					imageReference,
					imageReferences,
					prompt,
					exec,
					notes
				});
				if (attempt.ok) {
					chosen = attempt;
					break;
				}
				lastError = attempt.error;
				if (canFallbackToNextProvider(attempt.error, attempt.tx)) {
					attempts.push(`${candidate} 不接受该模型（${attempt.error instanceof Error ? attempt.error.message.slice(0, 120) : String(attempt.error)}）`);
					continue;
				}
				throw attempt.error;
			}
			if (chosen === void 0) throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error(`图片提交失败：所有候选服务商均不接受模型 ${model ?? "（服务商默认）"}`);
			if (attempts.length > 0) notes.unshift(`模型自动路由回退：${attempts.join("；")}；最终由 ${chosen.tx.provider} 提交`);
			const { saved, postprocess } = await deliverImage(chosen.result, exec, notes);
			const imageRef = await saveImageAttachment(attachments, saved.data, saved.contentType, "generated-image");
			const imageInline = await routeAcceptsImages(ctx, exec);
			const actualModel = chosen.result.model ?? model ?? "";
			const txReport = reportTransaction(chosen.tx);
			return {
				provider: chosen.tx.provider,
				prompt,
				mode: chosen.preflight.mode,
				localPath: saved.localPath,
				sourceUrl: saved.sourceUrl,
				bytes: saved.bytes,
				model: actualModel,
				transport: chosen.tx.transport,
				submitAttempts: txReport.submitAttempts,
				recoveryLookups: txReport.recoveryLookups,
				requestId: txReport.requestId,
				...txReport.taskId === void 0 ? {} : { taskId: txReport.taskId },
				...postprocess.length === 0 ? {} : { postprocess },
				...notes.length > 0 ? { notes } : {},
				previewImage: imageRef,
				...imageInline ? { image: imageRef } : {}
			};
			/**
			* 凭 request_id 找回上一次调用的任务结果并交付（不提交任何生成请求）。
			* 逐个候选服务商的反查端点查询：只有提交时那把 key 能查到自己的任务，
			* 因此用不到的服务商会直接 404（不计费、不产生任务）。
			*/
			async function recoverByRequestId(recoverRequestId) {
				const recoverNotes = [];
				const probeCandidates = candidates.includes("threerouter") ? candidates : [...candidates, "threerouter"];
				let found;
				let lookupError;
				for (const candidate of probeCandidates) {
					const adapter = adapterFor(candidate);
					if (adapter.imageAsync === void 0) continue;
					const creds = resolveProviderCredentials(config, candidate);
					const httpOpts = {
						apiKey: creds.apiKey,
						baseURL: creds.baseURL,
						timeoutMs: config.timeoutMs,
						retryTimes: config.retryTimes,
						signal: exec.signal
					};
					try {
						const hit = await adapter.imageAsync.findByRequest(recoverRequestId, httpOpts);
						if (hit !== void 0) {
							found = {
								provider: candidate,
								taskId: hit.taskId,
								adapter,
								httpOpts
							};
							break;
						}
					} catch (err) {
						lookupError = err;
					}
				}
				if (found === void 0) throw new Error(`未找到 request_id=${recoverRequestId} 对应的任务：该键没有记录（从未成功提交）或已超过服务端 24 小时保留期。` + (lookupError === void 0 ? "" : `查询过程中的错误：${lookupError instanceof Error ? lookupError.message : String(lookupError)}。`) + "本次没有发起任何新的生成请求。");
				const hit = found;
				const hitApi = hit.adapter.imageAsync;
				if (hitApi === void 0) throw new Error(`服务商 ${hit.provider} 不支持按 request_id 找回任务`);
				recoverNotes.unshift(`找回模式：凭 request_id=${recoverRequestId} 取回任务 ${hit.taskId}（服务商 ${hit.provider}），本次未提交任何新的生成请求`);
				const mediaUrl = (await taskManager.pollUntilDone(hit.taskId, (taskId, opts) => hitApi.query(taskId, opts), hit.httpOpts, exec.signal)).mediaUrl;
				const { saved, postprocess } = await deliverImage({ mediaUrl }, exec, recoverNotes);
				const imageRef = await saveImageAttachment(attachments, saved.data, saved.contentType, "recovered-image");
				const imageInline = await routeAcceptsImages(ctx, exec);
				return {
					provider: hit.provider,
					prompt: "",
					mode: "text-to-image",
					localPath: saved.localPath,
					sourceUrl: saved.sourceUrl,
					bytes: saved.bytes,
					model: model ?? "",
					transport: "async",
					submitAttempts: 0,
					recoveryLookups: 1,
					requestId: recoverRequestId,
					taskId: hit.taskId,
					...postprocess.length === 0 ? {} : { postprocess },
					notes: recoverNotes,
					previewImage: imageRef,
					...imageInline ? { image: imageRef } : {}
				};
			}
		},
		presentCall: (args) => ({
			card: "generic",
			title: "生成图片",
			kind: "other",
			rawInput: args
		}),
		timeoutMs: config.pollTimeoutMs
	});
}
//#endregion
//#region src/tools/generate-video.ts
/**
* generate_video 工具：文生视频 + 图生视频（image 首帧驱动），支持 threerouter（聚合器）/
* 万象（wanx，百炼直连）/ MiniMax 官方平台 / Seedance（火山方舟），按模型家族自动路由。
* 提交任务后后台轮询直到完成，下载视频到 outputs/ 目录。
* 视频生成耗时较长（1-5 分钟），轮询过程不产生中间输出，仅最终结果返回模型，
* 不阻塞对话上下文。时长上限 30 秒，由 schema 与运行时双重校验。
* @module dsh-image-video/tools/generate-video
*/
/** 视频时长上限（秒），强制规范。 */
const MAX_VIDEO_DURATION = 30;
/**
* 创建 generate_video 工具定义。
* 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）、
* image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
*/
function createGenerateVideoTool(deps) {
	const { config, taskManager, runtimeDefaults } = deps;
	const outputsDir = deps.outputsDir ?? config.outputsDir;
	return defineTool({
		name: "generate_video",
		description: `根据文本提示词生成短视频；传入 image（首帧图片）时为图生视频，让图片动起来。服务商选择：配置链服务商优先（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；视频生成固定通过 ThreeRouter 提交（项目约定，禁止切换到 OpenArt 或其他直连服务商），不使用任何其他服务商回退。模型取值：调用参数 model > 配置 defaultVideoModel > 多关键帧自动路由 > 服务商内置默认模型（threerouter 默认 minimax-h3）。不要自行编写脚本或直接调用服务商 API。视频时长上限 ${MAX_VIDEO_DURATION} 秒；具体模型能力由上游校验，wan 系模型不支持自定义时长时会在结果 notes 注明。生成完成后视频保存到本地 outputs/ 目录。参数：prompt（提示词，必填）、duration（时长秒数，1-30；传 -1 表示保持参考视频原时长/由模型智能决定）、model（模型名，可选，留空用配置或服务商内置默认模型）、aspectRatio（宽高比，可选，留空 16:9；图生视频时忽略，多关键帧时也忽略，参考视频时默认 adaptive 保持原片比例）、image（首帧图片：本地路径/URL，可选，单图时用）、media（参考素材序列：数组，每项含 image 路径/URL 或 video 路径/URL，可带 type 与 position；传 video 即「视频编辑」——把参考视频交给 wan3.0-video，配合提示词里的编辑意图（如"替换""改成""去掉"）改内容而保留原片动作，此时 model 缺省为 wan3.0-video、ratio 缺省 adaptive、duration 缺省 -1；适用于 MiniMax-H3 / wan3.0-video，此时 image 字段忽略）、resolution（分辨率档位，可选，取值随模型）。`,
		parameters: {
			prompt: {
				type: "string",
				required: true,
				description: "描述要生成的视频内容，支持中英文。"
			},
			duration: {
				type: "integer",
				description: `视频时长（秒），范围 1-${MAX_VIDEO_DURATION}；传 -1 表示保持参考视频原时长（参考视频未指定时自动取 -1）。留空使用配置默认值。具体模型能力由上游校验。`
			},
			model: {
				type: "string",
				description: "指定模型名称。留空使用服务商内置默认模型（图生视频用服务商内置 i2v 默认模型）。"
			},
			aspectRatio: {
				type: "string",
				description: "视频宽高比，如 16:9、9:16、1:1。留空使用 16:9；图生视频时构图由首帧图片决定，此参数被忽略。"
			},
			image: {
				type: "string",
				description: "首帧图片，用于图生视频（让图片动起来）：本地文件路径、http(s) URL 或 data URL。单图时用，与 media 二选一。"
			},
			media: {
				type: "array",
				description: "参考素材序列（MiniMax-H3 / wan3.0-video）：每项为 {image|video, type?, position?}，适配器转换为服务端的 type/url。传 video 即视频编辑：保留参考视频的构图与动作，按提示词替换/增删元素（缺省 type=reference_video）。存在时 image 字段忽略。",
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						image: {
							type: "string",
							description: "参考图：本地路径 / http(s) URL / data URL"
						},
						video: {
							type: "string",
							description: "参考视频（视频编辑用）：本地路径 / http(s) URL；本地文件超过阈值时自动压缩，建议 ≤15 秒、720p 以内"
						},
						type: {
							type: "string",
							description: "素材类型，缺省按字段与 position 推断：first_frame / last_frame / reference_image / reference_video（传 video 时缺省值）"
						},
						position: {
							type: "string",
							description: "参考图对应时间点，如 '0s' / '1s' / 'first_frame' / 'last_frame'"
						}
					}
				}
			},
			resolution: {
				type: "string",
				description: "分辨率档位，取值由模型决定（如 MiniMax-H3：480P/768P/2K；wan 图生视频：480P/1080P）。留空使用服务商默认。"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					provider: {
						type: "string",
						required: true
					},
					prompt: {
						type: "string",
						required: true
					},
					duration: {
						type: "integer",
						required: true
					},
					mode: {
						type: "string",
						required: true
					},
					resolution: {
						type: "string",
						required: true
					},
					localPath: {
						type: "string",
						required: true
					},
					sourceUrl: {
						type: "string",
						required: true
					},
					bytes: {
						type: "integer",
						required: true
					},
					elapsedMs: {
						type: "integer",
						required: true
					},
					model: {
						type: "string",
						description: "实际发给上游的模型名（含服务商内置默认），供用户核对本次到底用了哪个模型。"
					},
					notes: {
						type: "array",
						items: { type: "string" }
					}
				}
			},
			render: (_args, value) => {
				const v = value;
				return createVideoContent(v.localPath, v.bytes, v.sourceUrl, {
					prompt: v.prompt,
					provider: v.provider,
					model: v.model,
					mode: v.mode,
					duration: v.duration,
					resolution: v.resolution,
					...v.notes ? { notes: v.notes } : {}
				});
			},
			presentationMeta: (_args, value) => {
				const v = value;
				return {
					provider: v.provider,
					model: v.model,
					prompt: v.prompt,
					duration: v.duration,
					localPath: v.localPath,
					sourceUrl: v.sourceUrl,
					bytes: v.bytes,
					...v.notes ? { notes: v.notes } : {}
				};
			}
		},
		async execute(args, exec) {
			const typedArgs = args;
			const mediaRef = typedArgs.media ? await resolveVideoMedia(typedArgs.media) : void 0;
			const hasMedia = !!mediaRef;
			const hasRefVideo = mediaRef?.some((m) => m.type === "reference_video") ?? false;
			const runtime = runtimeDefaults.get();
			const duration = typedArgs.duration ?? (hasRefVideo ? -1 : runtime.videoDuration ?? config.defaultVideoDuration);
			if (duration !== -1 && (duration < 1 || duration > MAX_VIDEO_DURATION)) throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间（-1 表示保持参考视频原时长），当前为 ${duration}`);
			const preferred = runtime.videoProvider ?? (config.defaultVideoProvider === "" ? void 0 : config.defaultVideoProvider);
			const candidates = resolveModelCandidates("video", typedArgs.model, preferred ?? config.provider, (p) => peekProviderCredentials(config, p).apiKey.trim().length > 0);
			if (candidates.length === 0) throw new Error("dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey");
			const adapterFor = (p) => p === "threerouter" ? threerouterAdapter : p === "wanx" ? wanxAdapter : p === "minimax" ? minimaxAdapter : seedanceAdapter;
			const imageRef = typedArgs.image ? await compressVideoFirstFrame(await resolveImageReference(typedArgs.image)) : void 0;
			let model = typedArgs.model || (hasRefVideo ? REFERENCE_VIDEO_CAPABLE_MODELS[0] : config.defaultVideoModel) || void 0;
			if (hasRefVideo) {
				if (model && !REFERENCE_VIDEO_CAPABLE_MODELS.includes(model)) throw new Error(`模型「${model}」不支持参考视频（视频编辑）。请使用 ${REFERENCE_VIDEO_CAPABLE_MODELS.join("、")}`);
			} else if (hasMedia) {
				if (model && !MULTI_FRAME_CAPABLE_MODELS.includes(model)) throw new Error(`模型「${model}」不支持多关键帧。请使用支持多帧的模型：${MULTI_FRAME_CAPABLE_MODELS.join("、")}`);
				if (!model) model = MULTI_FRAME_CAPABLE_MODELS[0];
			}
			const videoParams = {
				prompt: typedArgs.prompt,
				duration,
				model,
				aspectRatio: hasRefVideo ? typedArgs.aspectRatio || "adaptive" : hasMedia ? void 0 : typedArgs.aspectRatio || runtime.videoAspectRatio || "16:9",
				image: hasMedia ? void 0 : imageRef,
				media: mediaRef,
				resolution: typedArgs.resolution
			};
			let provider;
			let adapter;
			let httpOpts;
			let submitResult;
			const fallbackNotes = [];
			let lastError;
			for (const candidate of candidates) {
				const creds = resolveProviderCredentials(config, candidate);
				const candidateAdapter = adapterFor(candidate);
				const candidateOpts = {
					apiKey: creds.apiKey,
					baseURL: creds.baseURL,
					timeoutMs: config.timeoutMs,
					retryTimes: config.retryTimes,
					signal: exec.signal
				};
				try {
					submitResult = await candidateAdapter.submitVideo(videoParams, candidateOpts);
					provider = candidate;
					adapter = candidateAdapter;
					httpOpts = candidateOpts;
					break;
				} catch (err) {
					if (!isModelNotAcceptedError(err)) throw err;
					lastError = err;
					fallbackNotes.push(`${candidate} 不接受该模型（${err instanceof Error ? err.message.slice(0, 120) : String(err)}）`);
				}
			}
			if (!submitResult || !provider || !adapter || !httpOpts) throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error(`视频提交失败：所有候选服务商均不接受模型 ${model ?? "（服务商默认）"}`);
			if (!submitResult.taskId) throw new Error("视频任务提交失败：未返回 task_id");
			const actualModel = submitResult.model ?? model ?? "";
			const notes = [];
			if (hasRefVideo) {
				const videoCount = mediaRef?.filter((m) => m.type === "reference_video").length ?? 0;
				const assetCount = (mediaRef?.length ?? 0) - videoCount;
				notes.push(`视频编辑：提交 ${videoCount} 段参考视频 + ${assetCount} 张参考素材，由上游保留参考视频的构图与动作、按提示词改写内容${assetCount > 0 ? "（提示词需包含「替换 / 改成 / 去掉」等编辑意图才会触发改写）" : ""}`);
				if (duration === -1) notes.push("duration=-1：时长由服务端按参考视频原时长决定，不使用配置默认时长");
			}
			if (submitResult.droppedDuration) notes.push(`当前模型 ${actualModel || "（服务商内置默认）"} 不支持自定义时长，已忽略 duration=${duration} 秒，实际时长由上游模型默认决定`);
			if (fallbackNotes.length > 0) notes.push(`模型自动路由回退：${fallbackNotes.join("；")}；最终由 ${provider} 提交`);
			const pollResult = await taskManager.pollUntilDone(submitResult.taskId, adapter, httpOpts, exec.signal);
			const downloadOpts = {
				timeoutMs: config.timeoutMs,
				retryTimes: config.retryTimes,
				signal: exec.signal
			};
			const saved = await downloadAndSave(pollResult.mediaUrl, outputsDir, ".mp4", downloadOpts);
			return {
				provider,
				prompt: typedArgs.prompt,
				duration,
				mode: hasRefVideo ? "video-edit" : imageRef ? "image-to-video" : "text-to-video",
				resolution: typedArgs.resolution ?? "",
				model: actualModel,
				localPath: saved.localPath,
				sourceUrl: saved.sourceUrl,
				bytes: saved.bytes,
				elapsedMs: pollResult.elapsedMs,
				...notes.length > 0 ? { notes } : {}
			};
		},
		presentCall: (args) => ({
			card: "generic",
			title: "生成视频",
			kind: "other",
			rawInput: args
		}),
		timeoutMs: config.pollTimeoutMs
	});
}
//#endregion
//#region src/index.ts
/** Cordis 插件名，用于 loader 诊断。 */
const name = "image-video";
/**
* 必需服务依赖：`tools`（工具注册表）。
* `attachments` 不在此声明——它由 `generate_image` 通过 `ctx.inject` 按需声明，
* 缺失时仅 generate_image 不注册，generate_video 与插件本身不受影响。
*/
const inject = ["tools"];
/**
* 插件入口：创建任务管理器（注册卸载清理），注册 generate_image / generate_video 工具。
*
* `generate_image` 通过 `ctx.inject(['attachments'], cb)` 显式声明对 attachment 服务的依赖：
* callback 接收已注入 attachments 的子上下文，从中读取服务实例构造时注入工具，
* 不在执行体内部运行时 `ctx.get` 读取。attachments 服务撤销时，该 fiber dispose，
* `ctx.tools.register` 的 disposer 自动注销工具。
*
* `generate_video` 不依赖 attachments，始终注册。工具注册的 disposer 由 `ctx.tools.register`
* 内部经 effect 注册，fiber dispose 时自动清理。
*
* @param ctx - 插件上下文。
* @param config - 已由 Schemastery 填充默认值的插件配置。
*/
function apply(ctx, config) {
	const outputsDir = resolveOutputsDir(config.outputsDir);
	const keyState = (provider) => peekProviderCredentials(config, provider).apiKey.trim().length > 0 ? "已配置" : "未配置";
	ctx.logger.info(`dsh-image-video 生效配置：provider=${config.provider} defaultVideoProvider=${config.defaultVideoProvider || "(跟随激活服务商)"} defaultImageProvider=${config.defaultImageProvider || "(跟随激活服务商)"} defaultVideoModel=${config.defaultVideoModel || "(服务商内置默认)"} defaultImageModel=${config.defaultImageModel || "(服务商内置默认)"} defaultImageSize=${config.defaultImageSize} imageTransport=${config.imageTransport} imageUnknownStatePolicy=${config.imageUnknownStatePolicy} watermark=${config.watermark.enabled ? `${config.watermark.text}@${config.watermark.position}` : "关闭"} outputsDir=${outputsDir} keys{threerouter=${keyState("threerouter")}, wanx=${keyState("wanx")}, minimax=${keyState("minimax")}, seedance=${keyState("seedance")}}`);
	const taskManager = new TaskManager(ctx, config);
	const runtimeDefaults = createRuntimeDefaultsStore();
	ctx.inject(["attachments"], (imageCtx) => {
		const attachments = imageCtx.get("attachments");
		if (!attachments) return;
		imageCtx.tools.register(createGenerateImageTool({
			config,
			taskManager,
			attachments,
			ctx,
			runtimeDefaults,
			outputsDir
		}));
	});
	ctx.tools.register(createGenerateVideoTool({
		config,
		taskManager,
		runtimeDefaults,
		outputsDir
	}));
	ctx.inject(["webServer"], (mediaCtx) => {
		const webServer = mediaCtx.get("webServer");
		if (!webServer) return;
		const disposeRoute = registerOutputsRoute(webServer, outputsDir);
		if (disposeRoute) mediaCtx.effect(() => disposeRoute, "dsh-image-video: outputs media route");
		const disposeDefaults = registerDefaultsRoute(webServer, runtimeDefaults, extractPersistedDefaults(config));
		if (disposeDefaults) mediaCtx.effect(() => disposeDefaults, "dsh-image-video: runtime defaults route");
	});
}
//#endregion
export { AsyncTransportUnavailableError, Config, DEFAULTS_ROUTE_PATH, DEFAULT_RECOVERY_BUDGET, GenerationError, IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, TRANSPORT_PROBE_TTL_MS, TaskManager, apply, applyImageStyle, applyImageWatermark, buildWatermarkSvg, canFallbackToNextProvider, consumeSubmitBudget, createDefaultsRouteHandler, createGenerateImageTool, createGenerateVideoTool, createImageTransaction, createRuntimeDefaultsStore, extractPersistedDefaults, fitFontSize, formatPreflightNote, inject, isAsyncImageUnavailableError, isModelNotAcceptedError, isUnknownSubmitStateError, looksLikeVideoModel, name, parseDefaultsPatch, registerDefaultsRoute, reportTransaction, resolveImagePreflight, resolveImageTransport, runImageTransaction, seedanceAdapter, submitBudget, threerouterAdapter, unknownStateError, wanxAdapter };
