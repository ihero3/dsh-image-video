import { describe, it, expect } from 'vitest'
import { GenerationError, classifyErrorForTest } from '../src/http-client.ts'

describe('GenerationError 异常分类', () => {
  it('401 → auth, 不可重试', () => {
    const e = classifyErrorForTest(401, { message: 'Invalid key' }, '/x')
    expect(e.kind).toBe('auth')
    expect(e.retryable).toBe(false)
    expect(e.status).toBe(401)
    expect(e.message).toContain('鉴权失败')
  })

  it('403 → auth, 不可重试', () => {
    const e = classifyErrorForTest(403, { error: { message: 'No perm' } }, '/x')
    expect(e.kind).toBe('auth')
    expect(e.retryable).toBe(false)
  })

  it('429 → quota, 不可重试', () => {
    const e = classifyErrorForTest(429, { error_message: 'rate limit' }, '/x')
    expect(e.kind).toBe('quota')
    expect(e.retryable).toBe(false)
    expect(e.message).toContain('配额耗尽')
  })

  it('500 / 502 / 503 → network, 可重试', () => {
    for (const s of [500, 502, 503]) {
      const e = classifyErrorForTest(s, { message: 'boom' }, '/x')
      expect(e.kind).toBe('network')
      expect(e.retryable).toBe(true)
      expect(e.status).toBe(s)
    }
  })

  it('400 / 404 / 422 → task, 不可重试', () => {
    for (const s of [400, 404, 422]) {
      const e = classifyErrorForTest(s, { message: 'bad' }, '/x')
      expect(e.kind).toBe('task')
      expect(e.retryable).toBe(false)
    }
  })

  it('提取 error_message / msg / code 字段', () => {
    const a = classifyErrorForTest(400, { error_message: 'bad param' }, '/x')
    expect(a.message).toContain('bad param')
    const b = classifyErrorForTest(400, { msg: 'invalid' }, '/x')
    expect(b.message).toContain('invalid')
    const c = classifyErrorForTest(400, { code: 'E_999' }, '/x')
    expect(c.message).toContain('错误码: E_999')
    const d = classifyErrorForTest(400, { error: { message: 'nested' } }, '/x')
    expect(d.message).toContain('nested')
    const e = classifyErrorForTest(400, { error: { code: 'X' } }, '/x')
    expect(e.message).toContain('错误码: X')
  })

  it('data 非 object 时不崩溃', () => {
    const e = classifyErrorForTest(500, null, '/x')
    expect(e.kind).toBe('network')
    const e2 = classifyErrorForTest(400, 'plain text', '/x')
    expect(e2.kind).toBe('task')
  })
})
