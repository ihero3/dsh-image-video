/** Workbench copy: every string the right-pane surface renders. */

/** Locale keys the workbench renders. */
export type WorkbenchLocaleKey =
  | 'templateQuickImage'
  | 'templateQuickVideo'
  | 'templateStoryboard'
  | 'templateCover'
  | 'resourceReference'
  | 'resourceUseSelected'
  | 'resourceClear'
  | 'attachAll'
  | 'skippedCount'
  | 'attachAllDone'
  | 'importFiles'
  | 'importDone'
  | 'importUnsupported'
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
  // ---- F2 多参考图选择器 ----
  | 'generateRefsLabel'
  | 'generateRefsHint'
  | 'generateRefsAdd'
  | 'generateRefsFull'
  | 'generateRefsMoveUp'
  | 'generateRefsMoveDown'
  | 'generateRefsBase'
  | 'generateRefsStyle'
  // ---- F3 生成进度 ----
  | 'generateElapsed'
  | 'generateProgress'
  // ---- G4 首尾帧 / 视频编辑 ----
  | 'videoLastFrame'
  | 'videoReferenceVideo'
  | 'videoEditHint'
  | 'videoRealPerson'
  | 'videoEditPending'
  // ---- G2 物料库分栏 ----
  | 'resourceLibraries'
  | 'resourceTabOther'
  | 'resourceFilterPlaceholder'
  // ---- B17 片段分割 ----
  | 'clipSplit'
  | 'clipSplitOutsideHint'
  // ---- B-6 模板市场（F4 快速模板分组 + 描述） ----
  | 'templateQuickGroup'
  | 'templateFullGroup'
  | 'templateQuickImageHint'
  | 'templateQuickVideoHint'
  | 'templateStoryboardHint'
  | 'templateCoverHint'
  // ---- B-7 素材批量操作 ----
  | 'assetSelect'
  | 'assetSelectedCount'
  | 'bulkRemove'
  | 'bulkReference'
  | 'bulkClear'
  | 'bulkRemoveDone'
  | 'bulkRemoveSkipped'
  | 'bulkForceRemove'
  | 'bulkReferenceDone'
  | 'bulkReferenceNone'
  // ---- B-8 资源多参考图 ----
  | 'resourceRefsManage'
  | 'resourceRefsEditorTitle'
  | 'resourceRefsAdd'
  | 'resourceRefsRemove'
  | 'resourceRefsClear'
  | 'resourceRefsFull'
  | 'resourceRefsCount'
  | 'resourceRefsDuplicate'
  | 'resourceAttachSelected'
  | 'resourceRefsNone'
  // ---- B-9 融合生图（G3，依赖 A-4 media/compose） ----
  | 'fusionTitle'
  | 'fusionHint'
  | 'fusionPromptPlaceholder'
  | 'fusionRoles'
  | 'fusionScenes'
  | 'fusionProps'
  | 'fusionNoResources'
  | 'fusionPreview'
  | 'fusionPreviewNone'
  | 'fusionRun'
  | 'fusionRunning'
  | 'fusionDone'
  | 'fusionFailed'
  | 'fusionNeedsPrompt'
  | 'fusionClear'
  // ---- B-10 提示词工坊（G1，依赖 A-5 prompts/extract） ----
  | 'promptTitle'
  | 'promptHint'
  | 'promptExtract'
  | 'promptExtracting'
  | 'promptExtractNeedsAsset'
  | 'promptExtractDone'
  | 'promptExtractFailed'
  | 'promptExtractEmpty'
  | 'promptDraftLabel'
  | 'promptNameLabel'
  | 'promptNamePlaceholder'
  | 'promptUntitled'
  | 'promptSave'
  | 'promptSaveDone'
  | 'promptSaveFailed'
  | 'promptNeedsText'
  | 'promptLibrary'
  | 'promptLibraryEmpty'
  | 'promptApply'
  | 'promptApplyDone'
  | 'promptRemove'
  | 'promptSavedCount'
  | 'composeNeedsPrompt'
  | 'composeEmptyHint'
  | 'composeSelected'
  | 'composeSelectHint'
  | 'composePromptPlaceholder'
  | 'composeDone'
  | 'composeAssetCreated'
  | 'composeBusy'
  | 'composeRun'
  | 'promptNew'
  | 'promptRefresh'
  | 'promptExtractLabel'
  | 'promptPickAsset'
  | 'promptNoImageAssets'
  | 'promptExtractEmpty'
  | 'promptNeedSetup'
  | 'promptNamePlaceholder'
  | 'promptTextPlaceholder'
  | 'promptTagsPlaceholder'
  | 'promptSave'
  | 'promptCancel'
  | 'promptEmpty'
  | 'promptUse'
  | 'promptEdit'
  | 'healthSize'
  | 'healthDupes'
  | 'healthStats'
  | 'healthRun'
  | 'healthRunning'
  | 'healthEmptyHint'
  | 'healthSizeSummary'
  | 'healthMedian'
  | 'healthUnused'
  | 'healthNoDupes'
  | 'healthReclaimable'
  | 'healthSuggestedKeep'
  | 'healthNoProjects'
  | 'healthAssets'
  | 'healthReferenced'
  | 'healthTimelines'

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
  templateQuickImage: 'Quick image',
  templateQuickVideo: 'Quick video',
  templateStoryboard: 'Storyboard',
  templateCover: 'Cover image',

  resourceReference: 'Reference (makeup shot)',
  resourceUseSelected: 'Use selected asset',
  resourceClear: 'Clear',

  attachAll: 'Register all new',
  skippedCount: 'skipped',
  attachAllDone: 'Registered',
  importFiles: 'Import files…',
  importDone: 'Imported',
  importUnsupported: 'Cannot read file paths here — importing needs the desktop app.',

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

  generateRefsLabel: 'Reference images (ordered)',
  generateRefsHint: 'First = base image, the rest = style / face references. Up to 6 — drag a chip or use the arrows to reorder.',
  generateRefsAdd: 'Add selected asset',
  generateRefsFull: 'At most 6 reference images',
  generateRefsMoveUp: 'Move earlier',
  generateRefsMoveDown: 'Move later',
  generateRefsBase: 'base',
  generateRefsStyle: 'ref',

  generateElapsed: 'Generating · {sec}s',
  generateProgress: 'Generation progress',

  videoLastFrame: 'Last frame image',
  videoReferenceVideo: 'Reference video',
  videoEditHint: 'Video generation only: the last frame goes out as media[].type=last_frame; a reference video as reference_video (keeps the original framing and motion, rewrites content from your prompt).',
  videoRealPerson: 'The reference video shows a real person',
  videoEditPending: 'Last frame / reference video ride along in the request (media field) — they take effect once the host forwards them on media/generate.',

  resourceLibraries: 'Libraries',
  resourceTabOther: 'Other',
  resourceFilterPlaceholder: 'Filter by name',

  clipSplit: 'Split at playhead',
  clipSplitOutsideHint: 'The playhead is outside this clip',

  templateQuickGroup: 'Quick start',
  templateFullGroup: 'Full pipeline',
  templateQuickImageHint: 'One line → a first-frame image (2 nodes)',
  templateQuickVideoHint: 'One line → first frame → a 5s video (3 nodes)',
  templateStoryboardHint: 'Brief → script → storyboard → first frame (4 nodes)',
  templateCoverHint: 'One line → a vertical cover image (2 nodes)',

  assetSelect: 'Select asset',
  assetSelectedCount: '{n} selected',
  bulkRemove: 'Delete selected',
  bulkReference: 'Reference selected',
  bulkClear: 'Clear selection',
  bulkRemoveDone: 'Deleted {n} assets',
  bulkRemoveSkipped: '{n} skipped',
  bulkForceRemove: 'Force delete selected',
  bulkReferenceDone: 'Referenced {n} into the generate form',
  bulkReferenceNone: 'No image assets in the selection',

  resourceRefsManage: 'Manage references',
  resourceRefsEditorTitle: 'References of {name}',
  resourceRefsAdd: 'Attach selected asset',
  resourceRefsRemove: 'Remove reference',
  resourceRefsClear: 'Clear references',
  resourceRefsFull: 'At most 6 references per resource',
  resourceRefsCount: '{n} references',
  resourceRefsDuplicate: 'Already attached to this resource',
  resourceAttachSelected: 'Attach the selected asset to this resource',
  resourceRefsNone: 'No reference image yet',

  // ---- B-9 fusion generation (G3, needs A-4 media/compose) ----
  fusionTitle: 'Fusion generation',
  fusionHint: 'Pick roles, scenes and props, then compose them into one shot with a single prompt. Needs the host endpoint media/compose (A-4).',
  fusionPromptPlaceholder: 'Describe how the selected roles, scenes and props come together…',
  fusionRoles: 'Roles',
  fusionScenes: 'Scenes',
  fusionProps: 'Props',
  fusionNoResources: 'Nothing to pick yet — add resources first.',
  fusionPreview: '{n} reference images will be used',
  fusionPreviewNone: 'No reference images — falls back to plain text-to-image',
  fusionRun: 'Compose & generate',
  fusionRunning: 'Composing…',
  fusionDone: 'Composed and filed as an asset',
  fusionFailed: 'Fusion failed',
  fusionNeedsPrompt: 'Write a prompt first',
  fusionClear: 'Clear selection',

  // ---- B-10 prompt studio (G1, needs A-5 prompts/extract) ----
  promptTitle: 'Prompt studio',
  promptHint: 'Extract a structured prompt from a selected image, edit it, then save it to the prompt library. Needs the host endpoint prompts/extract (A-5).',
  promptExtract: 'Extract prompt',
  promptExtracting: 'Extracting…',
  promptExtractNeedsAsset: 'Select an image asset first',
  promptExtractDone: 'Prompt extracted — edit it below',
  promptExtractFailed: 'Extraction failed',
  promptExtractEmpty: 'The extractor returned nothing — try another image',
  promptDraftLabel: 'Extracted prompt (editable)',
  promptNameLabel: 'Prompt name',
  promptNamePlaceholder: 'e.g. soft cinematic portrait',
  promptUntitled: 'Untitled prompt',
  promptSave: 'Save to library',
  promptSaveDone: 'Saved to the prompt library',
  promptSaveFailed: 'Could not save',
  promptNeedsText: 'Nothing to save yet',
  promptLibrary: 'Prompt library',
  promptLibraryEmpty: 'No saved prompts yet',
  promptApply: 'Use in form',
  promptApplyDone: 'Loaded into the prompt box',
  promptRemove: 'Delete prompt',
  promptSavedCount: '{n} prompts',
  composeNeedsPrompt: 'Describe your scene before fusing.',
  composeEmptyHint: 'No resources of this kind yet — create one under Resources.',
  composeSelected: 'Selected',
  composeSelectHint: 'Pick a few resources from the columns above to fuse.',
  composePromptPlaceholder: 'Describe the final look: style, mood, details…',
  composeDone: 'Fused into',
  composeAssetCreated: 'new asset',
  composeBusy: 'Fusing…',
  composeRun: 'Fuse and generate',
  promptNew: 'New',
  promptRefresh: 'Reload',
  promptExtractLabel: 'Extract from image',
  promptPickAsset: 'Pick an image asset…',
  promptNoImageAssets: 'No image assets yet — generate one first.',
  promptExtractEmpty: 'Extraction returned nothing. Edit manually below.',
  promptNeedSetup: 'Visual model not configured. You can still type a prompt by hand.',
  promptNamePlaceholder: 'Name this prompt',
  promptTextPlaceholder: 'Prompt text — what the model will see',
  promptTagsPlaceholder: 'tags, comma-separated',
  promptSave: 'Save',
  promptCancel: 'Cancel',
  promptEmpty: 'No saved prompts yet. Save one or extract from an image.',
  promptUse: 'Use',
  promptEdit: 'Edit',
  healthSize: 'Size report',
  healthDupes: 'Duplicates',
  healthStats: 'Per-project',
  healthRun: 'Run report',
  healthRunning: 'Scanning…',
  healthEmptyHint: 'Run the report to see asset health.',
  healthSizeSummary: 'Total',
  healthMedian: 'median',
  healthUnused: 'unused',
  healthNoDupes: 'No duplicates found.',
  healthReclaimable: 'Reclaimable',
  healthSuggestedKeep: 'suggested keep',
  healthNoProjects: 'No projects yet.',
  healthAssets: 'assets',
  healthReferenced: 'referenced',
  healthTimelines: 'timelines',
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
  templateQuickImage: '快速出图',
  templateQuickVideo: '快速出片',
  templateStoryboard: '图文分镜',
  templateCover: '封面图',

  resourceReference: '参考图（定妆照）',
  resourceUseSelected: '用选中素材',
  resourceClear: '清除',

  attachAll: '登记全部未登记',
  skippedCount: '跳过',
  attachAllDone: '已登记',
  importFiles: '导入文件…',
  importDone: '已导入',
  importUnsupported: '这里拿不到文件路径——批量导入需在桌面应用里使用。',

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

  generateRefsLabel: '参考图（按序）',
  generateRefsHint: '首图=底图，其余为风格/脸部参考；最多 6 张，可拖拽 chip 或用箭头排序。',
  generateRefsAdd: '加入选中素材',
  generateRefsFull: '最多 6 张参考图',
  generateRefsMoveUp: '前移',
  generateRefsMoveDown: '后移',
  generateRefsBase: '底图',
  generateRefsStyle: '参考',

  generateElapsed: '生成中 · {sec}s',
  generateProgress: '生成进度',

  videoLastFrame: '尾帧图',
  videoReferenceVideo: '参考视频',
  videoEditHint: '仅视频生成生效：尾帧图按 media[].type=last_frame 提交；参考视频按 reference_video 提交（保留原片构图与动作，按提示词改写内容）。',
  videoRealPerson: '参考视频含真人出镜',
  videoEditPending: '尾帧/参考视频已随请求透传（media 字段），待宿主 media/generate 转发后生效。',

  resourceLibraries: '物料分栏',
  resourceTabOther: '其他',
  resourceFilterPlaceholder: '按名称筛选',

  clipSplit: '在播放头分割',
  clipSplitOutsideHint: '播放头不在这个片段内',

  templateQuickGroup: '快速上手',
  templateFullGroup: '完整链路',
  templateQuickImageHint: '一句话 → 首帧图（2 节点）',
  templateQuickVideoHint: '一句话 → 首帧图 → 5 秒视频（3 节点）',
  templateStoryboardHint: '创意 → 文案 → 分镜 → 首帧图（4 节点）',
  templateCoverHint: '一句话 → 竖版封面图（2 节点）',

  assetSelect: '选择素材',
  assetSelectedCount: '已选 {n}',
  bulkRemove: '批量删除',
  bulkReference: '批量引用',
  bulkClear: '清除选择',
  bulkRemoveDone: '已删除 {n} 个素材',
  bulkRemoveSkipped: '{n} 个跳过',
  bulkForceRemove: '仍要删除选中',
  bulkReferenceDone: '已引用 {n} 张到生成表单',
  bulkReferenceNone: '选中的没有图片素材',

  resourceRefsManage: '管理参考图',
  resourceRefsEditorTitle: '「{name}」的参考图',
  resourceRefsAdd: '挂选中素材',
  resourceRefsRemove: '移除参考图',
  resourceRefsClear: '清空参考图',
  resourceRefsFull: '一个资源最多 6 张参考图',
  resourceRefsCount: '{n} 张参考图',
  resourceRefsDuplicate: '该素材已挂在这个资源上',
  resourceAttachSelected: '把选中素材挂到这个资源',
  resourceRefsNone: '还没有参考图',

  // ---- B-9 融合生图（G3，依赖 A-4 media/compose） ----
  fusionTitle: '融合生图',
  fusionHint: '选角色、场景和物品，用一段提示词拼装成一张画面。依赖宿主端点 media/compose（A-4）。',
  fusionPromptPlaceholder: '描述选中的角色、场景、物品如何组合…',
  fusionRoles: '角色',
  fusionScenes: '场景',
  fusionProps: '物品',
  fusionNoResources: '还没有可选的资源，先去创建。',
  fusionPreview: '将使用 {n} 张参考图',
  fusionPreviewNone: '没有参考图，将降级为纯文生',
  fusionRun: '融合生成',
  fusionRunning: '融合生成中…',
  fusionDone: '已融合生成并登记素材',
  fusionFailed: '融合生成失败',
  fusionNeedsPrompt: '先写一段提示词',
  fusionClear: '清空选择',

  // ---- B-10 提示词工坊（G1，依赖 A-5 prompts/extract） ----
  promptTitle: '提示词工坊',
  promptHint: '从选中的图片提取结构化提示词，可编辑后存入提示词库。依赖宿主端点 prompts/extract（A-5）。',
  promptExtract: '提取提示词',
  promptExtracting: '提取中…',
  promptExtractNeedsAsset: '先选一张图片素材',
  promptExtractDone: '已提取，可在下方编辑',
  promptExtractFailed: '提取失败',
  promptExtractEmpty: '提取结果为空，换一张图试试',
  promptDraftLabel: '提取结果（可编辑）',
  promptNameLabel: '提示词名称',
  promptNamePlaceholder: '例如：柔和电影感人像',
  promptUntitled: '未命名提示词',
  promptSave: '存入提示词库',
  promptSaveDone: '已存入提示词库',
  promptSaveFailed: '存入失败',
  promptNeedsText: '还没有可保存的内容',
  promptLibrary: '提示词库',
  promptLibraryEmpty: '提示词库还是空的',
  promptApply: '带入生成表单',
  promptApplyDone: '已带入提示词框',
  promptRemove: '删除提示词',
  promptSavedCount: '{n} 条提示词',
  composeNeedsPrompt: '融合生图前先写一段描述。',
  composeEmptyHint: '这类资源还没有——去「资源库」新建吧。',
  composeSelected: '已选',
  composeSelectHint: '从上方列里挑几个要融合的资源。',
  composePromptPlaceholder: '描述最终画面：风格、氛围、细节…',
  composeDone: '已融合成',
  composeAssetCreated: '新素材',
  composeBusy: '融合中…',
  composeRun: '融合并生成',
  promptNew: '新建',
  promptRefresh: '刷新',
  promptExtractLabel: '从图片提取',
  promptPickAsset: '选一张图片素材…',
  promptNoImageAssets: '还没有图片素材——先生成一张吧。',
  promptExtractEmpty: '没提取到内容，直接在下方手动编辑。',
  promptNeedSetup: '视觉模型未配置。可以直接手写提示词。',
  promptNamePlaceholder: '给提示词起个名字',
  promptTextPlaceholder: '提示词内容——模型会看到这段文字',
  promptTagsPlaceholder: '标签，逗号分隔',
  promptSave: '保存',
  promptCancel: '取消',
  promptEmpty: '还没有保存的提示词。写一个或从图片提取。',
  promptUse: '带入',
  promptEdit: '编辑',
  healthSize: '体积排行',
  healthDupes: '重复素材',
  healthStats: '项目统计',
  healthRun: '跑体检',
  healthRunning: '扫描中…',
  healthEmptyHint: '点按钮查看素材库体检报告。',
  healthSizeSummary: '总计',
  healthMedian: '中位数',
  healthUnused: '未使用',
  healthNoDupes: '没有重复素材。',
  healthReclaimable: '可回收',
  healthSuggestedKeep: '建议保留',
  healthNoProjects: '还没有项目。',
  healthAssets: '素材',
  healthReferenced: '被引用',
  healthTimelines: '时间轴',
}
