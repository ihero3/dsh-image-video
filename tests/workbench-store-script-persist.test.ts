// @vitest-environment jsdom
/**
 * 共享剧本文本 / 导入文件的本地草稿持久化：刷新或重启后仍要能接着写。
 * 用不同的 owner 对象模拟页面重载（内存 WeakMap 快照随之销毁）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { getWorkbenchField, setWorkbenchField, switchPipelineEpisode } from '../src/client/workbench-store.ts'

describe('剧本草稿持久化', () => {
  beforeEach(() => { localStorage.clear() })

  it('重启后剧本文本还在（内存快照丢失也不影响）', () => {
    const before = {}
    setWorkbenchField(before, 'pipelineScript', '雨夜街头，林夏撑伞走来')

    const after = {}
    expect(getWorkbenchField(after, 'pipelineScript')).toBe('雨夜街头，林夏撑伞走来')
  })

  it('按剧集分别保存，切换与重启后各自恢复', () => {
    const owner = {}
    switchPipelineEpisode(owner, 'ep-1')
    setWorkbenchField(owner, 'pipelineScript', '第一集剧本')
    switchPipelineEpisode(owner, 'ep-2')
    setWorkbenchField(owner, 'pipelineScript', '第二集剧本')

    const reloaded = {}
    switchPipelineEpisode(reloaded, 'ep-1')
    expect(getWorkbenchField(reloaded, 'pipelineScript')).toBe('第一集剧本')
    switchPipelineEpisode(reloaded, 'ep-2')
    expect(getWorkbenchField(reloaded, 'pipelineScript')).toBe('第二集剧本')
  })

  it('导入中断的文件标成失败而不是假装完成', () => {
    const owner = {}
    setWorkbenchField(owner, 'pipelineImportedFiles', [
      { name: 'script.txt', text: '正文', status: 'importing' },
    ])
    const reloaded = {}
    const files = getWorkbenchField(reloaded, 'pipelineImportedFiles')
    expect(files[0]?.status).toBe('failed')
    expect(files[0]?.error).toContain('重新导入')
  })

  it('localStorage 不可用时编辑仍然正常', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota exceeded') }
    try {
      const owner = {}
      expect(() => setWorkbenchField(owner, 'pipelineScript', '继续写')).not.toThrow()
      expect(getWorkbenchField(owner, 'pipelineScript')).toBe('继续写')
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
