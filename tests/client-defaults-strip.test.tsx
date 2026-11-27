// @vitest-environment jsdom
/**
 * 「当前生效参数」条的排版契约：
 * 标题独立成块、参数按图像/视频分组、编辑与模型详情作为同一组入口靠右。
 * 只断言结构（jsdom 没有布局），视觉层级由 scripts/defaults-strip-preview.mjs 截图核对。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('生效参数条 · 排版结构', () => {
  it('标题与参数分开，参数按模态分组，两个入口同组', async () => {
    const host = fakeApi({
      defaults: {
        mediaMode: null, imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: 'photo',
        videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 5,
      },
      defaultsSources: {
        imageProvider: 'none', imageSize: 'settings', imageStyle: 'none',
        videoProvider: 'none', videoAspectRatio: 'none', videoDuration: 'settings',
      },
      defaultsBuiltin: {
        imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: 'photo',
        videoProvider: 'threevideo', videoAspectRatio: '9:16', videoDuration: 10,
      },
    })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    const strip = await waitFor(() => {
      const element = view.container.querySelector('[data-workbench-defaults]')
      if (element === null) throw new Error('defaults strip not rendered')
      return element as HTMLElement
    })

    const head = strip.querySelector('.iv-defaults-head') as HTMLElement
    const body = strip.querySelector('.iv-defaults-body') as HTMLElement
    const actions = strip.querySelector('.iv-defaults-actions') as HTMLElement
    expect(head?.textContent).toContain(en.defaultsTitle)
    expect(body).toBeTruthy()
    expect(actions).toBeTruthy()

    const groups = [...body.querySelectorAll('[data-defaults-group]')]
      .map(element => element.getAttribute('data-defaults-group'))
    expect(groups.slice(0, 2)).toEqual(['defaultsGroupImage', 'defaultsGroupVideo'])
    expect(body.querySelectorAll('[data-workbench-default]')).toHaveLength(6)
    expect(body.querySelector('[data-defaults-group="defaultsGroupImage"] [data-workbench-default]')).toBeTruthy()
    expect(body.querySelector('[data-defaults-group="defaultsGroupVideo"] [data-workbench-default]')).toBeTruthy()

    // 两个入口互相相邻、都不在参数区里；模型详情仍保留 marginLeft:auto 的既有契约
    expect(actions.contains(strip.querySelector('[data-workbench-defaults-edit]'))).toBe(true)
    const toggle = strip.querySelector('[data-model-details-toggle]') as HTMLButtonElement
    expect(actions.contains(toggle)).toBe(true)
    expect(toggle.style.marginLeft).toBe('auto')
    expect(body.contains(toggle)).toBe(false)

    // 来源徽章只在"来源改变了值"时出现：尺寸 1:1 与兜底同值不标，时长 5s ≠ 兜底 10s 才标
    const badges = [...strip.querySelectorAll('[data-default-source-label]')]
    expect(badges).toHaveLength(1)
    expect(badges[0].getAttribute('data-default-source-label')).toBe('settings')
  })
})
