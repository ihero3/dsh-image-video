/**
 * B-10 提示词库面板：库列表/保存/删除 + 从素材提取。
 * 关键交互：prompts/extract 失败时展示"需配置视觉模型"提示，而非标记为失败。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi, PromptRecord, ExtractedPrompt } from '../api.ts'
import type { AssetRecord } from '../../workbench/records.ts'

interface PromptLibraryPanelProps {
  readonly api: WorkbenchApi
  readonly projectId: string
  readonly assets: readonly AssetRecord[]
  readonly onUsePrompt: (text: string) => void
  readonly t: (key: string) => string
}

export function PromptLibraryPanel({ api, assets, onUsePrompt, t }: PromptLibraryPanelProps) {
  const [prompts, setPrompts] = useState<PromptRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [needSetupHint, setNeedSetupHint] = useState<string | undefined>(undefined)

  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [draftName, setDraftName] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftTags, setDraftTags] = useState('')

  const load = async () => {
    setLoading(true); setError(undefined)
    try { setPrompts(await api.listPrompts()) }
    catch (thrown) { setError(thrown instanceof Error ? thrown.message : String(thrown)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const startNew = () => {
    setEditingId(undefined); setDraftName(''); setDraftText(''); setDraftTags('')
  }

  const startEdit = (p: PromptRecord) => {
    setEditingId(p.id); setDraftName(p.name); setDraftText(p.text); setDraftTags((p.tags ?? []).join(', '))
  }

  const saveDraft = async () => {
    if (draftName.trim() === '' || draftText.trim() === '') { return }
    try {
      const tags = draftTags.split(',').map(s => s.trim()).filter(Boolean)
      const saved = await api.savePrompt({ id: editingId, name: draftName.trim(), text: draftText.trim(), tags })
      setEditingId(saved.id); await load()
    } catch (thrown) { setError(thrown instanceof Error ? thrown.message : String(thrown)) }
  }

  const remove = async (id: string) => {
    try { await api.removePrompt(id); await load() }
    catch (thrown) { setError(thrown instanceof Error ? thrown.message : String(thrown)) }
  }

  /**
   * B-10 关键：从素材提取提示词。
   * 失败时显示"需配置视觉模型"提示，**不是失败状态** —— 用户可手动编辑。
   */
  const extractFromAsset = async (asset: AssetRecord) => {
    setError(undefined); setNeedSetupHint(undefined)
    try {
      const result: ExtractedPrompt = await api.extractPrompt({ projectId: asset.projectId, assetId: asset.id })
      const assembled = result.text ?? [result.style, result.subject, result.material, result.details].filter(Boolean).join('，')
      if (assembled) {
        setDraftText(assembled)
        if (!draftName) setDraftName(asset.name.replace(/\.[^.]+$/, ''))
      } else {
        setNeedSetupHint(t('promptExtractEmpty'))
      }
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      // 视觉模型未注入 → 提示"需配置"，不是错误
      if (/visual|model|provider|vision/i.test(message)) {
        setNeedSetupHint(t('promptNeedSetup'))
      } else {
        setError(message)
      }
    }
  }

  const imageAssets = assets.filter(a => a.kind === 'image')

  return (
    <div className="iv-prompts" data-prompts-panel="true">
      <div className="iv-prompts-head">
        <button type="button" className="iv-btn iv-btn--sm" onClick={startNew}>
          <Icon name="plus" />{t('promptNew')}
        </button>
        <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { void load() }}>
          <Icon name="refresh" />{t('promptRefresh')}
        </button>
      </div>

      {error && <div className="iv-notice iv-notice--err" role="alert">{error}</div>}
      {needSetupHint && (
        <div className="iv-notice iv-notice--info" role="status">
          <Icon name="info" />{needSetupHint}
        </div>
      )}

      {/* 从素材提取区 */}
      <div className="iv-prompts-extract">
        <span className="iv-meta">{t('promptExtractLabel')}：</span>
        {imageAssets.length === 0
          ? <span className="iv-meta">{t('promptNoImageAssets')}</span>
          : (
            <select
              className="iv-select"
              aria-label={t('promptExtractLabel')}
              onChange={e => { const a = imageAssets.find(x => x.id === e.target.value); if (a) { void extractFromAsset(a) } }}
              defaultValue=""
            >
              <option value="" disabled>{t('promptPickAsset')}</option>
              {imageAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
      </div>

      {/* 编辑区 */}
      {(editingId !== undefined || draftName || draftText) && (
        <div className="iv-prompts-edit">
          <input
            className="iv-input"
            placeholder={t('promptNamePlaceholder')}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
          />
          <textarea
            className="iv-input"
            rows={3}
            placeholder={t('promptTextPlaceholder')}
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
          />
          <input
            className="iv-input"
            placeholder={t('promptTagsPlaceholder')}
            value={draftTags}
            onChange={e => setDraftTags(e.target.value)}
          />
          <div className="iv-prompts-edit-actions">
            <button type="button" className="iv-btn iv-btn--primary iv-btn--sm" onClick={() => { void saveDraft() }}>
              {t('promptSave')}
            </button>
            <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { startNew(); setEditingId(undefined) }}>
              {t('promptCancel')}
            </button>
          </div>
        </div>
      )}

      {/* 库列表 */}
      <div className="iv-prompts-list">
        {loading
          ? <div className="iv-meta">{t('loading')}…</div>
          : prompts.length === 0
            ? <div className="iv-empty">{t('promptEmpty')}</div>
            : prompts.map(p => (
              <div key={p.id} className="iv-prompt-card">
                <div className="iv-prompt-card-head">
                  <strong>{p.name}</strong>
                  <div className="iv-prompt-card-actions">
                    <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { onUsePrompt(p.text) }}>
                      {t('promptUse')}
                    </button>
                    <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => startEdit(p)}>
                      {t('promptEdit')}
                    </button>
                    <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { void remove(p.id) }}>
                      {t('promptRemove')}
                    </button>
                  </div>
                </div>
                <div className="iv-prompt-card-text">{p.text}</div>
                {p.tags && p.tags.length > 0 && (
                  <div className="iv-prompt-card-tags">
                    {p.tags.map(tag => <span key={tag} className="iv-chip">{tag}</span>)}
                  </div>
                )}
              </div>
            ))
        }
      </div>
    </div>
  )
}
