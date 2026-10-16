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
    /** 运行前必须有值（空串/`false` 也算缺）——`T4-3` 的必填校验。 */
    readonly required?: boolean;
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
/** 画布规模上限：挡住畸形载荷，也给前端一个明确的边界。 */
export declare const MAX_WORKFLOW_NODES = 200;
/** 连线数量上限。 */
export declare const MAX_WORKFLOW_EDGES = 400;
/**
 * 校验一个节点种类。
 * @param value - 原始值。
 * @returns 目录里的种类。
 * @throws {Error} 当它不是已知种类。
 */
export declare function normalizeNodeKind(value: unknown): WorkflowNodeKind;
/**
 * 校验画布的节点与连线。
 *
 * 只做"结构可信"这一层（种类存在、坐标是有限数、连线两端都在图里、不含自环、
 * 不超规模）——语义校验（必填参数、端口类型、环检测）属于 `T4-3`，跑在图执行前。
 * @param nodes - 待校验节点。
 * @param edges - 待校验连线。
 * @returns 归一化后的节点与连线。
 * @throws {Error} 结构不合法时。
 */
export declare function normalizeGraph(nodes: unknown, edges: unknown): {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
};
/** 取一个节点种类的事实。 */
export declare function nodeSpec(kind: WorkflowNodeKind): NodeKindSpec;
/** 该种类当前能否加入画布。 */
export declare function isRunnable(kind: WorkflowNodeKind): boolean;
/** 新节点的默认参数（取自目录）。 */
export declare function defaultParams(kind: WorkflowNodeKind): Record<string, NodeParamValue>;
/** 一次运行里单个节点的记录。 */
export interface WorkflowRunNodeRecord {
    readonly nodeId: string;
    readonly kind: WorkflowNodeKind;
    readonly status: 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
    readonly startedAt: string;
    readonly finishedAt?: string;
    readonly outputPath?: string;
    readonly bytes?: number;
    readonly error?: string;
    /** 实际尝试次数（瞬时失败会自动重试，`T4-4`/上游中断类错误的兜底）。 */
    readonly attempts?: number;
    /** 这条结果来自跨运行缓存（没有真的调外部生成，`R-FLW-5`）。 */
    readonly cached?: boolean;
}
/** 一次运行的记录（含图快照，`R-FLW-6`）。 */
export interface WorkflowRunRecord {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly workflowId: string;
    readonly projectId: string;
    readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled';
    /** 图快照：后续改图不影响已发生的运行记录 */
    readonly graph: {
        readonly nodes: readonly WorkflowNode[];
        readonly edges: readonly WorkflowEdge[];
    };
    readonly nodeRuns: readonly WorkflowRunNodeRecord[];
    readonly startedAt: string;
    readonly finishedAt?: string;
    readonly error?: string;
}
/** 一个内置模板（`R-FLW-7`）：实例化后应当**可直接跑**，所以必填项都带示例值。 */
export interface WorkflowTemplate {
    readonly id: string;
    readonly labelKey: string;
    readonly nodes: readonly {
        readonly kind: WorkflowNodeKind;
        readonly params?: Record<string, NodeParamValue>;
    }[];
    /** 连线用节点下标表示，实例化时再换成真实 id。 */
    readonly edges: readonly (readonly [number, number])[];
}
/**
 * 内置模板：文案→分镜→图→视频 / 图片→视频→字幕→渲染 / 参考视频复刻（`compare`）。
 *
 * 示例值只求"能跑通并看清链路"，用户改提示词即可；端口类型与必填项都满足校验。
 */
export declare const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[];
/** 一条图校验问题（`T4-3`）。 */
export interface WorkflowIssue {
    readonly code: 'missing-required' | 'port-mismatch' | 'self-loop' | 'dangling-edge' | 'cycle' | 'not-runnable';
    readonly message: string;
    readonly nodeId?: string;
    readonly edgeId?: string;
}
/** 图校验结果。 */
export interface WorkflowValidation {
    readonly ok: boolean;
    readonly issues: readonly WorkflowIssue[];
}
/**
 * 校验整张图：必填参数、端口类型、自环、悬空连线、环、planned 节点不可运行。
 *
 * 纯函数、不碰 IO——画布用它做即时反馈，宿主在运行前用同一份逻辑拒绝（`R-FLW-3`）。
 * @param nodes - 图里的节点。
 * @param edges - 图里的连线。
 * @returns 是否可运行，以及全部问题。
 */
export declare function validateWorkflow(nodes: readonly WorkflowNode[], edges: readonly WorkflowEdge[]): WorkflowValidation;
/** 目录里可用 / 预留的数量，供 UI 显示与测试断言。 */
export declare function catalogSummary(): {
    runnable: number;
    planned: number;
};
