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
export const WORKBENCH_RPC_CHANNEL = '/image-video'

/** Facts a freshly mounted workbench needs before it can show anything. */
export interface WorkbenchHealth {
  /** Stable plugin identity (the package name). */
  plugin: 'dsh-image-video'
  /** Plugin version, from `src/version.ts`. */
  version: string
  /** The channel these facts came from, so the client can log the pair. */
  channel: string
  /** Active generation provider as configured for this deployment. */
  provider: string
  /** Absolute directory generated media lands in (already resolved by the entry). */
  outputsDir: string
  /** Answer timestamp (ISO 8601), for staleness checks in the client. */
  at: string
  /**
   * 当前生效的默认值（运行时覆盖 ?? settings 持久默认，7 字段）。
   * 工作台只读展示，避免"界面上看不出这一轮到底按什么参数生成"（`R-NFR-1`/`R-BIND-3`）。
   */
  defaults?: Record<string, string | number | null>
}
