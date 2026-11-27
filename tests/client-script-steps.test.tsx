// @vitest-environment jsdom
/**
 * 剧本页步进条与主按钮权重（2026-11-27）。
 *
 * 背景：剧本页首屏原有三个**同级**实心主按钮（生成剧本 / 开始分段 / 规划分镜），
 * 用户看不出「下一步」是哪一个。改法是把三步的真实进度显式画出来，并且
 * **只让「下一步」对应的按钮是主色**，其余降为柔色。
 *
 * 这里锁的是三件事：
 * 1. 进度来自当前集真实数据（剧本 / 分段 / 分镜），不来自点击历史；
 * 2. 任意时刻最多只有一个实心主按钮，且就是下一步那个；
 * 3. 点步进条会把视口带到对应区块（jsdom 没有 scrollIntoView，靠桩验证目标 id）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { EpisodeRecord, SegmentRecord, ShotRecord, StoryboardRecord } from '../src/workbench/episodes.ts'

afterEach(cleanup)

const STAMP = '2026-11-27T00:00:00.000Z'

function segment(id: string, order: number): SegmentRecord {
  return { schemaVersion: 1, id, episodeId: 'ep-1', order, durationSec: 5, promptText: '开场', refs: [] }
}

function shot(id: string, order: number): ShotRecord {
  return { id, order, durationSec: 3, imagePrompt: `图 ${order}`, videoPrompt: `视 ${order}`, refs: [] }
}

/** 一集；用剧本 / 分段 / 分镜三个开关摆出四种进度。 */
function episode(options: {
  script?: string
  segments?: readonly SegmentRecord[]
  withStoryboard?: boolean
} = {}): EpisodeRecord {
  const segments = options.segments ?? []
  const storyboards: readonly StoryboardRecord[] = options.withStoryboard === true && segments[0] !== undefined
    ? [{ schemaVersion: 1, id: 'sb-1', episodeId: 'ep-1', segmentId: segments[0].id, shots: [shot('shot-1', 1)], updatedAt: STAMP }]
    : []
  return {
    schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
    script: { text: options.script ?? '', updatedAt: STAMP },
    segments, storyboards, resourceRefs: [], assetRefs: [], createdAt: STAMP, updatedAt: STAMP,
  }
}

/** 挂到剧本生成页的「剧本分镜」分区。 */
async function renderScript(record: EpisodeRecord) {
  const host = fakeApi({ episodes: [record] })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: STAMP, updatedAt: STAMP } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-script-steps]')).toBeTruthy() })
  return { host, view }
}

const q = (view: ReturnType<typeof render>, selector: string): HTMLElement | null =>
  view.container.querySelector(selector) as HTMLElement | null

/** 每个动作按钮当下的权重：实心（primary）还是柔色（soft）。 */
function weights(view: ReturnType<typeof render>): Record<string, string> {
  const read = (selector: string): string => {
    const button = q(view, selector)
    if (button === null) return 'missing'
    if (button.className.includes('iv-btn--action--primary')) return 'primary'
    if (button.className.includes('iv-btn--action--soft')) return 'soft'
    return 'plain'
  }
  return {
    script: read('[data-pipeline-script-generate]'),
    split: read('[data-segment-auto]'),
    plan: read('[data-segment-plan]'),
  }
}

describe('剧本页三步进度', () => {
  it('没有剧本时停在第一步：只有「生成剧本」是实心主按钮', async () => {
    const { view } = await renderScript(episode({}))

    expect(q(view, '[data-script-step="1"]')?.getAttribute('data-script-step-state')).toBe('now')
    expect(q(view, '[data-script-step="2"]')?.getAttribute('data-script-step-state')).toBe('todo')
    expect(q(view, '[data-script-step="3"]')?.getAttribute('data-script-step-state')).toBe('todo')
    // 当前步骤带「下一步」标签，其余没有
    expect(q(view, '[data-script-step="1"]')?.textContent).toContain(en.scriptStepNow)
    expect(q(view, '[data-script-step="2"]')?.textContent).not.toContain(en.scriptStepNow)

    expect(weights(view).script).toBe('primary')
    expect(weights(view).split).toBe('soft')
    expect(q(view, '[data-script-step-hint]')?.textContent).toBe(en.scriptStepHintScript)
  })

  it('已有剧本时把主按钮交给「开始分段」', async () => {
    const { view } = await renderScript(episode({ script: '雨夜街头，林夏撑伞走来。' }))

    expect(q(view, '[data-script-step="1"]')?.getAttribute('data-script-step-state')).toBe('done')
    expect(q(view, '[data-script-step="2"]')?.getAttribute('data-script-step-state')).toBe('now')

    expect(weights(view).script).toBe('soft')
    expect(weights(view).split).toBe('primary')
    expect(q(view, '[data-script-step-hint]')?.textContent).toBe(en.scriptStepHintSplit)
  })

  it('已有分段时把主按钮交给「规划分镜」，分段降为柔色', async () => {
    const { view } = await renderScript(episode({
      script: '雨夜街头，林夏撑伞走来。',
      segments: [segment('seg-1', 1)],
    }))

    expect(q(view, '[data-script-step="2"]')?.getAttribute('data-script-step-state')).toBe('done')
    expect(q(view, '[data-script-step="3"]')?.getAttribute('data-script-step-state')).toBe('now')

    expect(weights(view).split).toBe('soft')
    expect(weights(view).plan).toBe('primary')
    expect(q(view, '[data-script-step-hint]')?.textContent).toBe(en.scriptStepHintStoryboard)
  })

  it('三步都完成时不再有实心主按钮，并指向画布 / 时间轴', async () => {
    const { view } = await renderScript(episode({
      script: '雨夜街头，林夏撑伞走来。',
      segments: [segment('seg-1', 1)],
      withStoryboard: true,
    }))

    for (const step of ['1', '2', '3']) {
      expect(q(view, `[data-script-step="${step}"]`)?.getAttribute('data-script-step-state')).toBe('done')
    }
    expect(weights(view).script).toBe('soft')
    expect(weights(view).split).toBe('soft')
    expect(weights(view).plan).toBe('soft')
    expect(q(view, '[data-script-step-hint]')?.textContent).toBe(en.scriptStepAllDone)
  })

  it('有分段但剧本正文为空时不倒退，仍停在第三步', async () => {
    const { view } = await renderScript(episode({ segments: [segment('seg-1', 1)] }))

    expect(q(view, '[data-script-step="1"]')?.getAttribute('data-script-step-state')).toBe('done')
    expect(q(view, '[data-script-step="3"]')?.getAttribute('data-script-step-state')).toBe('now')
    expect(weights(view).plan).toBe('primary')
  })

  it('点步进条把视口带到对应区块', async () => {
    const visited: string[] = []
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: Element) { visited.push(this.id) },
    })
    try {
      const { view } = await renderScript(episode({
        script: '雨夜街头，林夏撑伞走来。',
        segments: [segment('seg-1', 1)],
      }))

      fireEvent.click(q(view, '[data-script-step="1"]') as HTMLElement)
      fireEvent.click(q(view, '[data-script-step="2"]') as HTMLElement)
      fireEvent.click(q(view, '[data-script-step="3"]') as HTMLElement)

      expect(visited).toEqual(['script-step-pipeline', 'script-step-segments', 'script-step-storyboard'])
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
    }
  })

  it('分镜区块还不存在时，第三步退回分段区块，不会点了没反应', async () => {
    const visited: string[] = []
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: Element) { visited.push(this.id) },
    })
    try {
      const { view } = await renderScript(episode({ script: '雨夜街头。' }))
      fireEvent.click(q(view, '[data-script-step="3"]') as HTMLElement)
      expect(visited).toEqual(['script-step-segments'])
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
    }
  })
})
