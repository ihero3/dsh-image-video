/**
 * 线上契约测试：wan3.0-video「参考视频（视频编辑）」是否被 threerouter 接受。
 *
 * 目的：单元测试只能证明「客户端拼出了预期的请求体」；本文件真的打
 * api.threerouter.com/v1/media/generations，证明**服务端确实按该契约服务**——
 * 参考视频走 `media[].type=reference_video`，配合参考图与编辑意图提示词，
 * 保留原片构图与动作、只改写指定主体。
 *
 * 运行方式（会真实扣费，一次运行 = 一个视频任务）：
 *   DSH_IMAGE_VIDEO_LIVE=1 \
 *   THREEROUTER_MEDIA_API_KEY=sk-… \
 *   DSH_IMAGE_VIDEO_LIVE_REF_VIDEO=/path/source.mp4 \
 *   DSH_IMAGE_VIDEO_LIVE_REF_IMAGES=/path/a.png,/path/b.png \
 *   npx vitest run tests/live-video-edit-contract.test.ts
 *
 * 可选环境变量：
 *   DSH_IMAGE_VIDEO_LIVE_BASE   接口地址，默认 https://api.threerouter.com/v1
 *   DSH_IMAGE_VIDEO_LIVE_MODEL  模型，默认 wan3.0-video
 *   DSH_IMAGE_VIDEO_LIVE_PROMPT 编辑提示词（缺省用「替换人物」的示例指令）
 *   DSH_IMAGE_VIDEO_LIVE_OUT    产物保存目录（缺省写到系统临时目录）
 */

import { describe, it, expect } from 'vitest'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveVideoMedia } from '../src/media.ts'
import { threerouterAdapter } from '../src/providers/threerouter.ts'
import type { HttpOpts } from '../src/providers/types.ts'

const LIVE = process.env.DSH_IMAGE_VIDEO_LIVE === '1'
const API_KEY = process.env.THREEROUTER_MEDIA_API_KEY ?? ''
const BASE = (process.env.DSH_IMAGE_VIDEO_LIVE_BASE ?? 'https://api.threerouter.com/v1').replace(/\/$/, '')
const MODEL = process.env.DSH_IMAGE_VIDEO_LIVE_MODEL ?? 'wan3.0-video'
const REF_VIDEO = process.env.DSH_IMAGE_VIDEO_LIVE_REF_VIDEO ?? ''
const REF_IMAGES = (process.env.DSH_IMAGE_VIDEO_LIVE_REF_IMAGES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s !== '')
const OUT_DIR = process.env.DSH_IMAGE_VIDEO_LIVE_OUT ?? join(tmpdir(), 'dsh-video-edit-live')
const PROMPT = process.env.DSH_IMAGE_VIDEO_LIVE_PROMPT
  ?? '编辑视频1：把视频1里的人物替换成图片1中的人物，保持原视频的镜头运动、人物动作、场景、时长和光影完全不变，只替换人物外貌与服装。'

/** 视频编辑任务耗时较长（官方标注 5-10 分钟），轮询上限放宽。 */
const POLL_TIMEOUT_MS = 900_000
const POLL_INTERVAL_MS = 10_000

const opts: HttpOpts = {
  apiKey: API_KEY,
  baseURL: BASE,
  timeoutMs: 120_000,
  retryTimes: 0,
}

describe.skipIf(!LIVE || API_KEY === '' || REF_VIDEO === '')('wan3.0-video 参考视频线上契约', () => {
  it('提交参考视频 + 参考图，服务端接受并返回可用视频', async () => {
    const media = await resolveVideoMedia([
      { video: REF_VIDEO, type: 'reference_video' },
      ...REF_IMAGES.map((image) => ({ image, type: 'reference_image' })),
    ])
    // 体积快照：threerouter 无上传端点，本地素材只能以 data URL 提交，先记录实际载荷量
    const payloadBytes = media.reduce((sum, m) => sum + m.url.length, 0)
    console.log(`[live] media 条目 ${media.length} 个，base64 载荷合计 ${(payloadBytes / 1024 / 1024).toFixed(2)}MB`)
    console.log(`[live] 类型序列：${media.map((m) => m.type).join(', ')}`)

    const submit = await threerouterAdapter.submitVideo({
      prompt: PROMPT,
      duration: -1,
      model: MODEL,
      aspectRatio: 'adaptive',
      media,
    }, opts)
    console.log(`[live] 提交成功 taskId=${submit.taskId} model=${submit.model}`)
    expect(submit.taskId).not.toBe('')

    const deadline = Date.now() + POLL_TIMEOUT_MS
    let mediaUrl: string | undefined
    while (Date.now() < deadline) {
      const q = await threerouterAdapter.queryTask(submit.taskId, opts)
      if (q.status === 'succeeded') { mediaUrl = q.mediaUrl; break }
      if (q.status === 'failed') throw new Error(`任务失败：${q.error}`)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    expect(mediaUrl, '轮询超时未拿到视频 URL').toBeTruthy()

    await mkdir(OUT_DIR, { recursive: true })
    const res = await fetch(mediaUrl as string)
    expect(res.ok).toBe(true)
    const bytes = Buffer.from(await res.arrayBuffer())
    const outPath = join(OUT_DIR, `wan30-video-edit-${Date.now()}.mp4`)
    await writeFile(outPath, bytes)
    const info = await stat(outPath)
    console.log(`[live] 视频已保存 ${outPath}（${info.size} 字节）`)
    expect(info.size).toBeGreaterThan(10_000)
  }, POLL_TIMEOUT_MS + 120_000)
})
