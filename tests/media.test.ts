import { describe, it, expect } from 'vitest'
import { extFromContentType, toImageMediaTypeForTest } from '../src/media.ts'

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
})
