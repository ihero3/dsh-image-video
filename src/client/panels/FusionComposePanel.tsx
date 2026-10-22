/**
 * B-9 融合生图面板：多选角色/场景/物品 → 预览拼装 → 调 composeMedia → 结果进素材。
 * 与 quick mode 的 generate 功能并排：compose 按资源 id 拼装，更适合创作场景。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi, ComposeMediaResult } from '../api.ts'
import type { ResourceRecord, ResourceKind, AssetRecord } from '../../workbench/records.ts'

interface FusionComposePanelProps {
  readonly api: WorkbenchApi
  readonly projectId: string
  readonly resources: readonly ResourceRecord[]
  readonly onAssetCreated: (asset: AssetRecord) => void
  readonly t: (key: string) => string
}

export function FusionComposePanel({ api, projectId, resources, onAssetCreated, t }: FusionComposePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState<Record<ResourceKind, Set<string>>>({
    role: new Set(), scene: new Set(), prop: new Set(), other: new Set(), character: new Set(),
  } as Record<ResourceKind, Set<string>>)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [lastResult, setLastResult] = useState<ComposeMediaResult | undefined>(undefined)

  const toggle = (kind: ResourceKind, id: string) => {
    setSelected(prev => {
      const next = new Set(prev[kind])
      if (next.has(id)) next.delete(id); else next.add(id)
      return { ...prev, [kind]: next }
    })
  }

  const getSelectedIds = (kind: ResourceKind): string[] => Array.from(selected[kind] ?? [])
  const totalSelected = Object.values(selected).reduce((sum, set) => sum + set.size, 0)

  const runCompose = async () => {
    if (prompt.trim() === '') { setError(t('composeNeedsPrompt')); return }
    setBusy(true); setError(undefined); setLastResult(undefined)
    try {
      const result = await api.composeMedia({
        projectId,
        prompt: prompt.trim(),
        roles: getSelectedIds('role'),
        scenes: getSelectedIds('scene'),
        props: getSelectedIds('prop'),
      })
      setLastResult(result)
      if (result.asset) onAssetCreated(result.asset)
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      // B-9 交互：端点未落地 / 无生成适配器 都如实报错，不伪造
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const kinds: ResourceKind[] = ['role', 'scene', 'prop']
  const kindLabels: Record<string, string> = { role: t('kindRole'), scene: t('kindScene'), prop: t('kindProp') }

  return (
    <div className="iv-compose" data-compose-panel="true">
      <div className="iv-compose-grid">
        {kinds.map(kind => {
          const items = resources.filter(r => r.kind === kind)
          const selectedThis = selected[kind]
          return (
            <div key={kind} className="iv-compose-col">
              <h4 className="iv-compose-col-head">
                {kindLabels[kind]} <span className="iv-meta">({items.length})</span>
              </h4>
              {items.length === 0
                ? <div className="iv-empty">{t('composeEmptyHint')}</div>
                : (
                  <div className="iv-compose-items">
                    {items.map(r => {
                      const isOn = selectedThis.has(r.id)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`iv-chip${isOn ? ' on' : ''}`}
                          aria-pressed={isOn}
                          onClick={() => { toggle(kind, r.id) }}
                        >
                          {r.name}
                        </button>
                      )
                    })}
                  </div>
                )}
            </div>
          )
        })}
      </div>

      <div className="iv-compose-preview">
        <div className="iv-meta">{t('composeSelected')}: {totalSelected}</div>
        {totalSelected === 0
          ? <div className="iv-empty">{t('composeSelectHint')}</div>
          : (
            <div className="iv-compose-preview-chips">
              {kinds.flatMap(kind =>
                getSelectedIds(kind).map(id => {
                  const r = resources.find(x => x.id === id)
                  return r ? <span key={id} className="iv-chip on">{r.name}</span> : null
                })
              )}
            </div>
          )}
      </div>

      <textarea
        className="iv-input"
        rows={2}
        value={prompt}
        placeholder={t('composePromptPlaceholder')}
        disabled={busy}
        onChange={e => setPrompt(e.target.value)}
        style={{ resize: 'vertical' }}
      />

      {error && <div className="iv-notice iv-notice--err" role="alert">{error}</div>}
      {lastResult && (
        <div className="iv-notice iv-notice--ok">
          {t('composeDone')} {lastResult.asset?.name ?? t('composeAssetCreated')}
        </div>
      )}

      <button
        type="button"
        className="iv-btn iv-btn--primary"
        disabled={busy || (prompt.trim() === '' && totalSelected === 0)}
        onClick={runCompose}
      >
        {busy ? t('composeBusy') : t('composeRun')}
      </button>
    </div>
  )
}
