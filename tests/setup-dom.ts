/**
 * jsdom 缺的浏览器 API：统一在这里补，避免每个测试文件各写一份。
 *
 * `@xyflow/react` 用 `ResizeObserver` 测量视口与节点；jsdom 没有它，画布一挂载就
 * 抛 `ReferenceError`，整棵树被卸载（表现为"容器里什么都没有"）。
 * 只在有 window 的环境里补：宿主侧（node 环境）的测试不需要也不受影响。
 */
if (typeof globalThis.window !== 'undefined' && typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
