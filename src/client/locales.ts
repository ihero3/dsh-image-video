/** Workbench copy: every string the right-pane surface renders. */

/** Locale keys the workbench renders. */
export type WorkbenchLocaleKey =
  | 'generateReferenceLabel'
  | 'generateReferenceNone'
  | 'generateUseSelected'
  | 'generateClearReference'
  | 'referenceAsset'
  | 'generateHeading'
  | 'generatePromptLabel'
  | 'generatePromptPlaceholder'
  | 'generateImage'
  | 'generateVideo'
  | 'generating'
  | 'generateCancel'
  | 'generateDone'
  | 'generateFailed'
  | 'generateNeedsProject'
  | 'generateCostHint'
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
  | 'defaultsEditHint'
  | 'defaultsGroupMode'
  | 'defaultsGroupImage'
  | 'defaultsGroupVideo'
  | 'optModeText'
  | 'optModeImage'
  | 'optModeVideo'
  | 'optStylePhoto'
  | 'optStyleIllustration'
  | 'optStyle3d'
  | 'optStyleAnime'
  | 'optStyleInk'
  | 'defaultsSaved'
  | 'defaultsCancel'
  | 'defaultsSave'
  | 'defaultsEdit'
  | 'resourceUseUnit'
  | 'resourceUsedBy'
  | 'resourceUnused'
  | 'statusImportedIdle'
  | 'resourceMotionTrack'
  | 'paramTrack'
  | 'forceRemove'
  | 'hostHintRemote'
  | 'none'
  | 'defaultMediaMode'
  | 'defaultVideoDuration'
  | 'defaultVideoAspectRatio'
  | 'defaultVideoProvider'
  | 'defaultImageStyle'
  | 'defaultImageSize'
  | 'defaultImageProvider'
  | 'defaultsTitle'
  | 'exportResult'
  | 'exportFailed'
  | 'exportDone'
  | 'exportRunning'
  | 'exportCancel'
  | 'exportStart'
  | 'ffmpegRecheck'
  | 'ffmpegOk'
  | 'stylePosition'
  | 'styleColor'
  | 'styleFontSize'
  | 'playhead'
  | 'previewNote'
  | 'previewIdle'
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
  | 'brandTagline'
  | 'modeQuickHint'
  | 'statOutputs'
  | 'statAssets'
  | 'statTasks'
  | 'statResources'
  | 'heroStepChat'
  | 'heroStepOutputs'
  | 'heroStepFile'
  | 'railAssets'
  | 'railTasks'
  | 'railDefaults'
  | 'statusReady'
  | 'monitorProgram'
  | 'transportPlay'
  | 'timelineZoom'
  | 'trackVideoId'
  | 'trackAudioId'
  | 'trackSubtitleId'
  | 'paneError'
  | 'paneErrorRetry'
  | 'canvasUndo'
  | 'canvasRedo'
  | 'canvasCopy'
  | 'canvasPaste'
  | 'canvasPasteEmpty'
  | 'canvasDeleteSelected'
  | 'canvasRunNode'
  | 'canvasSelected'
  | 'nodeErrorDetails'
  | 'clipDuplicate'
  | 'transportPause'
  | 'clipResizeStart'
  | 'clipResizeEnd'
  | 'fps'
  | 'clipSpeed'
  | 'clipFade'
  | 'clipTransition'
  | 'clipTransitionDuration'
  | 'clipCrop'
  | 'clipCropX'
  | 'clipCropY'
  | 'clipCropW'
  | 'clipCropH'
  | 'clipCropRemove'
  | 'trackFade'
  | 'normalizeLoudness'
  | 'transitionFade'
  | 'transitionWipeleft'
  | 'transitionCircleopen'
  | 'subtitlesBatch'
  | 'subtitlesBatchPlaceholder'
  | 'subtitlesApply'
  | 'templateMarket'
  | 'templateMarketEmpty'
  | 'templateDramaSeries'
  | 'paneDiagnostics'
  | 'diagOutputs'
  | 'diagRenders'
  | 'diagRenderP50'
  | 'diagRenderP90'
  | 'diagRenderFinished'
  | 'diagRenderFailed'
  | 'diagErrors'
  | 'diagErrorsNone'
  | 'diagRefresh'

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
  generateReferenceLabel: 'Reference image',
  generateReferenceNone: 'None (text-to-image / text-to-video)',
  generateUseSelected: 'Use selected asset',
  generateClearReference: 'Clear reference',
  referenceAsset: 'Reference in prompt',

  generateHeading: 'Generate here',
  generatePromptLabel: 'Prompt',
  generatePromptPlaceholder: 'Describe the shot you want…',
  generateImage: 'Generate image',
  generateVideo: 'Generate video',
  generating: 'Generating…',
  generateCancel: 'Cancel',
  generateDone: 'Generated and filed as an asset',
  generateFailed: 'Generation failed',
  generateNeedsProject: 'Pick a project at the top first, otherwise the result cannot be filed.',
  generateCostHint: 'Runs against the effective parameters — this is a real provider call.',

  modeWorkflow: 'Workflow',
  modeTimeline: 'Timeline',
  paneAssets: 'Media assets',
  paneResources: 'Resources',
  panePreview: 'Preview',
  paneTasks: 'Tasks',
  emptyHint: 'Projects, assets, the task ledger and a runnable node canvas are all available.',
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
  defaultsEditHint: 'Leave "Not set" to follow settings',
  defaultsGroupMode: 'Media type',
  defaultsGroupImage: 'Image',
  defaultsGroupVideo: 'Video',
  optModeText: 'Text',
  optModeImage: 'Image',
  optModeVideo: 'Video',
  optStylePhoto: 'Photo',
  optStyleIllustration: 'Illustration',
  optStyle3d: '3D render',
  optStyleAnime: 'Anime',
  optStyleInk: 'Ink painting',
  defaultsSaved: 'Defaults saved',
  defaultsCancel: 'Cancel',
  defaultsSave: 'Save defaults',
  defaultsEdit: 'Edit',
  resourceUseUnit: 'artifacts',
  resourceUsedBy: 'Used by',
  resourceUnused: 'Not used by any artifact yet',
  statusImportedIdle: 'Imported (not running)',
  resourceMotionTrack: 'Motion track',
  paramTrack: 'Track resource',
  forceRemove: 'Delete anyway',
  hostHintRemote: 'Preview needs a local host: /outputs is only served on loopback. Open this app via http://127.0.0.1:… instead.',
  none: 'not set',
  defaultMediaMode: 'Composer mode',
  defaultVideoDuration: 'Video duration',
  defaultVideoAspectRatio: 'Video ratio',
  defaultVideoProvider: 'Video provider',
  defaultImageStyle: 'Image style',
  defaultImageSize: 'Image size',
  defaultImageProvider: 'Image provider',
  defaultsTitle: 'Effective defaults',
  exportResult: 'Result',
  exportFailed: 'Export failed',
  exportDone: 'Exported',
  exportRunning: 'Exporting',
  exportCancel: 'Cancel export',
  exportStart: 'Export video',
  ffmpegRecheck: 'Re-check ffmpeg',
  ffmpegOk: 'ffmpeg',
  stylePosition: 'Position',
  styleColor: 'Color',
  styleFontSize: 'Size',
  playhead: 'Playhead',
  previewNote: 'Sequence preview: picks the clip at the playhead, no transcoding. Export may differ by a frame or two.',
  previewIdle: 'No clip at this time',
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
  brandTagline: 'Media production workbench',
  modeQuickHint: 'Generate images or videos straight from the composer. Once a file lands in the local output directory, file it into the active project from the Media assets panel in one click.',
  statOutputs: 'Outputs',
  statAssets: 'Assets',
  statTasks: 'Tasks',
  statResources: 'Resources',
  heroStepChat: 'Generate in chat',
  heroStepOutputs: 'Lands in outputs',
  heroStepFile: 'File into project',
  railAssets: 'Media assets',
  railTasks: 'Tasks',
  railDefaults: 'Effective defaults',
  statusReady: 'Ready',
  monitorProgram: 'Program',
  transportPlay: 'Play',
  timelineZoom: 'Zoom',
  trackVideoId: 'V1',
  trackAudioId: 'A1',
  trackSubtitleId: 'S1',
  paneError: 'This panel hit an error',
  paneErrorRetry: 'Retry',
  canvasUndo: 'Undo',
  canvasRedo: 'Redo',
  canvasCopy: 'Copy nodes',
  canvasPaste: 'Paste nodes',
  canvasPasteEmpty: 'Clipboard is empty — select nodes and copy first',
  canvasDeleteSelected: 'Delete selected nodes',
  canvasRunNode: 'Run this node (with downstream)',
  canvasSelected: 'selected',
  nodeErrorDetails: 'Error details',
  clipDuplicate: 'Duplicate clip',
  transportPause: 'Pause',
  clipResizeStart: 'Drag to change clip start',
  clipResizeEnd: 'Drag to change clip duration',
  fps: 'FPS',
  clipSpeed: 'Speed',
  clipFade: 'Fade (ms)',
  clipTransition: 'Transition',
  clipTransitionDuration: 'Transition duration (ms)',
  clipCrop: 'Crop',
  clipCropX: 'Crop X',
  clipCropY: 'Crop Y',
  clipCropW: 'Crop width',
  clipCropH: 'Crop height',
  clipCropRemove: 'Remove crop',
  trackFade: 'Fade',
  normalizeLoudness: 'Normalize loudness',
  transitionFade: 'Fade',
  transitionWipeleft: 'Wipe left',
  transitionCircleopen: 'Circle open',
  subtitlesBatch: 'Batch subtitles',
  subtitlesBatchPlaceholder: 'Paste a script — auto-split into timed subtitles',
  subtitlesApply: 'Lay subtitles',
  templateMarket: 'Template market',
  templateMarketEmpty: 'Pick a template to scaffold a workflow',
  templateDramaSeries: 'Drama series (single episode)',
  paneDiagnostics: 'Diagnostics',
  diagOutputs: 'Outputs',
  diagRenders: 'Renders',
  diagRenderP50: 'p50',
  diagRenderP90: 'p90',
  diagRenderFinished: 'finished',
  diagRenderFailed: 'failed',
  diagErrors: 'Recent errors',
  diagErrorsNone: 'No errors recorded',
  diagRefresh: 'Refresh',
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
  generateReferenceLabel: '参考图',
  generateReferenceNone: '未指定（纯文生图 / 文生视频）',
  generateUseSelected: '用选中素材',
  generateClearReference: '清除参考',
  referenceAsset: '引用到提示词',

  generateHeading: '直接生成',
  generatePromptLabel: '提示词',
  generatePromptPlaceholder: '描述你想要的画面…',
  generateImage: '生成图片',
  generateVideo: '生成视频',
  generating: '生成中…',
  generateCancel: '取消生成',
  generateDone: '已生成，并登记为项目素材',
  generateFailed: '生成失败',
  generateNeedsProject: '先在顶部选一个项目，生成结果才好归档。',
  generateCostHint: '按当前生效参数真实调用服务商（会产生费用）。',

  modeWorkflow: '专业工作流',
  modeTimeline: '时间轴精剪',
  paneAssets: '媒体素材',
  paneResources: '创作资源',
  panePreview: '预览',
  paneTasks: '任务',
  emptyHint: '项目、素材、资源与任务账本已可用；「专业工作流」模式里是可直接运行的节点画布。',
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
  defaultsEditHint: '选「未设置」= 跟随设置',
  defaultsGroupMode: '媒体类型',
  defaultsGroupImage: '图像',
  defaultsGroupVideo: '视频',
  optModeText: '文本',
  optModeImage: '图片',
  optModeVideo: '视频',
  optStylePhoto: '摄影',
  optStyleIllustration: '插画',
  optStyle3d: '3D 渲染',
  optStyleAnime: '动漫',
  optStyleInk: '水墨',
  defaultsSaved: '默认值已保存',
  defaultsCancel: '取消',
  defaultsSave: '保存默认值',
  defaultsEdit: '编辑',
  resourceUseUnit: '次产物',
  resourceUsedBy: '被用到',
  resourceUnused: '还没被任何产物用过',
  statusImportedIdle: '已导入（未运行）',
  resourceMotionTrack: '轨迹',
  paramTrack: '轨迹资源',
  forceRemove: '仍要删除',
  hostHintRemote: '预览需要本机访问宿主：/outputs 只在回环地址注册。请改用 http://127.0.0.1:… 打开本应用。',
  none: '未设置',
  defaultMediaMode: '输入模式',
  defaultVideoDuration: '视频时长',
  defaultVideoAspectRatio: '视频比例',
  defaultVideoProvider: '视频服务商',
  defaultImageStyle: '图片风格',
  defaultImageSize: '图片尺寸',
  defaultImageProvider: '图片服务商',
  defaultsTitle: '当前生效参数',
  exportResult: '产物',
  exportFailed: '导出失败',
  exportDone: '导出完成',
  exportRunning: '导出中',
  exportCancel: '取消导出',
  exportStart: '导出成片',
  ffmpegRecheck: '重新检查 ffmpeg',
  ffmpegOk: 'ffmpeg',
  stylePosition: '位置',
  styleColor: '颜色',
  styleFontSize: '字号',
  playhead: '播放头',
  previewNote: '顺序预览：按播放头取当前片段，不做转码；导出（T5-5）可能有一两帧差异。',
  previewIdle: '这个时间点没有画面',
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
  brandTagline: '媒体创作工作台',
  modeQuickHint: '在中间对话区直接出图或出片；产物落在本机输出目录后，可在「媒体素材」面板一键登记进当前项目。',
  statOutputs: '输出产物',
  statAssets: '媒体素材',
  statTasks: '生成任务',
  statResources: '创作资源',
  heroStepChat: '对话区生成',
  heroStepOutputs: '落入输出目录',
  heroStepFile: '登记进项目',
  railAssets: '媒体素材',
  railTasks: '生成任务',
  railDefaults: '生效默认值',
  statusReady: '就绪',
  monitorProgram: '节目监视器',
  transportPlay: '播放',
  timelineZoom: '缩放',
  trackVideoId: 'V1',
  trackAudioId: 'A1',
  trackSubtitleId: 'S1',
  paneError: '该面板出错',
  paneErrorRetry: '重试',
  canvasUndo: '撤销',
  canvasRedo: '重做',
  canvasCopy: '复制节点',
  canvasPaste: '粘贴节点',
  canvasPasteEmpty: '剪贴板是空的——先选中节点再复制',
  canvasDeleteSelected: '删除选中节点',
  canvasRunNode: '运行此节点（含下游）',
  canvasSelected: '已选中',
  nodeErrorDetails: '错误详情',
  clipDuplicate: '复制片段',
  transportPause: '暂停',
  clipResizeStart: '拖动改变片段起点',
  clipResizeEnd: '拖动改变片段时长',
  fps: '帧率',
  clipSpeed: '变速',
  clipFade: '淡入淡出(ms)',
  clipTransition: '转场',
  clipTransitionDuration: '转场时长(ms)',
  clipCrop: '裁剪',
  clipCropX: '裁剪X',
  clipCropY: '裁剪Y',
  clipCropW: '裁剪宽',
  clipCropH: '裁剪高',
  clipCropRemove: '移除裁剪',
  trackFade: '淡入淡出',
  normalizeLoudness: '响度归一化',
  transitionFade: '淡入',
  transitionWipeleft: '左擦除',
  transitionCircleopen: '圆形展开',
  subtitlesBatch: '批量字幕',
  subtitlesBatchPlaceholder: '粘贴一段台词——自动按句切分成字幕',
  subtitlesApply: '铺字幕',
  templateMarket: '模板市场',
  templateMarketEmpty: '选一个模板来搭好工作流骨架',
  templateDramaSeries: '漫剧/连续剧（单集）',
  paneDiagnostics: '诊断',
  diagOutputs: '输出占用',
  diagRenders: '渲染',
  diagRenderP50: 'p50',
  diagRenderP90: 'p90',
  diagRenderFinished: '完成',
  diagRenderFailed: '失败',
  diagErrors: '最近错误',
  diagErrorsNone: '暂无错误记录',
  diagRefresh: '刷新',
}
