import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { createReadStream } from "node:fs";
import { access, constants, copyFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";
import "@deepseek-ai/cordis";
//#region src/config.ts
/**
* 插件配置类型与 Schemastery schema。所有部署可变参数都通过 Config 暴露，
* 不存在硬编码可调参数；切换服务商只需改 `provider` 字段，HMR 自动重载。
* @module dsh-image-video/config
*/
/** 服务商凭证 schema，复用于 threerouter/wanx/minimax/seedance。apiKey 可空（未激活的 provider 留空）。 */
const ProviderCredentialsSchema = z.object({
	apiKey: z.string().default("").description("服务商 API Key；未激活的 provider 可留空"),
	apiKeyEnv: z.string().role("credential-ref").default("").description("API Key 的凭证引用名；apiKey 留空时按此引用解析，留空表示不使用引用"),
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
* 服务商是否声明了凭证来源：明文 `apiKey` 或 `apiKeyEnv` 引用。
* 供候选服务商过滤使用——不解析引用值（解析是异步的，且只在真正提交时做一次）。
* @param config - 已校验的插件配置。
* @param provider - 目标服务商。
* @returns 明文或引用任一非空为 true。
*/
function hasConfiguredCredentials(config, provider) {
	const creds = peekProviderCredentials(config, provider);
	return creds.apiKey.trim().length > 0 || (creds.apiKeyEnv ?? "").trim().length > 0;
}
/**
* 解析指定服务商的凭证，校验非空。供按模型自动路由的生成工具使用：
* composer 选中某服务商分组下的模型时，工具以该服务商的凭证直连。
*
* 取值优先级：明文 `apiKey` > `apiKeyEnv` 引用经凭证缝解析的值。引用使部署可
* 只声明凭证名（如桌面端登录写入的 Key），不把明文写进配置文件。
* @param config - 已校验的插件配置。
* @param provider - 目标服务商。
* @param resolveApiKey - 按引用名解析凭证值的回调，由插件经 `ctx.credentials` 构造。
* @returns 服务商凭证与端点。
* @throws 当明文与引用都取不到非空 API Key 时（报错指明缺 key 的 provider 字段）。
*/
async function resolveProviderCredentials(config, provider, resolveApiKey) {
	const creds = peekProviderCredentials(config, provider);
	const literal = creds.apiKey.trim();
	const ref = (creds.apiKeyEnv ?? "").trim();
	let apiKey = literal === "" ? void 0 : literal;
	if (apiKey === void 0 && ref !== "") apiKey = (await resolveApiKey(ref))?.trim() || void 0;
	if (apiKey === void 0) throw new Error(`dsh-image-video: 服务商 ${provider} 未配置 API Key，请设置 ${provider}.apiKey，或把 ${provider}.apiKeyEnv 指向已配置的凭证`);
	return {
		provider,
		apiKey,
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
* （docs/threerouter-async-image-contract.md「HTTP status code contract」），400/401/403/404/413/429
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
	const localPath = resolve(dir, `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
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
/** 图片参考图压缩阈值（data URL 解码后的字节数）：超过即先压再提交。 */
const IMAGE_REFERENCE_COMPRESS_THRESHOLD = 4e6;
/** 压缩后长边上限：编辑模型只需看清主体与纹理，2560 足够且显著降体积。 */
const IMAGE_REFERENCE_LONG_EDGE = 2560;
/**
* 压缩过大的本地参考图（data URL 形态）。手机原图直传时 data URL 比原文件还大约 1/3，
* 而网关/上游都有请求体上限、实测大体积提交容易被拖到超时；这里等比缩到长边
* {@link IMAGE_REFERENCE_LONG_EDGE} 并转 JPEG 后再提交。小图与 http(s) URL 原样返回。
* @param ref - {@link resolveImageReference} 的结果（data URL 或 http(s) URL）。
* @returns 可直接提交的图片引用；压缩不可用或失败时原样返回，交由服务端报错。
*/
async function compressImageReference(ref) {
	if (!ref.startsWith("data:image/")) return ref;
	const commaIdx = ref.indexOf(",");
	if (commaIdx < 0) return ref;
	const b64 = ref.slice(commaIdx + 1);
	if (Math.floor(b64.length * 3 / 4) <= IMAGE_REFERENCE_COMPRESS_THRESHOLD) return ref;
	try {
		const out = await sharp(Buffer.from(b64, "base64")).rotate().resize({
			width: IMAGE_REFERENCE_LONG_EDGE,
			height: IMAGE_REFERENCE_LONG_EDGE,
			fit: "inside",
			withoutEnlargement: true
		}).jpeg({ quality: 88 }).toBuffer();
		if (out.byteLength === 0) return ref;
		return `data:image/jpeg;base64,${out.toString("base64")}`;
	} catch {
		return ref;
	}
}
const execFileAsync$1 = promisify(execFile);
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
		await execFileAsync$1("ffmpeg", [
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
		await execFileAsync$1("ffmpeg", [
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
* 图片是否作为模型可见的 image ContentBlock 注入由**路由能力**决定（路由支持图片输入时注入）。
* 纯文本路由不注入，避免 llm 适配器序列化成 image_url 后被网关 400。附件引用同时经
* `output.presentationMeta` 走 UI-only 通道持久化。
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
		...details.comparePath ? [`- 对比片（原片 / 复刻）：${details.comparePath}`] : [],
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
/** 视频宽高比白名单（导出供 workbench 下拉选项复用，与协议层校验同源）。 */
const VIDEO_ASPECT_RATIOS = [
	"16:9",
	"9:16",
	"1:1"
];
/** 合法服务商清单（与 config.ts 的 Provider 联合一一对应），供协议层白名单校验（导出供 workbench 下拉选项复用）。 */
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
const VIDEO_DURATION_UNSUPPORTED = new Set(["wan2.2-t2v-plus", "wan2.7-t2v"]);
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
* 提取）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须 1-30 整数；
* settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用内置默认），
* 避免把非法持久值经合并视图当作生效值回显。
* @param config - 已由 Schemastery 填充默认值的插件配置。
*/
function extractPersistedDefaults(config) {
	const persisted = {};
	if (isProvider(config.defaultImageProvider)) persisted.imageProvider = config.defaultImageProvider;
	if (IMAGE_SIZE_OPTIONS.some((option) => option.size === config.defaultImageSize)) persisted.imageSize = config.defaultImageSize;
	if (isProvider(config.defaultVideoProvider)) persisted.videoProvider = config.defaultVideoProvider;
	if (Number.isInteger(config.defaultVideoDuration) && config.defaultVideoDuration >= 1 && config.defaultVideoDuration <= 30) persisted.videoDuration = config.defaultVideoDuration;
	return persisted;
}
/**
* 合并为响应视图：运行时覆盖优先，缺失回落 settings 持久默认，两者皆无 → null。
* 风格与视频比例是纯运行时概念（settings 无对应持久字段），始终取覆盖层。
*/
function toView(defaults, persisted) {
	return {
		mediaMode: defaults.mediaMode ?? null,
		imageProvider: defaults.imageProvider ?? persisted.imageProvider ?? null,
		imageSize: defaults.imageSize ?? persisted.imageSize ?? null,
		imageStyle: defaults.imageStyle ?? null,
		videoProvider: defaults.videoProvider ?? persisted.videoProvider ?? null,
		videoAspectRatio: defaults.videoAspectRatio ?? null,
		videoDuration: defaults.videoDuration ?? persisted.videoDuration ?? null
	};
}
/**
* 合并为「运行时覆盖 ?? settings 持久默认」的当前生效视图。defaults 路由与
* 媒体模式注入共用这一个取值口径，避免两处各算一遍。
* @param store - 运行时覆盖存储。
* @param persisted - settings 持久默认回落层；缺省为空。
* @returns 当前生效默认值视图。
*/
function resolveDefaultsView(store, persisted = {}) {
	return toView(store.get(), persisted);
}
/**
* 校验并归一化 POST body 为存储 patch。严格协议：仅接受七个已知键；
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
		"mediaMode",
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
		if (key === "mediaMode") {
			if (typeof value !== "string" || value !== "text" && value !== "image" && value !== "video") return {
				ok: false,
				error: "mediaMode 必须是 text / image / video 之一"
			};
			patch[key] = value;
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
		if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 30) return {
			ok: false,
			error: `videoDuration 必须是 1-30 的整数秒`
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
//#region src/media-mode-injection.ts
/** 摘要在 log 中的 section 名，同时也是注入消息的来源标识。 */
const INJECTION_SECTION_NAME = "image-video.media-mode";
/**
* 渲染当前媒体模式对应的模型指令。工具会按「显式参数 > 运行时覆盖 > settings 持久
* 默认 > 内置默认」取参，故指令要求模型不要抢先传生成参数，让 composer 选的生效值
* 真正落实。
* @param view - 当前生效的默认值视图（{@link resolveDefaultsView}）。
* @returns 指令文本；'text' 模式或不认识的模式返回 undefined（不注入）。
*/
function renderMediaModeInstruction(view) {
	if (view.mediaMode === "image") return [
		"【图片生成模式】用户已把输入框切到「图片」模式：请直接调用 generate_image 生成图片，不要只回复文字。",
		"把用户本条消息本身作为 prompt；即使消息只是问候或祝福（例如「中秋节快乐」），也请据此构思画面并立即生成。",
		`用户未另行指定时不要传 size / model 参数，让当前生效参数（尺寸：${view.imageSize ?? "工具默认"}；风格：${IMAGE_STYLE_OPTIONS.find((option) => option.id === (view.imageStyle ?? ""))?.label ?? "自动"}）生效。`
	].join("");
	if (view.mediaMode === "video") return [
		"【视频生成模式】用户已把输入框切到「视频」模式：请直接调用 generate_video 生成视频，不要只回复文字。",
		"把用户本条消息本身作为 prompt；即使消息只是问候或祝福（例如「中秋节快乐」），也请据此构思画面并立即生成。",
		`用户未另行指定时不要传 aspectRatio / duration / model 参数，让当前生效参数（宽高比：${view.videoAspectRatio ?? "工具默认"}；时长：${view.videoDuration === null ? "工具默认" : `${view.videoDuration} 秒`}）生效。`
	].join("");
}
/**
* 注册 `agent/pre-step` 监听：媒体模式为 image / video 时，在纳入本步的消息之后
* 追加一条插件来源的指令消息。监听器挂载在插件根上下文，按 scope-filtered 分发
* 语义接收每个 agent 的事件；注销随持有本上下文的 fiber 卸载。
* @param ctx - 已注入 `agents` 的上下文。
* @param options - 运行时默认值存储与持久回落层。
*/
function registerMediaModeInjection(ctx, options) {
	const { store, persisted } = options;
	ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
		const decision = await next();
		if (decision.kind === "reject" || signal.aborted) return decision;
		if (agent.session.header.origin === "subagent") return decision;
		if (!messages.some((message) => message.source.kind === "user")) return decision;
		const text = renderMediaModeInstruction(resolveDefaultsView(store, persisted));
		if (text === void 0) return decision;
		return {
			...decision,
			messages: [...decision.messages, createUserMessage({
				content: [{
					type: "text",
					text
				}],
				source: {
					kind: INJECTION_SECTION_NAME,
					form: "snapshot",
					sections: [{
						name: INJECTION_SECTION_NAME,
						text
					}]
				}
			})]
		};
	}, { prepend: true });
}
//#endregion
//#region src/version.ts
/**
* The plugin's own version, surfaced to the browser half through the workbench
* RPC health check.
*
* A published plugin cannot read its own manifest at runtime without bundling
* it, so the value lives here — and `tests/version.test.ts` fails loudly when it
* drifts from `package.json`.
*/
const PLUGIN_VERSION = "0.3.5";
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
//#region src/workbench/outputs.ts
/**
* Listing the output directory, so the workbench can offer "register the file I
* just generated" without going through the generation tools — the smallest
* honest step from a placeholder pane to something that works.
*
* Reading is bounded and tolerant: unknown extensions are skipped, a missing
* directory is an empty list, and unreadable entries never fail the whole list.
*/
/** Extension → media kind, for the kinds the plugin can produce today. */
const MEDIA_EXTENSIONS = {
	".png": "image",
	".jpg": "image",
	".jpeg": "image",
	".webp": "image",
	".gif": "image",
	".mp4": "video",
	".mov": "video",
	".webm": "video",
	".mkv": "video"
};
/**
* List the newest media files in a directory.
* @param directory - absolute output directory.
* @param limit - maximum entries to return (newest first).
* @returns the listing; empty when the directory does not exist.
*/
async function listOutputs(directory, limit = 40) {
	let names;
	try {
		names = await readdir(directory);
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
	const found = [];
	for (const name of names) {
		const kind = MEDIA_EXTENSIONS[extname(name).toLowerCase()];
		if (kind === void 0) continue;
		const path = join(directory, name);
		try {
			const info = await stat(path);
			if (!info.isFile()) continue;
			found.push({
				name,
				path,
				kind,
				bytes: info.size,
				modifiedAt: info.mtime.toISOString()
			});
		} catch {}
	}
	return found.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt)).slice(0, Math.max(0, limit));
}
//#endregion
//#region src/media/ffmpeg.ts
/**
* ffmpeg 的**唯一解析点**与特性检测（`T5-4`）。
*
* 口径（`R-TML-6`/`R-TML-7`）：时间轴导出依赖 ffmpeg，但"有没有装、装在哪、支不支持
* 需要的编码器"必须在这里集中回答，并且**失败也要可操作**——给机器可读的 code 加一句
* 人能照着做的话（装它 / 设 `DSH_FFMPEG_PATH` 指过去），而不是让上层抛一句看不出
* 下一步的英文栈。
*/
/** 环境里可覆盖 ffmpeg 位置的变量名。 */
const FFMPEG_PATH_ENV = "DSH_FFMPEG_PATH";
const DEFAULT_CANDIDATES = [
	"/opt/homebrew/bin/ffmpeg",
	"/usr/local/bin/ffmpeg",
	"/usr/bin/ffmpeg"
];
const defaultRun = (file, args) => new Promise((resolve) => {
	execFile(file, [...args], { timeout: 1e4 }, (error, stdout, stderr) => {
		resolve({
			code: error === null ? 0 : typeof error.code === "number" ? error.code : 1,
			stdout: stdout ?? "",
			stderr: stderr ?? ""
		});
	});
});
/** 提示语：怎么把 ffmpeg 装上或指给宿主。 */
function installHint() {
	return `未找到可用的 ffmpeg。macOS 可执行 \`brew install ffmpeg\`；已装在别处就设 ${FFMPEG_PATH_ENV}=/path/to/ffmpeg 后重试。`;
}
/** 从 `ffmpeg -version` 输出里取版本号。 */
function parseFfmpegVersion(stdout) {
	return /ffmpeg version (\S+)/.exec(stdout)?.[1];
}
/** 从 `-encoders` 输出里看有没有需要的编码器。 */
function parseEncoders(stdout) {
	return {
		h264: /\blibx264\b/.test(stdout) || /\bh264_videotoolbox\b/.test(stdout) || /\bh264\b/.test(stdout),
		aac: /\baac\b/.test(stdout) || /\baac_at\b/.test(stdout)
	};
}
/**
* 解析 ffmpeg 并检测特性。解析顺序：`DSH_FFMPEG_PATH` → PATH 上的 `ffmpeg` → 常见安装位置。
* @param options.env - 环境变量（默认 `process.env`）。
* @param options.run - 命令执行器（测试注入）。
* @param options.candidates - 额外候选路径。
* @returns 探测结果；不可用时 `available: false` 且带 code 与可操作文案。
*/
async function probeFfmpeg(options = {}) {
	const env = options.env ?? process.env;
	const run = options.run ?? defaultRun;
	const explicit = env[FFMPEG_PATH_ENV];
	const candidates = [
		...explicit === void 0 || explicit === "" ? [] : [explicit],
		...options.candidates ?? [],
		...DEFAULT_CANDIDATES.slice(options.candidates === void 0 ? 0 : DEFAULT_CANDIDATES.length)
	];
	let found;
	let sawPermissionProblem = false;
	for (const candidate of options.strict === true ? candidates : [...candidates, "ffmpeg"]) {
		if (candidate === "ffmpeg") {
			const attempt = await run("ffmpeg", ["-version"]).catch(() => void 0);
			if (attempt !== void 0 && attempt.code === 0) {
				found = "ffmpeg";
				break;
			}
			continue;
		}
		try {
			await access(candidate, constants.X_OK);
			found = candidate;
			break;
		} catch (error) {
			if (error.code === "EACCES") sawPermissionProblem = true;
		}
	}
	if (found === void 0) return {
		available: false,
		code: sawPermissionProblem ? "MEDIA_FFMPEG_NOT_EXECUTABLE" : "MEDIA_FFMPEG_UNAVAILABLE",
		message: sawPermissionProblem ? `找到 ffmpeg 但没有执行权限（${installHint()}）` : installHint()
	};
	const versionRun = await run(found, ["-version"]).catch(() => ({
		code: 1,
		stdout: "",
		stderr: "spawn failed"
	}));
	if (versionRun.code !== 0) {
		const permission = /EACCES|permission denied/i.test(versionRun.stderr);
		return {
			available: false,
			code: permission ? "MEDIA_FFMPEG_NOT_EXECUTABLE" : "MEDIA_FFMPEG_UNAVAILABLE",
			path: found,
			message: permission ? `ffmpeg 存在但跑不起来（权限被拒）：${found}。修权限或设 ${FFMPEG_PATH_ENV} 指向可执行副本。` : `ffmpeg 无法执行（退出码 ${versionRun.code}）：${versionRun.stderr.trim().slice(0, 200)}`
		};
	}
	const version = parseFfmpegVersion(versionRun.stdout);
	const encoders = parseEncoders((await run(found, ["-hide_banner", "-encoders"]).catch(() => ({
		code: 1,
		stdout: "",
		stderr: ""
	}))).stdout);
	if (!encoders.h264) return {
		available: false,
		code: "MEDIA_FFMPEG_ENCODER_MISSING",
		path: found,
		...version === void 0 ? {} : { version },
		encoders,
		message: `这份 ffmpeg 没有 H.264 编码器（试过 libx264/videotoolbox）。装带 libx264 的构建：\`brew install ffmpeg\`，或用 ${FFMPEG_PATH_ENV} 指向带编码器的副本。`
	};
	return {
		available: true,
		path: found,
		...version === void 0 ? {} : { version },
		encoders
	};
}
//#endregion
//#region src/media/retention.ts
const DEFAULT_KEEP_NEWEST = 20;
/**
* 计算清理计划（不执行删除）。
* @param files - 目录里的文件。
* @param policy - 上限与保护名单。
* @returns 计划。
*/
function planRetention(files, policy = {}) {
	const keepNewest = Math.max(0, Math.floor(policy.keepNewest ?? DEFAULT_KEEP_NEWEST));
	const protect = new Set(policy.protect ?? []);
	const sorted = [...files].sort((left, right) => right.mtimeMs - left.mtimeMs);
	const protectedNewest = new Set(sorted.slice(0, keepNewest).map((file) => file.name));
	let totalBytes = sorted.reduce((sum, file) => sum + Math.max(0, file.bytes), 0);
	let totalFiles = sorted.length;
	const removed = [];
	for (const file of [...sorted].reverse()) {
		const overBytes = policy.maxBytes !== void 0 && totalBytes > policy.maxBytes;
		const overFiles = policy.maxFiles !== void 0 && totalFiles > policy.maxFiles;
		if (!overBytes && !overFiles) break;
		if (protect.has(file.name) || protectedNewest.has(file.name)) continue;
		removed.push(file);
		totalBytes -= Math.max(0, file.bytes);
		totalFiles -= 1;
	}
	const overQuota = policy.maxBytes !== void 0 && totalBytes > policy.maxBytes || policy.maxFiles !== void 0 && totalFiles > policy.maxFiles;
	return {
		removed,
		keptFiles: totalFiles,
		keptBytes: totalBytes,
		freedBytes: removed.reduce((sum, file) => sum + Math.max(0, file.bytes), 0),
		overQuota
	};
}
/** 计算一个文件的 sha256。 */
async function sha256File(path) {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}
/**
* 把一个项目导出成包。
* @param input.store - 工作台存储。
* @param input.projectId - 要导出的项目。
* @param input.targetDir - 包目录（不存在会创建；已存在则覆盖同名文件）。
* @param input.now - 时钟（测试注入）。
* @returns 清单路径与清单内容。
* @throws {Error} 项目不存在时。
*/
async function exportProjectPackage(input) {
	const { store, projectId, targetDir } = input;
	const project = (await store.listProjects()).find((candidate) => candidate.id === projectId);
	if (project === void 0) throw new Error(`unknown project: ${projectId}`);
	await mkdir(join(targetDir, "files"), { recursive: true });
	const assets = [];
	const missing = [];
	for (const asset of await store.listAssets(projectId)) {
		const info = await stat(asset.path).catch(() => void 0);
		if (info === void 0 || !info.isFile()) {
			missing.push(asset.path);
			assets.push({
				id: asset.id,
				kind: asset.kind,
				bytes: asset.bytes,
				originPath: asset.path,
				...asset.prompt === void 0 ? {} : { prompt: asset.prompt }
			});
			continue;
		}
		const file = `files/${asset.id}-${basename(asset.path)}`;
		await copyFile(asset.path, join(targetDir, file));
		assets.push({
			id: asset.id,
			kind: asset.kind,
			file,
			bytes: info.size,
			sha256: await sha256File(asset.path),
			originPath: asset.path,
			...asset.prompt === void 0 ? {} : { prompt: asset.prompt }
		});
	}
	const manifest = {
		formatVersion: 1,
		plugin: "dsh-image-video",
		exportedAt: (input.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
		project: {
			id: project.id,
			name: project.name,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt
		},
		assets,
		resources: await store.listResources(projectId),
		timelines: await store.listTimelines(projectId),
		workflows: await store.listWorkflows(projectId),
		tasks: await store.listTasks(100, projectId),
		missing
	};
	const manifestPath = join(targetDir, "manifest.json");
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	return {
		manifestPath,
		manifest
	};
}
/** 把节点参数/轨道里指向旧路径的字符串改写成新路径。 */
function rewritePaths(value, mapping) {
	if (typeof value === "string") return mapping.get(value) ?? value;
	if (Array.isArray(value)) return value.map((item) => rewritePaths(item, mapping));
	if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewritePaths(item, mapping)]));
	return value;
}
/**
* 导入一个项目包。
* @param input.store - 存储。
* @param input.packageDir - 包目录（含 `manifest.json`）。
* @param input.outputsDir - 素材落地目录（`merge` 模式复制文件到这里）。
* @param input.mode - `merge`（默认，复制素材）或 `structure-only`（只导结构）。
* @param input.nameSuffix - 新项目名后缀（默认「（导入）」）。
* @returns 导入结果。
* @throws {Error} 包格式版本不认识、或清单缺字段时。
*/
async function importProjectPackage(input) {
	const { store, packageDir, outputsDir } = input;
	const structureOnly = input.mode === "structure-only";
	const raw = JSON.parse(await readFile(join(packageDir, "manifest.json"), "utf8"));
	if (raw.plugin !== "dsh-image-video") throw new Error("这不是本插件导出的项目包（manifest.plugin 不匹配）");
	const version = typeof raw.formatVersion === "number" ? raw.formatVersion : 0;
	if (version < 1 || version > 1) throw new Error(`包格式版本 ${version} 不认识（本版本支持 1..1）：请用对应的插件版本导入。`);
	if (raw.project === void 0) throw new Error("包清单缺少 project 段");
	const project = await store.createProject(`${raw.project.name}${input.nameSuffix ?? "（导入）"}`);
	await mkdir(outputsDir, { recursive: true });
	const missing = [];
	const mapping = /* @__PURE__ */ new Map();
	let assetCount = 0;
	for (const entry of raw.assets ?? []) {
		if (structureOnly || entry.file === void 0) {
			missing.push(entry.originPath);
			if (structureOnly) {
				await store.attachAsset({
					projectId: project.id,
					path: entry.originPath,
					kind: entry.kind,
					bytes: entry.bytes
				});
				mapping.set(entry.originPath, entry.originPath);
				assetCount += 1;
			}
			continue;
		}
		const inside = join(packageDir, entry.file);
		const info = await stat(inside).catch(() => void 0);
		if (info === void 0) {
			missing.push(entry.originPath);
			continue;
		}
		if (entry.sha256 !== void 0 && await sha256File(inside) !== entry.sha256) {
			missing.push(`${entry.originPath}（包内副本校验和不符）`);
			continue;
		}
		const targetPath = join(outputsDir, `${entry.id}-${basename(entry.originPath)}`);
		await copyFile(inside, targetPath);
		await store.attachAsset({
			projectId: project.id,
			path: targetPath,
			kind: entry.kind,
			bytes: info.size,
			...entry.prompt === void 0 ? {} : { prompt: entry.prompt }
		});
		mapping.set(entry.originPath, targetPath);
		assetCount += 1;
	}
	const skippedResources = [];
	const seenResourceNames = /* @__PURE__ */ new Set();
	for (const resource of raw.resources ?? []) {
		const key = `${resource.kind}:${resource.name}`;
		if (seenResourceNames.has(key)) {
			skippedResources.push(resource.name);
			continue;
		}
		seenResourceNames.add(key);
		await store.createResource({
			projectId: project.id,
			kind: resource.kind,
			name: resource.name,
			...resource.note === void 0 ? {} : { note: resource.note },
			...resource.keyframes === void 0 ? {} : { keyframes: resource.keyframes }
		});
	}
	for (const timeline of raw.timelines ?? []) await store.saveTimeline({
		projectId: project.id,
		name: timeline.name,
		frameRate: timeline.frameRate,
		burnSubtitles: timeline.burnSubtitles,
		tracks: rewritePaths(timeline.tracks, mapping)
	});
	for (const workflow of raw.workflows ?? []) await store.saveWorkflow({
		projectId: project.id,
		name: workflow.name,
		nodes: rewritePaths(workflow.nodes, mapping),
		edges: workflow.edges
	});
	const tasksImported = await store.importTasks(project.id, raw.tasks ?? []);
	return {
		projectId: project.id,
		projectName: project.name,
		assets: assetCount,
		missing,
		skippedResources,
		tasksImported,
		structureOnly
	};
}
/**
* 把一个项目的创作资源导出成资源包。
* @param input.store - 存储。
* @param input.projectId - 源项目。
* @param input.targetDir - 输出目录。
* @param input.now - 时钟。
* @returns 清单路径与内容。
*/
async function exportResourcePackage(input) {
	const project = (await input.store.listProjects()).find((candidate) => candidate.id === input.projectId);
	if (project === void 0) throw new Error(`unknown project: ${input.projectId}`);
	const manifest = {
		formatVersion: 1,
		plugin: "dsh-image-video",
		exportedAt: (input.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
		source: {
			projectId: project.id,
			projectName: project.name
		},
		resources: await input.store.listResources(project.id)
	};
	await mkdir(input.targetDir, { recursive: true });
	const manifestPath = join(input.targetDir, "resources.json");
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	return {
		manifestPath,
		manifest
	};
}
/**
* 把资源包导入一个项目。
* 口径（`T8-3`）：**默认绝不覆盖同名资源**；冲突按策略处理并逐条报出来。
* @param input.store - 存储。
* @param input.projectId - 目标项目。
* @param input.packageDir - 含 `resources.json` 的目录（也可直接给该文件路径）。
* @param input.strategy - `skip`（默认）/`rename`/`replace`。
* @returns 导入报告。
* @throws {Error} 包格式不认识时。
*/
async function importResourcePackage(input) {
	const file = input.packageDir.endsWith(".json") ? input.packageDir : join(input.packageDir, "resources.json");
	const raw = JSON.parse(await readFile(file, "utf8"));
	if (raw.plugin !== "dsh-image-video") throw new Error("这不是本插件导出的资源包（manifest.plugin 不匹配）");
	const version = typeof raw.formatVersion === "number" ? raw.formatVersion : 0;
	if (version < 1 || version > 1) throw new Error(`资源包格式版本 ${version} 不认识（本版本支持 1..1）。`);
	const strategy = input.strategy ?? "skip";
	const existing = await input.store.listResources(input.projectId);
	const skipped = [];
	const renamed = [];
	const replaced = [];
	let imported = 0;
	for (const resource of raw.resources ?? []) {
		const clash = existing.find((candidate) => candidate.kind === resource.kind && candidate.name === resource.name);
		let name = resource.name;
		if (clash !== void 0) {
			if (strategy === "skip") {
				skipped.push(resource.name);
				continue;
			}
			if (strategy === "rename") {
				let suffix = 2;
				while (existing.some((candidate) => candidate.kind === resource.kind && candidate.name === `${resource.name} (${suffix})`)) suffix += 1;
				name = `${resource.name} (${suffix})`;
				renamed.push(`${resource.name} → ${name}`);
			}
			if (strategy === "replace") {
				await input.store.removeResource(clash.id, { force: true });
				replaced.push(resource.name);
			}
		}
		await input.store.createResource({
			projectId: input.projectId,
			kind: resource.kind,
			name,
			...resource.note === void 0 ? {} : { note: resource.note },
			...resource.keyframes === void 0 ? {} : { keyframes: resource.keyframes }
		});
		imported += 1;
	}
	return {
		imported,
		skipped,
		renamed,
		replaced
	};
}
/** 轨迹最长覆盖 10 分钟。 */
const MAX_MOTION_DURATION_MS = 6e5;
/**
* Validate a resource name.
* @param value - raw name.
* @returns the trimmed name.
* @throws {Error} when it is empty or too long.
*/
/**
* 校验资源作用域（`R-COL-1`）。
* @param value - 原始取值；缺省即 `project`（V1 只写这一个）。
* @returns 作用域。
* @throws {Error} 取值不在白名单时。
*/
function normalizeResourceScope(value) {
	if (value === void 0 || value === null || value === "") return "project";
	if (value === "project" || value === "team" || value === "public") return value;
	throw new Error("resource scope must be one of project/team/public");
}
function normalizeResourceName(value) {
	if (typeof value !== "string") throw new Error("resource name must be a string");
	const name = value.trim();
	if (name.length === 0) throw new Error("resource name must not be empty");
	if (name.length > 80) throw new Error(`resource name must be at most 80 characters`);
	return name;
}
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
* Validate a user-supplied project name.
* @param value - raw name from the client.
* @returns the trimmed name.
* @throws {Error} when the name is empty or too long.
*/
function normalizeProjectName(value) {
	if (typeof value !== "string") throw new Error("project name must be a string");
	const name = value.trim();
	if (name.length === 0) throw new Error("project name must not be empty");
	if (name.length > 60) throw new Error(`project name must be at most 60 characters`);
	return name;
}
/**
* Validate a resource kind.
* @param value - raw kind.
* @returns the kind.
* @throws {Error} when it is none of the six known kinds.
*/
function normalizeResourceKind(value) {
	if (value === "role" || value === "scene" || value === "prop" || value === "brand" || value === "style" || value === "voice" || value === "motion-track") return value;
	throw new Error("resource kind must be one of role/scene/prop/brand/style/voice/motion-track");
}
/**
* 校验并归一化轨迹关键帧。
* @param value - 待校验的关键帧数组。
* @returns 归一化后的关键帧。
* @throws {Error} 数量、时间点、坐标或缩放越界时（越界一律拒，不做静默截断）。
*/
function normalizeKeyframes(value) {
	if (!Array.isArray(value)) throw new Error("motion keyframes must be an array");
	if (value.length === 0) throw new Error("motion track needs at least one keyframe");
	if (value.length > 120) throw new Error(`motion track supports at most 120 keyframes, got ${value.length}`);
	let previous = -1;
	return value.map((raw, index) => {
		if (typeof raw !== "object" || raw === null) throw new Error(`keyframe ${index} must be an object`);
		const frame = raw;
		const number = (key, min, max) => {
			const candidate = frame[key];
			if (typeof candidate !== "number" || !Number.isFinite(candidate)) throw new Error(`keyframe ${index} ${key} must be a finite number`);
			if (candidate < min || candidate > max) throw new Error(`keyframe ${index} ${key} must be between ${min} and ${max}`);
			return candidate;
		};
		const tMs = Math.round(number("tMs", 0, MAX_MOTION_DURATION_MS));
		if (index > 0 && tMs < previous) throw new Error(`keyframe ${index} tMs must not go backwards`);
		previous = tMs;
		const x = number("x", 0, 1);
		const y = number("y", 0, 1);
		const scale = frame.scale === void 0 ? void 0 : number("scale", .1, 10);
		return {
			tMs,
			x,
			y,
			...scale === void 0 ? {} : { scale }
		};
	});
}
/**
* Validate a task status.
* @param value - raw status.
* @returns the status.
* @throws {Error} when it is not one of the five known states.
*/
function normalizeTaskStatus(value) {
	if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") return value;
	throw new Error("task status must be one of queued/running/succeeded/failed/cancelled");
}
/**
* Validate a media kind from the client.
* @param value - raw kind.
* @returns the kind.
* @throws {Error} when it is neither `image` nor `video`.
*/
function normalizeMediaKind(value) {
	if (value === "image" || value === "video") return value;
	throw new Error("media kind must be \"image\" or \"video\"");
}
//#endregion
//#region src/host/rpc.ts
let status = {
	channel: WORKBENCH_RPC_CHANNEL,
	registered: false,
	awaiting: false
};
/** Read the host-side registration state (served by `/image-video/status`). */
function workbenchRpcStatus() {
	return status;
}
/**
* 默认值编辑器的可选项：直接复用协议层的白名单，避免界面允许值与被拒值分叉。
*
* 服务端下发而不是客户端内置——浏览器包里出现服务商名会被
* `tests/client-no-hardcoding.test.ts` 判为部署配置泄漏（`T2-11`）。
* @returns 与协议层校验同源的下拉选项。
*/
function workbenchOptions() {
	return {
		imageProviders: PROVIDERS.filter((provider) => provider !== "minimax"),
		videoProviders: [...PROVIDERS],
		imageSizes: IMAGE_SIZE_OPTIONS,
		imageStyles: IMAGE_STYLE_OPTIONS.filter((option) => option.id !== "").map((option) => option.id),
		videoAspectRatios: [...VIDEO_ASPECT_RATIOS],
		videoDuration: {
			min: 1,
			max: 30
		}
	};
}
/**
* Build the channel handler.
* @param deps - host facts the answers are built from.
* @returns the connection RPC handler.
*/
function createWorkbenchHandler(deps) {
	return async (endpoint, payload) => {
		try {
			return {
				ok: true,
				value: await answer(deps, endpoint, payload)
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				error: {
					code: message.startsWith("unknown workbench endpoint") ? "workbench/unknown-endpoint" : message.startsWith("invalid workbench payload") ? "workbench/invalid-payload" : "workbench/failed",
					message,
					details: {}
				}
			};
		}
	};
}
/**
* Answer one endpoint. Payloads are read field by field through {@link field}, so a
* malformed request fails with a named error instead of a TypeError deep in the store.
* @param deps - host facts.
* @param endpoint - channel-relative endpoint.
* @param payload - raw request payload.
* @returns the endpoint's value.
*/
async function answer(deps, endpoint, payload) {
	switch (endpoint) {
		case "health": return {
			plugin: "dsh-image-video",
			version: PLUGIN_VERSION,
			channel: WORKBENCH_RPC_CHANNEL,
			provider: deps.provider,
			outputsDir: deps.outputsDir,
			at: (/* @__PURE__ */ new Date()).toISOString(),
			...deps.defaults === void 0 ? {} : { defaults: deps.defaults() },
			...deps.options === void 0 ? {} : { options: deps.options() }
		};
		case "projects/list": return { projects: await deps.store.listProjects() };
		case "projects/create": return { project: await deps.store.createProject(validated(() => normalizeProjectName(field(payload, "name")))) };
		case "projects/remove": return { removed: await deps.store.removeProject(text(payload, "id")) };
		case "assets/list": return { assets: await deps.store.listAssets(text(payload, "projectId")) };
		case "assets/attach": return await deps.store.attachAsset({
			projectId: text(payload, "projectId"),
			path: text(payload, "path"),
			kind: validated(() => normalizeMediaKind(text(payload, "kind"))),
			bytes: optionalNumber(payload, "bytes"),
			provider: optionalText(payload, "provider"),
			model: optionalText(payload, "model"),
			prompt: optionalText(payload, "prompt")
		});
		case "assets/quick-add": {
			const path = text(payload, "path");
			const explicit = optionalText(payload, "projectId");
			const listed = await deps.store.listProjects();
			const target = (explicit !== void 0 && explicit !== "" ? listed.find((candidate) => candidate.id === explicit) : listed[0]) ?? await deps.store.createProject("对话素材");
			const kind = field(payload, "kind") === "image" || field(payload, "kind") === "video" ? field(payload, "kind") : /\.(png|jpe?g|webp|gif)$/i.test(path) ? "image" : "video";
			const { stat } = await import("node:fs/promises");
			const size = await stat(path).then((info) => info.size).catch(() => void 0);
			const attached = await deps.store.attachAsset({
				projectId: target.id,
				path,
				kind,
				...size === void 0 ? {} : { bytes: size },
				...optionalText(payload, "prompt") === void 0 ? {} : { prompt: optionalText(payload, "prompt") },
				...optionalText(payload, "model") === void 0 ? {} : { model: optionalText(payload, "model") },
				...optionalText(payload, "provider") === void 0 ? {} : { provider: optionalText(payload, "provider") }
			});
			if (field(payload, "intoTimeline") !== true) return {
				projectId: target.id,
				projectName: target.name,
				asset: attached.asset,
				created: attached.created
			};
			const stamp = Date.now().toString(36);
			const base = (await deps.store.listTimelines(target.id))[0] ?? await deps.store.saveTimeline({
				projectId: target.id,
				name: `${target.name} 成片`,
				tracks: [
					{
						id: "v1",
						kind: "video",
						clips: []
					},
					{
						id: "a1",
						kind: "audio",
						clips: []
					},
					{
						id: "s1",
						kind: "subtitle",
						clips: []
					}
				]
			});
			const durationMs = typeof field(payload, "durationMs") === "number" ? Math.max(1, Math.round(field(payload, "durationMs"))) : 3e3;
			let clipId = "";
			const tracks = base.tracks.map((track) => {
				if (track.kind !== "video") return {
					...track,
					clips: [...track.clips]
				};
				const end = track.clips.reduce((longest, clip) => Math.max(longest, clip.startMs + clip.durationMs), 0);
				clipId = `clip-${stamp}-quick`;
				return {
					...track,
					clips: [...track.clips, {
						id: clipId,
						assetPath: attached.asset.path,
						startMs: end,
						durationMs
					}]
				};
			});
			const saved = await deps.store.saveTimeline({
				id: base.id,
				projectId: base.projectId,
				name: base.name,
				tracks,
				frameRate: base.frameRate,
				burnSubtitles: base.burnSubtitles
			});
			return {
				projectId: target.id,
				projectName: target.name,
				asset: attached.asset,
				created: attached.created,
				timelineId: saved.id,
				clipId
			};
		}
		case "assets/remove": return { removed: await deps.store.removeAsset(text(payload, "id"), field(payload, "force") === true ? { force: true } : {}) };
		case "projects/rename": {
			const id = text(payload, "id");
			const project = await deps.store.renameProject(id, validated(() => normalizeProjectName(field(payload, "name"))));
			if (project === void 0) throw new Error(`unknown project: ${id}`);
			return { project };
		}
		case "resources/list": {
			const kind = optionalText(payload, "kind");
			return { resources: await deps.store.listResources(text(payload, "projectId"), kind === void 0 ? void 0 : validated(() => normalizeResourceKind(kind))) };
		}
		case "resources/create": return { resource: await deps.store.createResource({
			projectId: text(payload, "projectId"),
			kind: validated(() => normalizeResourceKind(text(payload, "kind"))),
			name: validated(() => normalizeResourceName(field(payload, "name"))),
			note: optionalText(payload, "note"),
			...field(payload, "keyframes") === void 0 ? {} : { keyframes: field(payload, "keyframes") }
		}) };
		case "resources/remove": return { removed: await deps.store.removeResource(text(payload, "id"), field(payload, "force") === true ? { force: true } : {}) };
		case "tasks/list": {
			const limit = optionalNumber(payload, "limit");
			const projectId = optionalText(payload, "projectId");
			return { tasks: await deps.store.listTasks(limit ?? void 0, projectId) };
		}
		case "workflows/list": return { workflows: await deps.store.listWorkflows(text(payload, "projectId")) };
		case "workflows/save": return { workflow: await deps.store.saveWorkflow({
			id: optionalText(payload, "id"),
			projectId: text(payload, "projectId"),
			name: optionalText(payload, "name"),
			nodes: field(payload, "nodes") ?? [],
			edges: field(payload, "edges") ?? []
		}) };
		case "workflows/remove": return { removed: await deps.store.removeWorkflow(text(payload, "id")) };
		case "workflows/run": {
			const workflowId = text(payload, "workflowId");
			const workflow = await deps.store.findWorkflow(workflowId);
			if (workflow === void 0) throw new Error(`unknown workflow: ${workflowId}`);
			return { run: await deps.runner.begin(workflow) };
		}
		case "workflows/runs": return { runs: await deps.store.listRuns(text(payload, "projectId"), optionalText(payload, "workflowId")) };
		case "workflows/run-cancel": return { cancelled: deps.runner.cancel(text(payload, "runId")) };
		case "workflows/run-retry": {
			const runId = text(payload, "runId");
			const previous = await deps.store.findRun(runId);
			if (previous === void 0) throw new Error(`unknown run: ${runId}`);
			return { run: await deps.runner.retry(previous) };
		}
		case "diagnostics": {
			const data = await deps.store.stats();
			const jobs = deps.renders.list();
			const running = jobs.filter((job) => job.status === "running" && job.queued !== true).length;
			const queued = jobs.filter((job) => job.queued === true).length;
			const outputs = await listOutputs(deps.outputsDir);
			const outputBytes = outputs.reduce((sum, file) => sum + Math.max(0, file.bytes), 0);
			const stamps = outputs.map((file) => Date.parse(file.modifiedAt ?? "")).filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
			const referencedFiles = (await deps.store.referencedAssetPaths()).length;
			return {
				plugin: {
					name: "dsh-image-video",
					version: PLUGIN_VERSION
				},
				provider: deps.provider,
				outputsDir: deps.outputsDir,
				data,
				renders: {
					running,
					queued,
					recent: jobs.slice(0, 5).map((job) => ({
						id: job.id,
						status: job.status,
						percent: job.percent,
						queued: job.queued ?? false
					}))
				},
				runs: { running: data.runningRuns },
				cache: { nodeResults: data.nodeCache },
				outputs: {
					files: outputs.length,
					bytes: outputBytes,
					referenced: referencedFiles,
					...stamps.length === 0 ? {} : {
						oldestAt: new Date(stamps[0]).toISOString(),
						newestAt: new Date(stamps[stamps.length - 1]).toISOString()
					}
				},
				errors: deps.diagnostics?.snapshot() ?? {
					errors: [],
					errorCount: 0
				}
			};
		}
		case "resources/usage": return { usage: await deps.store.listResourceUsage({
			...optionalText(payload, "resourceId") === void 0 ? {} : { resourceId: optionalText(payload, "resourceId") },
			...optionalText(payload, "projectId") === void 0 ? {} : { projectId: optionalText(payload, "projectId") }
		}) };
		case "packages/export": {
			const projectId = text(payload, "projectId");
			const target = optionalText(payload, "targetDir");
			const base = resolve(deps.outputsDir, "..", "packages");
			const chosen = target === void 0 || target === "" ? resolve(base, projectId) : resolve(target);
			if (chosen !== base && !chosen.startsWith(base + sep)) throw new Error(`导出目录必须在 ${base} 之下（收到 ${chosen}）：这是安全边界，避免任意路径写入。`);
			const { manifestPath, manifest } = await exportProjectPackage({
				store: deps.store,
				projectId,
				targetDir: chosen
			});
			return { package: {
				manifestPath,
				formatVersion: manifest.formatVersion,
				assets: manifest.assets.length,
				missing: manifest.missing.length
			} };
		}
		case "packages/import": return { imported: await importProjectPackage({
			store: deps.store,
			packageDir: text(payload, "packageDir"),
			outputsDir: deps.outputsDir,
			...field(payload, "mode") === "structure-only" ? { mode: "structure-only" } : {}
		}) };
		case "packages/export-resources": {
			const projectId = text(payload, "projectId");
			const target = optionalText(payload, "targetDir");
			const base = resolve(deps.outputsDir, "..", "packages");
			const chosen = target === void 0 || target === "" ? resolve(base, `${projectId}-resources`) : resolve(target);
			if (chosen !== base && !chosen.startsWith(base + sep)) throw new Error(`资源包目录必须在 ${base} 之下（收到 ${chosen}）：这是安全边界，避免任意路径写入。`);
			const { manifestPath, manifest } = await exportResourcePackage({
				store: deps.store,
				projectId,
				targetDir: chosen
			});
			return { package: {
				manifestPath,
				formatVersion: manifest.formatVersion,
				resources: manifest.resources.length
			} };
		}
		case "packages/import-resources": {
			const strategy = field(payload, "strategy");
			return { imported: await importResourcePackage({
				store: deps.store,
				projectId: text(payload, "projectId"),
				packageDir: text(payload, "packageDir"),
				...strategy === "rename" || strategy === "replace" || strategy === "skip" ? { strategy } : {}
			}) };
		}
		case "media/ffmpeg": {
			const candidate = optionalText(payload, "path");
			return { ffmpeg: await probeFfmpeg(candidate === void 0 || candidate === "" ? {} : {
				candidates: [candidate],
				strict: true
			}) };
		}
		case "timelines/list": return { timelines: await deps.store.listTimelines(text(payload, "projectId")) };
		case "timelines/save": return { timeline: await deps.store.saveTimeline({
			id: optionalText(payload, "id"),
			projectId: text(payload, "projectId"),
			name: optionalText(payload, "name"),
			tracks: field(payload, "tracks") ?? [],
			...typeof field(payload, "frameRate") === "number" ? { frameRate: field(payload, "frameRate") } : {},
			...typeof field(payload, "burnSubtitles") === "boolean" ? { burnSubtitles: field(payload, "burnSubtitles") } : {},
			...field(payload, "exportFormat") === void 0 ? {} : { exportFormat: field(payload, "exportFormat") }
		}) };
		case "timelines/remove": return { removed: await deps.store.removeTimeline(text(payload, "id")) };
		case "timelines/render": {
			const timelineId = text(payload, "timelineId");
			const timeline = await deps.store.findTimeline(timelineId);
			if (timeline === void 0) throw new Error(`unknown timeline: ${timelineId}`);
			const projectId = optionalText(payload, "projectId");
			if (projectId !== void 0 && projectId !== "" && projectId !== timeline.projectId) throw new Error(`timeline ${timelineId} does not belong to project ${projectId}`);
			return { render: deps.renders.start(timeline) };
		}
		case "timelines/renders": return { renders: deps.renders.list(optionalText(payload, "projectId")) };
		case "timelines/render-cancel": return { cancelled: deps.renders.cancel(text(payload, "renderId")) };
		case "maintenance/retention": {
			const files = (await listOutputs(deps.outputsDir)).map((file) => ({
				name: file.name,
				bytes: file.bytes,
				mtimeMs: Date.parse(file.modifiedAt ?? "") || 0
			}));
			const referenced = new Set((await deps.store.referencedAssetPaths()).map((path) => path.split("/").pop() ?? path));
			const plan = planRetention(files, {
				...optionalNumber(payload, "maxBytes") === void 0 ? {} : { maxBytes: optionalNumber(payload, "maxBytes") },
				...optionalNumber(payload, "maxFiles") === void 0 ? {} : { maxFiles: optionalNumber(payload, "maxFiles") },
				...optionalNumber(payload, "keepNewest") === void 0 ? {} : { keepNewest: optionalNumber(payload, "keepNewest") },
				protect: referenced
			});
			const dryRun = field(payload, "dryRun") !== false;
			let deleted = 0;
			if (!dryRun) for (const file of plan.removed) {
				if (file.name.includes("/") || file.name.includes("\\")) continue;
				try {
					await unlink(join(deps.outputsDir, file.name));
					deleted += 1;
				} catch {}
			}
			return {
				dryRun,
				deleted,
				plan: {
					remove: plan.removed.map((file) => ({
						name: file.name,
						bytes: file.bytes
					})),
					keptFiles: plan.keptFiles,
					keptBytes: plan.keptBytes,
					freedBytes: plan.freedBytes,
					overQuota: plan.overQuota
				},
				hint: dryRun ? "这是预演：确认无误后用 dryRun=false 真正清理" : "已按计划清理"
			};
		}
		case "maintenance/compact": return { removed: await deps.store.compactAssets() };
		case "tasks/cancel": return { cancelled: deps.registry.cancel(text(payload, "id")) };
		case "tasks/running": return { running: deps.registry.list() };
		case "tasks/assign": {
			const id = text(payload, "id");
			const task = await deps.store.updateTask(id, { projectId: text(payload, "projectId") });
			if (task === void 0) throw new Error(`unknown task: ${id}`);
			return { task };
		}
		case "outputs/list": {
			const limit = optionalNumber(payload, "limit");
			return {
				outputs: await listOutputs(deps.outputsDir, limit ?? void 0),
				directory: deps.outputsDir
			};
		}
		default: throw new Error(`unknown workbench endpoint: ${endpoint}`);
	}
}
/**
* Run a payload validation, re-tagging its failure so the client sees
* `workbench/invalid-payload` instead of a generic failure.
* @param validate - validator to run.
* @returns the validated value.
*/
function validated(validate) {
	try {
		return validate();
	} catch (error) {
		throw new Error(`invalid workbench payload: ${error instanceof Error ? error.message : String(error)}`);
	}
}
/** Read one required string field. */
function text(payload, key) {
	const value = field(payload, key);
	if (typeof value !== "string" || value.length === 0) throw new Error(`invalid workbench payload: ${key} must be a non-empty string`);
	return value;
}
/** Read one optional string field. */
function optionalText(payload, key) {
	const value = field(payload, key);
	if (value === void 0 || value === null) return void 0;
	if (typeof value !== "string") throw new Error(`invalid workbench payload: ${key} must be a string`);
	return value;
}
/** Read one optional number field. */
function optionalNumber(payload, key) {
	const value = field(payload, key);
	if (value === void 0 || value === null) return void 0;
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`invalid workbench payload: ${key} must be a finite number`);
	return value;
}
/** Read one field out of an untyped payload. */
function field(payload, key) {
	if (typeof payload !== "object" || payload === null) {
		if (payload === void 0) return void 0;
		throw new Error("invalid workbench payload: expected an object");
	}
	return payload[key];
}
/**
* Register the channel on this plugin's fiber: the disposer lifts it on unload,
* so a disabled plugin leaves no callable endpoint behind.
* @param ctx - host context already carrying the `connection` service.
* @param deps - host facts the answers are built from.
*/
function registerWorkbenchRpc(ctx, deps) {
	status = {
		...status,
		awaiting: true
	};
	ctx.effect(() => {
		const connection = ctx.get("connection");
		if (connection === void 0) return () => {};
		try {
			const remove = connection.rpc.handle(WORKBENCH_RPC_CHANNEL, createWorkbenchHandler(deps));
			status = {
				channel: WORKBENCH_RPC_CHANNEL,
				registered: true,
				awaiting: false
			};
			return () => {
				status = {
					channel: WORKBENCH_RPC_CHANNEL,
					registered: false,
					awaiting: false
				};
				remove();
			};
		} catch (error) {
			status = {
				channel: WORKBENCH_RPC_CHANNEL,
				registered: false,
				awaiting: false,
				error: error instanceof Error ? error.message : String(error)
			};
			return () => {};
		}
	}, "dsh-image-video: workbench RPC channel");
}
//#endregion
//#region src/host/diagnostics.ts
const MAX_ERRORS = 50;
/** 单条消息上限，防止把整段堆栈/大对象塞进快照。 */
const MAX_MESSAGE = 300;
var DiagnosticsCollector = class {
	ring = [];
	total = 0;
	now;
	constructor(options = {}) {
		this.now = options.now ?? (() => /* @__PURE__ */ new Date());
	}
	/**
	* 记一条错误。
	* @param source - 来源分类。
	* @param message - 面向人的一句话（超长会截断）。
	* @param code - 可选机器码。
	*/
	recordError(source, message, code) {
		this.total += 1;
		const trimmed = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE)}…` : message;
		this.ring.push({
			source: source.slice(0, 40),
			message: trimmed,
			at: this.now().toISOString(),
			...code === void 0 ? {} : { code: code.slice(0, 60) }
		});
		if (this.ring.length > MAX_ERRORS) this.ring.shift();
	}
	/** 取快照（最新在前）。 */
	snapshot() {
		return {
			errors: [...this.ring].reverse(),
			errorCount: this.total
		};
	}
};
//#endregion
//#region src/host/status-route.ts
/** Exact route the status is served from. */
const WORKBENCH_STATUS_ROUTE_PATH = "/image-video/status";
/**
* Build the status handler.
* @param deps - host facts to report.
* @returns a Node request handler writing one JSON document.
*/
function createWorkbenchStatusHandler(deps) {
	return (_request, response) => {
		const body = {
			plugin: "dsh-image-video",
			version: PLUGIN_VERSION,
			channel: WORKBENCH_RPC_CHANNEL,
			rpc: workbenchRpcStatus(),
			provider: deps.provider,
			outputsDir: deps.outputsDir,
			at: (/* @__PURE__ */ new Date()).toISOString()
		};
		response.writeHead(200, {
			"content-type": "application/json",
			"cache-control": "no-store"
		});
		response.end(JSON.stringify(body));
	};
}
/**
* Register the status route; loopback deployments only, like every other route here.
* @param webServer - host web server.
* @param deps - host facts to report.
* @returns the disposer, or `undefined` when the host is not loopback.
*/
function registerWorkbenchStatusRoute(webServer, deps) {
	if (webServer.host !== "127.0.0.1") return void 0;
	return webServer.register({
		kind: "exact",
		path: WORKBENCH_STATUS_ROUTE_PATH,
		handler: createWorkbenchStatusHandler(deps)
	});
}
const BY_KIND = new Map([
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
].map((spec) => [spec.kind, spec]));
/**
* 校验一个节点种类。
* @param value - 原始值。
* @returns 目录里的种类。
* @throws {Error} 当它不是已知种类。
*/
function normalizeNodeKind(value) {
	if (typeof value !== "string" || !BY_KIND.has(value)) throw new Error(`unknown workflow node kind: ${String(value)}`);
	return value;
}
/**
* 校验画布的节点与连线。
*
* 只做"结构可信"这一层（种类存在、坐标是有限数、连线两端都在图里、不含自环、
* 不超规模）——语义校验（必填参数、端口类型、环检测）属于 `T4-3`，跑在图执行前。
* @param nodes - 待校验节点。
* @param edges - 待校验连线。
* @returns 归一化后的节点与连线。
* @throws {Error} 结构不合法时。
*/
function normalizeGraph(nodes, edges) {
	if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error("workflow nodes/edges must be arrays");
	if (nodes.length > 200) throw new Error(`workflow has more than 200 nodes`);
	if (edges.length > 400) throw new Error(`workflow has more than 400 edges`);
	const seen = /* @__PURE__ */ new Set();
	return {
		nodes: nodes.map((raw) => {
			if (typeof raw !== "object" || raw === null) throw new Error("workflow node must be an object");
			const node = raw;
			const id = typeof node.id === "string" && node.id !== "" ? node.id : void 0;
			if (id === void 0) throw new Error("workflow node needs a non-empty id");
			if (seen.has(id)) throw new Error(`duplicate workflow node id: ${id}`);
			seen.add(id);
			const kind = normalizeNodeKind(node.kind);
			const position = typeof node.position === "object" && node.position !== null ? node.position : {};
			const x = Number(position.x);
			const y = Number(position.y);
			if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`workflow node ${id} needs finite coordinates`);
			const params = typeof node.params === "object" && node.params !== null ? node.params : {};
			const cleanParams = {};
			for (const field of nodeSpec(kind).params) {
				const value = params[field.id];
				if (value === void 0 || value === null) {
					cleanParams[field.id] = field.default;
					continue;
				}
				if (typeof value === "string" || typeof value === "boolean") {
					cleanParams[field.id] = value;
					continue;
				}
				if (typeof value === "number" && Number.isFinite(value)) {
					cleanParams[field.id] = value;
					continue;
				}
				throw new Error(`workflow node ${id} parameter ${field.id} has an unsupported value`);
			}
			return {
				id,
				kind,
				position: {
					x: Math.round(x),
					y: Math.round(y)
				},
				params: cleanParams
			};
		}),
		edges: edges.map((raw) => {
			if (typeof raw !== "object" || raw === null) throw new Error("workflow edge must be an object");
			const edge = raw;
			const source = typeof edge.source === "string" ? edge.source : "";
			const target = typeof edge.target === "string" ? edge.target : "";
			if (!seen.has(source) || !seen.has(target)) throw new Error("workflow edge must connect two nodes in the graph");
			if (source === target) throw new Error(`workflow edge ${source} loops onto itself`);
			return {
				id: typeof edge.id === "string" && edge.id !== "" ? edge.id : `${source}->${target}`,
				source,
				target
			};
		})
	};
}
/** 取一个节点种类的事实。 */
function nodeSpec(kind) {
	const spec = BY_KIND.get(kind);
	if (spec === void 0) throw new Error(`unknown workflow node kind: ${kind}`);
	return spec;
}
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
//#region src/workbench/node-cache.ts
/**
* 跨运行的成功结果缓存（`R-FLW-5` 的省钱语义）。
*
* 口径：**按节点实际发给工具的参数**（即 `buildArgs` 之后的产物）算指纹，命中就复用
* 上一次的产物、**不再调外部生成**——同一条提示词反复跑、或整张图重跑时，不该重复付费。
*
* 三条边界：
* - 指纹只看"真正影响产出的东西"（节点种类 + 工具参数），与画布坐标、节点 id 无关；
* - 缓存里的文件必须先确认**还在**（用户可能删了 outputs），不在就重新生成；
* - 想强制重跑（例如换 seed 的语义由业务侧决定）时，运行器可 `bypassCache`。
*/
/** 递归把对象键排序后序列化：指纹不受键序影响。 */
function canonical(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	return `{${Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}
/**
* 算一个节点这次调用的指纹。
* @param input.kind - 节点种类。
* @param input.args - `buildArgs` 之后的工具参数。
* @returns sha256 十六进制串。
*/
function nodeCacheKey(input) {
	return createHash("sha256").update(`${input.kind}|${canonical(input.args)}`).digest("hex");
}
//#endregion
//#region src/workbench/migrate.ts
/**
* 数据迁移框架（Track A / A7，对应总任务书 §8.1「支持数据格式版本 / 支持错误恢复和项目迁移」）。
*
* 规则：
* - 数据文件带 `schemaVersion`；读取时按迁移链逐级升级（v1→v2→v3…）；
* - **只升不降**：文件版本比插件新 → 明确拒绝并给出可操作提示（避免半懂不懂地写坏数据）；
* - 找不到升级路径也拒绝（不猜字段）；
* - 真正发生迁移时，store 会先把原始文件备份成 `<file>.pre-migrate-v<N>` 再落盘。
*/
/**
* 当前已登记的迁移链。V1 是首版，因此为空；将来加字段时在这里追加 `{from:1,to:2,...}`。
* 例：`{ from: 1, to: 2, describe: 'tasks 增加 projectId', migrate: doc => ({ ...doc, schemaVersion: 2 }) }`
*/
const WORKBENCH_MIGRATIONS = [{
	from: 1,
	to: 2,
	describe: "v2：资源补 scope（默认 project）、时间轴补 exportFormat 缺省、文档补 resourceUsage 列表",
	migrate: (document) => ({
		...document,
		schemaVersion: 2,
		resources: (document.resources ?? []).map((resource) => ({
			scope: "project",
			...resource
		})),
		timelines: (document.timelines ?? []).map((timeline) => ({ ...timeline })),
		resourceUsage: document.resourceUsage ?? []
	})
}, {
	from: 2,
	to: 3,
	describe: "v3：片段支持特效（speed/fade/crop）与跨段转场（transition）——字段均可选，无需改写旧数据",
	migrate: (document) => ({
		...document,
		schemaVersion: 3
	})
}];
/**
* 把任意版本的工作台文档升级到当前版本。
* @param raw - 读到的原始对象。
* @param migrations - 迁移链（默认 {@link WORKBENCH_MIGRATIONS}，测试可注入）。
* @returns 升级结果。
* @throws {Error} 文件来自更新版本、或找不到升级路径时。
*/
function migrateDocument(raw, migrations = WORKBENCH_MIGRATIONS) {
	const declared = raw.schemaVersion;
	const fromVersion = typeof declared === "number" && Number.isFinite(declared) ? Math.trunc(declared) : 1;
	if (fromVersion > 3) throw new Error(`工作台数据是更新的版本（schemaVersion ${fromVersion} > 插件支持的 3）：请升级插件后再打开，或先用旧版本导出项目包。继续打开可能写坏数据，已停止。`);
	let document = raw;
	let version = fromVersion;
	const applied = [];
	while (version < 3) {
		const step = migrations.find((candidate) => candidate.from === version);
		if (step === void 0) throw new Error(`找不到 schemaVersion ${version} → 3 的升级路径：请升级插件，或把数据文件备份后手工迁移（不要直接改 schemaVersion 硬骗过去）。`);
		document = step.migrate(document);
		applied.push(step);
		version = step.to;
	}
	return {
		document,
		applied,
		fromVersion,
		toVersion: version
	};
}
//#endregion
//#region src/workbench/timeline.ts
/** 允许的转场类型（白名单）。 */
const CLIP_TRANSITIONS = [
	"fade",
	"wipeleft",
	"circleopen"
];
/** 转场时长上限（毫秒）。 */
const MAX_CLIP_TRANSITION_MS = 2e3;
/** 变速的允许范围。 */
const CLIP_SPEED_RANGE = {
	min: .25,
	max: 4
};
/** 淡入淡出时长上限（毫秒）。 */
const MAX_CLIP_FADE_MS = 2e3;
/**
* 片段在时间轴上**实际占用**的时长（变速折算后）。
* @param clip - 片段。
* @returns 毫秒（至少 1）。
*/
function effectiveDurationMs(clip) {
	const speed = clip.speed ?? 1;
	return Math.max(1, Math.round(clip.durationMs / speed));
}
/** 默认导出规格：720p30（与 V1 的固定行为一致）。 */
const DEFAULT_EXPORT_FORMAT = {
	width: 1280,
	height: 720,
	frameRate: 30
};
/** 允许的帧率档位。 */
const EXPORT_FRAME_RATES = [
	24,
	25,
	30,
	60
];
/** 分辨率范围（偶数、2 的倍数；下限 128，上限 4096）。 */
const EXPORT_DIMENSION_RANGE = {
	min: 128,
	max: 4096
};
/** 码率范围（kbps）。 */
const EXPORT_BITRATE_RANGE = {
	min: 500,
	max: 5e4
};
/**
* 校验并归一化导出规格。
* @param raw - 原始取值；缺省即默认 720p30。
* @returns 归一化规格。
* @throws {Error} 尺寸/帧率/码率越界时（不静默截断）。
*/
function normalizeExportFormat(raw) {
	if (raw === void 0 || raw === null) return DEFAULT_EXPORT_FORMAT;
	if (typeof raw !== "object") throw new Error("timeline exportFormat must be an object");
	const value = raw;
	const dimension = (key) => {
		const candidate = value[key] ?? DEFAULT_EXPORT_FORMAT[key];
		if (typeof candidate !== "number" || !Number.isFinite(candidate)) throw new Error(`exportFormat ${key} must be a finite number`);
		const rounded = Math.round(candidate);
		if (rounded % 2 !== 0) throw new Error(`exportFormat ${key} must be an even number (got ${rounded})`);
		if (rounded < EXPORT_DIMENSION_RANGE.min || rounded > EXPORT_DIMENSION_RANGE.max) throw new Error(`exportFormat ${key} must be between ${EXPORT_DIMENSION_RANGE.min} and ${EXPORT_DIMENSION_RANGE.max}`);
		return rounded;
	};
	const frameRate = value.frameRate ?? DEFAULT_EXPORT_FORMAT.frameRate;
	if (typeof frameRate !== "number" || !EXPORT_FRAME_RATES.includes(Math.round(frameRate))) throw new Error(`exportFormat frameRate must be one of ${EXPORT_FRAME_RATES.join("/")}`);
	let bitrateKbps;
	if (value.bitrateKbps !== void 0) {
		const candidate = value.bitrateKbps;
		if (typeof candidate !== "number" || !Number.isFinite(candidate)) throw new Error("exportFormat bitrateKbps must be a finite number");
		const rounded = Math.round(candidate);
		if (rounded < EXPORT_BITRATE_RANGE.min || rounded > EXPORT_BITRATE_RANGE.max) throw new Error(`exportFormat bitrateKbps must be between ${EXPORT_BITRATE_RANGE.min} and ${EXPORT_BITRATE_RANGE.max}`);
		bitrateKbps = rounded;
	}
	return {
		width: dimension("width"),
		height: dimension("height"),
		frameRate: Math.round(frameRate),
		...bitrateKbps === void 0 ? {} : { bitrateKbps }
	};
}
/** 单个 clip 最长 30 分钟。 */
const MAX_CLIP_DURATION_MS = 1800 * 1e3;
/** 素材引用路径上限（超过这个长度基本就是把字节塞进来了）。 */
const MAX_ASSET_PATH_LENGTH = 1024;
const TRACK_KINDS = [
	"video",
	"audio",
	"subtitle"
];
/** 判断一个引用是不是"内联字节"（data URL / base64 大块）。 */
function looksInlinedBytes(value) {
	if (value.startsWith("data:")) return true;
	if (value.length > MAX_ASSET_PATH_LENGTH) return true;
	return /[A-Za-z0-9+/]{512,}={0,2}/.test(value);
}
function numberField(value, what, options) {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${what} must be a finite number`);
	if (value < options.min || value > options.max) throw new Error(`${what} must be between ${options.min} and ${options.max}`);
	return Math.round(value);
}
/**
* 校验并归一化轨道。
* @param raw - 待校验的轨道数组。
* @returns 归一化后的轨道。
* @throws {Error} 结构不合法、含内联字节、或超出规模上限时。
*/
function normalizeTimelineTracks(raw) {
	if (!Array.isArray(raw)) throw new Error("timeline tracks must be an array");
	const seenClipIds = /* @__PURE__ */ new Set();
	let clipCount = 0;
	return raw.map((candidate, trackIndex) => {
		if (typeof candidate !== "object" || candidate === null) throw new Error("timeline track must be an object");
		const track = candidate;
		const kind = track.kind;
		if (typeof kind !== "string" || !TRACK_KINDS.includes(kind)) throw new Error(`track ${trackIndex} kind must be one of video/audio/subtitle`);
		const clips = track.clips;
		if (!Array.isArray(clips)) throw new Error(`track ${trackIndex} clips must be an array`);
		const normalized = clips.map((rawClip, clipIndex) => {
			if (typeof rawClip !== "object" || rawClip === null) throw new Error("timeline clip must be an object");
			const clip = rawClip;
			const id = typeof clip.id === "string" && clip.id !== "" ? clip.id : void 0;
			if (id === void 0) throw new Error(`track ${trackIndex} clip ${clipIndex} needs a non-empty id`);
			if (seenClipIds.has(id)) throw new Error(`duplicate timeline clip id: ${id}`);
			seenClipIds.add(id);
			clipCount += 1;
			if (clipCount > 400) throw new Error(`timeline has more than 400 clips`);
			const startMs = numberField(clip.startMs, `clip ${id} startMs`, {
				min: 0,
				max: MAX_CLIP_DURATION_MS
			});
			const durationMs = numberField(clip.durationMs, `clip ${id} durationMs`, {
				min: 1,
				max: MAX_CLIP_DURATION_MS
			});
			const inMs = clip.inMs === void 0 ? void 0 : numberField(clip.inMs, `clip ${id} inMs`, {
				min: 0,
				max: MAX_CLIP_DURATION_MS
			});
			const speed = clip.speed === void 0 ? void 0 : numberField(clip.speed, `clip ${id} speed`, {
				min: CLIP_SPEED_RANGE.min,
				max: CLIP_SPEED_RANGE.max
			});
			const fade = clip.fade === void 0 ? void 0 : numberField(clip.fade, `clip ${id} fade`, {
				min: 0,
				max: MAX_CLIP_FADE_MS
			});
			let crop;
			if (clip.crop !== void 0) {
				if (typeof clip.crop !== "object" || clip.crop === null) throw new Error(`clip ${id} crop must be an object`);
				const raw = clip.crop;
				const even = (key) => {
					const value = numberField(raw[key], `clip ${id} crop.${key}`, {
						min: 2,
						max: MAX_CLIP_DURATION_MS
					});
					const rounded = Math.round(value);
					if (rounded % 2 !== 0) throw new Error(`clip ${id} crop.${key} must be an even number`);
					return rounded;
				};
				crop = {
					x: Math.round(numberField(raw.x, `clip ${id} crop.x`, {
						min: 0,
						max: MAX_CLIP_DURATION_MS
					})),
					y: Math.round(numberField(raw.y, `clip ${id} crop.y`, {
						min: 0,
						max: MAX_CLIP_DURATION_MS
					})),
					width: even("width"),
					height: even("height")
				};
			}
			let transition;
			if (clip.transition !== void 0) {
				if (typeof clip.transition !== "string" || !CLIP_TRANSITIONS.includes(clip.transition)) throw new Error(`clip ${id} transition must be one of ${CLIP_TRANSITIONS.join("/")}`);
				transition = clip.transition;
			}
			const transitionDurationMs = clip.transitionDurationMs === void 0 ? void 0 : Math.round(numberField(clip.transitionDurationMs, `clip ${id} transitionDurationMs`, {
				min: 0,
				max: MAX_CLIP_TRANSITION_MS
			}));
			const extras = {
				...transition === void 0 ? {} : { transition },
				...transitionDurationMs === void 0 ? {} : { transitionDurationMs },
				...speed === void 0 ? {} : { speed },
				...fade === void 0 ? {} : { fade },
				...crop === void 0 ? {} : { crop }
			};
			if (kind === "subtitle") {
				const text = typeof clip.text === "string" ? clip.text : "";
				if (text.trim() === "") throw new Error(`subtitle clip ${id} needs text`);
				if (text.length > 2e3) throw new Error(`subtitle clip ${id} text is too long`);
				const style = normalizeSubtitleStyle(clip.style, id);
				return {
					id,
					text,
					startMs,
					durationMs,
					...inMs === void 0 ? {} : { inMs },
					...extras,
					...Object.keys(style).length === 0 ? {} : { style }
				};
			}
			const assetPath = typeof clip.assetPath === "string" ? clip.assetPath : "";
			if (assetPath.trim() === "") throw new Error(`${kind} clip ${id} needs an assetPath`);
			if (looksInlinedBytes(assetPath)) throw new Error(`${kind} clip ${id} must reference a file path, not inlined bytes (R-TML-1)`);
			return {
				id,
				assetPath,
				startMs,
				durationMs,
				...inMs === void 0 ? {} : { inMs },
				...extras
			};
		});
		let volume;
		if (track.volume !== void 0) {
			if (typeof track.volume !== "number" || !Number.isFinite(track.volume)) throw new Error(`track ${trackIndex} volume must be a finite number`);
			if (track.volume < 0 || track.volume > 2) throw new Error(`track ${trackIndex} volume must be between 0 and 2`);
			volume = Math.round(track.volume * 100) / 100;
		}
		return {
			id: typeof track.id === "string" && track.id !== "" ? track.id : `track-${trackIndex + 1}`,
			kind,
			clips: normalized,
			...track.muted === true ? { muted: true } : {},
			...volume === void 0 ? {} : { volume }
		};
	});
}
/** 字幕样式允许的取值范围（越界即拒绝，避免风格面板把畸值写进文档）。 */
const SUBTITLE_FONT_SIZE_RANGE = {
	min: 8,
	max: 200
};
const SUBTITLE_POSITIONS = [
	"top",
	"middle",
	"bottom"
];
/**
* 校验并归一化字幕样式。
* @param raw - 待校验的样式对象。
* @param clipId - 出错时用于定位的 clip id。
* @returns 归一化样式，未给字段时返回空对象。
* @throws {Error} 取值越界或类型不对时。
*/
function normalizeSubtitleStyle(raw, clipId) {
	if (raw === void 0 || raw === null) return {};
	if (typeof raw !== "object") throw new Error(`subtitle clip ${clipId} style must be an object`);
	const style = raw;
	const normalized = {};
	if (style.fontSize !== void 0) {
		if (typeof style.fontSize !== "number" || !Number.isFinite(style.fontSize)) throw new Error(`subtitle clip ${clipId} fontSize must be a number`);
		if (style.fontSize < SUBTITLE_FONT_SIZE_RANGE.min || style.fontSize > SUBTITLE_FONT_SIZE_RANGE.max) throw new Error(`subtitle clip ${clipId} fontSize must be between ${SUBTITLE_FONT_SIZE_RANGE.min} and ${SUBTITLE_FONT_SIZE_RANGE.max}`);
		normalized.fontSize = Math.round(style.fontSize);
	}
	if (style.color !== void 0) {
		if (typeof style.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(style.color)) throw new Error(`subtitle clip ${clipId} color must be a #rrggbb value`);
		normalized.color = style.color;
	}
	if (style.position !== void 0) {
		if (typeof style.position !== "string" || !SUBTITLE_POSITIONS.includes(style.position)) throw new Error(`subtitle clip ${clipId} position must be one of top/middle/bottom`);
		normalized.position = style.position;
	}
	return normalized;
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
//#region src/workbench/references.ts
/** 把任意值递归展开成字符串集合（节点参数里可能嵌数组/对象）。 */
function collectStrings(value, found) {
	if (typeof value === "string") {
		found.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectStrings(item, found);
		return;
	}
	if (typeof value === "object" && value !== null) for (const item of Object.values(value)) collectStrings(item, found);
}
/**
* 找出一份文档里对某素材的引用。
* @param document - 时间轴与流程图（`null` 表示该类还没加载）。
* @param asset - 素材记录。
* @returns 引用位置；为空表示可以安全删除。
*/
function findAssetReferences(document, asset) {
	const hits = [];
	for (const timeline of document.timelines) for (const track of timeline.tracks) for (const clip of track.clips) if (clip.assetPath === asset.path) hits.push({
		kind: "timeline",
		id: timeline.id,
		name: timeline.name,
		where: `${track.kind} 轨 · 片段 ${clip.id}（${clip.startMs}ms 起）`
	});
	for (const workflow of document.workflows) for (const node of workflow.nodes) {
		const values = /* @__PURE__ */ new Set();
		collectStrings(node.params, values);
		if (!values.has(asset.path) && !values.has(asset.id)) continue;
		hits.push({
			kind: "workflow",
			id: workflow.id,
			name: workflow.name,
			where: `节点 ${node.id}（${node.kind}）`
		});
	}
	return hits;
}
/**
* 找出一份文档里对某个创作资源的引用（节点参数里出现该资源 id）。
* @param document - 流程图集合。
* @param resourceId - 资源 id。
* @returns 引用位置。
*/
function findResourceReferences(document, resourceId) {
	const hits = [];
	for (const timeline of document.timelines ?? []) for (const track of timeline.tracks) for (const clip of track.clips) {
		const values = /* @__PURE__ */ new Set();
		collectStrings(clip, values);
		if (values.has(resourceId)) hits.push({
			kind: "timeline",
			id: timeline.id,
			name: timeline.name,
			where: `${track.kind} 轨 · 片段 ${clip.id}`
		});
	}
	for (const workflow of document.workflows) for (const node of workflow.nodes) {
		const values = /* @__PURE__ */ new Set();
		collectStrings(node.params, values);
		if (!values.has(resourceId)) continue;
		hits.push({
			kind: "workflow",
			id: workflow.id,
			name: workflow.name,
			where: `节点 ${node.id}（${node.kind}）`
		});
	}
	return hits;
}
/** 把引用位置拼成一句可操作的话。 */
function describeReferences(hits) {
	return hits.map((hit) => `${hit.kind === "timeline" ? "时间轴" : "流程图"}「${hit.name}」的 ${hit.where}`).join("；");
}
var WorkbenchStore = class {
	/** Absolute directory holding the document. */
	directory;
	file;
	now;
	cache;
	/** Shared first read: concurrent mutations must land on one document, not one copy each. */
	loading;
	/** Serializes writes so concurrent mutations cannot interleave on the same temporary file. */
	writes = Promise.resolve();
	/** Distinguishes temporary files written by queued saves within this process. */
	writeSequence = 0;
	/** 真实落盘次数（压测与诊断用；`A8`/`A9`）。 */
	writeCount = 0;
	/** 上次成功落盘的内容（相同则跳过写盘） */
	lastSerialized;
	/**
	* @param options - directory and optional clock.
	*/
	/** 迁移链（默认用内置；测试可注入）。 */
	migrations;
	constructor(options) {
		this.directory = options.directory;
		this.file = join(options.directory, "workbench.json");
		this.now = options.now ?? (() => /* @__PURE__ */ new Date());
		this.migrations = options.migrations;
	}
	/** Read every project, newest first. */
	async listProjects() {
		return [...(await this.load()).projects].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}
	/**
	* Create a project.
	* @param name - user-supplied name (trimmed, validated).
	* @returns the stored record.
	*/
	async createProject(name) {
		const document = await this.load();
		const stamp = this.now().toISOString();
		const project = {
			schemaVersion: 3,
			id: newWorkbenchId("prj"),
			name: normalizeProjectName(name),
			createdAt: stamp,
			updatedAt: stamp
		};
		document.projects.push(project);
		await this.save(document);
		return project;
	}
	/**
	* Remove a project and its asset records (never the media files themselves).
	* @param id - project id.
	* @returns `true` when a project was removed.
	*/
	async removeProject(id) {
		const document = await this.load();
		const before = document.projects.length;
		document.projects = document.projects.filter((project) => project.id !== id);
		if (document.projects.length === before) return false;
		document.assets = document.assets.filter((asset) => asset.projectId !== id);
		document.resources = document.resources.filter((resource) => resource.projectId !== id);
		document.workflows = document.workflows.filter((workflow) => workflow.projectId !== id);
		document.runs = document.runs.filter((run) => run.projectId !== id);
		document.timelines = document.timelines.filter((timeline) => timeline.projectId !== id);
		document.resourceUsage = document.resourceUsage.filter((usage) => usage.projectId !== id);
		await this.save(document);
		return true;
	}
	/**
	* List one project's assets, newest first.
	* @param projectId - project id.
	* @returns the asset records.
	*/
	async listAssets(projectId) {
		return (await this.load()).assets.filter((asset) => asset.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}
	/**
	* Register an existing file as an asset of a project.
	*
	* Idempotent per (project, path): registering the same file twice returns the
	* existing record, so double-clicking "register" cannot produce two assets for
	* one file.
	* @param input - project, path and media facts.
	* @returns the record, plus whether this call created it.
	* @throws {Error} when the project is unknown.
	*/
	async attachAsset(input) {
		const document = await this.load();
		const project = document.projects.find((candidate) => candidate.id === input.projectId);
		if (project === void 0) throw new Error(`unknown project: ${input.projectId}`);
		const existing = document.assets.find((asset) => asset.projectId === project.id && asset.path === input.path);
		if (existing !== void 0) return {
			asset: existing,
			created: false
		};
		const asset = {
			schemaVersion: 3,
			id: newWorkbenchId("ast"),
			projectId: project.id,
			kind: normalizeMediaKind(input.kind),
			path: input.path,
			bytes: input.bytes ?? 0,
			createdAt: this.now().toISOString(),
			...input.provider === void 0 ? {} : { provider: input.provider },
			...input.model === void 0 ? {} : { model: input.model },
			...input.prompt === void 0 ? {} : { prompt: input.prompt }
		};
		document.assets.push(asset);
		document.projects = document.projects.map((candidate) => candidate.id === project.id ? {
			...candidate,
			updatedAt: asset.createdAt
		} : candidate);
		await this.save(document);
		return {
			asset,
			created: true
		};
	}
	/**
	* Remove one asset record.
	* @param id - asset id.
	* @returns `true` when a record was removed.
	*/
	async removeAsset(id, options = {}) {
		const document = await this.load();
		const asset = document.assets.find((candidate) => candidate.id === id);
		if (asset === void 0) return false;
		const hits = findAssetReferences(document, asset);
		if (hits.length > 0 && options.force !== true) throw new Error(`素材 ${asset.path} 正被引用：${describeReferences(hits)}。确认要删就在界面上再确认一次（force）。`);
		document.assets = document.assets.filter((candidate) => candidate.id !== id);
		await this.save(document);
		return true;
	}
	/**
	* Rename a project.
	* @param id - project id.
	* @param name - validated new name.
	* @returns the updated record, or `undefined` when the id is unknown.
	*/
	async renameProject(id, name) {
		const document = await this.load();
		const current = document.projects.find((project) => project.id === id);
		if (current === void 0) return void 0;
		const renamed = {
			...current,
			name: normalizeProjectName(name),
			updatedAt: this.now().toISOString()
		};
		document.projects = document.projects.map((project) => project.id === id ? renamed : project);
		await this.save(document);
		return renamed;
	}
	/**
	* List a project's resources, newest first.
	* @param projectId - project id.
	* @param kind - optional kind filter.
	* @returns the records.
	*/
	async listResources(projectId, kind) {
		return (await this.load()).resources.filter((resource) => resource.projectId === projectId && (kind === void 0 || resource.kind === kind)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}
	/**
	* Create a resource inside a project.
	* @param input - project, kind, name and optional note.
	* @returns the stored record.
	* @throws {Error} when the project is unknown.
	*/
	async createResource(input) {
		const document = await this.load();
		const project = document.projects.find((candidate) => candidate.id === input.projectId);
		if (project === void 0) throw new Error(`unknown project: ${input.projectId}`);
		const stamp = this.now().toISOString();
		const resource = {
			schemaVersion: 3,
			id: newWorkbenchId("res"),
			projectId: project.id,
			kind: normalizeResourceKind(input.kind),
			name: normalizeResourceName(input.name),
			scope: normalizeResourceScope(input.scope),
			...input.keyframes === void 0 && normalizeResourceKind(input.kind) !== "motion-track" ? {} : { keyframes: normalizeKeyframes(input.keyframes) },
			createdAt: stamp,
			updatedAt: stamp,
			...input.note === void 0 || input.note === "" ? {} : { note: input.note }
		};
		document.resources.push(resource);
		document.projects = document.projects.map((candidate) => candidate.id === project.id ? {
			...candidate,
			updatedAt: stamp
		} : candidate);
		await this.save(document);
		return resource;
	}
	/**
	* Remove one resource record.
	* @param id - resource id.
	* @returns `true` when a record was removed.
	*/
	async removeResource(id, options = {}) {
		const document = await this.load();
		const resource = document.resources.find((candidate) => candidate.id === id);
		if (resource === void 0) return false;
		const hits = findResourceReferences(document, id);
		if (hits.length > 0 && options.force !== true) throw new Error(`创作资源「${resource.name}」正被引用：${describeReferences(hits)}。确认要删就在界面上再确认一次（force）。`);
		document.resources = document.resources.filter((candidate) => candidate.id !== id);
		await this.save(document);
		return true;
	}
	/**
	* List a project's workflow documents, newest first.
	* @param projectId - project id.
	* @returns the records.
	*/
	async listWorkflows(projectId) {
		return (await this.load()).workflows.filter((workflow) => workflow.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
	}
	/**
	* Create or update a workflow document.
	* @param input - id to update (optional), project, name, nodes and edges.
	* @returns the stored record.
	* @throws {Error} when the project is unknown or the graph is malformed.
	*/
	async saveWorkflow(input) {
		const document = await this.load();
		const project = document.projects.find((candidate) => candidate.id === input.projectId);
		if (project === void 0) throw new Error(`unknown project: ${input.projectId}`);
		const graph = normalizeGraph(input.nodes, input.edges);
		const stamp = this.now().toISOString();
		const existing = input.id === void 0 ? void 0 : document.workflows.find((row) => row.id === input.id);
		const name = input.name === void 0 || input.name === "" ? "未命名工作流" : String(input.name).slice(0, 80);
		const record = {
			schemaVersion: 1,
			id: existing?.id ?? newWorkbenchId("wfl"),
			projectId: project.id,
			name,
			nodes: graph.nodes,
			edges: graph.edges,
			createdAt: existing?.createdAt ?? stamp,
			updatedAt: stamp
		};
		document.workflows = existing === void 0 ? [...document.workflows, record] : document.workflows.map((row) => row.id === record.id ? record : row);
		await this.save(document);
		return record;
	}
	/**
	* Remove one workflow document.
	* @param id - workflow id.
	* @returns `true` when a record was removed.
	*/
	async removeWorkflow(id) {
		const document = await this.load();
		const before = document.workflows.length;
		document.workflows = document.workflows.filter((workflow) => workflow.id !== id);
		if (document.workflows.length === before) return false;
		await this.save(document);
		return true;
	}
	/**
	* Find one workflow document by id.
	* @param id - workflow id.
	* @returns the record, or `undefined`.
	*/
	async findWorkflow(id) {
		return (await this.load()).workflows.find((workflow) => workflow.id === id);
	}
	/**
	* Find one workflow run by id.
	* @param id - run id.
	* @returns the record, or `undefined`.
	*/
	async findRun(id) {
		return (await this.load()).runs.find((run) => run.id === id);
	}
	/**
	* List a project's timelines, newest first.
	* @param projectId - project id.
	* @returns the records.
	*/
	async listTimelines(projectId) {
		return (await this.load()).timelines.filter((timeline) => timeline.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
	}
	/**
	* Find one timeline by id.
	* @param id - timeline id.
	* @returns the record, or `undefined`.
	*/
	async findTimeline(id) {
		return (await this.load()).timelines.find((timeline) => timeline.id === id);
	}
	/**
	* Create or update a timeline document.
	* @param input - id (update), project, name, tracks and frame rate.
	* @returns the stored record.
	* @throws {Error} when the project is unknown or the tracks are malformed.
	*/
	async saveTimeline(input) {
		const document = await this.load();
		const project = document.projects.find((candidate) => candidate.id === input.projectId);
		if (project === void 0) throw new Error(`unknown project: ${input.projectId}`);
		const tracks = normalizeTimelineTracks(input.tracks);
		const stamp = this.now().toISOString();
		const existing = input.id === void 0 ? void 0 : document.timelines.find((row) => row.id === input.id);
		const record = {
			schemaVersion: 1,
			id: existing?.id ?? newWorkbenchId("tml"),
			projectId: project.id,
			name: input.name === void 0 || input.name === "" ? "未命名时间轴" : input.name.slice(0, 80),
			frameRate: input.frameRate ?? existing?.frameRate ?? 30,
			tracks,
			burnSubtitles: input.burnSubtitles ?? existing?.burnSubtitles ?? true,
			exportFormat: normalizeExportFormat(input.exportFormat ?? existing?.exportFormat),
			createdAt: existing?.createdAt ?? stamp,
			updatedAt: stamp
		};
		document.timelines = existing === void 0 ? [...document.timelines, record] : document.timelines.map((row) => row.id === record.id ? record : row);
		await this.save(document);
		return record;
	}
	/**
	* Remove one timeline.
	* @param id - timeline id.
	* @returns `true` when a record was removed.
	*/
	async removeTimeline(id) {
		const document = await this.load();
		const before = document.timelines.length;
		document.timelines = document.timelines.filter((timeline) => timeline.id !== id);
		if (document.timelines.length === before) return false;
		await this.save(document);
		return true;
	}
	/**
	* 导入外来的任务记录（`T8-2`）：**一律转 `imported-idle`**，绝不自动续跑。
	* @param projectId - 归属项目。
	* @param tasks - 包里的任务记录。
	* @returns 导入条数。
	*/
	async importTasks(projectId, tasks) {
		const document = await this.load();
		const stamp = this.now().toISOString();
		for (const task of tasks) document.tasks.push({
			...task,
			id: newWorkbenchId("task"),
			projectId,
			status: "imported-idle",
			updatedAt: stamp
		});
		if (tasks.length > 0) await this.save(document);
		return tasks.length;
	}
	/**
	* 查一条成功结果缓存。
	* @param key - 指纹。
	* @returns 命中的记录，或 `undefined`。
	*/
	async lookupNodeCache(key) {
		return (await this.load()).nodeCache.find((entry) => entry.key === key);
	}
	/**
	* 记一条成功结果缓存（有界：超过上限淘汰最旧的）。
	* @param entry - 缓存记录。
	*/
	async rememberNodeCache(entry) {
		const document = await this.load();
		document.nodeCache = [entry, ...document.nodeCache.filter((existing) => existing.key !== entry.key)].slice(0, 200);
		await this.save(document);
	}
	/**
	* 素材库引用的全部文件路径（`A15` 输出清理的保护名单）。
	* @returns 路径数组（去重）。
	*/
	async referencedAssetPaths() {
		const document = await this.load();
		return [...new Set(document.assets.map((asset) => asset.path))];
	}
	/**
	* 数据规模快照（`A9` 诊断用）：各实体条数、真实落盘次数、数据文件字节数。
	* @returns 计数（只读，不触发写盘）。
	*/
	async stats() {
		const document = await this.load();
		const fileBytes = await stat(this.file).then((info) => info.size).catch(() => 0);
		return {
			projects: document.projects.length,
			assets: document.assets.length,
			tasks: document.tasks.length,
			resources: document.resources.length,
			workflows: document.workflows.length,
			runs: document.runs.length,
			timelines: document.timelines.length,
			nodeCache: document.nodeCache.length,
			resourceUsage: document.resourceUsage.length,
			writeCount: this.writeCount,
			fileBytes,
			runningRuns: document.runs.filter((run) => run.status === "running").length
		};
	}
	/**
	* 记一批资源使用记录（`R-QCK-3`）：同 (resourceId, assetPath) 只留最新一条。
	* @param entries - 使用记录。
	*/
	async recordResourceUsage(entries) {
		if (entries.length === 0) return 0;
		const document = await this.load();
		const keys = new Set(entries.map((entry) => `${entry.resourceId}|${entry.assetPath}`));
		document.resourceUsage = [...entries, ...document.resourceUsage.filter((existing) => !keys.has(`${existing.resourceId}|${existing.assetPath}`))].slice(0, 2e3);
		await this.save(document);
		return entries.length;
	}
	/**
	* 查资源使用记录：资源库据此显示"被哪些素材用过"。
	* @param options.resourceId - 只看某个资源。
	* @param options.projectId - 只看某个项目。
	* @returns 记录（最新在前）。
	*/
	async listResourceUsage(options = {}) {
		return (await this.load()).resourceUsage.filter((entry) => (options.resourceId === void 0 || entry.resourceId === options.resourceId) && (options.projectId === void 0 || entry.projectId === options.projectId)).sort((left, right) => right.at.localeCompare(left.at));
	}
	/**
	* Collapse duplicate asset records (same project + same path) into the earliest one.
	*
	* Idempotent registration landed after some duplicates were already written, and the
	* panel showed one row per record. Deduplication has to happen *here* because the
	* process caches the document in memory — an outside edit would be overwritten by
	* the next save.
	* @returns how many records were removed.
	*/
	async compactAssets() {
		const document = await this.load();
		const seen = /* @__PURE__ */ new Map();
		const kept = [];
		for (const asset of document.assets) {
			const key = `${asset.projectId}\u0000${asset.path}`;
			const previous = seen.get(key);
			if (previous === void 0) {
				seen.set(key, asset);
				kept.push(asset);
				continue;
			}
			const earliest = asset.createdAt < previous.createdAt ? asset : previous;
			if (earliest === asset) kept[kept.indexOf(previous)] = asset;
			seen.set(key, earliest);
		}
		const removed = document.assets.length - kept.length;
		if (removed === 0) return 0;
		document.assets = kept;
		await this.save(document);
		return removed;
	}
	/**
	* Append one workflow-run record.
	* @param run - the record to store.
	* @returns the stored record.
	*/
	async recordRun(run) {
		const document = await this.load();
		document.runs.push(run);
		if (document.runs.length > 50) document.runs = document.runs.slice(-50);
		await this.save(document);
		return run;
	}
	/**
	* Patch a workflow run in place.
	* @param id - run id.
	* @param patch - fields to replace.
	* @returns the updated record, or `undefined` when the id is unknown.
	*/
	async updateRun(id, patch) {
		const document = await this.load();
		const current = document.runs.find((run) => run.id === id);
		if (current === void 0) return void 0;
		const updated = {
			...current,
			...patch
		};
		document.runs = document.runs.map((run) => run.id === id ? updated : run);
		await this.save(document);
		return updated;
	}
	/**
	* List workflow runs, newest first.
	* @param projectId - project id.
	* @param workflowId - optional workflow filter.
	* @returns the records.
	*/
	async listRuns(projectId, workflowId) {
		return (await this.load()).runs.filter((run) => run.projectId === projectId && (workflowId === void 0 || run.workflowId === workflowId)).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
	}
	/**
	* Close runs (and their in-flight nodes) left `running` by a process that went away.
	* @param reason - message filed with each closed run.
	* @returns how many runs were closed.
	*/
	async failStaleRuns(reason) {
		const document = await this.load();
		const stamp = this.now().toISOString();
		let closed = 0;
		document.runs = document.runs.map((run) => {
			if (run.status !== "running") return run;
			closed += 1;
			return {
				...run,
				status: "failed",
				error: reason,
				finishedAt: stamp,
				nodeRuns: run.nodeRuns.map((node) => node.status === "succeeded" || node.status === "failed" || node.status === "cancelled" || node.status === "skipped" ? node : {
					...node,
					status: "cancelled",
					error: reason,
					finishedAt: stamp
				})
			};
		});
		if (closed > 0) await this.save(document);
		return closed;
	}
	/**
	* Record one generation attempt.
	* @param input - what the tool reported.
	* @returns the stored record.
	*/
	async recordTask(input) {
		const document = await this.load();
		const stamp = this.now().toISOString();
		const task = {
			schemaVersion: 3,
			id: newWorkbenchId("tsk"),
			kind: normalizeMediaKind(input.kind),
			status: normalizeTaskStatus(input.status),
			createdAt: input.startedAt ?? stamp,
			updatedAt: stamp,
			...input.provider === void 0 ? {} : { provider: input.provider },
			...input.model === void 0 ? {} : { model: input.model },
			...input.prompt === void 0 ? {} : { prompt: input.prompt },
			...input.outputPath === void 0 ? {} : { outputPath: input.outputPath },
			...input.bytes === void 0 ? {} : { bytes: input.bytes },
			...input.projectId === void 0 ? {} : { projectId: input.projectId },
			...input.error === void 0 ? {} : { error: input.error }
		};
		document.tasks.push(task);
		if (document.tasks.length > 1e3) document.tasks = document.tasks.slice(-1e3);
		await this.save(document);
		return task;
	}
	/**
	* Change an existing task (status, output, project).
	* @param id - task id.
	* @param patch - fields to change.
	* @returns the updated record, or `undefined` when the id is unknown.
	*/
	async updateTask(id, patch) {
		const document = await this.load();
		const current = document.tasks.find((task) => task.id === id);
		if (current === void 0) return void 0;
		const updated = {
			...current,
			...patch.status === void 0 ? {} : { status: normalizeTaskStatus(patch.status) },
			...patch.outputPath === void 0 ? {} : { outputPath: patch.outputPath },
			...patch.bytes === void 0 ? {} : { bytes: patch.bytes },
			...patch.projectId === void 0 ? {} : { projectId: patch.projectId },
			...patch.error === void 0 ? {} : { error: patch.error },
			updatedAt: this.now().toISOString()
		};
		document.tasks = document.tasks.map((task) => task.id === id ? updated : task);
		await this.save(document);
		return updated;
	}
	/**
	* List recorded generations, newest first.
	* @param limit - maximum entries.
	* @param projectId - restrict to one project (tasks filed into it).
	* @returns the records.
	*/
	async listTasks(limit = 50, projectId) {
		return (await this.load()).tasks.filter((task) => projectId === void 0 || task.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, Math.max(0, limit));
	}
	/**
	* Close generations that were still `running` when the process went away.
	*
	* Without this, a crash or a host restart would leave rows reading "running"
	* forever, and the workbench would offer to cancel something that no longer
	* exists.
	* @param reason - message filed with each closed task.
	* @returns how many records were closed.
	*/
	async failStaleRunning(reason) {
		const document = await this.load();
		const stamp = this.now().toISOString();
		let closed = 0;
		document.tasks = document.tasks.map((task) => {
			if (task.status !== "running") return task;
			closed += 1;
			return {
				...task,
				status: "failed",
				error: reason,
				updatedAt: stamp
			};
		});
		if (closed > 0) await this.save(document);
		return closed;
	}
	/** 把任意读到的对象补成完整文档（缺字段补默认值）。 */
	normalize(raw) {
		return {
			schemaVersion: raw.schemaVersion ?? 3,
			projects: raw.projects ?? [],
			assets: raw.assets ?? [],
			tasks: raw.tasks ?? [],
			resources: raw.resources ?? [],
			workflows: raw.workflows ?? [],
			runs: raw.runs ?? [],
			timelines: raw.timelines ?? [],
			nodeCache: raw.nodeCache ?? [],
			resourceUsage: raw.resourceUsage ?? []
		};
	}
	/** Read the document, caching it after the first read. */
	async load() {
		if (this.cache !== void 0) return this.cache;
		this.loading ??= this.readDocument();
		return this.loading;
	}
	/** Perform the one read that populates {@link cache}. */
	async readDocument() {
		try {
			const migration = migrateDocument(JSON.parse(await readFile(this.file, "utf8")), this.migrations);
			if (migration.applied.length > 0) await copyFile(this.file, `${this.file}.pre-migrate-v${migration.fromVersion}`).catch(() => void 0);
			this.cache = this.normalize(migration.document);
			if (migration.applied.length > 0) await this.save(this.cache).catch(() => void 0);
		} catch (error) {
			if (error.code !== "ENOENT") {
				const reason = error instanceof Error ? error.message : String(error);
				const recovered = await readFile(`${this.file}.bak`, "utf8").then((text) => JSON.parse(text)).catch(() => void 0);
				if (recovered !== void 0 && typeof recovered === "object" && recovered !== null) {
					this.cache = this.normalize(recovered);
					await copyFile(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => void 0);
					return this.cache;
				}
				await copyFile(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => void 0);
				throw new Error(`工作台数据文件读不出来（${this.file}）：${reason}。已把坏文件留证为 .corrupt-*；可以删掉原文件让插件以空工作台重来，或者把一份可用的 ${this.file}.bak 放回去再重启。`, { cause: error });
			}
			this.cache = {
				schemaVersion: 3,
				projects: [],
				assets: [],
				tasks: [],
				resources: [],
				workflows: [],
				runs: [],
				timelines: [],
				nodeCache: [],
				resourceUsage: []
			};
		}
		return this.cache;
	}
	/** Write the document atomically and refresh the cache. */
	async save(document) {
		const serialized = `${JSON.stringify(document, null, 2)}\n`;
		if (serialized === this.lastSerialized) return;
		const write = this.writes.then(async () => {
			await mkdir(dirname(this.file), { recursive: true });
			this.writeSequence += 1;
			const temporary = `${this.file}.${process.pid}.${this.writeSequence}.tmp`;
			await writeFile(temporary, serialized, "utf8");
			await rename(temporary, this.file);
			this.writeCount += 1;
			await copyFile(this.file, `${this.file}.bak`).catch(() => void 0);
			this.lastSerialized = serialized;
		});
		this.writes = write.then(() => void 0, () => void 0);
		await write;
		this.cache = document;
	}
};
/**
* Where a deployment keeps its workbench data, derived from the output
* directory so no extra configuration is needed: `<outputsDir>/../image-video-workbench`.
* @param outputsDir - absolute output directory in use.
* @returns the absolute data directory.
*/
function resolveWorkbenchDirectory(outputsDir) {
	return join(dirname(outputsDir), "image-video-workbench");
}
//#endregion
//#region src/workbench/ledger.ts
/**
* Details the ledger can read off a tool *request*.
*
* A running row that says only "running" is useless in the panel, and the model /
* prompt are known the moment the call starts — recording them makes the row
* informative while the provider is still working.
* @param args - the tool's validated arguments.
* @returns the fields worth filing up front.
*/
function extractRequest(args) {
	if (typeof args !== "object" || args === null) return {};
	const record = args;
	const out = {};
	if (typeof record.model === "string" && record.model !== "") out.model = record.model;
	if (typeof record.prompt === "string" && record.prompt !== "") out.prompt = record.prompt;
	return out;
}
/** First string value among the keys a tool might use for its produced file. */
const PATH_KEYS = [
	"localPath",
	"outputPath",
	"path",
	"videoPath",
	"filePath"
];
/**
* Pull the ledger-relevant fields out of a tool's structured output.
* Unknown shapes yield `{}` — the record is still written, just without details.
* @param value - whatever the tool returned.
* @returns the extracted outcome.
*/
function extractOutcome(value) {
	if (typeof value !== "object" || value === null) return {};
	const record = value;
	const outcome = {};
	if (typeof record.provider === "string") outcome.provider = record.provider;
	if (typeof record.model === "string") outcome.model = record.model;
	if (typeof record.prompt === "string") outcome.prompt = record.prompt;
	for (const key of PATH_KEYS) if (typeof record[key] === "string" && record[key] !== "") {
		outcome.outputPath = record[key];
		break;
	}
	if (typeof record.bytes === "number" && Number.isFinite(record.bytes)) outcome.bytes = record.bytes;
	return outcome;
}
/** Report a ledger problem, never letting it break the call it describes. */
function report(options, message) {
	(options.onError ?? ((text) => {
		console.warn(`image-video workbench: ${text}`);
	}))(message);
}
/** Write the ending of a call onto its record (or open one when that failed). */
async function finish(options, taskId, patch) {
	try {
		if (taskId === void 0) {
			await options.store.recordTask({
				kind: options.kind,
				status: patch.status ?? "failed",
				...patch
			});
			return;
		}
		await options.store.updateTask(taskId, patch);
	} catch (error) {
		report(options, `could not finish ${options.kind} task: ${error instanceof Error ? error.message : String(error)}`);
	}
}
/**
* Wrap a tool so each call is recorded in the ledger and can be cancelled.
*
* The record is opened as `running` *before* the provider call starts, which is
* what makes the task visible in the workbench while it runs and gives the
* cancel endpoint an id to target.
* @param tool - the tool definition to wrap.
* @param options - store, registry, media kind and failure reporter.
* @returns a tool with the same shape, whose calls are recorded and cancellable.
*/
function withTaskLedger(tool, options) {
	const execute = tool.execute.bind(tool);
	return {
		...tool,
		async execute(args, exec) {
			const startedAt = (/* @__PURE__ */ new Date()).toISOString();
			const meta = extractRequest(args);
			let taskId;
			let controller;
			try {
				const running = await options.store.recordTask({
					kind: options.kind,
					status: "running",
					startedAt,
					...extractRequest(args)
				});
				taskId = running.id;
				controller = options.registry.register(running.id, options.kind, startedAt);
			} catch (error) {
				report(options, `could not open ${options.kind} task record: ${error instanceof Error ? error.message : String(error)}`);
			}
			const execSignal = exec?.signal;
			const toolExec = controller === void 0 || execSignal === void 0 ? exec : {
				...exec,
				signal: AbortSignal.any([execSignal, controller.signal])
			};
			const emit = (status, extra = {}) => {
				options.log?.({
					event: "generation",
					taskId,
					kind: options.kind,
					status,
					durationMs: Math.max(0, Date.now() - Date.parse(startedAt)),
					...meta,
					...extra
				});
			};
			try {
				const value = await execute(args, toolExec);
				const status = controller?.signal.aborted ?? false ? "cancelled" : "succeeded";
				const outcome = extractOutcome(value);
				await finish(options, taskId, {
					status,
					...outcome
				});
				emit(status, outcome);
				return value;
			} catch (error) {
				const status = controller?.signal.aborted ?? false ? "cancelled" : "failed";
				const message = error instanceof Error ? error.message : String(error);
				await finish(options, taskId, {
					status,
					error: message
				});
				emit(status, { error: message });
				throw error;
			} finally {
				if (taskId !== void 0) options.registry.release(taskId);
			}
		}
	};
}
//#endregion
//#region src/workbench/cancel.ts
/** Running generations, keyed by their ledger task id. */
var GenerationRegistry = class {
	running = /* @__PURE__ */ new Map();
	/**
	* Register a generation and mint the controller that cancels it.
	* @param id - ledger task id.
	* @param kind - media kind.
	* @param startedAt - ISO stamp the call started at.
	* @returns the controller whose signal the tool must honour.
	*/
	register(id, kind, startedAt) {
		const controller = new AbortController();
		this.running.set(id, {
			controller,
			kind,
			startedAt
		});
		return controller;
	}
	/**
	* Forget a generation (called when the call ends, however it ends).
	* @param id - ledger task id.
	*/
	release(id) {
		this.running.delete(id);
	}
	/**
	* Cancel one running generation.
	* @param id - ledger task id.
	* @returns `true` when something was actually cancelled.
	*/
	cancel(id) {
		const entry = this.running.get(id);
		if (entry === void 0) return false;
		entry.controller.abort(/* @__PURE__ */ new Error("cancelled from the workbench"));
		return true;
	}
	/** Snapshot of what can be cancelled right now, newest first. */
	list() {
		return [...this.running.entries()].map(([id, entry]) => ({
			id,
			kind: entry.kind,
			startedAt: entry.startedAt
		})).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
	}
	/** How many generations are running. */
	get size() {
		return this.running.size;
	}
	/**
	* Map the ending of a call onto a ledger status.
	* @param cancelled - whether our controller was the reason it stopped.
	* @returns the status to file.
	*/
	ending(cancelled) {
		return { status: cancelled ? "cancelled" : "succeeded" };
	}
};
//#endregion
//#region src/workbench/runner.ts
/**
* `WorkflowRunner`（`T4-4`）：按拓扑顺序执行一张图，逐节点写运行记录。
*
* 三条设计取舍：
* - **复用对话里的同一条生成链**：生成节点调用的是 `createGenerateImageTool` /
*   `createGenerateVideoTool` 造出来的工具（参数语义与对话一致，`R-FLW-4`），
*   因此账本、取消、幂等这些既有能力自动继承。
* - **不伪造成功**：`planned` 节点与本期没有执行器的数据节点一律记 `skipped` 并写明原因
*   （`T3-3` 的防伪造口径）；图不通过校验时整次运行直接失败并带上问题清单（`R-FLW-3`）。
* - **逐节点落库**：每执行完一个节点就更新运行记录，界面靠轮询就能看到进度（没有推送通道）。
*/
/** 真正会调用外部生成的节点种类 -> 用哪个工具。 */
const EXECUTORS = {
	"image-generate": "image",
	"video-generate": "video"
};
/** 产文本的节点：它们的文字会并入下游生成节点的提示词。 */
const TEXT_KINDS = new Set([
	"creative-input",
	"script",
	"subtitle"
]);
/** 默认单节点超时（毫秒）：图像 3 分钟、视频 15 分钟（生成类本来就慢）。 */
const DEFAULT_NODE_TIMEOUT_MS = {
	"image-generate": 18e4,
	"video-generate": 9e5
};
/**
* 判断一个失败是否值得重试。
*
* 上游流被中断、网关 5xx、超时、限流、连接被重置都属于"服务商那边的抖动"——
* owner 明确要求这类错误至少重试 3 次、不要直接判任务失败。参数错误、内容被拒、
* 取消这类**确定性**失败不重试。
* @param message - 错误原文。
* @returns 是否重试。
*/
function isTransientFailure(message) {
	if (/abort|cancel|取消/i.test(message)) return false;
	return /interrupted|stream|timeout|timed out|超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network|rate ?limit|too many requests|429|50[0-9]|upstream|gateway/i.test(message);
}
/** 拓扑排序（Kahn）。存在环时按输入顺序返回——环已由校验拦下。 */
function topologicalOrder(nodes, edges) {
	const indegree = new Map(nodes.map((node) => [node.id, 0]));
	const outgoing = /* @__PURE__ */ new Map();
	for (const edge of edges) {
		if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
		indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
		if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
		outgoing.get(edge.source)?.push(edge.target);
	}
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
	const order = [];
	while (queue.length > 0) {
		const id = queue.shift();
		const node = byId.get(id);
		if (node !== void 0) order.push(node);
		for (const next of outgoing.get(id) ?? []) {
			indegree.set(next, (indegree.get(next) ?? 0) - 1);
			if ((indegree.get(next) ?? 0) === 0) queue.push(next);
		}
	}
	return order.length === nodes.length ? order : [...nodes];
}
/** 本次运行要执行哪些节点：全图，或"给定节点 + 其全部下游"（重试语义）。 */
function selectRunNodes(nodes, edges, only) {
	if (only === void 0) return new Set(nodes.map((node) => node.id));
	const outgoing = /* @__PURE__ */ new Map();
	for (const edge of edges) {
		if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
		outgoing.get(edge.source)?.push(edge.target);
	}
	const selected = /* @__PURE__ */ new Set();
	const visit = (id) => {
		if (selected.has(id)) return;
		selected.add(id);
		for (const next of outgoing.get(id) ?? []) visit(next);
	};
	for (const id of only) visit(id);
	return selected;
}
/** 逐节点跑一张图。 */
var WorkflowRunner = class {
	deps;
	controllers = /* @__PURE__ */ new Map();
	constructor(deps) {
		this.deps = deps;
	}
	/** 某个运行是否还在进行。 */
	isRunning(id) {
		return this.controllers.has(id);
	}
	/**
	* 取消一次运行，并连带中止正在进行的生成。
	* @param id - 运行 id。
	* @returns 是否确实取消了在跑的运行。
	*/
	cancel(id) {
		const controller = this.controllers.get(id);
		if (controller === void 0) return false;
		controller.abort(/* @__PURE__ */ new Error("cancelled from the workbench"));
		return true;
	}
	/**
	* 建一条运行记录并开始执行（立即返回；执行在后台推进，界面轮询记录看进度）。
	* @param workflow - 要跑的流程文档。
	* @param options - `only` 指定本次只跑哪些节点及其下游。
	* @returns 刚建立（状态 `running`，或校验不过时直接 `failed`）的运行记录。
	*/
	async begin(workflow, options = {}) {
		const now = this.deps.now?.() ?? /* @__PURE__ */ new Date();
		const stamp = now.toISOString();
		const runId = this.deps.newRunId?.() ?? `run-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const selected = selectRunNodes(workflow.nodes, workflow.edges, options.only);
		const validation = validateWorkflow(workflow.nodes, workflow.edges);
		const skeleton = workflow.nodes.map((node) => ({
			nodeId: node.id,
			kind: node.kind,
			status: "skipped",
			startedAt: stamp,
			...selected.has(node.id) ? {} : { error: "not part of this run" }
		}));
		const graph = {
			nodes: workflow.nodes,
			edges: workflow.edges
		};
		if (!validation.ok) {
			const failed = {
				schemaVersion: 1,
				id: runId,
				workflowId: workflow.id,
				projectId: workflow.projectId,
				status: "failed",
				graph,
				startedAt: stamp,
				finishedAt: stamp,
				error: validation.issues.map((issue) => issue.message).join("; "),
				nodeRuns: skeleton.map((node) => ({
					...node,
					error: "graph failed validation"
				}))
			};
			await this.deps.store.recordRun(failed);
			return failed;
		}
		const run = {
			schemaVersion: 1,
			id: runId,
			workflowId: workflow.id,
			projectId: workflow.projectId,
			status: "running",
			graph,
			nodeRuns: skeleton,
			startedAt: stamp
		};
		await this.deps.store.recordRun(run);
		const controller = new AbortController();
		this.controllers.set(runId, controller);
		this.execute(run, workflow, controller.signal, selected, options).catch((error) => {
			this.deps.onError?.(`workflow run ${runId} crashed: ${error instanceof Error ? error.message : String(error)}`);
		}).finally(() => {
			this.controllers.delete(runId);
		});
		return run;
	}
	/**
	* 重试：只重跑失败节点及其下游。
	* @param run - 上一次的运行记录。
	* @returns 新建立的运行记录。
	*/
	async retry(run) {
		const workflow = {
			schemaVersion: 1,
			id: run.workflowId,
			projectId: run.projectId,
			name: "retry",
			nodes: run.graph.nodes,
			edges: run.graph.edges,
			createdAt: run.startedAt,
			updatedAt: run.startedAt
		};
		const only = run.nodeRuns.filter((node) => node.status === "failed").map((node) => node.nodeId);
		return this.begin(workflow, { only });
	}
	/** 依次执行选中的节点；失败即停，下游标为"被上游阻断"。 */
	async execute(run, workflow, signal, selected, options) {
		const nodeRuns = new Map(run.nodeRuns.map((node) => [node.nodeId, node]));
		const order = topologicalOrder(workflow.nodes, workflow.edges);
		let status = "succeeded";
		let error;
		for (const node of order) {
			if (!selected.has(node.id)) continue;
			if (signal.aborted) {
				status = "cancelled";
				error = "cancelled";
				break;
			}
			nodeRuns.set(node.id, {
				nodeId: node.id,
				kind: node.kind,
				status: "running",
				startedAt: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString()
			});
			await this.persist(run, nodeRuns, "running");
			const nodeStartedAt = Date.now();
			const record = await this.runNode(node, workflow, nodeRuns, signal, run, options);
			if (record.status === "succeeded" && record.outputPath !== void 0) {
				const resourceIds = workflow.nodes.filter((candidate) => candidate.kind === "resource-reference").map((candidate) => candidate.params.resourceId).filter((value) => typeof value === "string" && value !== "");
				await this.deps.store.recordResourceUsage?.(resourceIds.map((resourceId) => ({
					resourceId,
					projectId: workflow.projectId,
					assetPath: record.outputPath,
					runId: run.id,
					nodeId: node.id,
					at: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString()
				}))).catch?.(() => void 0);
			}
			this.deps.log?.({
				event: "workflow-node",
				runId: run.id,
				nodeId: node.id,
				kind: node.kind,
				status: record.status,
				attempt: record.attempts ?? 1,
				durationMs: Date.now() - nodeStartedAt,
				...record.outputPath === void 0 ? {} : { outputPath: record.outputPath },
				...record.error === void 0 ? {} : { error: record.error }
			});
			nodeRuns.set(node.id, record);
			if (record.status === "failed") {
				status = "failed";
				error = record.error;
				break;
			}
			if (record.status === "cancelled") {
				status = "cancelled";
				error = record.error;
				break;
			}
			await this.persist(run, nodeRuns, "running");
		}
		if (status === "failed") for (const node of order) {
			const record = nodeRuns.get(node.id);
			if (record !== void 0 && record.status === "skipped" && record.error === void 0) nodeRuns.set(node.id, {
				...record,
				error: "blocked by an upstream failure"
			});
		}
		this.controllers.delete(run.id);
		await this.persist(run, nodeRuns, status, error);
	}
	/** 执行单个节点。 */
	async runNode(node, workflow, done, signal, run, options) {
		const startedAt = (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
		const executor = EXECUTORS[node.kind];
		if (executor === void 0) return {
			nodeId: node.id,
			kind: node.kind,
			status: "skipped",
			startedAt,
			finishedAt: startedAt,
			error: `no executor for ${node.kind} in this version`
		};
		const tool = executor === "image" ? this.deps.generateImage : this.deps.generateVideo;
		const maxAttempts = Math.max(1, this.deps.nodeAttempts ?? 3);
		const args = this.buildArgs(node, workflow, done);
		const cacheKey = nodeCacheKey({
			kind: node.kind,
			args
		});
		const cacheLookup = this.deps.cache === false || options.bypassCache === true ? void 0 : this.deps.store.lookupNodeCache?.bind(this.deps.store);
		if (cacheLookup !== void 0) {
			const hit = await cacheLookup(cacheKey).catch(() => void 0);
			const stillThere = hit === void 0 ? false : await stat(hit.outputPath).then(() => true).catch(() => false);
			if (hit !== void 0 && stillThere) {
				const finishedAt = (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
				return {
					nodeId: node.id,
					kind: node.kind,
					status: "succeeded",
					startedAt,
					finishedAt,
					attempts: 1,
					cached: true,
					outputPath: hit.outputPath,
					...hit.bytes === void 0 ? {} : { bytes: hit.bytes }
				};
			}
		}
		let lastMessage = "";
		const timeoutMs = Math.max(1, this.deps.nodeTimeoutMs?.(node.kind) ?? DEFAULT_NODE_TIMEOUT_MS[node.kind] ?? 12e4);
		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			const attemptController = new AbortController();
			const combined = AbortSignal.any([signal, attemptController.signal]);
			let timer;
			const timeoutPromise = new Promise((_resolve, reject) => {
				timer = setTimeout(() => {
					attemptController.abort();
					reject(/* @__PURE__ */ new Error(`节点执行超时（${Math.round(timeoutMs / 1e3)}s）：上游没有在时限内返回`));
				}, timeoutMs);
				timer.unref?.();
			});
			try {
				const extracted = extractOutcome(await Promise.race([tool.execute(args, { signal: combined }), timeoutPromise]));
				if (this.deps.cache !== false && typeof extracted.outputPath === "string") await this.deps.store.rememberNodeCache?.({
					key: cacheKey,
					kind: node.kind,
					args,
					outputPath: extracted.outputPath,
					...extracted.bytes === void 0 ? {} : { bytes: extracted.bytes },
					runId: run.id,
					nodeId: node.id,
					at: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString()
				}).catch(() => void 0);
				return {
					nodeId: node.id,
					kind: node.kind,
					status: "succeeded",
					startedAt,
					finishedAt: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
					attempts: attempt,
					...extracted
				};
			} catch (error) {
				lastMessage = error instanceof Error ? error.message : String(error);
				if (signal.aborted || /abort|cancel/i.test(lastMessage)) return {
					nodeId: node.id,
					kind: node.kind,
					status: "cancelled",
					startedAt,
					finishedAt: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
					attempts: attempt,
					error: lastMessage
				};
				if (attempt < maxAttempts && isTransientFailure(lastMessage)) {
					this.deps.onError?.(`node ${node.id} attempt ${attempt}/${maxAttempts} failed transiently: ${lastMessage}`);
					const delay = this.deps.retryBackoffMs?.(attempt) ?? (this.deps.retryDelayMs ?? 800) * attempt;
					await new Promise((resolve) => {
						setTimeout(resolve, delay);
					});
					continue;
				}
				return {
					nodeId: node.id,
					kind: node.kind,
					status: "failed",
					startedAt,
					finishedAt: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
					attempts: attempt,
					error: lastMessage
				};
			} finally {
				if (timer !== void 0) clearTimeout(timer);
			}
		}
		return {
			nodeId: node.id,
			kind: node.kind,
			status: "failed",
			startedAt,
			finishedAt: (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString(),
			attempts: maxAttempts,
			error: lastMessage === "" ? "node failed without an error message" : lastMessage
		};
	}
	/** 节点参数 → 工具参数（与对话里 `generate_image` / `generate_video` 同一套语义）。 */
	buildArgs(node, workflow, done) {
		const prompt = [this.upstreamTexts(node, workflow, done), typeof node.params.prompt === "string" ? node.params.prompt : ""].filter((part) => part !== "").join("\n");
		const model = typeof node.params.model === "string" ? node.params.model : "";
		if (node.kind === "image-generate") return {
			prompt,
			size: typeof node.params.ratio === "string" ? node.params.ratio : "3:4",
			...model === "" ? {} : { model }
		};
		const reference = typeof node.params.referenceVideo === "string" ? node.params.referenceVideo : "";
		const resolution = typeof node.params.resolution === "string" ? node.params.resolution : "";
		const firstFrame = this.upstreamOutput(node, workflow, done);
		return {
			prompt,
			duration: typeof node.params.duration === "number" ? node.params.duration : 5,
			aspectRatio: typeof node.params.ratio === "string" ? node.params.ratio : "16:9",
			compare: node.params.compare === true,
			...model === "" ? {} : { model },
			...resolution === "" ? {} : { resolution },
			...firstFrame === void 0 ? {} : { image: firstFrame },
			...reference === "" ? {} : { media: [{ video: reference }] }
		};
	}
	/** 上游文本节点的文字（按拓扑序拼接），作为生成节点提示词的上下文。 */
	upstreamTexts(node, workflow, done) {
		const parts = [];
		for (const upstream of this.upstreams(node, workflow)) {
			if (!TEXT_KINDS.has(upstream.kind)) continue;
			const text = upstream.params.text ?? upstream.params.brief;
			if (typeof text === "string" && text !== "") parts.push(text);
		}
		return parts.join("\n");
	}
	/** 最近的上游产物路径（按拓扑序里最后一个已成功的媒体节点），作为首帧。 */
	upstreamOutput(node, workflow, done) {
		let found;
		for (const upstream of this.upstreams(node, workflow)) {
			const record = done.get(upstream.id);
			if (record?.status === "succeeded" && record.outputPath !== void 0) found = record.outputPath;
		}
		return found;
	}
	/** 直接上游节点（入边来源）。 */
	upstreams(node, workflow) {
		const byId = new Map(workflow.nodes.map((candidate) => [candidate.id, candidate]));
		return workflow.edges.filter((edge) => edge.target === node.id).flatMap((edge) => {
			const source = byId.get(edge.source);
			return source === void 0 ? [] : [source];
		});
	}
	/** 把当前节点状态写回运行记录（界面靠轮询看进度）。 */
	async persist(run, nodeRuns, status, error) {
		const finishedAt = status === "running" ? void 0 : (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
		try {
			await this.deps.store.updateRun(run.id, {
				status,
				nodeRuns: [...nodeRuns.values()],
				...finishedAt === void 0 ? {} : { finishedAt },
				...error === void 0 ? {} : { error }
			});
		} catch (failure) {
			this.deps.onError?.(`could not persist run ${run.id}: ${failure instanceof Error ? failure.message : String(failure)}`);
		}
	}
};
//#endregion
//#region src/media/render.ts
/**
* `RenderService`（`T5-5`）：时间轴快照 → ffmpeg filter graph → 进度/取消/输出校验。
*
* 三条设计取舍：
* - **快照冻结**：渲染一开始就把时间轴深拷贝成快照，之后用户继续编辑**不会**影响
*   进行中的这次渲染（`R-TML-5`）。
* - **进度靠 `-progress pipe:1`**：按 `out_time_ms` 报百分比，不猜、不假装。
* - **失败要能照着修**：素材丢失 / 磁盘满 / 编码器不支持 / ffmpeg 缺失都给机器码 +
*   一句话下一步（`R-TML-5`/`R-TML-6`）。
*/
/** 带机器码与可操作文案的渲染错误。 */
var RenderError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "RenderError";
		this.code = code;
	}
};
/** 时长容差：导出时长与时间轴时长允许差 ±1 帧。 */
function frameToleranceMs(frameRate) {
	return 1e3 / Math.max(1, frameRate);
}
/** 深拷贝成快照：之后改原文档不影响本次渲染。 */
function freezeTimeline(timeline) {
	const tracks = timeline.tracks.map((track) => ({
		...track,
		clips: track.clips.map((clip) => ({
			...clip,
			...clip.style === void 0 ? {} : { style: { ...clip.style } }
		}))
	}));
	const durationMs = timelineDurationMs(tracks);
	return {
		id: timeline.id,
		frameRate: timeline.frameRate,
		burnSubtitles: timeline.burnSubtitles,
		exportFormat: normalizeExportFormat(timeline.exportFormat),
		durationMs,
		tracks
	};
}
/**
* 把视频轨排成"片段 + 黑场填充"的序列。
* @param snapshot - 冻结快照。
* @returns 顺序片段；同一轨道内重叠会抛 `MEDIA_TIMELINE_OVERLAP`。
*/
function planVideoSegments(snapshot) {
	const track = snapshot.tracks.find((candidate) => candidate.kind === "video");
	if (track === void 0 || track.clips.length === 0) throw new RenderError("MEDIA_TIMELINE_EMPTY", "时间轴的视频轨还是空的：先从素材面板往视频轨加入片段再导出。");
	const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs);
	const segments = [];
	let cursor = 0;
	for (const clip of ordered) {
		if (clip.startMs < cursor) throw new RenderError("MEDIA_TIMELINE_OVERLAP", `视频轨上片段 ${clip.id} 与前一片段重叠（${clip.startMs}ms < ${cursor}ms）：请把起点错开或缩短前一片段。`);
		if (clip.startMs > cursor) segments.push({
			kind: "filler",
			durationMs: clip.startMs - cursor
		});
		const assetPath = clip.assetPath;
		if (assetPath === void 0) throw new RenderError("MEDIA_ASSET_MISSING", `片段 ${clip.id} 没有素材路径：重新从素材面板选一次。`);
		segments.push({
			kind: "clip",
			clipId: clip.id,
			assetPath,
			inMs: clip.inMs ?? 0,
			durationMs: clip.durationMs,
			...clip.speed === void 0 ? {} : { speed: clip.speed },
			...clip.fade === void 0 ? {} : { fade: clip.fade },
			...clip.crop === void 0 ? {} : { crop: clip.crop },
			...clip.transition === void 0 ? {} : {
				transition: clip.transition,
				transitionMs: transitionDurationMs(clip)
			}
		});
		cursor = clip.startMs + effectiveDurationMs(clip);
	}
	if (snapshot.durationMs > cursor) segments.push({
		kind: "filler",
		durationMs: snapshot.durationMs - cursor
	});
	return segments;
}
/** 转义 drawtext 的文本与字体路径。 */
function escapeDrawtext(value) {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
}
/** 字幕烧录用的字体（macOS 常见中文字体，找不到就退回 ffmpeg 内置）。 */
const SUBTITLE_FONT_CANDIDATES = [
	"/System/Library/Fonts/PingFang.ttc",
	"/System/Library/Fonts/STHeiti Light.ttc",
	"/Library/Fonts/Arial Unicode.ttf"
];
/**
* 拼出渲染用的 ffmpeg 参数（纯函数，便于断言）。
* @param snapshot - 冻结快照。
* @param options - 输出路径、字体、画布尺寸。
* @returns `ffmpeg` 参数数组（不含可执行文件本身）。
*/
function buildRenderArgs(snapshot, options) {
	const segments = planVideoSegments(snapshot);
	const format = options.format ?? snapshot.exportFormat ?? DEFAULT_EXPORT_FORMAT;
	const width = options.width ?? format.width ?? 1280;
	const height = options.height ?? format.height ?? 720;
	const fps = options.frameRate ?? format.frameRate ?? snapshot.frameRate;
	const bitrateKbps = format.bitrateKbps;
	const args = [
		"-y",
		"-hide_banner",
		"-nostdin",
		"-loglevel",
		"error",
		"-progress",
		"pipe:1"
	];
	const audioTracks = planAudioTracks(snapshot);
	segments.forEach((segment) => {
		if (segment.kind === "filler") {
			args.push("-f", "lavfi", "-t", (segment.durationMs / 1e3).toFixed(3), "-i", `color=c=black:s=${width}x${height}:r=${fps}`);
			return;
		}
		if (segment.inMs > 0) args.push("-ss", (segment.inMs / 1e3).toFixed(3));
		args.push("-t", (segment.durationMs / 1e3).toFixed(3), "-i", segment.assetPath);
	});
	audioTracks.forEach((track) => {
		track.segments.forEach((segment) => {
			if (segment.kind === "filler") {
				args.push("-f", "lavfi", "-t", (segment.durationMs / 1e3).toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
				return;
			}
			if (segment.inMs > 0) args.push("-ss", (segment.inMs / 1e3).toFixed(3));
			args.push("-t", (segment.durationMs / 1e3).toFixed(3), "-i", segment.assetPath);
		});
	});
	const chains = [];
	const labels = [];
	segments.forEach((segment, index) => {
		const pre = [];
		if (segment.kind === "clip") {
			if (segment.crop !== void 0) pre.push(`crop=${segment.crop.width}:${segment.crop.height}:${segment.crop.x}:${segment.crop.y}`);
			if (segment.speed !== void 0 && segment.speed !== 1) pre.push(`setpts=${(1 / segment.speed).toFixed(4)}*PTS`);
			if (segment.fade !== void 0 && segment.fade > 0) {
				const effective = Math.max(1, Math.round(segment.durationMs / (segment.speed ?? 1)));
				const fadeMs = Math.min(segment.fade, Math.floor(effective / 2));
				if (fadeMs > 0) {
					const seconds = (fadeMs / 1e3).toFixed(3);
					const outStart = ((effective - fadeMs) / 1e3).toFixed(3);
					pre.push(`fade=t=in:st=0:d=${seconds}`, `fade=t=out:st=${outStart}:d=${seconds}`);
				}
			}
		}
		const prefix = pre.length === 0 ? "" : `${pre.join(",")},`;
		chains.push(`[${index}:v]${prefix}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${index}]`);
		labels.push(`[v${index}]`);
	});
	/**
	* 视频拼接（`A13b`）：段间有转场时改用 `xfade` 链（两段重叠 transitionMs），
	* 没有转场时沿用 `concat`（行为与之前完全一致，零回归）。
	*/
	const segmentMs = (segment) => segment.kind === "filler" ? segment.durationMs : Math.max(1, Math.round(segment.durationMs / (segment.speed ?? 1)));
	const overlaps = segments.map((segment, index) => {
		if (index === 0 || segment.kind !== "clip") return 0;
		const previous = segments[index - 1];
		if (previous === void 0 || previous.kind !== "clip") return 0;
		return Math.min(segment.transitionMs ?? 0, Math.floor(Math.min(segmentMs(segment), segmentMs(previous)) / 2));
	});
	if (!overlaps.some((ms) => ms > 0)) {
		const concat = `${labels.join("")}concat=n=${segments.length}:v=1:a=0`;
		chains.push(`${concat}[vcat]`);
	} else {
		let accumulator = labels[0];
		let accumulatorMs = segmentMs(segments[0]);
		for (let index = 1; index < segments.length; index += 1) {
			const segment = segments[index];
			const overlapMs = overlaps[index] ?? 0;
			const output = `x${index}`;
			if (overlapMs > 0) {
				const transition = segment.kind === "clip" ? segment.transition ?? "fade" : "fade";
				const offset = Math.max(0, (accumulatorMs - overlapMs) / 1e3).toFixed(3);
				chains.push(`${accumulator}[v${index}]xfade=transition=${transition}:duration=${(overlapMs / 1e3).toFixed(3)}:offset=${offset}[${output}]`);
				accumulatorMs = accumulatorMs + segmentMs(segment) - overlapMs;
			} else {
				chains.push(`${accumulator}[v${index}]concat=n=2:v=1:a=0[${output}]`);
				accumulatorMs += segmentMs(segment);
			}
			accumulator = `[${output}]`;
		}
		chains.push(`${accumulator}null[vcat]`);
	}
	const drawFilters = [];
	if (snapshot.burnSubtitles) for (const clip of snapshot.tracks.find((track) => track.kind === "subtitle")?.clips ?? []) {
		const fontSize = clip.style?.fontSize ?? 32;
		const color = (clip.style?.color ?? "#ffffff").replace("#", "0x");
		const y = clip.style?.position === "top" ? "h*0.08" : clip.style?.position === "middle" ? "(h-text_h)/2" : "h*0.85";
		const fontPart = options.fontFile === void 0 ? "" : `fontfile='${escapeDrawtext(options.fontFile)}':`;
		drawFilters.push(`drawtext=${fontPart}text='${escapeDrawtext(clip.text ?? "")}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:enable='between(t,${(clip.startMs / 1e3).toFixed(3)},${((clip.startMs + clip.durationMs) / 1e3).toFixed(3)})'`);
	}
	if (drawFilters.length === 0) chains.push(`[vcat]null[vout]`);
	else chains.push(`[vcat]${drawFilters.join(",")}[vout]`);
	const audioLabels = [];
	let audioInput = segments.length;
	audioTracks.forEach((track, trackIndex) => {
		const labels = [];
		track.segments.forEach((_segment, segmentIndex) => {
			const label = `a${trackIndex}_${segmentIndex}`;
			chains.push(`[${audioInput}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${track.volume.toFixed(2)}[${label}]`);
			labels.push(`[${label}]`);
			audioInput += 1;
		});
		const out = `at${trackIndex}`;
		chains.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[${out}]`);
		audioLabels.push(`[${out}]`);
	});
	if (audioLabels.length === 1) chains.push(`${audioLabels[0]}anull[aout]`);
	else if (audioLabels.length > 1) chains.push(`${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`);
	args.push("-filter_complex", chains.join(";"));
	args.push("-map", "[vout]");
	if (audioLabels.length === 0) args.push("-an");
	else args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2");
	args.push("-c:v", "libx264", "-preset", "veryfast", ...bitrateKbps === void 0 ? ["-crf", "20"] : ["-b:v", `${bitrateKbps}k`], "-pix_fmt", "yuv420p", "-movflags", "+faststart", options.outputPath);
	return args;
}
/**
* 规划参与导出的音轨（`R-TML-4`）：静音轨与 0 音量轨直接不输出；轨内重叠报错；
* 间隙与尾部补静音，保证与画面等长。
* @param snapshot - 冻结快照。
* @returns 需要混音的音轨（可能为空 = 输出无音轨）。
*/
function planAudioTracks(snapshot) {
	const tracks = [];
	for (const track of snapshot.tracks.filter((candidate) => candidate.kind === "audio")) {
		if (track.muted === true || (track.volume ?? 1) <= 0) continue;
		if (track.clips.length === 0) continue;
		const volume = Math.min(2, Math.max(0, track.volume ?? 1));
		const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs);
		const segments = [];
		let cursor = 0;
		for (const clip of ordered) {
			if (clip.startMs < cursor) throw new RenderError("MEDIA_TIMELINE_OVERLAP", `音轨 ${track.id} 上片段 ${clip.id} 与前一片段重叠：请把起点错开或缩短前一片段。`);
			if (clip.startMs > cursor) segments.push({
				kind: "filler",
				durationMs: clip.startMs - cursor
			});
			const assetPath = clip.assetPath;
			if (assetPath === void 0) throw new RenderError("MEDIA_ASSET_MISSING", `音轨片段 ${clip.id} 没有素材路径：重新选一次音频素材。`);
			segments.push({
				kind: "clip",
				clipId: clip.id,
				assetPath,
				inMs: clip.inMs ?? 0,
				durationMs: clip.durationMs
			});
			cursor = clip.startMs + clip.durationMs;
		}
		if (snapshot.durationMs > cursor) segments.push({
			kind: "filler",
			durationMs: snapshot.durationMs - cursor
		});
		tracks.push({
			trackId: track.id,
			volume,
			segments
		});
	}
	return tracks;
}
/** 默认 runner：spawn ffmpeg、解析 out_time_ms、abort 时杀进程。 */
const defaultRenderRunner = async ({ ffmpegPath, args, signal, onProgress, durationMs }) => {
	await new Promise((resolve, reject) => {
		const child = spawn(ffmpegPath, [...args], {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			shell: process.platform === "win32"
		});
		let stderr = "";
		let settled = false;
		const finish = (error) => {
			if (settled) return;
			settled = true;
			if (error === void 0) resolve();
			else reject(error);
		};
		const onAbort = () => {
			child.kill("SIGKILL");
			finish(new RenderError("MEDIA_RENDER_CANCELLED", "渲染已取消：已停掉 ffmpeg 并清理半成品。"));
		};
		if (signal?.aborted === true) {
			onAbort();
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout?.on("data", (chunk) => {
			for (const line of String(chunk).split("\n")) {
				const match = /^out_time_ms=(\d+)/.exec(line.trim());
				if (match === null || onProgress === void 0) continue;
				const outTimeMs = Number(match[1]) / 1e3;
				onProgress({
					outTimeMs,
					percent: durationMs <= 0 ? 0 : Math.min(100, Math.round(outTimeMs / durationMs * 100))
				});
			}
		});
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", (error) => finish(new RenderError("MEDIA_FFMPEG_UNAVAILABLE", `ffmpeg 无法启动：${error.message}`)));
		child.on("close", (code) => {
			signal?.removeEventListener("abort", onAbort);
			if (settled) return;
			if (code === 0) {
				finish();
				return;
			}
			const text = stderr.trim();
			if (/No space left on device|ENOSPC/i.test(text)) {
				finish(new RenderError("MEDIA_DISK_FULL", "磁盘空间不足：清出空间再导出。"));
				return;
			}
			if (/Unknown encoder|not found|Unrecognized option/i.test(text)) {
				finish(new RenderError("MEDIA_ENCODER_UNSUPPORTED", `这份 ffmpeg 缺需要的编码器：${text.slice(0, 200)}`));
				return;
			}
			if (/No such file or directory/i.test(text)) {
				finish(new RenderError("MEDIA_ASSET_MISSING", `素材读不到（可能已被移动或删除）：${text.slice(0, 200)}`));
				return;
			}
			if (/not recognized as an internal or external command|The system cannot find the (path|file) specified/i.test(text)) {
				finish(new RenderError("MEDIA_FFMPEG_UNAVAILABLE", `ffmpeg 无法启动：${text.split("\n")[0]}`));
				return;
			}
			finish(new RenderError("MEDIA_RENDER_FAILED", `ffmpeg 渲染失败（退出码 ${code}）：${text.slice(0, 300)}`));
		});
	});
};
/** 渲染服务。 */
var RenderService = class {
	deps;
	/** 输出目录统一解析成绝对路径：素材记录里存相对路径会让后续 ffmpeg/预览都找不到文件。 */
	outputsDir;
	constructor(deps) {
		this.deps = deps;
		this.outputsDir = isAbsolute(deps.outputsDir) ? deps.outputsDir : resolve(deps.outputsDir);
	}
	/**
	* 把一个时间轴渲染成 mp4。
	* @param timeline - 当前时间轴文档（内部会先冻结成快照）。
	* @param options - 输出文件名、取消信号、进度回调。
	* @returns 输出路径、字节数与实测时长。
	* @throws {RenderError} 见 {@link RenderErrorCode}。
	*/
	async render(timeline, options = {}) {
		const snapshot = freezeTimeline(timeline);
		const probe = await (this.deps.probe ?? (() => probeFfmpeg()))();
		if (!probe.available) throw new RenderError(probe.code === "MEDIA_FFMPEG_ENCODER_MISSING" ? "MEDIA_FFMPEG_ENCODER_MISSING" : "MEDIA_FFMPEG_UNAVAILABLE", probe.message ?? `ffmpeg 不可用，无法导出；可设 DSH_FFMPEG_PATH 指向可用副本后重试。`);
		const segments = planVideoSegments(snapshot);
		const gone = (await Promise.all(segments.filter((segment) => segment.kind === "clip").map(async (segment) => ({
			segment,
			exists: await stat(segment.assetPath).then(() => true).catch(() => false)
		})))).find((entry) => !entry.exists);
		if (gone !== void 0) throw new RenderError("MEDIA_ASSET_MISSING", `素材不存在：${gone.segment.assetPath}（片段 ${gone.segment.clipId}）。重新登记素材或换一个片段。`);
		const stamp = this.deps.now?.() ?? /* @__PURE__ */ new Date();
		const fileName = options.fileName ?? `${stamp.getTime()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
		const outputPath = join(this.outputsDir, fileName);
		await mkdir(dirname(outputPath), { recursive: true });
		const fontFile = snapshot.burnSubtitles && (snapshot.tracks.find((track) => track.kind === "subtitle")?.clips.length ?? 0) > 0 ? await firstExisting(SUBTITLE_FONT_CANDIDATES) : void 0;
		const format = snapshot.exportFormat ?? DEFAULT_EXPORT_FORMAT;
		const args = buildRenderArgs(snapshot, {
			outputPath,
			format,
			...fontFile === void 0 ? {} : { fontFile }
		});
		const run = this.deps.run ?? defaultRenderRunner;
		try {
			await run({
				ffmpegPath: probe.path ?? "ffmpeg",
				args,
				...options.signal === void 0 ? {} : { signal: options.signal },
				durationMs: snapshot.durationMs,
				...options.onProgress === void 0 ? {} : { onProgress: options.onProgress }
			});
		} catch (error) {
			await rm(outputPath, { force: true }).catch(() => void 0);
			throw error;
		}
		const info = await stat(outputPath).catch(() => void 0);
		if (info === void 0 || info.size === 0) throw new RenderError("MEDIA_OUTPUT_INVALID", `导出没有产生有效文件：${outputPath}`);
		const measured = await measureDuration(probe.path ?? "ffmpeg", outputPath);
		if (measured !== void 0) {
			const tolerance = frameToleranceMs(snapshot.frameRate);
			if (Math.abs(measured - snapshot.durationMs) > tolerance + 1) throw new RenderError("MEDIA_OUTPUT_INVALID", `导出时长 ${Math.round(measured)}ms 与时间轴 ${snapshot.durationMs}ms 相差超过 1 帧（${tolerance.toFixed(1)}ms）：检查素材是否可解码。`);
		}
		const spec = await probeMediaSpec(probe.path ?? "ffmpeg", outputPath);
		if (spec !== void 0 && spec.width !== void 0 && spec.height !== void 0) {
			if (spec.width !== format.width || spec.height !== format.height) throw new RenderError("MEDIA_OUTPUT_INVALID", `导出分辨率 ${spec.width}x${spec.height} 与请求的 ${format.width}x${format.height} 不一致：检查素材能否解码到该尺寸。`);
			if (spec.fps !== void 0 && Math.abs(spec.fps - format.frameRate) > 1) throw new RenderError("MEDIA_OUTPUT_INVALID", `导出帧率 ${spec.fps} 与请求的 ${format.frameRate} 不一致：检查素材帧率与滤镜链。`);
		}
		return {
			outputPath,
			bytes: info.size,
			durationMs: measured ?? snapshot.durationMs
		};
	}
};
/** 找到第一个存在的文件。 */
async function firstExisting(paths) {
	for (const path of paths) if (await stat(path).then(() => true).catch(() => false)) return path;
}
/**
* 用 `ffmpeg -i` 的输出探测产物规格（不依赖 ffprobe 单独安装）。
* @param ffmpegPath - ffmpeg 可执行文件。
* @param file - 待探测文件。
* @returns 宽/高/帧率/是否含音轨；解析不出来时为 `undefined`。
*/
async function probeMediaSpec(ffmpegPath, file) {
	const stream = await new Promise((resolve) => {
		const child = spawn(ffmpegPath, [
			"-hide_banner",
			"-i",
			file
		], { stdio: [
			"ignore",
			"ignore",
			"pipe"
		] });
		let stderr = "";
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", () => resolve({
			stderr: "",
			ok: false
		}));
		child.on("close", () => resolve({
			stderr,
			ok: true
		}));
	});
	if (!stream.ok) return void 0;
	const hasAudio = /Stream #\d+:\d+.*: Audio: /.test(stream.stderr);
	const video = /Stream #\d+:\d+.*: Video: .*?(\d{2,5})x(\d{2,5})/.exec(stream.stderr);
	if (video === null) return hasAudio ? { hasAudio } : void 0;
	const fpsMatch = /(\d+(?:\.\d+)?) fps/.exec(stream.stderr);
	return {
		width: Number(video[1]),
		height: Number(video[2]),
		hasAudio,
		...fpsMatch === null ? {} : { fps: Number(fpsMatch[1]) }
	};
}
/** 用 `ffmpeg -i` 的输出量一下真实时长（不依赖 ffprobe 是否单独安装）。 */
async function measureDuration(ffmpegPath, file) {
	return new Promise((resolve) => {
		const child = spawn(ffmpegPath, [
			"-hide_banner",
			"-i",
			file
		], { stdio: [
			"ignore",
			"ignore",
			"pipe"
		] });
		let stderr = "";
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", () => resolve(void 0));
		child.on("close", () => {
			const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr);
			if (match === null) {
				resolve(void 0);
				return;
			}
			const [, hours, minutes, seconds] = match;
			resolve((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1e3);
		});
	});
}
//#endregion
//#region src/media/render-registry.ts
/**
* 导出任务的登记与取消（`T5-5` 的宿主半边）。
*
* 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
* 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
*/
/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
var RenderRegistry = class {
	deps;
	jobs = /* @__PURE__ */ new Map();
	controllers = /* @__PURE__ */ new Map();
	/** 等待槽位的任务（FIFO，`A4`）。 */
	pending = [];
	constructor(deps) {
		this.deps = deps;
	}
	stamp() {
		return (this.deps.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
	}
	patch(id, update) {
		const current = this.jobs.get(id);
		if (current === void 0) return;
		this.jobs.set(id, {
			...current,
			...update
		});
	}
	/** 列出任务（最新在前），可按项目过滤。 */
	list(projectId) {
		return [...this.jobs.values()].filter((job) => projectId === void 0 || job.projectId === projectId).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
	}
	/** 取一个任务。 */
	get(id) {
		return this.jobs.get(id);
	}
	/** 该任务是否还在跑。 */
	isRunning(id) {
		return this.controllers.has(id);
	}
	/**
	* 取消一次导出（连带杀掉 ffmpeg）。
	* @param id - 任务 id。
	* @returns 是否确实取消了一个在跑的任务。
	*/
	cancel(id) {
		const controller = this.controllers.get(id);
		if (controller === void 0) {
			const index = this.pending.findIndex((entry) => entry.job.id === id);
			if (index < 0) return false;
			this.pending.splice(index, 1);
			this.pending.forEach((entry, position) => {
				this.patch(entry.job.id, { queuePosition: position + 1 });
			});
			this.patch(id, {
				status: "cancelled",
				queued: false,
				queuePosition: void 0,
				finishedAt: this.stamp(),
				error: "排队时已取消"
			});
			return true;
		}
		controller.abort();
		return true;
	}
	/**
	* 起一次导出（立即返回任务快照，渲染在后台推进）。
	* @param timeline - 要渲染的时间轴（内部由 {@link RenderService} 冻结成快照）。
	* @returns 刚建立的任务。
	*/
	start(timeline) {
		const id = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
		const maxConcurrent = Math.max(1, this.deps.maxConcurrent ?? 1);
		const job = {
			id,
			timelineId: timeline.id,
			projectId: timeline.projectId,
			status: "running",
			percent: 0,
			startedAt: this.stamp()
		};
		this.jobs.set(id, job);
		if (this.controllers.size >= maxConcurrent) {
			this.pending.push({
				job,
				timeline
			});
			this.patch(id, {
				queued: true,
				queuePosition: this.pending.length
			});
			this.deps.log?.({
				event: "render-queued",
				renderId: id,
				timelineId: timeline.id,
				position: this.pending.length
			});
			return this.jobs.get(id) ?? job;
		}
		this.launch(job.id, timeline);
		return this.jobs.get(id) ?? job;
	}
	/** 真正开跑一个任务（内部：start 或出队时调用）。 */
	launch(id, timeline) {
		const job = this.jobs.get(id);
		if (job === void 0) return;
		this.patch(id, {
			queued: false,
			queuePosition: void 0
		});
		const controller = new AbortController();
		this.controllers.set(id, controller);
		this.deps.render.render(timeline, {
			signal: controller.signal,
			onProgress: (progress) => {
				this.patch(id, { percent: progress.percent });
			}
		}).then(async (result) => {
			this.patch(id, {
				status: "succeeded",
				percent: 100,
				finishedAt: this.stamp(),
				outputPath: result.outputPath,
				bytes: result.bytes,
				durationMs: result.durationMs
			});
			this.deps.log?.({
				event: "render",
				renderId: id,
				timelineId: job.timelineId,
				status: "succeeded",
				durationMs: Date.now() - Date.parse(job.startedAt),
				bytes: result.bytes,
				outputPath: result.outputPath
			});
			const finished = this.jobs.get(id);
			if (finished !== void 0 && this.deps.registerAsset !== void 0) await this.deps.registerAsset(finished).catch((error) => {
				this.deps.onError?.(`could not register render ${id}: ${error instanceof Error ? error.message : String(error)}`);
			});
		}).catch((error) => {
			const cancelled = error instanceof RenderError && error.code === "MEDIA_RENDER_CANCELLED";
			const message = error instanceof Error ? error.message : String(error);
			this.patch(id, {
				status: cancelled ? "cancelled" : "failed",
				finishedAt: this.stamp(),
				...error instanceof RenderError ? { code: error.code } : {},
				error: message
			});
			this.deps.log?.({
				event: "render",
				renderId: id,
				timelineId: job.timelineId,
				status: cancelled ? "cancelled" : "failed",
				durationMs: Date.now() - Date.parse(job.startedAt),
				...error instanceof RenderError ? { code: error.code } : {},
				error: message
			});
		}).finally(() => {
			this.controllers.delete(id);
			const next = this.pending.shift();
			if (next !== void 0) {
				this.pending.forEach((entry, index) => {
					this.patch(entry.job.id, { queuePosition: index + 1 });
				});
				this.launch(next.job.id, next.timeline);
			}
		});
	}
	/** 进程重启时把遗留的"运行中"任务按失败收尾。 */
	failStale(reason) {
		let closed = 0;
		for (const [id, job] of this.jobs) {
			if (job.status !== "running") continue;
			closed += 1;
			this.jobs.set(id, {
				...job,
				status: "failed",
				finishedAt: this.stamp(),
				error: reason
			});
			this.controllers.delete(id);
		}
		return closed;
	}
};
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
//#region ../../packages/attachment/attachment/lib/index.js
/** Attachment failure class. @module @deepseek-ai/dsh-attachment/error */
const IMAGE_ADMISSION_ERROR_CODES = [
	"TOO_MANY_IMAGES",
	"IMAGES_TOO_LARGE",
	"UNSUPPORTED_IMAGE_TYPE",
	"INVALID_IMAGE_BASE64",
	"INVALID_IMAGE",
	"IMAGE_TYPE_MISMATCH",
	"IMAGE_TOO_LARGE",
	"IMAGE_TOO_MANY_PIXELS",
	"IMAGE_DIMENSION_TOO_LARGE"
];
const ATTACHMENT_ERROR_CODES = [
	...IMAGE_ADMISSION_ERROR_CODES,
	"INVALID_FILE_BASE64",
	"INVALID_ATTACHMENT_REF",
	"ATTACHMENT_CORRUPT",
	"ATTACHMENT_WRITE_FAILED",
	"ATTACHMENT_NOT_FOUND",
	"ATTACHMENT_READ_FAILED",
	"ATTACHMENT_PROJECTION_UNSUPPORTED",
	"ATTACHMENT_FILES_UNSUPPORTED"
];
new Set(IMAGE_ADMISSION_ERROR_CODES);
new Set(ATTACHMENT_ERROR_CODES);
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
const TRANSPORT_PROBE_TTL_MS = 600 * 1e3;
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
	if (input.transport === "async" && !input.adapterSupportsAsync) throw new GenerationError("task", `生图配置错误：服务商 ${provider} 不支持异步图片传输，但 imageTransport=async 要求它。可改用支持异步图片传输的服务商（如 threerouter），或把 imageTransport 改为 auto/sync`, false);
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
		...image.name === void 0 ? {} : { name: image.name },
		...image.originalDimensions === void 0 ? {} : { originalDimensions: image.originalDimensions }
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
	const { config, taskManager, attachments, ctx, runtimeDefaults, outputsDir, resolveApiKey } = deps;
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
		const creds = await resolveProviderCredentials(config, candidate, resolveApiKey);
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
							name: { type: "string" },
							originalDimensions: {
								type: "object",
								additionalProperties: false,
								description: "归一化前的原始像素尺寸；仅在附件服务缩放了图片时出现。",
								properties: {
									width: {
										type: "integer",
										required: true
									},
									height: {
										type: "integer",
										required: true
									}
								}
							}
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
							name: { type: "string" },
							originalDimensions: {
								type: "object",
								additionalProperties: false,
								description: "归一化前的原始像素尺寸；仅在附件服务缩放了图片时出现。",
								properties: {
									width: {
										type: "integer",
										required: true
									},
									height: {
										type: "integer",
										required: true
									}
								}
							}
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
			const explicitReferences = Array.isArray(typedArgs.images) ? await Promise.all(typedArgs.images.filter((value) => typeof value === "string" && value.trim() !== "").map(async (value) => compressImageReference(await resolveImageReference(value)))) : [];
			const resolvedReferences = explicitReferences.length > 0 ? explicitReferences : conversationReferences;
			const imageReference = typedArgs.image ? await compressImageReference(await resolveImageReference(typedArgs.image)) : void 0;
			const imageReferences = imageReference !== void 0 ? [imageReference] : resolvedReferences;
			const model = typedArgs.model || config.defaultImageModel || void 0;
			const size = typedArgs.size ?? runtime.imageSize ?? config.defaultImageSize;
			const candidates = resolveModelCandidates("image", model, runtime.imageProvider ?? (config.defaultImageProvider === "" ? void 0 : config.defaultImageProvider) ?? config.provider, (p) => hasConfiguredCredentials(config, p));
			if (candidates.length === 0) throw new Error("dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey 或 apiKeyEnv");
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
					const creds = await resolveProviderCredentials(config, candidate, resolveApiKey);
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
//#region src/compare.ts
/**
* 原片 / 复刻对比片合成：把参考视频与复刻结果并成一条可直接对照的对比片。
*
* 拼接方向按**原片画幅**自动选择：竖屏（3:4、9:16 等 height ≥ width）左右并排，
* 横屏（4:3、16:9 等 width > height）上下堆叠。理由是画布形状——竖屏再上下堆叠
* 会得到极端细长的画面、横屏再左右并排会得到极端宽扁的画面，两者都难以观看。
*
* 依赖 ffmpeg / ffprobe，与首帧压缩、参考视频压缩共用同一条外部依赖。
* @module dsh-image-video/compare
*/
const execFileAsync = promisify(execFile);
/** 单格高度上限：对比片用于对照动作与构图，720p 一档足够。 */
const CELL_HEIGHT = 720;
/** 对比片帧率：两侧统一到固定帧率，拼接才不掉帧。 */
const COMPARE_FPS = 30;
/** 标签字体候选：命中即叠加 ORIGINAL / AI RECREATED 角标，全部未命中则不加（不影响合成）。 */
const LABEL_FONTS = [
	"/System/Library/Fonts/Supplemental/Arial.ttf",
	"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
	"/usr/share/fonts/TTF/DejaVuSans.ttf",
	"C:/Windows/Fonts/arial.ttf"
];
/**
* 按原片画幅选择拼接方向。
* @param width - 原片宽度（像素）。
* @param height - 原片高度（像素）。
* @returns 竖屏（含正方形）为左右并排，横屏为上下堆叠。
*/
function resolveCompareLayout(width, height) {
	return height >= width ? "side-by-side" : "stacked";
}
/**
* 探测视频画幅。
* @param path - 本地路径或可被 ffprobe 读取的 URL。
* @returns 视频宽高（像素）。
* @throws ffprobe 不可用或无法解析画幅时抛错。
*/
async function probeFrameSize(path) {
	const { stdout } = await execFileAsync("ffprobe", [
		"-v",
		"error",
		"-select_streams",
		"v:0",
		"-show_entries",
		"stream=width,height",
		"-of",
		"csv=p=0",
		path
	]);
	const [width, height] = stdout.trim().split(",").map(Number);
	if (width === void 0 || height === void 0 || !(width > 0) || !(height > 0)) throw new Error(`无法探测视频画幅：${path}`);
	return {
		width,
		height
	};
}
/** 找到可用于角标的字体文件；找不到返回 undefined（对比片照常合成，只是没有角标）。 */
async function findLabelFont() {
	for (const font of LABEL_FONTS) try {
		await access(font);
		return font;
	} catch {}
}
/**
* 单侧视频链：等比缩放进 cellW×cellH 画布并居中，统一帧率，可选叠加角标。
* @param index - 输入序号（0=原片，1=复刻结果）。
* @param label - 角标文字；undefined 表示不叠加。
* @param font - 角标字体文件；label 有值且字体可用时才生效。
* @param cellW - 单格宽度（像素）。
* @param cellH - 单格高度（像素）。
* @returns filter_complex 中的一条链。
*/
function cellChain(index, label, font, cellW, cellH) {
	return `${`[${index}:v]scale=${cellW}:${cellH}:force_original_aspect_ratio=decrease,pad=${cellW}:${cellH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${COMPARE_FPS}`}${label !== void 0 && font !== void 0 ? `,drawtext=fontfile=${font}:text='${label}':x=18:y=16:fontsize=${Math.max(16, Math.round(cellH / 21))}:fontcolor=white:box=1:boxcolor=black@0.55` : ""}[c${index}]`;
}
/**
* 合成对比片：左/上为原片、右/下为复刻结果，两侧等比缩放、统一帧率、按较短者截断。
* @param deps - 原片路径、复刻结果路径与取消信号。
* @returns 对比片字节与本次实际采用的画布参数。
* @throws ffprobe 无法读画幅、或 ffmpeg 合成失败时抛错（由调用方决定是否降级为提示）。
*/
async function renderComparison(deps) {
	const frame = await probeFrameSize(deps.source);
	const layout = resolveCompareLayout(frame.width, frame.height);
	const cellHeight = Math.min(CELL_HEIGHT, frame.height);
	const cellWidth = Math.max(2, Math.round(cellHeight * frame.width / frame.height / 2) * 2);
	const font = await findLabelFont();
	const stack = layout === "side-by-side" ? "hstack" : "vstack";
	const filters = [
		cellChain(0, "ORIGINAL", font, cellWidth, cellHeight),
		cellChain(1, "AI RECREATED", font, cellWidth, cellHeight),
		`[c0][c1]${stack}=inputs=2[v]`
	].join(";");
	const outPath = join(tmpdir(), `dsh-compare-${randomBytes(6).toString("hex")}.mp4`);
	try {
		await execFileAsync("ffmpeg", [
			"-y",
			"-v",
			"error",
			"-i",
			deps.source,
			"-i",
			deps.result,
			"-filter_complex",
			filters,
			"-map",
			"[v]",
			"-shortest",
			"-c:v",
			"libx264",
			"-crf",
			"18",
			"-preset",
			"veryfast",
			"-pix_fmt",
			"yuv420p",
			outPath
		], deps.signal === void 0 ? {} : { signal: deps.signal });
		const data = await readFile(outPath);
		if (data.byteLength === 0) throw new Error("对比片合成为空文件");
		return {
			data,
			contentType: "video/mp4",
			layout,
			width: layout === "side-by-side" ? cellWidth * 2 : cellWidth,
			height: layout === "side-by-side" ? cellHeight : cellHeight * 2,
			cellWidth,
			cellHeight
		};
	} finally {
		await unlink(outPath).catch(() => {});
	}
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
* 工具参数：prompt（必填）、duration（可选，1–30 秒；-1 = 保持参考视频原时长）、model（可选）、aspectRatio（可选）、
* image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
*/
function createGenerateVideoTool(deps) {
	const { config, taskManager, runtimeDefaults, resolveApiKey } = deps;
	const outputsDir = deps.outputsDir ?? config.outputsDir;
	return defineTool({
		name: "generate_video",
		description: `根据文本提示词生成短视频；传入 image（首帧图片）时为图生视频，让图片动起来。服务商选择：配置链服务商优先（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；视频生成固定通过 ThreeRouter 提交（项目约定，禁止切换到 OpenArt 或其他直连服务商），不使用任何其他服务商回退。模型取值：调用参数 model > 配置 defaultVideoModel > 多关键帧自动路由 > 服务商内置默认模型（threerouter 默认 minimax-h3）。不要自行编写脚本或直接调用服务商 API。视频时长上限 ${MAX_VIDEO_DURATION} 秒；具体模型能力由上游校验，wan 系模型不支持自定义时长时会在结果 notes 注明。生成完成后视频保存到本地 outputs/ 目录。参数：prompt（提示词，必填）、duration（时长秒数，1-30；传 -1 表示保持参考视频原时长/由模型智能决定）、model（模型名，可选，留空用配置或服务商内置默认模型）、aspectRatio（宽高比，可选，留空 16:9；图生视频时忽略，多关键帧时也忽略，参考视频时默认 adaptive 保持原片比例）、image（首帧图片：本地路径/URL，可选，单图时用）、media（参考素材序列：数组，每项含 image 路径/URL 或 video 路径/URL，可带 type 与 position；传 video 即「视频编辑」——把参考视频交给 wan3.0-video，配合提示词里的编辑意图（如"替换""改成""去掉"）改内容而保留原片动作，此时 model 缺省为 wan3.0-video、ratio 缺省 adaptive、duration 缺省 -1；适用于 MiniMax-H3 / wan3.0-video，此时 image 字段忽略）、resolution（分辨率档位，可选，取值随模型）、compare（是否额外产出「原片 / 复刻」对比片，可选，存在参考视频时缺省 true；拼接方向按原片画幅自动选择——竖屏（3:4、9:16）左右并排，横屏（4:3、16:9）上下堆叠）。`,
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
			},
			compare: {
				type: "boolean",
				description: "是否额外产出一条「原片 / 复刻」对比片（左原片右复刻，或上原片下复刻）。存在参考视频时缺省开启；拼接方向按原片画幅自动选择：竖屏（3:4、9:16）左右并排，横屏（4:3、16:9）上下堆叠。"
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
					comparePath: {
						type: "string",
						description: "原片 / 复刻对比片本地路径（存在参考视频且未禁用 compare 时生成）。"
					},
					compareLayout: {
						type: "string",
						enum: ["side-by-side", "stacked"],
						description: "对比片拼接方向：原片竖屏左右并排（side-by-side）、原片横屏上下堆叠（stacked）。"
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
					...v.comparePath === void 0 ? {} : { comparePath: v.comparePath },
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
					...v.comparePath === void 0 ? {} : { comparePath: v.comparePath },
					...v.compareLayout === void 0 ? {} : { compareLayout: v.compareLayout },
					...v.notes ? { notes: v.notes } : {}
				};
			}
		},
		async execute(args, exec) {
			const typedArgs = args;
			const referenceVideoInput = typedArgs.media?.find((m) => typeof m.video === "string" && m.video.trim() !== "" && (m.type ?? "reference_video") === "reference_video")?.video;
			const mediaRef = typedArgs.media ? await resolveVideoMedia(typedArgs.media) : void 0;
			const hasMedia = !!mediaRef;
			const hasRefVideo = mediaRef?.some((m) => m.type === "reference_video") ?? false;
			const runtime = runtimeDefaults.get();
			const duration = typedArgs.duration ?? (hasRefVideo ? -1 : runtime.videoDuration ?? config.defaultVideoDuration);
			if (duration !== -1 && (duration < 1 || duration > MAX_VIDEO_DURATION)) throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间（-1 表示保持参考视频原时长），当前为 ${duration}`);
			const preferred = runtime.videoProvider ?? (config.defaultVideoProvider === "" ? void 0 : config.defaultVideoProvider);
			const candidates = resolveModelCandidates("video", typedArgs.model, preferred ?? config.provider, (p) => hasConfiguredCredentials(config, p));
			if (candidates.length === 0) throw new Error("dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey 或 apiKeyEnv");
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
				const creds = await resolveProviderCredentials(config, candidate, resolveApiKey);
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
			let comparePath;
			let compareLayout;
			if ((typedArgs.compare ?? true) && hasRefVideo && referenceVideoInput !== void 0) try {
				const comparison = await renderComparison({
					source: referenceVideoInput,
					result: saved.localPath,
					signal: exec.signal
				});
				const written = await writeOutputFile(comparison.data, comparison.contentType, outputsDir, ".mp4");
				comparePath = written.localPath;
				compareLayout = comparison.layout;
				notes.push(`对比片：${comparison.layout === "side-by-side" ? "原片竖屏 → 左右并排" : "原片横屏 → 上下堆叠"}，${comparison.width}×${comparison.height}，已保存 ${written.localPath}`);
			} catch (err) {
				notes.push(`对比片合成失败（不影响复刻结果）：${err instanceof Error ? err.message : String(err)}`);
			}
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
				...comparePath === void 0 ? {} : { comparePath },
				...compareLayout === void 0 ? {} : { compareLayout },
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
/**
* 把模板实例化成工作流记录（自动排版节点位置）。
* @param template - 模板。
* @param projectId - 归属项目。
* @param newId - id 生成器（测试可注入）。
* @returns 可直接保存的工作流记录。
*/
function instantiateTemplate(template, projectId, newId, now = () => /* @__PURE__ */ new Date()) {
	const stamp = now().toISOString();
	return {
		schemaVersion: 1,
		id: newId(),
		projectId,
		name: template.describe.split("：")[0] ?? template.id,
		nodes: template.nodes.map((node, index) => ({
			id: `${template.id}-${index}`,
			kind: node.kind,
			position: {
				x: index % 4 * 220,
				y: Math.floor(index / 4) * 160
			},
			params: node.params
		})),
		edges: template.edges.map(([from, to]) => ({
			id: `${template.id}-${from}-${to}`,
			source: `${template.id}-${from}`,
			target: `${template.id}-${to}`
		})),
		createdAt: stamp,
		updatedAt: stamp
	};
}
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
	const newId = options.newId ?? (() => `sub-${Date.now().toString(36)}-${newIdCounter++}`);
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
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function requireString(args, key, action) {
	const value = args[key];
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${action} 需要参数 ${key}（非空字符串）`);
	return value.trim();
}
function optionalLimit(args) {
	const raw = args.limit;
	if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
	return Math.max(1, Math.min(50, Math.round(raw)));
}
function unknownAction(tool, action, allowed) {
	throw new Error(`${tool} 不认识 action=${action}；合法取值：${allowed.join(" / ")}`);
}
function json(value) {
	return JSON.stringify(value, null, 2);
}
/**
* 造出全部工作台工具。
* @param deps - 存储、运行器、导出与取消表。
* @returns 工具定义数组（调用方用 `ctx.tools.register` 注册，disposer 交给框架）。
*/
function createWorkbenchTools(deps) {
	const { store, renders, runner } = deps;
	return [
		defineTool({
			name: "workbench_projects",
			description: "工作台的项目：list（列出全部项目，可按名称过滤）、create（新建项目）、rename（改名）。项目是素材/时间轴/工作流的归属单位；拿不准用哪个就先 list。",
			output: {
				schema: {
					type: "string",
					description: "JSON 文本结果"
				},
				render: (_args, value) => [{
					type: "text",
					text: value
				}]
			},
			parameters: {
				action: {
					type: "string",
					required: true,
					description: "list / create / rename"
				},
				name: {
					type: "string",
					description: "create 时的项目名（1-80 字）；rename 时的新名字"
				},
				projectId: {
					type: "string",
					description: "rename 时的项目 id"
				},
				filter: {
					type: "string",
					description: "list 时按名称包含此子串过滤（可选）"
				},
				limit: {
					type: "integer",
					description: `list 最多返回多少行（默认 50）`
				},
				trims: {
					type: "array",
					description: `trim 时改哪些片段（≤20）：每项 {clipId, startMs?, durationMs?, inMs?}`,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							clipId: {
								type: "string",
								description: "片段 id（timeline list 里拿）"
							},
							startMs: {
								type: "integer",
								description: "新的起点（毫秒）"
							},
							durationMs: {
								type: "integer",
								description: "新的时长（毫秒）"
							},
							inMs: {
								type: "integer",
								description: "源内偏移（毫秒）"
							}
						}
					}
				},
				clipIds: {
					type: "array",
					description: "drop-clip 时要移出时间轴的片段 id",
					items: {
						type: "string",
						description: "片段 id"
					}
				},
				width: {
					type: "integer",
					description: "set-format 时导出宽度（偶数 128–4096）"
				},
				height: {
					type: "integer",
					description: "set-format 时导出高度（偶数 128–4096）"
				},
				frameRate: {
					type: "integer",
					description: "set-format 时导出帧率（24/25/30/60）"
				},
				bitrateKbps: {
					type: "integer",
					description: "set-format 时视频码率（kbps，可选）"
				},
				track: {
					type: "string",
					description: "set-track 时的轨道：video / audio / subtitle（默认 audio）"
				},
				maxChars: {
					type: "integer",
					description: "add-subtitles 时单条字幕最多字数（默认 28）"
				},
				startMs: {
					type: "integer",
					description: "起始时间（毫秒）；add-subtitles 缺省接在字幕轨末尾"
				},
				endMs: {
					type: "integer",
					description: "结束时间（毫秒）；add-subtitles 缺省到时间轴末尾"
				},
				volume: {
					type: "number",
					description: "set-track 时的轨道音量（0–2）"
				},
				muted: {
					type: "boolean",
					description: "set-track 时是否静音"
				}
			},
			async execute(args) {
				const input = asRecord(args);
				const action = requireString(input, "action", "workbench_projects");
				if (action === "list") {
					const filter = typeof input.filter === "string" && input.filter !== "" ? input.filter : void 0;
					const rows = (await store.listProjects()).filter((project) => filter === void 0 || project.name.includes(filter)).slice(0, optionalLimit(input));
					return json({
						projects: rows.map((project) => ({
							id: project.id,
							name: project.name,
							updatedAt: project.updatedAt
						})),
						count: rows.length
					});
				}
				if (action === "create") {
					const project = await store.createProject(requireString(input, "name", "workbench_projects create"));
					return json({ project: {
						id: project.id,
						name: project.name
					} });
				}
				if (action === "rename") {
					const target = requireString(input, "projectId", "workbench_projects rename");
					const updated = await store.renameProject(target, requireString(input, "name", "workbench_projects rename"));
					if (updated === void 0) throw new Error(`找不到项目 ${target}`);
					return json({ project: {
						id: updated.id,
						name: updated.name
					} });
				}
				return unknownAction("workbench_projects", action, [
					"list",
					"create",
					"rename"
				]);
			}
		}),
		defineTool({
			name: "workbench_assets",
			description: "工作台的素材（生成出来的图/视频文件）：list（按项目列出，可按素材种类过滤）、attach（把一个已存在的文件路径登记成素材）。素材不复制文件，只记录路径；重复登记同一路径会返回已有的那条（created=false）。",
			output: {
				schema: {
					type: "string",
					description: "JSON 文本结果"
				},
				render: (_args, value) => [{
					type: "text",
					text: value
				}]
			},
			parameters: {
				action: {
					type: "string",
					required: true,
					description: "list / attach"
				},
				projectId: {
					type: "string",
					required: true,
					description: "项目 id（先 list workbench_projects）"
				},
				path: {
					type: "string",
					description: "attach 时的文件绝对路径"
				},
				kind: {
					type: "string",
					description: "attach 时的素材种类：image / video（默认按扩展名推断）"
				},
				prompt: {
					type: "string",
					description: "attach 时记录产生它的提示词（可选）"
				},
				limit: {
					type: "integer",
					description: `list 最多返回多少行（默认 50）`
				}
			},
			async execute(args) {
				const input = asRecord(args);
				const action = requireString(input, "action", "workbench_assets");
				const projectId = requireString(input, "projectId", "workbench_assets");
				if (action === "list") {
					const kind = typeof input.kind === "string" && (input.kind === "image" || input.kind === "video") ? input.kind : void 0;
					const rows = (await store.listAssets(projectId)).filter((asset) => kind === void 0 || asset.kind === kind).slice(0, optionalLimit(input));
					return json({
						assets: rows.map((asset) => ({
							id: asset.id,
							kind: asset.kind,
							path: asset.path,
							bytes: asset.bytes,
							createdAt: asset.createdAt
						})),
						count: rows.length
					});
				}
				if (action === "attach") {
					const path = requireString(input, "path", "workbench_assets attach");
					const kind = input.kind === "image" || input.kind === "video" ? input.kind : /\.(png|jpe?g|webp|gif)$/i.test(path) ? "image" : "video";
					const attached = await store.attachAsset({
						projectId,
						path,
						kind,
						...typeof input.prompt === "string" && input.prompt !== "" ? { prompt: input.prompt } : {}
					});
					return json({
						asset: {
							id: attached.asset.id,
							kind: attached.asset.kind,
							path: attached.asset.path
						},
						created: attached.created
					});
				}
				return unknownAction("workbench_assets", action, ["list", "attach"]);
			}
		}),
		defineTool({
			name: "workbench_timeline",
			description: `时间轴（成片）：list、add-clip（加素材/字幕）、trim（改片段起止/时长/源偏移）、drop-clip（把片段移出时间轴）、set-format（导出分辨率/帧率/码率）、set-track（轨道音量/静音）、export（起一次导出，返回 renderId，用 workbench_tasks 轮询进度）。一次最多加 20 个片段。视频轨片段带 startMs/durationMs（毫秒）；没有 startMs 时自动接在末尾。`,
			output: {
				schema: {
					type: "string",
					description: "JSON 文本结果"
				},
				render: (_args, value) => [{
					type: "text",
					text: value
				}]
			},
			parameters: {
				action: {
					type: "string",
					required: true,
					description: "list / add-clip / export"
				},
				projectId: {
					type: "string",
					required: true,
					description: "项目 id"
				},
				timelineId: {
					type: "string",
					description: "add-clip / export 时的时间轴 id（list 里拿）"
				},
				track: {
					type: "string",
					description: "add-clip 时的轨道：video / audio / subtitle（默认 video）"
				},
				clips: {
					type: "array",
					description: `add-clip 时的片段数组（≤20）：每项 {assetPath|text, startMs?, durationMs?}`,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							assetPath: {
								type: "string",
								description: "已登记的素材路径（workbench_assets list 里拿）"
							},
							text: {
								type: "string",
								description: "字幕轨的文本"
							},
							startMs: {
								type: "integer",
								description: "起点（毫秒），省略则接在末尾"
							},
							durationMs: {
								type: "integer",
								description: "时长（毫秒），默认 3000"
							}
						}
					}
				},
				limit: {
					type: "integer",
					description: `list 最多返回多少行（默认 50）`
				}
			},
			async execute(args) {
				const input = asRecord(args);
				const action = requireString(input, "action", "workbench_timeline");
				const projectId = requireString(input, "projectId", "workbench_timeline");
				if (action === "list") {
					const rows = (await store.listTimelines(projectId)).slice(0, optionalLimit(input));
					return json({
						timelines: rows.map((item) => ({
							id: item.id,
							name: item.name,
							frameRate: item.frameRate,
							burnSubtitles: item.burnSubtitles,
							totalMs: item.tracks.reduce((longest, track) => track.clips.reduce((inner, clip) => Math.max(inner, clip.startMs + clip.durationMs), longest), 0),
							tracks: item.tracks.map((track) => ({
								kind: track.kind,
								clips: track.clips.length
							}))
						})),
						count: rows.length
					});
				}
				if (action === "add-clip") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline add-clip");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list 看清楚有哪些`);
					const rawClips = Array.isArray(input.clips) ? input.clips : [];
					if (rawClips.length === 0) throw new Error("add-clip 需要 clips 数组，且至少一个片段");
					if (rawClips.length > 20) throw new Error(`一次最多加 20 个片段，收到 ${rawClips.length} 个`);
					const trackKind = input.track === "audio" || input.track === "subtitle" ? input.track : "video";
					const knownAssets = new Set((await store.listAssets(projectId)).map((asset) => asset.path));
					const tracks = current.tracks.map((track) => ({
						...track,
						clips: [...track.clips]
					}));
					const target = tracks.find((track) => track.kind === trackKind);
					if (target === void 0) throw new Error(`时间轴 ${timelineId} 没有 ${trackKind} 轨`);
					for (const [index, raw] of rawClips.entries()) {
						const clip = asRecord(raw);
						const end = target.clips.reduce((longest, item) => Math.max(longest, item.startMs + item.durationMs), 0);
						const startMs = typeof clip.startMs === "number" && Number.isFinite(clip.startMs) ? Math.round(clip.startMs) : end;
						const durationMs = typeof clip.durationMs === "number" && Number.isFinite(clip.durationMs) ? Math.round(clip.durationMs) : 3e3;
						const id = newWorkbenchId("clip");
						if (trackKind === "subtitle") {
							const text = typeof clip.text === "string" ? clip.text : "";
							if (text.trim() === "") throw new Error(`第 ${index + 1} 个字幕片段缺 text`);
							target.clips.push({
								id,
								text,
								startMs,
								durationMs
							});
							continue;
						}
						const assetPath = typeof clip.assetPath === "string" ? clip.assetPath : "";
						if (assetPath.trim() === "") throw new Error(`第 ${index + 1} 个片段缺 assetPath`);
						if (!knownAssets.has(assetPath)) throw new Error(`素材 ${assetPath} 不在项目 ${projectId} 的素材里；先用 workbench_assets attach 登记它，别猜路径`);
						target.clips.push({
							id,
							assetPath,
							startMs,
							durationMs
						});
					}
					const saved = await store.saveTimeline({
						id: current.id,
						projectId: current.projectId,
						name: current.name,
						tracks,
						frameRate: current.frameRate,
						burnSubtitles: current.burnSubtitles
					});
					return json({ timeline: {
						id: saved.id,
						tracks: saved.tracks.map((track) => ({
							kind: track.kind,
							clips: track.clips.length
						}))
					} });
				}
				if (action === "add-subtitles") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline add-subtitles");
					const script = requireString(input, "text", "workbench_timeline add-subtitles");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const subtitleTrack = current.tracks.find((track) => track.kind === "subtitle");
					const trackStart = subtitleTrack === void 0 || subtitleTrack.clips.length === 0 ? 0 : Math.max(...subtitleTrack.clips.map((clip) => clip.startMs + clip.durationMs));
					const totalMs = Math.max(trackStart + 1e3, timelineDurationMs(current.tracks));
					const windowStart = typeof input.startMs === "number" ? Math.max(0, Math.round(input.startMs)) : trackStart;
					const windowEnd = typeof input.endMs === "number" ? Math.round(input.endMs) : Math.max(windowStart + 1e3, totalMs);
					const clips = planSubtitleClips(script, {
						startMs: windowStart,
						endMs: windowEnd,
						...typeof input.maxChars === "number" ? { maxChars: input.maxChars } : {}
					});
					if (clips.length === 0) throw new Error("这段文本切不出字幕：检查是否有内容");
					if (clips.length > 20) throw new Error(`一次最多生成 20 条字幕，收到 ${clips.length} 条：缩短文本或调大 maxChars`);
					const tracks = current.tracks.map((track) => track.kind === "subtitle" ? {
						...track,
						clips: [...track.clips, ...clips]
					} : track);
					return json({
						timeline: {
							id: (await store.saveTimeline({
								id: current.id,
								projectId: current.projectId,
								name: current.name,
								tracks,
								frameRate: current.frameRate,
								burnSubtitles: current.burnSubtitles,
								exportFormat: current.exportFormat
							})).id,
							added: clips.length,
							window: {
								startMs: windowStart,
								endMs: windowEnd
							}
						},
						subtitles: clips.map((clip) => ({
							id: clip.id,
							text: clip.text,
							startMs: clip.startMs,
							durationMs: clip.durationMs
						}))
					});
				}
				if (action === "trim") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline trim");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const trims = Array.isArray(input.trims) ? input.trims : [];
					if (trims.length === 0) throw new Error("trim 需要 trims 数组，且至少一项");
					if (trims.length > 20) throw new Error(`一次最多改 20 个片段`);
					const byId = new Map(trims.map((raw) => {
						const trim = asRecord(raw);
						return [requireString(trim, "clipId", "workbench_timeline trim"), trim];
					}));
					let touched = 0;
					const tracks = current.tracks.map((track) => ({
						...track,
						clips: track.clips.map((clip) => {
							const trim = byId.get(clip.id);
							if (trim === void 0) return clip;
							touched += 1;
							return {
								...clip,
								...typeof trim.startMs === "number" ? { startMs: Math.max(0, Math.round(trim.startMs)) } : {},
								...typeof trim.durationMs === "number" ? { durationMs: Math.max(1, Math.round(trim.durationMs)) } : {},
								...typeof trim.inMs === "number" ? { inMs: Math.max(0, Math.round(trim.inMs)) } : {}
							};
						})
					}));
					if (touched !== byId.size) throw new Error(`有 ${byId.size - touched} 个 clipId 不存在；先 action=list 确认`);
					const saved = await store.saveTimeline({
						id: current.id,
						projectId: current.projectId,
						name: current.name,
						tracks,
						frameRate: current.frameRate,
						burnSubtitles: current.burnSubtitles,
						exportFormat: current.exportFormat
					});
					return json({ timeline: {
						id: saved.id,
						trimmed: touched,
						tracks: saved.tracks.map((track) => ({
							kind: track.kind,
							clips: track.clips.length
						}))
					} });
				}
				if (action === "drop-clip") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline drop-clip");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const clipIds = (Array.isArray(input.clipIds) ? input.clipIds : []).filter((id) => typeof id === "string");
					if (clipIds.length === 0) throw new Error("drop-clip 需要 clipIds 数组");
					if (clipIds.length > 20) throw new Error(`一次最多移出 20 个片段`);
					const drop = new Set(clipIds);
					let removed = 0;
					const tracks = current.tracks.map((track) => ({
						...track,
						clips: track.clips.filter((clip) => {
							const hit = drop.has(clip.id);
							if (hit) removed += 1;
							return !hit;
						})
					}));
					return json({ timeline: {
						id: (await store.saveTimeline({
							id: current.id,
							projectId: current.projectId,
							name: current.name,
							tracks,
							frameRate: current.frameRate,
							burnSubtitles: current.burnSubtitles,
							exportFormat: current.exportFormat
						})).id,
						dropped: removed
					} });
				}
				if (action === "set-format") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline set-format");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const saved = await store.saveTimeline({
						id: current.id,
						projectId: current.projectId,
						name: current.name,
						tracks: current.tracks,
						frameRate: current.frameRate,
						burnSubtitles: current.burnSubtitles,
						exportFormat: {
							...current.exportFormat ?? {},
							...typeof input.width === "number" ? { width: input.width } : {},
							...typeof input.height === "number" ? { height: input.height } : {},
							...typeof input.frameRate === "number" ? { frameRate: input.frameRate } : {},
							...typeof input.bitrateKbps === "number" ? { bitrateKbps: input.bitrateKbps } : {}
						}
					});
					return json({ timeline: {
						id: saved.id,
						exportFormat: saved.exportFormat
					} });
				}
				if (action === "set-track") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline set-track");
					const current = await store.findTimeline(timelineId);
					if (current === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const kind = input.track === "video" || input.track === "subtitle" ? input.track : "audio";
					const tracks = current.tracks.map((track) => track.kind !== kind ? track : {
						...track,
						...typeof input.volume === "number" ? { volume: input.volume } : {},
						...typeof input.muted === "boolean" ? { muted: input.muted } : {}
					});
					const saved = await store.saveTimeline({
						id: current.id,
						projectId: current.projectId,
						name: current.name,
						tracks,
						frameRate: current.frameRate,
						burnSubtitles: current.burnSubtitles,
						exportFormat: current.exportFormat
					});
					return json({ timeline: {
						id: saved.id,
						tracks: saved.tracks.map((track) => ({
							kind: track.kind,
							volume: track.volume ?? null,
							muted: track.muted ?? false
						}))
					} });
				}
				if (action === "export") {
					const timelineId = requireString(input, "timelineId", "workbench_timeline export");
					const doc = await store.findTimeline(timelineId);
					if (doc === void 0) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`);
					const job = renders.start(doc);
					return json({ render: {
						id: job.id,
						status: job.status,
						hint: "用 workbench_tasks action=renders 轮询进度；status=succeeded 时 outputPath 是产物"
					} });
				}
				return unknownAction("workbench_timeline", action, [
					"list",
					"add-clip",
					"add-subtitles",
					"trim",
					"drop-clip",
					"set-format",
					"set-track",
					"export"
				]);
			}
		}),
		defineTool({
			name: "workbench_workflow",
			description: "专业工作流（画布图）：list（列项目的流程）、save（创建/覆盖一张图；节点 kind 必须来自节点目录）、run（跑起来，返回 runId；默认**复用同参数上次的成功产物**，refresh=true 才强制重新生成）、runs（查运行记录与每个节点的状态/产物）。跑之前宿主会用与画布同一份校验拒绝非法图（必填/端口/环），所以先 save 再 run。",
			output: {
				schema: {
					type: "string",
					description: "JSON 文本结果"
				},
				render: (_args, value) => [{
					type: "text",
					text: value
				}]
			},
			parameters: {
				action: {
					type: "string",
					required: true,
					description: "list / save / run / runs"
				},
				projectId: {
					type: "string",
					required: true,
					description: "项目 id"
				},
				workflowId: {
					type: "string",
					description: "save 覆盖时 / run 时的流程 id"
				},
				name: {
					type: "string",
					description: "save 时的流程名"
				},
				nodes: {
					type: "array",
					description: "save 时的节点数组：{id, kind, params?, position?}",
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							id: {
								type: "string",
								description: "节点 id（图内唯一）"
							},
							kind: {
								type: "string",
								description: "节点种类，如 image-generate / video-generate / script"
							},
							params: {
								type: "object",
								description: "节点参数（按种类）",
								additionalProperties: true
							},
							position: {
								type: "object",
								description: "画布坐标 {x,y}",
								additionalProperties: true
							}
						}
					}
				},
				edges: {
					type: "array",
					description: "save 时的连线数组：{id?, source, target}",
					items: {
						type: "object",
						description: "连线",
						additionalProperties: true
					}
				},
				limit: {
					type: "integer",
					description: `list / runs 最多返回多少行（默认 50）`
				},
				refresh: {
					type: "boolean",
					description: "run 时是否跳过成功结果缓存、强制重新生成（默认复用缓存，省钱）"
				}
			},
			async execute(args) {
				const input = asRecord(args);
				const action = requireString(input, "action", "workbench_workflow");
				const projectId = requireString(input, "projectId", "workbench_workflow");
				if (action === "list") {
					const rows = (await store.listWorkflows(projectId)).slice(0, optionalLimit(input));
					return json({
						workflows: rows.map((item) => ({
							id: item.id,
							name: item.name,
							nodes: item.nodes.length,
							edges: item.edges.length,
							updatedAt: item.updatedAt
						})),
						count: rows.length
					});
				}
				if (action === "templates") return json({
					templates: DRAMA_TEMPLATES.map((template) => ({
						id: template.id,
						labelKey: template.labelKey,
						describe: template.describe,
						nodes: template.nodes.map((node) => node.kind),
						edges: template.edges.length
					})),
					hint: "用 action=from-template 并传 templateId 即可在工作流里实例化"
				});
				if (action === "from-template") {
					const projectId = requireString(input, "projectId", "workbench_workflow from-template");
					const templateId = requireString(input, "templateId", "workbench_workflow from-template");
					const template = DRAMA_TEMPLATES.find((candidate) => candidate.id === templateId);
					if (template === void 0) throw new Error(`没有模板 ${templateId}；先用 action=templates 看可用模板`);
					const record = instantiateTemplate(template, projectId, () => newWorkbenchId("wfl"));
					const saved = await store.saveWorkflow(record);
					return json({ workflow: {
						id: saved.id,
						name: saved.name,
						nodes: saved.nodes.length,
						edges: saved.edges.length
					} });
				}
				if (action === "save") {
					const nodes = (Array.isArray(input.nodes) ? input.nodes : []).map((raw, index) => {
						const node = asRecord(raw);
						const position = asRecord(node.position);
						const finite = typeof position.x === "number" && Number.isFinite(position.x) && typeof position.y === "number" && Number.isFinite(position.y);
						return {
							...node,
							position: finite ? {
								x: position.x,
								y: position.y
							} : {
								x: 40 + index % 3 * 240,
								y: 40 + Math.floor(index / 3) * 140
							}
						};
					});
					const saved = await store.saveWorkflow({
						...typeof input.workflowId === "string" && input.workflowId !== "" ? { id: input.workflowId } : {},
						projectId,
						name: typeof input.name === "string" && input.name !== "" ? input.name : "对话创建的流程",
						nodes,
						edges: Array.isArray(input.edges) ? input.edges : []
					});
					return json({ workflow: {
						id: saved.id,
						name: saved.name,
						nodes: saved.nodes.length,
						edges: saved.edges.length
					} });
				}
				if (action === "run") {
					const workflowId = requireString(input, "workflowId", "workbench_workflow run");
					const doc = await store.findWorkflow(workflowId);
					if (doc === void 0) throw new Error(`找不到流程 ${workflowId}；先用 action=list`);
					const run = await runner.begin(doc, input.refresh === true ? { bypassCache: true } : {});
					return json({ run: {
						id: run.id,
						status: run.status,
						...run.error === void 0 ? {} : { error: run.error }
					} });
				}
				if (action === "runs") {
					const rows = (await store.listRuns(projectId, typeof input.workflowId === "string" && input.workflowId !== "" ? input.workflowId : void 0)).slice(0, optionalLimit(input));
					return json({
						runs: rows.map((run) => ({
							id: run.id,
							workflowId: run.workflowId,
							status: run.status,
							startedAt: run.startedAt,
							nodes: run.nodeRuns.map((node) => ({
								id: node.nodeId,
								status: node.status,
								...node.outputPath === void 0 ? {} : { outputPath: node.outputPath },
								...node.attempts === void 0 ? {} : { attempts: node.attempts }
							}))
						})),
						count: rows.length
					});
				}
				return unknownAction("workbench_workflow", action, [
					"list",
					"save",
					"run",
					"runs"
				]);
			}
		}),
		defineTool({
			name: "workbench_tasks",
			description: "任务与运行记录：list（生成任务账本：模型/提示词/状态/产物/耗时）、renders（导出任务与进度）、cancel（按 id 取消生成任务或导出）。取消是不可逆动作，只有在用户明确要求时才调用。",
			output: {
				schema: {
					type: "string",
					description: "JSON 文本结果"
				},
				render: (_args, value) => [{
					type: "text",
					text: value
				}]
			},
			parameters: {
				action: {
					type: "string",
					required: true,
					description: "list / renders / cancel"
				},
				projectId: {
					type: "string",
					description: "list 时按项目过滤（可选）"
				},
				taskId: {
					type: "string",
					description: "cancel 时的生成任务 id"
				},
				renderId: {
					type: "string",
					description: "cancel 时的导出任务 id"
				},
				limit: {
					type: "integer",
					description: `list / renders 最多返回多少行（默认 50）`
				}
			},
			async execute(args) {
				const input = asRecord(args);
				const action = requireString(input, "action", "workbench_tasks");
				if (action === "list") {
					const projectId = typeof input.projectId === "string" && input.projectId !== "" ? input.projectId : void 0;
					const rows = await store.listTasks(optionalLimit(input), projectId);
					return json({
						tasks: rows.map((task) => ({
							id: task.id,
							kind: task.kind,
							status: task.status,
							model: task.model,
							provider: task.provider,
							...task.outputPath === void 0 ? {} : { outputPath: task.outputPath },
							createdAt: task.createdAt
						})),
						count: rows.length
					});
				}
				if (action === "renders") {
					const projectId = typeof input.projectId === "string" && input.projectId !== "" ? input.projectId : void 0;
					const rows = renders.list(projectId).slice(0, optionalLimit(input));
					return json({
						renders: rows.map((job) => ({
							id: job.id,
							timelineId: job.timelineId,
							status: job.status,
							percent: job.percent,
							...job.outputPath === void 0 ? {} : { outputPath: job.outputPath }
						})),
						count: rows.length
					});
				}
				if (action === "render-cancel") {
					const renderId = requireString(input, "renderId", "workbench_tasks render-cancel");
					const cancelled = renders.cancel(renderId);
					return json({
						cancelled,
						status: renders.list().find((candidate) => candidate.id === renderId)?.status ?? null,
						hint: cancelled ? "已请求取消（排队中的会直接摘掉，在跑的会杀掉 ffmpeg 并清理半成品）" : "没有找到在跑的导出任务（可能已结束）"
					});
				}
				if (action === "cancel") {
					const taskId = typeof input.taskId === "string" && input.taskId !== "" ? input.taskId : void 0;
					const renderId = typeof input.renderId === "string" && input.renderId !== "" ? input.renderId : void 0;
					if (taskId === void 0 && renderId === void 0) throw new Error("cancel 需要 taskId 或 renderId");
					const cancelledTask = taskId === void 0 ? false : deps.registry.cancel(taskId);
					const cancelledRender = renderId === void 0 ? false : renders.cancel(renderId);
					return json({
						cancelledTask,
						cancelledRender,
						hint: cancelledTask || cancelledRender ? void 0 : "没有找到在跑的任务（可能已经结束）"
					});
				}
				return unknownAction("workbench_tasks", action, [
					"list",
					"renders",
					"cancel",
					"render-cancel"
				]);
			}
		})
	];
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
	const diagnostics = new DiagnosticsCollector();
	const workbenchStore = new WorkbenchStore({ directory: resolveWorkbenchDirectory(outputsDir) });
	const generationRegistry = new GenerationRegistry();
	workbenchStore.failStaleRunning("宿主重启中断（无法继续等待该任务）").catch(() => {});
	workbenchStore.failStaleRuns("宿主重启中断（无法继续执行这次运行）").catch(() => {});
	const keyState = (provider) => hasConfiguredCredentials(config, provider) ? "已配置" : "未配置";
	ctx.logger.info(`dsh-image-video 生效配置：provider=${config.provider} defaultVideoProvider=${config.defaultVideoProvider || "(跟随激活服务商)"} defaultImageProvider=${config.defaultImageProvider || "(跟随激活服务商)"} defaultVideoModel=${config.defaultVideoModel || "(服务商内置默认)"} defaultImageModel=${config.defaultImageModel || "(服务商内置默认)"} defaultImageSize=${config.defaultImageSize} imageTransport=${config.imageTransport} imageUnknownStatePolicy=${config.imageUnknownStatePolicy} watermark=${config.watermark.enabled ? `${config.watermark.text}@${config.watermark.position}` : "关闭"} outputsDir=${outputsDir} keys{threerouter=${keyState("threerouter")}, wanx=${keyState("wanx")}, minimax=${keyState("minimax")}, seedance=${keyState("seedance")}}`);
	const taskManager = new TaskManager(ctx, config);
	const resolveApiKey = async (ref) => {
		const validated = credentialRef(ref);
		const credentials = ctx.get("credentials");
		if (credentials === void 0) return void 0;
		return (await credentials.resolve(validated))?.value;
	};
	const runtimeDefaults = createRuntimeDefaultsStore();
	const logEntry = (entry) => {
		ctx.logger?.info?.(`image-video ${JSON.stringify(entry)}`);
	};
	const persistedDefaults = extractPersistedDefaults(config);
	const generationTools = {};
	const proxyTool = (slot) => ({ async execute(args, exec) {
		const tool = generationTools[slot];
		if (tool === void 0) throw new Error(`generate_${slot} is unavailable in this host`);
		return tool.execute(args, exec);
	} });
	ctx.inject(["attachments"], (imageCtx) => {
		const attachments = imageCtx.get("attachments");
		if (!attachments) return;
		const imageTool = withTaskLedger(createGenerateImageTool({
			config,
			taskManager,
			attachments,
			ctx,
			runtimeDefaults,
			outputsDir,
			resolveApiKey
		}), {
			store: workbenchStore,
			registry: generationRegistry,
			kind: "image",
			log: logEntry
		});
		imageCtx.tools.register(imageTool);
		generationTools.image = imageTool;
	});
	const videoTool = withTaskLedger(createGenerateVideoTool({
		config,
		taskManager,
		runtimeDefaults,
		outputsDir,
		resolveApiKey
	}), {
		store: workbenchStore,
		registry: generationRegistry,
		kind: "video",
		log: logEntry
	});
	ctx.tools.register(videoTool);
	generationTools.video = videoTool;
	ctx.inject(["webServer"], (mediaCtx) => {
		const webServer = mediaCtx.get("webServer");
		if (!webServer) return;
		const disposeRoute = registerOutputsRoute(webServer, outputsDir);
		if (disposeRoute) mediaCtx.effect(() => disposeRoute, "dsh-image-video: outputs media route");
		const disposeDefaults = registerDefaultsRoute(webServer, runtimeDefaults, persistedDefaults);
		if (disposeDefaults) mediaCtx.effect(() => disposeDefaults, "dsh-image-video: runtime defaults route");
		const disposeStatus = registerWorkbenchStatusRoute(webServer, {
			provider: config.provider,
			outputsDir
		});
		if (disposeStatus) mediaCtx.effect(() => disposeStatus, "dsh-image-video: workbench status route");
	});
	ctx.inject(["agents"], (agentCtx) => {
		registerMediaModeInjection(agentCtx, {
			store: runtimeDefaults,
			persisted: persistedDefaults
		});
	});
	ctx.inject(["connection", "webServer"], (rpcCtx) => {
		const renderRegistry = new RenderRegistry({
			render: new RenderService({ outputsDir }),
			registerAsset: async (job) => {
				if (job.outputPath === void 0) return;
				await workbenchStore.attachAsset({
					projectId: job.projectId,
					path: job.outputPath,
					kind: "video",
					bytes: job.bytes,
					provider: config.provider,
					prompt: `时间轴导出（${job.timelineId}）`
				});
			},
			onError: (message) => {
				ctx.logger?.warn?.(`image-video workbench: ${message}`);
				diagnostics.recordError("runner", message);
			}
		});
		renderRegistry.failStale("宿主重启中断（无法继续这次导出）");
		const workflowRunner = new WorkflowRunner({
			store: workbenchStore,
			generateImage: proxyTool("image"),
			generateVideo: proxyTool("video"),
			log: logEntry,
			onError: (message) => {
				ctx.logger?.warn?.(`image-video workbench: ${message}`);
			}
		});
		registerWorkbenchRpc(rpcCtx, {
			diagnostics,
			provider: config.provider,
			outputsDir,
			store: workbenchStore,
			registry: generationRegistry,
			runner: workflowRunner,
			renders: renderRegistry,
			defaults: () => resolveDefaultsView(runtimeDefaults, persistedDefaults),
			options: workbenchOptions
		});
		for (const tool of createWorkbenchTools({
			store: workbenchStore,
			renders: renderRegistry,
			runner: workflowRunner,
			registry: generationRegistry
		})) ctx.tools.register(tool);
	});
}
//#endregion
export { AsyncTransportUnavailableError, Config, DEFAULTS_ROUTE_PATH, DEFAULT_RECOVERY_BUDGET, GenerationError, IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, TRANSPORT_PROBE_TTL_MS, TaskManager, apply, applyImageStyle, applyImageWatermark, buildWatermarkSvg, canFallbackToNextProvider, consumeSubmitBudget, createDefaultsRouteHandler, createGenerateImageTool, createGenerateVideoTool, createImageTransaction, createRuntimeDefaultsStore, extractPersistedDefaults, fitFontSize, formatPreflightNote, inject, isAsyncImageUnavailableError, isModelNotAcceptedError, isUnknownSubmitStateError, looksLikeVideoModel, name, parseDefaultsPatch, registerDefaultsRoute, registerMediaModeInjection, renderMediaModeInstruction, reportTransaction, resolveDefaultsView, resolveImagePreflight, resolveImageTransport, runImageTransaction, seedanceAdapter, submitBudget, threerouterAdapter, unknownStateError, wanxAdapter };
