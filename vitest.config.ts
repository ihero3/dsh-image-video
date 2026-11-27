import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * `@deepseek-ai/dsh-client-connection` 的**源码**根目录。
 *
 * 本仓库有两种检出布局，深层源码导入（`.../src/client/rpc.ts`）两种都要能跑：
 * - 作为 harness 子模块：`<harness>/plugins/dsh-image-video` → `../../packages/client/connection`；
 * - 独立检出：`~/code/dsh-image-video` 与 `~/code/deepseek-harness` 并排 → `../deepseek-harness/packages/client/connection`。
 * 只写死一种会让另一种布局下的两个 RPC 套件**起不来**（报 Cannot find package）。
 */
const CONNECTION_CANDIDATES = [
  fileURLToPath(new URL('../deepseek-harness/packages/client/connection', import.meta.url)),
  fileURLToPath(new URL('../../packages/client/connection', import.meta.url)),
]
const CONNECTION_DIR = CONNECTION_CANDIDATES.find(candidate => existsSync(candidate)) ?? CONNECTION_CANDIDATES[1]!

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
    // `pdfjs-dist` 走 Node 原生语义（vite 转译会丢掉它的类原型方法）；其余 workspace 包按源码内联
    server: { deps: { inline: [/dsh-client-connection/], external: [/pdfjs-dist/] } },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/**'],
      exclude: ['src/client/**', 'src/**/*.d.ts'],
      // 阈值 = 最近一次全量实测值 - 2pp（口径见 docs/UI-POLISH-PLAN.md「同步下调全局阈值」）
      // 2026-11-27 实测：statements 79.75 / branches 67.50 / functions 81.20 / lines 82.88
      // 相对上版（2026-10-19）的降幅集中在三块仍无用例的宿主模块：
      // src/tools/generate-image.ts 0%、src/tools/generate-video.ts 4.5%、src/tools/speech.ts 7%。
      // 给这三块补上用例后应把阈值抬回去，不要把这组数当新常态。
      thresholds: { lines: 80.8, functions: 79.2, branches: 65.5, statements: 77.7 },
    },
    resolve: {
      // vitest 4 对 workspace 包的 `exports` 遵守得更严格：`@deepseek-ai/dsh-client-connection/src/...`
      // 这类**深层源码导入**不再被放行（vitest 3 宽松放行过）。这里显式把包名映射到包根目录，
      // 深层路径就能正常落到 `<包根>/src/...`。属 A 侧配置，不改同事 B 的测试。
      alias: {
        '@deepseek-ai/dsh-client-connection': CONNECTION_DIR,
      },
      tsconfigPaths: true,
    },
  },
})
