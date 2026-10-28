/**
 * jsdom 缺的浏览器 API：统一在这里补，避免每个测试文件各写一份。
 *
 * `@xyflow/react` 用 `ResizeObserver` 测量视口与节点；jsdom 没有它，画布一挂载就
 * 抛 `ReferenceError`，整棵树被卸载（表现为"容器里什么都没有"）。
 * 只在有 window 的环境里补：宿主侧（node 环境）的测试不需要也不受影响。
 */
import { configure } from '@testing-library/react'

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
}
