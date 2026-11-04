/**
 * 入口壳专用文案（**只有这两条**）：tab 标题与 guide 描述必须在界面 chunk 加载**之前**就可读，
 * 所以它们留在入口包里；其余 600+ 条文案随界面 chunk 一起加载（`locales.ts`）。
 *
 * 这样做的原因（N5，体积）：locale 服务禁止同一 namespace 同一 locale 注册两次，所以"入口注册一部分、
 * chunk 再补其余"在同一个 ns 上做不到。拆成两个 ns：入口注册 `image-video-workbench-chrome`（2 条），
 * 界面 chunk 加载后注册 `image-video-workbench`（完整字典、仍保持 zh/en 双语齐全）。
 *
 * 代价与约束：新增**入口可见**文案（tab 标题、guide 文案）才需要加到这里；界面里的文案一律加在
 * `locales.ts`，入口体积不再随界面文案增长。
 *
 * @module dsh-image-video/client/chrome-locales
 */

/** 入口壳的 locale namespace（与界面字典分开：同一 ns 不允许二次注册）。 */
export const CHROME_NS = 'image-video-workbench-chrome'

/** 入口壳需要的文案键（只有两条：tab 标题 + guide 描述）。 */
export type ChromeLocaleKey = 'tabTitle' | 'guideDescription'

/** 入口壳中文文案。 */
export const chromeZh: Record<ChromeLocaleKey, string> = {
  tabTitle: 'dsh-image-video 工作台',
  guideDescription: '图片与视频创作的剧集、媒体素材与生成任务。',
}

/** 入口壳英文文案。 */
export const chromeEn: Record<ChromeLocaleKey, string> = {
  tabTitle: 'dsh-image-video workbench',
  guideDescription: 'Series, media assets and generation tasks for image and video work.',
}
