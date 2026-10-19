import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const CONNECTION_DIR = fileURLToPath(new URL('../../packages/client/connection', import.meta.url))

export default defineConfig({
  // 顶层 alias（vite 级，测试与依赖都走它）：workspace 包的深层源码导入在 vitest 4 下需要显式映射
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-connection': CONNECTION_DIR,
    },
  },
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
    // workspace 包按源码内联（不走 exports）
    server: { deps: { inline: [/dsh-client-connection/] } },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/**'],
      exclude: ['src/client/**', 'src/**/*.d.ts'],
      // 阈值先占位，实测后按真实值设定（见 docs/COVERAGE-PLAN.md）
      // 阈值 = 2026-10-19 实测值 - 2pp（statements 82.98 / branches 72.52 / functions 81.81 / lines 85.36）
      thresholds: { lines: 83, functions: 80, branches: 70, statements: 81 },
    },
    resolve: {
      // vitest 4 对 workspace 包的 `exports` 遵守得更严格：`@deepseek-ai/dsh-client-connection/src/...`
      // 这类**深层源码导入**不再被放行（vitest 3 宽松放行过）。这里显式把包名映射到包根目录，
      // 深层路径就能正常落到 `<包根>/src/...`。属 A 侧配置，不改同事 B 的测试。
      alias: {
        '@deepseek-ai/dsh-client-connection': fileURLToPath(new URL('../../packages/client/connection', import.meta.url)),
      },
      tsconfigPaths: true,
    },
  },
})
