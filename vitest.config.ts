import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 自动 JSX 运行时：宿主程序用的 tsconfig 没有 `jsx` 字段（它在 tsconfig.client.json
  // 里），不显式指定的话 esbuild 会退回 classic 转换并要求每个文件都 import React。
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    resolve: {
      tsconfigPaths: true,
    },
  },
})
