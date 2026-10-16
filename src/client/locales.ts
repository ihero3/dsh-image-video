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
  | 'cancelTask'
  | 'ffmpegRecheck'
  | 'ffmpegOk'
  | 'stylePosition'
  | 'styleColor'
  | 'styleFontSize'
  | 'playhead'
  | 'previewNote'
  | 'previewIdle'
  | 'previewTitle'
  | 'burnSubtitles'
  | 'pickAsset'
  | 'timelineTitle'
  | 'subtitlePlaceholder'
  | 'timelineTotal'
  | 'clipDuration'
  | 'clipStart'
  | 'timelineEmpty'
  | 'addSubtitle'
  | 'addClip'
  | 'trackSubtitle'
  | 'trackAudio'
  | 'trackVideo'
  | 'templateReferenceRemake'
  | 'templateImageToVideo'
  | 'templateCopyToVideo'
  | 'templateApply'
  | 'templateTitle'
  | 'runHistory'
  | 'runArtifacts'
  | 'statusSkipped'
  | 'runNone'
  | 'runTitle'
  | 'runRetry'
  | 'runCancel'
  | 'runStart'
  | 'issuePlanned'
  | 'issueCycle'
  | 'issueDangling'
  | 'issueSelfLoop'
  | 'issuePort'
  | 'issueRequired'
  | 'validationOk'
  | 'validationTitle'
  | 'canvasSaved'
  | 'compacted'
  | 'compactAssets'
  | 'paneCanvas'
  | 'canvasEdgesCount'
  | 'canvasNodesCount'
  | 'canvasNoParams'
  | 'canvasSelfLoop'
  | 'nodeCreativeInput'
  | 'nodeScript'
  | 'nodeStoryboard'
  | 'nodeAssetReference'
  | 'nodeResourceReference'
  | 'nodeMotionTrack'
  | 'nodeImageGenerate'
  | 'nodeVideoGenerate'
  | 'nodePreview'
  | 'nodePublishAsset'
  | 'nodeSubtitle'
  | 'nodeRender'
  | 'nodeLipSync'
  | 'nodeFaceSwap'
  | 'nodeVoiceSynthesize'
  | 'plannedLipSync'
  | 'plannedFaceSwap'
  | 'plannedVoice'
  | 'canvasPalette'
  | 'canvasAdd'
  | 'canvasParams'
  | 'canvasDeleteNode'
  | 'canvasFit'
  | 'canvasEmpty'
  | 'canvasPlannedTag'
  | 'canvasTransient'
  | 'paramBrief'
  | 'paramScript'
  | 'paramShots'
  | 'paramNote'
  | 'paramAsset'
  | 'paramResource'
  | 'paramModel'
  | 'paramPrompt'
  | 'paramRatio'
  | 'paramDuration'
  | 'paramResolution'
  | 'paramReferenceVideo'
  | 'paramCompare'
  | 'paramAssetName'
  | 'ratioSquare'
  | 'ratioPortrait'
  | 'ratioLandscape'
  | 'ratioVertical'
  | 'resolution480'
  | 'resolution768'
  | 'resolution2k'
  | 'resolutionDefault'
  | 'rename'
  | 'save'
  | 'cancel'
  | 'resourceNamePlaceholder'
  | 'notePlaceholder'
  | 'noResources'
  | 'addResource'
  | 'alreadyRegistered'
  | 'previewOutput'
  | 'filterAll'
  | 'filterImage'
  | 'filterVideo'
  | 'kindRole'
  | 'kindScene'
  | 'kindProp'
  | 'kindBrand'
  | 'kindStyle'
  | 'kindVoice'

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
  cancelTask: 'Cancel task',
  ffmpegRecheck: 'Re-check ffmpeg',
  ffmpegOk: 'ffmpeg',
  stylePosition: 'Position',
  styleColor: 'Color',
  styleFontSize: 'Size',
  playhead: 'Playhead',
  previewNote: 'Sequence preview: picks the clip at the playhead, no transcoding. Export may differ by a frame or two.',
  previewIdle: 'No clip at this time',
  previewTitle: 'Sequence preview',
  burnSubtitles: 'Burn subtitles into the video',
  pickAsset: 'Asset',
  timelineTitle: 'Timeline',
  subtitlePlaceholder: 'Subtitle text',
  timelineTotal: 'Total',
  clipDuration: 'Duration (ms)',
  clipStart: 'Start (ms)',
  timelineEmpty: 'No clips yet — add from the assets on the right',
  addSubtitle: 'Add subtitle',
  addClip: 'Add to track',
  trackSubtitle: 'Subtitle track',
  trackAudio: 'Audio track',
  trackVideo: 'Video track',
  templateReferenceRemake: 'Reference video remake (compare)',
  templateImageToVideo: 'Image -> video -> subtitle -> render',
  templateCopyToVideo: 'Copy -> storyboard -> image -> video',
  templateApply: 'Apply template',
  templateTitle: 'Template',
  runHistory: 'History',
  runArtifacts: 'artifacts',
  statusSkipped: 'Skipped',
  runNone: 'No run yet',
  runTitle: 'Run',
  runRetry: 'Retry failed nodes',
  runCancel: 'Cancel run',
  runStart: 'Run workflow',
  issuePlanned: 'planned node cannot run',
  issueCycle: 'graph has a cycle',
  issueDangling: 'edge points at a missing node',
  issueSelfLoop: 'node connects to itself',
  issuePort: 'port types do not match',
  issueRequired: 'required parameter is empty',
  validationOk: 'Graph is runnable',
  validationTitle: 'Graph check',
  canvasSaved: 'Canvas saved',
  compacted: 'Merged duplicate records',
  compactAssets: 'Merge duplicate records',
  paneCanvas: 'Workflow canvas',
  canvasEdgesCount: 'links',
  canvasNodesCount: 'nodes',
  canvasNoParams: 'This node has no parameters yet',
  canvasSelfLoop: 'A node cannot connect to itself',
  nodeCreativeInput: 'Creative input',
  nodeScript: 'Script',
  nodeStoryboard: 'Storyboard',
  nodeAssetReference: 'Asset reference',
  nodeResourceReference: 'Resource reference',
  nodeMotionTrack: 'Motion track',
  nodeImageGenerate: 'Image generate',
  nodeVideoGenerate: 'Video generate',
  nodePreview: 'Preview',
  nodePublishAsset: 'Publish asset',
  nodeSubtitle: 'Subtitle',
  nodeRender: 'Render',
  nodeLipSync: 'Lip sync',
  nodeFaceSwap: 'Face swap',
  nodeVoiceSynthesize: 'Voice synthesize',
  plannedLipSync: 'Host does not expose lip-sync yet',
  plannedFaceSwap: 'Host does not expose face swap yet',
  plannedVoice: 'Per D6 this release keeps voice metadata only; no TTS yet',
  canvasPalette: 'Node library',
  canvasAdd: 'Add to canvas',
  canvasParams: 'Node parameters',
  canvasDeleteNode: 'Delete node',
  canvasFit: 'Fit view',
  canvasEmpty: 'Add nodes from the library on the left',
  canvasPlannedTag: 'not available',
  canvasTransient: 'Workflow is kept on this machine; project storage lands with the host endpoint',
  paramBrief: 'Creative brief',
  paramScript: 'Copy',
  paramShots: 'Shots',
  paramNote: 'Note',
  paramAsset: 'Asset',
  paramResource: 'Resource',
  paramModel: 'Model (blank = host default)',
  paramPrompt: 'Prompt',
  paramRatio: 'Aspect ratio',
  paramDuration: 'Duration (s)',
  paramResolution: 'Resolution',
  paramReferenceVideo: 'Reference video',
  paramCompare: 'Also render a comparison clip',
  paramAssetName: 'Asset name',
  ratioSquare: '1:1',
  ratioPortrait: '3:4',
  ratioLandscape: '16:9',
  ratioVertical: '9:16',
  resolutionDefault: 'Model default',
  resolution480: '480P',
  resolution768: '768P',
  resolution2k: '2K',
  rename: 'Rename',
  save: 'Save',
  cancel: 'Cancel',
  resourceNamePlaceholder: 'Name',
  notePlaceholder: 'Note (optional)',
  noResources: 'No resources in this project yet',
  addResource: 'Add resource',
  alreadyRegistered: 'Already registered in this project',
  previewOutput: 'Preview output',
  filterAll: 'All media',
  filterImage: 'Images',
  filterVideo: 'Videos',
  kindRole: 'Role',
  kindScene: 'Scene',
  kindProp: 'Prop',
  kindBrand: 'Brand',
  kindStyle: 'Style',
  kindVoice: 'Voice',
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
  emptyHint: '项目、素材、资源与任务账本已可用；「专业工作流」模式里是节点画布（执行与项目存储随后端接入）。',
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
  cancelTask: '取消任务',
  ffmpegRecheck: '重新检查 ffmpeg',
  ffmpegOk: 'ffmpeg',
  stylePosition: '位置',
  styleColor: '颜色',
  styleFontSize: '字号',
  playhead: '播放头',
  previewNote: '顺序预览：按播放头取当前片段，不做转码；导出（T5-5）可能有一两帧差异。',
  previewIdle: '这个时间点没有画面',
  previewTitle: '顺序预览',
  burnSubtitles: '导出时烧录字幕',
  pickAsset: '选择素材',
  timelineTitle: '时间轴',
  subtitlePlaceholder: '字幕文本',
  timelineTotal: '总时长',
  clipDuration: '时长(ms)',
  clipStart: '起点(ms)',
  timelineEmpty: '还没有片段——从右侧素材里加入',
  addSubtitle: '加入字幕',
  addClip: '加入轨道',
  trackSubtitle: '字幕轨',
  trackAudio: '音频轨',
  trackVideo: '视频轨',
  templateReferenceRemake: '参考视频复刻（含对比片）',
  templateImageToVideo: '图片→视频→字幕→渲染',
  templateCopyToVideo: '文案→分镜→图→视频',
  templateApply: '套用模板',
  templateTitle: '模板',
  runHistory: '历史运行',
  runArtifacts: '个产物',
  statusSkipped: '已跳过',
  runNone: '还没有运行记录',
  runTitle: '运行',
  runRetry: '重试失败节点',
  runCancel: '取消运行',
  runStart: '运行流程',
  issuePlanned: '预留节点不可运行',
  issueCycle: '图里有环',
  issueDangling: '连线指向不存在的节点',
  issueSelfLoop: '节点连到自己',
  issuePort: '端口类型不匹配',
  issueRequired: '必填参数为空',
  validationOk: '图可运行',
  validationTitle: '图校验',
  canvasSaved: '画布已保存',
  compacted: '已整理重复记录',
  compactAssets: '整理重复记录',
  paneCanvas: '工作流画布',
  canvasEdgesCount: '条连线',
  canvasNodesCount: '个节点',
  canvasNoParams: '这个节点暂时没有参数',
  canvasSelfLoop: '节点不能连到自己',
  nodeCreativeInput: '创作输入',
  nodeScript: '脚本',
  nodeStoryboard: '分镜',
  nodeAssetReference: '素材引用',
  nodeResourceReference: '资源引用',
  nodeMotionTrack: '运动轨迹',
  nodeImageGenerate: '图片生成',
  nodeVideoGenerate: '视频生成',
  nodePreview: '预览',
  nodePublishAsset: '发布素材',
  nodeSubtitle: '字幕',
  nodeRender: '渲染',
  nodeLipSync: '口型同步',
  nodeFaceSwap: '换脸',
  nodeVoiceSynthesize: '语音合成',
  plannedLipSync: '宿主尚未提供口型/唇形能力',
  plannedFaceSwap: '宿主尚未提供换脸能力',
  plannedVoice: 'D6 本期只做音色元数据，未接 TTS',
  canvasPalette: '节点库',
  canvasAdd: '加入画布',
  canvasParams: '节点参数',
  canvasDeleteNode: '删除节点',
  canvasFit: '适配窗口',
  canvasEmpty: '从左侧节点库添加节点',
  canvasPlannedTag: '未提供',
  canvasTransient: '工作流暂存在本机（项目存储随宿主端点接入）',
  paramBrief: '创作诉求',
  paramScript: '文案',
  paramShots: '分镜数',
  paramNote: '备注',
  paramAsset: '素材',
  paramResource: '资源',
  paramModel: '模型（留空用宿主默认）',
  paramPrompt: '提示词',
  paramRatio: '比例',
  paramDuration: '时长（秒）',
  paramResolution: '分辨率',
  paramReferenceVideo: '参考视频',
  paramCompare: '同时生成对比片',
  paramAssetName: '素材名',
  ratioSquare: '1:1',
  ratioPortrait: '3:4',
  ratioLandscape: '16:9',
  ratioVertical: '9:16',
  resolutionDefault: '模型默认',
  resolution480: '480P',
  resolution768: '768P',
  resolution2k: '2K',
  rename: '改名',
  save: '保存',
  cancel: '取消',
  resourceNamePlaceholder: '名称',
  notePlaceholder: '备注（可选）',
  noResources: '这个项目还没有创作资源',
  addResource: '新建资源',
  alreadyRegistered: '该产物已登记过',
  previewOutput: '预览产出',
  filterAll: '全部素材',
  filterImage: '只看图片',
  filterVideo: '只看视频',
  kindRole: '角色',
  kindScene: '场景',
  kindProp: '道具',
  kindBrand: '品牌',
  kindStyle: '风格',
  kindVoice: '音色',
}
