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
import type { WorkflowNodeKind, WorkflowRecord } from './workflow.ts'

/** 模板里的节点（位置由实例化时自动排版）。 */
export interface DramaTemplateNode {
  readonly kind: WorkflowNodeKind
  readonly params: Record<string, string | number | boolean>
}

/** 模板定义。 */
export interface DramaTemplate {
  readonly id: string
  /** 界面文案 key（**待 B 补**：`templateDramaSeries`）。 */
  readonly labelKey: string
  readonly describe: string
  readonly nodes: readonly DramaTemplateNode[]
  /** 连线，用节点下标表示（与 `WORKFLOW_TEMPLATES` 同一种写法）。 */
  readonly edges: readonly (readonly [number, number])[]
}

/** 漫剧/连续剧：单集链路模板。 */
export const DRAMA_SERIES_TEMPLATE: DramaTemplate = {
  id: 'drama-series',
  labelKey: 'templateDramaSeries',
  describe: '漫剧/连续剧单集：本集剧情 → 剧本 → 分镜 → 定妆图 → 镜头视频 → 字幕 → 合成（角色基准引用请在运行时挂一个 resource-reference 节点）',
  nodes: [
    { kind: 'creative-input', params: { brief: '本集剧情：雨夜便利店，主角捡到一只会说话的猫，结尾留悬念' } },
    { kind: 'script', params: { text: '第 1 集：雨夜。主角推门进便利店，收银台后传来一声猫叫。' } },
    { kind: 'storyboard', params: { shots: 4, note: '每镜 5 秒，冷色调雨夜，特写与中景交替' } },
    { kind: 'image-generate', params: { prompt: '角色定妆照：雨夜便利店门口，暖黄店招，湿发，半身，电影感' } },
    { kind: 'video-generate', params: { prompt: '镜头缓慢推近，雨滴滑落玻璃，角色转头看向店内', duration: 5, compare: false } },
    { kind: 'subtitle', params: { text: '第 1 集 · 雨夜的猫' } },
    { kind: 'render', params: { note: '合成本集成片（1080P）' } },
  ],
  // 0 剧情 → 1 剧本 → 2 分镜 → 3 定妆图 → 4 镜头 → 5 字幕 → 6 合成
  // 角色/场景基准（resource-reference）需要真人选资源，所以不硬塞进模板：
  // 运行时先挂一个引用节点再把它的描述写进 prompt（模板说明里会提示）。
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
}

/** 全部数据层模板。 */
export const DRAMA_TEMPLATES: readonly DramaTemplate[] = [DRAMA_SERIES_TEMPLATE]

/**
 * 把模板实例化成工作流记录（自动排版节点位置）。
 * @param template - 模板。
 * @param projectId - 归属项目。
 * @param newId - id 生成器（测试可注入）。
 * @returns 可直接保存的工作流记录。
 */
export function instantiateTemplate(
  template: DramaTemplate,
  projectId: string,
  newId: () => string,
  now: () => Date = () => new Date(),
): WorkflowRecord {
  const stamp = now().toISOString()
  return {
    schemaVersion: 1,
    id: newId(),
    projectId,
    name: template.describe.split('：')[0] ?? template.id,
    nodes: template.nodes.map((node, index) => ({
      id: `${template.id}-${index}`,
      kind: node.kind,
      position: { x: (index % 4) * 220, y: Math.floor(index / 4) * 160 },
      params: node.params,
    })),
    edges: template.edges.map(([from, to]) => ({
      id: `${template.id}-${from}-${to}`,
      source: `${template.id}-${from}`,
      target: `${template.id}-${to}`,
    })),
    createdAt: stamp,
    updatedAt: stamp,
  }
}
