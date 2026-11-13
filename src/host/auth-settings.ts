/**
 * 连接弹层的长期配置：服务商自定义接口地址与最近使用的服务商。
 *
 * 写入工作台数据目录下的 `auth-settings.json`（临时文件 + rename 原子替换），
 * **没有过期时间**：只有用户点「恢复默认」或手动删除文件才会丢失。登录态与
 * API Key 不在这里——它们由凭证缝保存（见 `./auth.ts` 的会话记录与凭证引用）。
 *
 * @module dsh-image-video/host/auth-settings
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** 落盘文档（版本化，便于将来迁移）。 */
export interface AuthSettingsDocument {
  /** 文档版本；当前只有 `1`。 */
  readonly version: 1
  /** 服务商 → 自定义接口根地址（不含末尾斜杠）。 */
  readonly baseUrls: Record<string, string>
  /** 用户最后一次选择的服务商（下次打开弹层默认选中）。 */
  readonly lastProvider?: string
  /** 已验证连通的服务商（成功测试 / 登录后写入；重新打开弹层继续显示，无过期）。 */
  readonly verified?: string[]
}

/** 连接配置存储。所有方法都会吞掉读取失败（当作空配置）。 */
export interface AuthSettingsStore {
  /** 读取整份文档。 */
  load(): Promise<AuthSettingsDocument>
  /** 某个服务商的自定义接口地址；未设置返回 undefined。 */
  baseUrlFor(provider: string): Promise<string | undefined>
  /** 写入某个服务商的接口地址（空字符串等价于清除）。 */
  setBaseUrl(provider: string, baseUrl: string): Promise<void>
  /** 清除某个服务商的接口地址。 */
  clearBaseUrl(provider: string): Promise<void>
  /** 记住用户最后选择的服务商。 */
  setLastProvider(provider: string): Promise<void>
  /** 已验证连通的服务商集合。 */
  verifiedProviders(): Promise<string[]>
  /** 标记 / 取消某个服务商的连通状态（成功测试或登录时标记）。 */
  setVerified(provider: string, verified: boolean): Promise<void>
}

/** 空文档。 */
const EMPTY: AuthSettingsDocument = { version: 1, baseUrls: {} }

/** 把未知 JSON 收窄成文档；形状不认识就回到空文档。 */
function asDocument(value: unknown): AuthSettingsDocument {
  if (typeof value !== 'object' || value === null) return EMPTY
  const record = value as Record<string, unknown>
  const baseUrls: Record<string, string> = {}
  if (typeof record.baseUrls === 'object' && record.baseUrls !== null) {
    for (const [key, entry] of Object.entries(record.baseUrls as Record<string, unknown>)) {
      if (typeof entry === 'string' && entry.trim() !== '') baseUrls[key] = entry.trim()
    }
  }
  const verified: string[] = []
  if (Array.isArray(record.verified)) {
    for (const entry of record.verified) {
      if (typeof entry === 'string' && entry !== '' && !verified.includes(entry)) verified.push(entry)
    }
  }
  return {
    version: 1,
    baseUrls,
    ...typeof record.lastProvider === 'string' && record.lastProvider !== ''
      ? { lastProvider: record.lastProvider }
      : {},
    ...verified.length === 0 ? {} : { verified },
  }
}

/**
 * 创建连接配置存储。
 * @param file - `auth-settings.json` 的绝对路径。
 * @returns 带缓存的存储；写入串行化以免两次保存互相覆盖。
 */
export function createAuthSettingsStore(file: string): AuthSettingsStore {
  let cache: AuthSettingsDocument | undefined
  let queue: Promise<void> = Promise.resolve()

  const load = async (): Promise<AuthSettingsDocument> => {
    if (cache !== undefined) return cache
    try {
      cache = asDocument(JSON.parse(await readFile(file, 'utf8')))
    } catch {
      // 首次使用或文件被手动删除：空配置就是正确状态
      cache = EMPTY
    }
    return cache
  }

  const persist = (next: AuthSettingsDocument): Promise<void> => {
    cache = next
    queue = queue.then(async () => {
      await mkdir(dirname(file), { recursive: true })
      const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
      await rename(temporary, file)
    }).catch(() => undefined)
    return queue
  }

  return {
    load,
    async baseUrlFor(provider) {
      return (await load()).baseUrls[provider]
    },
    async setBaseUrl(provider, baseUrl) {
      const current = await load()
      const baseUrls = { ...current.baseUrls }
      const trimmed = baseUrl.trim().replace(/\/+$/, '')
      if (trimmed === '') delete baseUrls[provider]
      else baseUrls[provider] = trimmed
      await persist({ ...current, baseUrls })
    },
    async clearBaseUrl(provider) {
      const current = await load()
      const baseUrls = { ...current.baseUrls }
      delete baseUrls[provider]
      await persist({ ...current, baseUrls })
    },
    async setLastProvider(provider) {
      const current = await load()
      await persist({ ...current, lastProvider: provider })
    },
    async verifiedProviders() {
      return [...await load().then(document => document.verified ?? [])]
    },
    async setVerified(provider, verified) {
      const current = await load()
      const next = new Set(current.verified ?? [])
      if (verified) next.add(provider)
      else next.delete(provider)
      const list = [...next]
      await persist({ ...current, ...list.length === 0 ? { verified: undefined } : { verified: list } })
    },
  }
}
