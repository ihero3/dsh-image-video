/**
 * dsh-image-video workbench, browser half: registers the right-pane tab type, its
 * guide entry, and the tab body seat.
 *
 * Registration is deliberately two-stage, exactly as the right pane documents it:
 * the *type* goes into `ctx.sidebarRightTabs` (kind + title + guide), and the
 * *body* binds to the keyed `sidebar.right.pane.tab` seat under this type's own
 * `id`. The type carries its own `kind`, so no built-in kind is taken over; the
 * `id` is unique in the whole tab registry.
 *
 * Nothing here reaches host capability yet — the RPC face (health check, then the
 * project/asset/task surface) is added on the host half next, and the body's
 * injected face grows with it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the client connection merge (ctx.connection) and its handle type.
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale service merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the right pane's Context merge (ctx.sidebarRightTabs) and its seat declarations.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: the slot declarations this file registers against.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createWorkbenchApi } from './api.ts'
import type { WorkbenchInjected } from './Workbench.tsx'
import { WorkbenchSeat } from './WorkbenchSeat.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'
import { CHROME_NS, chromeEn, chromeZh, type ChromeLocaleKey } from './chrome-locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench copy. */
    'image-video-workbench': WorkbenchLocaleKey
    /** 入口壳文案（tab 标题 / guide）：必须在界面 chunk 之前就可读。 */
    'image-video-workbench-chrome': ChromeLocaleKey
  }
}

/** Implementation identity: unique in the tab registry, and the key both seats register under. */
export const WORKBENCH_TAB_ID = 'dsh-image-video'

/**
 * 界面 locale namespace。入口**不 import** `locale-ns.ts`：任何被入口与 chunk 同时引用的模块
 * 都会被切成共享 chunk（`client.locale-ns.js`），入口反而多一次 require，断言也变复杂。
 * 这里写字面量，值必须与 `locale-ns.ts` 一致（`client-lifecycle.test.ts` 钉住两者相等）。
 */
const NS = 'image-video-workbench' as const

/** 供测试钉住"入口字面量 == chunk 侧常量"（入口与 chunk 不能共享模块）。 */
export const WORKBENCH_LOCALE_NS = NS

/** Tab type discriminator. Its own kind, so no built-in kind is shadowed. */
export const WORKBENCH_TAB_KIND = 'dsh-image-video-workbench'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'connection']

/**
 * Register the workbench dictionaries, the tab type, and its body seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // N5：入口只注册这两条壳文案；界面字典随 chunk 加载后再注册（见 Workbench 的 useLayoutEffect）
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
  const t = ctx.locale.bind(CHROME_NS)

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: WORKBENCH_TAB_ID,
    kind: WORKBENCH_TAB_KIND,
    title: () => t('tabTitle'),
    guide: [{
      id: 'open-workbench',
      order: 60,
      title: () => t('tabTitle'),
      description: () => t('guideDescription'),
    }],
  }), 'image-video-workbench: tab type')

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: WORKBENCH_TAB_ID,
    locale: NS,
    inject: (): WorkbenchInjected => ({
      kind: WORKBENCH_TAB_KIND,
      api: createWorkbenchApi(requireConnection(ctx)),
      // 界面 chunk 加载完把自己那份字典交回来（入口不持有它，N5）
      registerDictionaries,
    }),
  }, WorkbenchSeat))
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

