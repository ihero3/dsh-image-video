/**
 * 双技能库管理页：导演库与逆向库各自独立，内置技能只读但可以禁用。
 *
 * 导入源由宿主判定（本地路径 / https URL），这里只负责把输入原样提交并把
 * 宿主返回的错误如实展示；删除只删技能记录，宿主会先备份到 `_backup/`。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { SkillKind, SkillRecord } from '../../workbench/skills.ts'

export interface SkillLibraryPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
  /** 技能启用状态变化后刷新依赖它的界面（分段的 Skill 选择器）。 */
  readonly onSkillsChanged: () => Promise<void>
}

/** 两个库的展示顺序与文案键。 */
const KIND_META: Record<SkillKind, { readonly label: WorkbenchLocaleKey; readonly desc: WorkbenchLocaleKey }> = {
  director: { label: 'skillKindDirector', desc: 'skillKindDirectorDesc' },
  reverse: { label: 'skillKindReverse', desc: 'skillKindReverseDesc' },
}

export function SkillLibraryPanel(props: SkillLibraryPanelProps) {
  const { api, t, onNotice, onSkillsChanged } = props
  const [kind, setKind] = useState<SkillKind>('director')
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [source, setSource] = useState('')
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftPrompt, setDraftPrompt] = useState('')

  /** 读取当前库；失败保留旧列表并在顶部报原因。 */
  const load = async (target: SkillKind): Promise<void> => {
    setLoading(true)
    setError(undefined)
    try {
      setSkills(await api.listSkills(target))
    } catch (thrown) {
      setError(`${t('skillLoadFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(kind)
  }, [kind])

  /** 导入后刷新列表，并让依赖启用状态的界面一起更新。 */
  const importSkill = async (): Promise<void> => {
    const trimmed = source.trim()
    if (trimmed === '') return
    setBusyId('import')
    try {
      const imported = await api.importSkill({ kind, source: trimmed })
      onNotice(t('skillImportDone').replace('{name}', imported.name), 'info')
      setSource('')
      await load(kind)
      await onSkillsChanged()
    } catch (thrown) {
      onNotice(`${t('skillImportFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusyId(undefined)
    }
  }

  /** 启用 / 禁用：内置技能也允许。 */
  const toggle = async (skill: SkillRecord): Promise<void> => {
    setBusyId(skill.id)
    try {
      const updated = await api.toggleSkill(skill.id, !skill.enabled)
      setSkills(current => current.map(candidate => (candidate.id === updated.id ? updated : candidate)))
      await onSkillsChanged()
    } catch (thrown) {
      onNotice(`${t('skillLoadFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusyId(undefined)
    }
  }

  /** 删除用户技能；宿主会先备份，内置技能由宿主拒绝。 */
  const remove = async (skill: SkillRecord): Promise<void> => {
    if (!window.confirm(t('skillRemoveConfirm').replace('{name}', skill.name))) return
    setBusyId(skill.id)
    try {
      await api.removeSkill(skill.id)
      onNotice(t('skillRemoved').replace('{name}', skill.name), 'info')
      await load(kind)
      await onSkillsChanged()
    } catch (thrown) {
      onNotice(`${t('skillLoadFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusyId(undefined)
    }
  }

  /** 在文件管理器里打开技能目录。 */
  const reveal = async (skill: SkillRecord): Promise<void> => {
    try {
      const result = await api.revealSkill(skill.id)
      if (!result.ok) onNotice(result.reason ?? result.path, 'error')
    } catch (thrown) {
      onNotice(`${t('skillLoadFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    }
  }

  /** 手动新建一条技能。 */
  const saveDraft = async (): Promise<void> => {
    if (draftName.trim() === '' || draftPrompt.trim() === '') return
    setBusyId('create')
    try {
      const saved = await api.saveSkill({
        kind,
        name: draftName.trim(),
        prompt: draftPrompt.trim(),
        ...draftDescription.trim() === '' ? {} : { description: draftDescription.trim() },
      })
      onNotice(t('skillSaved').replace('{name}', saved.name), 'info')
      setDraftName('')
      setDraftDescription('')
      setDraftPrompt('')
      setCreating(false)
      await load(kind)
      await onSkillsChanged()
    } catch (thrown) {
      onNotice(`${t('skillImportFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusyId(undefined)
    }
  }

  return (
    <div className="iv-skill-library" data-skill-library="true">
      <span className="iv-meta">{t('skillsPaneDesc')}</span>

      <div className="iv-skill-bar">
        <div className="iv-skill-tabs" role="tablist" aria-label={t('skillsPaneTitle')}>
          {(['director', 'reverse'] as const).map(candidate => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={kind === candidate}
              className={`iv-btn iv-btn--sm${kind === candidate ? ' iv-btn--acc' : ''}`}
              data-skill-kind-tab={candidate}
              onClick={() => { setKind(candidate) }}
            >
              {t(KIND_META[candidate].label)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-skills-refresh="true"
          disabled={loading}
          onClick={() => { void load(kind) }}
        >
          {t('skillsRefresh')}
        </button>
      </div>
      <span className="iv-meta" data-skill-kind-desc="true">{t(KIND_META[kind].desc)}</span>

      {error === undefined ? null : <div className="iv-alert" data-skill-error="true" role="alert">
        <Icon name="alert" size={12} />
        <span>{error}</span>
      </div>}
      {loading ? <span className="iv-meta" data-skill-loading="true">{t('skillsRefresh')}…</span> : null}

      <div className="iv-skill-import">
        <span className="iv-meta">{t('skillImportLabel')}</span>
        <input
          className="iv-input"
          value={source}
          data-skill-import-source="true"
          placeholder={t('skillImportPlaceholder')}
          aria-label={t('skillImportLabel')}
          onChange={event => { setSource(event.target.value) }}
          onKeyDown={event => {
            if (event.key === 'Enter') void importSkill()
          }}
        />
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          data-skill-import="true"
          disabled={busyId === 'import' || source.trim() === ''}
          onClick={() => { void importSkill() }}
        >
          {t('skillImportAction')}
        </button>
      </div>

      <div className="iv-prompt-lib" data-skill-list="true">
        {skills.length === 0
          ? <span className="iv-meta" data-skill-empty="true">{t('skillEmpty')}</span>
          : skills.map(skill => (
              <div className="iv-prompt-row" key={skill.id} data-skill-item={skill.id} data-skill-builtin={skill.builtin ? 'true' : 'false'}>
                <span className="iv-ellipsis" title={skill.description === '' ? skill.name : `${skill.name}：${skill.description}`}>
                  {skill.name}
                </span>
                {skill.builtin ? <span className="iv-chip">{t('skillBuiltin')}</span> : null}
                {skill.enabled ? null : <span className="iv-chip iv-chip--warn">{t('skillDisabled')}</span>}
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-skill-toggle={skill.id}
                  disabled={busyId === skill.id}
                  onClick={() => { void toggle(skill) }}
                >
                  {skill.enabled ? t('skillToggleOff') : t('skillToggleOn')}
                </button>
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-skill-reveal={skill.id}
                  onClick={() => { void reveal(skill) }}
                >
                  {t('skillReveal')}
                </button>
                {skill.builtin
                  ? <span className="iv-meta" title={t('skillBuiltinReadonly')}>{t('skillBuiltinReadonly')}</span>
                  : (
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        data-skill-remove={skill.id}
                        aria-label={`${t('skillRemove')} ${skill.name}`}
                        disabled={busyId === skill.id}
                        onClick={() => { void remove(skill) }}
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    )}
              </div>
            ))}
      </div>

      <div className="iv-skill-create">
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-skill-create-toggle="true"
          aria-expanded={creating}
          onClick={() => { setCreating(value => !value) }}
        >
          {t('skillCreateToggle')}
        </button>
        {creating
          ? (
              <div className="iv-skill-create-form" data-skill-create-form="true">
                <label className="iv-sb-field">
                  <span className="iv-meta">{t('skillNameLabel')}</span>
                  <input
                    className="iv-input"
                    value={draftName}
                    data-skill-draft-name="true"
                    placeholder={t('skillNamePlaceholder')}
                    onChange={event => { setDraftName(event.target.value) }}
                  />
                </label>
                <label className="iv-sb-field">
                  <span className="iv-meta">{t('skillPromptLabel')}</span>
                  <textarea
                    className="iv-input"
                    rows={4}
                    value={draftPrompt}
                    data-skill-draft-prompt="true"
                    placeholder={t('skillPromptPlaceholder')}
                    onChange={event => { setDraftPrompt(event.target.value) }}
                  />
                </label>
                <label className="iv-sb-field">
                  <span className="iv-meta">{t('skillDescriptionLabel')}</span>
                  <input
                    className="iv-input"
                    value={draftDescription}
                    data-skill-draft-description="true"
                    placeholder={t('skillDescriptionPlaceholder')}
                    onChange={event => { setDraftDescription(event.target.value) }}
                  />
                </label>
                <button
                  type="button"
                  className="iv-btn iv-btn--acc iv-btn--sm"
                  data-skill-save="true"
                  disabled={busyId === 'create' || draftName.trim() === '' || draftPrompt.trim() === ''}
                  onClick={() => { void saveDraft() }}
                >
                  {t('skillSaveAction')}
                </button>
              </div>
            )
          : null}
      </div>

      <span className="iv-meta">{t('skillsHint')}</span>
    </div>
  )
}
