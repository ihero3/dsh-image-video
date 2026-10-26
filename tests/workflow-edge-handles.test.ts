/**
 * 画布边持久化端口 id（真机回归修复）。
 *
 * 问题现象：画布"有节点没连线"——重启后加载的子图边全部消失。
 * 根因：节点 handle 没有 id，React Flow v12 对 `undefined` 与 `null` 的 handle 匹配是严格的；
 * 边若不带 handle id，存盘再加载后解析不到端点，被**静默丢弃**（会话内新建的边不丢，所以难复现）。
 *
 * 修复：边持久化 `sourceHandle: 'out'` / `targetHandle: 'in'`，旧数据读取时补默认值。
 */
import { describe, expect, it } from 'vitest'
import {
  normalizeGraph, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE,
} from '../src/workbench/workflow.ts'

const nodes = [
  { id: 'a', kind: 'image-generate', position: { x: 0, y: 0 }, params: {} },
  { id: 'b', kind: 'video-generate', position: { x: 200, y: 0 }, params: {} },
]

describe('工作流边的端口 id（回归）', () => {
  it('旧数据（边不带 handle）读取时补默认值 out / in', () => {
    const graph = normalizeGraph(nodes, [{ id: 'e1', source: 'a', target: 'b' }])
    expect(graph.edges[0]).toMatchObject({
      id: 'e1', source: 'a', target: 'b',
      sourceHandle: WORKFLOW_SOURCE_HANDLE, targetHandle: WORKFLOW_TARGET_HANDLE,
    })
  })

  it('显式 handle 原样保留；非法值回落到默认（不把脏值送进画布）', () => {
    const kept = normalizeGraph(nodes, [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }])
    expect(kept.edges[0]).toMatchObject({ sourceHandle: 'out', targetHandle: 'in' })
    const junk = normalizeGraph(nodes, [{ id: 'e2', source: 'a', target: 'b', sourceHandle: 42, targetHandle: '' }])
    expect(junk.edges[0]).toMatchObject({ sourceHandle: 'out', targetHandle: 'in' })
  })

  it('边仍然必须连接图内两个节点（这条校验不被放松）', () => {
    expect(() => normalizeGraph(nodes, [{ id: 'x', source: 'a', target: 'ghost' }])).toThrowError(/two nodes in the graph/)
  })
})

