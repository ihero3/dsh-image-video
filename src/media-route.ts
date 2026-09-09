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

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, extname, resolve, sep } from 'node:path'

/** webServer 服务的本地结构视图（上游 WebServer 的最小消费子集）。 */
export interface MediaWebServer {
  /** 监听地址：'127.0.0.1' 或 '0.0.0.0'。 */
  host: string
  /** 注册命名路由，返回注销函数；重复 (kind, path) 抛错。 */
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** outputs 媒体路由前缀（prefix 匹配 /outputs 与 /outputs/<文件名>）。 */
export const OUTPUTS_ROUTE_PATH = '/outputs'

/** 扩展名 → Content-Type 白名单；表外扩展名一律 404。 */
const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * 校验 URL 解码后的路径段是否为 outputs/ 内的合法单段文件名。
 * 拒绝空段、相对段（. / ..）、任何形式的路径分隔符与 NUL 字节；再以 resolve
 * 归一化双重确认结果仍位于 outputsDir 内（防御分隔符/大小写差异导致的绕过）。
 * @param raw - decodeURIComponent 之后的原始段。
 * @param outputsDir - 归一化后的 outputs 绝对目录。
 * @returns 合法文件名；不合法返回 undefined。
 */
export function safeOutputFileName(raw: string, outputsDir: string): string | undefined {
  if (raw === '' || raw === '.' || raw === '..' || raw.includes('\0')) return undefined
  if (raw.includes('/') || raw.includes('\\') || raw.includes(sep)) return undefined
  if (basename(raw) !== raw) return undefined
  const root = resolve(outputsDir)
  const full = resolve(root, raw)
  return full === root || full.startsWith(root + sep) ? raw : undefined
}

/**
 * 扩展名（含点、忽略大小写）→ Content-Type；白名单外返回 undefined。
 * @param ext - 如 '.mp4'。
 */
export function contentTypeForExtension(ext: string): string | undefined {
  return CONTENT_TYPES[ext.toLowerCase()]
}

/** 单段字节闭区间。 */
export interface ByteRange {
  start: number
  end: number
}

/**
 * 解析 Range 请求头（bytes=start-end / bytes=start- / bytes=-suffix）。
 * 只取第一段（视频播放器均发单段请求）；末字节越界截断到文件尾。
 * @param header - Range 头原文；undefined 或非 bytes 单位返回 undefined（按全量处理）。
 * @param size - 资源总字节数。
 * @returns 可满足的闭区间；头非法或区间不可满足时返回 undefined。
 */
export function parseRange(header: string | undefined, size: number): ByteRange | undefined {
  if (header === undefined || !header.startsWith('bytes=')) return undefined
  const spec = (header.slice('bytes='.length).split(',')[0] ?? '').trim()
  const dash = spec.indexOf('-')
  if (dash === -1) return undefined
  const startText = spec.slice(0, dash).trim()
  const endText = spec.slice(dash + 1).trim()
  if (startText === '' && endText === '') return undefined
  let start: number
  let end: number
  if (startText === '') {
    // 后缀形式 bytes=-N：取文件末尾 N 字节
    const suffix = Number(endText)
    if (!Number.isInteger(suffix) || suffix <= 0 || size === 0) return undefined
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startText)
    if (!Number.isInteger(start) || start < 0) return undefined
    end = endText === '' ? size - 1 : Number(endText)
    if (!Number.isInteger(end)) return undefined
    if (end >= size) end = size - 1
  }
  if (start > end || start >= size) return undefined
  return { start, end }
}

/**
 * 创建 outputs 路由 handler：GET/HEAD 流式返回媒体文件，GET 支持 Range 206
 * 分段加载（视频进度条拖动依赖）。白名单外扩展名、越界路径、不存在的文件
 * 一律 404；URL 解码失败 400；非 GET/HEAD 405。
 * @param outputsDir - outputs 目录（相对路径按进程 cwd 归一化）。
 */
export function createOutputsRouteHandler(
  outputsDir: string,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const root = resolve(outputsDir)
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end()
      return
    }
    let raw: string
    try {
      raw = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname.replace(/^\/outputs\/?/, ''))
    } catch {
      res.writeHead(400)
      res.end()
      return
    }
    const name = safeOutputFileName(raw, root)
    const contentType = name === undefined ? undefined : contentTypeForExtension(extname(name))
    if (name === undefined || contentType === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    let size: number
    try {
      const info = await stat(resolve(root, name))
      if (!info.isFile()) {
        res.writeHead(404)
        res.end()
        return
      }
      size = info.size
    } catch {
      res.writeHead(404)
      res.end()
      return
    }
    // Range 仅对 GET 生效；头存在但不可满足 → 416
    const range = req.method === 'GET' ? parseRange(req.headers.range, size) : undefined
    if (req.method === 'GET' && req.headers.range !== undefined && range === undefined) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` })
      res.end()
      return
    }
    const headers: Record<string, string | number> = {
      'Content-Type': contentType,
      'Content-Length': range === undefined ? size : range.end - range.start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    }
    if (range !== undefined) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
    res.writeHead(range === undefined ? 200 : 206, headers)
    if (req.method === 'HEAD' || size === 0) {
      res.end()
      return
    }
    const stream = createReadStream(resolve(root, name), range === undefined ? undefined : { start: range.start, end: range.end })
    // 客户端中断（取消加载/关闭窗口）时关闭文件流，避免句柄泄漏
    res.on('close', () => {
      stream.destroy()
    })
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500)
      res.destroy()
    })
    stream.pipe(res)
  }
}

/**
 * 把 outputs 媒体路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时
 * 返回 undefined 且不注册，生成的媒体不暴露到非本机网络。
 * @param webServer - webServer 服务实例。
 * @param outputsDir - outputs 目录（相对路径按进程 cwd 归一化）。
 * @returns 路由注销函数；未注册返回 undefined。
 */
export function registerOutputsRoute(webServer: MediaWebServer, outputsDir: string): (() => void) | undefined {
  if (webServer.host !== '127.0.0.1') return undefined
  return webServer.register({
    kind: 'prefix',
    path: OUTPUTS_ROUTE_PATH,
    handler: createOutputsRouteHandler(outputsDir),
  })
}
