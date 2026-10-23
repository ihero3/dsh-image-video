import type { WorkbenchApi } from './api.ts';
import type { WorkbenchLocaleKey } from './locales.ts';
/** 卡片 props：注入 api / 词典 / 当前项目 / 起跑后的回调。 */
export interface PipelineCardProps {
    readonly api: WorkbenchApi;
    readonly t: (key: WorkbenchLocaleKey) => string;
    /** 当前项目；未选项目时按钮禁用并给提示。 */
    readonly projectId?: string;
    /** 起跑成功后切到画布模式（由 Workbench 提供）。 */
    readonly onStarted: (workflowId: string) => void;
}
/**
 * 一键成片卡片。
 * @param props - 见 {@link PipelineCardProps}。
 * @returns 折叠式表单 + 结果/提醒。
 */
export declare function PipelineCard(props: PipelineCardProps): import("react").JSX.Element;
