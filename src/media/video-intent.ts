/**
 * 视频意图（`B-4`）：把「生成 / 编辑 / **续写**」变成显式语义，而不是靠参数组合猜。
 *
 * 背景：参考视频此前只有一种解释——「视频编辑」（改内容、保留原片动作）。但创作者真正
 * 高频的第二个动作是**续写**（把已有镜头往后接，人物/场景/风格保持一致）。两者都传
 * `media: [{video, type:'reference_video'}]`，光看参数无法区分，于是：
 * - 工具无法给出正确的 `mode` 回报、无法选默认时长、无法把"续写要求"写进提示词；
 * - 界面也无法用一句人话解释这次到底在干什么。
 *
 * 因此新增显式入参 `continuation: true`，由本模块统一推导：模式、默认时长、续写提示词、
 * 以及"续写必须有参考视频"的校验（缺了就响亮报错，不静默降级成普通生成）。
 *
 * @module dsh-image-video/media/video-intent
 */

/** 一次视频生成的语义模式（工具输出 `mode` 的取值域）。 */
export type VideoMode = 'text-to-video' | 'image-to-video' | 'video-edit' | 'video-continue'

/**
 * 推导本次生成的模式。
 * 优先级：续写 > 参考视频编辑 > 图生视频 > 文生视频。
 * @param input - 是否显式续写、是否有参考视频、是否有首帧图。
 * @returns 模式字符串（写入工具输出，界面据此显示"这是续写/编辑/图生/文生"）。
 */
export function videoMode(input: {
  readonly continuation: boolean
  readonly hasRefVideo: boolean
  readonly hasImage: boolean
}): VideoMode {
  if (input.continuation) return 'video-continue'
  if (input.hasRefVideo) return 'video-edit'
  return input.hasImage ? 'image-to-video' : 'text-to-video'
}

/**
 * 校验"续写"的硬前提。
 * @param input - 是否续写、是否有参考视频。
 * @throws {Error} 声明续写但没有参考视频时，给出可操作错误（告诉用户该传什么）。
 */
export function assertContinuation(input: { readonly continuation: boolean; readonly hasRefVideo: boolean }): void {
  if (!input.continuation) return
  if (input.hasRefVideo) return
  throw new Error(
    '续写需要参考视频：请在 media 里传 {video: "<原片路径>", type: "reference_video"}'
    + '（工具会保留原片的人物/场景/镜头并往后接；只想改原片内容请改用「视频编辑」）',
  )
}

/**
 * 续写时的默认时长。
 * - 显式传了时长就用它（1–30 秒，`-1` 表示保持原片时长）；
 * - 没传则用 `-1`（由服务端按原片时长续写，避免"续 3 秒把长镜头截断"）。
 * @param input - 显式时长与是否续写。
 * @returns 实际使用的时长。
 */
export function resolveVideoDuration(input: {
  readonly continuation: boolean
  readonly explicit?: number
  readonly fallback: number
}): number {
  if (input.explicit !== undefined) return input.explicit
  return input.continuation ? -1 : input.fallback
}

/** 续写时追加到用户提示词后的固定要求（保持一致性，避免模型另起一个镜头）。 */
const CONTINUATION_GUIDANCE = '续写要求：紧接参考视频的最后一帧继续，保持人物外观、服装、场景、镜头运动与画风一致，不要重新起镜或切换场景。'

/**
 * 拼出续写用的最终提示词。
 * 用户已经写了"续/接/继续"等字样时不重复追加，避免提示词啰嗦。
 * @param input - 用户提示词与是否续写。
 * @returns 最终提示词。
 */
export function composeVideoPrompt(input: { readonly prompt: string; readonly continuation: boolean }): string {
  const prompt = input.prompt.trim()
  if (!input.continuation) return prompt
  if (/续写|继续|接着|接上|continu(e|ation)/iu.test(prompt)) return prompt
  return prompt === '' ? CONTINUATION_GUIDANCE : `${prompt}\n${CONTINUATION_GUIDANCE}`
}
