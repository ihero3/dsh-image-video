// @vitest-environment jsdom
/**
 * M3：双技能库管理页与分段的导演 Skill 选择器。
 *
 * 覆盖：导演库启用项进入选择器、禁用后从选择器移除、禁用项回显、
 * 逆向库标签页切换、导入本地技能、删除用户技能。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { EpisodeRecord, SegmentRecord } from '../src/workbench/episodes.ts'
import type { SkillRecord } from '../src/workbench/skills.ts'

afterEach(cleanup)

const STAMP = '2026-11-09T00:00:00.000Z'

function project(): Record<string, unknown> {
  return { schemaVersion: 1, id: 'prj-1', name: '测试剧', createdAt: STAMP, updatedAt: STAMP }
}

function segment(extra: Partial<SegmentRecord> = {}): SegmentRecord {
  return { schemaVersion: 1, id: 'seg-1', episodeId: 'ep-1', order: 1, durationSec: 5, promptText: '开场', refs: [], ...extra }
}

function episode(extra: Partial<EpisodeRecord> = {}): EpisodeRecord {
  return {
    schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
    script: { text: '', updatedAt: STAMP }, segments: [segment()], storyboards: [],
    resourceRefs: [], assetRefs: [], createdAt: STAMP, updatedAt: STAMP, ...extra,
  }
}

function skill(id: string, kind: SkillRecord['kind'], extra: Partial<SkillRecord> = {}): SkillRecord {
  return {
    schemaVersion: 1, id, kind, name: id, description: '', prompt: `${id} prompt`,
    builtin: false, enabled: true, createdAt: STAMP, updatedAt: STAMP, ...extra,
  }
}

describe('双技能库', () => {
  it('lists enabled director skills in the segment selector and drops disabled ones', async () => {
    const host = fakeApi({
      episodes: [episode()],
      skills: [
        skill('dir-a', 'director', { name: '电影感技能', builtin: true }),
        skill('dir-off', 'director', { name: '停用技能', enabled: false }),
        skill('rev-a', 'reverse', { name: '逆向技能' }),
      ],
    })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-segment-skill="seg-1"]')).toBeTruthy() })
    const select = view.container.querySelector('[data-segment-skill="seg-1"]') as HTMLSelectElement
    const values = [...select.options].map(option => option.value)
    expect(values).toContain('')
    expect(values).toContain('dir-a')
    expect(values).not.toContain('dir-off')
    expect(values).not.toContain('rev-a')

    // 在技能管理页禁用内置导演技能 → 选择器同步移除。
    await waitFor(() => { expect(view.container.querySelector('[data-skill-item="dir-a"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-skill-toggle="dir-a"]') as HTMLElement)
    await waitFor(() => {
      const current = view.container.querySelector('[data-segment-skill="seg-1"]') as HTMLSelectElement
      expect([...current.options].map(option => option.value)).not.toContain('dir-a')
    })
  })

  it('shows a disabled chip when the selected skill is no longer enabled', async () => {
    const host = fakeApi({
      episodes: [episode({ segments: [segment({ skillId: 'dir-off' })] })],
      skills: [skill('dir-off', 'director', { name: '停用技能', enabled: false })],
    })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-segment-skill="seg-1"]')).toBeTruthy() })
    const select = view.container.querySelector('[data-segment-skill="seg-1"]') as HTMLSelectElement
    expect(select.value).toBe('dir-off')
    expect(select.selectedOptions[0]?.textContent).toContain('Disabled skill')
  })

  it('switches libraries, imports a local skill and removes a user skill', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const host = fakeApi({
      episodes: [episode()],
      skills: [skill('dir-a', 'director', { name: '内置导演', builtin: true }), skill('rev-a', 'reverse', { name: '逆向技能' })],
    })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-skill-kind-tab="reverse"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-skill-kind-tab="reverse"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-skill-item="rev-a"]')).toBeTruthy()
      expect(view.container.querySelector('[data-skill-item="dir-a"]')).toBeNull()
    })

    const input = view.container.querySelector('[data-skill-import-source="true"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '/tmp/my-skill' } })
    fireEvent.click(view.container.querySelector('[data-skill-import="true"]') as HTMLElement)
    await waitFor(() => { expect(host.skills.some(item => item.kind === 'reverse' && item.source === '/tmp/my-skill')).toBe(true) })

    const imported = host.skills.find(item => item.source === '/tmp/my-skill')!
    fireEvent.click(view.container.querySelector(`[data-skill-remove="${imported.id}"]`) as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector(`[data-skill-item="${imported.id}"]`)).toBeNull() })
    confirm.mockRestore()
  })
})
