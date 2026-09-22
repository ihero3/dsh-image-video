/**
 * 线上契约测试：wan3.0-video「分段复刻」——把长参考视频切成若干短段分别做视频编辑，
 * 每段独立提交、并行轮询，全部产出后由调用方拼接回原时长。
 *
 * 为什么分段：实测（2026-09-22）单次视频编辑任务对 15 秒参考片也只产出约 5 秒，
 * 长片一次性提交会丢失大部分时长；按模型实际输出能力（约 5 秒）切段最贴合。
 *
 * 运行方式（会真实扣费：一次运行 = 段数 × 一个视频任务）：
 *   DSH_IMAGE_VIDEO_LIVE=1 \
 *   THREEROUTER_MEDIA_API_KEY=sk-… \
 *   DSH_IMAGE_VIDEO_LIVE_REF_SEGMENTS=/tmp/seg1.mp4,/tmp/seg2.mp4 \
 *   DSH_IMAGE_VIDEO_LIVE_REF_IMAGES=/path/a.png,/path/b.png \
 *   npx vitest run tests/live-video-edit-segments.test.ts
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
const SEGMENTS = (process.env.DSH_IMAGE_VIDEO_LIVE_REF_SEGMENTS ?? '')
  .split(',').map((s) => s.trim()).filter((s) => s !== '')
const REF_IMAGES = (process.env.DSH_IMAGE_VIDEO_LIVE_REF_IMAGES ?? '')
  .split(',').map((s) => s.trim()).filter((s) => s !== '')
const OUT_DIR = process.env.DSH_IMAGE_VIDEO_LIVE_OUT ?? join(tmpdir(), 'dsh-video-edit-segments')
const PROMPT = process.env.DSH_IMAGE_VIDEO_LIVE_PROMPT
  ?? '编辑视频1：把视频1里的人物替换成图片1中的人物，保持原视频的镜头运动、人物动作、场景、时长和光影完全不变，只替换人物外貌与服装。'

const POLL_TIMEOUT_MS = 900_000
const POLL_INTERVAL_MS = 10_000

const opts: HttpOpts = { apiKey: API_KEY, baseURL: BASE, timeoutMs: 120_000, retryTimes: 0 }

describe.skipIf(!LIVE || API_KEY === '' || SEGMENTS.length === 0)('wan3.0-video 分段复刻线上契约', () => {
  it('并行提交所有分段并各自落盘', async () => {
    await mkdir(OUT_DIR, { recursive: true })
    const paths = await Promise.all(SEGMENTS.map(async (segment, i) => {
      const label = `seg${i + 1}`
      const media = await resolveVideoMedia([
        { video: segment, type: 'reference_video' },
        ...REF_IMAGES.map((image) => ({ image, type: 'reference_image' })),
      ])
      const payload = media.reduce((sum, m) => sum + m.url.length, 0)
      const submit = await threerouterAdapter.submitVideo({
        prompt: PROMPT, duration: -1, model: MODEL, aspectRatio: 'adaptive', media,
      }, opts)
      console.log(`[${label}] 提交 taskId=${submit.taskId} 载荷=${(payload / 1024 / 1024).toFixed(2)}MB`)

      const deadline = Date.now() + POLL_TIMEOUT_MS
      let mediaUrl: string | undefined
      let failure: string | undefined
      while (Date.now() < deadline) {
        try {
          const q = await threerouterAdapter.queryTask(submit.taskId, opts)
          if (q.status === 'succeeded') { mediaUrl = q.mediaUrl; break }
          if (q.status === 'failed') { failure = q.error; break }
        } catch (err) {
          // 轮询请求本身可能瞬时失败（网关抖动、代理重置）。任务在服务端继续跑、
          // 结果保留 24 小时，因此只记录并继续轮询，绝不让一次网络抖动丢掉整批结果。
          console.log(`[${label}] 轮询瞬时失败，继续重试：${err instanceof Error ? err.message : String(err)}`)
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      if (failure !== undefined) throw new Error(`[${label}] 任务失败：${failure}`)
      if (mediaUrl === undefined) throw new Error(`[${label}] 轮询超时`)
      const res = await fetch(mediaUrl)
      expect(res.ok, `[${label}] 下载失败`).toBe(true)
      const bytes = Buffer.from(await res.arrayBuffer())
      const path = join(OUT_DIR, `${label}-result.mp4`)
      await writeFile(path, bytes)
      const info = await stat(path)
      console.log(`[${label}] 完成 ${info.size} 字节 -> ${path}`)
      return path
    }))
    expect(paths).toHaveLength(SEGMENTS.length)
  }, POLL_TIMEOUT_MS + 180_000)
})
