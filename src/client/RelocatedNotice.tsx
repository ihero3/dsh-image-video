/**
 * 旧右栏 tab 的迁移页。
 *
 * 旧版本的 dsh-image-video 是**右栏 tab**（用户布局记录里还留着那个 tab）。新版本改成了
 * **主面板 + 左栏入口**，于是那个 tab 只剩一个空壳：这里不挂第二份工作台（两套轮询、两套
 * 写盘会互相干扰），只说明「它搬到哪了」，并给一个按钮直接切过去。
 */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { CHROME_NS } from './chrome-locales.ts'
import type { ChromeLocaleKey } from './chrome-locales.ts'

/** 迁移页从入口拿到的注入面。 */
export interface RelocatedNoticeInjected {
  /** 切到工作台主面板。 */
  openPanel: () => void
}

/** 迁移页的完整 props（右栏 seat 的运行时份额 + 注入面 + 壳文案）。 */
export type RelocatedNoticeProps =
  & PropsLocale<typeof CHROME_NS>
  & InjectFace<RelocatedNoticeInjected>
  & { t: (key: ChromeLocaleKey) => string }

/**
 * 画迁移提示。
 * @param props - 壳文案与「切到主面板」动作。
 * @returns 提示页元素。
 */
export function RelocatedNotice({ t, openPanel }: RelocatedNoticeProps): ReactNode {
  return (
    <div
      data-workbench-relocated="true"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
        padding: '18px 16px', fontSize: 13, lineHeight: 1.6,
        color: 'var(--dsw-alias-label-primary, currentColor)',
      }}
    >
      <strong style={{ fontSize: 13.5 }}>{t('relocatedTitle')}</strong>
      <span style={{ color: 'var(--dsw-alias-label-tertiary, currentColor)' }}>{t('relocatedBody')}</span>
      <button
        type="button"
        onClick={() => { openPanel() }}
        style={{
          marginTop: 2, height: 28, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
          border: 'none', background: 'var(--dsw-alias-button-info-fill, #4176e6)', color: '#fff', fontSize: 12.5,
        }}
      >
        {t('relocatedAction')}
      </button>
    </div>
  )
}
