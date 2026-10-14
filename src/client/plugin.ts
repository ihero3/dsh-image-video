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
// Type-only: pulls the locale service merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the right pane's Context merge (ctx.sidebarRightTabs) and its seat declarations.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: the slot declarations this file registers against.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { Workbench, type WorkbenchInjected } from './Workbench.tsx'
import { NS, en, zh, type WorkbenchLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench copy. */
    'image-video-workbench': WorkbenchLocaleKey
  }
}

/** Implementation identity: unique in the tab registry, and the key both seats register under. */
export const WORKBENCH_TAB_ID = 'dsh-image-video'

/** Tab type discriminator. Its own kind, so no built-in kind is shadowed. */
export const WORKBENCH_TAB_KIND = 'dsh-image-video-workbench'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'sidebarRightTabs']

/**
 * Register the workbench dictionaries, the tab type, and its body seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'image-video-workbench: dictionaries')
  const t = ctx.locale.bind(NS)

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
    inject: (): WorkbenchInjected => ({ kind: WORKBENCH_TAB_KIND }),
  }, Workbench))
}
