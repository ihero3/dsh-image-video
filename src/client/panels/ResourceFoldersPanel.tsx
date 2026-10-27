/**
 * `B-7` 资源分类 + 重绘计划面板。
 *
 * - 分类侧栏：`listResourcesWithFolders` 返回的 `folders` 做过滤（含「未分类」）。
 * - 重绘计划：`resources/plan-redraw` 零花费——不调模型，只给提示词/参考图/建议与提醒。
 * - 发送融合：把建议提示词带回融合表单（宿主据此重绘，不在此面板改资源）。
 *
 * 这是个"分类 + 重绘"伴侣视图；与 `G2` 三栏物料库互补，不重复编辑能力。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ResourceRedrawPlan, WorkbenchApi } from '../api.ts'
import type { ResourceRecord } from '../../workbench/records.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface ResourceFoldersPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId?: string
  /** 把重绘建议提示词带回融合表单（可选）。 */
  readonly onSendToCompose?: (prompt: string) => void
}

export function ResourceFoldersPanel({ api, t, projectId, onSendToCompose }: ResourceFoldersPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [resources, setResources] = useState<readonly ResourceRecord[]>([])
  const [folders, setFolders] = useState<readonly string[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('__all__')
  const [expanded, setExpanded] = useState<string | undefined>(undefined)
  const [plan, setPlan] = useState<ResourceRedrawPlan | undefined>(undefined)
  const [planBusy, setPlanBusy] = useState(false)
  const [applied, setApplied] = useState<string | undefined>(undefined)

  const load = async () => {
    if (projectId === undefined) { setResources([]); setFolders([]); return }
    setLoading(true); setError(undefined)
    try {
      const result = await api.listResourcesWithFolders(projectId)
      setResources(result.resources)
      setFolders(result.folders)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [projectId])

  const visible = resources.filter(resource => {
    if (activeFolder === '__all__') return true
    if (activeFolder === '__none__') return resource.folder === undefined || resource.folder === ''
    return resource.folder === activeFolder
  })

  const openPlan = async (resource: ResourceRecord) => {
    setPlanBusy(true); setPlan(undefined); setApplied(undefined)
    try {
      setPlan(await api.planResourceRedraw(resource.id))
      setExpanded(resource.id)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setPlanBusy(false)
    }
  }

  return (
    <div className="iv-res-folders" data-res-folders="true">
      <div className="iv-fusion-head">
        <span className="iv-chip"><Icon name="folder" size={11} />{t('resourceFoldersTitle')}</span>
        <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-res-folders-reload="true" disabled={loading} onClick={() => { void load() }}>↻</button>
      </div>
      {error !== undefined ? <span className="iv-meta iv-meta--warn" data-res-folders-error="true">{error}</span> : null}
      <div className="iv-folder-bar" data-folder-bar="true">
        <button type="button" className={`iv-chip iv-chip--toggle${activeFolder === '__all__' ? ' on' : ''}`} data-folder="__all__" onClick={() => { setActiveFolder('__all__') }}>{t('resourceFolderAll')}</button>
        <button type="button" className={`iv-chip iv-chip--toggle${activeFolder === '__none__' ? ' on' : ''}`} data-folder="__none__" onClick={() => { setActiveFolder('__none__') }}>{t('resourceFolderUncategorized')}</button>
        {folders.map(folder => (
          <button key={folder} type="button" className={`iv-chip iv-chip--toggle${activeFolder === folder ? ' on' : ''}`} data-folder={folder} onClick={() => { setActiveFolder(folder) }}>{folder}</button>
        ))}
      </div>
      <div className="iv-folder-list" data-folder-list="true">
        {visible.length === 0
          ? <span className="iv-meta">{t('resourceFolderNone')}</span>
          : visible.map(resource => (
            <div key={resource.id} className="iv-folder-row" data-res-row={resource.id}>
              <div className="iv-folder-row-head">
                <span className="iv-folder-name">{resource.name}</span>
                {resource.folder !== undefined && resource.folder !== '' ? <span className="iv-chip iv-chip--sm">{resource.folder}</span> : null}
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-res-redraw={resource.id}
                  disabled={planBusy}
                  onClick={() => { void openPlan(resource) }}
                >
                  {t('redrawPlanRun')}
                </button>
              </div>
              {expanded === resource.id && plan !== undefined && plan.resource.id === resource.id
                ? (
                  <div className="iv-redraw-plan" data-redraw-plan="true">
                    <div><span className="iv-meta">{t('redrawPlanPromptLabel')}：</span>{plan.prompt}</div>
                    <div><span className="iv-meta">{t('redrawPlanRefs')}：</span>{plan.referenceCount}</div>
                    <div><span className="iv-meta">{t('redrawPlanSuggestions')}：</span>{`${plan.suggestions.aspectRatio} ×${plan.suggestions.count}`}</div>
                    {plan.warnings.length > 0 ? <div className="iv-meta iv-meta--warn">{t('redrawPlanWarnings')}：{plan.warnings.join('；')}</div> : null}
                    {onSendToCompose !== undefined
                      ? (
                        <button
                          type="button"
                          className="iv-btn iv-btn--acc iv-btn--sm"
                          data-res-redraw-send={resource.id}
                          onClick={() => { onSendToCompose(plan.prompt); setApplied(resource.id) }}
                        >
                          {applied === resource.id ? t('redrawPlanApplied') : t('redrawPlanToForm')}
                        </button>
                      )
                      : null}
                  </div>
                )
                : null}
            </div>
          ))}
      </div>
    </div>
  )
}
