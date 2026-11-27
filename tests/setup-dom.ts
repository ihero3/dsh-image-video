/**
 * jsdom 缺的浏览器 API：统一在这里补，避免每个测试文件各写一份。
 *
 * `@xyflow/react` 用 `ResizeObserver` 测量视口与节点；jsdom 没有它，画布一挂载就
 * 抛 `ReferenceError`，整棵树被卸载（表现为"容器里什么都没有"）。
 * 只在有 window 的环境里补：宿主侧（node 环境）的测试不需要也不受影响。
 */
import { configure } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * 剧本文本草稿会落 localStorage，测试之间必须隔离：否则上一例输入的内容
 * 会被下一例的新组件当作恢复值读回来。只清草稿前缀，不动引导标记 / 上次打开的集。
 */
afterEach(() => {
  if (typeof localStorage === 'undefined') return
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('image-video:script-draft:')) localStorage.removeItem(key)
    }
  } catch { /* 无 localStorage 的环境忽略 */ }
})

if (typeof globalThis.window !== 'undefined') {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  }

  /**
   * 异步查询超时统一放宽到 2s。
   *
   * Testing Library 的 `findBy*` / `waitFor` 默认只等 **1s**，`testTimeout` 管的是
   * 整个用例、对这个 1s 无效。全量并发跑时 Workbench 挂载期的多条异步加载链
   * （health / listAssets / listProjects / listRunningTasks）在 CPU 抢占下很容易超过
   * 1s，表现就是"单独跑全绿、全量跑挂几个用例"。
   *
   * 这里只放宽等待时间，**不加 retry**：retry 会把真实竞态藏起来；超时放宽只是给
   * 慢机器留余量，业务逻辑错了照样失败。
   */
  configure({ asyncUtilTimeout: 2000 })

  /**
   * Node 22+ 自带 `localStorage` 全局（没给 `--localstorage-file` 有效路径时就是个空对象，
   * 启动时会告警「--localstorage-file was provided without a valid path」）。
   * vitest 的 populateGlobal 只覆盖"全局里还没有"的键，于是 jsdom 的 web storage
   * 被 Node 这份空壳顶掉：`typeof localStorage.setItem !== 'function'`，
   * 依赖草稿持久化的用例在 `localStorage.clear()` 直接炸。
   *
   * 这里只做**重绑定**，不造假实现：把 jsdom 那份真 Storage 挂回全局，
   * `Storage.prototype` 上的补丁（配额超限用例）照旧生效。
   */
  const jsdomWindow = (globalThis as unknown as { jsdom?: { window?: Window } }).jsdom?.window
  const globalStorage = (globalThis as unknown as { localStorage?: Storage }).localStorage
  if (jsdomWindow !== undefined && typeof globalStorage?.setItem !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: jsdomWindow.localStorage,
    })
  }
}
