/**
 * 首次使用引导覆盖层的文案（自有 locale 命名空间 `image-video-guide`）。
 *
 * 为什么单独开一个 namespace 而不是塞进 `locales.ts`：引导层是**独立安装后的第一屏**，
 * 它要在工作台界面 chunk 之外也能被单独注册/替换；而且 `locales.ts` 的键名是工作台
 * 主面板在用的，混进去会让「哪个键属于哪一屏」失去边界（任务里也明确要求不重复键名）。
 *
 * zh / en 必须全量对齐：`GuideLocaleKey` 是联合类型，`Record<GuideLocaleKey, string>`
 * 会让任一语言缺键在编译期直接报错，避免运行时回退到键名本身（用户看到 `step1Title`）。
 *
 * @module dsh-image-video/client/screens/guide-locales
 */

/** 引导层专属 locale namespace。宿主注册字典时用这个键。 */
export const GUIDE_NS = 'image-video-guide'

/** 引导层文案键。全量：标题 / 三步 / 每个状态 chip / 按钮 / 无障碍标签。 */
export type GuideLocaleKey =
  | 'title'
  | 'subtitle'
  | 'stepConnect'
  | 'stepEnv'
  | 'stepDefaults'
  | 'step1Title'
  | 'step1Desc'
  | 'connectAccount'
  | 'connectApiKey'
  | 'connectDone'
  | 'connectPending'
  | 'step2Title'
  | 'step2Desc'
  | 'ffmpegChecking'
  | 'ffmpegOk'
  | 'ffmpegMissing'
  | 'ffmpegMissingHint'
  | 'outputsDirLabel'
  | 'outputsUnset'
  | 'change'
  | 'step3Title'
  | 'step3Desc'
  | 'imageModelLabel'
  | 'videoModelLabel'
  | 'imageSizeLabel'
  | 'noModels'
  | 'enterWorkbench'
  | 'later'
  | 'stepDone'
  | 'stepPending'
  | 'envReady'
  | 'envNeedsWork'
  | 'escHint'

/** 中文文案（默认语言）。 */
export const zh: Record<GuideLocaleKey, string> = {
  title: '开始创作',
  subtitle: '三步就能出第一张图。装好即可用，不需要改配置文件。',

  stepConnect: '连接',
  stepEnv: '环境',
  stepDefaults: '默认值',
  step1Title: '连接模型服务',
  step1Desc: '两条路都可以：用账号登录自动领取 Key，或粘贴你自己的 API Key。',
  connectAccount: '用账号登录',
  connectApiKey: '填 API Key',
  connectDone: '已连接',
  connectPending: '待连接',

  step2Title: '环境检查',
  step2Desc: '图片与视频生成不依赖本机环境；导出成片需要 ffmpeg，产物会写进输出目录。',
  ffmpegChecking: 'ffmpeg 检测中',
  ffmpegOk: 'ffmpeg 已检测到',
  ffmpegMissing: '未找到 ffmpeg',
  ffmpegMissingHint: '没有 ffmpeg 也能生成图片与视频，只是暂时无法导出成片。装好后回来再检查一次。',
  outputsDirLabel: '输出目录',
  outputsUnset: '未设置',
  change: '改',

  step3Title: '选默认模型与尺寸',
  step3Desc: '之后每次生成都从这里取默认值，随时可以在顶栏「参数条」里改。',
  imageModelLabel: '默认图片模型',
  videoModelLabel: '默认视频模型',
  imageSizeLabel: '默认图片尺寸',
  noModels: '暂无可用模型（先连接服务）',
  enterWorkbench: '进入工作台',

  later: '稍后再说',
  stepDone: '已完成',
  stepPending: '待完成',
  envReady: '环境就绪',
  envNeedsWork: '需要处理',
  escHint: 'Esc 关闭',
}

/** 英文文案。键集合必须与中文一致（类型保证）。 */
export const en: Record<GuideLocaleKey, string> = {
  title: 'Start creating',
  subtitle: 'Three steps to your first image. It works once installed - no config files to edit.',

  stepConnect: 'Connect',
  stepEnv: 'Environment',
  stepDefaults: 'Defaults',
  step1Title: 'Connect a model service',
  step1Desc: 'Either path works: sign in to get a key automatically, or paste your own API key.',
  connectAccount: 'Sign in',
  connectApiKey: 'Enter API key',
  connectDone: 'Connected',
  connectPending: 'Not connected',

  step2Title: 'Environment check',
  step2Desc: 'Generation itself needs no local setup; exporting a finished video needs ffmpeg. Outputs are written to the outputs folder.',
  ffmpegChecking: 'Checking ffmpeg',
  ffmpegOk: 'ffmpeg detected',
  ffmpegMissing: 'ffmpeg not found',
  ffmpegMissingHint: 'Images and videos still generate without ffmpeg - only finished-video export is unavailable. Install it and check again.',
  outputsDirLabel: 'Outputs folder',
  outputsUnset: 'Not set',
  change: 'Change',

  step3Title: 'Pick default model and size',
  step3Desc: 'Every generation starts from these defaults; the parameter strip in the header can override them anytime.',
  imageModelLabel: 'Default image model',
  videoModelLabel: 'Default video model',
  imageSizeLabel: 'Default image size',
  noModels: 'No models available yet (connect a service first)',
  enterWorkbench: 'Enter workbench',

  later: 'Later',
  stepDone: 'Done',
  stepPending: 'Pending',
  envReady: 'Environment ready',
  envNeedsWork: 'Needs attention',
  escHint: 'Esc to close',
}
