import { defineConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-image-video'

/**
 * 自包含构建：两个面各产出自己的产物，消费方安装时无需执行构建脚本。
 *
 * - 宿主角（`src/index.ts` → `lib/index.js`）：ESM/Node，cordis 宿主进程加载。
 * - 客户端角（`src/client/plugin.ts` → `lib/client/plugin.js`）：CJS/browser，
 *   交给 Harness 的客户端模块加载器（`window.__ModuleLoader__.load`）。
 *
 * `clean` 只在 `build` 脚本里做一次（`pnpm run clean`）：两个 face 同时带
 * `clean: true` 会互相删产物。
 */
export default defineConfig([
  {
    name: PACKAGE_NAME,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    outputOptions: {
      // dts chunk 默认带内容哈希（index-<hash>.d.ts），会让 package.json 的
      // types 指向一个每次改源码都变的文件名；固定为 index.d.ts
      chunkFileNames: (chunk) => (chunk.name.includes('.d') ? 'index.d.ts' : '[name]-[hash].js'),
    },
    dts: true,
    clean: false,
    fixedExtension: false,
  },
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { 'client/plugin': 'src/client/plugin.ts' },
    tsconfig: 'tsconfig.client.json',
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      // zustand (through @xyflow/react) reads import.meta.env in ESM source.
      // This client bundle is CJS, so define the whole object; otherwise
      // rolldown replaces import.meta with {} and warns, leaving dead
      // development warnings in the production bundle.
      'import.meta.env': JSON.stringify({ MODE: 'production' }),
    },
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      // 模块表条目保持为 import：由 window.__ModuleLoader__.require 解析。
      // 清单必须与 package.json 的 `dsh.client.external` 一致——加载器对
      // require 不到的包是运行时抛错，不是降级。
      neverBundle: (id: string) => [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-connection/client',
        '@deepseek-ai/dsh-client-locale/client',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-client-ui-sidebar-right/client',
      ].some(requested => id === requested || id.startsWith(`${requested}/`)),
      // 其余一律内联（插件自己的依赖）
      alwaysBundle: (id: string) => !id.startsWith('node:'),
    },
    outputOptions: {
      entryFileNames: '[name].js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
