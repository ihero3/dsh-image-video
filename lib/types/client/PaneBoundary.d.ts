/**
 * 面板错误边界（`B3`）：每个 pane 一个，单个面板崩掉只显示"该面板出错 + 重试"，
 * **不拖垮整个右栏**。
 *
 * 用法：把面板内容包进 `<PaneBoundary label={…} t={t}>…</PaneBoundary>`。
 * 健康时边界零 DOM 包裹（直接渲染 children），出错时换成一段自包含的
 * 空态（图标 + 面板名 + 简短错误 + 重试按钮）。重试 = 摘掉错误态并
 * 用递增的 key 重挂子树，让面板内的组件从头初始化。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { WorkbenchLocaleKey } from './locales.ts';
/** 错误边界属性。 */
export interface PaneBoundaryProps {
    /** 面板内容。 */
    readonly children: ReactNode;
    /** 面板名（已本地化，出错文案里指明是哪个面板）。 */
    readonly label: string;
    /** 文案函数（与 Workbench 同一个 `t`）。 */
    readonly t: (key: WorkbenchLocaleKey) => string;
}
/** 边界内部状态。 */
interface PaneBoundaryState {
    /** 当前捕获到的错误；undefined = 健康。 */
    readonly error: Error | undefined;
    /** 重试次数（同时用作子树 key：变了就整棵重挂）。 */
    readonly attempt: number;
}
/** 捕获渲染期错误并换成面板级空态的边界。 */
export declare class PaneBoundary extends Component<PaneBoundaryProps, PaneBoundaryState> {
    state: PaneBoundaryState;
    /** 渲染出错：切换到错误空态。 */
    static getDerivedStateFromError(error: Error): Partial<PaneBoundaryState>;
    /** 控制台留全栈（现场排查用）；界面只显示简短文案。 */
    componentDidCatch(error: Error, info: ErrorInfo): void;
    /** 重试：清错误态 + key 递增重挂子树。 */
    private retry;
    render(): ReactNode;
}
export {};
