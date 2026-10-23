/**
 * 工作台 seat（入口侧薄壳）：把整套界面按需加载成**插件自己的包内 chunk**。
 *
 * 为什么需要这一层（A-6 修订版）：
 * - 插件的客户端产物是"单入口 + 包内 chunk"模型，入口只能静态依赖**宿主模块表**里
 *   已有的词（react / react-dom / cordis 服务），其余一律要惰性；
 * - 若入口静态 import `Workbench`，React Flow（连 `d3-*` 闭包）会被内联进入口包，
 *   体积回到 834 KB；若改由宿主提供（上一版方案），则要求每个 DSH 用户都装到带
 *   `@xyflow/react` 平台词的宿主——对第三方安装者不成立。
 * - 折中：入口只留注册壳，界面（含 React Flow）进 `lib/client/client.Workbench.js`，
 *   首次打开工作台时经 `require.async` 取。**不依赖宿主平台词，装到任何 DSH 都能用。**
 *
 * 注意：这里 `import type` 只为类型，不产生运行时依赖；`lazy()` 的 `import()` 会被
 * 构建改写成 `require.async('./client.Workbench.js')`（见 tsdown.config.ts）。
 */
import { Suspense, createElement, lazy } from 'react'
import type { WorkbenchProps } from './Workbench.tsx'

/** 首次打开工作台时加载的界面 chunk（构建产物名由 tsdown 的 `chunkFileNames` 决定）。 */
const Workbench = lazy(async () => {
  const module = await import('./Workbench.tsx')
  return { default: module.Workbench }
})

/**
 * 右栏 seat 的 body 组件：等 chunk 期间渲染一个最小占位（本地加载通常 <100ms）。
 * @param props - 宿主 seat 注入的 props（原样透传给懒加载的 Workbench）。
 * @returns 带 Suspense 边界的 seat 内容。
 */
export function WorkbenchSeat(props: WorkbenchProps) {
  return createElement(
    Suspense,
    { fallback: createElement('div', { className: 'iv-pane', 'data-workbench-loading': 'true' }) },
    createElement(Workbench, props),
  )
}
