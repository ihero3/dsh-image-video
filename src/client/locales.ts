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
  | 'refZoom'
  | 'generateHeading'
  | 'generatePromptLabel'
  | 'generatePromptPlaceholder'
  | 'generateImage'
  | 'generateVideo'
  | 'generating'
  | 'generateCancel'
  | 'generateCancelling'
  | 'generateCancelled'
  | 'generateCannotCancel'
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
  | 'modeScript'
  | 'scriptTabRoles'
  | 'scriptTabScenes'
  | 'scriptTabCostumes'
  | 'scriptTabProps'
  | 'scriptTabSplit'
  | 'scriptTabExtract'
  | 'scriptTabVoice'
  | 'scriptTabMotion'
  | 'extractKindLabel'
  | 'extractCostumeTitle'
  | 'extractCostumeDesc'
  | 'extractCandidates'
  | 'extractRoleTitle'
  | 'extractRoleDesc'
  | 'extractSceneTitle'
  | 'extractSceneDesc'
  | 'extractPropTitle'
  | 'extractPropDesc'
  | 'voicePanelTitle'
  | 'voicePanelDesc'
  | 'voiceExtractPromptLabel'
  | 'voiceExtractPromptPlaceholder'
  | 'voiceExtractRun'
  | 'voiceCardsTitle'
  | 'voiceCardsDesc'
  | 'voiceCardsEmpty'
  | 'voiceCardAdd'
  | 'voiceCardUntitled'
  | 'voiceCardName'
  | 'voiceCardPrompt'
  | 'voiceCardPromptPlaceholder'
  | 'voiceCardVoice'
  | 'voiceCardDefaultVoice'
  | 'voiceCardSpeed'
  | 'voiceCardPitch'
  | 'voiceCardEmotion'
  | 'voiceCardEmotionPlaceholder'
  | 'voiceCardRefAudio'
  | 'voiceCardRefAudioPlaceholder'
  | 'voiceCardSave'
  | 'voiceCardSaved'
  | 'voiceCardSynthesize'
  | 'voiceCardSynthesizing'
  | 'voiceCardSynthesized'
  | 'motionPanelTitle'
  | 'motionPanelDesc'
  | 'motionExtractPromptLabel'
  | 'motionExtractPromptPlaceholder'
  | 'motionExtractRun'
  | 'motionCardsTitle'
  | 'motionCardsDesc'
  | 'motionCardsEmpty'
  | 'motionCardAdd'
  | 'motionCardUntitled'
  | 'motionCardName'
  | 'motionCardPreset'
  | 'motionCardNote'
  | 'motionCardNotePlaceholder'
  | 'motionCardSave'
  | 'motionCardSaved'
  | 'motionPresetPush'
  | 'motionPresetPull'
  | 'motionPresetPanLeft'
  | 'motionPresetPanRight'
  | 'motionPresetTiltUp'
  | 'motionPresetTiltDown'
  | 'motionPresetOrbit'
  | 'motionPresetHold'
  | 'motionPresetCustom'
  | 'motionFramesTitle'
  | 'motionFrameAdd'
  | 'motionFramesEmpty'
  | 'motionFrameTime'
  | 'motionFrameScale'
  | 'motionCompiledPrompt'
  | 'extractRun'
  | 'extractRunning'
  | 'extractSource'
  | 'extractSourceWithFiles'
  | 'extractNeedsScript'
  | 'extractNeedsModel'
  | 'extractNeedsProject'
  | 'extractEmpty'
  | 'extractAdd'
  | 'extractAdded'
  | 'extractExisting'
  | 'modulePipeline'
  | 'moduleEpisode'
  | 'moduleEpisodeDesc'
  | 'modulePipelineDesc'
  | 'scriptStepPlan'
  | 'scriptStepScript'
  | 'scriptStepSplit'
  | 'scriptStepStoryboard'
  | 'scriptStepNow'
  | 'scriptStepDone'
  | 'scriptStepJump'
  | 'scriptStepHintScript'
  | 'scriptStepHintSplit'
  | 'scriptStepHintStoryboard'
  | 'scriptStepAllDone'
  | 'scriptTextModel'
  | 'scriptTextModelEmpty'
  | 'scriptImageModel'
  | 'scriptVideoModel'
  | 'scriptDirectorSkill'
  | 'scriptFollowDefault'
  | 'scriptSplit'
  | 'scriptSplitting'
  | 'scriptSplitHint'
  | 'scriptSplitMode'
  | 'scriptSplitModeRule'
  | 'scriptSplitModeModel'
  | 'episodeScriptJump'
  | 'episodeScriptAll'
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
  | 'previewExpand'
  | 'previewShrink'
  | 'previewPlay'
  | 'refPreview'
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
  | 'defaultsStripHint'
  | 'defaultsGroupMode'
  | 'defaultsGroupImage'
  | 'defaultsGroupVideo'
  | 'defaultsGroupText'
  | 'defaultsTextModelHint'
  | 'defaultTextModel'
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
  | 'exportSpecHint'
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
  | 'nodeExternal'
  | 'paramExternalClass'
  | 'paramExternalConfig'
  | 'externalNotRunnable'
  | 'canvasExternalTag'
  | 'canvasPalette'
  | 'canvasLibraryHint'
  | 'canvasLibraryEmpty'
  | 'canvasGroupInput'
  | 'canvasGroupStory'
  | 'canvasGroupGenerate'
  | 'canvasGroupFinishPlanned'
  | 'canvasNoExecutorTag'
  | 'canvasNoExecutorHint'
  | 'canvasGroupPlanned'
  | 'canvasOnboardingTitle'
  | 'canvasOnboardingHint'
  | 'canvasOnboardingBlank'
  | 'canvasOnboardingImport'
  | 'canvasOnboardingNodes'
  | 'canvasAutoLayout'
  | 'canvasQuickAdd'
  | 'canvasQuickAddHint'
  | 'canvasRunNodeShort'
  | 'canvasCached'
  | 'canvasProgress'
  | 'canvasLibraryToggle'
  | 'canvasDragHint'
  | 'canvasOutputPreview'
  | 'canvasCloseInspector'
  | 'canvasReplaceTemplate'
  | 'canvasReplaceImport'
  | 'canvasReplaceTitle'
  | 'canvasReplaceBody'
  | 'canvasReplaceConfirm'
  | 'canvasReplaceCancel'
  | 'modelDefaultTag'
  | 'modelDefaultHint'
  | 'canvasStatusEmpty'
  | 'canvasAdd'
  | 'canvasParams'
  | 'canvasFit'
  | 'canvasEmpty'
  | 'canvasPlannedTag'
  | 'canvasAutoSave'
  | 'canvasLogs'
  | 'canvasMaximize'
  | 'canvasRestore'
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
  | 'paramRefs'
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
  | 'episodeNo'
  | 'episodeNoHint'
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
  | 'segmentExpand'
  | 'segmentCollapse'
  | 'segmentPromptLabel'
  | 'segmentPromptPlaceholder'
  | 'segmentDurationLabel'
  | 'segmentSkillLabel'
  | 'segmentTextModel'
  | 'segmentVideoTooLong'
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
  | 'skillInsert'
  | 'skillInsertHint'
  | 'quickTabProduce'
  | 'quickTabPrompt'
  // ---- 快速创作简化版（QUICK-CREATE-REDESIGN v1.2 §4）----
  | 'quickRefsLabel'
  | 'quickRefsBase'
  | 'quickRefsAdd'
  | 'quickRefsEmptyHint'
  | 'quickAdvanced'
  | 'quickAdvancedDefaults'
  | 'quickAdvancedHint'
  | 'quickGenShortcut'
  | 'studioTitle'
  | 'studioDesc'
  | 'studioSkillLabel'
  | 'studioSkillDefault'
  | 'studioSources'
  | 'studioSourcesHint'
  | 'studioSourcesEmpty'
  | 'studioSourceLimit'
  | 'studioAddSource'
  | 'studioRulesLabel'
  | 'studioRulesPlaceholder'
  | 'studioModelLabel'
  | 'studioModelEmpty'
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
  | 'studioExtractCancelled'
  | 'studioExtractEmpty'
  | 'studioExtractPartial'
  | 'studioExtractCancel'
  | 'studioExtractingProgress'
  | 'studioRestoreDraft'
  | 'studioDraftCount'
  | 'studioCopyDraft'
  | 'studioCopied'
  | 'studioCopyFailed'
  | 'studioClearDraft'
  | 'studioClearConfirm'
  | 'studioSegments'
  | 'studioSegmentDrop'
  | 'studioRestored'
  | 'studioRemoved'
  | 'studioUndoRemove'
  | 'studioPromptLoad'
  | 'studioPromptCount'
  | 'shotRefAdd'
  | 'segmentRefsLabel'
  | 'episodeSyncWorkflow'
  | 'episodeSyncWorkflowDone'
  | 'episodeSyncWorkflowFailed'
  | 'episodeExport'
  | 'episodeExportDone'
  | 'episodeExportFailed'
  | 'episodeImport'
  | 'episodeImportHint'
  | 'episodeImportDone'
  | 'episodeImportFailed'
  | 'segmentRefsEmpty'
  | 'segmentAddRef'
  | 'segmentRefSearch'
  | 'segmentRefPickerEmpty'
  | 'segmentRefImages'
  | 'segmentRefVideos'
  | 'segmentGenerateAllImages'
  | 'segmentGenerateAllVideos'
  | 'segmentGenerateAllImagesDone'
  | 'segmentGenerateAllVideosDone'
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
  | 'canvasImportWorkflow'
  | 'canvasExportWorkflow'
  | 'canvasImportWorkflowDone'
  | 'canvasImportWorkflowFailed'
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
  // ---- 生成方式标签页（生图 / 生视频）与参考图选择 ----
  | 'createTabImage'
  | 'createTabVideo'
  | 'generateRefsModeHint'
  | 'generateRefsPick'
  | 'generateRefsDragHint'
  | 'refPickerSearch'
  | 'refPickerAssets'
  | 'refPickerResources'
  | 'refPickerEmpty'
  | 'refPickerAdded'
  | 'videoFirstFrame'
  | 'videoFirstFramePick'
  | 'pipelineToCanvas'
  | 'pipelineToCanvasHint'
  | 'pipelineInlineRun'
  | 'pipelineInlineRunHint'
  | 'pipelineInlineVideoFailed'
  | 'pipelineInlineVideoCancelled'
  | 'pipelineInlineVideoTimeout'
  | 'pipelineInlineVideoNoOutput'
  | 'pipelineShotDuration'
  | 'pipelineShotEditable'
  | 'modelDetails'
  | 'defaultsBuiltinSource'
  | 'defaultsFollow'
  | 'defaultSeriesName'
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
  | 'clipInspectorEmpty'
  | 'clipInspectorFallback'
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
  // ---- 提示词带入（提取提示词页与分镜镜头共用） ----
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
  | 'pipelineShots'
  | 'pipelineDuration'
  | 'pipelineRunning'
  | 'pipelineStarted'
  | 'pipelineCompose'
  | 'pipelineComposed'
  | 'pipelinePlanEpisodes'
  | 'pipelinePlanSegments'
  | 'pipelinePlanShots'
  | 'pipelineAuto'
  | 'pipelineAutoCountsHint'
  | 'pipelineGenerate'
  | 'pipelineGeneratingScript'
  | 'pipelineGenerateDone'
  | 'pipelineGenerateNeedsSource'
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
  | 'helpModes'
  | 'helpModeQuick'
  | 'helpModeWorkflow'
  | 'helpModeTimeline'
  | 'helpModeScript'
  | 'helpContactTitle'
  | 'helpContactOrg'
  | 'helpContactWechat'
  | 'helpVersionTitle'
  | 'helpVersionUnknown'
  | 'helpClose'
  | 'exampleProject'
  | 'exampleProjectDone'
  // ---- B-20 分镜合并：文本模型拆解 / 文件导入 / 局部重拆 / 导出落库 ----
  | 'pipelineTextModel'
  | 'pipelineTextModelRules'
  | 'pipelineTextModelHint'
  | 'pipelineTextModelMissing'
  | 'pipelineImportScript'
  | 'pipelineScriptChars'
  | 'pipelineImportScriptHint'
  | 'pipelineImporting'
  | 'pipelineImportedLabel'
  | 'pipelineImportRemove'
  | 'pipelineImportFailedShort'
  | 'pipelineImportDone'
  | 'pipelineImportFailed'
  | 'pipelineSkill'
  | 'pipelineSkillHint'
  | 'pipelineSkillNone'
  | 'pipelineSkillMissing'
  | 'pipelineInlineImage'
  | 'pipelineInlineImageHint'
  | 'pipelineInlineImageAria'
  | 'pipelineInlineRunAria'
  | 'pipelineInlineProgress'
  | 'pipelineShotImage'
  | 'pipelineExport'
  | 'pipelineSaveEpisode'
  | 'pipelineSavedEpisode'
  | 'pipelineSaveNeedsEpisode'
  | 'pipelineReplanShot'
  | 'pipelineReplanNoModel'
  | 'pipelineAddShot'
  | 'pipelineShotGenerate'
  | 'pipelineShotToCanvas'
  | 'pipelineSourceModel'
  | 'pipelineSourceRules'
  | 'pipelineEntitiesTitle'
  | 'pipelineEntitiesEmpty'
  | 'pipelineCancel'
  | 'pipelineCancelled'
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
  | 'modelCardsTextModels'
  | 'modelCardsTextModelsEmpty'
  | 'modelCardsTextFailures'
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
  | 'pipelineManualPickClear'
  | 'pipelineManualPickCount'
  | 'pipelineMatchedTitle'
  | 'pipelineMatchedItem'
  // ---- 剧本生成：四个分区共享输入 + 角色提取 / 角色卡片 ----
  | 'scriptSharedInputTitle'
  | 'scriptSharedInputDesc'
  | 'extractModelLabel'
  | 'extractPromptLabel'
  | 'extractPromptPlaceholder'
  | 'roleCardsTitle'
  | 'roleCardsEmpty'
  | 'roleCardDefault'
  | 'roleCardApplyDefault'
  | 'roleCardGenerate'
  | 'roleCardGenerating'
  | 'roleCardPreview'
  | 'roleCardGenerated'
  | 'roleCardNeedsProject'
  | 'planEpisodeUnit'
  | 'planSegmentUnit'
  | 'timelineClipDeleted'
  | 'timelineUndo'
  | 'tlAuxTools'
  | 'segPreviewRole'
  | 'clipInspectorAdvanced'
  | 'segmentAdvanced'
  | 'segmentShotUnit'
  | 'segmentSummary'
  | 'scriptSettings'
  | 'episodeMore'
  | 'episodeSyncConfirmTitle'
  | 'episodeSyncConfirmBody'
  | 'episodeSyncUndo'
  | 'episodeSyncDone'

/** Dictionary namespace owned by this plugin's browser half. */
export { NS } from './locale-ns.ts'

/** English copy. */
export const en: Record<WorkbenchLocaleKey, string> = {
  tabTitle: 'Three Video workbench',
  guideDescription: 'Series, media assets and generation tasks for image and video work.',
  sectionProject: 'Series',
  pipelineTitle: 'One-click film: script → shots → image → video',
  pipelineScriptLabel: 'Script / idea',
  pipelineScriptPlaceholder: 'Rainy street at night — paste a full script, or just a one-line idea and let the model expand it.',
  pipelineShots: 'Shots',
  pipelineDuration: 'Seconds per shot',
  pipelineRunning: 'Running…',
  pipelineStarted: 'Pipeline started',
  pipelineCompose: 'Generate shots',
  pipelineComposed: 'Shots ready — edit them below',
  pipelinePlanEpisodes: 'Episodes',
  pipelinePlanSegments: 'Segments / episode',
  pipelinePlanShots: 'Shots / segment',
  pipelineAuto: 'Auto',
  pipelineAutoCountsHint: 'Auto counts are estimated from script length (or recommended by the text model when selected) — still editable afterwards',
  pipelineGenerate: 'Generate script',
  pipelineGeneratingScript: 'Generating…',
  pipelineGenerateDone: '{n} episode(s) written into this series',
  pipelineGenerateNeedsSource: 'Write a script or a one-line idea above first',
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
  modeScript: 'Script',
  scriptTabRoles: 'Characters',
  scriptTabScenes: 'Scenes',
  scriptTabCostumes: 'Costumes',
  scriptTabProps: 'Props',
  scriptTabSplit: 'Storyboard',
  scriptTabExtract: 'Assets',
  scriptTabVoice: 'Voice',
  scriptTabMotion: 'Motion',
  extractKindLabel: 'What to extract',
  extractCostumeTitle: 'Costume extraction',
  extractCostumeDesc: 'Pull costumes and outfits out of the script; each records its style, wearer and pieces for a costume sheet.',
  extractCandidates: 'Candidates',
  voicePanelTitle: 'Voice extraction',
  voicePanelDesc: 'Turn speaking roles into reusable voice profiles: reference audio, preset voice, speed, pitch and emotion.',
  voiceExtractPromptLabel: 'Voice extraction prompt',
  voiceExtractPromptPlaceholder: 'Extra requirements, e.g. only roles with dialogue. Output must stay a JSON array.',
  voiceExtractRun: 'Extract voices',
  voiceCardsTitle: 'Voice profiles',
  voiceCardsDesc: 'One card per speaker. Save to the library; synthesis stays disabled until TTS is connected.',
  voiceCardsEmpty: 'Extract voices or add a card manually to configure a speaker.',
  voiceCardAdd: 'Add voice',
  voiceCardUntitled: 'Untitled voice',
  voiceCardName: 'Speaker / voice name',
  voiceCardPrompt: 'Voice description',
  voiceCardPromptPlaceholder: 'Tone, age, timbre, pace and emotional baseline for this speaker.',
  voiceCardVoice: 'Preset voice',
  voiceCardDefaultVoice: 'Default / not set',
  voiceCardSpeed: 'Speed',
  voiceCardPitch: 'Pitch',
  voiceCardEmotion: 'Emotion',
  voiceCardEmotionPlaceholder: 'e.g. calm / excited / narration',
  voiceCardRefAudio: 'Reference audio',
  voiceCardRefAudioPlaceholder: 'Optional path under outputs, e.g. outputs/voice-ref.wav',
  voiceCardSave: 'Save to library',
  voiceCardSaved: 'Voice saved: {name}',
  voiceCardSynthesize: 'Try synthesis',
  voiceCardSynthesizing: 'Synthesizing…',
  voiceCardSynthesized: 'Synthesis ready',
  motionPanelTitle: 'Motion extraction',
  motionPanelDesc: 'Plan camera moves from the script. Pick a preset or edit keyframes; compile into a readable motion prompt.',
  motionExtractPromptLabel: 'Motion extraction prompt',
  motionExtractPromptPlaceholder: 'Extra requirements, e.g. one track per shot with movement. Output must stay a JSON array.',
  motionExtractRun: 'Extract motion',
  motionCardsTitle: 'Motion tracks',
  motionCardsDesc: 'One card per camera move, saved as a motion-track resource with keyframes.',
  motionCardsEmpty: 'Extract motion or add a track manually, then apply a preset.',
  motionCardAdd: 'Add track',
  motionCardUntitled: 'Untitled track',
  motionCardName: 'Track name',
  motionCardPreset: 'Preset',
  motionCardNote: 'Motion note',
  motionCardNotePlaceholder: 'Camera move, subject position and duration for this track.',
  motionCardSave: 'Save to library',
  motionCardSaved: 'Motion track saved: {name}',
  motionPresetPush: 'Push in',
  motionPresetPull: 'Pull out',
  motionPresetPanLeft: 'Pan left',
  motionPresetPanRight: 'Pan right',
  motionPresetTiltUp: 'Tilt up',
  motionPresetTiltDown: 'Tilt down',
  motionPresetOrbit: 'Orbit',
  motionPresetHold: 'Static',
  motionPresetCustom: 'Custom',
  motionFramesTitle: 'Keyframes',
  motionFrameAdd: 'Add keyframe',
  motionFramesEmpty: 'No keyframes yet — add one or apply a preset.',
  motionFrameTime: 'Time (ms)',
  motionFrameScale: 'Scale',
  motionCompiledPrompt: 'Compiled motion prompt',
  extractRoleTitle: 'Character extraction',
  extractRoleDesc: 'Pull every character out of the current episode script; each candidate can be added to the resource library as a role.',
  extractSceneTitle: 'Scene extraction',
  extractSceneDesc: 'Pull every location out of the script, with time, lighting and set dressing that image prompts can use.',
  extractPropTitle: 'Props & costume extraction',
  extractPropDesc: 'Pull props and costumes out of the script; costumes record who wears them.',
  extractRun: 'Extract from script',
  extractRunning: 'Extracting…',
  extractSource: 'Source: current episode script',
  extractSourceWithFiles: 'Source: current episode script + imported files',
  extractNeedsScript: 'This episode has no script yet — write one under Storyboard first.',
  extractNeedsModel: 'Pick a text model before extracting.',
  extractNeedsProject: 'Create a series first.',
  extractEmpty: 'No candidates yet — run the extraction, then add the ones you want.',
  extractAdd: 'Add to library',
  extractAdded: 'Added to library: {name}',
  extractExisting: 'In library',
  scriptSharedInputTitle: 'Shared script input',
  scriptSharedInputDesc: 'One script and one import list across all four tabs; saved per episode.',
  extractModelLabel: 'Extraction text model',
  extractPromptLabel: 'Character extraction prompt',
  extractPromptPlaceholder: 'Extra requirements, e.g. only characters with lines. Output must stay a JSON array.',
  roleCardsTitle: 'Characters',
  roleCardsEmpty: 'Extract characters first, then generate a portrait for each character.',
  roleCardDefault: 'Default value',
  roleCardApplyDefault: 'Apply default',
  roleCardGenerate: 'Generate character image',
  roleCardGenerating: 'Generating…',
  roleCardPreview: 'View character image',
  roleCardGenerated: 'Character "{name}" generated and saved.',
  roleCardNeedsProject: 'Pick a series and an episode before generating a character image.',
  modulePipeline: 'Script → storyboard',
  modulePipelineDesc: 'Script → episode → segments → shots. Every level can be added to, edited or reordered below.',
  moduleEpisode: 'Episode workspace',
  moduleEpisodeDesc: 'Pick an episode to edit its script, segments, shots, generated images/clips and workflow.',
  scriptStepPlan: 'Script steps',
  scriptStepScript: 'Write script',
  scriptStepSplit: 'Segments',
  scriptStepStoryboard: 'Storyboard',
  scriptStepNow: 'Next',
  scriptStepDone: 'Done',
  scriptStepJump: 'Jump to this step',
  scriptStepHintScript: 'Write or paste the full text, then generate the script.',
  scriptStepHintSplit: 'Split the script into segments — each segment becomes a group of shots.',
  scriptStepHintStoryboard: 'Plan shots segment by segment, then batch-generate images and clips.',
  scriptStepAllDone: 'All three steps are done — sync the storyboard to the canvas, or send clips to the timeline.',
  scriptTextModel: 'Text model',
  scriptTextModelEmpty: 'Not selected',
  scriptImageModel: 'Image model',
  scriptVideoModel: 'Video model',
  scriptDirectorSkill: 'Select segment skill',
  scriptFollowDefault: 'Use default',
  scriptSplit: 'Start splitting',
  scriptSplitting: 'Splitting…',
  scriptSplitHint: 'Split the script into segments with rules or the selected text model',
  scriptSplitMode: 'Split by',
  scriptSplitModeRule: 'Default rules',
  scriptSplitModeModel: 'Text model',
  episodeScriptJump: 'Jump to segment',
  episodeScriptAll: 'All segments',
  scriptSplitNeedsModel: 'The host provides no text model, so model splitting cannot be used.',
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
  refZoom: 'Zoom',

  generateHeading: 'Generate here',
  generatePromptLabel: 'Prompt',
  generatePromptPlaceholder: 'Describe the shot you want…',
  generateImage: 'Generate image',
  generateVideo: 'Generate video',
  generating: 'Generating…',
  generateCancel: 'Cancel',
  generateCancelling: 'Cancelling…',
  generateCancelled: 'Generation cancelled',
  generateCannotCancel: 'The host has no cancellable task for this generation',
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
  previewExpand: 'Enlarge preview',
  previewShrink: 'Restore preview',
  previewPlay: 'Play video in preview',
  refPreview: 'View in preview',
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
  defaultsStripHint: 'Applied automatically on generation',
  defaultsGroupMode: 'Media type',
  defaultsGroupImage: 'Image',
  defaultsGroupVideo: 'Video',
  defaultsGroupText: 'Text',
  defaultsTextModelHint: 'Applies immediately; not part of saved defaults.',
  defaultTextModel: 'Text model',
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
  exportSpecHint: 'Actual output size and frame rate; changing the presets above updates it immediately',
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
  nodeExternal: 'External node',
  paramExternalClass: 'Original type',
  paramExternalConfig: 'Original config (JSON)',
  externalNotRunnable: 'Imported from a ComfyUI / LiblibAI workflow; kept for reference but not runnable here',
  canvasExternalTag: 'External',
  canvasPalette: 'Node library',
  canvasLibraryHint: 'Search nodes',
  canvasLibraryEmpty: 'No node matches that search',
  canvasGroupInput: 'Input & copy',
  canvasGroupStory: 'Storyboard & assets',
  canvasGroupGenerate: 'Generate',
  canvasGroupFinishPlanned: 'Finish & deliver (planned)',
  canvasNoExecutorTag: 'no executor',
  canvasNoExecutorHint: 'This node can be added and saved, but this version has no executor — runs skip it and produce no result.',
  canvasGroupPlanned: 'Reserved',
  canvasOnboardingTitle: 'Start from a template, run a whole chain',
  canvasOnboardingHint: 'Templates carry example copy and parameters — tweak a few words, then run.',
  canvasOnboardingBlank: 'Start from a blank canvas',
  canvasOnboardingImport: 'Import a ComfyUI / LiblibAI workflow',
  canvasOnboardingNodes: '{n} nodes',
  canvasAutoLayout: 'Auto layout',
  canvasQuickAdd: 'Add a node here',
  canvasQuickAddHint: 'Type a name, Enter to place',
  canvasRunNodeShort: 'Run only this node',
  canvasCached: 'cached',
  canvasProgress: 'Running {done}/{total}',
  canvasLibraryToggle: 'Collapse or expand the node library',
  canvasDragHint: 'Drag onto the canvas to place it where you drop it',
  canvasOutputPreview: 'Output preview',
  canvasCloseInspector: 'Close parameters',
  canvasReplaceTemplate: 'Replace the canvas with this template?',
  canvasReplaceImport: 'Replace the canvas with the imported workflow?',
  canvasReplaceTitle: 'Replace canvas',
  canvasReplaceBody: 'The current graph will be replaced. You can undo with Ctrl/Cmd+Z.',
  canvasReplaceConfirm: 'Replace',
  canvasReplaceCancel: 'Cancel',
  modelDefaultTag: 'default',
  modelDefaultHint: 'Default model: ',
  canvasStatusEmpty: 'Empty canvas',
  canvasAdd: 'Add to canvas',
  canvasParams: 'Node parameters',
  canvasFit: 'Fit view',
  canvasEmpty: 'Add nodes from the library on the left',
  canvasPlannedTag: 'not available',
  canvasAutoSave: 'Edits save automatically to this episode\'s workflow',
  canvasLogs: 'Logs',
  canvasMaximize: 'Fullscreen canvas',
  canvasRestore: 'Exit fullscreen',
  paramBrief: 'Creative brief',
  paramScript: 'Copy',
  paramShots: 'Shots',
  paramNote: 'Note',
  paramAsset: 'Asset',
  paramResource: 'Resource',
  paramModel: 'Model',
  paramPrompt: 'Prompt',
  paramRatio: 'Aspect ratio',
  paramDuration: 'Duration (s)',
  paramResolution: 'Resolution',
  paramReferenceVideo: 'Reference video',
  paramRefs: 'Refs (JSON)',
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
  episodeNo: 'Episode no.',
  episodeNoHint: 'Starts at 0; leave blank to keep the current number',
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
  segmentExpand: 'Expand segment',
  segmentCollapse: 'Collapse segment',
  segmentPromptLabel: 'Segment prompt',
  segmentPromptPlaceholder: 'Within these seconds: who, where, what happens…',
  segmentDurationLabel: 'Seconds',
  segmentSkillLabel: 'Select segment skill',
  segmentTextModel: 'Text model for storyboard',
  segmentVideoTooLong: 'One-click video supports up to 30s per segment. Split it into shots first to generate a longer video.',
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
  skillInsert: 'Insert skill',
  skillInsertHint: 'Selected skills appear in the text area; delete the token to show it here again',
  quickTabProduce: 'Content production',
  quickTabPrompt: 'Extract prompts',
  // ---- 快速创作简化版（QUICK-CREATE-REDESIGN v1.2 §4）----
  quickRefsLabel: 'References',
  quickRefsBase: 'Base',
  quickRefsAdd: 'Add',
  quickRefsEmptyHint: 'Drag or click to add · first image becomes the base',
  quickAdvanced: 'Advanced settings',
  quickAdvancedDefaults: 'Current: {model} · {size}',
  quickAdvancedHint: 'Follows host defaults',
  quickGenShortcut: 'Ctrl/⌘ + Enter',
  studioTitle: 'Extract prompts',
  studioDesc: 'Turn each reference into a prompt with your key points, then save it to this episode.',
  studioSkillLabel: 'Reverse skill',
  studioSkillDefault: 'Default Skill',
  studioSources: 'References',
  studioSourcesHint: 'Images and videos from this episode and the global media library; at most 8.',
  studioSourcesEmpty: 'No references yet — add images or videos.',
  studioSourceLimit: 'At most {n} references',
  studioAddSource: 'Add reference',
  studioRulesLabel: 'Extraction key points',
  studioRulesPlaceholder: 'For example: focus on character look, camera language and lighting; ignore watermarks and subtitles.',
  studioModelLabel: 'Text model',
  studioModelEmpty: 'Default (host vision model)',
  studioExtractAction: 'Extract prompts',
  studioExtracting: 'Extracting…',
  studioExtracted: 'Merged {n} prompt segment(s)',
  studioExtractFailed: 'Extraction failed',
  studioExtractCancelled: 'Extraction cancelled — the previous prompt is kept.',
  studioExtractEmpty: 'Nothing usable was extracted. Try another text model or adjust the key points.',
  studioExtractPartial: 'Merged {ok} result(s); {failed} reference(s) failed',
  studioExtractCancel: 'Cancel',
  studioExtractingProgress: 'Extracting {done}/{total}…',
  studioRestoreDraft: 'Restore previous',
  studioDraftCount: '{n} characters',
  studioCopyDraft: 'Copy',
  studioCopied: 'Copied to clipboard',
  studioCopyFailed: 'Could not copy',
  studioClearDraft: 'Clear draft',
  studioClearConfirm: 'Remove all references? The draft is kept.',
  studioSegments: 'Per-reference results ({n})',
  studioSegmentDrop: 'Remove this segment',
  studioRestored: 'Restored {name}',
  studioRemoved: 'Deleted {name}',
  studioUndoRemove: 'Undo',
  studioPromptLoad: 'Load into draft',
  studioPromptCount: '{n} saved',
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
  episodeImport: 'Import episode',
  episodeImportHint: 'Pick the episode.json from "Export this episode"; import always creates a new episode and never overwrites existing ones',
  episodeImportDone: 'Imported as episode {no} · {title}',
  episodeImportFailed: 'Import failed',
  segmentRefsLabel: 'References',
  segmentRefsEmpty: 'No references yet — pick images or videos from the asset library.',
  segmentAddRef: 'Add reference',
  segmentRefSearch: 'Search images or videos',
  segmentRefPickerEmpty: 'No images or videos to add',
  segmentRefImages: 'Images',
  segmentRefVideos: 'Videos',
  segmentGenerateAllImages: 'Generate all images',
  segmentGenerateAllVideos: 'Generate all videos',
  segmentGenerateAllImagesDone: 'Generated {done}/{total} images.',
  segmentGenerateAllVideosDone: 'Queued {done}/{total} videos — follow the task list.',
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
  canvasImportWorkflow: 'Import workflow',
  canvasExportWorkflow: 'Export workflow',
  canvasImportWorkflowDone: 'Workflow imported: {n} nodes',
  canvasImportWorkflowFailed: 'Workflow import failed',
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
  createTabImage: 'Image',
  createTabVideo: 'Video',
  generateRefsModeHint: 'No reference = text-to-image; one or more = image-to-image, first is the base',
  generateRefsPick: 'Choose reference',
  generateRefsDragHint: 'Drag an image here from the asset library or the series resources',
  refPickerSearch: 'Search by name',
  refPickerAssets: 'Asset library',
  refPickerResources: 'Series resources',
  refPickerEmpty: 'No matching images yet',
  refPickerAdded: 'Added',
  videoFirstFrame: 'First frame',
  videoFirstFramePick: 'Choose first frame',
  pipelineToCanvas: 'Build canvas',
  pipelineToCanvasHint: 'Only lays the shots out on the canvas — nothing starts until you run it there',
  pipelineInlineRun: 'Generate video',
  pipelineInlineRunHint: 'Generates the videos shot by shot right here, without opening the canvas',
  pipelineInlineImage: 'Generate images',
  pipelineInlineImageHint: 'Generates the images shot by shot right here, without opening the canvas',
  pipelineInlineImageAria: 'Generate images (shot by shot)',
  pipelineInlineRunAria: 'Generate video (shot by shot)',
  pipelineInlineProgress: 'Inline generation',
  pipelineInlineVideoFailed: 'Shot video failed',
  pipelineInlineVideoCancelled: 'Shot video was cancelled',
  pipelineInlineVideoTimeout: 'Timed out waiting for the shot video',
  pipelineInlineVideoNoOutput: 'The shot video task finished without a file',
  pipelineShotDuration: 'Shot seconds',
  pipelineShotEditable: 'Each shot text and seconds can be edited before generating',
  modelDetails: 'Model details',
  defaultsBuiltinSource: 'Built-in',
  defaultsFollow: 'Follow default',
  defaultSeriesName: 'First series',
  generateRefsHint: 'First image is the base, the rest are style references. Drag a thumbnail to reorder.',
  generateRefsAdd: 'Add selected asset',
  generateRefsFull: 'At most 8 reference images',
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
  clipInspectorEmpty: 'Add a clip to edit its parameters',
  clipInspectorFallback: 'Not selected · showing the first clip',

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

  // ---- 提示词带入（提取提示词页与分镜镜头共用） ----
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
  helpModes: 'Modes',
  helpModeQuick: 'Quick create — generate images or videos right here, with reference images.',
  helpModeWorkflow: 'Workflow — chain script → storyboard → image → video → render on the canvas.',
  helpModeTimeline: 'Timeline — assemble clips, subtitles and audio, then export the film.',
  helpModeScript: 'Script generation — script → episode → segments → shots → images/videos → canvas.',
  helpContactTitle: 'Contact',
  helpContactOrg: 'Beijing Peiji Qizhi Technology Co., Ltd.',
  helpContactWechat: 'WeChat: i-hero — add me and I will invite you to the group',
  helpVersionTitle: 'Version',
  helpVersionUnknown: 'Host not connected',
  helpClose: 'Close',
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
  modelCardsTextModels: 'Available text models',
  modelCardsTextModelsEmpty: 'No text models available.',
  modelCardsTextFailures: 'Some providers could not be listed:',
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
  pipelineManualPick: 'Materials',
  pipelineManualPickHint: 'Tick resources to force them into this run; leave empty to auto-match from the script.',
  pipelineManualPickClear: 'Clear',
  pipelineManualPickCount: '{n} picked',
  pipelineMatchedTitle: 'Matched materials',
  pipelineMatchedItem: '{name} · {kind}',
  exampleProject: 'Example series',
  exampleProjectDone: 'Example series created — try the Quick image template on the canvas.',
  // ---- B-20 分镜合并：文本模型拆解 / 文件导入 / 局部重拆 / 导出落库 ----
  pipelineTextModel: 'Script model',
  pipelineTextModelRules: 'Rules only (no model)',
  pipelineTextModelHint: 'Turns a one-line idea into a script and suggests the three counts; falls back to rules when the model fails.',
  pipelineTextModelMissing: 'No text model available in this host — rules only.',
  pipelineImportScript: 'Import local file',
  pipelineScriptChars: 'Full script: {chars} characters.',
  pipelineImportScriptHint: 'Pick one or more txt / md / docx / pdf scripts',
  pipelineImporting: 'Importing…',
  pipelineImportedLabel: 'Referenced files:',
  pipelineImportRemove: 'Remove',
  pipelineImportFailedShort: 'failed',
  pipelineImportDone: 'Imported {name}',
  pipelineImportFailed: 'Could not import the script file',
  pipelineSkill: 'Skill',
  pipelineSkillHint: 'Pick a skill as many times as you like — each pick adds a token to the script; delete the token to remove it',
  pipelineSkillNone: 'No skill',
  pipelineSkillMissing: 'No director skill available — prompts use the built-in rules.',
  pipelineExport: 'Export storyboard',
  pipelineSaveEpisode: 'Save to this episode',
  pipelineSavedEpisode: 'Saved {n} shots to the episode storyboard',
  pipelineSaveNeedsEpisode: 'Pick an episode first',
  pipelineReplanShot: 'Redo this shot',
  pipelineReplanNoModel: 'Pick a script model to redo a single shot',
  pipelineAddShot: 'Add shot',
  pipelineShotGenerate: 'Generate video',
  pipelineShotImage: 'Generate image',
  pipelineShotToCanvas: 'Open in canvas',
  pipelineSourceModel: 'Shots planned by the script model',
  pipelineSourceRules: 'Shots planned by rules (no model)',
  pipelineEntitiesTitle: 'Character / prop / scene references',
  pipelineEntitiesEmpty: 'No references extracted.',
  pipelineCancel: 'Cancel',
  pipelineCancelled: 'Stopped — nothing was saved.',
  planEpisodeUnit: 'eps',
  planSegmentUnit: 'segs',
  timelineClipDeleted: 'Clip deleted',
  timelineUndo: 'Undo',
  tlAuxTools: 'More tools',
  segPreviewRole: 'Sequential preview · independent playback, does not move the playhead',
  clipInspectorAdvanced: 'More parameters',
  segmentAdvanced: 'Advanced',
  segmentShotUnit: 'shots',
  segmentSummary: '{duration}s · {shots} shots',
  scriptSettings: 'Generation settings',
  episodeMore: 'More actions',
  episodeSyncConfirmTitle: 'Sync this episode to the canvas?',
  episodeSyncConfirmBody: 'The current workflow graph will be rebuilt. This can be undone.',
  episodeSyncUndo: 'Undo sync',
  episodeSyncDone: 'Workflow synced',
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
  modelCardsTextModels: '可用文本模型',
  modelCardsTextModelsEmpty: '暂无可用的文本模型。',
  modelCardsTextFailures: '部分服务商目录不可用：',
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
  pipelineManualPick: '指定物料',
  pipelineManualPickHint: '勾选要强制带进本次生成的物料；不选就按剧本自动匹配。',
  pipelineManualPickClear: '清空',
  pipelineManualPickCount: '已挑 {n} 个',
  pipelineMatchedTitle: '匹配到的物料',
  pipelineMatchedItem: '{name} · {kind}',

  tabTitle: 'Three Video 工作台',
  guideDescription: '图片与视频创作的剧集、媒体素材与生成任务。',
  sectionProject: '剧集',
  pipelineTitle: '一键成片：剧本 → 分镜 → 生图 → 生视频',
  pipelineScriptLabel: '剧本 / 一句话创意',
  pipelineScriptPlaceholder: '雨夜街头，林夏撑伞走来——粘贴整段剧本，或只写一句话创意，模型会补全成剧本。',
  pipelineShots: '分镜数',
  pipelineDuration: '每镜秒数',
  pipelineRunning: '执行中…',
  pipelineStarted: '已起跑',
  pipelineCompose: '生成分镜',
  pipelineComposed: '分镜已生成，可在下面逐条修改',
  pipelinePlanEpisodes: '集数',
  pipelinePlanSegments: '每集段数',
  pipelinePlanShots: '每段分镜数',
  pipelineAuto: '自动',
  pipelineAutoCountsHint: '自动：按剧本文字长度推算这三个数量（选了文本模型则由模型推荐），填好后仍可手动修改',
  pipelineGenerate: '生成剧本',
  pipelineGeneratingScript: '生成中…',
  pipelineGenerateDone: '已写入 {n} 集，可在下面逐级增删',
  pipelineGenerateNeedsSource: '请先在上面写剧本或一句话创意',
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
  modeScript: '剧本生成',
  scriptTabRoles: '角色',
  scriptTabScenes: '场景',
  scriptTabCostumes: '服装',
  scriptTabProps: '道具',
  scriptTabSplit: '剧本分镜',
  scriptTabExtract: '素材提取',
  scriptTabVoice: '音色',
  scriptTabMotion: '轨迹',
  extractKindLabel: '提取什么',
  extractCostumeTitle: '服装提取',
  extractCostumeDesc: '从当前剧本提取所有服装服饰，每条记录款式、颜色、穿着者与配件，可直接用作服装设定图输入。',
  extractCandidates: '提取候选',
  voicePanelTitle: '音色提取',
  voicePanelDesc: '把有台词的角色配成可复用的音色：参考音频、预设音色、语速、音调与情绪，参考 ComfyUI 的零样本克隆节点。',
  voiceExtractPromptLabel: '音色提取提示词',
  voiceExtractPromptPlaceholder: '补充要求，例如只要有台词的角色。输出必须保持为 JSON 数组。',
  voiceExtractRun: '提取音色',
  voiceCardsTitle: '音色卡',
  voiceCardsDesc: '一个说话人一张卡；可存进资源库。TTS 接入前「合成试听」保持禁用。',
  voiceCardsEmpty: '先提取音色或手动添加一张卡，再配置说话人。',
  voiceCardAdd: '添加音色',
  voiceCardUntitled: '未命名音色',
  voiceCardName: '说话人 / 音色名称',
  voiceCardPrompt: '音色描述',
  voiceCardPromptPlaceholder: '这个说话人的性别、年龄、声线、语速与情绪基调。',
  voiceCardVoice: '预设音色',
  voiceCardDefaultVoice: '默认 / 未设置',
  voiceCardSpeed: '语速',
  voiceCardPitch: '音调',
  voiceCardEmotion: '情绪',
  voiceCardEmotionPlaceholder: '如 平静 / 兴奋 / 旁白',
  voiceCardRefAudio: '参考音频',
  voiceCardRefAudioPlaceholder: 'outputs 下的路径，如 outputs/voice-ref.wav',
  voiceCardSave: '存入资源库',
  voiceCardSaved: '音色已保存：{name}',
  voiceCardSynthesize: '试听合成',
  voiceCardSynthesizing: '合成中…',
  voiceCardSynthesized: '合成完成',
  motionPanelTitle: '轨迹提取',
  motionPanelDesc: '从剧本规划运镜：选预设一键生成关键帧，也能逐帧改时间、位置与缩放，并编译成可读的运镜提示词。参考 ComfyUI 的 OmniCam / Camera H3。',
  motionExtractPromptLabel: '轨迹提取提示词',
  motionExtractPromptPlaceholder: '补充要求，例如每个有运动的镜头一条。输出必须保持为 JSON 数组。',
  motionExtractRun: '提取轨迹',
  motionCardsTitle: '轨迹卡',
  motionCardsDesc: '一条运镜一张卡，存为带关键帧的轨迹资源。',
  motionCardsEmpty: '先提取轨迹或手动添加一条，再套用运镜预设。',
  motionCardAdd: '添加轨迹',
  motionCardUntitled: '未命名轨迹',
  motionCardName: '轨迹名称',
  motionCardPreset: '运镜预设',
  motionCardNote: '运镜说明',
  motionCardNotePlaceholder: '这条轨迹的镜头运动、主体位置变化与时长。',
  motionCardSave: '存入资源库',
  motionCardSaved: '轨迹已保存：{name}',
  motionPresetPush: '推进',
  motionPresetPull: '拉远',
  motionPresetPanLeft: '左移',
  motionPresetPanRight: '右移',
  motionPresetTiltUp: '上摇',
  motionPresetTiltDown: '下摇',
  motionPresetOrbit: '环绕',
  motionPresetHold: '固定',
  motionPresetCustom: '自定义',
  motionFramesTitle: '关键帧',
  motionFrameAdd: '加一帧',
  motionFramesEmpty: '还没有关键帧——加一帧或套用预设。',
  motionFrameTime: '时间（毫秒）',
  motionFrameScale: '缩放',
  motionCompiledPrompt: '编译后的运镜提示词',
  extractRoleTitle: '角色提取',
  extractRoleDesc: '从当前集剧本里挑出所有角色；每条都可以加入资源库，作为定妆照与出图引用。',
  extractSceneTitle: '场景提取',
  extractSceneDesc: '从剧本里挑出所有地点与场景；说明带时间、光线与陈设，可直接用于出图提示词。',
  extractPropTitle: '道具·服装提取',
  extractPropDesc: '从剧本里挑出所有道具与服装；服装会写明穿着者。',
  extractRun: '从剧本提取',
  extractRunning: '提取中…',
  extractSource: '来源：当前集剧本',
  extractSourceWithFiles: '来源：当前集剧本 + 导入文件原文',
  extractNeedsScript: '当前集还没有剧本——先到「剧本分镜」写好剧本。',
  extractNeedsModel: '先选一个文本模型，再提取。',
  extractNeedsProject: '先建一个剧集再提取。',
  extractEmpty: '还没有候选——先点「从剧本提取」，再挑要入库的条目。',
  extractAdd: '加入资源库',
  extractAdded: '已加入资源库：{name}',
  extractExisting: '已在资源库',
  scriptSharedInputTitle: '共享剧本输入',
  scriptSharedInputDesc: '四个分区共用这一份剧本与导入文件，按剧集分别保存。',
  extractModelLabel: '提取文本模型',
  extractPromptLabel: '角色提取提示词',
  extractPromptPlaceholder: '补充提取要求，例如：只提取有台词的人物；输出仍按 JSON 数组。',
  roleCardsTitle: '角色列表',
  roleCardsEmpty: '先提取角色，再为每个角色生成定妆照。',
  roleCardDefault: '默认值',
  roleCardApplyDefault: '应用默认值',
  roleCardGenerate: '生成角色图',
  roleCardGenerating: '生成中…',
  roleCardPreview: '查看角色图',
  roleCardGenerated: '角色「{name}」已生成并入库。',
  roleCardNeedsProject: '先选择剧集与本集，再生成角色图。',
  modulePipeline: '剧本 → 分镜',
  modulePipelineDesc: '剧本 → 集 → 分段 → 分镜；每一级都能在下面继续增删、修改。',
  moduleEpisode: '本集工作区',
  moduleEpisodeDesc: '选一集编辑剧本、分段、分镜、生图生视频与工作流；每一集的内容独立归属。',
  scriptStepPlan: '剧本流程',
  scriptStepScript: '写剧本',
  scriptStepSplit: '分段',
  scriptStepStoryboard: '生成分镜',
  scriptStepNow: '下一步',
  scriptStepDone: '已完成',
  scriptStepJump: '跳到这一步',
  scriptStepHintScript: '先写好或粘贴全文，再点「生成剧本」。',
  scriptStepHintSplit: '点「开始分段」把剧本拆成段，每段对应一组镜头。',
  scriptStepHintStoryboard: '逐段点「规划分镜」，再批量生图、生视频。',
  scriptStepAllDone: '三步都已完成：分镜可同步到工作流，素材可加入时间轴。',
  scriptTextModel: '文本模型',
  scriptTextModelEmpty: '未选择',
  scriptImageModel: '图像模型',
  scriptVideoModel: '视频模型',
  scriptDirectorSkill: '选择分段技能',
  scriptFollowDefault: '跟随默认',
  scriptSplit: '开始分段',
  scriptSplitting: '分段中…',
  scriptSplitHint: '用默认规则或所选文本模型把剧本拆成分段',
  scriptSplitMode: '分段方式',
  scriptSplitModeRule: '默认规则',
  scriptSplitModeModel: '调用大模型',
  episodeScriptJump: '跳到分段',
  episodeScriptAll: '全部内容',
  scriptSplitNeedsModel: '宿主没有提供文本模型，无法用大模型分段。',
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
  refZoom: '放大查看',

  generateHeading: '直接生成',
  generatePromptLabel: '提示词',
  generatePromptPlaceholder: '描述你想要的画面…',
  generateImage: '生成图片',
  generateVideo: '生成视频',
  generating: '生成中…',
  generateCancel: '取消生成',
  generateCancelling: '取消中…',
  generateCancelled: '已取消生成',
  generateCannotCancel: '宿主没有可取消的任务（这条生成已不可中断）',
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
  previewExpand: '放大预览',
  previewShrink: '还原预览',
  previewPlay: '在预览里播放视频',
  refPreview: '在预览区查看',
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
  defaultsStripHint: '生成时自动套用',
  defaultsGroupMode: '媒体类型',
  defaultsGroupImage: '图像',
  defaultsGroupVideo: '视频',
  defaultsGroupText: '文本',
  defaultsTextModelHint: '选择后立即生效，保存默认值无需包含此项。',
  defaultTextModel: '文本模型',
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
  exportSpecHint: '成片的实际尺寸与帧率；改上面的参数会立刻更新',
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
  nodeExternal: '外部节点',
  paramExternalClass: '原始类型',
  paramExternalConfig: '原始配置（JSON）',
  externalNotRunnable: '来自 ComfyUI / LiblibAI 工作流，保留供查看，本项目不运行它',
  canvasExternalTag: '外部',
  canvasPalette: '节点库',
  canvasLibraryHint: '搜索节点',
  canvasLibraryEmpty: '没有匹配的节点',
  canvasGroupInput: '输入与文案',
  canvasGroupStory: '分镜与素材',
  canvasGroupGenerate: '生成',
  canvasGroupFinishPlanned: '后期与交付（规划中）',
  canvasNoExecutorTag: '不执行',
  canvasNoExecutorHint: '该节点可加入画布并保存，但本版本没有执行器；运行时会跳过，不产出结果。',
  canvasGroupPlanned: '预留能力',
  canvasOnboardingTitle: '选一个模板，立刻跑通整条链路',
  canvasOnboardingHint: '模板自带示例文案与参数，改几个字就能跑。',
  canvasOnboardingBlank: '从空白画布开始',
  canvasOnboardingImport: '导入 ComfyUI / LiblibAI 工作流',
  canvasOnboardingNodes: '{n} 个节点',
  canvasAutoLayout: '自动排列',
  canvasQuickAdd: '在这里加节点',
  canvasQuickAddHint: '输入名字，回车放置',
  canvasRunNodeShort: '只跑这个节点',
  canvasCached: '缓存',
  canvasProgress: '运行中 {done}/{total}',
  canvasLibraryToggle: '收起 / 展开节点库',
  canvasDragHint: '拖到画布上，松手即落在落点',
  canvasOutputPreview: '产出预览',
  canvasCloseInspector: '关闭参数面板',
  canvasReplaceTemplate: '用这张模板替换当前画布？',
  canvasReplaceImport: '用导入的工作流替换当前画布？',
  canvasReplaceTitle: '替换画布',
  canvasReplaceBody: '当前节点图会被替换。可用 Ctrl/Cmd+Z 撤销。',
  canvasReplaceConfirm: '替换',
  canvasReplaceCancel: '取消',
  modelDefaultTag: '默认',
  modelDefaultHint: '默认模型：',
  canvasStatusEmpty: '空画布',
  canvasAdd: '加入画布',
  canvasParams: '节点参数',
  canvasFit: '适配窗口',
  canvasEmpty: '从左侧节点库添加节点',
  canvasPlannedTag: '未提供',
  canvasAutoSave: '改动自动保存到本集工作流',
  canvasLogs: '工作日志',
  canvasMaximize: '全屏画布',
  canvasRestore: '退出全屏',
  paramBrief: '创作诉求',
  paramScript: '文案',
  paramShots: '分镜数',
  paramNote: '备注',
  paramAsset: '素材',
  paramResource: '资源',
  paramModel: '模型',
  paramPrompt: '提示词',
  paramRatio: '比例',
  paramDuration: '时长（秒）',
  paramResolution: '分辨率',
  paramReferenceVideo: '参考视频',
  paramRefs: '引用（JSON）',
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
  episodeNo: '集号',
  episodeNoHint: '从 0 起；留空沿用当前集号',
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
  segmentExpand: '展开',
  segmentCollapse: '收起',
  segmentPromptLabel: '分段提示词',
  segmentPromptPlaceholder: '这几秒里：谁、在哪、发生什么…',
  segmentDurationLabel: '秒数',
  segmentSkillLabel: '选择分段技能',
  segmentTextModel: '分镜文本模型',
  segmentVideoTooLong: '一键生成视频只支持 30 秒以内的分段；超过 30 秒请先生成分镜，再逐镜生成视频。',
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
  skillInsert: '插入 Skill',
  skillInsertHint: '选中后插入文本区；在文本区删掉标记后会重新出现在这里',
  quickTabProduce: '内容生产',
  quickTabPrompt: '提取提示词',
  // ---- 快速创作简化版（QUICK-CREATE-REDESIGN v1.2 §4）----
  quickRefsLabel: '参考图',
  quickRefsBase: '底图',
  quickRefsAdd: '添加',
  quickRefsEmptyHint: '拖拽或点击添加参考图 · 首张图作为底图',
  quickAdvanced: '高级参数',
  quickAdvancedDefaults: '当前：{model} · {size}',
  quickAdvancedHint: '跟随宿主默认',
  quickGenShortcut: 'Ctrl/⌘ + Enter',
  studioTitle: '提取提示词',
  studioDesc: '按提取要点把每一份引用转成提示词，再存入本集提示词库。',
  studioSkillLabel: '逆向 Skill',
  studioSkillDefault: '默认 Skill',
  studioSources: '引用素材',
  studioSourcesHint: '来自本集素材与全局素材的图片或视频；最多 8 个。',
  studioSourcesEmpty: '还没有引用——添加图片或视频。',
  studioSourceLimit: '最多选择 {n} 个素材',
  studioAddSource: '添加引用',
  studioRulesLabel: '提取要点',
  studioRulesPlaceholder: '例如：重点描述人物外观、镜头语言与光影；忽略水印与字幕。',
  studioModelLabel: '文本模型',
  studioModelEmpty: '默认（宿主视觉模型）',
  studioExtractAction: '提取提示词',
  studioExtracting: '提取中…',
  studioExtracted: '已合并 {n} 段结果',
  studioExtractFailed: '提取失败',
  studioExtractCancelled: '已取消提取，草稿保持原样。',
  studioExtractEmpty: '没有提取到可用内容：换一个文本模型或调整提取要点再试。',
  studioExtractPartial: '已合并 {ok} 段；{failed} 个素材失败',
  studioExtractCancel: '取消',
  studioExtractingProgress: '提取中 {done}/{total}…',
  studioRestoreDraft: '恢复上一版',
  studioDraftCount: '{n} 字',
  studioCopyDraft: '复制',
  studioCopied: '已复制到剪贴板',
  studioCopyFailed: '复制失败',
  studioClearDraft: '清空草稿',
  studioClearConfirm: '确定清空全部引用？草稿会保留。',
  studioSegments: '分段结果（{n}）',
  studioSegmentDrop: '移除这一段',
  studioRestored: '已恢复 {name}',
  studioRemoved: '已删除 {name}',
  studioUndoRemove: '撤销',
  studioPromptLoad: '载入草稿',
  studioPromptCount: '共 {n} 条',
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
  studioLoadFailed: '提取提示词读取失败',
  shotRefAdd: '为本镜选择图片 / 视频',
  episodeSyncWorkflow: '同步到工作流',
  episodeSyncWorkflowDone: '分镜已同步到 {name}',
  episodeSyncWorkflowFailed: '同步失败',
  episodeExport: '导出本集',
  episodeExportDone: '本集已导出到 {path}',
  episodeExportFailed: '导出失败',
  episodeImport: '导入本集',
  episodeImportHint: '选择「导出本集」生成的 episode.json；导入会新建一集，不覆盖现有内容',
  episodeImportDone: '已导入为第{no}集 · {title}',
  episodeImportFailed: '导入失败',
  segmentRefsLabel: '引用',
  segmentRefsEmpty: '还没有引用——从素材库挑图片或视频。',
  segmentAddRef: '添加引用',
  segmentRefSearch: '搜索图片或视频',
  segmentRefPickerEmpty: '没有可添加的图片或视频',
  segmentRefImages: '图片',
  segmentRefVideos: '视频',
  segmentGenerateAllImages: '一键生成图片',
  segmentGenerateAllVideos: '一键生成视频',
  segmentGenerateAllImagesDone: '已生成 {done}/{total} 张图片。',
  segmentGenerateAllVideosDone: '已提交 {done}/{total} 个视频任务，去任务列表看进度。',
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
  canvasImportWorkflow: '导入工作流',
  canvasExportWorkflow: '导出工作流',
  canvasImportWorkflowDone: '工作流已导入 · {n} 个节点',
  canvasImportWorkflowFailed: '工作流导入失败',
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
  pipelineToCanvas: '生成画布',
  pipelineToCanvasHint: '只把分镜铺到画布，不开始生成；你在画布确认后再点生成',
  pipelineInlineRun: '生成视频',
  pipelineInlineRunHint: '不跳画布，直接按分镜逐镜出视频',
  pipelineInlineImage: '生成图片',
  pipelineInlineImageHint: '不跳画布，直接按分镜逐镜出图片',
  pipelineInlineImageAria: '生成图片（按分镜逐镜）',
  pipelineInlineRunAria: '生成视频（按分镜逐镜）',
  pipelineInlineProgress: '就地生成进度',
  pipelineInlineVideoFailed: '本镜视频生成失败',
  pipelineInlineVideoCancelled: '本镜视频已取消',
  pipelineInlineVideoTimeout: '等本镜视频超时',
  pipelineInlineVideoNoOutput: '本镜视频任务结束但没有产物文件',
  pipelineShotDuration: '本镜时长(秒)',
  pipelineShotEditable: '分镜可以逐条改内容与时长',
  modelDetails: '模型详情',
  defaultsBuiltinSource: '内置默认',
  defaultsFollow: '跟随默认',
  defaultSeriesName: '三视剧集',
  generateRefsHint: '首图为底图，其余作风格参考；拖拽缩略图可调整顺序',
  generateRefsAdd: '加入选中素材',
  createTabImage: '生图',
  createTabVideo: '生视频',
  generateRefsModeHint: '不带参考图 = 文生图；带 1 张以上 = 图生图，首图为底图',
  generateRefsPick: '选择参考图',
  generateRefsDragHint: '把素材库或剧集资源里的图片拖到这里',
  refPickerSearch: '按名称搜索',
  refPickerAssets: '素材库',
  refPickerResources: '剧集资源',
  refPickerEmpty: '还没有可选的图片',
  refPickerAdded: '已加入',
  videoFirstFrame: '首帧',
  videoFirstFramePick: '选择首帧',
  generateRefsFull: '最多 8 张参考图',
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
  clipInspectorEmpty: '添加片段后即可编辑参数',
  clipInspectorFallback: '未选中 · 当前展示第 1 段',

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

  // ---- 提示词带入（提取提示词页与分镜镜头共用） ----
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
  helpModes: '模式说明',
  helpModeQuick: '快速创作——就在这里生成图片或视频，可带多张参考图。',
  helpModeWorkflow: '工作流——在画布上串起 剧本→分镜→生图→视频→导出。',
  helpModeTimeline: '时间轴——组装片段、字幕与音轨，然后导出成片。',
  helpModeScript: '剧本生成——剧本 → 集 → 分段 → 分镜 → 出图/出视频 → 导进画布；',
  helpContactTitle: '联系方式',
  helpContactOrg: '北京培基启智科技有限公司',
  helpContactWechat: '微信：i-hero，加好友然后拉你入群',
  helpVersionTitle: '版本',
  helpVersionUnknown: '未连接宿主',
  helpClose: '关闭',
  exampleProject: '示例剧集',
  exampleProjectDone: '示例剧集已建好——去画布试试「快速图片」模板。',
  // ---- B-20 分镜合并：文本模型拆解 / 文件导入 / 局部重拆 / 导出落库 ----
  pipelineTextModel: '剧本模型',
  pipelineTextModelRules: '只用规则（不调模型）',
  pipelineTextModelHint: '一句话创意由模型扩写成剧本，并推荐三级数量；模型失败时回落到内置规则。',
  pipelineTextModelMissing: '当前宿主没有可用的文本模型——只能走规则拆解。',
  pipelineImportScript: '导入本地文件',
  pipelineScriptChars: '全文 {chars} 字',
  pipelineImportScriptHint: '可一次选多个 txt / md / docx / pdf 剧本',
  pipelineImporting: '导入中…',
  pipelineImportedLabel: '已引用文件：',
  pipelineImportRemove: '移除',
  pipelineImportFailedShort: '解析失败',
  pipelineImportDone: '已导入 {name}',
  pipelineImportFailed: '剧本文件导入失败',
  pipelineSkill: '技能',
  pipelineSkillHint: '可多次选择导演技能：每选一次就往剧本里追加一个技能标记，删掉标记即取消',
  pipelineSkillNone: '不使用技能',
  pipelineSkillMissing: '技能库里没有导演技能——提示词按内置规则生成。',
  pipelineExport: '导出分镜表',
  pipelineSaveEpisode: '保存到本集分镜',
  pipelineSavedEpisode: '已把 {n} 镜保存到本集分镜',
  pipelineSaveNeedsEpisode: '请先选一集',
  pipelineReplanShot: '重拆这一镜',
  pipelineReplanNoModel: '重拆单镜需要先选一个剧本模型',
  pipelineAddShot: '添加一镜',
  pipelineShotGenerate: '生成视频',
  pipelineShotImage: '生成图片',
  pipelineShotToCanvas: '在画布打开',
  pipelineSourceModel: '分镜由剧本模型拆解',
  pipelineSourceRules: '分镜由规则拆解（未用模型）',
  pipelineEntitiesTitle: '角色 / 道具 / 场景参考',
  pipelineEntitiesEmpty: '没有抽取到实体。',
  pipelineCancel: '取消',
  pipelineCancelled: '已停止，没有保存任何东西。',
  planEpisodeUnit: '集',
  planSegmentUnit: '段',
  timelineClipDeleted: '已删除片段',
  timelineUndo: '撤销',
  tlAuxTools: '辅助工具',
  segPreviewRole: '顺序预览·独立播放，不影响播放头',
  clipInspectorAdvanced: '更多参数',
  segmentAdvanced: '高级设置',
  segmentShotUnit: '镜',
  segmentSummary: '{duration}s · {shots} 镜',
  scriptSettings: '生成设置',
  episodeMore: '更多操作',
  episodeSyncConfirmTitle: '同步本集到画布？',
  episodeSyncConfirmBody: '当前工作流画布会被重建，操作可撤销。',
  episodeSyncUndo: '撤销同步',
  episodeSyncDone: '已同步到工作流',
}
