/**
 * 工作流的类型与节点目录（画布半边与宿主半边共用）。
 *
 * 边界按 `R-FLW-1`：画布只负责**交互**（位置、连线、选择、缩放平移、适配窗口），
 * 不承担执行、参数校验、调度与持久化——那些在宿主侧（`T4-3`/`T4-4`/`T4-6`）。
 * 这里只放"节点长什么样"的静态事实，让两个半边对同一套目录有单一事实源。
 *
 * 节点集按 `R-FLW-2`：V1 十个节点 + `subtitle`/`render` 本方案实现，
 * `lip-sync`/`face-swap`/`voice-synthesize` 标记为 `planned`（列表里可见、不可运行，
 * 并给出原因），对应阶段 3 的"预留能力边界"要求。
 */
/** 节点可运行性。`planned` 的节点在画布上可见但不可加入。 */
export type NodeAvailability = 'runnable' | 'planned';
/** 端口数据种类（用于后续宿主的类型匹配校验，画布只用来判断能否连线）。 */
export type PortKind = 'any' | 'text' | 'media' | 'resource' | 'asset';
/** 节点参数取值。 */
export type NodeParamValue = string | number | boolean;
/** 一个节点参数的编辑形态。 */
export interface NodeParamField {
    readonly id: string;
    readonly labelKey: string;
    readonly type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
    readonly default: NodeParamValue;
    readonly options?: readonly {
        readonly value: string;
        readonly labelKey: string;
    }[];
}
/** 目录里的一个节点种类。 */
export interface NodeKindSpec {
    readonly kind: WorkflowNodeKind;
    readonly labelKey: string;
    readonly availability: NodeAvailability;
    /** `planned` 的不可运行原因（locale key）。 */
    readonly reasonKey?: string;
    readonly input: PortKind;
    readonly output: PortKind;
    readonly params: readonly NodeParamField[];
}
/** `R-FLW-2` 的节点集（含本方案实现与 planned）。 */
export type WorkflowNodeKind = 'creative-input' | 'script' | 'storyboard' | 'asset-reference' | 'resource-reference' | 'motion-track' | 'image-generate' | 'video-generate' | 'preview' | 'publish-asset' | 'subtitle' | 'render' | 'lip-sync' | 'face-swap' | 'voice-synthesize';
/** 画布上的一个节点。 */
export interface WorkflowNode {
    readonly id: string;
    readonly kind: WorkflowNodeKind;
    readonly position: {
        readonly x: number;
        readonly y: number;
    };
    readonly params: Readonly<Record<string, NodeParamValue>>;
}
/** 画布上的一条连线。 */
export interface WorkflowEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
}
/**
 * 工作流文档：画布维度的唯一事实源（`T4-1`）。
 *
 * 注意**没有**选择状态字段——UI 的瞬时选择按 `R-FLW-1` 不入库。
 */
export interface WorkflowRecord {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly nodes: readonly WorkflowNode[];
    readonly edges: readonly WorkflowEdge[];
    readonly createdAt: string;
    readonly updatedAt: string;
}
/**
 * 节点目录。顺序即画布左侧节点库的展示顺序（先能用的，后 planned）。
 *
 * `video-generate` 按 `D7` 显式承载参考视频与 `compare`（不另立 `video-edit` 节点），
 * 参数语义与对话里的 `generate_video` 对齐（`R-FLW-4`）。
 */
export declare const NODE_CATALOG: readonly NodeKindSpec[];
/** 取一个节点种类的事实。 */
export declare function nodeSpec(kind: WorkflowNodeKind): NodeKindSpec;
/** 该种类当前能否加入画布。 */
export declare function isRunnable(kind: WorkflowNodeKind): boolean;
/** 新节点的默认参数（取自目录）。 */
export declare function defaultParams(kind: WorkflowNodeKind): Record<string, NodeParamValue>;
/** 目录里可用 / 预留的数量，供 UI 显示与测试断言。 */
export declare function catalogSummary(): {
    runnable: number;
    planned: number;
};
