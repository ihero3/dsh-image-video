/**
 * 外部工作流适配：用 ComfyUI 官方保存格式与 API 格式的真实结构做样例，
 * 验证节点映射、未知节点保留、连线还原与格式识别。
 */
import { describe, expect, it } from 'vitest'
import { adaptExternalWorkflow, detectExternalFormat } from '../src/workbench/workflow-adapters.ts'
import { parseWorkflowFile } from '../src/client/workflow-io.ts'

/** ComfyUI UI 保存格式：标准文生图 + 两个无法映射的基础节点。 */
const comfyUI = {
  id: 'workflow-uuid',
  last_node_id: 5,
  last_link_id: 4,
  nodes: [
    { id: 1, type: 'CheckpointLoaderSimple', pos: [0, 0], widgets_values: ['sd_xl_base_1.0.safetensors'], inputs: [], outputs: [{ links: [1, 2] }] },
    { id: 2, type: 'CLIPTextEncode', pos: [300, 0], widgets_values: ['beautiful scenery'], inputs: [{ name: 'clip', link: 1 }], outputs: [] },
    { id: 3, type: 'KSampler', pos: [600, 0], widgets_values: [42, 'randomize', 20, 8, 'euler', 'normal', 1], inputs: [{ name: 'model', link: 2 }, { name: 'positive', link: 3 }], outputs: [] },
    { id: 4, type: 'VAEDecode', pos: [900, 0], widgets_values: [], inputs: [{ name: 'samples', link: 4 }], outputs: [] },
    { id: 5, type: 'SaveImage', pos: [1200, 0], widgets_values: ['ComfyUI'], inputs: [], outputs: [] },
  ],
  links: [[1, 1, 1, 2, 0, 'CLIP'], [2, 1, 0, 3, 0, 'MODEL'], [3, 2, 0, 3, 1, 'CONDITIONING'], [4, 3, 0, 4, 0, 'LATENT']],
}

/** ComfyUI API 格式（节点 id → class_type + inputs，连线写作 ["上游id", 槽位]）。 */
const comfyAPI = {
  '3': { inputs: { seed: 42, steps: 20, model: ['4', 0], positive: ['6', 0] }, class_type: 'KSampler', _meta: { title: 'KSampler' } },
  '4': { inputs: { ckpt_name: 'v1-5.safetensors' }, class_type: 'CheckpointLoaderSimple' },
  '6': { inputs: { text: 'beautiful scenery', clip: ['4', 1] }, class_type: 'CLIPTextEncode', _meta: { title: 'Positive Prompt' } },
}

describe('workflow-adapters', () => {
  it('识别三种格式', () => {
    expect(detectExternalFormat({ format: 'dsh-image-video-workflow', nodes: [], edges: [] })).toBe('native')
    expect(detectExternalFormat(comfyUI)).toBe('comfy-ui')
    expect(detectExternalFormat(comfyAPI)).toBe('comfy-api')
    expect(() => detectExternalFormat({ hello: 'world' })).toThrow('无法识别的工作流格式')
  })

  it('UI 格式：常见节点映射、未知节点保留原始 JSON、连线还原', () => {
    const result = adaptExternalWorkflow(comfyUI)
    expect(result.report.format).toBe('comfy-ui')
    expect(result.nodes.map(node => node.kind)).toEqual(['external', 'script', 'image-generate', 'external', 'preview'])
    expect(result.report.mapped).toContain('CLIPTextEncode')
    expect(result.report.mapped).toContain('KSampler')
    expect(result.report.preserved).toEqual(['CheckpointLoaderSimple', 'VAEDecode'])
    expect(result.nodes.find(node => node.kind === 'script')?.params.text).toBe('beautiful scenery')
    expect(result.edges).toHaveLength(4)
    expect(result.edges.map(edge => `${edge.source}->${edge.target}`)).toContain('2->3')

    const external = result.nodes.find(node => node.kind === 'external')!
    expect(external.params.classType).toBe('CheckpointLoaderSimple')
    expect(JSON.parse(String(external.params.config))).toMatchObject({ type: 'CheckpointLoaderSimple', pos: [0, 0] })
    expect(result.report.warnings.some(text => text.includes('保留'))).toBe(true)
  })

  it('API 格式：从 inputs 提取连线，并为无布局的节点生成位置', () => {
    const result = adaptExternalWorkflow(comfyAPI)
    expect(result.report.format).toBe('comfy-api')
    expect(result.nodes).toHaveLength(3)
    expect(result.nodes.find(node => node.id === '6')?.kind).toBe('script')
    expect(result.edges.map(edge => `${edge.source}->${edge.target}`).sort())
      .toEqual(['4->3', '4->6', '6->3'])
    for (const node of result.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
  })

  it('统一导入入口按格式自动分流', () => {
    const ui = parseWorkflowFile(JSON.stringify(comfyUI))
    expect(ui.report?.format).toBe('comfy-ui')
    expect(ui.nodes).toHaveLength(5)

    const api = parseWorkflowFile(JSON.stringify(comfyAPI))
    expect(api.report?.format).toBe('comfy-api')
    expect(api.edges).toHaveLength(3)

    // 原生格式（即使没有 format 标识）不应被误判成 ComfyUI
    const native = parseWorkflowFile(JSON.stringify({
      nodes: [{ id: 'a', kind: 'preview', position: { x: 0, y: 0 }, params: {} }], edges: [],
    }))
    expect(native.report).toBeUndefined()
    expect(native.nodes[0]?.kind).toBe('preview')
  })

  it('项目包 manifest.json 可导入其中的工作流（多份时给提示）', () => {
    const manifest = {
      formatVersion: 3, plugin: 'dsh-image-video',
      workflows: [
        { schemaVersion: 1, id: 'wfl-a', name: '主流程', nodes: [{ id: 'p', kind: 'preview', position: { x: 0, y: 0 }, params: {} }], edges: [] },
        { schemaVersion: 1, id: 'wfl-b', name: '备用流程', nodes: [], edges: [] },
      ],
    }
    expect(detectExternalFormat(manifest)).toBe('package')
    const result = parseWorkflowFile(JSON.stringify(manifest))
    expect(result.name).toBe('主流程')
    expect(result.nodes).toHaveLength(1)
    expect(result.report?.format).toBe('package')
    expect(result.report?.warnings.some(text => text.includes('2 份工作流'))).toBe(true)
  })

  it('LiblibAI 风格的 UI 文件（带 version / 私有节点）也能导入', () => {
    const liblib = {
      ...comfyUI,
      version: '2.4',
      nodes: [...comfyUI.nodes, { id: 9, type: 'LiblibModelLoader', pos: [0, 400], widgets_values: ['model.safetensors'], inputs: [] }],
    }
    const result = adaptExternalWorkflow(liblib)
    expect(result.nodes).toHaveLength(6)
    expect(result.report.preserved).toContain('LiblibModelLoader')
  })
})
