/**
 * Window fullscreen toggling for the workbench header strip.
 *
 * The header doubles as the window title strip: a double click on its empty
 * area enters native fullscreen and a second double click restores the previous
 * window size. The browser Fullscreen API is the transport in both builds — the
 * Desktop shell renders this document in an Electron window, where the request
 * enters native fullscreen and `exitFullscreen` leaves it, so no additional
 * host IPC is needed.
 */

/** Controls inside the header that keep their own double-click behaviour. */
const INTERACTIVE = [
  'button', 'a', 'input', 'select', 'textarea', 'summary', '[contenteditable="true"]',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]', '[tabindex]',
].join(', ')

/**
 * Answers whether a header double click belongs to a control instead of the strip.
 * @param target - Event target of the double click.
 * @returns `true` when the target or an ancestor is an interactive control.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

/**
 * Toggles the application window between native fullscreen and its previous size.
 *
 * A request that the browser or host refuses leaves the window unchanged: the
 * header has no error surface, and the user's next double click retries.
 */
export function toggleWindowFullscreen(): void {
  if (document.fullscreenElement !== null) {
    void document.exitFullscreen().catch((_error: unknown) => {
      // A refused exit keeps the window fullscreen; Escape still restores it.
    })
    return
  }
  const root = document.documentElement
  if (!document.fullscreenEnabled || typeof root.requestFullscreen !== 'function') return
  void root.requestFullscreen().catch((_error: unknown) => {
    // A refused request keeps the windowed size; the next double click retries.
  })
}
