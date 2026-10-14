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
import { apply, inject, WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND } from '../src/client/plugin.ts'
import { Workbench } from '../src/client/Workbench.tsx'
import { en, NS, zh } from '../src/client/locales.ts'

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

    expect(inject).toEqual(['slots', 'locale', 'sidebarRightTabs'])
    expect(stub.localeRegister).toHaveBeenCalledWith(NS, { zh, en })

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
    expect(seat.inject()).toEqual({ kind: WORKBENCH_TAB_KIND })
    expect(stub.component()).toBe(Workbench)
  })

  it('lifts the dictionaries, the tab type and the seat on teardown', () => {
    const stub = stubContext()
    apply(stub.ctx)
    // 三处注册各留一个 disposer：字典、tab 类型、座位
    expect(stub.disposers).toHaveLength(3)
    for (const dispose of stub.disposers) dispose()
    expect(stub.unregisterLocale).toHaveBeenCalledOnce()
    expect(stub.unregisterTab).toHaveBeenCalledOnce()
    expect(stub.unregisterSeat).toHaveBeenCalledOnce()
  })
})
