import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 自动 JSX 运行时：宿主程序用的 tsconfig 没有 `jsx` 字段（它在 tsconfig.client.json
  // 里），不显式指定的话 esbuild 会退回 classic 转换并要求每个文件都 import React。
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    // 真实 IO 用例（ffmpeg 渲染）在忙碌机器上会抖：允许重试一次，flaky 会在报告里露出
    retry: 1,
    // 套件里有真实 ffmpeg 渲染与 jsdom 交互，忙碌机器上默认 5s/10s 太紧（曾出现 196s 抖动）
    testTimeout: 60_000,
    hookTimeout: 30_000,
    globals: false,
    // jsdom 缺口（ResizeObserver 等）统一补，见 tests/setup-dom.ts
    setupFiles: ['tests/setup-dom.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    resolve: {
      tsconfigPaths: true,
    },
  },
})
