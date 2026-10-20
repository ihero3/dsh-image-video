/**
 * 工具动作漂移检查（Track A / A69）。
 *
 * 背景：工具描述里只列了少部分动作，导致模型**不知道** `set-format`/`split-clip`/`render-retry`
 * 等能力存在——这些能力等于白做。这条测试把「代码分支 ↔ 允许清单 ↔ 描述」三者钉在一起：
 * 以后新增动作却忘了更新清单/描述，立刻红。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = join(import.meta.dirname, '..', 'src', 'tools', 'workbench.ts')
const TOOLS = ['workbench_projects', 'workbench_assets', 'workbench_timeline', 'workbench_workflow', 'workbench_tasks'] as const

describe('tool actions stay in sync (A69)', () => {
  it('every branch, allowed list and description agree', async () => {
    const source = await readFile(SOURCE, 'utf8')
    // 按工具名切段（每段到下一个工具名为止）
    const positions = TOOLS.map(name => source.indexOf(`name: '${name}'`))
    expect(positions.every(index => index >= 0)).toBe(true)
    const segments = TOOLS.map((name, index) => ({
      name,
      text: source.slice(positions[index]!, index + 1 < TOOLS.length ? positions[index + 1]! : source.length),
    }))

    for (const { name, text } of segments) {
      // 代码里实际处理的动作
      const branches = new Set([...text.matchAll(/action === '([a-z-]+)'/g)].map(match => match[1]!))
      // 允许清单
      const allowed = /unknownAction\('[^']+', action, \[([^\]]*)\]\)/.exec(text)
      expect(allowed, `${name} 缺少 unknownAction 清单`).not.toBeNull()
      const listed = new Set([...allowed![1]!.matchAll(/'([a-z-]+)'/g)].map(match => match[1]!))
      expect([...listed].sort(), `${name} 的允许清单与代码分支不一致`).toEqual([...branches].sort())
      // 描述里必须提到每个动作
      const description = new RegExp(`name: '${name}',\\s*\\n\\s*description:[\\s\\S]*?parameters:`).exec(text)?.[0] ?? ''
      for (const action of branches) {
        expect(description, `${name} 的描述没提到动作 ${action}`).toContain(action)
      }
    }
  })
})
