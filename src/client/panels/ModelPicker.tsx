/**
 * 模型选择器（`T2`）：把「选哪个模型」搬进快速生成面板，并与能力卡联动。
 *
 * 之前的问题：快速路径**不传 model**，永远走宿主默认；能力卡只能看不能用——
 * 结果不符合预期时用户无处可调，卡片也成了摆设。
 *
 * 设计取舍：
 * - **候选来自 `models/catalog`**（能力卡），不是硬编码名单：浏览器包不出现模型/服务商名
 *   （守住 `T2-11`），宿主新增模型只要更新能力卡即可。
 * - 模块级缓存：同一会话里只请求一次（能力卡是静态事实，不必每次挂载都打一次）。
 * - 选中后在下方显示**一张摘要**（擅长 + 关键限制），而不是把整张卡塞进表单——
 *   下拉负责"选"，摘要负责"为什么选它"。
 * - 取不到目录时**降级为「自动（宿主默认）」并给出原因**，不假装有候选。
 *
 * @module dsh-image-video/panels/ModelPicker
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ModelCardView, WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface ModelPickerProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 生成类型：只列支持该类型的模型。 */
  readonly mediaMode: 'image' | 'video'
  /** 当前选中的模型 id；`''` = 自动（宿主默认）。 */
  readonly value: string
  readonly onChange: (model: string) => void
  readonly disabled?: boolean
}

/** 目录缓存：同一会话只拉一次（键是 api 实例，避免跨 API 串味）。 */
const catalogCache = new WeakMap<WorkbenchApi, Promise<readonly ModelCardView[]>>()

function loadCatalog(api: WorkbenchApi): Promise<readonly ModelCardView[]> {
  const cached = catalogCache.get(api)
  if (cached !== undefined) return cached
  const pending = api.modelsCatalog().then(result => result.cards)
  catalogCache.set(api, pending)
  // 失败不缓存：下次挂载还能重试
  pending.catch(() => { catalogCache.delete(api) })
  return pending
}

/** 从能力卡里挑出「这个模型最该被知道的一句限制」。 */
function keyLimit(card: ModelCardView, mediaMode: 'image' | 'video', t: (key: WorkbenchLocaleKey) => string): string | undefined {
  if (mediaMode === 'video') {
    if (card.duration !== undefined && !card.duration.customizable) return t('modelLimitFixedDuration')
    if (!card.features.referenceVideo.supported) return t('modelLimitNoRefVideo')
  }
  return undefined
}

export function ModelPicker({ api, t, mediaMode, value, onChange, disabled = false }: ModelPickerProps) {
  const [cards, setCards] = useState<readonly ModelCardView[] | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let alive = true
    loadCatalog(api)
      .then(list => { if (alive) setCards(list) })
      .catch((thrown: unknown) => {
        if (alive) setError(thrown instanceof Error ? thrown.message : String(thrown))
      })
    return () => { alive = false }
  }, [api])

  const candidates = (cards ?? []).filter(card => card.kinds.includes(mediaMode))
  const selected = candidates.find(card => card.id === value)

  return (
    <div className="iv-model-pick" data-model-picker={mediaMode}>
      <select
        className="iv-select iv-select--sm"
        aria-label={mediaMode === 'video' ? t('generateVideoModel') : t('generateImageModel')}
        data-generate-model={mediaMode}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">{t('generateParamAuto')}</option>
        {candidates.map(card => (
          <option key={card.id} value={card.id}>
            {card.name}{card.verified ? '' : ' ?'}
          </option>
        ))}
      </select>
      {error === undefined
        ? null
        : (
          <span className="iv-meta iv-model-pick-note" data-model-picker-error="true">
            <Icon name="alert" size={11} />
            {t('generateModelCatalogUnavailable')}
          </span>
        )}
      {selected === undefined
        ? null
        : (
          <span className="iv-meta iv-model-pick-note" data-model-picker-note={selected.id}>
            {selected.strength}
            {keyLimit(selected, mediaMode, t) === undefined ? '' : ` · ${keyLimit(selected, mediaMode, t) as string}`}
          </span>
        )}
    </div>
  )
}
