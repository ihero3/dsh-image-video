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
  | 'skippedCount'
  | 'importFiles'
  | 'importDone'
  | 'importUnsupported'
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
  | 'tabTitle'
  | 'guideDescription'
  | 'sectionProject'
  | 'projectNone'
  | 'saveSaved'
  | 'saveSaving'
  | 'saveDirty'
  | 'saveFailed'
  | 'modeQuick'
  | 'modulePipeline'
  | 'modulePipelineDesc'
  | 'moduleScript'
  | 'moduleScriptDesc'
  | 'scriptTextModel'
  | 'scriptTextModelEmpty'
  | 'scriptImageModel'
  | 'scriptVideoModel'
  | 'scriptDirectorSkill'
  | 'scriptFollowDefault'
  | 'scriptSplit'
  | 'scriptSplitting'
  | 'scriptSplitHint'
  | 'scriptSplitNeedsModel'
  | 'scriptSplitNeedsScript'
  | 'scriptSplitDone'
  | 'scriptSplitFailed'
  | 'scriptModelsFailed'
  | 'loginThreeView'
  | 'moduleQuick'
  | 'moduleQuickDesc'
  | 'moduleCollapse'
  | 'moduleExpand'
  | 'modeWorkflow'
  | 'modeTimeline'
  | 'paneAssets'
  | 'paneResources'
  | 'paneResourcesNamed'
  | 'panePreview'
  | 'paneTasks'
  | 'paneHealth'
  | 'healthChecking'
  | 'healthFailed'
  | 'panePlanned'
  | 'newProject'
  | 'projectNamePlaceholder'
  | 'create'
  | 'remove'
  | 'confirmRemove'
  | 'refresh'
  | 'refreshAssetsDone'
  | 'noOutputs'
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
  | 'defaultsSourceOverride'
  | 'defaultsSourceSettings'
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
  | 'kindCostume'
  | 'kindScene'
  | 'kindProp'
  | 'kindBrand'
  | 'kindStyle'
  | 'kindVoice'
  | 'sectionEpisode'
  | 'episodeNone'
  | 'episodeNew'
  | 'episodeRename'
  | 'episodeRemove'
  | 'episodeResourcesSelected'
  | 'episodeResourcesAll'
  | 'episodeRefsHint'
  | 'episodeRefsEmpty'
  | 'episodeRefsBrowse'
  | 'episodeRefMissing'
  | 'episodeRefCategory'
  | 'episodeCategoryUngrouped'
  | 'episodeAddResource'
  | 'episodeAddAsset'
  | 'episodeAssetTag'
  | 'episodeWorkspaceTitle'
  | 'episodeScriptSaved'
  | 'episodeScriptDirty'
  | 'episodeScriptSaving'
  | 'episodeScriptFailed'
  | 'episodeTotalDuration'
  | 'segmentTitle'
  | 'segmentAdd'
  | 'segmentEmpty'
  | 'segmentName'
  | 'segmentPromptLabel'
  | 'segmentPromptPlaceholder'
  | 'segmentDurationLabel'
  | 'segmentSkillLabel'
  | 'segmentSkillDefault'
  | 'segmentSkillHint'
  | 'segmentSkillMissing'
  | 'skillsPaneTitle'
  | 'skillsPaneDesc'
  | 'skillKindDirector'
  | 'skillKindReverse'
  | 'skillKindDirectorDesc'
  | 'skillKindReverseDesc'
  | 'skillImportLabel'
  | 'skillImportPlaceholder'
  | 'skillImportAction'
  | 'skillImportDone'
  | 'skillImportFailed'
  | 'skillBuiltin'
  | 'skillDisabled'
  | 'skillToggleOn'
  | 'skillToggleOff'
  | 'skillRemove'
  | 'skillReveal'
  | 'skillEmpty'
  | 'skillLoadFailed'
  | 'skillRemoveConfirm'
  | 'skillRemoved'
  | 'skillCreateToggle'
  | 'skillNameLabel'
  | 'skillNamePlaceholder'
  | 'skillDescriptionLabel'
  | 'skillDescriptionPlaceholder'
  | 'skillPromptLabel'
  | 'skillPromptPlaceholder'
  | 'skillSaveAction'
  | 'skillSaved'
  | 'skillBuiltinReadonly'
  | 'skillsHint'
  | 'skillsRefresh'
  | 'quickTabProduce'
  | 'quickTabPrompt'
  | 'studioTitle'
  | 'studioDesc'
  | 'studioSkillLabel'
  | 'studioSkillDefault'
  | 'studioSources'
  | 'studioSourcesHint'
  | 'studioSourcesEmpty'
  | 'studioSourceLimit'
  | 'studioExtractAction'
  | 'studioExtracting'
  | 'studioExtracted'
  | 'studioExtractFailed'
  | 'studioClearSources'
  | 'studioNameLabel'
  | 'studioNamePlaceholder'
  | 'studioDraftNameSuffix'
  | 'studioDraftLabel'
  | 'studioDraftPlaceholder'
  | 'studioSaveAction'
  | 'studioSaved'
  | 'studioSaveFailed'
  | 'studioApply'
  | 'studioPromptLibrary'
  | 'studioPromptEmpty'
  | 'studioRemovePrompt'
  | 'studioStoryboard'
  | 'studioStoryboardEmpty'
  | 'studioShotApply'
  | 'studioNoEpisode'
  | 'studioLoadFailed'
  | 'shotRefAdd'
  | 'segmentRefsLabel'
  | 'episodeSyncWorkflow'
  | 'episodeSyncWorkflowDone'
  | 'episodeSyncWorkflowFailed'
  | 'episodeExport'
  | 'episodeExportDone'
  | 'episodeExportFailed'
  | 'segmentRefsEmpty'
  | 'segmentAddRef'
  | 'segmentRefResources'
  | 'segmentRefAssets'
  | 'segmentRemove'
  | 'segmentSaveFailed'
  | 'segmentAddFailed'
  | 'segmentRemoveFailed'
  | 'segmentStoryboardPlan'
  | 'segmentStoryboardNone'
  | 'storyboardSave'
  | 'shotName'
  | 'shotGenerateImage'
  | 'shotGenerateVideo'
  | 'shotGenerating'
  | 'shotImageDone'
  | 'shotVideoQueued'
  | 'shotGenerateFailed'
  | 'refInsertToken'
  | 'moveUp'
  | 'moveDown'
  | 'brandName'
  | 'brandTagline'
  | 'dockTitle'
  | 'statResources'
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
  | 'assetSearchPlaceholder'
  | 'storageUsageLabel'
  | 'storageUsageFiles'
  | 'storageUsageLoading'
  | 'storageRevealFolder'
  | 'storageRevealFailed'
  | 'assetSortLabel'
  | 'assetSortNewest'
  | 'assetSortOldest'
  | 'assetSortLargest'
  | 'assetSortName'
  | 'assetSearchEmpty'
  | 'previewAsReference'
  | 'previewAsLastFrame'
  | 'previewAsReferenceVideo'
  | 'previewSentReference'
  | 'previewSentLastFrame'
  | 'previewSentReferenceVideo'
  | 'storyboardToPipeline'
  | 'storyboardToPipelineHint'
  | 'storyboardSentToPipeline'
  | 'storyboardNeedsShotsForPipeline'
  | 'taskErrorShow'
  | 'taskErrorHide'
  | 'taskErrorHint'
  | 'railAssets'
  | 'railSkills'
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
  | 'generateRefsPreviewHint'
  | 'pipelineModeVideoToVideo'
  | 'pipelineToCanvas'
  | 'pipelineToCanvasHint'
  | 'pipelineInlineRun'
  | 'pipelineInlineRunHint'
  | 'pipelineInlineVideoFailed'
  | 'pipelineInlineVideoCancelled'
  | 'pipelineInlineVideoTimeout'
  | 'pipelineInlineVideoNoOutput'
  | 'pipelineShotDuration'
  | 'pipelineVideoToVideoNeedsRef'
  | 'pipelineShotEditable'
  | 'modelDetails'
  | 'fusionEntry'
  | 'fusionEntryHint'
  | 'defaultsBuiltinSource'
  | 'defaultsFollow'
  | 'defaultSeriesName'
  | 'videoSlotsTitle'
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
  | 'resourceDetails'
  | 'resourceHideDetails'
  | 'resourceCreateHint'
  | 'resourceFoldersAdvanced'
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
  | 'resourceFilterEmpty'
  | 'resourceUseSelectedHint'
  | 'resourceEdit'
  | 'resourceEditSave'
  | 'resourceNoteHint'
  | 'resourceRefPreview'
  | 'resourceFirstRefHint'
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
  // ---- 提示词带入（提示词·分镜页与分镜镜头共用） ----
  | 'promptApplyDone'
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
  | 'pipelineScriptLabel'
  | 'pipelineScriptPlaceholder'
  | 'pipelineModeImageToVideo'
  | 'pipelineModeTextToVideo'
  | 'pipelineShots'
  | 'pipelineDuration'
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
  | 'exportsNeedTimeline'
  | 'exportsFilterProject'
  | 'exportsRefresh'
  | 'exportsOutput'
  | 'exportsElapsed'
  | 'exportsError'
  | 'exportsRetry'
  | 'exportsRetryDone'
  | 'exportsRetryFailed'
  | 'exportsCount'
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
  | 'fusionStyleNotePlaceholder'
  | 'fusionCropLabel'
  | 'fusionCropX'
  | 'fusionCropY'
  | 'fusionCropWidth'
  | 'fusionCropHeight'
  | 'fusionCropHint'
  | 'fusionCropInvalid'
  // ---- B-4 视频续写显式模式 ----
  | 'videoContinuation'
  | 'videoContinuationHint'
  | 'videoContinuationNeedsRefVideo'
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
  | 'modelLiveAvailable'
  | 'modelLiveMissing'
  | 'modelLiveUnknown'
  | 'modelLiveProbeOk'
  | 'modelLiveProbeFailed'
  | 'defaultsOptionsMissing'
  | 'defaultsOptionsLoading'
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
  | 'promptRiskFailed'
  // ---- B-7 资源分类 + 重绘计划 ----
  | 'resourceFoldersTitle'
  | 'resourceFolderAll'
  | 'resourceFolderUncategorized'
  | 'resourceFolderNone'
  | 'redrawPlanRun'
  | 'redrawPlanPromptLabel'
  | 'redrawPlanRefs'
  | 'redrawPlanSuggestions'
  | 'redrawPlanWarnings'
  | 'redrawPlanToForm'
  | 'redrawPlanApplied'
  // ---- B-18 物料手动挑选 + 匹配回显 ----
  | 'pipelineManualPick'
  | 'pipelineManualPickHint'
  | 'pipelineManualPickEmpty'
  | 'pipelineManualPickClear'
  | 'pipelineManualPickCount'
  | 'pipelineMatchedTitle'
  | 'pipelineMatchedItem'

/** Dictionary namespace owned by this plugin's browser half. */
export { NS } from './locale-ns.ts'

/** English copy. */
export const en: Record<WorkbenchLocaleKey, string> = {
  tabTitle: 'Three Video workbench',
  guideDescription: 'Series, media assets and generation tasks for image and video work.',
  sectionProject: 'Series',
  pipelineTitle: 'One-click film: script → shots → image → video',
  pipelineScriptLabel: 'Script',
  pipelineScriptPlaceholder: 'Rainy street at night. Lin Xia walks over with an umbrella. She looks up at the neon sign.',
  pipelineModeImageToVideo: 'Image → video',
  pipelineModeTextToVideo: 'Text → video',
  pipelineShots: 'Shots',
  pipelineDuration: 'Seconds per shot',
  pipelineRunning: 'Running…',
  pipelineStarted: 'Pipeline started',
  pipelineCompose: 'Generate shots',
  pipelineComposed: 'Shots ready — edit them below',
  pipelineShotsCount: 'shots',
  pipelineWarnings: 'Note',
  pipelineNeedsProject: 'Create or pick a series first',
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
  projectNone: 'No series yet',
  saveSaved: 'Saved',
  saveSaving: 'Saving…',
  saveDirty: 'Unsaved changes',
  saveFailed: 'Save failed',
  modeQuick: 'Quick create',
  modulePipeline: 'Script → film',
  modulePipelineDesc: 'Paste a script: it is split into shots, then images and clips are generated for it.',
  moduleScript: 'Script · segments',
  moduleScriptDesc: 'Write the full script, pick a text model and skill, then split it into segments automatically or by hand.',
  scriptTextModel: 'Text model',
  scriptTextModelEmpty: 'Not selected',
  scriptImageModel: 'Image model',
  scriptVideoModel: 'Video model',
  scriptDirectorSkill: 'Director skill',
  scriptFollowDefault: 'Use default',
  scriptSplit: 'Auto-split',
  scriptSplitting: 'Splitting…',
  scriptSplitHint: 'Split by plot with the selected text model',
  scriptSplitNeedsModel: 'The host provides no text model, so segments cannot be generated automatically.',
  scriptSplitNeedsScript: 'Write a script before auto-splitting.',
  scriptSplitDone: 'Created {n} segments',
  scriptSplitFailed: 'Auto-split failed',
  scriptModelsFailed: 'Could not load the text model catalog',
  loginThreeView: 'Sign in to Three Video',
  moduleQuick: 'One line, one shot',
  moduleQuickDesc: 'Type one prompt to get a single image or a single clip.',
  moduleCollapse: 'Collapse',
  moduleExpand: 'Expand',
  templateQuickImage: 'Quick image',
  templateQuickVideo: 'Quick video',
  templateStoryboard: 'Storyboard',
  templateCover: 'Cover image',
  templateProductionLine: 'Production line',

  resourceReference: 'Reference (makeup shot)',
  resourceUseSelected: 'Use selected asset',
  resourceFilterEmpty: 'No resource matches the filter — clear it to see all.',
  resourceUseSelectedHint: 'Pick one asset in the “Assets” pane first',
  resourceEdit: 'Edit name and note',
  resourceEditSave: 'Save',
  resourceNoteHint: 'Note is the appearance description used by the redraw plan',
  resourceRefPreview: 'Show this reference image in Preview',
  resourceFirstRefHint: 'The first reference image is the look we keep using',

  resourceClear: 'Clear',

  skippedCount: 'skipped',
  importFiles: 'Import files…',
  importDone: 'Imported',
  importUnsupported: 'Cannot read file paths here — importing needs the desktop app.',

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
  generateNeedsProject: 'Pick a series at the top first, otherwise the result cannot be filed.',

  modeWorkflow: 'Workflow',
  modeTimeline: 'Timeline',
  paneAssets: 'Assets',
  paneResources: 'Resources',
  paneResourcesNamed: '{series} resources',
  panePreview: 'Preview',
  paneTasks: 'Tasks',
  paneHealth: 'Library health',
  healthChecking: 'Connecting to host…',
  healthFailed: 'Host unavailable',
  panePlanned: 'Not runnable yet — planned for a later phase',
  newProject: 'New series',
  projectNamePlaceholder: 'Series name',
  create: 'Create',
  remove: 'Remove',
  confirmRemove: 'Confirm remove',
  refresh: 'Refresh',
  refreshAssetsDone: 'Refreshed · registered {created} · merged {removed}',
  noOutputs: 'No media in the output directory yet',
  noAssets: 'No assets in this series yet',
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
  defaultsSourceOverride: 'overridden',
  defaultsSourceSettings: 'from settings',
  resourceUseUnit: 'artifacts',
  resourceUsedBy: 'Used by',
  resourceDetails: 'Details',
  resourceHideDetails: 'Hide details',
  resourceCreateHint: 'A name is enough to start — add the look photo later',
  resourceFoldersAdvanced: 'Advanced: folders & redraw plan',

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
  canvasTransient: 'Workflow is kept on this machine; series storage lands with the host endpoint',
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
  noResources: 'No resources in this series yet',
  addResource: 'Add resource',
  alreadyRegistered: 'Already registered in this series',
  previewOutput: 'Preview output',
  filterAll: 'All media',
  filterImage: 'Images',
  filterVideo: 'Videos',
  kindRole: 'Role',
  kindCostume: 'Costume',
  kindScene: 'Scene',
  kindProp: 'Prop',
  kindBrand: 'Brand',
  kindStyle: 'Style',
  kindVoice: 'Voice',
  sectionEpisode: 'Episode',
  episodeNone: 'No episode yet',
  episodeNew: 'New episode',
  episodeRename: 'Rename episode',
  episodeRemove: 'Delete episode',
  episodeResourcesSelected: 'This episode',
  episodeResourcesAll: 'All series resources',
  episodeRefsHint: 'References only — nothing is copied.',
  episodeRefsEmpty: 'Nothing added to this episode yet.',
  episodeRefsBrowse: 'Browse all series resources',
  episodeRefMissing: 'Missing reference',
  episodeRefCategory: 'Category',
  episodeCategoryUngrouped: 'Ungrouped',
  episodeAddResource: 'Add to episode',
  episodeAddAsset: 'Add asset to episode',
  episodeAssetTag: 'Asset',
  episodeWorkspaceTitle: 'Episode workspace',
  episodeScriptSaved: 'Saved',
  episodeScriptDirty: 'Unsaved',
  episodeScriptSaving: 'Saving…',
  episodeScriptFailed: 'Save failed',
  episodeTotalDuration: '{n}s total',
  segmentTitle: 'Segments',
  segmentAdd: 'Add segment',
  segmentEmpty: 'No segments yet — add one and write its prompt.',
  segmentName: 'Segment {n}',
  segmentPromptLabel: 'Segment prompt',
  segmentPromptPlaceholder: 'Within these seconds: who, where, what happens…',
  segmentDurationLabel: 'Seconds',
  segmentSkillLabel: 'Director skill',
  segmentSkillDefault: 'Default skill',
  segmentSkillHint: 'Active director skills from the skill library; with none selected the default skill is used.',
  segmentSkillMissing: 'Disabled skill',
  skillsPaneTitle: 'Skill libraries',
  skillsPaneDesc: 'The director library turns prompts into professional storyboards; the reverse library turns images and short clips into editable prompts.',
  skillKindDirector: 'Director library',
  skillKindReverse: 'Reverse library',
  skillKindDirectorDesc: 'Prompt → professional storyboard',
  skillKindReverseDesc: 'Image / short clip → editable prompt',
  skillImportLabel: 'Import skill',
  skillImportPlaceholder: 'Local path, or https://…/skill.json',
  skillImportAction: 'Import',
  skillImportDone: 'Imported {name}',
  skillImportFailed: 'Import failed',
  skillBuiltin: 'Built-in',
  skillDisabled: 'Disabled',
  skillToggleOn: 'Enable',
  skillToggleOff: 'Disable',
  skillRemove: 'Delete',
  skillReveal: 'Open folder',
  skillEmpty: 'No skills in this library yet',
  skillLoadFailed: 'Could not read the skill library',
  skillRemoveConfirm: 'Delete {name}? A backup is kept under _backup first.',
  skillRemoved: 'Deleted {name}',
  skillCreateToggle: 'Create manually',
  skillNameLabel: 'Name',
  skillNamePlaceholder: 'e.g. Realistic commercial storyboard',
  skillDescriptionLabel: 'Description',
  skillDescriptionPlaceholder: 'What this skill is for (optional)',
  skillPromptLabel: 'Prompt template',
  skillPromptPlaceholder: 'Paste the skill prompt…',
  skillSaveAction: 'Save skill',
  skillSaved: 'Saved {name}',
  skillBuiltinReadonly: 'Built-in skills are read-only; they can only be disabled',
  skillsHint: 'Skills live under skills/ in the workbench data directory; built-in skills are read-only but can be disabled.',
  skillsRefresh: 'Refresh',
  quickTabProduce: 'Content production',
  quickTabPrompt: 'Prompts · storyboard',
  studioTitle: 'Prompts · storyboard',
  studioDesc: 'Turn up to 8 images into editable prompts, then save them to this episode.',
  studioSkillLabel: 'Reverse skill',
  studioSkillDefault: 'Default Skill',
  studioSources: 'Input images',
  studioSourcesHint: 'From this episode and the global media library; at most 8.',
  studioSourcesEmpty: 'No images yet — generate or register media first.',
  studioSourceLimit: 'At most {n} input images',
  studioExtractAction: 'Extract prompts',
  studioExtracting: 'Extracting…',
  studioExtracted: 'Extracted {n} prompt(s)',
  studioExtractFailed: 'Extraction failed',
  studioClearSources: 'Clear',
  studioNameLabel: 'Prompt name',
  studioNamePlaceholder: 'Prompt name shown in the episode library',
  studioDraftNameSuffix: 'prompt',
  studioDraftLabel: 'Editable prompt',
  studioDraftPlaceholder: 'Extracted or hand-written prompt…',
  studioSaveAction: 'Save to episode',
  studioSaved: 'Saved {name}',
  studioSaveFailed: 'Could not save the prompt',
  studioApply: 'Use in production',
  studioPromptLibrary: 'Episode prompt library',
  studioPromptEmpty: 'No prompts saved in this episode yet',
  studioRemovePrompt: 'Delete',
  studioStoryboard: 'Storyboard shots',
  studioStoryboardEmpty: 'No storyboard for this episode yet',
  studioShotApply: 'Use shot prompt',
  studioNoEpisode: 'Create an episode first',
  studioLoadFailed: 'Could not load the prompt studio',
  shotRefAdd: 'Pick image / video for this shot',
  episodeSyncWorkflow: 'Sync to workflow',
  episodeSyncWorkflowDone: 'Storyboard synced to {name}',
  episodeSyncWorkflowFailed: 'Sync failed',
  episodeExport: 'Export this episode',
  episodeExportDone: 'Episode exported to {path}',
  episodeExportFailed: 'Export failed',
  segmentRefsLabel: 'References',
  segmentRefsEmpty: 'No references — pick from this episode’s resources or assets.',
  segmentAddRef: 'Add reference',
  segmentRefResources: 'Series resources',
  segmentRefAssets: 'Assets',
  segmentRemove: 'Delete segment',
  segmentSaveFailed: 'Segment save failed',
  segmentAddFailed: 'Could not add the segment',
  segmentRemoveFailed: 'Could not delete the segment',
  segmentStoryboardPlan: 'Generate storyboard',
  segmentStoryboardNone: 'No storyboard yet — generate one from this segment’s prompt.',
  storyboardSave: 'Save storyboard',
  shotName: 'Shot {n}',
  shotGenerateImage: 'Generate image',
  shotGenerateVideo: 'Generate video',
  shotGenerating: 'Generating…',
  shotImageDone: 'Shot {n} image generated.',
  shotVideoQueued: 'Shot {n} video queued — follow the task list.',
  shotGenerateFailed: 'Generation failed',
  refInsertToken: 'Append [@{n}] to the prompt',
  moveUp: 'Move up',
  moveDown: 'Move down',
  brandName: 'Three Video',
  brandTagline: 'Media production workbench',
  dockTitle: 'Media studio',
  statResources: 'Resources',
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
  assetSearchPlaceholder: 'Search name / prompt / model',
  storageUsageLabel: 'Local outputs',
  storageUsageFiles: 'files',
  storageUsageLoading: 'reading…',
  storageRevealFolder: 'Show in folder',
  storageRevealFailed: 'Could not open the file manager — open this path manually: {path}',
  assetSortLabel: 'Sort',
  assetSortNewest: 'Newest first',
  assetSortOldest: 'Oldest first',
  assetSortLargest: 'Largest first',
  assetSortName: 'By name',
  assetSearchEmpty: 'No matching assets (try clearing the search)',
  previewAsReference: 'Use as reference',
  previewAsLastFrame: 'Use as last frame',
  previewAsReferenceVideo: 'Use as reference video',
  previewSentReference: 'Added to reference images',
  previewSentLastFrame: 'Set as last frame',
  previewSentReferenceVideo: 'Set as reference video',
  storyboardToPipeline: 'Build pipeline',
  storyboardToPipelineHint: 'Turn the current storyboard into a script for One-click compose (no re-pasting)',
  storyboardSentToPipeline: 'Storyboard script sent to One-click compose',
  storyboardNeedsShotsForPipeline: 'No shots yet — plan the storyboard first, then build the pipeline',
  taskErrorShow: 'Why it failed',
  taskErrorHide: 'Hide reason',
  taskErrorHint: 'Show the upstream error for this failed task',
  railAssets: 'Media assets',
  railSkills: 'Skill libraries',
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
  generateRefsPreviewHint: 'Click the thumbnail or the filename to preview it',
  pipelineModeVideoToVideo: 'Video → video (recreate)',
  pipelineToCanvas: 'Build canvas',
  pipelineToCanvasHint: 'Only lays the shots out on the canvas — nothing starts until you run it there',
  pipelineInlineRun: 'Generate here',
  pipelineInlineRunHint: 'Generates shot by shot right here, without opening the canvas',
  pipelineInlineVideoFailed: 'Shot video failed',
  pipelineInlineVideoCancelled: 'Shot video was cancelled',
  pipelineInlineVideoTimeout: 'Timed out waiting for the shot video',
  pipelineInlineVideoNoOutput: 'The shot video task finished without a file',
  pipelineShotDuration: 'Shot seconds',
  pipelineVideoToVideoNeedsRef: 'Video → video needs a reference clip first',
  pipelineShotEditable: 'Each shot text and seconds can be edited before generating',
  modelDetails: 'Model details',
  fusionEntry: 'Compose with series looks',
  fusionEntryHint: 'Pick roles, scenes and props — they are turned into one prompt',
  defaultsBuiltinSource: 'Built-in',
  defaultsFollow: 'Follow default',
  defaultSeriesName: 'First series',
  videoSlotsTitle: 'Video only (last frame / reference clip / real person / continuation)',
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
  resourceTabOther: 'More types',
  resourceFilterPlaceholder: 'Filter by name or note',

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

  // ---- 提示词带入（提示词·分镜页与分镜镜头共用） ----
  promptApplyDone: 'Loaded into the prompt box',
  healthSize: 'Size report',
  healthDupes: 'Duplicates',
  healthStats: 'Per-series',
  healthRun: 'Run report',
  healthRunning: 'Scanning…',
  healthEmptyHint: 'Run the report to see asset health.',
  healthSizeSummary: 'Total',
  healthMedian: 'median',
  healthUnused: 'unused',
  healthNoDupes: 'No duplicates found.',
  healthReclaimable: 'Reclaimable',
  healthSuggestedKeep: 'suggested keep',
  healthNoProjects: 'No series yet.',
  healthAssets: 'assets',
  healthReferenced: 'referenced',
  healthTimelines: 'timelines',
  regenerate: 'Regenerate',
  regenerateHint: 'Run this prompt again with the same model.',
  regenerateNoPrompt: 'This task has no prompt to regenerate from.',
  useAsReference: 'Use as reference',
  useAsRefHint: 'Put this output into the quick-generate reference slots.',
  addToTimeline: 'Add to timeline',
  addToTimelineHint: 'Append this clip to the current series timeline.',
  addToTimelineDone: 'Appended to the timeline.',
  noTimelinesHint: 'No timeline in this series yet.',
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
  storyboardNeedsProject: 'Create or pick a series first.',
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
  exportsFilterAll: 'All series',
  exportsNeedTimeline: 'Add clips on the Timeline first, then export',
  exportsFilterProject: 'Filter by series',
  exportsRefresh: 'Refresh',
  exportsOutput: 'Output',
  exportsElapsed: 'Elapsed',
  exportsError: 'Failure',
  exportsRetry: 'Retry export',
  exportsRetryDone: 'Retry started for {name}.',
  exportsRetryFailed: 'Retry failed',
  exportsCount: '{n} records',
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
  fusionStyleNotePlaceholder: 'e.g. cinematic lighting, soft palette…',
  fusionCropLabel: 'Crop scene',
  fusionCropX: 'X',
  fusionCropY: 'Y',
  fusionCropWidth: 'Width',
  fusionCropHeight: 'Height',
  fusionCropHint: 'Normalized 0–1 coordinates; the cropped scene replaces the original before the model sees it.',
  fusionCropInvalid: 'Invalid crop: keep within 0–1 and at least 5% on each side.',

  // ---- B-4 视频续写显式模式 ----
  videoContinuation: 'Continuation (extend)',
  videoContinuationHint: 'Keep shooting right after the reference video. A reference video is required; missing it is rejected, not silently downgraded.',
  videoContinuationNeedsRefVideo: 'Continuation needs a reference video — pick one first.',

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
  modelLiveAvailable: 'listed by provider',
  modelLiveMissing: 'not in provider catalog',
  modelLiveUnknown: 'cannot verify',
  modelLiveProbeOk: 'Checked provider model catalog',
  modelLiveProbeFailed: 'Model catalog check failed',
  defaultsOptionsMissing: 'This host did not send the option list — update or restart the plugin, then reopen.',
  defaultsOptionsLoading: 'Loading options…',

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
  promptRiskFailed: 'Safety check failed; submit at your own risk.',

  // ---- B-7 资源分类 + 重绘计划 ----
  resourceFoldersTitle: 'Folders',
  resourceFolderAll: 'All',
  resourceFolderUncategorized: 'Uncategorized',
  resourceFolderNone: 'No folder',
  redrawPlanRun: 'Plan redraw',
  redrawPlanPromptLabel: 'Suggested prompt',
  redrawPlanRefs: 'Reference images',
  redrawPlanSuggestions: 'Suggestions',
  redrawPlanWarnings: 'Warnings',
  redrawPlanToForm: 'Send to compose',
  redrawPlanApplied: 'Applied to compose form.',

  // ---- B-18 物料手动挑选 + 匹配回显 ----
  pipelineManualPick: 'Pick materials manually',
  pipelineManualPickHint: 'Force specific resources into the pipeline. Leave empty to let the script auto-match.',
  pipelineManualPickEmpty: 'No materials picked.',
  pipelineManualPickClear: 'Clear',
  pipelineManualPickCount: '{n} picked',
  pipelineMatchedTitle: 'Matched materials',
  pipelineMatchedItem: '{name} · {kind}',
  exampleProject: 'Example series',
  exampleProjectDone: 'Example series created — try the Quick image template on the canvas.',
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
  fusionStyleNotePlaceholder: '例如：电影感光影、柔和色调…',
  fusionCropLabel: '场景裁剪',
  fusionCropX: 'X',
  fusionCropY: 'Y',
  fusionCropWidth: '宽',
  fusionCropHeight: '高',
  fusionCropHint: '归一化 0–1 坐标；裁剪后的场景图会替换原图送模型。',
  fusionCropInvalid: '裁剪无效：必须在 0–1 内，且每边至少保留 5%。',

  // ---- B-4 视频续写显式模式 ----
  videoContinuation: '续写（延续视频）',
  videoContinuationHint: '紧接参考视频往后拍。必须有参考视频，缺参考视频直接拒绝，不静默降级。',
  videoContinuationNeedsRefVideo: '续写需要参考视频——先选一条。',

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
  modelLiveAvailable: '服务商目录已列出',
  modelLiveMissing: '服务商目录里没有',
  modelLiveUnknown: '无法校验',
  modelLiveProbeOk: '已核对服务商模型目录',
  modelLiveProbeFailed: '模型目录校验失败',
  defaultsOptionsMissing: '宿主没有下发可选项——请更新或重启插件后重新打开。',
  defaultsOptionsLoading: '正在读取可选项…',

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
  promptRiskFailed: '风控检测失败；自行承担风险提交。',

  // ---- B-7 资源分类 + 重绘计划 ----
  resourceFoldersTitle: '分类',
  resourceFolderAll: '全部',
  resourceFolderUncategorized: '未分类',
  resourceFolderNone: '无分类',
  redrawPlanRun: '生成重绘计划',
  redrawPlanPromptLabel: '建议提示词',
  redrawPlanRefs: '参考图',
  redrawPlanSuggestions: '建议',
  redrawPlanWarnings: '提醒',
  redrawPlanToForm: '填入融合表单',
  redrawPlanApplied: '已填入融合表单。',

  // ---- B-18 物料手动挑选 + 匹配回显 ----
  pipelineManualPick: '手动挑选物料',
  pipelineManualPickHint: '强制把指定资源塞进流水线。留空则让剧本自动匹配。',
  pipelineManualPickEmpty: '还没挑任何物料。',
  pipelineManualPickClear: '清空',
  pipelineManualPickCount: '已挑 {n} 个',
  pipelineMatchedTitle: '匹配到的物料',
  pipelineMatchedItem: '{name} · {kind}',

  tabTitle: 'Three Video 工作台',
  guideDescription: '图片与视频创作的剧集、媒体素材与生成任务。',
  sectionProject: '剧集',
  pipelineTitle: '一键成片：剧本 → 分镜 → 生图 → 生视频',
  pipelineScriptLabel: '剧本',
  pipelineScriptPlaceholder: '雨夜街头，林夏撑伞走来。她抬眼看向霓虹招牌。',
  pipelineModeImageToVideo: '图生视频',
  pipelineModeTextToVideo: '文生视频',
  pipelineShots: '分镜数',
  pipelineDuration: '每镜秒数',
  pipelineRunning: '执行中…',
  pipelineStarted: '已起跑',
  pipelineCompose: '生成分镜',
  pipelineComposed: '分镜已生成，可在下面逐条修改',
  pipelineShotsCount: '个分镜',
  pipelineWarnings: '提醒',
  pipelineNeedsProject: '先创建或选择一个剧集',
  pipelineMissingTitle: '物料缺失',
  pipelineMissingHint: '剧本提到、剧集资源里还没有的角色/场景/物品：照常能生成，但这些物料没有参考图，一致性不保证；登记后会自动重新匹配。',
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
  projectNone: '还没有剧集',
  saveSaved: '已保存',
  saveSaving: '保存中…',
  saveDirty: '有未保存改动',
  saveFailed: '保存失败',
  modeQuick: '快速创作',
  modulePipeline: '剧本 → 成片',
  modulePipelineDesc: '贴一段剧本：自动拆成分镜，再逐镜出图、出视频。',
  moduleScript: '剧本 · 分段',
  moduleScriptDesc: '写整段剧本，选文本模型与导演 Skill，自动或手动拆成分段。',
  scriptTextModel: '文本模型',
  scriptTextModelEmpty: '未选择',
  scriptImageModel: '图像模型',
  scriptVideoModel: '视频模型',
  scriptDirectorSkill: '导演 Skill',
  scriptFollowDefault: '跟随默认',
  scriptSplit: '自动生成分段',
  scriptSplitting: '拆分中…',
  scriptSplitHint: '用所选文本模型按剧情拆成分段',
  scriptSplitNeedsModel: '宿主没有提供文本模型，无法自动生成分段。',
  scriptSplitNeedsScript: '先写一段剧本再自动拆段。',
  scriptSplitDone: '已生成 {n} 个分段',
  scriptSplitFailed: '自动拆段失败',
  scriptModelsFailed: '读取文本模型目录失败',
  loginThreeView: '登录三视',
  moduleQuick: '一句话出一镜',
  moduleQuickDesc: '写一句提示词，出一张图或一段视频。',
  moduleCollapse: '收起',
  moduleExpand: '展开',
  templateQuickImage: '快速出图',
  templateQuickVideo: '快速出片',
  templateStoryboard: '图文分镜',
  templateCover: '封面图',
  templateProductionLine: '生产线',

  resourceReference: '参考图（定妆照）',
  resourceUseSelected: '用选中素材',
  resourceFilterEmpty: '没有匹配的资源——清空筛选看看全部。',
  resourceUseSelectedHint: '先在右侧「素材」里点一张图',
  resourceEdit: '编辑名称与备注',
  resourceEditSave: '保存',
  resourceNoteHint: '备注就是重绘计划用的「外观描述」',
  resourceRefPreview: '在预览里看这张参考图',
  resourceFirstRefHint: '第一张参考图是长期沿用的定妆照',

  resourceClear: '清除',

  skippedCount: '跳过',
  importFiles: '导入文件…',
  importDone: '已导入',
  importUnsupported: '这里拿不到文件路径——批量导入需在桌面应用里使用。',

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
  generateDone: '已生成，并登记为剧集素材',
  generateFailed: '生成失败',
  generateNeedsProject: '先在顶部选一个剧集，生成结果才好归档。',

  modeWorkflow: '专业工作流',
  modeTimeline: '时间轴精剪',
  paneAssets: '素材',
  paneResources: '创作资源',
  paneResourcesNamed: '{series}资源',
  panePreview: '预览',
  paneTasks: '任务',
  paneHealth: '素材库体检',
  healthChecking: '正在连接宿主…',
  healthFailed: '宿主未就绪',
  panePlanned: '暂不可运行——排在后续阶段',
  newProject: '新建剧集',
  projectNamePlaceholder: '剧集名称',
  create: '创建',
  remove: '删除',
  confirmRemove: '确认删除',
  refresh: '刷新',
  refreshAssetsDone: '已刷新 · 登记 {created} · 整理重复记录 {removed}',
  noOutputs: 'outputs 目录里还没有产物',
  noAssets: '这个剧集还没有素材',
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
  defaultsSourceOverride: '已覆盖',
  defaultsSourceSettings: '来自设置',
  resourceUseUnit: '次产物',
  resourceUsedBy: '被用到',
  resourceDetails: '详情',
  resourceHideDetails: '收起',
  resourceCreateHint: '只填名称就能先建起来，定妆照可以稍后补',
  resourceFoldersAdvanced: '高级：分类与重绘计划',

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
  canvasTransient: '工作流暂存在本机（剧集存储随宿主端点接入）',
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
  noResources: '这个剧集还没有创作资源',
  addResource: '新建资源',
  alreadyRegistered: '该产物已登记过',
  previewOutput: '预览产出',
  filterAll: '全部素材',
  filterImage: '只看图片',
  filterVideo: '只看视频',
  kindRole: '角色',
  kindCostume: '服装',
  kindScene: '场景',
  kindProp: '道具',
  kindBrand: '品牌',
  kindStyle: '风格',
  kindVoice: '音色',
  sectionEpisode: '集',
  episodeNone: '暂无集',
  episodeNew: '新建集',
  episodeRename: '重命名集',
  episodeRemove: '删除集',
  episodeResourcesSelected: '本集已选',
  episodeResourcesAll: '剧集全部资源',
  episodeRefsHint: '只存引用，不复制本体',
  episodeRefsEmpty: '本集还没有选素材或资源',
  episodeRefsBrowse: '去剧集全部里选',
  episodeRefMissing: '引用已失效',
  episodeRefCategory: '分类',
  episodeCategoryUngrouped: '未分组',
  episodeAddResource: '加入本集',
  episodeAddAsset: '把素材加入本集',
  episodeAssetTag: '素材',
  episodeWorkspaceTitle: '本集工作区',
  episodeScriptSaved: '已保存',
  episodeScriptDirty: '未保存',
  episodeScriptSaving: '保存中…',
  episodeScriptFailed: '保存失败',
  episodeTotalDuration: '总时长 {n} 秒',
  segmentTitle: '分段',
  segmentAdd: '新建分段',
  segmentEmpty: '还没有分段——先新建一段并写下提示词。',
  segmentName: '第 {n} 段',
  segmentPromptLabel: '分段提示词',
  segmentPromptPlaceholder: '这几秒里：谁、在哪、发生什么…',
  segmentDurationLabel: '秒数',
  segmentSkillLabel: '导演 Skill',
  segmentSkillDefault: '默认 Skill',
  segmentSkillHint: '只列出技能库里启用中的导演 Skill；不选时使用默认 Skill。',
  segmentSkillMissing: '已停用',
  skillsPaneTitle: '技能库',
  skillsPaneDesc: '导演库把提示词生成为专业分镜；逆向库把图片或短视频提取成可编辑提示词。',
  skillKindDirector: '导演库',
  skillKindReverse: '逆向库',
  skillKindDirectorDesc: '提示词 → 专业分镜',
  skillKindReverseDesc: '图片 / 短视频 → 可编辑提示词',
  skillImportLabel: '导入技能',
  skillImportPlaceholder: '本地路径，或 https://…/skill.json',
  skillImportAction: '导入',
  skillImportDone: '已导入 {name}',
  skillImportFailed: '导入失败',
  skillBuiltin: '内置',
  skillDisabled: '已禁用',
  skillToggleOn: '启用',
  skillToggleOff: '禁用',
  skillRemove: '删除',
  skillReveal: '打开目录',
  skillEmpty: '这个库还没有技能',
  skillLoadFailed: '技能库读取失败',
  skillRemoveConfirm: '删除技能 {name}？（会先备份到 _backup）',
  skillRemoved: '已删除 {name}',
  skillCreateToggle: '手动新建',
  skillNameLabel: '名称',
  skillNamePlaceholder: '例如：写实广告分镜',
  skillDescriptionLabel: '说明',
  skillDescriptionPlaceholder: '这个技能用来做什么（可选）',
  skillPromptLabel: '提示词模板',
  skillPromptPlaceholder: '粘贴技能正文…',
  skillSaveAction: '保存技能',
  skillSaved: '已保存 {name}',
  skillBuiltinReadonly: '内置技能只读，只能禁用',
  skillsHint: '技能保存在工作台数据目录的 skills/ 下；内置技能只读但可以禁用。',
  skillsRefresh: '刷新',
  quickTabProduce: '内容生产',
  quickTabPrompt: '提示词·分镜',
  studioTitle: '提示词·分镜',
  studioDesc: '最多选择 8 张图，经逆向 Skill 提取成可编辑提示词，并存进本集提示词库。',
  studioSkillLabel: '逆向 Skill',
  studioSkillDefault: '默认 Skill',
  studioSources: '输入图',
  studioSourcesHint: '来自本集素材与全局素材；最多 8 张。',
  studioSourcesEmpty: '还没有图片：先生成或登记素材。',
  studioSourceLimit: '最多选择 {n} 张输入图',
  studioExtractAction: '提取提示词',
  studioExtracting: '提取中…',
  studioExtracted: '已提取 {n} 条提示词',
  studioExtractFailed: '提取失败',
  studioClearSources: '清空',
  studioNameLabel: '提示词名称',
  studioNamePlaceholder: '显示在本集提示词库里的名称',
  studioDraftNameSuffix: '提示词',
  studioDraftLabel: '可编辑提示词',
  studioDraftPlaceholder: '提取结果或手写提示词…',
  studioSaveAction: '存入本集',
  studioSaved: '已保存 {name}',
  studioSaveFailed: '提示词保存失败',
  studioApply: '带入生成',
  studioPromptLibrary: '本集提示词库',
  studioPromptEmpty: '本集还没有保存提示词',
  studioRemovePrompt: '删除',
  studioStoryboard: '分镜镜头',
  studioStoryboardEmpty: '本集还没有分镜',
  studioShotApply: '带入镜头提示词',
  studioNoEpisode: '请先新建一集',
  studioLoadFailed: '提示词·分镜读取失败',
  shotRefAdd: '为本镜选择图片 / 视频',
  episodeSyncWorkflow: '同步到工作流',
  episodeSyncWorkflowDone: '分镜已同步到 {name}',
  episodeSyncWorkflowFailed: '同步失败',
  episodeExport: '导出本集',
  episodeExportDone: '本集已导出到 {path}',
  episodeExportFailed: '导出失败',
  segmentRefsLabel: '引用',
  segmentRefsEmpty: '还没有引用——从本集资源或素材里选。',
  segmentAddRef: '添加引用',
  segmentRefResources: '剧集资源',
  segmentRefAssets: '素材',
  segmentRemove: '删除分段',
  segmentSaveFailed: '分段保存失败',
  segmentAddFailed: '新建分段失败',
  segmentRemoveFailed: '删除分段失败',
  segmentStoryboardPlan: '生成分镜脚本',
  segmentStoryboardNone: '还没有分镜——用本段提示词生成一份。',
  storyboardSave: '保存分镜',
  shotName: '镜头 {n}',
  shotGenerateImage: '生成图片',
  shotGenerateVideo: '生成视频',
  shotGenerating: '生成中…',
  shotImageDone: '镜头 {n} 图片已生成。',
  shotVideoQueued: '镜头 {n} 视频已提交，去任务列表看进度。',
  shotGenerateFailed: '生成失败',
  refInsertToken: '把 [@{n}] 追加到提示词',
  moveUp: '上移',
  moveDown: '下移',
  brandName: 'Three Video',
  brandTagline: '三视创作工作台',
  dockTitle: '三视创作',
  statResources: '创作资源',
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
  assetSearchPlaceholder: '搜索文件名 / 提示词 / 模型',
  storageUsageLabel: '本地产物',
  storageUsageFiles: '个文件',
  storageUsageLoading: '读取中…',
  storageRevealFolder: '在文件夹显示',
  storageRevealFailed: '打不开文件管理器——请手动打开：{path}',
  assetSortLabel: '排序',
  assetSortNewest: '最新优先',
  assetSortOldest: '最早优先',
  assetSortLargest: '体积最大',
  assetSortName: '按名称',
  assetSearchEmpty: '没有匹配的素材（试试清空搜索）',
  previewAsReference: '设为参考',
  previewAsLastFrame: '设为尾帧',
  previewAsReferenceVideo: '设为参考视频',
  previewSentReference: '已加入参考图',
  previewSentLastFrame: '已设为尾帧',
  previewSentReferenceVideo: '已设为参考视频',
  storyboardToPipeline: '编排成流水线',
  storyboardToPipelineHint: '把当前分镜表组装成剧本，交给「一键成片」编排（不用重新粘剧本）',
  storyboardSentToPipeline: '已把分镜脚本送入一键成片',
  storyboardNeedsShotsForPipeline: '还没有分镜：先用上面的脚本生成分镜表，再编排成流水线',
  taskErrorShow: '查看原因',
  taskErrorHide: '收起原因',
  taskErrorHint: '展开这条任务失败的上游原文',
  railAssets: '媒体素材',
  railSkills: '技能库',
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
  generateRefsPreviewHint: '点击缩略图或文件名，在预览里看这张图',
  pipelineModeVideoToVideo: '视频生视频（复刻）',
  pipelineToCanvas: '生成画布',
  pipelineToCanvasHint: '只把分镜铺到画布，不开始生成；你在画布确认后再点生成',
  pipelineInlineRun: '就地生成',
  pipelineInlineRunHint: '不跳画布，直接按分镜逐镜出图 / 出视频',
  pipelineInlineVideoFailed: '本镜视频生成失败',
  pipelineInlineVideoCancelled: '本镜视频已取消',
  pipelineInlineVideoTimeout: '等本镜视频超时',
  pipelineInlineVideoNoOutput: '本镜视频任务结束但没有产物文件',
  pipelineShotDuration: '本镜时长(秒)',
  pipelineVideoToVideoNeedsRef: '视频生视频要先选一段参考视频',
  pipelineShotEditable: '分镜可以逐条改内容与时长',
  modelDetails: '模型详情',
  fusionEntry: '用剧集设定拼画面',
  fusionEntryHint: '多选角色 / 场景 / 道具，自动拼成一段提示词',
  defaultsBuiltinSource: '内置默认',
  defaultsFollow: '跟随默认',
  defaultSeriesName: '三视剧集',
  videoSlotsTitle: '视频专用（尾帧 / 参考视频 / 真人 / 续写）',
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
  resourceTabOther: '更多类型',
  resourceFilterPlaceholder: '按名称/备注筛选',

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

  // ---- 提示词带入（提示词·分镜页与分镜镜头共用） ----
  promptApplyDone: '已带入提示词框',
  healthSize: '体积排行',
  healthDupes: '重复素材',
  healthStats: '剧集统计',
  healthRun: '跑体检',
  healthRunning: '扫描中…',
  healthEmptyHint: '点按钮查看素材库体检报告。',
  healthSizeSummary: '总计',
  healthMedian: '中位数',
  healthUnused: '未使用',
  healthNoDupes: '没有重复素材。',
  healthReclaimable: '可回收',
  healthSuggestedKeep: '建议保留',
  healthNoProjects: '还没有剧集。',
  healthAssets: '素材',
  healthReferenced: '被引用',
  healthTimelines: '时间轴',
  regenerate: '重新生成',
  regenerateHint: '用相同模型再跑一次这条提示词。',
  regenerateNoPrompt: '这条任务没有可复用的提示词。',
  useAsReference: '用作参考图',
  useAsRefHint: '把这条产物放进快速生成的参考图槽位。',
  addToTimeline: '加入时间轴',
  addToTimelineHint: '把这段视频追加到当前剧集的时间轴。',
  addToTimelineDone: '已追加到时间轴。',
  noTimelinesHint: '当前剧集还没有时间轴。',
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
  storyboardNeedsProject: '先创建或选择一个剧集。',
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
  exportsFilterAll: '全部剧集',
  exportsNeedTimeline: '先到「时间轴」放片段，再来导出',
  exportsFilterProject: '按剧集筛选',
  exportsRefresh: '刷新',
  exportsOutput: '产物',
  exportsElapsed: '耗时',
  exportsError: '失败原因',
  exportsRetry: '重试导出',
  exportsRetryDone: '已为 {name} 重新开始导出。',
  exportsRetryFailed: '重试失败',
  exportsCount: '{n} 条记录',
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
  exampleProject: '示例剧集',
  exampleProjectDone: '示例剧集已建好——去画布试试「快速图片」模板。',
}
