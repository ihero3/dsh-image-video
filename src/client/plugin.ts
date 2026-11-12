/**
 * dsh-image-video workbench，浏览器半边：注册**主面板**、左栏入口，以及旧右栏 tab 的迁移页。
 *
 * 承载方式（2026-11 重做）：本插件不再是「右栏 tab」，而是和「插件」「自动化任务」一样的
 * **主面板**——点左栏入口后，宿主中间列整块归工作台所有（宿主右栏在主面板激活时本就不渲染，
 * 所以「右侧展示列」由面板内部自绘，见 Workbench 的 `.iv-dock-col`）。
 *
 * 三处注册：
 *   1. `main`（keyed，key = {@link PANEL_ID}）——工作台本体，界面 chunk 按需加载；
 *   2. `sidebar.panellist`——左栏那一行入口；
 *   3. `sidebar.right.pane.tab`——**只为兼容**：旧版本把工作台放在右栏，用户的布局记录里
 *      还留着 `kind: 'dsh-image-video-workbench'` 的 tab。这里保留该类型，body 换成
 *      「已迁移」提示页，点一下跳到主面板（不挂第二份工作台，避免两套轮询与两套写盘）。
 *
 * 入口只注册壳文案（入口名 / tab 标题 / 迁移页），完整界面字典随 chunk 加载后再注册（体积预算）。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the client connection merge (ctx.connection) and its handle type.
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale service merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the `main` keyed slot + `MainPanelId` brand this panel registers under.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the `sidebar.panellist` list slot this entry registers into.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the legacy right-pane tab type kept for migration.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: the slot declarations this file registers against.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { createWorkbenchApi } from './api.ts'
import type { WorkbenchInjected } from './Workbench.tsx'
import { WorkbenchSeat } from './WorkbenchSeat.tsx'
import { WorkbenchPanelIcon } from './WorkbenchPanelIcon.tsx'
import { RelocatedNotice } from './RelocatedNotice.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'
import { CHROME_NS, chromeEn, chromeZh, type ChromeLocaleKey } from './chrome-locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench copy. */
    'image-video-workbench': WorkbenchLocaleKey
    /** 入口壳文案（入口名 / tab 标题 / 迁移页）：必须在界面 chunk 之前就可读。 */
    'image-video-workbench-chrome': ChromeLocaleKey
  }
}

/** 主面板 id：左栏入口与 `main` 面板共用同一个品牌化 id。 */
export const PANEL_ID = 'dsh-image-video' as MainPanelId

/**
 * 旧版右栏 tab 的 id（= 当时 tab 类型的实现身份）。
 * 保留它是为了兼容已经存在的右栏布局记录：那些记录按 id 找 tab 类型与 body。
 */
export const LEGACY_TAB_ID = 'dsh-image-video'

/** 旧版 tab 的类型判别值（布局记录里存的是这个 kind）。 */
export const LEGACY_TAB_KIND = 'dsh-image-video-workbench'

/** 兼容旧名（`client-bundle.test.ts` 与既有文档仍按这两个名字对账）。 */
export const WORKBENCH_TAB_ID = LEGACY_TAB_ID
export const WORKBENCH_TAB_KIND = LEGACY_TAB_KIND

/**
 * 界面 locale namespace。入口**不 import** `locale-ns.ts`：任何被入口与 chunk 同时引用的模块
 * 都会被切成共享 chunk（`client.locale-ns.js`），入口反而多一次 require，断言也变复杂。
 * 这里写字面量，值必须与 `locale-ns.ts` 一致（`client-lifecycle.test.ts` 钉住两者相等）。
 */
const NS = 'image-video-workbench' as const

/** 供测试钉住"入口字面量 == chunk 侧常量"（入口与 chunk 不能共享模块）。 */
export const WORKBENCH_LOCALE_NS = NS

/** Required services（cordis fiber inject）。 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'connection']

/**
 * 注册主面板、左栏入口与旧 tab 的迁移页。
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // N5：入口只注册这几条壳文案；界面字典随 chunk 加载后再注册（见 Workbench 的 useLayoutEffect）
  ctx.effect(() => ctx.locale.register(CHROME_NS, { zh: chromeZh, en: chromeEn }), 'image-video-workbench: chrome dictionaries')
  let bodyDictionaries: (() => void) | undefined
  /**
   * 界面 chunk 把自己那份完整字典交回来注册（入口持有 ctx，chunk 只持有字符串）。
   * 幂等：重复调用只注册一次；卸载时随 fiber 撤销。
   */
  const registerDictionaries = (dicts: { zh: Record<string, string>, en: Record<string, string> }): void => {
    if (bodyDictionaries !== undefined) return
    bodyDictionaries = ctx.locale.register(NS as 'image-video-workbench', dicts as never)
  }
  ctx.effect(() => () => { bodyDictionaries?.(); bodyDictionaries = undefined }, 'image-video-workbench: body dictionaries')
  /**
   * 零散小字典（引导页等）的注册口，按 ns 幂等。
   *
   * 面板每次重新挂载都会调一次，而 `ctx.locale.register` 对**同名 ns 的重复注册是抛错**的；
   * 少了这层去重，「切到别的面板再切回来」会让 main 座位的渲染直接崩掉（表现为整块白屏）。
   * 字典生命期跟随插件 fiber：同一份静态文案没有随面板反复挂/卸的意义。
   */
  const extraLocales = new Map<string, () => void>()
  const registerExtraLocale = (ns: string, dicts: { zh: Record<string, string>, en: Record<string, string> }): void => {
    if (extraLocales.has(ns)) return
    extraLocales.set(ns, ctx.locale.register(ns as never, dicts as never))
  }
  ctx.effect(() => () => {
    for (const dispose of extraLocales.values()) dispose()
    extraLocales.clear()
  }, 'image-video-workbench: extra dictionaries')
  const t = ctx.locale.bind(CHROME_NS)

  // ① 主面板：工作台本体
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): WorkbenchInjected => ({
      kind: LEGACY_TAB_KIND,
      api: createWorkbenchApi(requireConnection(ctx)),
      // 界面 chunk 加载完把自己那份字典交回来（入口不持有它，N5）
      registerDictionaries,
      // 界面里零散的小字典（引导页 / 连接弹层）由 chunk 自己带进来注册与绑定，
      // 入口不必为它们背文案体积；注册口按 ns 去重（面板重挂载时会再次调用）
      registerExtraLocale,
      bindLocale: (ns) => ctx.locale.bind(ns as never) as unknown as (key: string) => string,
    }),
  }, WorkbenchSeat))

  // ② 左栏入口
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('panelLabel'),
    locale: CHROME_NS,
  }, WorkbenchPanelIcon))

  // ③ 旧右栏 tab：保留类型，body 换成「已迁移」（不挂第二份工作台）
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: LEGACY_TAB_ID,
    kind: LEGACY_TAB_KIND,
    title: () => t('tabTitle'),
  }), 'image-video-workbench: legacy tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: LEGACY_TAB_ID,
    locale: CHROME_NS,
    inject: () => ({
      openPanel: () => {
        // 通过 layout 服务切到主面板；服务缺失时退化为「什么也不做」，不会抛给用户
        const layout = ctx.get('layout') as { selectPanel?: (id: MainPanelId) => void } | undefined
        layout?.selectPanel?.(PANEL_ID)
      },
    }),
  }, RelocatedNotice))
}

/**
 * Read the client connection service.
 *
 * `inject` already waits for it, so a miss here means the deployment wired the
 * browser half without its RPC counterpart — worth a named error rather than a
 * TypeError on the first click.
 * @param ctx - client root context.
 * @returns the connection handle.
 */
function requireConnection(ctx: ClientContext): ConnectionHandle {
  const connection = ctx.get('connection')
  if (connection === undefined) throw new Error('image-video-workbench: connection service is unavailable')
  // 宿主连接对象与客户端连接类型在跨包版本下不再结构相容（`HostConnectionHandle`
  // 缺少 `ConnectionHandle` 的新成员）；本插件只用 `rpc.call`，运行时形状一致，
  // 显式双重转换避免把版本漂移记成类型错误。
  return connection as unknown as ConnectionHandle
}
