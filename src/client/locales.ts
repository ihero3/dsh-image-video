/** Workbench copy: every string the right-pane surface renders. */

/** Locale keys the workbench renders. */
export type WorkbenchLocaleKey =
  | 'templateQuickImage'
  | 'templateQuickVideo'
  | 'templateStoryboard'
  | 'templateCover'
  | 'templateProductionLine'
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
  | 'generateShortcutHint'
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
  | 'paneHealth'
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
  | 'createStepChat'
  | 'createStepOutputs'
  | 'createStepFile'
  | 'generateParamAuto'
  | 'generateImageModel'
  | 'generateVideoModel'
  | 'generateModelCatalogUnavailable'
  | 'modelLimitFixedDuration'
  | 'modelLimitNoRefVideo'
  | 'generateResultTitle'
  | 'generateResultView'
  | 'generateResultAsReference'
  | 'generateResultDismiss'
  | 'generateFailureHint'
  | 'generateFailureSwitchModel'
  | 'generateFailureShorter'
  | 'generateFailureClearRefs'
  | 'generateFailureDurationApplied'
  | 'generateFailureRefsCleared'
  | 'generateRiskBlocked'
  | 'generateRiskWarn'
  | 'assetSearchPlaceholder'
  | 'assetSortLabel'
  | 'assetSortNewest'
  | 'assetSortOldest'
  | 'assetSortLargest'
  | 'assetSortName'
  | 'assetSearchEmpty'
  | 'previewActions'
  | 'previewAsReference'
  | 'previewAsLastFrame'
  | 'previewAsReferenceVideo'
  | 'previewSentReference'
  | 'previewSentLastFrame'
  | 'previewSentReferenceVideo'
  | 'advancedExpand'
  | 'advancedCollapse'
  | 'railAssets'
  | 'railTasks'
  | 'railHealth'
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
  | 'promptExtractEmpty'
  | 'promptNamePlaceholder'
  | 'promptSave'
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
  | 'regenerate'
  | 'regenerateHint'
  | 'regenerateNoPrompt'
  | 'useAsReference'
  | 'useAsRefHint'
  | 'addToTimeline'
  | 'addToTimelineHint'
  | 'addToTimelineDone'
  | 'noTimelinesHint'
  | 'segPreviewTitle'
  | 'segPreviewEmpty'
  | 'segPlay'
  | 'segPause'
  | 'segReplay'
  | 'segTotal'
  | 'segJump'
  | 'pipelineTitle'
  | 'pipelineHint'
  | 'pipelineScriptLabel'
  | 'pipelineScriptPlaceholder'
  | 'pipelineModeImageToVideo'
  | 'pipelineModeTextToVideo'
  | 'pipelineShots'
  | 'pipelineDuration'
  | 'pipelineStrict'
  | 'pipelineRun'
  | 'pipelineRunning'
  | 'pipelineStarted'
  | 'pipelineCompose'
  | 'pipelineComposed'
  | 'pipelineShotsCount'
  | 'pipelineWarnings'
  | 'pipelineNeedsProject'
  | 'pipelineMissingTitle'
  | 'pipelineMissingHint'
  | 'pipelineMissingNone'
  | 'pipelineRegisterRole'
  | 'pipelineRegisterScene'
  | 'pipelineRegisterProp'
  | 'voiceTitle'
  | 'voiceHint'
  | 'voicePlan'
  | 'voicePlanning'
  | 'voiceLines'
  | 'voiceChars'
  | 'voiceEstimate'
  | 'voiceGenerate'
  | 'voiceNotReady'
  | 'storyboardTitle'
  | 'storyboardHint'
  | 'storyboardScriptLabel'
  | 'storyboardScriptPlaceholder'
  | 'storyboardCountLabel'
  | 'storyboardPlan'
  | 'storyboardPlanning'
  | 'storyboardEmpty'
  | 'storyboardShotsCount'
  | 'storyboardReferenced'
  | 'storyboardNeedsScript'
  | 'storyboardNeedsProject'
  | 'storyboardPlanFailed'
  | 'storyboardPlanDone'
  | 'storyboardAddShot'
  | 'storyboardRemoveShot'
  | 'storyboardMoveUp'
  | 'storyboardMoveDown'
  | 'storyboardShotLabel'
  | 'storyboardCharactersLabel'
  | 'storyboardCharactersEmpty'
  | 'storyboardSceneLabel'
  | 'storyboardImagePromptLabel'
  | 'storyboardVideoPromptLabel'
  | 'storyboardToGenerate'
  | 'storyboardToCanvas'
  | 'storyboardSentGenerate'
  | 'storyboardSentCanvas'
  | 'storyboardToCanvasFailed'
  | 'storyboardEmptyPrompt'
  | 'paneExports'
  | 'exportsHint'
  | 'exportsEmpty'
  | 'exportsFilterAll'
  | 'exportsFilterProject'
  | 'exportsRefresh'
  | 'exportsOutput'
  | 'exportsElapsed'
  | 'exportsError'
  | 'exportsRetry'
  | 'exportsRetryDone'
  | 'exportsRetryFailed'
  | 'exportsTimelineMissing'
  | 'exportsCount'
  | 'exportsOpen'
  | 'exportsFailedNote'
  | 'exportsCancelledNote'
  | 'railExports'
  | 'railHelp'
  | 'helpTitle'
  | 'helpShortcuts'
  | 'helpModes'
  | 'helpModeQuick'
  | 'helpModeWorkflow'
  | 'helpModeTimeline'
  | 'helpClose'
  | 'helpGenerateShortcut'
  | 'helpUndoShortcut'
  | 'helpPlayShortcut'
  | 'helpDeleteShortcut'
  | 'exampleProject'
  | 'exampleProjectDone'
  // ---- B-3 融合生图参数化（姿态 / 镜头 / 风格 / 场景裁剪） ----
  | 'fusionPoseLabel'
  | 'fusionPoseNone'
  | 'poseStanding'
  | 'poseSitting'
  | 'poseWalking'
  | 'poseRunning'
  | 'poseFighting'
  | 'poseCasting'
  | 'poseLookingUp'
  | 'poseBackView'
  | 'fusionLensLabel'
  | 'fusionLensNone'
  | 'lensWide'
  | 'lensMedium'
  | 'lensCloseup'
  | 'lensExtremeCloseup'
  | 'lensHighAngle'
  | 'lensLowAngle'
  | 'lensOverhead'
  | 'fusionStyleNoteLabel'
  | 'fusionStyleNotePlaceholder'
  | 'fusionCropLabel'
  | 'fusionCropEnable'
  | 'fusionCropX'
  | 'fusionCropY'
  | 'fusionCropWidth'
  | 'fusionCropHeight'
  | 'fusionCropHint'
  | 'fusionCropActive'
  | 'fusionCropInvalid'
  // ---- B-4 视频续写显式模式 ----
  | 'videoContinuation'
  | 'videoContinuationHint'
  | 'videoContinuationNeedsRefVideo'
  | 'videoContinuationPending'
  // ---- B-5 成片多比例切片 ----
  | 'ratioSlicesTitle'
  | 'ratioSlicesHint'
  | 'ratioSlicesRun'
  | 'ratioSlicesBusy'
  | 'ratioSlicesNone'
  | 'ratioSlicesDone'
  | 'ratioSlicesFailed'
  | 'ratioSlicesNeedsTimeline'
  | 'ratioPortrait9x16'
  | 'ratioSquare1x1'
  | 'ratioClassic4x3'
  // ---- B-6 模型能力卡 + 提示词风控 ----
  | 'modelCardsTitle'
  | 'modelCardsHint'
  | 'modelCardsEmpty'
  | 'modelCardsLoadFailed'
  | 'modelCardsDrift'
  | 'modelCardKindsImage'
  | 'modelCardKindsVideo'
  | 'modelCardDuration'
  | 'modelCardDurationCustom'
  | 'modelCardDurationFixed'
  | 'modelCardRatios'
  | 'modelCardCostLow'
  | 'modelCardCostMedium'
  | 'modelCardCostHigh'
  | 'modelCardVerified'
  | 'modelCardUnverified'
  | 'modelFeatureOn'
  | 'modelFeatureOff'
  | 'modelCardImageToVideo'
  | 'modelCardFirstLastFrame'
  | 'modelCardMultiFrame'
  | 'modelCardReferenceVideo'
  | 'modelCardAudio'
  | 'modelCardTips'
  | 'promptRiskTitle'
  | 'promptRiskChecking'
  | 'promptRiskOk'
  | 'promptRiskWarn'
  | 'promptRiskBlock'
  | 'promptRiskBlocked'
  | 'promptRiskAdvice'
  | 'promptRiskFailed'
  // ---- B-7 资源分类 + 重绘计划 ----
  | 'resourceFoldersTitle'
  | 'resourceFolderAll'
  | 'resourceFolderUncategorized'
  | 'resourceFolderLabel'
  | 'resourceFolderPlaceholder'
  | 'resourceFolderNone'
  | 'redrawPlanTitle'
  | 'redrawPlanRun'
  | 'redrawPlanBusy'
  | 'redrawPlanPromptLabel'
  | 'redrawPlanRefs'
  | 'redrawPlanSuggestions'
  | 'redrawPlanWarnings'
  | 'redrawPlanNone'
  | 'redrawPlanFailed'
  | 'redrawPlanToForm'
  | 'redrawPlanApplied'
  // ---- B-18 物料手动挑选 + 匹配回显 ----
  | 'pipelineManualPick'
  | 'pipelineManualPickHint'
  | 'pipelineManualPickEmpty'
  | 'pipelineManualPickClear'
  | 'pipelineManualPickCount'
  | 'pipelineMatchedTitle'
  | 'pipelineMatchedNone'
  | 'pipelineMatchedItem'

/** Dictionary namespace owned by this plugin's browser half. */
export const NS = 'image-video-workbench'

/** English copy. */
export const en: Record<WorkbenchLocaleKey, string> = {
  tabTitle: 'dsh-image-video workbench',
  guideDescription: 'Projects, media assets and generation tasks for image and video work.',
  sectionProject: 'Project',
  pipelineTitle: 'One-click film: script → shots → image → video',
  pipelineHint: 'Paste a script; the host splits it into shots and builds a runnable canvas chain for you.',
  pipelineScriptLabel: 'Script',
  pipelineScriptPlaceholder: 'Rainy street at night. Lin Xia walks over with an umbrella. She looks up at the neon sign.',
  pipelineModeImageToVideo: 'Image → video',
  pipelineModeTextToVideo: 'Text → video',
  pipelineShots: 'Shots',
  pipelineDuration: 'Seconds per shot',
  pipelineStrict: 'Strict (registered roles/scenes required)',
  pipelineRun: 'Run pipeline',
  pipelineRunning: 'Running…',
  pipelineStarted: 'Pipeline started',
  pipelineCompose: 'Compose only (free)',
  pipelineComposed: 'Pipeline saved (not started)',
  pipelineShotsCount: 'shots',
  pipelineWarnings: 'Note',
  pipelineNeedsProject: 'Create or pick a project first',
  pipelineMissingTitle: 'Missing materials',
  pipelineMissingHint: 'Names the script mentions but the resource library does not have yet. Strict mode refuses to run; register one and matching re-runs automatically.',
  pipelineMissingNone: 'No missing materials detected',
  pipelineRegisterRole: 'As role',
  pipelineRegisterScene: 'As scene',
  pipelineRegisterProp: 'As prop',
  voiceTitle: 'Dub (voice-over)',
  voiceHint: 'Turn the subtitle track into a dub plan: lines, characters and estimated duration. Synthesis turns on once the TTS API is live.',
  voicePlan: 'Build dub plan',
  voicePlanning: 'Planning…',
  voiceLines: 'lines',
  voiceChars: 'chars',
  voiceEstimate: 'estimated',
  voiceGenerate: 'Synthesize',
  voiceNotReady: 'Not available yet',
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
  templateProductionLine: 'Production line',

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
  generateShortcutHint: '⌘/Ctrl + Enter to generate',
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
  paneHealth: 'Library health',
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
  createStepChat: 'Generate in chat',
  createStepOutputs: 'Lands in outputs',
  createStepFile: 'File into project',
  generateParamAuto: 'Auto (use current defaults)',
  generateImageModel: 'Image model',
  generateVideoModel: 'Video model',
  generateModelCatalogUnavailable: 'Model catalog unavailable — falling back to the host default',
  modelLimitFixedDuration: 'fixed duration only',
  modelLimitNoRefVideo: 'no reference video / continuation',
  generateResultTitle: 'This result',
  generateResultView: 'View',
  generateResultAsReference: 'Use as reference',
  generateResultDismiss: 'Dismiss result',
  generateFailureHint: 'Try:',
  generateFailureSwitchModel: 'Switch model',
  generateFailureShorter: 'Shorter duration',
  generateFailureClearRefs: 'Clear references',
  generateFailureDurationApplied: 'Duration shortened — try again',
  generateFailureRefsCleared: 'References cleared — try again',
  generateRiskBlocked: 'This prompt fails compliance checks — generation is disabled',
  generateRiskWarn: 'Prompt flagged as risky — the provider may reject it',
  assetSearchPlaceholder: 'Search name / prompt / model',
  assetSortLabel: 'Sort',
  assetSortNewest: 'Newest first',
  assetSortOldest: 'Oldest first',
  assetSortLargest: 'Largest first',
  assetSortName: 'By name',
  assetSearchEmpty: 'No matching assets (try clearing the search)',
  previewActions: 'Send to composer',
  previewAsReference: 'Use as reference',
  previewAsLastFrame: 'Use as last frame',
  previewAsReferenceVideo: 'Use as reference video',
  previewSentReference: 'Added to reference images',
  previewSentLastFrame: 'Set as last frame',
  previewSentReferenceVideo: 'Set as reference video',
  advancedExpand: 'More tools: fusion · prompt studio · storyboard · model cards',
  advancedCollapse: 'Collapse',
  railAssets: 'Media assets',
  railTasks: 'Tasks',
  railHealth: 'Library health',
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
  regenerate: 'Regenerate',
  regenerateHint: 'Run this prompt again with the same model.',
  regenerateNoPrompt: 'This task has no prompt to regenerate from.',
  useAsReference: 'Use as reference',
  useAsRefHint: 'Put this output into the quick-generate reference slots.',
  addToTimeline: 'Add to timeline',
  addToTimelineHint: 'Append this clip to the current project timeline.',
  addToTimelineDone: 'Appended to the timeline.',
  noTimelinesHint: 'No timeline in this project yet.',
  segPreviewTitle: 'Segment preview',
  segPreviewEmpty: 'No video clips on the timeline yet.',
  segPlay: 'Play',
  segPause: 'Pause',
  segReplay: 'Replay',
  segTotal: 'total',
  segJump: 'Jump to segment',
  storyboardTitle: 'Storyboard workshop',
  storyboardHint: 'Paste a script, break it into shots, then edit every shot before it goes to generation or the canvas.',
  storyboardScriptLabel: 'Script',
  storyboardScriptPlaceholder: 'Paste or write the script here — one shot per sentence group…',
  storyboardCountLabel: 'Target shots',
  storyboardPlan: 'Break into shots',
  storyboardPlanning: 'Breaking…',
  storyboardEmpty: 'No shots yet — paste a script above and break it into shots.',
  storyboardShotsCount: '{n} shots',
  storyboardReferenced: '{n} resources referenced',
  storyboardNeedsScript: 'The script is empty — at least one sentence is needed.',
  storyboardNeedsProject: 'Create or pick a project first.',
  storyboardPlanFailed: 'Storyboard planning failed',
  storyboardPlanDone: 'Planned {n} shots.',
  storyboardAddShot: 'Add shot',
  storyboardRemoveShot: 'Remove shot',
  storyboardMoveUp: 'Move up',
  storyboardMoveDown: 'Move down',
  storyboardShotLabel: 'Shot',
  storyboardCharactersLabel: 'Characters',
  storyboardCharactersEmpty: 'none detected',
  storyboardSceneLabel: 'Scene',
  storyboardImagePromptLabel: 'Image prompt',
  storyboardVideoPromptLabel: 'Video prompt',
  storyboardToGenerate: 'To generate form',
  storyboardToCanvas: 'To canvas',
  storyboardSentGenerate: 'Shot {n} image prompt sent to the generate form.',
  storyboardSentCanvas: 'Shot {n} image prompt sent to the canvas image node.',
  storyboardToCanvasFailed: 'Could not send to canvas',
  storyboardEmptyPrompt: 'This shot has no image prompt yet — write one first.',
  paneExports: 'Export history',
  exportsHint: 'Every export attempt, newest first. Failed ones keep their reason and can be retried.',
  exportsEmpty: 'No exports yet — render a timeline and it will show up here.',
  exportsFilterAll: 'All projects',
  exportsFilterProject: 'Filter by project',
  exportsRefresh: 'Refresh',
  exportsOutput: 'Output',
  exportsElapsed: 'Elapsed',
  exportsError: 'Failure',
  exportsRetry: 'Retry export',
  exportsRetryDone: 'Retry started for {name}.',
  exportsRetryFailed: 'Retry failed',
  exportsTimelineMissing: 'timeline no longer exists',
  exportsCount: '{n} records',
  exportsOpen: 'Open output',
  exportsFailedNote: 'Export failed',
  exportsCancelledNote: 'Export cancelled',
  railExports: 'Export history',
  railHelp: 'Help',
  helpTitle: 'Help',
  helpShortcuts: 'Shortcuts',
  helpModes: 'Modes',
  helpModeQuick: 'Quick create — generate images or videos right here, with reference images.',
  helpModeWorkflow: 'Workflow — chain script → storyboard → image → video → render on the canvas.',
  helpModeTimeline: 'Timeline — assemble clips, subtitles and audio, then export the film.',
  helpClose: 'Close',
  helpGenerateShortcut: 'Ctrl/⌘ + Enter — start generation',
  helpUndoShortcut: 'Ctrl/⌘ + Z / Shift+Z — undo / redo',
  helpPlayShortcut: 'Space — play or pause the timeline',
  helpDeleteShortcut: 'Delete — remove the selected clip or node',
  // ---- B-3 融合生图参数化（姿态 / 镜头 / 风格 / 场景裁剪） ----
  fusionPoseLabel: 'Pose',
  fusionPoseNone: 'No pose (free)',
  poseStanding: 'Standing',
  poseSitting: 'Sitting',
  poseWalking: 'Walking',
  poseRunning: 'Running',
  poseFighting: 'Fighting',
  poseCasting: 'Casting',
  poseLookingUp: 'Looking up',
  poseBackView: 'Back view',
  fusionLensLabel: 'Camera',
  fusionLensNone: 'No camera (free)',
  lensWide: 'Wide shot',
  lensMedium: 'Medium shot',
  lensCloseup: 'Close-up',
  lensExtremeCloseup: 'Extreme close-up',
  lensHighAngle: 'High angle',
  lensLowAngle: 'Low angle',
  lensOverhead: 'Overhead',
  fusionStyleNoteLabel: 'Style note',
  fusionStyleNotePlaceholder: 'e.g. cinematic lighting, soft palette…',
  fusionCropLabel: 'Crop scene',
  fusionCropEnable: 'Crop the selected scene image first',
  fusionCropX: 'X',
  fusionCropY: 'Y',
  fusionCropWidth: 'Width',
  fusionCropHeight: 'Height',
  fusionCropHint: 'Normalized 0–1 coordinates; the cropped scene replaces the original before the model sees it.',
  fusionCropActive: 'Cropping',
  fusionCropInvalid: 'Invalid crop: keep within 0–1 and at least 5% on each side.',

  // ---- B-4 视频续写显式模式 ----
  videoContinuation: 'Continuation (extend)',
  videoContinuationHint: 'Keep shooting right after the reference video. A reference video is required; missing it is rejected, not silently downgraded.',
  videoContinuationNeedsRefVideo: 'Continuation needs a reference video — pick one first.',
  videoContinuationPending: 'Extending…',

  // ---- B-5 成片多比例切片 ----
  ratioSlicesTitle: 'Multi-ratio export',
  ratioSlicesHint: 'Export one film in several aspect ratios. Each ratio is encoded once — nothing is regenerated.',
  ratioSlicesRun: 'Export all ratios',
  ratioSlicesBusy: 'Exporting…',
  ratioSlicesNone: 'Pick at least one ratio.',
  ratioSlicesDone: 'Queued {n} ratio exports.',
  ratioSlicesFailed: 'Some ratio exports failed — see warnings.',
  ratioSlicesNeedsTimeline: 'Open a timeline first.',
  ratioPortrait9x16: 'Portrait 9:16',
  ratioSquare1x1: 'Square 1:1',
  ratioClassic4x3: 'Classic 4:3',

  // ---- B-6 模型能力卡 + 提示词风控 ----
  modelCardsTitle: 'Model capability cards',
  modelCardsHint: 'Pick a model by strength and supported features. A drift warning means the card no longer matches runtime.',
  modelCardsEmpty: 'No model cards available.',
  modelCardsLoadFailed: 'Failed to load model cards.',
  modelCardsDrift: 'Card drifted from runtime capabilities — verify before relying on it.',
  modelCardKindsImage: 'Image',
  modelCardKindsVideo: 'Video',
  modelCardDuration: 'Duration',
  modelCardDurationCustom: 'Custom',
  modelCardDurationFixed: 'Fixed',
  modelCardRatios: 'Aspect ratios',
  modelCardCostLow: 'Low cost',
  modelCardCostMedium: 'Medium cost',
  modelCardCostHigh: 'High cost',
  modelCardVerified: 'Verified',
  modelCardUnverified: 'Unverified',
  modelFeatureOn: 'Supported',
  modelFeatureOff: 'Not supported',
  modelCardImageToVideo: 'Image → video',
  modelCardFirstLastFrame: 'First/last frame',
  modelCardMultiFrame: 'Multi-frame',
  modelCardReferenceVideo: 'Reference video',
  modelCardAudio: 'Audio',
  modelCardTips: 'Prompt tips',
  promptRiskTitle: 'Prompt safety check',
  promptRiskChecking: 'Checking…',
  promptRiskOk: 'Looks safe',
  promptRiskWarn: 'Caution',
  promptRiskBlock: 'Blocked',
  promptRiskBlocked: 'This prompt is blocked — it will not be submitted.',
  promptRiskAdvice: 'Advice',
  promptRiskFailed: 'Safety check failed; submit at your own risk.',

  // ---- B-7 资源分类 + 重绘计划 ----
  resourceFoldersTitle: 'Folders',
  resourceFolderAll: 'All',
  resourceFolderUncategorized: 'Uncategorized',
  resourceFolderLabel: 'Folder',
  resourceFolderPlaceholder: 'Set a folder for this resource',
  resourceFolderNone: 'No folder',
  redrawPlanTitle: 'Redraw plan',
  redrawPlanRun: 'Plan redraw',
  redrawPlanBusy: 'Planning…',
  redrawPlanPromptLabel: 'Suggested prompt',
  redrawPlanRefs: 'Reference images',
  redrawPlanSuggestions: 'Suggestions',
  redrawPlanWarnings: 'Warnings',
  redrawPlanNone: 'No plan yet.',
  redrawPlanFailed: 'Failed to plan redraw.',
  redrawPlanToForm: 'Send to compose',
  redrawPlanApplied: 'Applied to compose form.',

  // ---- B-18 物料手动挑选 + 匹配回显 ----
  pipelineManualPick: 'Pick materials manually',
  pipelineManualPickHint: 'Force specific resources into the pipeline. Leave empty to let the script auto-match.',
  pipelineManualPickEmpty: 'No materials picked.',
  pipelineManualPickClear: 'Clear',
  pipelineManualPickCount: '{n} picked',
  pipelineMatchedTitle: 'Matched materials',
  pipelineMatchedNone: 'No materials matched.',
  pipelineMatchedItem: '{name} · {kind}',
  exampleProject: 'Example project',
  exampleProjectDone: 'Example project created — try the Quick image template on the canvas.',
}

/** Simplified Chinese copy. */
export const zh: Record<WorkbenchLocaleKey, string> = {
  // ---- B-3 融合生图参数化（姿态 / 镜头 / 风格 / 场景裁剪） ----
  fusionPoseLabel: '姿态',
  fusionPoseNone: '不指定（自由）',
  poseStanding: '站立',
  poseSitting: '坐姿',
  poseWalking: '行走',
  poseRunning: '奔跑',
  poseFighting: '打斗',
  poseCasting: '施法',
  poseLookingUp: '抬头',
  poseBackView: '背影',
  fusionLensLabel: '镜头',
  fusionLensNone: '不指定（自由）',
  lensWide: '全景',
  lensMedium: '中景',
  lensCloseup: '近景',
  lensExtremeCloseup: '特写',
  lensHighAngle: '俯拍',
  lensLowAngle: '仰拍',
  lensOverhead: '顶拍',
  fusionStyleNoteLabel: '风格备注',
  fusionStyleNotePlaceholder: '例如：电影感光影、柔和色调…',
  fusionCropLabel: '场景裁剪',
  fusionCropEnable: '先裁剪选中的场景图再送模型',
  fusionCropX: 'X',
  fusionCropY: 'Y',
  fusionCropWidth: '宽',
  fusionCropHeight: '高',
  fusionCropHint: '归一化 0–1 坐标；裁剪后的场景图会替换原图送模型。',
  fusionCropActive: '裁剪中',
  fusionCropInvalid: '裁剪无效：必须在 0–1 内，且每边至少保留 5%。',

  // ---- B-4 视频续写显式模式 ----
  videoContinuation: '续写（延续视频）',
  videoContinuationHint: '紧接参考视频往后拍。必须有参考视频，缺参考视频直接拒绝，不静默降级。',
  videoContinuationNeedsRefVideo: '续写需要参考视频——先选一条。',
  videoContinuationPending: '续写中…',

  // ---- B-5 成片多比例切片 ----
  ratioSlicesTitle: '多比例导出',
  ratioSlicesHint: '一条成片按多种画幅各导出一次。各比例只编码一次——不重新生成。',
  ratioSlicesRun: '导出全部比例',
  ratioSlicesBusy: '导出中…',
  ratioSlicesNone: '至少选一个比例。',
  ratioSlicesDone: '已排队 {n} 个比例导出。',
  ratioSlicesFailed: '部分比例导出失败——看警告。',
  ratioSlicesNeedsTimeline: '先打开一条时间轴。',
  ratioPortrait9x16: '竖屏 9:16',
  ratioSquare1x1: '方形 1:1',
  ratioClassic4x3: '经典 4:3',

  // ---- B-6 模型能力卡 + 提示词风控 ----
  modelCardsTitle: '模型能力卡',
  modelCardsHint: '按优势与能力矩阵选模型。出现漂移提示说明卡片与运行时能力不一致，使用前请核对。',
  modelCardsEmpty: '暂无可用的模型卡。',
  modelCardsLoadFailed: '模型卡加载失败。',
  modelCardsDrift: '卡片与运行时能力漂移——依赖前请先核对。',
  modelCardKindsImage: '图',
  modelCardKindsVideo: '视频',
  modelCardDuration: '时长',
  modelCardDurationCustom: '可自定义',
  modelCardDurationFixed: '固定',
  modelCardRatios: '支持画幅',
  modelCardCostLow: '低成本',
  modelCardCostMedium: '中成本',
  modelCardCostHigh: '高成本',
  modelCardVerified: '已校验',
  modelCardUnverified: '未校验',
  modelFeatureOn: '支持',
  modelFeatureOff: '不支持',
  modelCardImageToVideo: '图生视频',
  modelCardFirstLastFrame: '首尾帧',
  modelCardMultiFrame: '多帧',
  modelCardReferenceVideo: '参考视频',
  modelCardAudio: '音频',
  modelCardTips: '提示词技巧',
  promptRiskTitle: '提示词风控',
  promptRiskChecking: '检测中…',
  promptRiskOk: '看起来安全',
  promptRiskWarn: '需注意',
  promptRiskBlock: '已拦截',
  promptRiskBlocked: '该提示词被拦截——不会提交。',
  promptRiskAdvice: '建议',
  promptRiskFailed: '风控检测失败；自行承担风险提交。',

  // ---- B-7 资源分类 + 重绘计划 ----
  resourceFoldersTitle: '分类',
  resourceFolderAll: '全部',
  resourceFolderUncategorized: '未分类',
  resourceFolderLabel: '分类',
  resourceFolderPlaceholder: '给资源设置分类',
  resourceFolderNone: '无分类',
  redrawPlanTitle: '重绘计划',
  redrawPlanRun: '生成重绘计划',
  redrawPlanBusy: '生成中…',
  redrawPlanPromptLabel: '建议提示词',
  redrawPlanRefs: '参考图',
  redrawPlanSuggestions: '建议',
  redrawPlanWarnings: '提醒',
  redrawPlanNone: '还没有计划。',
  redrawPlanFailed: '重绘计划生成失败。',
  redrawPlanToForm: '填入融合表单',
  redrawPlanApplied: '已填入融合表单。',

  // ---- B-18 物料手动挑选 + 匹配回显 ----
  pipelineManualPick: '手动挑选物料',
  pipelineManualPickHint: '强制把指定资源塞进流水线。留空则让剧本自动匹配。',
  pipelineManualPickEmpty: '还没挑任何物料。',
  pipelineManualPickClear: '清空',
  pipelineManualPickCount: '已挑 {n} 个',
  pipelineMatchedTitle: '匹配到的物料',
  pipelineMatchedNone: '没有匹配到物料。',
  pipelineMatchedItem: '{name} · {kind}',

  tabTitle: 'dsh-image-video 工作台',
  guideDescription: '图片与视频创作的项目、媒体素材与生成任务。',
  sectionProject: '项目',
  pipelineTitle: '一键成片：剧本 → 分镜 → 生图 → 生视频',
  pipelineHint: '粘贴剧本，宿主自动拆成分镜并生成一条可直接跑的画布流水线。',
  pipelineScriptLabel: '剧本',
  pipelineScriptPlaceholder: '雨夜街头，林夏撑伞走来。她抬眼看向霓虹招牌。',
  pipelineModeImageToVideo: '图生视频',
  pipelineModeTextToVideo: '文生视频',
  pipelineShots: '分镜数',
  pipelineDuration: '每镜秒数',
  pipelineStrict: '严格模式（要求已登记角色/场景）',
  pipelineRun: '一键生成',
  pipelineRunning: '执行中…',
  pipelineStarted: '已起跑',
  pipelineCompose: '仅编排（零花费）',
  pipelineComposed: '流水线已保存（未起跑）',
  pipelineShotsCount: '个分镜',
  pipelineWarnings: '提醒',
  pipelineNeedsProject: '先创建或选择一个项目',
  pipelineMissingTitle: '物料缺失',
  pipelineMissingHint: '剧本提到、资源库还没有的角色/场景/物品。严格模式会拒绝执行；登记后会自动重新匹配。',
  pipelineMissingNone: '未检测到缺失物料',
  pipelineRegisterRole: '登记为角色',
  pipelineRegisterScene: '登记为场景',
  pipelineRegisterProp: '登记为物品',
  voiceTitle: '配音（旁白）',
  voiceHint: '把字幕轨变成配音计划：台词、字数、估算时长一目了然。TTS 接口联调通过后即可一键生成。',
  voicePlan: '生成配音计划',
  voicePlanning: '计算中…',
  voiceLines: '句',
  voiceChars: '字',
  voiceEstimate: '预计',
  voiceGenerate: '生成配音',
  voiceNotReady: '暂不可用',
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
  templateProductionLine: '生产线',

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
  generateShortcutHint: '⌘/Ctrl + Enter 生成',
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
  paneHealth: '素材库体检',
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
  createStepChat: '对话区生成',
  createStepOutputs: '落入输出目录',
  createStepFile: '登记进项目',
  generateParamAuto: '自动（跟随当前生效值）',
  generateImageModel: '图像模型',
  generateVideoModel: '视频模型',
  generateModelCatalogUnavailable: '模型目录不可用，已回退到宿主默认模型',
  modelLimitFixedDuration: '不支持自定义时长',
  modelLimitNoRefVideo: '不支持参考视频/续写',
  generateResultTitle: '本次结果',
  generateResultView: '查看',
  generateResultAsReference: '设为参考',
  generateResultDismiss: '关闭结果',
  generateFailureHint: '可以试试：',
  generateFailureSwitchModel: '换模型',
  generateFailureShorter: '缩短时长',
  generateFailureClearRefs: '清空参考',
  generateFailureDurationApplied: '已把时长改成较短的档位，再试一次',
  generateFailureRefsCleared: '已清空参考图/参考视频，再试一次',
  generateRiskBlocked: '这段提示词过不了合规校验，生成已停用',
  generateRiskWarn: '提示词有风险，可能被上游拒绝',
  assetSearchPlaceholder: '搜索文件名 / 提示词 / 模型',
  assetSortLabel: '排序',
  assetSortNewest: '最新优先',
  assetSortOldest: '最早优先',
  assetSortLargest: '体积最大',
  assetSortName: '按名称',
  assetSearchEmpty: '没有匹配的素材（试试清空搜索）',
  previewActions: '送到生成位',
  previewAsReference: '设为参考',
  previewAsLastFrame: '设为尾帧',
  previewAsReferenceVideo: '设为参考视频',
  previewSentReference: '已加入参考图',
  previewSentLastFrame: '已设为尾帧',
  previewSentReferenceVideo: '已设为参考视频',
  advancedExpand: '展开高级（融合生图 / 提示词工坊 / 剧本分镜 / 模型能力卡）',
  advancedCollapse: '收起高级',
  railAssets: '媒体素材',
  railTasks: '生成任务',
  railHealth: '素材库体检',
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
  regenerate: '重新生成',
  regenerateHint: '用相同模型再跑一次这条提示词。',
  regenerateNoPrompt: '这条任务没有可复用的提示词。',
  useAsReference: '用作参考图',
  useAsRefHint: '把这条产物放进快速生成的参考图槽位。',
  addToTimeline: '加入时间轴',
  addToTimelineHint: '把这段视频追加到当前项目的时间轴。',
  addToTimelineDone: '已追加到时间轴。',
  noTimelinesHint: '当前项目还没有时间轴。',
  segPreviewTitle: '逐段预览',
  segPreviewEmpty: '时间轴上还没有视频片段。',
  segPlay: '播放',
  segPause: '暂停',
  segReplay: '重播',
  segTotal: '总长',
  segJump: '跳到第',
  storyboardTitle: '分镜工坊',
  storyboardHint: '贴上剧本，一键拆成镜头表；每个镜头都能改，改完再送进生成表单或画布。',
  storyboardScriptLabel: '剧本',
  storyboardScriptPlaceholder: '把剧本粘贴或输入到这里——按句组拆成镜头…',
  storyboardCountLabel: '目标镜头数',
  storyboardPlan: '拆解分镜',
  storyboardPlanning: '拆解中…',
  storyboardEmpty: '还没有镜头——在上方贴上剧本并点「拆解分镜」。',
  storyboardShotsCount: '{n} 个镜头',
  storyboardReferenced: '引用 {n} 个创作资源',
  storyboardNeedsScript: '剧本是空的——至少需要一句话。',
  storyboardNeedsProject: '先创建或选择一个项目。',
  storyboardPlanFailed: '分镜拆解失败',
  storyboardPlanDone: '已拆出 {n} 个镜头。',
  storyboardAddShot: '添加镜头',
  storyboardRemoveShot: '删除镜头',
  storyboardMoveUp: '上移',
  storyboardMoveDown: '下移',
  storyboardShotLabel: '镜头描述',
  storyboardCharactersLabel: '角色',
  storyboardCharactersEmpty: '未识别到角色',
  storyboardSceneLabel: '场景',
  storyboardImagePromptLabel: '图片提示词',
  storyboardVideoPromptLabel: '视频提示词',
  storyboardToGenerate: '带入生成',
  storyboardToCanvas: '送入画布',
  storyboardSentGenerate: '第 {n} 镜的图片提示词已带入生成表单。',
  storyboardSentCanvas: '第 {n} 镜的图片提示词已送入画布图片节点。',
  storyboardToCanvasFailed: '送入画布失败',
  storyboardEmptyPrompt: '这一镜还没有图片提示词——先写一个。',
  paneExports: '导出历史',
  exportsHint: '每一次导出尝试都在这里，新的在前；失败的保留原因，可直接重试。',
  exportsEmpty: '还没有导出记录——渲染一条时间轴后就会出现在这里。',
  exportsFilterAll: '全部项目',
  exportsFilterProject: '按项目筛选',
  exportsRefresh: '刷新',
  exportsOutput: '产物',
  exportsElapsed: '耗时',
  exportsError: '失败原因',
  exportsRetry: '重试导出',
  exportsRetryDone: '已为 {name} 重新开始导出。',
  exportsRetryFailed: '重试失败',
  exportsTimelineMissing: '对应时间轴已不存在',
  exportsCount: '{n} 条记录',
  exportsOpen: '打开产物',
  exportsFailedNote: '导出失败',
  exportsCancelledNote: '导出已取消',
  railExports: '导出历史',
  railHelp: '帮助',
  helpTitle: '帮助',
  helpShortcuts: '快捷键',
  helpModes: '模式说明',
  helpModeQuick: '快速创作——就在这里生成图片或视频，可带多张参考图。',
  helpModeWorkflow: '工作流——在画布上串起 剧本→分镜→生图→视频→导出。',
  helpModeTimeline: '时间轴——组装片段、字幕与音轨，然后导出成片。',
  helpClose: '关闭',
  helpGenerateShortcut: 'Ctrl/⌘ + Enter——开始生成',
  helpUndoShortcut: 'Ctrl/⌘ + Z / Shift+Z——撤销 / 重做',
  helpPlayShortcut: '空格——播放 / 暂停时间轴',
  helpDeleteShortcut: 'Delete——删除选中的片段或节点',
  exampleProject: '示例项目',
  exampleProjectDone: '示例项目已建好——去画布试试「快速图片」模板。',
}
