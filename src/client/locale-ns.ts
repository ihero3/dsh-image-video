/**
 * 工作台 locale 的 namespace 常量。
 *
 * 单独成文件是为了让**入口壳**不必 import 整份字典（`locales.ts`）——否则入口会把
 * 15 KB 的 zh/en 文案静态拉进来，N5 的按需字典就白做了。
 *
 * @module dsh-image-video/client/locale-ns
 */
export const NS = 'image-video-workbench'
