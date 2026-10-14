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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type WorkbenchLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Workbench copy. */
        'image-video-workbench': WorkbenchLocaleKey;
    }
}
/** Implementation identity: unique in the tab registry, and the key both seats register under. */
export declare const WORKBENCH_TAB_ID = "dsh-image-video";
/** Tab type discriminator. Its own kind, so no built-in kind is shadowed. */
export declare const WORKBENCH_TAB_KIND = "dsh-image-video-workbench";
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Register the workbench dictionaries, the tab type, and its body seat.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
