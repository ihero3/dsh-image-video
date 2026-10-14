/** Workbench copy: every string the right-pane surface renders. */

/** Locale keys the workbench renders. */
export type WorkbenchLocaleKey =
  | 'tabTitle'
  | 'guideDescription'
  | 'sectionProject'
  | 'projectNone'
  | 'saveSaved'
  | 'saveSaving'
  | 'saveDirty'
  | 'saveFailed'
  | 'modeQuick'
  | 'modeWorkflow'
  | 'modeTimeline'
  | 'paneAssets'
  | 'paneResources'
  | 'panePreview'
  | 'paneTasks'
  | 'emptyHint'

/** Dictionary namespace owned by this plugin's browser half. */
export const NS = 'image-video-workbench'

/** English copy. */
export const en: Record<WorkbenchLocaleKey, string> = {
  tabTitle: 'dsh-image-video workbench',
  guideDescription: 'Projects, media assets and generation tasks for image and video work.',
  sectionProject: 'Project',
  projectNone: 'No project yet',
  saveSaved: 'Saved',
  saveSaving: 'Saving…',
  saveDirty: 'Unsaved changes',
  saveFailed: 'Save failed',
  modeQuick: 'Quick create',
  modeWorkflow: 'Workflow',
  modeTimeline: 'Timeline',
  paneAssets: 'Media assets',
  paneResources: 'Resources',
  panePreview: 'Preview',
  paneTasks: 'Tasks',
  emptyHint: 'Skeleton only — projects, assets, tasks and the node canvas arrive in later phases.',
}

/** Simplified Chinese copy. */
export const zh: Record<WorkbenchLocaleKey, string> = {
  tabTitle: 'dsh-image-video 工作台',
  guideDescription: '图片与视频创作的项目、媒体素材与生成任务。',
  sectionProject: '项目',
  projectNone: '还没有项目',
  saveSaved: '已保存',
  saveSaving: '保存中…',
  saveDirty: '有未保存改动',
  saveFailed: '保存失败',
  modeQuick: '快速创作',
  modeWorkflow: '专业工作流',
  modeTimeline: '时间轴精剪',
  paneAssets: '媒体素材',
  paneResources: '创作资源',
  panePreview: '预览',
  paneTasks: '任务',
  emptyHint: '目前只是骨架——项目、素材、任务与节点画布在后续阶段落地。',
}
