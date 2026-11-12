/**
 * 首次使用引导覆盖层：独立安装后的 3 步检查表。
 *
 * 纯 UI 组件——不发请求、不读写存储，所有状态判断与动作都走 props。这样接线方（工作台主
 * 面板）可以按自己的数据源提供 ffmpeg 健康检查结果、输出目录与模型清单，组件本身可单测。
 *
 * 三步依次是：连接模型服务（两个入口，都只是回调）→ 环境检查（ffmpeg / 输出目录）→
 * 选默认模型与尺寸（下拉）→ 进入工作台。已完成的步骤徽标变成对勾；「稍后再说」与 Esc
 * 都是关闭（由调用方决定是否记住「别再烦我」）。
 *
 * 焦点行为直接复用仓库的 {@link useDialogFocus}：打开移入、Tab 循环、Esc 关闭、关闭后归还。
 * 无障碍：`role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向可见标题。
 *
 * 判定口径（没有 `connected` prop 时的折中，接线方可据此预期）：
 * - 第 1 步完成 = 用户点过任一连接入口，**或** `models` 非空（有模型清单说明凭证已就绪）。
 * - 第 2 步完成 = `ffmpeg.ok === true` 且 `outputsDir` 非空。
 * - 第 3 步永远是当前动作步（点「进入工作台」才完成，随后由外层卸载）。
 *
 * @module dsh-image-video/client/screens/GuideOverlay
 */

import { useId, useRef, useState, type MouseEvent } from 'react'
import { useDialogFocus } from '../use-dialog-focus.ts'
import { useGuideStyle } from './guide-style.ts'
import type { GuideLocaleKey } from './guide-locales.ts'

/** ffmpeg 探测结果（`undefined` = 还没探测完）。 */
export interface GuideFfmpegStatus {
  readonly ok: boolean
  readonly path?: string
  readonly message?: string
}

/** 模型下拉选项。 */
export interface GuideModelOption {
  readonly id: string
  readonly label: string
}

/** 「进入工作台」时提交的默认值。 */
export interface GuideChoice {
  readonly imageModel: string
  readonly videoModel: string
  readonly imageSize: string
}

/** 组件 props（签名与任务书一致；接线方按此传参）。 */
export interface GuideOverlayProps {
  readonly t: (k: GuideLocaleKey) => string
  readonly ffmpeg: GuideFfmpegStatus | undefined
  readonly outputsDir: string
  readonly models: readonly GuideModelOption[]
  readonly onOpenConnect: () => void
  readonly onChangeOutputsDir?: () => void
  readonly onDone: (choice: GuideChoice) => void
  readonly onDismiss: () => void
}

/** 兼容任务书里的 `type Props` 写法。 */
export type Props = GuideOverlayProps

/**
 * 默认图片尺寸候选。
 *
 * 不放进 props：尺寸是产品口径（同一套后端支持的常见档位），不是每个调用方都能自己维护的
 * 配置；接线方要换档位改这里一处即可。值用后端认的 `宽*高`，显示也直接显示它。
 */
export const GUIDE_IMAGE_SIZES: readonly string[] = ['1024*1024', '1280*720', '720*1280', '1536*1024']

export function GuideOverlay({
  t,
  ffmpeg,
  outputsDir,
  models,
  onOpenConnect,
  onChangeOutputsDir,
  onDone,
  onDismiss,
}: GuideOverlayProps) {
  useGuideStyle()

  const panelRef = useRef<HTMLDivElement>(null)
  // 组件出现即打开；关闭由外层卸载（不在这里维护 open 状态，避免两份真值）。
  useDialogFocus(true, panelRef, onDismiss)

  const titleId = useId()
  const [connectAsked, setConnectAsked] = useState(false)
  // 只在用户动过下拉后才有值；默认值由 models[0] 派生，模型清单异步到达也能正确选中。
  const [imageModel, setImageModel] = useState('')
  const [videoModel, setVideoModel] = useState('')
  const [imageSize, setImageSize] = useState<string>(GUIDE_IMAGE_SIZES[0] ?? '')

  const modelsReady = models.length > 0
  /** 选中项不在清单里（含初始空串 / 清单换了一版）时回落到第一项。 */
  const pickModel = (candidate: string): string =>
    models.some(model => model.id === candidate) ? candidate : (models[0]?.id ?? '')
  const imageValue = pickModel(imageModel)
  const videoValue = pickModel(videoModel)

  const connectDone = connectAsked || modelsReady
  const ffmpegOk = ffmpeg?.ok === true
  const envDone = ffmpegOk && outputsDir.trim() !== ''
  const currentStep: number = !connectDone ? 1 : !envDone ? 2 : 3

  const connect = (): void => {
    // 先记「已去连接」：连接弹层盖在引导层上方，关掉回来后这里至少能表达用户动作。
    setConnectAsked(true)
    onOpenConnect()
  }

  const onMaskMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    // 只有点到遮罩本身才关；点弹层内部不冒泡误关。
    if (event.target === event.currentTarget) onDismiss()
  }

  const stepState = (step: number): { done: boolean; current: boolean } => ({
    done: step === 1 ? connectDone : step === 2 ? envDone : false,
    current: currentStep === step,
  })

  const badge = (step: number) => {
    const state = stepState(step)
    return state.done ? '✓' : String(step)
  }

  return (
    <div className="ivg-mask" data-guide-overlay="" onMouseDown={onMaskMouseDown}>
      <div
        ref={panelRef}
        className="ivg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="ivg-head">
          <h3 id={titleId} className="ivg-title">
            {t('title')}
          </h3>
          <span className="ivg-esc" aria-hidden="true">
            {t('escHint')}
          </span>
        </div>
        <p className="ivg-sub">{t('subtitle')}</p>

        <ol className="ivg-steps">
          {/* ① 连接模型服务 */}
          <li
            className="ivg-step"
            data-guide-step="connect"
            data-done={connectDone ? 'true' : 'false'}
            data-current={stepState(1).current ? 'true' : 'false'}
          >
            <span className="ivg-n" aria-hidden="true">
              {badge(1)}
            </span>
            <div className="ivg-step-body">
              <div className="ivg-step-head">
                <span className="ivg-step-t">{t('step1Title')}</span>
                <span className="ivg-chip" data-tone={connectDone ? 'ok' : 'warn'}>
                  {connectDone ? t('connectDone') : t('connectPending')}
                </span>
              </div>
              <p className="ivg-step-d">{t('step1Desc')}</p>
              <div className="ivg-row">
                <button type="button" className="ivg-btn ivg-btn--acc ivg-btn--sm" onClick={connect}>
                  {t('connectAccount')}
                </button>
                <button type="button" className="ivg-btn ivg-btn--sm" onClick={connect}>
                  {t('connectApiKey')}
                </button>
              </div>
            </div>
          </li>

          {/* ② 环境检查 */}
          <li
            className="ivg-step"
            data-guide-step="env"
            data-done={envDone ? 'true' : 'false'}
            data-current={stepState(2).current ? 'true' : 'false'}
          >
            <span className="ivg-n" aria-hidden="true">
              {badge(2)}
            </span>
            <div className="ivg-step-body">
              <div className="ivg-step-head">
                <span className="ivg-step-t">{t('step2Title')}</span>
                <span
                  className="ivg-chip"
                  data-tone={ffmpeg === undefined ? '' : envDone ? 'ok' : 'warn'}
                >
                  {ffmpeg === undefined ? t('ffmpegChecking') : envDone ? t('envReady') : t('envNeedsWork')}
                </span>
              </div>
              <p className="ivg-step-d">{t('step2Desc')}</p>
              <div className="ivg-row">
                <span
                  className="ivg-chip"
                  data-tone={ffmpeg === undefined ? '' : ffmpegOk ? 'ok' : 'warn'}
                >
                  {ffmpeg === undefined ? t('ffmpegChecking') : ffmpegOk ? t('ffmpegOk') : t('ffmpegMissing')}
                </span>
                {ffmpegOk && ffmpeg.path !== undefined && ffmpeg.path !== '' ? (
                  <span className="ivg-mono ivg-grow" title={ffmpeg.path}>
                    {ffmpeg.path}
                  </span>
                ) : null}
              </div>
              {ffmpeg !== undefined && !ffmpegOk ? (
                <p className="ivg-note" data-tone="warn">
                  {t('ffmpegMissingHint')}
                  {ffmpeg.message !== undefined && ffmpeg.message !== '' ? ` · ${ffmpeg.message}` : ''}
                </p>
              ) : null}
              <div className="ivg-row">
                <span className="ivg-label">{t('outputsDirLabel')}</span>
                <span className="ivg-mono ivg-grow" title={outputsDir}>
                  {outputsDir.trim() === '' ? t('outputsUnset') : outputsDir}
                </span>
                {/* 没有换目录能力时不渲染按钮：留一个点了没反应的按钮比没有更糟 */}
                {onChangeOutputsDir === undefined
                  ? null
                  : (
                    <button
                      type="button"
                      className="ivg-btn ivg-btn--sm ivg-btn--ghost"
                      onClick={() => onChangeOutputsDir()}
                    >
                      {t('change')}
                    </button>
                  )}
              </div>
            </div>
          </li>

          {/* ③ 选默认模型与尺寸 */}
          <li
            className="ivg-step"
            data-guide-step="defaults"
            data-done="false"
            data-current={stepState(3).current ? 'true' : 'false'}
          >
            <span className="ivg-n" aria-hidden="true">
              {badge(3)}
            </span>
            <div className="ivg-step-body">
              <div className="ivg-step-head">
                <span className="ivg-step-t">{t('step3Title')}</span>
              </div>
              <p className="ivg-step-d">{t('step3Desc')}</p>
              <div className="ivg-grid">
                <label className="ivg-field">
                  <span>{t('imageModelLabel')}</span>
                  <select
                    className="ivg-select"
                    aria-label={t('imageModelLabel')}
                    value={imageValue}
                    onChange={event => setImageModel(event.target.value)}
                  >
                    {modelsReady ? (
                      models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))
                    ) : (
                      <option value="">{t('noModels')}</option>
                    )}
                  </select>
                </label>
                <label className="ivg-field">
                  <span>{t('videoModelLabel')}</span>
                  <select
                    className="ivg-select"
                    aria-label={t('videoModelLabel')}
                    value={videoValue}
                    onChange={event => setVideoModel(event.target.value)}
                  >
                    {modelsReady ? (
                      models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))
                    ) : (
                      <option value="">{t('noModels')}</option>
                    )}
                  </select>
                </label>
                <label className="ivg-field">
                  <span>{t('imageSizeLabel')}</span>
                  <select
                    className="ivg-select"
                    aria-label={t('imageSizeLabel')}
                    value={imageSize}
                    onChange={event => setImageSize(event.target.value)}
                  >
                    {GUIDE_IMAGE_SIZES.map(size => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ivg-row">
                <button
                  type="button"
                  className="ivg-btn ivg-btn--acc"
                  onClick={() => onDone({ imageModel: imageValue, videoModel: videoValue, imageSize })}
                >
                  {t('enterWorkbench')}
                </button>
              </div>
            </div>
          </li>
        </ol>

        <div className="ivg-foot">
          <button type="button" className="ivg-btn ivg-btn--ghost" onClick={onDismiss}>
            {t('later')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuideOverlay
