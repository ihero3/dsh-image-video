/**
 * 工作流 JSON 导入/导出：往返一致；格式、版本、节点种类、连线端点逐一校验；
 * ComfyUI 原生格式（type/pos/widgets_values）不属于本节点目录，必须明确拒绝。
 */
import { describe, expect, it } from 'vitest'
import { defaultParams, type WorkflowRecord } from '../src/workbench/workflow.ts'
import { parseWorkflowFile, serializeWorkflow, WORKFLOW_FILE_FORMAT } from '../src/client/workflow-io.ts'

const STAMP = '2026-11-09T00:00:00.000Z'

function sample(): WorkflowRecord {
  return {
    schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '测试流',
    nodes: [
      { id: 'n1', kind: 'script', position: { x: 10, y: 20 }, params: { ...defaultParams('script'), text: '开场' } },
      { id: 'n2', kind: 'preview', position: { x: 300, y: 20 }, params: defaultParams('preview') },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    createdAt: STAMP, updatedAt: STAMP,
  }
}

describe('workflow-io', () => {
  it('roundtrip 保留节点、参数、位置与连线', () => {
    const parsed = parseWorkflowFile(serializeWorkflow(sample()))
    expect(parsed.name).toBe('测试流')
    expect(parsed.nodes).toEqual(sample().nodes.map(node => ({
      ...node,
      params: node.kind === 'script' ? { ...defaultParams('script'), text: '开场' } : defaultParams('preview'),
    })))
    expect(parsed.edges).toEqual([{ id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' }])
  })

  it('接受 links 作为 edges 的兼容字段名', () => {
    const file = JSON.parse(serializeWorkflow(sample())) as Record<string, unknown>
    file['links'] = file['edges']
    delete file['edges']
    expect(parseWorkflowFile(JSON.stringify(file)).edges).toHaveLength(1)
  })

  it('拒绝非 JSON / 非对象 / 其他格式 / 不支持的版本', () => {
    expect(() => parseWorkflowFile('not json')).toThrow('不是合法的 JSON')
    expect(() => parseWorkflowFile('[]')).toThrow('必须是 JSON 对象')
    expect(() => parseWorkflowFile(JSON.stringify({ format: 'other', nodes: [], edges: [] }))).toThrow('不支持的工作流格式')
    expect(() => parseWorkflowFile(JSON.stringify({ format: WORKFLOW_FILE_FORMAT, version: 99, nodes: [], edges: [] })))
      .toThrow('不支持的工作流文件版本')
  })

  it('拒绝未知节点种类（含 ComfyUI 原生节点）与悬空连线', () => {
    const comfyId = JSON.stringify({
      nodes: [{ id: 1, type: 'KSampler', pos: [0, 0], widgets_values: [20] }], links: [],
    })
    expect(() => parseWorkflowFile(comfyId)).toThrow('non-empty id')
    const comfyKind = JSON.stringify({
      nodes: [{ id: 'n1', type: 'KSampler', pos: { x: 0, y: 0 }, widgets_values: [20] }], links: [],
    })
    expect(() => parseWorkflowFile(comfyKind)).toThrow('unknown workflow node kind')

    const file = JSON.parse(serializeWorkflow(sample())) as Record<string, unknown>
    file['edges'] = [{ id: 'bad', source: 'n1', target: 'missing' }]
    expect(() => parseWorkflowFile(JSON.stringify(file))).toThrow('connect two nodes')
  })

  it('导出内容带格式标识与版本', () => {
    const file = JSON.parse(serializeWorkflow(sample())) as Record<string, unknown>
    expect(file['format']).toBe(WORKFLOW_FILE_FORMAT)
    expect(file['version']).toBe(1)
    expect(file['exportedAt']).toBeTypeOf('string')
  })
})
