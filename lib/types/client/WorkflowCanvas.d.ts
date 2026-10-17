import { type Node } from '@xyflow/react';
import { type NodeParamValue, type WorkflowNodeKind, type WorkflowRecord, type WorkflowRunRecord } from '../workbench/workflow.ts';
import type { WorkbenchLocaleKey } from './locales.ts';
/** 画布节点携带的数据（xyflow 要求可索引）。 */
export interface CanvasNodeData extends Record<string, unknown> {
    kind: WorkflowNodeKind;
    params: Record<string, NodeParamValue>;
    /** `T4-3` 校验把这个节点标记为有问题时置位（只影响样式）。 */
    invalid?: boolean;
}
/** 画布节点类型（必须带自定义 type，否则 xyflow 会用默认节点渲染）。 */
export type CanvasNode = Node<CanvasNodeData, 'workbench'>;
/** 画布组件的对外属性。 */
export interface WorkflowCanvasProps {
    /** 唯一事实源；画布只读取它做初始化。 */
    readonly record: WorkflowRecord;
    /** 图变化时回写（位置/连线/参数），选择状态不在此列。 */
    readonly onChange: (record: WorkflowRecord) => void;
    /** 文案取用。 */
    readonly t: (key: WorkbenchLocaleKey) => string;
    /** 运行控制（`T4-4`）：状态展示 + 起跑/取消/重试。 */
    readonly run?: {
        readonly latest?: WorkflowRunRecord;
        /** 历史运行（最新在前），点一条即可回看它当时的节点产出与图快照。 */
        readonly history: readonly WorkflowRunRecord[];
        readonly selectedRunId?: string;
        readonly busy: boolean;
        readonly onStart: () => void;
        readonly onCancel: () => void;
        readonly onRetry: () => void;
        readonly onSelectRun: (runId: string) => void;
    };
}
/** 对外画布组件：套 `ReactFlowProvider` 并注入官方样式 + 设计系统样式。 */
export declare function WorkflowCanvas(props: WorkflowCanvasProps): JSX.Element;
