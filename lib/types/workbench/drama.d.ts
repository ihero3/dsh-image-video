/**
 * 漫剧 / 连续剧模板（Track A / A10，对应总任务书 §6.5）。
 *
 * 为什么单独放一个模块而不是塞进 `WORKFLOW_TEMPLATES`：
 * 那个数组直接被**客户端**渲染成模板卡片（属于 Track B 的地盘），往里加新模板需要
 * 同步新增界面文案 key（`templateDramaSeries`）。按协作规则：**先由 A 把数据层与
 * Agent 能力落地**，B 之后再补文案与卡片。
 *
 * 链路（全部是**可运行**节点，不掺 planned 以免"看起来能跑"）：
 *   本集剧情 → 剧本 → 分镜 → 定妆/首镜图 → 镜头视频 → 字幕 → 合成
 *   ＋ 一条独立的「角色基准」引用节点（选一个角色资源，供分镜/生成时比对）
 * 配音节点目前是 planned（`voice-synthesize`），等它实现后按同样方式接进来。
 */
import type { WorkflowNodeKind, WorkflowRecord } from './workflow.ts';
/** 模板里的节点（位置由实例化时自动排版）。 */
export interface DramaTemplateNode {
    readonly kind: WorkflowNodeKind;
    readonly params: Record<string, string | number | boolean>;
}
/** 模板定义。 */
export interface DramaTemplate {
    readonly id: string;
    /** 界面文案 key（**待 B 补**：`templateDramaSeries`）。 */
    readonly labelKey: string;
    readonly describe: string;
    readonly nodes: readonly DramaTemplateNode[];
    /** 连线，用节点下标表示（与 `WORKFLOW_TEMPLATES` 同一种写法）。 */
    readonly edges: readonly (readonly [number, number])[];
}
/** 漫剧/连续剧：单集链路模板。 */
export declare const DRAMA_SERIES_TEMPLATE: DramaTemplate;
/** 全部数据层模板。 */
export declare const DRAMA_TEMPLATES: readonly DramaTemplate[];
/**
 * 把模板实例化成工作流记录（自动排版节点位置）。
 * @param template - 模板。
 * @param projectId - 归属项目。
 * @param newId - id 生成器（测试可注入）。
 * @returns 可直接保存的工作流记录。
 */
export declare function instantiateTemplate(template: DramaTemplate, projectId: string, newId: () => string, now?: () => Date): WorkflowRecord;
