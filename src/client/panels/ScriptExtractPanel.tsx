/**
 * 剧本生成页的提取分区（`B-23`）：角色 / 场景 / 道具·服装。
 *
 * 三个分区是同一套流程：来源是**当前集的剧本**加上导入文件的原文（共享 store 里
 * 长期保留的那份），交给文本模型提取候选，用户逐条决定是否写进资源库；入库走
 * 既有的 `resources/create`，因此角色 / 场景资源能直接被分镜生成与出图引用。
 *
 * 提取要求模型、且必须有来源（剧本或导入文件）：缺一个就只禁用按钮并说明原因，
 * 不发请求。导入的文件名与原文跨页签保留，不会切走一次就消失。
 */
import { useRef, useState } from 'react'
import type { ResourceKind, ResourceRecord } from '../../workbench/records.ts'
import type { ExtractCategory, ExtractItem } from '../../workbench/entity-extract.ts'
import type { WorkbenchApi } from '../api.ts'
import { Icon } from '../icons.tsx'
import { useWorkbenchField } from '../workbench-store.ts'
import { importScriptFilesShared } from '../script-import-shared.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

/** 分区 → 标题 / 说明 / 入库时的资源类型。 */
const SECTIONS: Record<ExtractCategory, {
  readonly title: WorkbenchLocaleKey
  readonly desc: WorkbenchLocaleKey
  readonly kind: ResourceKind
}> = {
  role: { title: 'extractRoleTitle', desc: 'extractRoleDesc', kind: 'role' },
  scene: { title: 'extractSceneTitle', desc: 'extractSceneDesc', kind: 'scene' },
  prop: { title: 'extractPropTitle', desc: 'extractPropDesc', kind: 'prop' },
}

/** Props of one extraction tab. */
export interface ScriptExtractPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly category: ExtractCategory
  /** 当前剧集；没有项目时只给提示，不发请求。 */
  readonly projectId?: string
  /** 提取来源之一：当前集剧本原文。 */
  readonly script: string
  /** 已选文本模型；缺省时不能提取（提取必须走模型）。 */
  readonly model?: { readonly provider: string, readonly model: string }
  /** 同类资源（用来标出「已在资源库」）。 */
  readonly existing: readonly ResourceRecord[]
  /** 入库成功后刷新资源列表。 */
  readonly onCreated: () => void | Promise<void>
  /** 顶部提示（成功与失败都走宿主的通知条）。 */
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/**
 * 一个提取分区：说明 + 文件输入 + 提取按钮 + 候选列表（逐条加入资源库）。
 * @param props - 见 {@link ScriptExtractPanelProps}。
 */
export function ScriptExtractPanel(props: ScriptExtractPanelProps) {
  const { api, t, category, projectId, script, model, existing, onCreated, onNotice } = props
  const section = SECTIONS[category]
  const [items, setItems] = useState<readonly ExtractItem[]>([])
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState('')
  const [error, setError] = useState<string>()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string>()
  // 与「剧本分段」共享同一份导入文件：文件名和原文都长期留着
  const [importedFiles, setImportedFiles] = useWorkbenchField(api, 'pipelineImportedFiles')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const importedText = importedFiles
    .filter(file => file.status === 'done' && file.text.trim() !== '')
    .map(file => file.text)
    .join('\n\n')
  const source = [script, importedText].filter(part => part.trim() !== '').join('\n\n')
  const ready = projectId !== undefined && source.trim() !== '' && model !== undefined

  /** 导入文件既进共享列表（文件名/原文常驻），也直接成为本分区的提取输入。 */
  const importFiles = async (files: readonly File[]): Promise<void> => {
    setImporting(true); setImportError(undefined)
    try {
      const { failures } = await importScriptFilesShared(api, files, setImportedFiles)
      if (failures.length > 0) setImportError(failures.join('；'))
      else onNotice(t('pipelineImportDone').replace('{name}', files.map(file => file.name).join('；')), 'info')
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setImporting(false)
    }
  }

  const run = async (): Promise<void> => {
    if (!ready || model === undefined) return
    setBusy(true); setError(undefined)
    try {
      const result = await api.extractEntities({
        script: source,
        category,
        provider: model.provider,
        model: model.model,
      })
      setItems(result.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const add = async (item: ExtractItem): Promise<void> => {
    if (projectId === undefined) return
    setAdding(item.name); setError(undefined)
    try {
      await api.createResource({
        projectId,
        kind: section.kind,
        name: item.name,
        ...item.note === '' ? {} : { note: item.note },
      })
      onNotice(t('extractAdded').replace('{name}', item.name), 'info')
      await onCreated()
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    } finally {
      setAdding('')
    }
  }

  return (
    <div className="iv-sub" data-script-extract={category}>
      <div className="iv-sub-head">
        <span className="iv-sub-title">{t(section.title)}</span>
        <span className="iv-meta">{t(section.desc)}</span>
      </div>
      <div className="iv-plan-row">
        <span className="iv-meta" data-extract-source="true">
          {source.trim() === ''
            ? t('extractNeedsScript')
            : importedText === '' ? t('extractSource') : t('extractSourceWithFiles')}
        </span>
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-extract-import="true"
          title={t('pipelineImportScriptHint')}
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon name="script" size={12} />
          {importing ? t('pipelineImporting') : t('pipelineImportScript')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx,.pdf"
          multiple
          hidden
          data-extract-file-input="true"
          onChange={event => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) void importFiles(files)
          }}
        />
        <button
          type="button"
          className="iv-btn iv-btn--acc iv-btn--sm"
          data-extract-run="true"
          disabled={!ready || busy}
          onClick={() => { void run() }}
        >
          {busy ? t('extractRunning') : t('extractRun')}
        </button>
      </div>
      {importedFiles.length === 0
        ? null
        : (
          <div className="iv-plan-row" data-extract-imported="true">
            <span className="iv-meta">{t('pipelineImportedLabel')}</span>
            {importedFiles.map(file => (
              <span
                className="iv-chip"
                key={file.name}
                data-extract-imported-item={file.name}
                title={file.error ?? file.name}
              >
                {file.name}
                {file.status === 'importing' ? ` · ${t('pipelineImporting')}` : ''}
                {file.status === 'failed' ? ` · ${t('pipelineImportFailedShort')}` : ''}
              </span>
            ))}
          </div>
        )}
      {importError !== undefined
        ? <div className="iv-notice iv-notice--err" role="alert" data-extract-import-error="true">{importError}</div>
        : null}
      {model === undefined
        ? <div className="iv-meta" data-extract-needs-model="true">{t('extractNeedsModel')}</div>
        : null}
      {projectId === undefined
        ? <div className="iv-meta" data-extract-needs-project="true">{t('extractNeedsProject')}</div>
        : null}
      {error !== undefined ? <div className="iv-notice iv-notice--err" role="alert" data-extract-error="true">{error}</div> : null}
      {items.length === 0
        ? <div className="iv-empty" data-extract-empty="true">{t('extractEmpty')}</div>
        : (
          <div className="iv-sub" data-extract-items="true">
            {items.map(item => {
              const already = existing.some(resource => resource.name === item.name)
              return (
                <div className="iv-plan-row" data-extract-item={item.name} key={item.name}>
                  <span className="iv-meta">
                    <strong>{item.name}</strong>{item.note === '' ? '' : ` · ${item.note}`}
                  </span>
                  {already
                    ? <span className="iv-chip" data-extract-existing="true">{t('extractExisting')}</span>
                    : (
                      <button
                        type="button"
                        className="iv-btn iv-btn--sm"
                        data-extract-add={item.name}
                        disabled={adding === item.name}
                        onClick={() => { void add(item) }}
                      >
                        {t('extractAdd')}
                      </button>
                    )}
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
