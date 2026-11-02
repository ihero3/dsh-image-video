/**
 * 模型能力卡的**实时可用性**：把"已校验"从静态自述换成可复现的事实。
 *
 * 背景：能力卡本身是静态清单（`model-catalog.ts`，`verified` = 我们曾经实测过），
 * 但服务商随时会关掉某个模型（2026-11 现场：threevideo 把生图/生视频模型关掉后，
 * 界面仍显示"已校验"）。所以"现在还能不能用"必须现场问服务商，而不是读旧结论。
 *
 * 事实来源只有两种，二者都不伪造：
 * 1. **服务商模型目录**（本文件）：OpenAI 兼容的 `GET {baseUrl}/models`；列出的算
 *    available，明确没列的算 missing；端点不存在/鉴权失败/网络不通一律 `unknown` +
 *    人话原因，**不猜**成可用或不可用。
 * 2. 真实调用结果（任务账本）——由上层展示，本模块不读账本。
 *
 * 探测失败不是错误路径：`models/catalog` 照常返回卡片和 `live.status = 'unknown'`，
 * 界面据此显示"无法校验（原因）"，绝不影响正常生成。
 *
 * @module dsh-image-video/media/model-health
 */
import type { ModelCapabilityCard } from './model-catalog.ts'

/** 一次探测的结果：成功给出服务商目录里的模型 id；失败给出可读原因。 */
export interface ModelRegistryProbe {
  /** 探测时刻（ISO 8601），界面用来显示"上次刷新"。 */
  readonly attemptedAt: string
  /** 是否真的拿到了模型目录。 */
  readonly ok: boolean
  /** 拿到或推测出的模型 id（`ok:false` 时为空）。 */
  readonly ids: readonly string[]
  /** `ok:false` 时的人话原因：`HTTP 404`、`鉴权失败（HTTP 401）`、`连接失败` 等。 */
  readonly reason?: string
}

/** 单张卡片的实时状态。 */
export type ModelAvailability = 'available' | 'missing' | 'unknown'

/** 一张卡片的实时状态 + 依据。 */
export interface ModelLiveStatus {
  readonly status: ModelAvailability
  /** `missing` / `unknown` 时的补充说明。 */
  readonly detail?: string
}

/** `models/catalog` 的实时段：一次探测 + 逐卡片结论。 */
export interface ModelCatalogLive {
  readonly probe: ModelRegistryProbe
  readonly targets: Readonly<Record<string, ModelLiveStatus>>
}

/** 探测超时（毫秒）：比生成请求短得多，界面等不起。 */
const PROBE_TIMEOUT_MS = 6_000

/**
 * 归一化模型 id 用于比较：大小写、`-`/`_`/`.` 差异都不算不同模型
 * （服务商目录里 `MiniMax-H3`、`minimax_h3` 都出现过）。
 * @param id - 模型 id。
 * @returns 可比较的键。
 */
function normalizeModelId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/gu, '')
}

/**
 * 从服务商目录响应里提取模型 id。兼容三种常见形状：
 * `{data:[{id}]}`（OpenAI 标准）、`{models:[{id}|'id']}`、`{ids:['id']}`。
 * @param body - 已解析的 JSON。
 * @returns 模型 id 列表（去重、保持原序）；形状不认识时为空数组。
 */
export function extractModelIds(body: unknown): readonly string[] {
  const pick = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    const ids: string[] = []
    for (const item of value) {
      if (typeof item === 'string' && item !== '') ids.push(item)
      else if (typeof item === 'object' && item !== null) {
        const id = (item as { id?: unknown }).id
        if (typeof id === 'string' && id !== '') ids.push(id)
      }
    }
    return ids
  }
  if (typeof body !== 'object' || body === null) return []
  const record = body as Record<string, unknown>
  const ids = [...pick(record.data), ...pick(record.models), ...pick(record.ids)]
  return [...new Set(ids)]
}

/**
 * 按服务商目录判断每张卡片现在能不能用。
 * @param cards - 能力卡（`model-catalog.ts`）。
 * @param probe - 一次探测结果。
 * @returns 卡片 id → 状态；`probe.ok:false` 时全部 `unknown` 并带同一条原因。
 */
export function compareCardsAgainstRegistry(
  cards: readonly ModelCapabilityCard[],
  probe: ModelRegistryProbe,
): Record<string, ModelLiveStatus> {
  const known = new Set(probe.ids.map(normalizeModelId))
  const targets: Record<string, ModelLiveStatus> = {}
  for (const card of cards) {
    if (!probe.ok) {
      targets[card.id] = { status: 'unknown', detail: probe.reason ?? '未取得服务商模型目录' }
      continue
    }
    targets[card.id] = known.has(normalizeModelId(card.id))
      ? { status: 'available' }
      : { status: 'missing', detail: '服务商模型目录里没有这个 id（可能已下线或被账号关闭）' }
  }
  return targets
}

/** 探测一个模型目录端点所需的输入。 */
export interface RegistryProbeInput {
  /** 服务商 API 基地址（如 `https://www.threevideo.com/v1`）。 */
  readonly baseUrl: string
  /** Bearer token；缺省时探测必然 401，这里直接跳过并给原因。 */
  readonly apiKey: string | undefined
}

/**
 * 现场探测服务商的模型目录（`GET {baseUrl}/models`）。**永不抛错**：
 * 任何失败都折成 `{ok:false, reason}`，交给界面如实显示。
 * @param input - 基地址与凭证。
 * @param signal - 可选中止信号（页面卸载/切换项目时取消）。
 * @returns 探测结果。
 */
export async function probeModelRegistry(input: RegistryProbeInput, signal?: AbortSignal): Promise<ModelRegistryProbe> {
  const attemptedAt = new Date().toISOString()
  const fail = (reason: string): ModelRegistryProbe => ({ attemptedAt, ok: false, ids: [], reason })
  const apiKey = input.apiKey?.trim() ?? ''
  if (apiKey === '') return fail('未配置服务商凭证，无法探测模型目录')
  const url = `${input.baseUrl.replace(/\/+$/u, '')}/models`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: signal ?? AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail(`连接服务商失败：${message.slice(0, 120)}`)
  }
  if (response.status === 401 || response.status === 403) return fail(`鉴权失败（HTTP ${response.status}）`)
  if (response.status === 404) return fail('服务商没有提供模型目录端点（HTTP 404）')
  if (!response.ok) return fail(`服务商返回 HTTP ${response.status}`)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return fail('服务商模型目录不是合法 JSON')
  }
  const ids = extractModelIds(body)
  if (ids.length === 0) return fail('服务商模型目录为空或格式不认识')
  return { attemptedAt, ok: true, ids }
}
