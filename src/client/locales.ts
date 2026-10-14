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
  | 'healthChecking'
  | 'healthFailed'
  | 'panePlanned'
  | 'newProject'
  | 'projectNamePlaceholder'
  | 'create'
  | 'remove'
  | 'confirmRemove'
  | 'refresh'
  | 'noOutputs'
  | 'registerLatest'
  | 'noAssets'
  | 'previewEmpty'
  | 'busy'
  | 'failed'
  | 'noTasks'
  | 'registerAsAsset'
  | 'statusQueued'
  | 'statusRunning'
  | 'statusSucceeded'
  | 'statusFailed'
  | 'statusCancelled'

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
  healthChecking: 'Connecting to host…',
  healthFailed: 'Host unavailable',
  panePlanned: 'Not runnable yet — planned for a later phase',
  newProject: 'New project',
  projectNamePlaceholder: 'Project name',
  create: 'Create',
  remove: 'Remove',
  confirmRemove: 'Confirm remove',
  refresh: 'Refresh',
  noOutputs: 'No media in the output directory yet',
  registerLatest: 'Register latest output',
  noAssets: 'No assets in this project yet',
  previewEmpty: 'Select an asset to preview it',
  busy: 'Working…',
  failed: 'Operation failed',
  noTasks: 'No tasks recorded yet',
  registerAsAsset: 'Register as asset',
  statusQueued: 'Queued',
  statusRunning: 'Running',
  statusSucceeded: 'Succeeded',
  statusFailed: 'Failed',
  statusCancelled: 'Cancelled',
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
  healthChecking: '正在连接宿主…',
  healthFailed: '宿主未就绪',
  panePlanned: '暂不可运行——排在后续阶段',
  newProject: '新建项目',
  projectNamePlaceholder: '项目名称',
  create: '创建',
  remove: '删除',
  confirmRemove: '确认删除',
  refresh: '刷新',
  noOutputs: 'outputs 目录里还没有产物',
  registerLatest: '登记最新产物',
  noAssets: '这个项目还没有素材',
  previewEmpty: '选中素材后可在此预览',
  busy: '处理中…',
  failed: '操作失败',
  noTasks: '还没有任务记录',
  registerAsAsset: '登记为素材',
  statusQueued: '排队中',
  statusRunning: '运行中',
  statusSucceeded: '成功',
  statusFailed: '失败',
  statusCancelled: '已取消',
}
