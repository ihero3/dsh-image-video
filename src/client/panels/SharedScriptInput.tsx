/**
 * 剧本生成页四个分区共用的「剧本输入 + 导入本地文件」。
 *
 * 剧本文本与导入文件（文件名 + 原文）都放在跨挂载 store 里，按剧集保存/恢复；
 * 剧本分段、角色、场景、道具四个分区渲染的都是这一份，内容与文件名始终一致。
 * 导入成功后正文追加进剧本框，原文另存一份，供提取分区独立使用。
 *
 * @module dsh-image-video/client/panels/SharedScriptInput
 */
import { useRef, useState } from 'react'
import type { WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import { Icon } from '../icons.tsx'
import { importScriptFilesShared } from '../script-import-shared.ts'
import { useWorkbenchField } from '../workbench-store.ts'

/** 剧本输入框行数：整段剧本不用先滚才看得全。 */
const SCRIPT_ROWS = 6

export interface SharedScriptInputProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 生成进行态可由调用方锁住输入；缺省可编辑。 */
  readonly disabled?: boolean
}

/**
 * 共享输入框：编辑剧本文本、导入本地剧本、查看全文字数与导入文件名。
 * @param props - 见 {@link SharedScriptInputProps}。
 */
export function SharedScriptInput(props: SharedScriptInputProps) {
  const { api, t, disabled } = props
  const [script, setScript] = useWorkbenchField(api, 'pipelineScript')
  const [importedFiles, setImportedFiles] = useWorkbenchField(api, 'pipelineImportedFiles')
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scriptRef = useRef<HTMLTextAreaElement | null>(null)
  const scriptChars = script.trim().length

  /** 导入既写共享列表（文件名/原文常驻），也把正文追加进剧本框。 */
  const importFiles = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return
    setImporting(true); setError(undefined); setNotice(undefined)
    try {
      const { done, failures } = await importScriptFilesShared(api, files, setImportedFiles)
      for (const imported of done) {
        setScript(current => current.trim() === '' ? imported.text : `${current}\n\n${imported.text}`)
      }
      if (failures.length === 0) {
        setNotice(t('pipelineImportDone').replace('{name}', done.map(item => item.fileName).join('；')))
        const textarea = scriptRef.current
        if (textarea !== null) {
          if (typeof textarea.scrollIntoView === 'function') textarea.scrollIntoView({ block: 'nearest' })
          textarea.scrollTop = textarea.scrollHeight
        }
      } else {
        setError(`${t('pipelineImportFailed')}：${failures.join('；')}`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="iv-sc-io" data-shared-script-input="true">
        <span className="iv-meta">{t('pipelineScriptLabel')}</span>
        <textarea
          ref={scriptRef}
          className="iv-input iv-textarea"
          rows={SCRIPT_ROWS}
          value={script}
          placeholder={t('pipelineScriptPlaceholder')}
          data-pipeline-script="true"
          disabled={disabled === true}
          onChange={event => setScript(event.target.value)}
        />
        {/* 导入整本小说后只看全文字数：不切段、不展示「第几段」选择 */}
        {scriptChars === 0
          ? null
          : (
            <span className="iv-meta" data-pipeline-script-chars="true">
              {t('pipelineScriptChars').replace('{chars}', String(scriptChars))}
            </span>
          )}
        <div style={{ display: 'flex', gap: 'var(--iv-sp-5)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.docx,.pdf"
            multiple
            data-pipeline-import-file="true"
            style={{ display: 'none' }}
            onChange={event => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void importFiles(files)
            }}
          />
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-pipeline-import="true"
            disabled={disabled === true || importing}
            title={t('pipelineImportScriptHint')}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="script" size={12} />
            {importing ? t('pipelineImporting') : t('pipelineImportScript')}
          </button>
          {importedFiles.length === 0
            ? null
            : (
              <div
                data-pipeline-imported="true"
                style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'center' }}
              >
                <span className="iv-meta">{t('pipelineImportedLabel')}</span>
                {importedFiles.map(file => (
                  <span
                    className="iv-chip"
                    key={file.name}
                    data-pipeline-imported-item={file.name}
                    data-pipeline-imported-status={file.status}
                    title={file.error ?? file.name}
                  >
                    <span style={{ marginRight: '2px' }}>
                      {file.name}
                      {file.status === 'importing' ? ` · ${t('pipelineImporting')}` : ''}
                      {file.status === 'failed' ? ` · ${t('pipelineImportFailedShort')}` : ''}
                    </span>
                    <button
                      type="button"
                      className="iv-btn iv-btn--ghost iv-btn--sm"
                      data-pipeline-imported-remove={file.name}
                      aria-label={t('pipelineImportRemove')}
                      title={t('pipelineImportRemove')}
                      onClick={() => setImportedFiles(current => current.filter(item => item.name !== file.name))}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
        </div>
        {notice === undefined ? null
          : (
            <div
              className="iv-notice"
              role="status"
              data-pipeline-notice="true"
              data-pipeline-import-notice="true"
            >{notice}</div>
          )}
        {error === undefined ? null
          : (
            <div
              className="iv-notice iv-notice--err"
              role="alert"
              data-pipeline-error="true"
              data-pipeline-import-error="true"
            >{error}</div>
          )}
    </div>
  )
}
