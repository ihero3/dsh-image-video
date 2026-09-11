import { describe, it, expect } from 'vitest'
import { GenerationError, classifyErrorForTest, isModelNotAcceptedError } from '../src/http-client.ts'

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

describe('isModelNotAcceptedError（候选回退判定）', () => {
  it('模型不存在类 task 错误 → true', () => {
    const notFound = classifyErrorForTest(400, { error: { message: 'model foo-bar not found' } }, '/x')
    expect(isModelNotAcceptedError(notFound)).toBe(true)
    const unknown = new GenerationError('task', '任务报错：unknown model baz', false, 400)
    expect(isModelNotAcceptedError(unknown)).toBe(true)
    const chinese = new GenerationError('task', '模型不存在', false, 404)
    expect(isModelNotAcceptedError(chinese)).toBe(true)
  })

  it('参数级 400（如 duration 档位问题）→ false，不触发换家', () => {
    // threerouter 实测的时长拒绝报错：含 "invalid params" 与 "model"，但语义是参数不支持
    const duration = classifyErrorForTest(400, {
      error: { message: 'invalid params, model MiniMax-H3 does not support duration 1s, supported durations: 4s...' },
    }, '/x')
    expect(isModelNotAcceptedError(duration)).toBe(false)
  })

  it('鉴权 / 配额 / 网络 / 超时错误 → false（响亮失败，不回退）', () => {
    expect(isModelNotAcceptedError(classifyErrorForTest(401, { message: 'bad key' }, '/x'))).toBe(false)
    expect(isModelNotAcceptedError(classifyErrorForTest(429, { message: 'rate limit' }, '/x'))).toBe(false)
    expect(isModelNotAcceptedError(classifyErrorForTest(500, { message: 'boom' }, '/x'))).toBe(false)
    expect(isModelNotAcceptedError(new GenerationError('timeout', '请求超时', true))).toBe(false)
  })

  it('threerouter「无可用渠道」503 capacity_error → true（2026-09 实测：未知模型返回此形态）', () => {
    const noChannel = classifyErrorForTest(503, {
      error: { message: 'No available media generation channels', type: 'capacity_error' },
    }, '/x')
    expect(noChannel.kind).toBe('network')
    expect(isModelNotAcceptedError(noChannel)).toBe(true)
    // 泛化 503（无 capacity_error 语义）仍不回退
    const generic = classifyErrorForTest(503, { message: 'service unavailable' }, '/x')
    expect(isModelNotAcceptedError(generic)).toBe(false)
  })

  it('能力缺失类（如「不支持图片生成」）→ true', () => {
    const unsupported = new GenerationError('task', 'MiniMax 不支持图片生成', false)
    expect(isModelNotAcceptedError(unsupported)).toBe(true)
  })

  it('非 GenerationError → false', () => {
    expect(isModelNotAcceptedError(new Error('plain error'))).toBe(false)
    expect(isModelNotAcceptedError('string error')).toBe(false)
  })
})
