/**
 * 服务商适配器通用类型。万象（wanx）与 Seedance 均实现此接口，
 * 工具层按 provider 字段分发，无需感知具体 API 差异。
 * @module dsh-image-video/providers/types
 */

import type { RequestOptions } from '../http-client.ts'

/** 文生图请求参数。 */
export interface ImageGenParams {
  /** 提示词。 */
  prompt: string
  /** 图片尺寸，如 "1024x1024"。 */
  size: string
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string
}

/** 文生视频请求参数。 */
export interface VideoGenParams {
  /** 提示词。 */
  prompt: string
  /** 视频时长（秒），上限 10。 */
  duration: number
  /** 可选宽高比，如 "16:9"。 */
  aspectRatio?: string
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string
}

/** 任务提交结果。 */
export interface SubmitResult {
  /** 任务 ID；同步接口返回空字符串。 */
  taskId: string
  /** true 表示需要轮询查询，false 表示同步已返回结果。 */
  async: boolean
  /** 同步接口直接返回的媒体 URL；async=false 时有值。 */
  mediaUrl?: string
  /** 媒体类型，用于区分图片/视频渲染。 */
  mediaType: 'image' | 'video'
}

/** 任务查询结果。 */
export type TaskQueryResult =
  | { status: 'pending' | 'running' }
  | { status: 'succeeded'; mediaUrl: string }
  | { status: 'failed'; error: string }

/** HTTP 请求选项子集，由工具层从 Config 解析后传入。 */
export interface HttpOpts {
  apiKey: string
  baseURL: string
  timeoutMs: number
  retryTimes: number
  signal?: AbortSignal
}

/** 将 HttpOpts 转换为 RequestOptions。 */
export function toRequestOpts(method: 'GET' | 'POST', url: string, headers: Record<string, string>, body: unknown, opts: HttpOpts): RequestOptions {
  return {
    method,
    url,
    headers,
    body,
    timeoutMs: opts.timeoutMs,
    retryTimes: opts.retryTimes,
    signal: opts.signal,
  }
}

/** 服务商适配器接口。 */
export interface ProviderAdapter {
  /** 提交文生图任务。 */
  submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult>
  /** 提交文生视频任务（始终异步）。 */
  submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult>
  /** 查询异步任务状态。 */
  queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>
}

/** 从 "1024x1024" 格式解析宽高。 */
export function parseSize(size: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim())
  if (!match || match[1] === undefined || match[2] === undefined) {
    return { width: 1024, height: 1024 }
  }
  return { width: Number(match[1]), height: Number(match[2]) }
}
