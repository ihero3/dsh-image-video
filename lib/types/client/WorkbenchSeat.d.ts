import type { WorkbenchProps } from './Workbench.tsx';
/**
 * 右栏 seat 的 body 组件：等 chunk 期间渲染一个最小占位（本地加载通常 <100ms）。
 * @param props - 宿主 seat 注入的 props（原样透传给懒加载的 Workbench）。
 * @returns 带 Suspense 边界的 seat 内容。
 */
export declare function WorkbenchSeat(props: WorkbenchProps): import("react").FunctionComponentElement<import("react").SuspenseProps>;
