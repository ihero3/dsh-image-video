import { describe, it, expect, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extFromContentType,
  toImageMediaTypeForTest,
  createImageSummaryText,
  createVideoContent,
  imageMimeFromPath,
  resolveImageReference,
  compressVideoFirstFrame,
  resolveVideoMedia,
  resolveReferenceVideo,
  videoMimeFromPath,
  saveBase64Image,
} from '../src/media.ts'

describe('media 扩展名与类型推断', () => {
  describe('extFromContentType', () => {
    it('图片类型', () => {
      expect(extFromContentType('image/png', '.bin')).toBe('.png')
      expect(extFromContentType('image/jpeg', '.bin')).toBe('.jpg')
      expect(extFromContentType('image/jpg', '.bin')).toBe('.jpg')
      expect(extFromContentType('image/webp', '.bin')).toBe('.webp')
      expect(extFromContentType('image/gif', '.bin')).toBe('.gif')
    })

    it('视频类型', () => {
      expect(extFromContentType('video/mp4', '.bin')).toBe('.mp4')
      expect(extFromContentType('video/quicktime', '.bin')).toBe('.mov')
      expect(extFromContentType('video/x-mov', '.bin')).toBe('.mov')
    })

    it('忽略 charset 参数', () => {
      expect(extFromContentType('image/png; charset=utf-8', '.bin')).toBe('.png')
      expect(extFromContentType('image/jpeg;charset=UTF-8', '.bin')).toBe('.jpg')
    })

    it('未知类型回退到 fallback', () => {
      expect(extFromContentType('application/octet-stream', '.png')).toBe('.png')
      expect(extFromContentType('', '.mp4')).toBe('.mp4')
      expect(extFromContentType('text/html', '.bin')).toBe('.bin')
    })

    it('大小写不敏感', () => {
      expect(extFromContentType('IMAGE/PNG', '.bin')).toBe('.png')
      expect(extFromContentType('Video/MP4', '.bin')).toBe('.mp4')
    })
  })

  describe('toImageMediaTypeForTest', () => {
    it('映射已知类型', () => {
      expect(toImageMediaTypeForTest('image/png')).toBe('image/png')
      expect(toImageMediaTypeForTest('image/jpeg')).toBe('image/jpeg')
      expect(toImageMediaTypeForTest('image/jpg')).toBe('image/jpeg')
      expect(toImageMediaTypeForTest('image/webp')).toBe('image/webp')
      expect(toImageMediaTypeForTest('image/gif')).toBe('image/gif')
    })

    it('未知类型回退到 png', () => {
      expect(toImageMediaTypeForTest('application/octet-stream')).toBe('image/png')
      expect(toImageMediaTypeForTest('')).toBe('image/png')
    })
  })

  describe('createImageSummaryText', () => {
    it('返回纯文本块，包含路径、服务商与尺寸', () => {
      const blocks = createImageSummaryText({
        provider: 'wanx',
        localPath: '/ws/outputs/a.png',
        bytes: 2048,
        width: 1024,
        height: 1024,
      })
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toMatchObject({ type: 'text' })
      const text = (blocks[0] as { text: string }).text
      expect(text).toContain('/ws/outputs/a.png')
      expect(text).toContain('wanx')
      expect(text).toContain('1024×1024')
      expect(text).toContain('2.0 KB')
      // 模型可见内容必须是纯文本：绝不携带 image 块，防止纯文本模型收到 image_url 报 400
      expect(blocks.every(block => block.type === 'text')).toBe(true)
    })

    it('缺失尺寸时显示未知尺寸', () => {
      const blocks = createImageSummaryText({
        provider: 'seedance',
        localPath: '/ws/outputs/b.png',
        bytes: 512,
      })
      expect((blocks[0] as { text: string }).text).toContain('未知尺寸')
    })

    it('回报实际模型与透明告知（模型不再靠配置推断）', () => {
      const blocks = createImageSummaryText({
        provider: 'threerouter',
        localPath: '/ws/outputs/c.png',
        bytes: 1024,
        model: 'wan2.1-image',
        notes: ['模型自动路由回退：seedance 不接受该模型；最终由 threerouter 提交'],
      })
      const text = (blocks[0] as { text: string }).text
      expect(text).toContain('模型：wan2.1-image')
      expect(text).toContain('透明告知')
      expect(text).toContain('最终由 threerouter 提交')
    })

    it('未指定模型时显示服务商内置默认', () => {
      const blocks = createImageSummaryText({ provider: 'threerouter', localPath: '/x.png', bytes: 1 })
      expect((blocks[0] as { text: string }).text).toContain('模型：服务商内置默认')
    })

    it('标准输出含提示词（结果自证「这张图是怎么来的」）', () => {
      const blocks = createImageSummaryText({
        provider: 'threerouter',
        localPath: '/ws/outputs/d.png',
        bytes: 1024,
        prompt: '夕阳下的帆船，水彩风格',
        model: 'wan2.1-image',
      })
      const text = (blocks[0] as { text: string }).text
      expect(text).toContain('提示词：夕阳下的帆船，水彩风格')
      expect(text).toContain('模型：wan2.1-image')
    })
  })

  describe('saveBase64Image', () => {
    it('base64 落盘：文件名带正确扩展名、字节与解码内容一致', async () => {
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const dir = await mkdtemp(join(tmpdir(), 'dsh-i2i-'))
      const base64 = Buffer.from('fake-png-bytes').toString('base64')
      const saved = await saveBase64Image(base64, 'image/png', dir)
      expect(saved.contentType).toBe('image/png')
      expect(saved.sourceUrl).toBe('')
      expect(saved.bytes).toBe(14)
      expect(new TextDecoder().decode(saved.data)).toBe('fake-png-bytes')
      expect(saved.localPath.endsWith('.png')).toBe(true)
      const { readFile } = await import('node:fs/promises')
      const onDisk = await readFile(saved.localPath)
      expect(new TextDecoder().decode(onDisk)).toBe('fake-png-bytes')
    })

    it('jpeg 类型映射 .jpg 扩展名', async () => {
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const dir = await mkdtemp(join(tmpdir(), 'dsh-i2i-'))
      const saved = await saveBase64Image(Buffer.from('x').toString('base64'), 'image/jpeg', dir)
      expect(saved.localPath.endsWith('.jpg')).toBe(true)
    })
  })

  describe('createVideoContent', () => {
    it('可见文本含提示词、服务商、实际模型、模式与透明告知（含时长被丢弃说明）', () => {
      const blocks = createVideoContent(
        '/ws/outputs/v.mp4',
        754_500,
        'https://cdn.example.com/v.mp4',
        {
          prompt: '女子腾空飞向高空，穿越蓝天白云',
          provider: 'threerouter',
          model: 'wan2.7-t2v',
          mode: 'image-to-video',
          duration: 5,
          resolution: '1080P',
          notes: ['当前模型 wan2.7-t2v 不支持自定义时长，已忽略 duration=5 秒，实际时长由上游模型默认决定'],
        },
      )
      expect(blocks).toHaveLength(1)
      const text = (blocks[0] as { text: string }).text
      expect(text).toContain('- 提示词：女子腾空飞向高空，穿越蓝天白云')
      expect(text).toContain('- 服务商：threerouter')
      expect(text).toContain('- 模型：wan2.7-t2v')
      expect(text).toContain('- 生成模式：image-to-video')
      expect(text).toContain('- 时长参数：5 秒')
      expect(text).toContain('- 分辨率：1080P')
      expect(text).toContain('透明告知')
      expect(text).toContain('已忽略 duration=5 秒')
      expect(text).toContain('https://cdn.example.com/v.mp4')
    })

    it('无 details 时保持最小字段且明确标注模型来自服务商内置默认', () => {
      const blocks = createVideoContent('/ws/outputs/v.mp4', 1024, 'https://cdn.example.com/v.mp4')
      const text = (blocks[0] as { text: string }).text
      expect(text).toContain('- 文件路径：/ws/outputs/v.mp4')
      expect(text).toContain('- 模型：服务商内置默认')
      expect(text).not.toContain('透明告知')
    })
  })

  describe('图生视频 image 引用解析', () => {
    let tempDir = ''
    afterAll(async () => {
      if (tempDir) await rm(tempDir, { recursive: true, force: true })
    })

    it('imageMimeFromPath：常见扩展名映射，未知回退 png', () => {
      expect(imageMimeFromPath('a.PNG')).toBe('image/png')
      expect(imageMimeFromPath('a.jpg')).toBe('image/jpeg')
      expect(imageMimeFromPath('a.jpeg')).toBe('image/jpeg')
      expect(imageMimeFromPath('a.webp')).toBe('image/webp')
      expect(imageMimeFromPath('a.gif')).toBe('image/gif')
      expect(imageMimeFromPath('a.bmp')).toBe('image/bmp')
      expect(imageMimeFromPath('a.heic')).toBe('image/png')
    })

    it('resolveImageReference：http(s) 与 data URL 原样返回', async () => {
      expect(await resolveImageReference('https://img.example.com/a.png')).toBe('https://img.example.com/a.png')
      expect(await resolveImageReference('http://img.example.com/a.png')).toBe('http://img.example.com/a.png')
      expect(await resolveImageReference('data:image/jpeg;base64,QUJD')).toBe('data:image/jpeg;base64,QUJD')
    })

    it('resolveImageReference：本地文件读取并编码为 data URL，MIME 按扩展名', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-'))
      const file = join(tempDir, 'first.png')
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      await writeFile(file, bytes)
      expect(await resolveImageReference(file)).toBe(`data:image/png;base64,${bytes.toString('base64')}`)
    })

    it('resolveImageReference：不存在的本地路径响亮抛出 fs 错误', async () => {
      await expect(() => resolveImageReference('/nonexistent/dir/first.png')).rejects.toThrow()
    })

    it('compressVideoFirstFrame：小图 / URL 原样返回，大图经 ffmpeg 压成 JPEG', async () => {
      // 小 data URL：低于阈值直接返回
      const small = 'data:image/png;base64,QUJD'
      expect(await compressVideoFirstFrame(small)).toBe(small)
      // URL 形态不处理
      expect(await compressVideoFirstFrame('https://img.example.com/big.png')).toBe('https://img.example.com/big.png')
      // 大 data URL：有 ffmpeg 的环境压成更小的 JPEG；无 ffmpeg 时原样返回（不阻塞提交）
      const big = Buffer.alloc(2_000_000, 7)
      const bigRef = `data:image/png;base64,${big.toString('base64')}`
      const out = await compressVideoFirstFrame(bigRef)
      expect(out.startsWith('data:image/')).toBe(true)
      if (out !== bigRef) {
        expect(out.startsWith('data:image/jpeg;base64,')).toBe(true)
        expect(out.length).toBeLessThan(bigRef.length)
      }
    })

    it('resolveVideoMedia：数组每个条目解析为文档要求的 type/url', async () => {
      const ms = [
        { image: 'data:image/png;base64,QUJD', position: '0s' },
        { image: 'data:image/png;base64,U1lM', position: '1s' },
        { image: 'data:image/png;base64,SEVMTE8=', position: '2s' },
      ]
      const out = await resolveVideoMedia(ms)
      expect(out).toHaveLength(3)
      expect(out[0]).toEqual({ url: 'data:image/png;base64,QUJD', type: 'first_frame' })
      expect(out[1].type).toBe('reference_image')
      expect(out[2].type).toBe('reference_image')
      expect(out[0].url.startsWith('data:image/')).toBe(true)
    })

    it('videoMimeFromPath：mp4 为默认，webm/mov 按扩展名', () => {
      expect(videoMimeFromPath('a.mp4')).toBe('video/mp4')
      expect(videoMimeFromPath('a.MP4')).toBe('video/mp4')
      expect(videoMimeFromPath('a.webm')).toBe('video/webm')
      expect(videoMimeFromPath('a.mov')).toBe('video/quicktime')
      expect(videoMimeFromPath('a.unknown')).toBe('video/mp4')
    })

    it('resolveReferenceVideo：http(s) 与 data URL 原样返回', async () => {
      const url = 'https://cdn.example.com/clip.mp4'
      expect(await resolveReferenceVideo(url)).toBe(url)
      expect(await resolveReferenceVideo('data:video/mp4;base64,QUJD')).toBe('data:video/mp4;base64,QUJD')
    })

    it('resolveReferenceVideo：本地小视频编码为 data URL，MIME 按扩展名', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-'))
      const file = join(tempDir, 'clip.webm')
      const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
      await writeFile(file, bytes)
      // 低于压缩阈值：原样编码，不做 ffmpeg 转码
      expect(await resolveReferenceVideo(file)).toBe(`data:video/webm;base64,${bytes.toString('base64')}`)
    })

    it('resolveReferenceVideo：超过体积上限时响亮报错，不提交巨型请求体', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-'))
      const file = join(tempDir, 'huge.mp4')
      // 6.5MB 垃圾字节：超过压缩阈值（触发 ffmpeg，对垃圾数据必然失败并回退原字节）
      // 且超过 6MB 上限，必须抛错而不是拼出 ~8.7MB 的 data URL
      await writeFile(file, Buffer.alloc(6_500_000, 0x11))
      await expect(() => resolveReferenceVideo(file)).rejects.toThrow(/超过.*上限/)
    })

    it('resolveVideoMedia：video 条目映射为 reference_video，显式 type 优先', async () => {
      const out = await resolveVideoMedia([
        { video: 'https://cdn.example.com/source.mp4' },
        { video: 'https://cdn.example.com/source.mp4', type: 'reference_video' },
        { image: 'data:image/png;base64,QUJD', type: 'reference_image' },
      ])
      expect(out[0]).toEqual({ url: 'https://cdn.example.com/source.mp4', type: 'reference_video' })
      expect(out[1].type).toBe('reference_video')
      expect(out[2]).toEqual({ url: 'data:image/png;base64,QUJD', type: 'reference_image' })
    })

    it('resolveVideoMedia：条目既无 image 也无 video 时报错', async () => {
      await expect(() => resolveVideoMedia([{ position: '0s' }])).rejects.toThrow(/image.*video/)
    })
  })
})
