// @vitest-environment jsdom
/**
 * `B-12` 生成结果卡片：缩略图、重新生成、用作参考图、加入时间轴。
 *
 * 断言的是**界面行为**：卡片把产物路径换成缩略图、把动作接到宿主端点，
 * 以及快速生成模式（时间轴尚未载入）下追加仍能落库。
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, fireEvent, render, screen, stubMediaPlayback, waitFor } from './client-fake-api.ts'
import type { TaskRecord } from '../src/workbench/records.ts'

// jsdom 不实现媒体播放；卡片缩略图挂载后调用 pause()/play()。
afterAll(stubMediaPlayback())
afterEach(cleanup)

/** 一条已完成任务；默认是视频产物。 */
function task(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    schemaVersion: 4, id, kind: 'video', status: 'succeeded',
    provider: 'seedance', model: 'seedance-1', prompt: '雨夜里的伞',
    outputPath: `/tmp/outputs/${id}.mp4`, bytes: 4096,
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  }
}

/** 一个项目 + 给定任务；项目会被自动选中，时间轴动作才可用。 */
function renderTasks(tasks: TaskRecord[]) {
  const host = fakeApi({ tasks })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '雨夜',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 等某张卡片渲染出来。 */
async function cardOf(view: ReturnType<typeof renderTasks>['view'], id: string): Promise<HTMLElement> {
  return await waitFor(() => {
    const found = view.container.querySelector(`[data-task-card="${id}"]`)
    expect(found).toBeTruthy()
    return found as HTMLElement
  })
}

describe('B-12 task card', () => {
  it('shows an image thumbnail plus the model / size / time summary', async () => {
    const { view } = renderTasks([task('tsk-1', {
      kind: 'image', outputPath: '/tmp/outputs/shot.png', model: 'seedream-4',
    })])

    const card = await cardOf(view, 'tsk-1')
    expect(card.querySelector('img.iv-thumb')?.getAttribute('src')).toBe('/outputs/shot.png')
    expect(card.textContent).toContain('seedream-4')
  })

  it('appends a video output to the current timeline', async () => {
    const { host, view } = renderTasks([task('tsk-1')])
    await cardOf(view, 'tsk-1')

    fireEvent.click(screen.getByRole('button', { name: en.addToTimeline }))

    await waitFor(() => { expect(host.timelines).toHaveLength(1) })
    const track = host.timelines[0]?.tracks.find(item => item.kind === 'video')
    expect(track?.clips.map(clip => clip.assetPath)).toEqual(['/tmp/outputs/tsk-1.mp4'])
  })

  it('seeds the quick-generate reference picker with an image output', async () => {
    const { view } = renderTasks([task('tsk-2', {
      kind: 'image', outputPath: '/tmp/outputs/face.png',
    })])
    await cardOf(view, 'tsk-2')

    fireEvent.click(screen.getByRole('button', { name: en.useAsReference }))

    await waitFor(() => {
      expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/face.png"]')).toBeTruthy()
    })
  })

  it('regenerates with the original prompt', async () => {
    const { host, view } = renderTasks([task('tsk-3', { kind: 'image', outputPath: '/tmp/outputs/shot.png' })])
    await cardOf(view, 'tsk-3')

    fireEvent.click(screen.getByRole('button', { name: en.regenerate }))

    await waitFor(() => {
      expect(host.assets.some(asset => asset.path === '/tmp/outputs/generated.png')).toBe(true)
    })
    expect(host.assets.find(asset => asset.path === '/tmp/outputs/generated.png')?.prompt).toBe('雨夜里的伞')
  })
})
