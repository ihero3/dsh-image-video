/**
 * 一键成片卡片（`P0-2`）：把「剧本 → 分镜 → 生图 → 生视频」做成一次点击。
 *
 * 只做 UI + 调用编排端点（`pipelines/run`）；拆解、编排、落库、起跑都在宿主侧
 * （`planPipeline` + 画布 runner），所以这里没有业务规则可漂。
 *
 * 成功后面板会切到「专业工作流」模式：新工作流是该项目的**最新一份**，画布会自动选中它，
 * 用户能立刻看到节点、运行记录与每镜产物。
 */
import { useState } from 'react'
import type { PipelineResult, WorkbenchApi } from './api.ts'
import { Icon } from './icons.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 卡片 props：注入 api / 词典 / 当前项目 / 起跑后的回调。 */
export interface PipelineCardProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前项目；未选项目时按钮禁用并给提示。 */
  readonly projectId?: string
  /** 起跑成功后切到画布模式（由 Workbench 提供）。 */
  readonly onStarted: (workflowId: string) => void
}

/** 表单默认值：分镜 4、每镜 5 秒、图生视频（可控性最好）。 */
const DEFAULT_SHOTS = 4
const DEFAULT_DURATION = 5

/**
 * 一键成片卡片。
 * @param props - 见 {@link PipelineCardProps}。
 * @returns 折叠式表单 + 结果/提醒。
 */
export function PipelineCard(props: PipelineCardProps) {
  const { api, t, projectId } = props
  const [open, setOpen] = useState(true)
  const [script, setScript] = useState('')
  const [mode, setMode] = useState<'image-to-video' | 'text-to-video'>('image-to-video')
  const [shots, setShots] = useState(DEFAULT_SHOTS)
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [strict, setStrict] = useState(false)
  const [running, setRunning] = useState(false)
  /** 只编排不跑：零花费预览分镜与提示词，确认后再点「一键生成」。 */
  const composeOnly = async (): Promise<void> => {
    if (projectId === undefined || projectId === '' || script.trim() === '') return
    setRunning(true); setError(undefined); setResult(undefined)
    try {
      setResult(await api.composePipeline({ projectId, script, mode, shots, duration, strictResources: strict }))
      setStarted(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }
  const [result, setResult] = useState<PipelineResult | undefined>(undefined)
  /** 本次结果是「已起跑」还是「仅编排」——决定结果条文案。 */
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const canRun = projectId !== undefined && projectId !== '' && script.trim() !== '' && !running

  async function run(): Promise<void> {
    if (!canRun) return
    setRunning(true)
    setError(undefined)
    setResult(undefined)
    try {
      const started = await api.runPipeline({
        projectId: projectId as string,
        script,
        mode,
        shots,
        duration,
        strictResources: strict,
      })
      setResult(started.pipeline)
      setStarted(true)
      props.onStarted(started.pipeline.workflowId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="iv-card" data-pipeline-card="true">
      <button
        type="button"
        className="iv-card-head"
        data-pipeline-toggle="true"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <Icon name="bolt" size={13} />
        <strong>{t('pipelineTitle')}</strong>
        <span className="iv-meta" style={{ marginLeft: 'auto' }}>{open ? '−' : '+'}</span>
      </button>

      {open
        ? (
          <div className="iv-card-body" style={{ display: 'grid', gap: '8px' }}>
            <span className="iv-meta">{t('pipelineHint')}</span>
            <span className="iv-meta">{t('pipelineScriptLabel')}</span>
            <textarea
              className="iv-input"
              rows={4}
              value={script}
              placeholder={t('pipelineScriptPlaceholder')}
              data-pipeline-script="true"
              disabled={running}
              onChange={event => setScript(event.target.value)}
              style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="iv-check">
                <select
                  className="iv-input"
                  data-pipeline-mode="true"
                  value={mode}
                  disabled={running}
                  onChange={event => setMode(event.target.value === 'text-to-video' ? 'text-to-video' : 'image-to-video')}
                >
                  <option value="image-to-video">{t('pipelineModeImageToVideo')}</option>
                  <option value="text-to-video">{t('pipelineModeTextToVideo')}</option>
                </select>
              </label>
              <label className="iv-check">
                {t('pipelineShots')}
                <input
                  className="iv-input"
                  data-pipeline-shots="true"
                  type="number"
                  min={1}
                  max={60}
                  value={shots}
                  disabled={running}
                  onChange={event => setShots(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
                  style={{ width: '64px' }}
                />
              </label>
              <label className="iv-check">
                {t('pipelineDuration')}
                <input
                  className="iv-input"
                  data-pipeline-duration="true"
                  type="number"
                  min={1}
                  max={30}
                  value={duration}
                  disabled={running}
                  onChange={event => setDuration(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
                  style={{ width: '64px' }}
                />
              </label>
              <label className="iv-check">
                <input
                  type="checkbox"
                  data-pipeline-strict="true"
                  checked={strict}
                  disabled={running}
                  onChange={event => setStrict(event.target.checked)}
                />
                {t('pipelineStrict')}
              </label>
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-pipeline-compose="true"
                disabled={running || projectId === undefined || projectId === '' || script.trim() === ''}
                onClick={() => { void composeOnly() }}
              >
                {t('pipelineCompose')}
              </button>
              <button
                type="button"
                className="iv-btn iv-btn--primary iv-btn--sm"
                data-pipeline-run="true"
                disabled={!canRun}
                onClick={() => { void run() }}
              >
                <Icon name="sparkles" size={12} />
                {running ? t('pipelineRunning') : t('pipelineRun')}
              </button>
              {projectId === undefined || projectId === ''
                ? <span className="iv-meta">{t('pipelineNeedsProject')}</span>
                : null}
            </div>

            {error === undefined ? null : <p className="iv-err" data-pipeline-error="true">{error}</p>}

            {result === undefined
              ? null
              : (
                <div className="iv-card-note" data-pipeline-result="true" style={{ display: 'grid', gap: '4px' }}>
                  <span className="iv-chip iv-chip--ok">
                    <Icon name="check" size={11} />
                    {(started ? t('pipelineStarted') : t('pipelineComposed'))}：{result.name}
                  </span>
                  <span className="iv-meta">
                    {result.shots} {t('pipelineShotsCount')} · {result.nodes} nodes · {result.workflowId}
                  </span>
                  {(result.warnings ?? []).length === 0
                    ? null
                    : (
                      <ul className="iv-meta" style={{ margin: 0, paddingLeft: '18px' }}>
                        {(result.warnings ?? []).map(warning => <li key={warning}>{t('pipelineWarnings')}：{warning}</li>)}
                      </ul>
                    )}
                </div>
              )}
          </div>
        )
        : null}
    </div>
  )
}
