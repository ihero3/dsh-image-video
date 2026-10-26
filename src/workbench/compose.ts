/**
 * 融合生图参数化（`B-3` / 竞品对标 P1-2）：**姿态 × 镜头 × 裁剪**。
 *
 * 背景：融合生图（`media/compose`）此前只能「角色/场景/物品参考图 + 提示词」，
 * 出来的镜头可不可用基本靠运气。竞品的差异点就在这三件事：
 * - **姿态**：站/坐/走/跑/打斗/施法……决定人物在画面里"在干什么"；
 * - **镜头类别**：全景/中景/近景/俯拍/仰拍……决定"怎么拍"；
 * - **场景裁剪**：只保留场景图里真正要用的那一块，避免模型被无关区域带偏。
 *
 * 本模块只做**纯函数**（拆分/校验/拼词），不碰网络与模型：
 * - 预设是**稳定 id + 提示词片段**，界面只传 id（文案由 `labelKey` 交给 locale）；
 * - 裁剪用归一化坐标（0..1），与画布缩放无关；
 * - 拼词顺序固定：用户提示词 → 主体（角色/场景/物品）→ 姿态 → 镜头 → 风格，便于复现与单测。
 *
 * @module dsh-image-video/workbench/compose
 */

/** 一个可复用的创作预设（姿态/镜头共用一套结构）。 */
export interface ComposePreset {
  /** 稳定 id：界面/接口只传它。 */
  readonly id: string
  /** 界面文案 key（由客户端 locale 提供中文/英文）。 */
  readonly labelKey: string
  /** 追加到提示词的片段（英文为主：三家服务商对英文动作词更稳）。 */
  readonly promptFragment: string
}

/** 姿态预设（人物"在干什么"）。 */
export const POSE_PRESETS: readonly ComposePreset[] = [
  { id: 'standing', labelKey: 'poseStanding', promptFragment: 'standing naturally, full body visible, relaxed posture' },
  { id: 'sitting', labelKey: 'poseSitting', promptFragment: 'sitting down, upper body and hands visible' },
  { id: 'walking', labelKey: 'poseWalking', promptFragment: 'walking forward, mid-stride, natural arm swing' },
  { id: 'running', labelKey: 'poseRunning', promptFragment: 'running, dynamic motion, sense of speed' },
  { id: 'fighting', labelKey: 'poseFighting', promptFragment: 'fighting stance, action pose, dynamic angle' },
  { id: 'casting', labelKey: 'poseCasting', promptFragment: 'casting spell, one hand raised, glowing effect around hand' },
  { id: 'looking-up', labelKey: 'poseLookingUp', promptFragment: 'looking up, head tilted slightly, eyes toward camera' },
  { id: 'back-view', labelKey: 'poseBackView', promptFragment: 'seen from behind, back to camera, head turned slightly' },
] as const

/** 镜头类别预设（"怎么拍"）。 */
export const LENS_PRESETS: readonly ComposePreset[] = [
  { id: 'wide', labelKey: 'lensWide', promptFragment: 'wide shot, full scene visible, subject small in frame' },
  { id: 'medium', labelKey: 'lensMedium', promptFragment: 'medium shot, waist up, subject centered' },
  { id: 'closeup', labelKey: 'lensCloseup', promptFragment: 'close-up, face fills the frame, shallow depth of field' },
  { id: 'extreme-closeup', labelKey: 'lensExtremeCloseup', promptFragment: 'extreme close-up on eyes and expression' },
  { id: 'high-angle', labelKey: 'lensHighAngle', promptFragment: 'high angle, camera looking down at subject' },
  { id: 'low-angle', labelKey: 'lensLowAngle', promptFragment: 'low angle, camera looking up, subject appears imposing' },
  { id: 'overhead', labelKey: 'lensOverhead', promptFragment: 'overhead top-down shot, bird eye view' },
] as const

/** 归一化裁剪框（0..1，相对场景图宽高）。 */
export interface ComposeCrop {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 裁剪框下限（太小的框没有信息量，直接拒绝而不是出一个糊图）。 */
const MIN_CROP_SIDE = 0.05

/** 按 id 查预设。 */
function findPreset(presets: readonly ComposePreset[], id: string | undefined): ComposePreset | undefined {
  if (id === undefined || id === '') return undefined
  return presets.find(preset => preset.id === id)
}

/**
 * 校验并规范化裁剪框。
 * @param raw - 原始输入（可能来自 JSON，字段类型不可信）。
 * @returns 规范化后的裁剪框；输入为空时返回 undefined。
 * @throws {Error} 字段缺失/非数字/超出 0..1/宽高过小时，给出可操作错误。
 */
export function normalizeComposeCrop(raw: unknown): ComposeCrop | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object') throw new Error('cropScene 必须是 {x,y,width,height}（0..1 归一化坐标）')
  const value = raw as Record<string, unknown>
  const read = (key: keyof ComposeCrop): number => {
    const candidate = value[key]
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error(`cropScene.${key} 必须是有限数字（0..1 归一化坐标）`)
    }
    return candidate
  }
  const crop: ComposeCrop = { x: read('x'), y: read('y'), width: read('width'), height: read('height') }
  if (crop.x < 0 || crop.y < 0 || crop.x + crop.width > 1.0001 || crop.y + crop.height > 1.0001) {
    throw new Error('cropScene 超出画面：x/width、y/height 必须落在 0..1 内')
  }
  if (crop.width < MIN_CROP_SIDE || crop.height < MIN_CROP_SIDE) {
    throw new Error(`cropScene 裁剪框太小（宽高至少 ${MIN_CROP_SIDE}）：请框出真正要用的区域`)
  }
  return crop
}

/** 参与拼词的主体资源（只取展示需要的字段）。 */
export interface ComposeSubject {
  readonly kind: string
  readonly name: string
  readonly note?: string
}

/**
 * 拼装融合生图的最终提示词。
 *
 * 顺序固定，便于复现与测试：`用户提示词 → 主体清单 → 姿态 → 镜头 → 附加风格`。
 * @param input - 用户提示词、选中的预设 id、主体资源、可选风格约束。
 * @returns 多行提示词。
 * @throws {Error} 传了未知的 pose/lens id（拼错 id 要响亮失败，而不是静默丢参数）。
 */
export function buildComposePrompt(input: {
  readonly prompt: string
  readonly pose?: string
  readonly lens?: string
  readonly subjects?: readonly ComposeSubject[]
  readonly styleNote?: string
}): string {
  const pose = findPreset(POSE_PRESETS, input.pose)
  if (input.pose !== undefined && input.pose !== '' && pose === undefined) {
    throw new Error(`未知姿态「${input.pose}」：可选 ${POSE_PRESETS.map(preset => preset.id).join('、')}`)
  }
  const lens = findPreset(LENS_PRESETS, input.lens)
  if (input.lens !== undefined && input.lens !== '' && lens === undefined) {
    throw new Error(`未知镜头类别「${input.lens}」：可选 ${LENS_PRESETS.map(preset => preset.id).join('、')}`)
  }

  const lines: string[] = [input.prompt.trim()]
  for (const subject of input.subjects ?? []) {
    const note = subject.note === undefined || subject.note.trim() === '' ? '' : `：${subject.note.trim()}`
    lines.push(`${subject.kind}「${subject.name}」${note}`)
  }
  if (pose !== undefined) lines.push(`姿态（pose）：${pose.promptFragment}`)
  if (lens !== undefined) lines.push(`镜头（camera）：${lens.promptFragment}`)
  if (input.styleNote !== undefined && input.styleNote.trim() !== '') lines.push(`风格：${input.styleNote.trim()}`)
  return lines.filter(line => line !== '').join('\n')
}
