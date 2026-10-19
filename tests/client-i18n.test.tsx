// @vitest-environment jsdom
/**
 * B9 i18n 完整性：zh / en 的 key 集合必须一致（缺键测试），且每条文案都是非空字符串。
 *
 * 类型层面 `en` / `zh` 都是 `Record<WorkbenchLocaleKey, string>`，缺键会编译失败；
 * 这里再做一次运行时校验，作为回归护栏。
 */
import { describe, expect, it } from 'vitest'
import { en, zh, type WorkbenchLocaleKey } from '../src/client/locales.ts'

const ENF = en as Record<WorkbenchLocaleKey, string>
const ZHF = zh as Record<WorkbenchLocaleKey, string>

describe('B9 i18n completeness', () => {
  it('zh and en expose the same set of locale keys', () => {
    const keysEn = Object.keys(ENF).sort()
    const keysZh = Object.keys(ZHF).sort()
    expect(keysZh).toEqual(keysEn)
  })

  it('every key maps to a non-empty string in both locales', () => {
    for (const key of Object.keys(ENF) as WorkbenchLocaleKey[]) {
      expect(typeof ENF[key]).toBe('string')
      expect(ENF[key].length).toBeGreaterThan(0)
      expect(typeof ZHF[key]).toBe('string')
      expect(ZHF[key].length).toBeGreaterThan(0)
    }
  })
})
