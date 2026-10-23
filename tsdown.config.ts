import MagicString from 'magic-string'
import { defineConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-image-video'

/** 宿主 `CLIENT_CHUNK` 契约：包内 chunk 名必须以 `client.` 开头。 */
const CLIENT_CHUNK_NAME = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

/**
 * Rolldown 在 CJS 产物里把 `import()` 编译成
 * `Promise.resolve().then(() => require('./client.X.js'))`；而宿主工厂收到的 `require`
 * 是**同步模块表查找**（不会去取脚本），只有 `require.async` 会按包内路由加载 chunk。
 * 这里把生成式改写成 `require.async(...)`；漏改一个 chunk 就直接构建失败，
 * 不留"运行期必然失败"的 require。
 */
function asyncChunkRequire() {
  return {
    name: 'dsh-image-video-client-async-chunk',
    renderChunk(code: string, chunk: { dynamicImports: string[] }, outputOptions: { format?: string }) {
      if (outputOptions.format !== 'cjs') return null
      const transformed = new MagicString(code)
      for (const request of chunk.dynamicImports) {
        // rolldown 报告的 dynamicImports 形如 `client/client.X.js`（相对 outDir），
        // 而加载器的 chunk 名是入口同目录的裸文件名——只取 basename。
        const fileName = request.slice(request.lastIndexOf('/') + 1)
        if (!CLIENT_CHUNK_NAME.test(fileName)) continue
        const specifier = `./${fileName}`
        const pattern = new RegExp(
          `Promise\\.resolve\\(\\)\\.then\\(\\(\\)\\s*=>\\s*require\\((['"])${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)\\)`,
          'gu',
        )
        const matches = [...code.matchAll(pattern)]
        if (matches.length === 0) {
          throw new Error(`client bundle: dynamic chunk ${JSON.stringify(specifier)} has no generated import expression`)
        }
        for (const match of matches) {
          transformed.overwrite(match.index!, match.index! + match[0].length, `require.async(${JSON.stringify(specifier)})`)
        }
      }
      return transformed.hasChanged()
        ? { code: transformed.toString(), map: transformed.generateMap({ hires: true }) }
        : null
    },
  }
}

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
    plugins: [asyncChunkRequire()],
    outputOptions: {
      entryFileNames: '[name].js',
      // A-6 修订：界面（含 React Flow + d3 闭包）进包内 chunk，与入口**同目录**
      // （宿主按"入口文件所在目录 + 文件名"取 chunk）。
      chunkFileNames: 'client/client.[name].js',
      // 入口与 chunk 同一条注册契约；chunk 多带 `chunk:` 字段（**裸文件名**，
      // 宿主会拼成 `<包名>/<fileName>`），入口的键是包名本身。
      banner: (chunk: { isEntry: boolean; fileName: string }) => {
        const chunkName = JSON.stringify(chunk.fileName.slice(chunk.fileName.lastIndexOf('/') + 1))
        return `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, ${chunk.isEntry ? '' : `chunk: ${chunkName}, `}factory: (require) => {`
      },
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
