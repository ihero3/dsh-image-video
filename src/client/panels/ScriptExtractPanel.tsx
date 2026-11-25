/**
 * 剧本生成页的提取分区（`B-23`）：角色 / 场景 / 道具·服装。
 *
 * 三个分区都读**同一份共享剧本输入**（`pipelineScript` + 导入文件原文，按剧集保存），
 * 界面上方直接放共享输入框，文件名与正文在四个分区之间始终一致。
 * 角色分区额外有专用的文本模型、Skill 与提取提示词；提取出的角色会落成角色卡，
 * 每张卡可以单独出图并写进本集、本剧资源库与素材库。
 *
 * @module dsh-image-video/client/panels/ScriptExtractPanel
 */
import { useState } from 'react'
import type { ResourceKind, ResourceRecord } from '../../workbench/records.ts'
import { newWorkbenchId } from '../../workbench/records.ts'
import type { ExtractItem } from '../../workbench/entity-extract.ts'
import type { SkillRecord } from '../../workbench/skills.ts'
import type { WorkbenchOptions } from '../../workbench-contract.ts'
import type { TextModelOption, WorkbenchApi } from '../api.ts'
import { Icon } from '../icons.tsx'
import { useWorkbenchField } from '../workbench-store.ts'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import type { WorkbenchLocaleKey } from '../locales.ts'
import { SharedScriptInput } from './SharedScriptInput.tsx'
import { RoleCardsPanel } from './RoleCardsPanel.tsx'

/** 素材提取页的四种类型（音色/轨迹在独立 tab，不在这里）。 */
type MaterialCategory = 'role' | 'scene' | 'costume' | 'prop'

/** 素材提取页的四种类型（tab 内并排按钮切换）。 */
const MATERIAL_KINDS: readonly MaterialCategory[] = ['role', 'scene', 'costume', 'prop']

/** 分区 → 标题 / 说明 / 入库时的资源类型 / 按钮文案。 */
const SECTIONS: Record<MaterialCategory, {
  readonly title: WorkbenchLocaleKey
  readonly desc: WorkbenchLocaleKey
  readonly kind: ResourceKind
  readonly button: WorkbenchLocaleKey
}> = {
  role: { title: 'extractRoleTitle', desc: 'extractRoleDesc', kind: 'role', button: 'scriptTabRoles' },
  scene: { title: 'extractSceneTitle', desc: 'extractSceneDesc', kind: 'scene', button: 'scriptTabScenes' },
  costume: { title: 'extractCostumeTitle', desc: 'extractCostumeDesc', kind: 'costume', button: 'scriptTabCostumes' },
  prop: { title: 'extractPropTitle', desc: 'extractPropDesc', kind: 'prop', button: 'scriptTabProps' },
}

/** Props of one extraction tab. */
export interface ScriptExtractPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前选中的提取类型（tab 内并排按钮切换，默认角色）。 */
  readonly category?: MaterialCategory
  /** 切换提取类型（受控；不传时组件内部自管）。 */
  readonly onCategoryChange?: (category: MaterialCategory) => void
  /** 当前剧集；没有项目时只给提示，不发请求。 */
  readonly projectId?: string
  /** 当前集；角色图要写进本集资源引用。 */
  readonly episodeId?: string
  /** 提取来源之一：当前集剧本原文。 */
  readonly script: string
  /** 场景 / 道具复用的文本模型（角色分区用自己的模型选择）。 */
  readonly model?: { readonly provider: string, readonly model: string }
  /** 文本模型目录：角色提取专用下拉。 */
  readonly textModels: readonly TextModelOption[]
  /** 导演 / 全局技能：角色提取与角色卡的 Skill 选择。 */
  readonly skills: readonly SkillRecord[]
  /** 生图模型 / 尺寸 / 风格白名单。 */
  readonly options: WorkbenchOptions | undefined
  /** 同类资源（用来标出「已在资源库」，也用于角色图更新已有资源）。 */
  readonly existing: readonly ResourceRecord[]
  /** 入库成功后刷新资源列表。 */
  readonly onCreated: () => void | Promise<void>
  /** 生成新素材 / 新任务后刷新素材与任务列表。 */
  readonly onMediaGenerated: () => void | Promise<void>
  /** 角色图缩略图 → 右侧预览。 */
  readonly onPreviewAsset: (path: string, kind: 'image' | 'video') => void
  /** 顶部提示（成功与失败都走宿主的通知条）。 */
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/** 下拉值 `provider::model` → 请求入参；空值与未知值都当作没选。 */
function parseModelKey(key: string): { readonly provider: string, readonly model: string } | undefined {
  const separator = key.indexOf('::')
  if (separator <= 0) return undefined
  const provider = key.slice(0, separator)
  const model = key.slice(separator + 2)
  return provider === '' || model === '' ? undefined : { provider, model }
}

/**
 * 一个提取分区：共享输入 + 提取配置 + 候选列表（角色分区还带角色卡列表）。
 * @param props - 见 {@link ScriptExtractPanelProps}。
 */
export function ScriptExtractPanel(props: ScriptExtractPanelProps) {
  const { api, t, category: controlled, onCategoryChange, projectId, episodeId, script, model, textModels, skills, options,
    existing, onCreated, onMediaGenerated, onPreviewAsset, onNotice } = props
  const [internalCategory, setInternalCategory] = useState<MaterialCategory>('role')
  const category = controlled ?? internalCategory
  const selectCategory = (next: MaterialCategory): void => {
    if (controlled === undefined) setInternalCategory(next)
    onCategoryChange?.(next)
  }
  const section = SECTIONS[category]
  const [items, setItems] = useState<readonly ExtractItem[]>([])
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState('')
  const [error, setError] = useState<string>()
  const [roleCards, setRoleCards] = useWorkbenchField(api, 'roleCards')
  const [roleExtractPrompt, setRoleExtractPrompt] = useWorkbenchField(api, 'roleExtractPrompt')
  const [roleExtractModel, setRoleExtractModel] = useWorkbenchField(api, 'roleExtractModel')
  const [, setRoleExtractSkillId] = useWorkbenchField(api, 'roleExtractSkillId')
  const [importedFiles] = useWorkbenchField(api, 'pipelineImportedFiles')
  const [pipelineScript] = useWorkbenchField(api, 'pipelineScript')

  const importedText = importedFiles
    .filter(file => file.status === 'done' && file.text.trim() !== '')
    .map(file => file.text)
    .join('\n\n')
  const source = [...new Set([script, pipelineScript, importedText])]
    .filter(part => part.trim() !== '')
    .join('\n\n')
  // 角色分区有自己的模型选择；没选时沿用分段模型，不必强迫用户重复选一次
  const roleModel = parseModelKey(roleExtractModel) ?? model
  const extractModel = category === 'role' ? roleModel : model
  const ready = projectId !== undefined && source.trim() !== '' && extractModel !== undefined

  const run = async (): Promise<void> => {
    if (!ready || extractModel === undefined) return
    setBusy(true); setError(undefined)
    try {
      const instructions = stripSkillTokens(roleExtractPrompt, skills)
      const skillId = activeSkillId(roleExtractPrompt, skills)
      const result = await api.extractEntities({
        script: source,
        category,
        provider: extractModel.provider,
        model: extractModel.model,
        ...instructions === '' ? {} : { instructions },
        ...skillId === '' ? {} : { skillId },
      })
      setItems(result.items)
      if (category === 'role') {
        // 提取结果直接初始化角色卡：同名角色不重复建卡，用户已有的编辑保留
        setRoleCards(current => {
          const known = new Set(current.map(card => card.name))
          const created = result.items
            .filter(item => !known.has(item.name))
            .map(item => ({
              id: newWorkbenchId('role-card'),
              name: item.name,
              prompt: item.note,
              defaultPrompt: item.note,
              imageModel: '',
              skillId: '',
              size: '',
              style: '',
              pose: '',
              lens: '',
              styleNote: '',
              cropEnabled: false,
              crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            }))
          return [...current, ...created]
        })
      }
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
      {/* 四种提取类型并排切换（合并自原来的角色 / 场景 / 道具·服装三个 tab）。 */}
      <div className="iv-plan-row iv-extract-kind-picker" data-extract-kind-picker="true" role="group" aria-label={t('extractKindLabel')}>
        {MATERIAL_KINDS.map(kind => (
          <button
            type="button"
            key={kind}
            className={`iv-btn iv-btn--sm${kind === category ? ' iv-btn--acc' : ''}`}
            data-extract-kind={kind}
            aria-pressed={kind === category}
            onClick={() => { selectCategory(kind) }}
          >
            {t(SECTIONS[kind].button)}
          </button>
        ))}
      </div>
      <div className="iv-plan-row">
        <span className="iv-meta" data-extract-source="true">
          {source.trim() === ''
            ? t('extractNeedsScript')
            : importedText === '' ? t('extractSource') : t('extractSourceWithFiles')}
        </span>
      </div>
      {/* 四个分区共用这一份输入：剧本文本、全文字数、导入文件名都来自同一个 store */}
      <div className="iv-sub" data-script-shared="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('scriptSharedInputTitle')}</span>
          <span className="iv-meta">{t('scriptSharedInputDesc')}</span>
        </div>
        <SharedScriptInput api={api} t={t} />
      </div>
      <div className="iv-sub" data-role-extract-config="true">
          <div className="iv-plan-row">
            <label className="iv-sb-field">
              <span className="iv-meta">{t('extractModelLabel')}</span>
              <select
                className="iv-select iv-select--sm"
                data-role-extract-model="true"
                value={roleExtractModel}
                onChange={event => { setRoleExtractModel(event.target.value) }}
              >
                <option value="">{t('generateParamAuto')}</option>
                {textModels.map(item => (
                  <option key={`${item.provider}::${item.id}`} value={`${item.provider}::${item.id}`}>
                    {item.providerName} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="iv-sb-field">
              <span className="iv-meta">{t('skillInsert')}</span>
              <SkillTokenSelect
                skills={skills}
                text={roleExtractPrompt}
                t={t}
                label={t('skillInsert')}
                onTextChange={next => {
                  setRoleExtractPrompt(next)
                  setRoleExtractSkillId(activeSkillId(next, skills))
                }}
                selectAttrs={{ 'data-role-extract-skill': 'true' }}
              />
            </label>
          </div>
          <label className="iv-sb-field">
            <span className="iv-meta">{t('extractPromptLabel')}</span>
            <textarea
              className="iv-input"
              rows={3}
              data-role-extract-prompt="true"
              placeholder={t('extractPromptPlaceholder')}
              value={roleExtractPrompt}
              onChange={event => {
                const next = event.target.value
                setRoleExtractPrompt(next)
                setRoleExtractSkillId(activeSkillId(next, skills))
              }}
            />
          </label>
      </div>
      <div className="iv-plan-row">
        <button
          type="button"
          className="iv-btn iv-btn--acc iv-btn--sm"
          data-extract-run="true"
          disabled={!ready || busy}
          onClick={() => { void run() }}
        >
          {busy
            ? <Icon name="sparkles" size={12} />
            : <Icon name="script" size={12} />}
          {busy ? t('extractRunning') : t('extractRun')}
        </button>
      </div>
      {extractModel === undefined
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
      {category === 'role' ? (
        <RoleCardsPanel
          api={api}
          t={t}
          projectId={projectId}
          episodeId={episodeId}
          options={options}
          skills={skills}
          existing={existing}
          cards={roleCards}
          onChange={setRoleCards}
          onPreviewAsset={onPreviewAsset}
          onCreated={async () => { await onCreated(); await onMediaGenerated() }}
          onNotice={onNotice}
        />
      ) : null}
    </div>
  )
}
