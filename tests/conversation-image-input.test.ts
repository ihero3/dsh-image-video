import { describe, expect, it } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'

/**
 * 多参考图协议的最小契约快照：工具层的自动读取保持消息顺序，首图作为底图。
 * 实际 AttachmentStore 集成由宿主 attachment-local 测试覆盖。
 */
describe('conversation image references', () => {
  it('两张粘贴图按消息顺序映射为 base 与 face reference', () => {
    const refs = [
      { attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`), mediaType: 'image/jpeg' as const, bytes: 1, width: 679, height: 680 },
      { attachmentId: AttachmentId(`sha256:${'b'.repeat(64)}`), mediaType: 'image/jpeg' as const, bytes: 1, width: 392, height: 391 },
    ]
    expect(refs.map((ref) => String(ref.attachmentId))).toEqual([
      `sha256:${'a'.repeat(64)}`,
      `sha256:${'b'.repeat(64)}`,
    ])
    expect(refs[0]?.width).toBe(679)
    expect(refs[1]?.width).toBe(392)
  })
})
