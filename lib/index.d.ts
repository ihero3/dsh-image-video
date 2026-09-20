import z from "@deepseek-ai/schemastery";
import { Context, Service } from "@deepseek-ai/cordis";
import { IncomingMessage, ServerResponse } from "node:http";

//#region src/config.d.ts
/** 支持的生成服务商。minimax 为 MiniMax 官方平台直连（仅视频），threerouter 为聚合器（所有模型）。 */
type Provider = 'threerouter' | 'wanx' | 'minimax' | 'seedance';
/** 单个服务商的凭证与自定义接口地址。 */
interface ProviderCredentials {
  /** 服务商 API Key；切换 provider 后对应 key 立即生效。 */
  apiKey: string;
  /** 自定义接口地址，留空使用服务商默认端点。 */
  baseURL?: string;
}
/** 水印位置（四角之一）。 */
type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
/**
 * 品牌水印后处理配置。所有尺寸类参数都是**相对图片宽/高的比例**，
 * 保证同一套配置对不同尺寸出图观感一致。
 */
interface WatermarkConfig {
  /** 是否对最终图片合成品牌水印（关闭时图片流程完全不受影响）。 */
  enabled: boolean;
  /** 水印文字。 */
  text: string;
  /** 主文字不透明度（0-1）。 */
  opacity: number;
  /** 水印位置：四角之一。 */
  position: WatermarkPosition;
  /** 字号占图片宽度的比例。 */
  fontSizeRatio: number;
  /** 水平留白占图片宽度的比例。 */
  marginXRatio: number;
  /** 垂直留白占图片高度的比例。 */
  marginYRatio: number;
  /** 是否给水印加柔光（浅色底图上也看得见）。 */
  glowEnabled: boolean;
  /** 柔光颜色。 */
  glowColor: string;
  /** 柔光半径占字号的比例。 */
  glowBlurRatio: number;
}
interface Config {
  /** 当前激活的服务商，切换后立即生效（HMR）。 */
  provider: Provider;
  /** Threerouter 凭证；provider=threerouter 时使用（支持图片+视频）。 */
  threerouter: ProviderCredentials;
  /** 万象（wanx）凭证；provider=wanx 时使用。 */
  wanx: ProviderCredentials;
  /** MiniMax 官方平台凭证；provider=minimax 时使用（图片与视频）。 */
  minimax: ProviderCredentials;
  /** Seedance2.5 凭证；provider=seedance 时使用。 */
  seedance: ProviderCredentials;
  /** 默认图片服务商；留空跟随激活服务商。 */
  defaultImageProvider: '' | Provider;
  /** 默认视频服务商；留空跟随激活服务商，adapter 使用其内置默认模型。 */
  defaultVideoProvider: '' | Provider;
  /** 默认图片模型；留空使用 adapter 内置默认模型。 */
  defaultImageModel: string;
  /** 默认视频模型；留空使用 adapter 内置默认模型。 */
  defaultVideoModel: string;
  /** 默认图片尺寸，形如 "1024*1024"。 */
  defaultImageSize: string;
  /** 默认视频时长（秒），上限 30；具体模型能力由上游校验。 */
  defaultVideoDuration: number;
  /**
   * 图片提交传输方式：
   * - `auto`：优先异步网关（幂等 + 超时找回），服务商不支持或探测到不可用时降级同步；
   * - `async`：强制异步，端点不可用即响亮失败（上线验收口径）；
   * - `sync`：强制同步单次提交（无幂等，仅保证「不自动重提」）。
   */
  imageTransport: 'auto' | 'async' | 'sync';
  /**
   * 提交结果未知（超时/断连/5xx 且按幂等键反查无果）后的策略：
   * - `fail`：不自动重提，响亮失败并回报 request_id（默认，最保守）；
   * - `resubmit-same-key`：用同一个幂等键再提交一次（服务端按键去重，不会重复生成）。
   */
  imageUnknownStatePolicy: 'fail' | 'resubmit-same-key';
  /** 单次 HTTP 请求超时（毫秒）。 */
  timeoutMs: number;
  /** 视频任务轮询间隔（毫秒）。 */
  pollIntervalMs: number;
  /** 视频任务整体超时（毫秒），超时后中止轮询。 */
  pollTimeoutMs: number;
  /** 可重试错误的最大重试次数（仅作用于幂等的读取类请求；生图提交永远不重试）。 */
  retryTimes: number;
  /** 生成媒体落地目录，相对路径基于进程 cwd 解析；插件启动时解析为绝对路径并打日志。 */
  outputsDir: string;
  /** 图片最终结果的品牌水印后处理。 */
  watermark: WatermarkConfig;
}
/** 插件配置 schema，默认服务商为 threerouter（图片+视频统一入口），wanx/seedance 可选。 */
declare const Config: z<Config>;
//#endregion
//#region src/watermark.d.ts
/** 水印处理结果。 */
interface WatermarkResult {
  /** 最终图片字节（失败时为原始字节）。 */
  data: Uint8Array;
  /** 最终图片 MIME 类型。 */
  contentType: string;
  /** 是否真的合成了水印（enabled=false / 文本为空 / 出错时为 false）。 */
  applied: boolean;
  /** 未合成时的原因说明（供结果层透明告知）；正常合成时缺省。 */
  note?: string;
}
/**
 * 给图片加品牌水印。
 * @param data - 模型返回的原始图片字节。
 * @param contentType - 原始 MIME 类型（决定输出编码，保持与上游一致的格式）。
 * @param config - 水印配置（enabled=false 时直接原样返回）。
 * @returns 处理结果（含 applied / note，供结果层如实告知）。
 */
declare function applyImageWatermark(data: Uint8Array, contentType: string, config: WatermarkConfig): Promise<WatermarkResult>;
/**
 * 构造水印 SVG。导出供单测直接断言坐标/字号等几何决策，无需真的解码图片。
 * @param width - 图片宽度（像素）。
 * @param height - 图片高度（像素）。
 * @param text - 水印文字（已 trim，非空）。
 * @param config - 水印配置。
 */
declare function buildWatermarkSvg(width: number, height: number, text: string, config: WatermarkConfig): string;
/**
 * 计算字号：基准为 `宽度 × fontSizeRatio`，并保证估算文字宽度不超过
 * 可用宽度（图片宽度减两侧留白）的 95%，避免窄图上水印横向溢出。
 * @param text - 水印文字。
 * @param width - 图片宽度。
 * @param marginX - 单侧水平留白。
 * @param fontSizeRatio - 字号占图片宽度的比例。
 * @returns 最终字号（像素，至少 10px）。
 */
declare function fitFontSize(text: string, width: number, marginX: number, fontSizeRatio: number): number;
//#endregion
//#region src/http-client.d.ts
/**
 * 统一 HTTP 请求客户端：封装 fetch，分类异常，可配置重试。
 * 鉴权失败、配额耗尽等不可重试错误立即抛出；超时、网络抖动按配置重试。
 * @module dsh-image-video/http-client
 */
/** 异常种类，区分可重试与不可重试。 */
type ErrorKind = 'auth' | 'quota' | 'task' | 'timeout' | 'network';
/** 所有生成相关错误的基类，携带友好中文提示与分类标记。 */
declare class GenerationError extends Error {
  readonly kind: ErrorKind;
  /** 是否值得重试：仅超时与网络抖动重试，鉴权/配额/任务逻辑错误立即失败。 */
  readonly retryable: boolean;
  /** 原始 HTTP 状态码，任务级错误可能为 undefined。 */
  readonly status?: number;
  /** 服务端 Retry-After 建议的等待时间（毫秒）。 */
  readonly retryAfterMs?: number;
  /**
   * 服务端返回的机器可读错误码（形如 `{"error":{"code":"IDEMPOTENCY_IN_PROGRESS"}}`）。
   * 生图事务靠它区分「提交未落地（可回退候选）」与「提交状态未知（绝不重提）」，
   * 因此必须比 message 文本更可靠地保留下来。
   */
  readonly code?: string;
  constructor(kind: ErrorKind, message: string, retryable: boolean, status?: number, retryAfterMs?: number, code?: string);
}
/**
 * 判定错误是否为「异步图片端点在本环境不可用」：功能未开启（未配对象存储）或
 * 该分组平台不支持 Images API。两者都在创建任务前返回 404，因此降级到同步
 * 单次提交不会产生重复生成。
 */
declare function isAsyncImageUnavailableError(err: unknown): boolean;
/**
 * 判定错误是否为「提交状态未知」——客户端无法确认请求是否已在服务端创建任务。
 * 超时、连接中断、502/503 都属于此类：**绝不允许自动重提或换模型**，只能凭
 * request_id 反查（见 image-transaction.ts）。
 */
declare function isUnknownSubmitStateError(err: unknown): boolean;
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
declare function isModelNotAcceptedError(err: unknown): boolean;
/** 请求选项。 */
interface RequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  /** JSON 请求体；GET 请求忽略。 */
  body?: unknown;
  /** 单次请求超时（毫秒）。 */
  timeoutMs: number;
  /** 最大重试次数（仅对可重试错误生效）。 */
  retryTimes: number;
  /** 取消信号，由调用方（任务管理器）传入。 */
  signal?: AbortSignal;
}
/** 请求结果。 */
interface RequestResult {
  ok: true;
  status: number;
  data: unknown;
  headers: Headers;
}
//#endregion
//#region src/providers/types.d.ts
/** 图片生成请求参数（不传 image 为文生图，传入 image 为图生图/参考图编辑）。 */
interface ImageGenParams {
  /** 客户端生成事务唯一 ID；服务端必须按此字段幂等。 */
  requestId?: string;
  /** 提示词。 */
  prompt: string;
  /** 图片尺寸，如 "1024x1024"（分隔符可能为 `*`，适配器经 normalizeImageSize 归一化）。 */
  size: string;
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string;
  /**
   * 可选参考图，存在时走图生图：http(s) URL、data URL（本地路径已由调用方经
   * media.resolveImageReference 统一解析），适配器只负责放到各自协议字段。
   * 各家语义不同：threerouter /images/edits 按提示词编辑、方舟 Seedream 参考编辑、
   * MiniMax 主体一致性（保留主体换场景）。
   */
  image?: string;
  /**
   * 多参考图（按调用方顺序）：首图通常是底图，其余图片是编辑/身份参考。
   * threerouter 适配器会以 `image_urls` 发给服务端；不支持多图的直连适配器
   * 至少使用第一张图，保持旧版单图协议兼容。
   */
  images?: string[];
}
/** 视频生成请求参数（文生视频，带 image 时为首帧驱动的图生视频）。 */
interface VideoGenParams {
  /** 提示词。 */
  prompt: string;
  /** 视频时长（秒），上限 10。 */
  duration: number;
  /** 可选宽高比，如 "16:9"。存在 image 时构图由首帧图片决定，适配器不传该字段。 */
  aspectRatio?: string;
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string;
  /**
   * 可选首帧图片，存在时走图生视频：http(s) URL、data URL 或本地文件路径。
   * 调用方经 media.resolveImageReference 统一解析后才传入，适配器只负责放到各自字段。
   */
  image?: string;
  /**
   * wan3.0-video 多关键帧：按时间点排列的参考图序列（如 position '0s' / '1s'…）。
   * 调用方经 media.resolveVideoMedia 统一解析（压缩 + 转 data URL），
  * 适配器按文档转换为 type/url；存在时 image 字段忽略。
   */
  media?: Array<{
    url: string;
    type?: string;
    position?: string;
  }>;
  /** 可选分辨率档位，取值由服务商与模型决定（如 MiniMax-H3 支持 480P/768P/2K）；留空用服务商默认。 */
  resolution?: string;
}
/** 任务提交结果。 */
interface SubmitResult {
  /** 任务 ID；同步接口返回空字符串。 */
  taskId: string;
  /** true 表示需要轮询查询，false 表示同步已返回结果。 */
  async: boolean;
  /** 同步接口直接返回的媒体 URL；async=false 时有值。 */
  mediaUrl?: string;
  /** 媒体类型，用于区分图片/视频渲染。 */
  mediaType: 'image' | 'video';
  /** true 表示请求携带的 duration 因模型不支持自定义时长被丢弃（结果层据此在 notes 注明）。 */
  droppedDuration?: boolean;
  /**
   * 实际发给上游的模型名（含适配器内置默认的兜底结果）。结果层据此向用户
   * 透明报告「这次到底用了哪个模型」，无需再靠配置推断。
   */
  model?: string;
  /**
   * 同步接口直接返回的 base64 图片字节（MiniMax image_generation 等）。
   * 有值时结果层直接落盘，跳过 downloadAndSave 下载步骤。
   */
  mediaBase64?: {
    data: string;
    mediaType: string;
  };
}
/** 任务查询结果。 */
type TaskQueryResult = {
  status: 'pending' | 'running';
} | {
  status: 'succeeded';
  mediaUrl: string;
} | {
  status: 'failed';
  error: string;
};
/**
 * 异步图片提交结果（202 Accepted 形态）。
 * 与 {@link SubmitResult} 的区别：这里只有「任务已被接受」这一个事实，
 * 结果图 URL 必须经轮询端点取得，因此不存在同步返回的 mediaUrl。
 */
interface AsyncImageSubmit {
  /** 网关任务 ID（`imgtask_…`），轮询与找回的唯一句柄。 */
  taskId: string;
  /** 本次提交实际使用的模型名（服务商回报或本地推断）。 */
  model?: string;
  /** 服务端回显的幂等键。 */
  requestId?: string;
  /** true = 服务端幂等回放（`X-Idempotency-Replayed: true`），本次没有新建任务。 */
  replayed?: boolean;
  /** 服务端建议的轮询间隔（`Retry-After` 秒）；缺省用配置的轮询间隔。 */
  retryAfterSec?: number;
}
/**
 * 异步图片网关能力（可选）：提交立即返回任务句柄、结果经轮询取得，
 * 并支持「凭幂等键找回任务」——这是提交响应因超时/断连丢失后不重复
 * 生成的唯一自救通道。只有实现该能力的服务商才允许配置 async 传输。
 */
interface ImageAsyncCapability {
  /** 提交一次图片生成任务，返回任务句柄（服务端保证同一幂等键只创建一次）。 */
  submit(params: ImageGenParams, opts: HttpOpts): Promise<AsyncImageSubmit>;
  /** 查询任务状态；图片任务与视频任务的查询端点可能不同。 */
  query(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>;
  /** 凭幂等键找回原任务；未找到返回 undefined（不抛错，由上层按策略决定）。 */
  findByRequest(requestId: string, opts: HttpOpts): Promise<{
    taskId: string;
  } | undefined>;
}
/** HTTP 请求选项子集，由工具层从 Config 解析后传入。 */
interface HttpOpts {
  apiKey: string;
  baseURL: string;
  timeoutMs: number;
  retryTimes: number;
  signal?: AbortSignal;
}
/** 服务商适配器接口。 */
interface ProviderAdapter {
  /** 提交文生图任务（同步语义：返回体即结果，或返回可轮询的异步任务句柄）。 */
  submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult>;
  /** 提交文生视频任务（始终异步）。 */
  submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult>;
  /** 查询异步任务状态。 */
  queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>;
  /**
   * 异步图片网关能力（可选能力声明）。实现它的服务商才能接受 `imageTransport: async`：
   * 提交即返回任务句柄、结果经 `query` 轮询、响应丢失时经 `findByRequest` 找回。
   * 未实现时工具层按同步单次提交处理（仍然只提交一次、超时不重提）。
   */
  imageAsync?: ImageAsyncCapability;
}
//#endregion
//#region src/task-manager.d.ts
/** 轮询完成结果。 */
interface PollResult {
  /** 媒体下载 URL。 */
  mediaUrl: string;
  /** 任务耗时（毫秒）。 */
  elapsedMs: number;
}
/**
 * 查询函数签名：可由适配器（视频/自带异步任务的服务商）或专门的图片任务查询
 * 实现（网关 `/images/tasks/{id}`）提供。
 */
type TaskQueryFn = (taskId: string, opts: HttpOpts) => Promise<TaskQueryResult>;
/**
 * 任务管理器：管理所有进行中的生成任务轮询。
 * 在 apply() 中实例化，通过 ctx.effect 注册卸载清理。
 */
declare class TaskManager {
  /** 进行中的任务，key 为 taskId。 */
  private readonly active;
  /** 配置引用。 */
  private readonly config;
  constructor(ctx: Context, config: Config);
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
  pollUntilDone(taskId: string, query: ProviderAdapter | TaskQueryFn, httpOpts: HttpOpts, externalSignal?: AbortSignal): Promise<PollResult>;
  /** 获取当前进行中的任务数，供状态展示。 */
  get activeCount(): number;
  /**
   * 判定查询阶段的错误是否属于「瞬时故障、值得继续轮询」。
   * 可重试分类（网络/超时/5xx/限流）与不可重试的鉴权/参数错误区分开：
   * 后者继续轮询只会白等，立即抛出。
   */
  private isTransientQueryError;
  /** 可被取消的延时；信号触发时立即 reject。 */
  private sleep;
}
//#endregion
//#region src/image-transaction.d.ts
/** 图片提交传输方式：async = 网关异步任务（有幂等与找回），sync = 同步端点（无幂等）。 */
type ImageTransport = 'async' | 'sync';
/**
 * 提交状态未知（超时/断连/5xx 且找回无果）后的策略。
 * - `fail`（默认）：不自动重提，响亮失败并给出 requestId，由用户决定是否重试。
 * - `resubmit-same-key`：用**同一个幂等键**再提交一次。服务端保证同一键只创建
 *   一个任务（回放原响应或返回 409 进行中），因此不会重复生成；仅 async 传输可用。
 */
type UnknownStatePolicy = 'fail' | 'resubmit-same-key';
/** 事务状态机取值。 */
type TransactionStatus = /** 已创建，尚未提交。 */'idle' /** 提交请求已发出。 */ | 'submitting' /** 服务端已接受任务（有 taskId）。 */ | 'accepted' /** 提交结果未知：可能已创建任务，也可能没有——只能反查，不能重提。 */ | 'unknown' /** 成功拿到结果。 */ | 'succeeded' /** 明确失败：服务端在创建任务之前拒绝，或任务本身执行失败。 */ | 'failed';
/**
 * 事务账本：一次 `generate_image` 调用对应一个实例，记录提交/找回/结果的
 * 全部事实，作为结果元数据回给用户（「本次到底提交了几次」必须可核对）。
 */
interface ImageTransaction {
  /** 幂等键（服务端按 `Idempotency-Key` 去重，找回也用它）。 */
  readonly requestId: string;
  /** 实际路由到的服务商。 */
  readonly provider: Provider;
  /** 用户配置/工具参数指定的模型（适配器默认值不在其中）。 */
  readonly model: string | undefined;
  /** 传输方式；async 不可用降级时会改为 sync。 */
  transport: ImageTransport;
  status: TransactionStatus;
  /** 物理提交次数（计费风险计数）：正常恒为 1，仅同键重提时为 2。 */
  submitAttempts: number;
  /** 凭 requestId 反查原任务的次数（只读查询，不计费）。 */
  recoveryLookups: number;
  /** 服务端任务 ID（提交被接受后可得）。 */
  taskId?: string;
  /** 提交开始/结束时间戳（毫秒）。 */
  submitStartedAt?: number;
  submitFinishedAt?: number;
  /** 服务端幂等回放标记：为 true 时本次没有新建任务。 */
  replayed?: boolean;
  /** 是否发生过降级（async → sync）或同键重提，供结果层透明告知。 */
  degraded?: boolean;
}
/** 创建事务账本。 */
declare function createImageTransaction(input: {
  requestId: string;
  provider: Provider;
  model: string | undefined;
  transport: ImageTransport;
}): ImageTransaction;
/** 提交预算上限：默认 1；同键重提策略下允许 2（第二次必须复用同一个幂等键）。 */
declare function submitBudget(options?: {
  allowSameKeyRetry?: boolean;
}): number;
/**
 * 消费一次提交预算。达到上限后再次调用一律抛错——这是「一次请求只生成一张」
 * 的硬闸门：任何异常路径都不可能在同一个事务里再发一次新的计费请求。
 * @throws {GenerationError} 当本事务已用尽提交预算。
 */
declare function consumeSubmitBudget(tx: ImageTransaction, options?: {
  allowSameKeyRetry?: boolean;
}): void;
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
declare function canFallbackToNextProvider(err: unknown, tx: ImageTransaction): boolean;
/** 结果元数据里的事务摘要（写进工具输出，让用户能核对「提交了几次」）。 */
interface TransactionReport {
  requestId: string;
  transport: ImageTransport;
  submitAttempts: number;
  recoveryLookups: number;
  status: TransactionStatus;
  taskId?: string;
  replayed?: boolean;
  degraded?: boolean;
}
/** 导出事务摘要（缺省字段不出现在结果里，避免噪音）。 */
declare function reportTransaction(tx: ImageTransaction): TransactionReport;
/**
 * 构造「提交状态未知」错误。文案必须做到三件事：说清事实（可能已在计费）、
 * 说清客户端已经做了什么（按幂等键查过了、没查到）、给可执行的下一步
 * （凭 requestId 找回，或用户明确要求后重试）。
 */
declare function unknownStateError(tx: ImageTransaction, cause: unknown): GenerationError;
/** 找回查询预算（次数与间隔）。 */
interface RecoveryBudget {
  /** 最多查询次数（含首次）。 */
  attempts: number;
  /** 相邻两次查询之间的等待（毫秒）；服务端给了 Retry-After 时首次等待优先用它。 */
  delayMs: number;
}
/** 事务执行依赖。 */
interface RunImageTransactionDeps {
  tx: ImageTransaction;
  adapter: ProviderAdapter;
  params: ImageGenParams;
  /** 提交与查询共用的 HTTP 选项（提交路径内部强制 retryTimes: 0）。 */
  httpOpts: HttpOpts;
  /** 提交后的轮询实现（由工具层注入 TaskManager，本模块不关心轮询细节）。 */
  poll: (taskId: string, signal?: AbortSignal) => Promise<{
    mediaUrl: string;
  }>;
  /** 未知状态策略。 */
  unknownStatePolicy: UnknownStatePolicy;
  /** 找回查询预算。 */
  recovery: RecoveryBudget;
  /** 可注入的等待实现（测试用假时钟）。 */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** 过程日志（由工具层转成 notes，透明告知用户为什么走了这条路）。 */
  onNote?: (note: string) => void;
}
/** 事务结果。 */
interface RunImageTransactionResult {
  submit: SubmitResult;
  transport: ImageTransport;
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
declare function runImageTransaction(deps: RunImageTransactionDeps): Promise<RunImageTransactionResult>;
/** 异步图片传输在本环境不可用（功能未开启 / 分组平台不支持）：调用方应降级同步。 */
declare class AsyncTransportUnavailableError extends GenerationError {
  constructor(detail: string);
}
/** 传输能力探测缓存：避免每次调用都为一个已知不可用的端点付一次 404 往返。 */
interface TransportProbeCache {
  /** 已知不可用状态持续到该时间点（毫秒时间戳）。 */
  unavailableUntil: number;
}
/** 传输能力探测缓存有效期：服务端上线/开启对象存储后自动恢复，无需重启客户端。 */
declare const TRANSPORT_PROBE_TTL_MS: number;
/** 默认找回预算：5 次、间隔 5 秒（服务端提交响应通常秒级落库）。 */
declare const DEFAULT_RECOVERY_BUDGET: RecoveryBudget;
/**
 * 依据配置与探测缓存决定本次调用的传输方式。
 * - `sync`：强制同步（无幂等，仅单次提交保障）。
 * - `async`：强制异步；端点不可用时响亮失败（上线验收用这个口径）。
 * - `auto`：优先异步，服务商不支持或近期探测到不可用时降级同步。
 */
declare function resolveImageTransport(configured: 'async' | 'sync' | 'auto', adapter: ProviderAdapter, probe: TransportProbeCache | undefined, now?: number): ImageTransport;
//#endregion
//#region src/image-preflight.d.ts
/** 预检查输入：本次调用已经解析完的所有决策。 */
interface ImagePreflightInput {
  provider: Provider;
  /** 工具参数 > 配置 defaultImageModel；undefined 表示交给服务商内置默认。 */
  model: string | undefined;
  /** 请求尺寸（可能是 宽*高 / 宽x高 / 比例）。 */
  size: string;
  /** 是否带参考图（决定文生图 / 图生图）。 */
  hasReferenceImage: boolean;
  /** 本次实际使用的传输方式。 */
  transport: ImageTransport;
  /** 适配器是否声明了异步图片网关能力。 */
  adapterSupportsAsync: boolean;
  config: Config;
}
/** 预检查结论：本次调用的完整决策快照，同时作为 notes 透明告知用户。 */
interface ImagePreflight {
  provider: Provider;
  model: string | undefined;
  size: string;
  mode: 'text-to-image' | 'image-to-image';
  transport: ImageTransport;
  /** 水印后处理决策（未开启时 enabled=false）。 */
  watermark: {
    enabled: boolean;
    text: string;
  };
}
/**
 * 执行调用前预检查。任何**确定无法成功**的输入在这里直接失败，绝不带着错误
 * 参数去打一次真金白银的生成请求。
 * @param input - 已解析的调用决策。
 * @returns 预检查结论。
 * @throws {GenerationError} 尺寸写法无法识别、模型明显是视频模型、异步传输不被支持。
 */
declare function resolveImagePreflight(input: ImagePreflightInput): ImagePreflight;
/**
 * 模型名是否明显属于视频模型。命中条件之一即可，且**显式配置优先**：
 * 当用户把 defaultImageModel 明确设成该名字时不再拦截（用户的显式选择胜过启发式）。
 * @param model - 模型名。
 * @param config - 插件配置。
 * @returns 是否判定为视频模型。
 */
declare function looksLikeVideoModel(model: string, config: Config): boolean;
/**
 * 把预检查结论格式化为一行透明告知，写进工具结果 notes：
 * 「本次用了谁、什么模型、什么尺寸、走哪条传输、要不要打水印」一句话说完，
 * 用户不必查配置或翻服务商后台。
 */
declare function formatPreflightNote(preflight: ImagePreflight): string;
//#endregion
//#region src/providers/wanx.d.ts
/** 万象适配器实例。 */
declare const wanxAdapter: ProviderAdapter;
//#endregion
//#region src/providers/seedance.d.ts
/** Seedance 适配器实例。 */
declare const seedanceAdapter: ProviderAdapter;
//#endregion
//#region src/providers/threerouter.d.ts
/** Threerouter 适配器实例：统一入口同时支持文生图与文生视频。 */
declare const threerouterAdapter: ProviderAdapter;
//#endregion
//#region ../node_modules/@deepseek-ai/dsh-brand/lib/types/index.d.ts
/**
 * The `Branded<B>` nominal-typing primitive — a type-only utility (no runtime
 * code, no harness-package dependency) shared by every package that owns a
 * cross-boundary id.
 *
 * A brand makes structurally-identical strings non-interchangeable at the type
 * level: a `SessionId` cannot be passed where a `CallId` is expected, even
 * though both are plain strings at runtime. Construction goes through a per-id
 * factory in the OWNING package (a plain cast inside — zero runtime cost);
 * comparison, logging, and serialization all behave as ordinary strings.
 *
 * Policy: a package brands the ids it owns — `CallId` in dsh-llm (tool-call
 * correlation), the shared agent/session `SessionId` in dsh-session, and
 * `JobId` in dsh-jobs. Branding is for ids that cross package boundaries and
 * could plausibly be confused; not every string needs a brand.
 * This package owns ONLY the primitive — no concrete id, no runtime code beyond
 * the (erased) type — so the brand vocabulary stays dependency-free and a
 * package can brand its ids without depending on an unrelated capability
 * package.
 *
 * @module @deepseek-ai/dsh-brand
 */
declare const BRAND: unique symbol;
/** A string carrying a compile-time-only brand `B`. */
type Branded<B extends string> = string & {
  readonly [BRAND]: B;
};
//#endregion
//#region ../node_modules/@deepseek-ai/dsh-attachment/lib/types/brand.d.ts
/** Opaque content-addressed identifier for one immutable attachment object. */
type AttachmentId = Branded<'AttachmentId'>;
/**
 * Brand a validated storage identifier.
 * @param value - backend-produced opaque identifier.
 * @returns the branded identifier.
 */
declare function AttachmentId(value: string): AttachmentId;
/** Opaque deterministic identity for one request-image transformation. */
type ImageVariantId = Branded<'ImageVariantId'>;
/**
 * Brand a validated request-image transformation identifier.
 * @param value - attachment-provider-produced opaque identifier.
 * @returns the branded identifier.
 */
declare function ImageVariantId(value: string): ImageVariantId;
//#endregion
//#region ../node_modules/@deepseek-ai/dsh-attachment/lib/types/types.d.ts
/** Raster image formats accepted by the version-one attachment path. */
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
/** Durable, serializable reference to one immutable normalized image. */
interface ImageAttachmentRef {
  /** Opaque storage identifier; never a filesystem path or bearer URL. */
  attachmentId: AttachmentId;
  /** Media type verified from the stored bytes. */
  mediaType: ImageMediaType;
  /** Exact encoded byte length. */
  bytes: number;
  /** Intrinsic encoded width in pixels. */
  width: number;
  /** Intrinsic encoded height in pixels. */
  height: number;
  /** Optional display name stripped of local path information. */
  name?: string;
  /**
   * Input dimensions after applying EXIF orientation and before normalization
   * scaling. Present only when normalization reduced the image.
   */
  originalDimensions?: {
    width: number;
    height: number;
  };
}
/** Deployment-resolved limits used by upload admission and request buffering. */
interface ImageAttachmentLimits {
  maxImageBytes: number;
  maxImagesPerMessage: number;
  maxMessageImageBytes: number;
  maxImagePixels: number;
  /** Maximum intrinsic width and maximum intrinsic height in pixels for one image. */
  maxImageDimension: number;
  mediaTypes: readonly ImageMediaType[];
}
/** Request to validate and durably commit one image. */
interface SaveImageAttachment {
  data: Uint8Array;
  /** Caller-declared media type, checked against fully decoded bytes. */
  mediaType: ImageMediaType;
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string;
}
/** Stored image bytes returned after reference and digest verification. */
interface StoredImageAttachment {
  ref: ImageAttachmentRef;
  data: Uint8Array;
}
/** Deterministic request-image policy selected by one exact model route. */
interface ImageRequestPolicy {
  /** Maximum width multiplied by height after aspect-preserving projection. */
  maxPixels: number;
  /** Encoded-byte cap before base64 expansion or Files API upload. */
  maxBytes: number;
}
/** Cached request version derived from one provider-independent normalized attachment. */
interface RequestImageAttachment {
  /** Cache and upload-index key over the attachment id, policy, and fixed encoder parameters. */
  variantId: ImageVariantId;
  /** Durable normalized attachment from which this request version was derived. */
  attachment: ImageAttachmentRef;
  /** Encoded request bytes. */
  data: Uint8Array;
  mediaType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  /** Provider-compatible sample depth proven after request encoding. */
  depth: 'uchar';
  /** Provider-compatible color space proven after request encoding. */
  space: 'srgb';
  /** Whether the encoded request version retains an alpha channel. */
  hasAlpha: boolean;
}
//#endregion
//#region ../node_modules/@deepseek-ai/dsh-attachment/lib/types/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    attachments: AttachmentStore;
  }
}
/** Immutable binary attachment service. Implementations validate bytes before publishing a reference. */
declare abstract class AttachmentStore extends Service {
  constructor(ctx: Context);
  /** Deployment-resolved image policy used by authoritative and fast-path validation. */
  abstract readonly imageLimits: ImageAttachmentLimits;
  /**
   * Validate one image without persisting it.
   * Batch callers validate every member before saving any member.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns completion after the encoded raster has been fully decoded.
   */
  abstract validateImage(input: SaveImageAttachment): Promise<void>;
  /**
   * Validate one ordered image batch before committing any member.
   * Validation failures start no writes; storage failures return no partial
   * references, although already published content-addressed objects may stay
   * unreachable until a future retention policy collects them.
   * @param inputs - encoded images in their owning message order.
   * @returns durable references in the exact input order.
   */
  protected validateImageBatch(inputs: readonly SaveImageAttachment[]): void;
  /**
   * Validate and durably commit one ordered image batch.
   * @param inputs - encoded images in owning-message order.
   * @returns durable normalized attachment references in the same order after every member succeeds.
   */
  saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]>;
  /**
   * Validate and durably commit one image before its owning session event is appended.
   * The returned reference describes the persisted normalized image. When
   * normalization reduces the raster, its `originalDimensions` records the
   * orientation-applied input dimensions.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns the durable content-addressed normalized image reference.
   */
  abstract saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>;
  /**
   * Read one image and verify that bytes still match the recorded reference.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and normalized attachment reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  abstract readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
  /**
   * Generate or read one deterministic model-request version from the stored normalized image.
   * @param ref - durable provider-independent normalized attachment reference.
   * @param policy - exact route pixel and encoded-byte budget.
   * @param signal - optional cancellation.
   * @returns request bytes and the cache/upload identity covering every transform input.
   */
  readImageRequest(ref: ImageAttachmentRef, policy: ImageRequestPolicy, signal?: AbortSignal): Promise<RequestImageAttachment>;
}
//#endregion
//#region src/media-route.d.ts
/** webServer 服务的本地结构视图（上游 WebServer 的最小消费子集）。 */
interface MediaWebServer {
  /** 监听地址：'127.0.0.1' 或 '0.0.0.0'。 */
  host: string;
  /** 注册命名路由，返回注销函数；重复 (kind, path) 抛错。 */
  register(route: {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }): () => void;
}
//#endregion
//#region src/runtime-defaults.d.ts
/**
 * 运行时覆盖值集合。字段语义与 generate_image / generate_video 工具的
 * 服务商/参数选择一一对应：`undefined` = 未覆盖，工具回落 settings（config）持久值。
 * `imageSize` 为映射后的尺寸串（如 '1024*1024'），`videoAspectRatio` 为比例串
 * （如 '16:9'），`imageStyle` 为风格 id（见 {@link IMAGE_STYLE_OPTIONS}）。
 */
interface RuntimeDefaults {
  /** 图片服务商覆盖（'threerouter' | 'wanx' | 'seedance'，minimax 无图片能力）；undefined 跟随 settings。 */
  imageProvider?: Provider;
  /** 图片尺寸覆盖（'宽*高'）；undefined 跟随 settings。 */
  imageSize?: string;
  /** 图片风格 id 覆盖；undefined 跟随 settings（不拼接风格后缀）。 */
  imageStyle?: string;
  /** 视频服务商覆盖；undefined 跟随 settings。 */
  videoProvider?: Provider;
  /** 视频宽高比覆盖（如 '16:9'）；undefined 跟随 settings。 */
  videoAspectRatio?: string;
  /** 视频时长覆盖（秒，1-10）；undefined 跟随 settings。 */
  videoDuration?: number;
}
/** POST /image-video/defaults 接受的单字段写入：null 清除覆盖，否则为合法值。 */
type RuntimeDefaultsPatch = { [K in keyof RuntimeDefaults]: RuntimeDefaults[K] | null };
/** 内存态运行时默认值存储。 */
interface RuntimeDefaultsStore {
  /** 当前覆盖值快照（只读视图；未覆盖字段不出现在对象上）。 */
  get(): Readonly<RuntimeDefaults>;
  /** 合并写入：null 删除该字段覆盖，其余覆盖写入；返回新快照。 */
  patch(patch: RuntimeDefaultsPatch): Readonly<RuntimeDefaults>;
  /** 清空全部覆盖（插件卸载语义；路由层暂不暴露）。 */
  reset(): void;
}
/** 创建内存态运行时默认值存储。 */
declare function createRuntimeDefaultsStore(): RuntimeDefaultsStore;
/** 图片风格选项：id 即协议值，label 供下拉 UI 展示；'' = 自动（不拼接后缀）。 */
declare const IMAGE_STYLE_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
}>;
/**
 * 把风格 id 拼接为英文提示词后缀（生成服务端通用做法：对所有 provider 生效）。
 * @param prompt - 原始提示词。
 * @param style - 风格 id；undefined / '' / 白名单外一律原样返回。
 * @returns 实际发给服务商的提示词。
 */
declare function applyImageStyle(prompt: string, style: string | undefined): string;
/** 图片尺寸白名单（'宽*高'）；'' 由协议层表示「自动（清除覆盖）」，不在表内。 */
declare const IMAGE_SIZE_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  size: string;
}>;
/** defaults 路由路径（exact 匹配；桌面渲染进程同源调用）。 */
declare const DEFAULTS_ROUTE_PATH = "/image-video/defaults";
/** GET / POST 响应体：六字段齐全，null = 无运行时覆盖且无 settings 持久默认（工具用内置默认）。 */
type RuntimeDefaultsView = RuntimeDefaultsPatch;
/**
 * settings 持久默认值视图：{@link extractPersistedDefaults} 从 config 提取出的
 * 合法默认值子集，未提取的字段不出现在对象上（undefined → 合并时跳过）。
 */
type PersistedDefaultsView = Partial<RuntimeDefaults>;
/**
 * 从插件持久 config 提取 settings 默认值，作为 defaults 路由合并视图的回落层。
 * 白名单/范围守卫：服务商须命中 PROVIDERS 白名单（空串 = 跟随激活服务商，不
 * 提取）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须 1-10 整数；
 * settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用内置默认），
 * 避免把非法持久值经合并视图当作生效值回显。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
declare function extractPersistedDefaults(config: Config): PersistedDefaultsView;
/**
 * 校验并归一化 POST body 为存储 patch。严格协议：仅接受六个已知键；
 * null 清除覆盖；'' 表示「自动」（归一化为 null）；其余值按字段白名单/范围校验。
 * @param body - 已 JSON.parse 的请求体（可能是任意值）。
 * @returns 归一化后的 patch；校验失败返回错误信息（字符串）。
 */
declare function parseDefaultsPatch(body: unknown): {
  ok: true;
  patch: RuntimeDefaultsPatch;
} | {
  ok: false;
  error: string;
};
/**
 * 创建 defaults 路由 handler。GET 返回「运行时覆盖 ?? settings 持久默认」合并
 * 视图；POST 校验写入并返回合并视图；非 GET/POST 405；请求体不可解析或校验
 * 失败 400。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（{@link extractPersistedDefaults}
 *   提取；未提供时用空对象，即不回落）。
 */
declare function createDefaultsRouteHandler(store: RuntimeDefaultsStore, persisted?: PersistedDefaultsView): (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>;
/**
 * 把 defaults 路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时返回
 * undefined 且不注册——运行时覆盖值属本机会话状态，不暴露到局域网。
 * @param webServer - webServer 服务实例（结构类型，见 media-route.ts）。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（同 {@link createDefaultsRouteHandler}）。
 * @returns 路由注销函数；未注册返回 undefined。
 */
declare function registerDefaultsRoute(webServer: MediaWebServer, store: RuntimeDefaultsStore, persisted?: PersistedDefaultsView): (() => void) | undefined;
//#endregion
//#region src/tools/generate-image.d.ts
/**
 * 工具依赖：配置、任务管理器、attachment 服务实例。
 * `attachments` 由 `apply()` 通过 `ctx.inject(['attachments'], cb)` 在注册时注入，
 * 不在执行体内部运行时 `ctx.get` 读取——依赖关系在构造时即明确。
 */
interface GenerateImageDeps {
  config: Config;
  taskManager: TaskManager;
  attachments: AttachmentStore;
  ctx: Context;
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore;
  /** 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。 */
  outputsDir: string;
}
/**
 * 创建 generate_image 工具定义。
 * 工具参数：prompt（必填，找回模式除外）、image（单图）、images（多参考图）、size、model、recoverRequestId。
 */
declare function createGenerateImageTool(deps: GenerateImageDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
//#endregion
//#region src/tools/generate-video.d.ts
/** 工具依赖。 */
interface GenerateVideoDeps {
  config: Config;
  taskManager: TaskManager;
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore;
  /**
   * 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。
   * 与图片链路共用同一个目录，杜绝旁路产物；缺省时回退 config.outputsDir。
   */
  outputsDir?: string;
}
/**
 * 创建 generate_video 工具定义。
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）、
 * image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
 */
declare function createGenerateVideoTool(deps: GenerateVideoDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
//#endregion
//#region src/index.d.ts
/** Cordis 插件名，用于 loader 诊断。 */
declare const name = "image-video";
/**
 * 必需服务依赖：`tools`（工具注册表）。
 * `attachments` 不在此声明——它由 `generate_image` 通过 `ctx.inject` 按需声明，
 * 缺失时仅 generate_image 不注册，generate_video 与插件本身不受影响。
 */
declare const inject: string[];
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
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { type AsyncImageSubmit, AsyncTransportUnavailableError, Config, type Config as ConfigType, DEFAULTS_ROUTE_PATH, DEFAULT_RECOVERY_BUDGET, type ErrorKind, GenerationError, IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, type ImageAsyncCapability, type ImageGenParams, type ImagePreflight, type ImageTransaction, type ImageTransport, type PersistedDefaultsView, type Provider, type ProviderAdapter, type ProviderCredentials, type RecoveryBudget, type RequestOptions, type RequestResult, type RuntimeDefaults, type RuntimeDefaultsPatch, type RuntimeDefaultsStore, type RuntimeDefaultsView, type SubmitResult, TRANSPORT_PROBE_TTL_MS, TaskManager, type TaskQueryFn, type TaskQueryResult, type TransactionReport, type TransactionStatus, type TransportProbeCache, type UnknownStatePolicy, type VideoGenParams, type WatermarkConfig, type WatermarkPosition, type WatermarkResult, apply, applyImageStyle, applyImageWatermark, buildWatermarkSvg, canFallbackToNextProvider, consumeSubmitBudget, createDefaultsRouteHandler, createGenerateImageTool, createGenerateVideoTool, createImageTransaction, createRuntimeDefaultsStore, extractPersistedDefaults, fitFontSize, formatPreflightNote, inject, isAsyncImageUnavailableError, isModelNotAcceptedError, isUnknownSubmitStateError, looksLikeVideoModel, name, parseDefaultsPatch, registerDefaultsRoute, reportTransaction, resolveImagePreflight, resolveImageTransport, runImageTransaction, seedanceAdapter, submitBudget, threerouterAdapter, unknownStateError, wanxAdapter };