/**
 * 剧本生成卡片（2026-11-24 产品精简）：这一块**只生成剧本**——把剧本 / 一句话创意写成集。
 *
 * 分镜、画布、图片、视频、逐镜编辑等出口已从本卡片移除，它们仍在各自的工作区里，
 * 不受这里的影响。这里保留的是所有短剧功能**共享**的输入面：
 * - 剧本文本与导入文件（`pipelineScript` / `pipelineImportedFiles` 存在共享 store，
 *   角色 / 场景 / 道具分区直接拿它们当提取来源）；
 * - 文本模型目录与导演技能（技能统一用文本里的 `【@技能名】` token，可多次选择）。
 *
 * 导入文件后只展示**全文多少字**：不再按章节切段，也不展示「第几段」下拉与提示，
 * 整篇正文都作为生成剧本的输入。
 */
import { useEffect, useMemo, useState } from 'react'
import type { TextModelOption, WorkbenchApi } from './api.ts'
import type { EpisodeRecord } from '../workbench/episodes.ts'
import {
  MAX_PLAN_EPISODES, MAX_PLAN_SEGMENTS, MAX_PLAN_SHOTS, autoCountsForScript,
} from '../workbench/episode-plan.ts'
import type { SkillRecord } from '../workbench/skills.ts'
import { Icon } from './icons.tsx'
import { switchPipelineProject, useWorkbenchField } from './workbench-store.ts'
import { SharedScriptInput } from './panels/SharedScriptInput.tsx'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from './skill-tokens.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 卡片 props：注入 api / 词典 / 当前项目 / 生成后的回调。 */
export interface PipelineCardProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前项目；未选项目时按钮禁用并给提示。 */
  readonly projectId?: string
  /**
   * 兼容既有调用方：本卡片已不再起跑 / 切画布，字段保留但不会触发。
   */
  readonly onStarted?: (workflowId: string) => void
  /** 外部注入的剧本（来自其它模块时覆盖卡片内剧本，用户随后可继续编辑）。 */
  readonly injectScript?: string
  /** 生成时把第一集写进这一集；缺省时整批新建。 */
  readonly episodeId?: string
  /** 生成后把受影响的集交回外层：刷新集列表并选中最先新建的一集。 */
  readonly onEpisodesGenerated?: (episodes: readonly EpisodeRecord[]) => void | Promise<void>
}

/** 三级数量输入值：'auto' = 生成时让文本模型按剧本决定，数字 = 用户手填。 */
type PlanCount = number | 'auto'

export function PipelineCard(props: PipelineCardProps) {
  const { api, t, projectId, injectScript } = props
  const [script, setScript] = useWorkbenchField(api, 'pipelineScript')
  // 外部注入的剧本变化时覆盖（空串不覆盖，避免把用户正在写的内容清掉）
  useEffect(() => {
    if (injectScript === undefined || injectScript.trim() === '') return
    setScript(injectScript)
  }, [injectScript])
  /** 三级规模（集 / 每集段 / 每段镜）：默认「自动」，也可手填数字。 */
  const [planEpisodes, setPlanEpisodes] = useState<PlanCount>('auto')
  const [planSegments, setPlanSegments] = useState<PlanCount>('auto')
  const [planShots, setPlanShots] = useState<PlanCount>('auto')
  /** 「生成剧本」进行态。 */
  const [generatingScript, setGeneratingScript] = useState(false)
  /** 导演技能：从剧本里的 Skill token 反推，和所有技能入口同一套用法。 */
  const [skillId, setSkillId] = useWorkbenchField(api, 'pipelineSkillId')
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  // 切换剧集：表单按项目保存/恢复；导入文件与剧本一起走，文件名和原文都不丢
  useEffect(() => {
    switchPipelineProject(api, projectId ?? '')
  }, [api, projectId])
  /** 生成用的文本模型（`provider::model`）；空串 = 只用规则拆解。 */
  const [textModelKey, setTextModelKey] = useWorkbenchField(api, 'pipelineTextModel')
  const [textModels, setTextModels] = useState<readonly TextModelOption[]>([])
  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const catalog = await api.listTextModels()
        if (!stale) setTextModels(catalog.models)
      } catch {
        // 拿不到模型目录就只剩规则拆解：界面上的"只用规则"始终可用
      }
    })()
    return () => { stale = true }
  }, [api])
  // 目录不再包含生图/生视频模型；旧持久化值若已失效，回到「只用规则」而不是暗中沿用
  useEffect(() => {
    if (textModelKey === '' || textModels.some(model => `${model.provider}::${model.id}` === textModelKey)) return
    setTextModelKey('')
  }, [textModelKey, textModels, setTextModelKey])
  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const rows = await api.listSkills('director', true)
        if (stale) return
        setSkills(rows)
      } catch {
        // 技能库拿不到时剧本照常生成，只是没有技能增强
      }
    })()
    return () => { stale = true }
  }, [api])
  /** 一次性操作反馈（生成）。 */
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  /**
   * 全文就是生成剧本的输入：不再切段、不再只送「选中的一段」。
   * Skill token 只属于界面；发给模型的正文必须先清掉。
   */
  const cleanScript = useMemo(() => stripSkillTokens(script, skills), [script, skills])

  /** Skill 下拉与文本区 token 双向一致：删掉 token 就等于取消选择。 */
  useEffect(() => {
    const next = activeSkillId(script, skills)
    if (next !== skillId) setSkillId(next)
  }, [script, skills, skillId, setSkillId])

  /** 选中的文本模型：`provider::model` 拆开；没选或模型已不在目录里就是"只用规则"。 */
  const selectedModel = useMemo((): { provider: string; model: string } | undefined => {
    const separator = textModelKey.indexOf('::')
    if (separator <= 0) return undefined
    const provider = textModelKey.slice(0, separator)
    const model = textModelKey.slice(separator + 2)
    return provider === '' || model === '' ? undefined : { provider, model }
  }, [textModelKey])

  const canGenerate = projectId !== undefined && projectId !== '' && script.trim() !== '' && !generatingScript

  /** 数量输入框：空串或「自动」回到 auto，数字夹取到上限。 */
  const parseCount = (raw: string, max: number): PlanCount => {
    const text = raw.trim()
    if (text === '' || text === t('pipelineAuto')) return 'auto'
    const value = Number(text)
    return Number.isFinite(value) && value >= 1 ? Math.min(max, Math.round(value)) : 'auto'
  }

  /**
   * 三级数量解析：手填字段照用；「自动」字段按剧本文字长度推算，选了文本模型则让模型推荐。
   *
   * 关键：没有文本模型（默认「只用规则」）时不再固定回落 1 集——按字数算出足够的集数，
   * 这样 29 万字的整本剧本也能拆成多集生成，而不是因「一集正文超限」整批失败。
   * 模型推荐失败同样回落到按字数推算；模型给的值也会和字数安全线取较大值，防止小集数装不下。
   */
  const resolveCounts = async (): Promise<{ episodes: number, segments: number, shots: number }> => {
    // 字数推算结果：所有「自动」项的可靠基线（无模型 / 模型失败时的回落）。
    const byLength = autoCountsForScript(cleanScript)
    const manual = {
      episodes: planEpisodes === 'auto' ? byLength.episodes : planEpisodes,
      segments: planSegments === 'auto' ? byLength.segments : planSegments,
      shots: planShots === 'auto' ? byLength.shots : planShots,
    }
    if (planEpisodes !== 'auto' && planSegments !== 'auto' && planShots !== 'auto') return manual
    if (selectedModel === undefined) return manual
    try {
      const suggested = await api.suggestEpisodeCounts({
        script: cleanScript,
        brief: cleanScript,
        provider: selectedModel.provider,
        model: selectedModel.model,
      })
      return {
        // 模型可以给更多集，但不能少于字数安全线，否则长剧本依旧装不下
        episodes: planEpisodes === 'auto'
          ? Math.max(byLength.episodes, Math.min(MAX_PLAN_EPISODES, suggested.episodes)) : manual.episodes,
        segments: planSegments === 'auto'
          ? Math.max(1, Math.min(MAX_PLAN_SEGMENTS, suggested.segments)) : manual.segments,
        shots: planShots === 'auto'
          ? Math.max(1, Math.min(MAX_PLAN_SHOTS, suggested.shots)) : manual.shots,
      }
    } catch {
      // 推荐失败不阻塞生成：自动项按字数推算，手填项照旧
      return manual
    }
  }

  /**
   * 把剧本写成集 → 分段 → 分镜并落库。
   * 剧本框是唯一入口：写整段剧本，或只写一句话创意（选了文本模型时由模型补全）。
   */
  const generateScript = async (): Promise<void> => {
    if (projectId === undefined || projectId === '') { setError(t('pipelineNeedsProject')); return }
    if (script.trim() === '') { setError(t('pipelineGenerateNeedsSource')); return }
    setGeneratingScript(true); setError(undefined); setNotice(undefined)
    try {
      const counts = await resolveCounts()
      const result = await api.generateEpisodes({
        projectId,
        ...props.episodeId === undefined || props.episodeId === '' ? {} : { episodeId: props.episodeId },
        script: cleanScript,
        ...selectedModel === undefined ? {} : { provider: selectedModel.provider, model: selectedModel.model },
        ...counts,
        ...skillId === '' ? {} : { skillId },
      })
      setNotice(t('pipelineGenerateDone').replace('{n}', String(result.episodes.length)))
      await props.onEpisodesGenerated?.(result.episodes)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setGeneratingScript(false)
    }
  }

  return (
    <div className="iv-card" data-pipeline-card="true">
      <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-4)' }}>
        <SharedScriptInput api={api} t={t} disabled={generatingScript} />
        {/* 输入属性：三级数量 / 文本模型 / 技能并列摆放；技能走统一 token，可多次选择 */}
        <div className="iv-plan-row">
          <label className="iv-plan-field" title={t('pipelineAutoCountsHint')}>
            {t('pipelinePlanEpisodes')}
            <input
              className="iv-input"
              data-pipeline-plan-episodes="true"
              type="text"
              inputMode="numeric"
              value={planEpisodes === 'auto' ? '' : String(planEpisodes)}
              placeholder={t('pipelineAuto')}
              disabled={generatingScript}
              onChange={event => setPlanEpisodes(parseCount(event.target.value, MAX_PLAN_EPISODES))}
              style={{ width: '80px' }}
            />
          </label>
          <label className="iv-plan-field" title={t('pipelineAutoCountsHint')}>
            {t('pipelinePlanSegments')}
            <input
              className="iv-input"
              data-pipeline-plan-segments="true"
              type="text"
              inputMode="numeric"
              value={planSegments === 'auto' ? '' : String(planSegments)}
              placeholder={t('pipelineAuto')}
              disabled={generatingScript}
              onChange={event => setPlanSegments(parseCount(event.target.value, MAX_PLAN_SEGMENTS))}
              style={{ width: '80px' }}
            />
          </label>
          <label className="iv-plan-field" title={t('pipelineAutoCountsHint')}>
            {t('pipelinePlanShots')}
            <input
              className="iv-input"
              data-pipeline-plan-shots="true"
              type="text"
              inputMode="numeric"
              value={planShots === 'auto' ? '' : String(planShots)}
              placeholder={t('pipelineAuto')}
              disabled={generatingScript}
              onChange={event => setPlanShots(parseCount(event.target.value, MAX_PLAN_SHOTS))}
              style={{ width: '80px' }}
            />
          </label>
          <label className="iv-plan-field" title={textModels.length === 0 ? t('pipelineTextModelMissing') : t('pipelineTextModelHint')}>
            {t('pipelineTextModel')}
            <select
              className="iv-input"
              data-pipeline-text-model="true"
              value={textModelKey}
              disabled={generatingScript}
              onChange={event => setTextModelKey(event.target.value)}
            >
              <option value="">{t('pipelineTextModelRules')}</option>
              {textModels.map(model => (
                <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>
                  {model.providerName} · {model.name}
                </option>
              ))}
            </select>
          </label>
          <label className="iv-plan-field" title={skills.length === 0 ? t('pipelineSkillMissing') : t('pipelineSkillHint')}>
            {t('pipelineSkill')}
            <SkillTokenSelect
              skills={skills}
              text={script}
              t={t}
              label={t('pipelineSkill')}
              disabled={generatingScript}
              className="iv-input"
              selectAttrs={{ 'data-pipeline-skill': 'true' }}
              onTextChange={setScript}
            />
          </label>
        </div>
        {/* 唯一动作：主按钮独占一行，和整块输入的视觉层级分开 */}
        <div className="iv-plan-row" data-pipeline-generate="true" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="iv-btn iv-btn--action iv-btn--action--primary"
            data-pipeline-script-generate="true"
            style={{ minWidth: '132px' }}
            disabled={!canGenerate}
            onClick={() => { void generateScript() }}
          >
            <Icon name="sparkles" size={13} />
            {generatingScript ? t('pipelineGeneratingScript') : t('pipelineGenerate')}
          </button>
          {projectId === undefined || projectId === ''
            ? <span className="iv-meta">{t('pipelineNeedsProject')}</span>
            : null}
        </div>
        {error === undefined ? null : <p className="iv-err" data-pipeline-error="true">{error}</p>}
        {notice === undefined ? null : <p className="iv-meta" data-pipeline-notice="true">{notice}</p>}
      </div>
    </div>
  )
}
