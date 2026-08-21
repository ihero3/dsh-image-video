import { describe, it, expect } from 'vitest'
import { extFromContentType, toImageMediaTypeForTest, createImageSummaryText } from '../src/media.ts'

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
  })
})
