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
  })

  describe('createVideoContent', () => {
    it('可见文本含服务商、实际模型、模式与透明告知（含时长被丢弃说明）', () => {
      const blocks = createVideoContent(
        '/ws/outputs/v.mp4',
        754_500,
        'https://cdn.example.com/v.mp4',
        {
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
  })
})
