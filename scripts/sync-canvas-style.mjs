/**
 * 把 `@xyflow/react` 的官方样式表内嵌成 TS 模块。
 *
 * 客户端的私有插件产物是由 Harness 的 `window.__ModuleLoader__` 以 JS 方式加载的，
 * 不经过 Harness 自家的 CSS 打包链，所以 `import '@xyflow/react/dist/style.css'`
 * 不会生效。这里在打包前把它转成一段字符串常量（含许可头），由画布组件在运行时
 * 注入一次 `<style>`；官方样式一升级，重跑本脚本即可同步：
 *
 *   node scripts/sync-canvas-style.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const packageJson = require.resolve('@xyflow/react/package.json')
const root = dirname(packageJson)
const source = readFileSync(join(root, 'dist', 'style.css'), 'utf8')
const version = JSON.parse(readFileSync(packageJson, 'utf8')).version
const target = resolve(import.meta.dirname, '..', 'src', 'client', 'canvas-style.ts')

const banner = `/**
 * 由 \`node scripts/sync-canvas-style.mjs\` 生成，请勿手改。
 *
 * 来源：@xyflow/react@${version} 的 dist/style.css（MIT）。内嵌原因见同步脚本。
 */

/** 官方画布样式表（原样内嵌）。 */
export const CANVAS_STYLE = ${JSON.stringify(source)}

/** 注入目标 <style> 的 id，保证重复挂载只注入一次。 */
export const CANVAS_STYLE_ID = 'dsh-image-video-canvas-style'
`
writeFileSync(target, banner)
console.log(`已同步 @xyflow/react@${version} 样式表 → ${target}（${source.length} 字节）`)
