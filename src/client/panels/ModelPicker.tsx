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
 * - 只留一只下拉：选中的模型不再附带能力摘要，参数行保持单行高度。
 * - 取不到目录时**降级为「自动（宿主默认）」并给出原因**，不假装有候选。
 *
 * @module dsh-image-video/panels/ModelPicker
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ModelCatalogView, WorkbenchApi } from '../api.ts'
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
  /** 各入口保留自己的定位属性，测试与样式选择器继续可用。 */
  readonly selectAttrs?: Readonly<Record<string, string>>
}

/** 目录缓存：同一会话只拉一次（键是 api 实例，避免跨 API 串味）。 */
const catalogCache = new WeakMap<WorkbenchApi, Promise<ModelCatalogView>>()

function loadCatalog(api: WorkbenchApi): Promise<ModelCatalogView> {
  const cached = catalogCache.get(api)
  if (cached !== undefined) return cached
  const pending = api.modelsCatalog()
  catalogCache.set(api, pending)
  // 失败不缓存：下次挂载还能重试
  pending.catch(() => { catalogCache.delete(api) })
  return pending
}

export function ModelPicker({ api, t, mediaMode, value, onChange, disabled = false, selectAttrs }: ModelPickerProps) {
  const [catalog, setCatalog] = useState<ModelCatalogView | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let alive = true
    loadCatalog(api)
      .then(view => { if (alive) setCatalog(view) })
      .catch((thrown: unknown) => {
        if (alive) setError(thrown instanceof Error ? thrown.message : String(thrown))
      })
    return () => { alive = false }
  }, [api])

  const candidates = (catalog?.cards ?? []).filter(card => card.kinds.includes(mediaMode))
  // 宿主解析出的"不选模型会用哪个"：下拉里把对应项标上「默认」，并在下方直接写出来
  const defaultModel = catalog?.defaults?.[mediaMode]

  return (
    <div className="iv-model-pick" data-model-picker={mediaMode}>
      <select
        {...selectAttrs}
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
            {card.name}{card.verified ? '' : ' ?'}{card.id === defaultModel ? `（${t('modelDefaultTag')}）` : ''}
          </option>
        ))}
      </select>
      {defaultModel === undefined
        ? null
        : (
          <span className="iv-model-pick-note iv-model-pick-default" data-model-picker-default={defaultModel}>
            {t('modelDefaultHint')}{defaultModel}
          </span>
        )}
      {error === undefined
        ? null
        : (
          <span className="iv-meta iv-model-pick-note" data-model-picker-error="true">
            <Icon name="alert" size={11} />
            {t('generateModelCatalogUnavailable')}
          </span>
        )}
    </div>
  )
}
