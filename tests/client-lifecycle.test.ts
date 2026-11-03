/**
 * Browser-half lifecycle contract: what `apply` registers with the right pane,
 * under which identity, and that teardown lifts every registration.
 *
 * The context is a minimal stand-in for cordis — it runs each `effect` callback
 * immediately and keeps the disposer, exactly as the real fiber does — so the
 * assertions are about this plugin's registrations, not about the framework.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { apply, inject, WORKBENCH_LOCALE_NS, WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND } from '../src/client/plugin.ts'
import { NS as CHUNK_NS } from '../src/client/locale-ns.ts'
import type { WorkbenchInjected } from '../src/client/Workbench.tsx'
import { WorkbenchSeat } from '../src/client/WorkbenchSeat.tsx'
import { NS } from '../src/client/locales.ts'
import { CHROME_NS, chromeEn, chromeZh } from '../src/client/chrome-locales.ts'

/** One registered tab definition, narrowed to the fields this test asserts. */
interface TabDefinition {
  id: string
  kind: string
  title: (address: string) => string
  guide: readonly { id: string; order: number; title: () => string; description?: () => string }[]
}

/** One registered seat, narrowed to the options this test asserts. */
interface SeatOptions {
  name: string
  key: string
  locale: string
  inject: () => unknown
}

function stubContext() {
  const disposers: Array<() => void> = []
  const unregisterTab = vi.fn()
  const unregisterSeat = vi.fn()
  const unregisterLocale = vi.fn()
  let tabDefinition: TabDefinition | undefined
  let seatOptions: SeatOptions | undefined
  let seatComponent: unknown
  const localeRegister = vi.fn(() => unregisterLocale)
  const registerTab = vi.fn((definition: TabDefinition) => { tabDefinition = definition; return unregisterTab })
  const registerSeat = vi.fn((options: SeatOptions, component: unknown) => {
    seatOptions = options
    seatComponent = component
    return unregisterSeat
  })
  // `slots.inject` 在真实框架里把注册挂到调用方 fiber 上，卸载即撤销；stub 照此
  // 把返回的 disposer 收进同一个清理列表。
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
    // 座位注入面在注册时会构造客户端 API，需要 connection 可用
    get: (name: string) => (name === 'connection'
      ? { rpc: { call: async () => ({ ok: true as const, value: {} }) } }
      : undefined),
    sidebarRightTabs: { register: registerTab },
    slots: { inject: slotsInject, register: registerSeat },
  }
  return {
    ctx: ctx as unknown as ClientContext,
    disposers, localeRegister, registerTab, registerSeat, slotsInject,
    unregisterLocale, unregisterTab, unregisterSeat,
    definition: () => tabDefinition,
    seat: () => seatOptions,
    component: () => seatComponent,
  }
}

describe('workbench browser half', () => {
  it('declares its services and registers the tab under its own kind and id', () => {
    const stub = stubContext()
    apply(stub.ctx)

    expect(inject).toEqual(['slots', 'locale', 'sidebarRightTabs', 'connection'])
    // N5：入口只注册 2 条壳文案；界面字典由 chunk 加载后交回来注册
    expect(stub.localeRegister).toHaveBeenCalledWith(CHROME_NS, { zh: chromeZh, en: chromeEn })
    // 入口用字面量、chunk 用 locale-ns.ts：两处必须一致（共享模块会被切成 chunk，不能共享）
    expect(WORKBENCH_LOCALE_NS).toBe(CHUNK_NS)

    expect(stub.registerTab).toHaveBeenCalledOnce()
    const definition = stub.definition()!
    expect(definition.id).toBe(WORKBENCH_TAB_ID)
    expect(definition.kind).toBe(WORKBENCH_TAB_KIND)
    // 自有 kind：不得与既有 builtin 的 kind 撞名（撞名会静默截获它的座位）
    expect(definition.kind).not.toBe('files')
    expect(definition.kind).not.toBe('terminal')
    expect(definition.title('')).toBe('t:tabTitle')
    expect(definition.guide.map(entry => entry.id)).toEqual(['open-workbench'])
    expect(definition.guide[0]!.title()).toBe('t:tabTitle')
    expect(definition.guide[0]!.description?.()).toBe('t:guideDescription')

    expect(stub.slotsInject).toHaveBeenCalledWith('sidebar.right.pane.tab', expect.any(Function))
    const seat = stub.seat()!
    expect(seat.name).toBe('sidebar.right.pane.tab')
    // 座位 key 必须是定义自己的 id —— 右栏按定义 id 派发 body
    expect(seat.key).toBe(WORKBENCH_TAB_ID)
    expect(seat.locale).toBe(NS)
    // 注入面：kind 是注册身份，health 是宿主通道的取数入口（惰性，不在注册时调用）
    const face = seat.inject() as WorkbenchInjected
    expect(face.kind).toBe(WORKBENCH_TAB_KIND)
    // 字典注册口：chunk 交回完整字典 → 注册到界面 ns，且重复调用幂等
    expect(typeof face.registerDictionaries).toBe('function')
    face.registerDictionaries?.({ zh: { tabTitle: 'z' }, en: { tabTitle: 'e' } })
    face.registerDictionaries?.({ zh: { tabTitle: 'z' }, en: { tabTitle: 'e' } })
    expect(stub.localeRegister.mock.calls.filter(call => call[0] === NS)).toHaveLength(1)
    expect(typeof face.api.health).toBe('function')
    expect(typeof face.api.createProject).toBe('function')
    // A-6 修订后注册的是「座位薄壳」：真正的 Workbench 在包内 chunk 里，首次打开才加载
    expect(stub.component()).toBe(WorkbenchSeat)
  })

  it('lifts the dictionaries, the tab type and the seat on teardown', () => {
    const stub = stubContext()
    apply(stub.ctx)
    // 四处：入口壳字典、界面字典的清理口（N5）、tab 类型、座位
    expect(stub.disposers).toHaveLength(4)
    for (const dispose of stub.disposers) dispose()
    expect(stub.unregisterLocale).toHaveBeenCalledOnce()
    expect(stub.unregisterTab).toHaveBeenCalledOnce()
    expect(stub.unregisterSeat).toHaveBeenCalledOnce()
  })
})
