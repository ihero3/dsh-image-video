/**
 * 现场布局检查：工作流画布必须完整落在自己的区块里，不能压到下面的面板。
 *
 * 退出码：0 = 通过；1 = 布局越界；2 = 探测失败（App/调试端口不可用）。
 * 只读用法：挂载后加一个节点、量几何、不改任何持久状态（画布暂存不入库）。
 *
 *   node scripts/verify-canvas-layout.mjs [--port 9222]
 */
const portFlag = process.argv.indexOf('--port')
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 9222
const fail = (message, code) => { console.error(`画布布局检查失败: ${message}`); process.exit(code) }
setTimeout(() => { fail('超时', 2) }, 120_000)

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) }))
  .json().catch(() => fail(`连接不到 http://127.0.0.1:${port}（App 没在跑或调试端口不同）`, 2))
const target = list.find(candidate => candidate.url === 'dsh-app://app/')
if (target === undefined) fail('没有找到 App 页面目标', 2)

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('ws 超时')), 6000)
  ws.addEventListener('open', () => { clearTimeout(timer); resolve() })
}).catch(error => fail(error.message, 2))
let id = 0
const pending = new Map()
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id
  const timer = setTimeout(() => { pending.delete(current); reject(new Error(`${method} 超时`)) }, 25000)
  pending.set(current, message => { clearTimeout(timer); resolve(message) })
  ws.send(JSON.stringify({ id: current, method, params }))
})
const evaluate = async expression =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = milliseconds => new Promise(resolve => { setTimeout(resolve, milliseconds) })
const waitFor = async (expression, what, ms = 20000) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) { if (await evaluate(expression)) return true; await sleep(400) }
  fail(`等待超时: ${what}`, 2)
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.reload', { ignoreCache: true })
await sleep(2800)
for (let attempt = 0; attempt < 20; attempt += 1) {
  if (await evaluate(`!!document.querySelector('[data-workbench-kind]')`)) break
  await evaluate(`(() => { const header = [...document.querySelectorAll('button,[role=button],[role=tab],li,a')]
    .find(el => (el.textContent ?? '').trim().startsWith('dsh-image-video 工作台')); if (header) header.click(); return true })()`)
  await sleep(600)
}
await waitFor(`!!document.querySelector('[data-workbench-kind]')`, '工作台挂载')
// 有项目才切得了工作流模式
if ((await evaluate(`(() => { const s = document.querySelector('[data-workbench-kind] select'); return s ? s.options.length : 0 })()`)) === 0) {
  fail('当前没有项目：先在右栏建一个项目再跑本检查', 1)
}
await evaluate(`(() => { const button = [...document.querySelectorAll('[data-workbench-kind] button')]
  .find(el => (el.textContent ?? '').trim() === '专业工作流'); if (button) button.click(); return true })()`)
await waitFor(`!!document.querySelector('[data-workflow-canvas]')`, '画布挂载')
await evaluate(`(() => { const button = document.querySelector('[data-workflow-canvas] button[aria-label="加入画布 video-generate"]'); if (button) button.click(); return true })()`)
await waitFor(`!!document.querySelector('[data-workflow-canvas] [data-workflow-node="video-generate"]')`, '节点卡片渲染')
await sleep(400)

const geometry = JSON.parse(await evaluate(`(() => {
  const box = element => { const rect = element.getBoundingClientRect(); return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right) } }
  const pane = document.querySelector('[data-workbench-pane=paneCanvas]')
  const flow = document.querySelector('[data-workflow-flow]')
  const next = document.querySelector('[data-workbench-pane=paneAssets]')
  const node = document.querySelector('[data-workflow-canvas] [data-workflow-node]')
  return JSON.stringify({ pane: box(pane), flow: box(flow), next: next ? box(next) : null, node: node ? box(node) : null })
})()`))
ws.close()

const flowInsidePane = geometry.flow.bottom <= geometry.pane.bottom + 2 && geometry.flow.top >= geometry.pane.top - 2
const nodeInsideFlow = geometry.node === null
  || (geometry.node.bottom <= geometry.flow.bottom + 2 && geometry.node.top >= geometry.flow.top - 2)
const panesDisjoint = geometry.next === null || geometry.pane.bottom <= geometry.next.top + 2
console.log('几何:', JSON.stringify(geometry))
if (!flowInsidePane) fail(`画布内容（bottom=${geometry.flow.bottom}）超出区块（bottom=${geometry.pane.bottom}）`, 1)
if (!nodeInsideFlow) fail('节点卡片跑到画布视口之外', 1)
if (!panesDisjoint) fail(`画布区块（bottom=${geometry.pane.bottom}）与下一个面板重叠（top=${geometry.next.top}）`, 1)
console.log('画布布局检查通过：内容在区块内，且不与下面的面板重叠')
process.exit(0)
