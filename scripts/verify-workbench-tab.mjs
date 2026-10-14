#!/usr/bin/env node
/**
 * 工作台 tab 的现场检查（T1-7）。
 *
 * 问两件事：① 正在跑的宿主要在服务这个插件的**客户端半边**吗（`__DSH_BOOT__.entries`
 * 里有 `dsh-image-video`）？② 右栏是否已经出现工作台入口（guide 文案 / tab 标题）？
 *
 * 默认**只读**：不动渲染进程、不点任何东西。加 `--reload` 才先重载渲染进程。
 * 注意：宿主在插件首次装载时缓存 `dsh.client` 扫描结果，**重载渲染进程不会重扫**——
 * 半边缺失时的正确处置是重启宿主进程（`pnpm run dev:desktop` / `start:desktop`）。
 *
 * 用法：
 *   node scripts/verify-workbench-tab.mjs [--cdp http://127.0.0.1:9222] [--reload] [--shot out.png]
 * 退出码：0 = 客户端半边已在服务；1 = 未在服务（需重启宿主）；2 = 探测本身失败。
 */
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const value = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback
}
const cdp = value('--cdp', 'http://127.0.0.1:9222')
const reload = flag('--reload')
const shotPath = value('--shot', undefined)

/** 右栏入口可能显示的名字：与 `src/client/locales.ts` 的两个字典一致。 */
const TAB_TITLES = ['dsh-image-video 工作台', 'dsh-image-video workbench']

const list = await (await fetch(`${cdp}/json/list`)).json()
const target = list.find(candidate => candidate.url === 'dsh-app://app/')
if (target === undefined) {
  console.error(`探测失败：${cdp} 上没有 dsh-app://app/ 页面（桌面 App 未运行？）`)
  process.exit(2)
}

const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id !== undefined && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
const send = (method, params = {}) => new Promise((resolve) => {
  const messageId = ++id
  pending.set(messageId, resolve)
  ws.send(JSON.stringify({ id: messageId, method, params }))
})
const evaluate = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (reply.result?.exceptionDetails !== undefined) {
    throw new Error(String(reply.result.exceptionDetails.exception?.description ?? 'evaluate failed'))
  }
  return reply.result?.result?.value
}
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

await send('Page.enable')
await send('Runtime.enable')

if (reload) {
  await send('Page.reload', { ignoreCache: true })
  await sleep(1500)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('#root')`)) break
    await sleep(300)
  }
}

const probe = JSON.parse(await evaluate(`JSON.stringify({
  loadedAt: new Date(performance.timeOrigin).toISOString(),
  entries: (window.__DSH_BOOT__?.entries ?? []).map(entry => entry.id),
  ourUrl: (window.__DSH_BOOT__?.entries ?? []).find(entry => entry.id === 'dsh-image-video')?.url ?? null,
  titles: ${JSON.stringify(TAB_TITLES)},
  visibleText: document.body.innerText.slice(0, 200_000),
})`))
const served = probe.ourUrl !== null
const matched = probe.titles.filter(title => probe.visibleText.includes(title))

console.log(`页面加载时间: ${probe.loadedAt}`)
console.log(`客户端半边在服务: ${served ? `是（${probe.ourUrl}）` : '否'}`)
console.log(`右栏入口文案命中: ${matched.length === 0 ? '否' : matched.join('、')}`)

if (shotPath !== undefined) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'))
  console.log(`截图: ${shotPath}`)
}

ws.close()

if (!served) {
  console.error('结论：宿主还没有认到这个插件的客户端半边。')
  console.error('处置：重启宿主进程（pnpm run dev:desktop / pnpm --filter @deepseek-ai/dsh-desktop run start）；重载渲染进程无效。')
  process.exit(1)
}
if (matched.length === 0) {
  console.log('结论：客户端半边已在服务，但当前视图里没有工作台入口（打开右侧边栏后重跑本脚本）。')
  process.exit(0)
}
console.log('结论：客户端半边已在服务，且右栏已出现工作台入口。')
