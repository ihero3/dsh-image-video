/**
 * Browser-half lifecycle contract：`apply` 向哪些插槽注册了什么身份，以及卸载是否全部撤销。
 *
 * 重做后的注册面是三处：
 *   1. `main`（keyed）——工作台主面板本体；
 *   2. `sidebar.panellist`——左栏入口；
 *   3. `sidebar.right.pane.tab`——**仅为兼容旧布局记录**保留的迁移页。
 *
 * 上下文是 cordis 的最小替身：`effect` 立即执行并记住 disposer，`slots.inject`
 * 把贡献者的返回值折进同一张清理表——所以断言的是本插件的注册，不是框架本身。
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import {
  apply, inject, LEGACY_TAB_ID, LEGACY_TAB_KIND, PANEL_ID,
  WORKBENCH_LOCALE_NS, WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND,
} from '../src/client/plugin.ts'
import { NS as CHUNK_NS } from '../src/client/locale-ns.ts'
import type { WorkbenchInjected } from '../src/client/Workbench.tsx'
import { WorkbenchSeat } from '../src/client/WorkbenchSeat.tsx'
import { RelocatedNotice } from '../src/client/RelocatedNotice.tsx'
import { WorkbenchPanelIcon } from '../src/client/WorkbenchPanelIcon.tsx'
import { NS } from '../src/client/locales.ts'
import { CHROME_NS, chromeEn, chromeZh } from '../src/client/chrome-locales.ts'

/** 注册到 `main` 的那个面板，收窄到本测试要断言的字段。 */
interface MainSeatOptions {
  name: string
  key: string
  locale: string
  inject: () => unknown
}

/** 注册到 `sidebar.panellist` 的入口行。 */
interface PanelEntryOptions {
  name: string
  id: string
  order: number
  label: () => string
  locale: string
}

/** 旧 tab 的类型定义。 */
interface TabDefinition { id: string; kind: string; title: () => string }

function stubContext({ withRightTabs = true }: { withRightTabs?: boolean } = {}) {
  const disposers: Array<() => void> = []
  const unregisterTab = vi.fn()
  const unregisterLocale = vi.fn()
  const unregisterSeat = vi.fn()
  let tabDefinition: TabDefinition | undefined
  let mainSeat: MainSeatOptions | undefined
  let panelEntry: PanelEntryOptions | undefined
  const components = new Map<string, unknown>()
  const localeRegister = vi.fn(() => unregisterLocale)
  const registerTab = vi.fn((definition: TabDefinition) => { tabDefinition = definition; return unregisterTab })
  const registerSeat = vi.fn((options: { name: string } & Record<string, unknown>, component: unknown) => {
    if (options.name === 'main') mainSeat = options as unknown as MainSeatOptions
    if (options.name === 'sidebar.panellist') panelEntry = options as unknown as PanelEntryOptions
    components.set(options.name, component)
    return unregisterSeat
  })
  const slotsInject = vi.fn((_name: string, contribute: () => unknown) => {
    const dispose = contribute()
    if (typeof dispose === 'function') disposers.push(dispose as () => void)
  })
  const ctx = {
    effect: (callback: () => unknown) => {
      const dispose = callback()
      if (typeof dispose === 'function') disposers.push(dispose as () => void)
    },
    locale: { register: localeRegister, bind: () => (key: string) => `t:${key}` },
    // 座位注入面在注册时会构造客户端 API；迁移页的 layout 是懒取的，给 undefined 即可
    get: (name: string) => (name === 'connection'
      ? { rpc: { call: async () => ({ ok: true as const, value: {} }) } }
      : name === 'sidebarRightTabs' && withRightTabs ? { register: registerTab } : undefined),
    slots: { inject: slotsInject, register: registerSeat },
  }
  return {
    ctx: ctx as unknown as ClientContext,
    disposers, localeRegister, registerTab, registerSeat, slotsInject,
    unregisterLocale, unregisterTab, unregisterSeat,
    definition: () => tabDefinition,
    mainSeat: () => mainSeat,
    panelEntry: () => panelEntry,
    componentFor: (name: string) => components.get(name),
  }
}

describe('workbench browser half', () => {
  it('registers the workbench as a main panel and a sidebar entry', () => {
    const stub = stubContext()
    apply(stub.ctx)

    expect(inject).toEqual(['slots', 'locale', 'connection'])
    // N5：入口只注册壳文案；界面字典由 chunk 加载后交回来注册
    expect(stub.localeRegister).toHaveBeenCalledWith(CHROME_NS, { zh: chromeZh, en: chromeEn })
    // 入口用字面量、chunk 用 locale-ns.ts：两处必须一致（共享模块会被切成 chunk，不能共享）
    expect(WORKBENCH_LOCALE_NS).toBe(CHUNK_NS)

    // ① 主面板：key 必须是品牌化面板 id，locale 是界面 ns
    expect(stub.slotsInject).toHaveBeenCalledWith('main', expect.any(Function))
    const main = stub.mainSeat()!
    expect(main.name).toBe('main')
    expect(main.key).toBe(PANEL_ID)
    expect(PANEL_ID).toBe('dsh-image-video')
    expect(main.locale).toBe(NS)
    expect(stub.componentFor('main')).toBe(WorkbenchSeat)

    // ② 左栏入口：紧跟「自动化任务」（order 10）之后
    expect(stub.slotsInject).toHaveBeenCalledWith('sidebar.panellist', expect.any(Function))
    const entry = stub.panelEntry()!
    expect(entry.name).toBe('sidebar.panellist')
    expect(entry.id).toBe(PANEL_ID)
    expect(entry.order).toBe(20)
    expect(entry.label()).toBe('t:panelLabel')
    expect(stub.componentFor('sidebar.panellist')).toBe(WorkbenchPanelIcon)

    // 注入面：kind 是注册身份，api 是宿主通道，字典注册口幂等
    const face = stub.mainSeat()!.inject() as WorkbenchInjected
    expect(face.kind).toBe(LEGACY_TAB_KIND)
    expect(typeof face.registerDictionaries).toBe('function')
    face.registerDictionaries?.({ zh: { tabTitle: 'z' }, en: { tabTitle: 'e' } })
    face.registerDictionaries?.({ zh: { tabTitle: 'z' }, en: { tabTitle: 'e' } })
    expect(stub.localeRegister.mock.calls.filter(call => call[0] === NS)).toHaveLength(1)
    // 面板每次重新挂载都会再交一次小字典：重复注册会让 `ctx.locale.register` 抛错（白屏），必须按 ns 去重
    expect(typeof face.registerExtraLocale).toBe('function')
    face.registerExtraLocale?.('image-video-guide', { zh: { a: 'z' }, en: { a: 'e' } })
    face.registerExtraLocale?.('image-video-guide', { zh: { a: 'z' }, en: { a: 'e' } })
    expect(stub.localeRegister.mock.calls.filter(call => call[0] === 'image-video-guide')).toHaveLength(1)
    expect(typeof face.api.health).toBe('function')
    expect(typeof face.api.createProject).toBe('function')
  })

  it('keeps the legacy right-pane tab as a migration page', () => {
    const stub = stubContext()
    apply(stub.ctx)

    // 旧布局记录里存的是 kind；类型必须仍然注册，否则那个 tab 会渲染成陌生 kind
    expect(stub.registerTab).toHaveBeenCalledOnce()
    const definition = stub.definition()!
    expect(definition.id).toBe(LEGACY_TAB_ID)
    expect(definition.kind).toBe(LEGACY_TAB_KIND)
    expect(definition.kind).not.toBe('files')
    expect(definition.kind).not.toBe('terminal')
    expect(definition.title()).toBe('t:tabTitle')
    // 旧名仍可用（bundle 对账用）
    expect(WORKBENCH_TAB_ID).toBe(LEGACY_TAB_ID)
    expect(WORKBENCH_TAB_KIND).toBe(LEGACY_TAB_KIND)

    // body 换成迁移页，绝不挂第二份工作台
    expect(stub.componentFor('sidebar.right.pane.tab')).toBe(RelocatedNotice)
    const seat = stub.slotsInject.mock.calls.find(call => call[0] === 'sidebar.right.pane.tab')
    expect(seat).toBeTruthy()
  })

  it('keeps the sidebar entry when the right-pane service is absent', () => {
    const stub = stubContext({ withRightTabs: false })
    // 旧右栏注册表缺失不能让整条 fiber 等死：apply 不抛错，左栏入口与主面板照常注册
    expect(() => apply(stub.ctx)).not.toThrow()
    expect(stub.registerTab).not.toHaveBeenCalled()
    expect(stub.panelEntry()?.id).toBe(PANEL_ID)
    expect(stub.componentFor('main')).toBe(WorkbenchSeat)
  })

  it('lifts every registration on teardown', () => {
    const stub = stubContext()
    apply(stub.ctx)
    // 七处：壳字典、界面字典清理口、小字典清理口、主面板、左栏入口、旧 tab 类型、迁移页
    expect(stub.disposers).toHaveLength(7)
    for (const dispose of stub.disposers) dispose()
    expect(stub.unregisterLocale).toHaveBeenCalledOnce()
    expect(stub.unregisterTab).toHaveBeenCalledOnce()
    expect(stub.unregisterSeat).toHaveBeenCalledTimes(3)
  })
})
