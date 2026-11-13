/**
 * 入口壳专用文案：左栏入口名、旧 tab 标题、迁移页三条。
 *
 * 它们必须在界面 chunk 加载**之前**就可读，所以留在入口包里；其余 600+ 条文案随界面
 * chunk 一起加载（`locales.ts`）。
 *
 * 为什么拆两个 namespace（N5，体积）：locale 服务禁止同一 namespace 同一 locale 注册两次，
 * 所以"入口注册一部分、chunk 再补其余"在同一个 ns 上做不到。入口注册
 * `image-video-workbench-chrome`（5 条），界面 chunk 加载后注册 `image-video-workbench`。
 *
 * 约束：只有**入口可见**的文案才加到这里（入口体积预算敏感）；界面里的文案一律加在 `locales.ts`。
 *
 * @module dsh-image-video/client/chrome-locales
 */

/** 入口壳的 locale namespace（与界面字典分开：同一 ns 不允许二次注册）。 */
export const CHROME_NS = 'image-video-workbench-chrome'

/** 入口壳需要的文案键。 */
export type ChromeLocaleKey =
  /** 左栏入口名。 */
  | 'panelLabel'
  /** 旧右栏 tab 的标题。 */
  | 'tabTitle'
  /** 旧 tab 的迁移提示：标题 / 说明 / 按钮。 */
  | 'relocatedTitle'
  | 'relocatedBody'
  | 'relocatedAction'

/** 入口壳中文文案。 */
export const chromeZh: Record<ChromeLocaleKey, string> = {
  panelLabel: '三视dsh-image-video',
  tabTitle: 'Three Video 工作台',
  relocatedTitle: '工作台已经搬到左栏',
  relocatedBody: '从这个右栏页签改成了和「插件」「自动化任务」一样的主面板，整块区域都归它使用。点击下面按钮直接打开。',
  relocatedAction: '打开工作台',
}

/** 入口壳英文文案。 */
export const chromeEn: Record<ChromeLocaleKey, string> = {
  panelLabel: 'dsh-image-video',
  tabTitle: 'Three Video workbench',
  relocatedTitle: 'The workbench moved to the sidebar',
  relocatedBody: 'It is now a main panel like Plugins and Scheduled tasks, and owns the whole centre area. Use the button below to open it.',
  relocatedAction: 'Open workbench',
}
