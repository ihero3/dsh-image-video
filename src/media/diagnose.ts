/**
 * 渲染失败的诊断建议（Track A / A88）。
 *
 * 问题：导出失败只给错误码 + 一句话 ✗ —— 用户（和 Agent）知道"错了"，但**不知道下一步做什么** ✗。
 * 这里把错误码翻成"人话 + 可执行动作"，让自助修复成为可能。
 */

/** 一条诊断建议。 */
export interface Diagnosis {
  /** 错误码（原样保留，便于程序判断）。 */
  readonly code: string
  /** 一句话结论。 */
  readonly title: string
  /** 为什么/怎么判断出来的。 */
  readonly hint: string
  /** 建议动作（按优先级，界面可渲染成按钮/Agent 可逐个尝试）。 */
  readonly actions: readonly string[]
}

const KNOWN: Record<string, Omit<Diagnosis, 'code'>> = {
  MEDIA_TIMELINE_EMPTY: {
    title: '时间轴的视频轨是空的',
    hint: '导出需要一个完整的视频时间轴，目前没有任何可渲染的片段。',
    actions: ['先往视频轨加入至少一个片段', '或在素材面板选一个成片作为起点'],
  },
  MEDIA_TIMELINE_OVERLAP: {
    title: '视频轨上的片段有重叠',
    hint: '两个片段在时间上交叉（同一时刻有两条视频），导出无法决定盖哪个。',
    actions: ['用 trim 把后一个片段的起点推后', '或用 drop-clip 移掉多余片段', '或先跑 timelines/validate 定位具体片段'],
  },
  MEDIA_ASSET_MISSING: {
    title: '有片段引用的素材不存在了',
    hint: '素材文件被移动/删除，或从未真正生成成功。',
    actions: ['用 timelines/validate 定位是哪个片段', '重新生成该素材并 attach', '或把该片段换成已有素材'],
  },
  MEDIA_FFMPEG_UNAVAILABLE: {
    title: '找不到可用的 ffmpeg',
    hint: '导出依赖 ffmpeg，宿主没有找到可执行文件。',
    actions: ['安装 ffmpeg（brew install ffmpeg）', '或设置环境变量 DSH_FFMPEG_PATH 指向可执行文件', '然后调用 media/ffmpeg 确认可用'],
  },
  MEDIA_FFMPEG_ENCODER_MISSING: {
    title: 'ffmpeg 缺少所需的编码器',
    hint: '当前 ffmpeg 构建里没有 libx264 / aac 等必要编码器。',
    actions: ['换成完整构建的 ffmpeg（含 libx264）', '或用 DSH_FFMPEG_PATH 指向完整版'],
  },
  MEDIA_OUTPUT_INVALID: {
    title: '导出没有产生有效文件',
    hint: 'ffmpeg 跑完了但输出为空或损坏，常见于磁盘满、权限不足或中途被杀。',
    actions: ['检查磁盘剩余空间与输出目录权限', '重试一次（timelines/render-retry）', '若反复失败，导出诊断（diagnostics）看宿主日志'],
  },
}

/**
 * 把错误码翻译成诊断建议。
 * @param code - `RenderError.code`（未知码走通用建议）。
 * @param message - 原始错误消息（附在 hint 尾部便于排查）。
 * @returns 诊断建议。
 */
export function diagnoseRenderError(code: string | undefined, message?: string): Diagnosis {
  const known = code === undefined ? undefined : KNOWN[code]
  const raw = message === undefined || message.trim() === '' ? undefined : message.trim()
  if (known !== undefined) {
    return { code: code as string, ...known, hint: raw === undefined ? known.hint : `${known.hint}（原始信息：${raw}）` }
  }
  return {
    code: code ?? 'UNKNOWN',
    title: '导出失败',
    hint: raw === undefined ? '没有拿到具体原因。' : `原始信息：${raw}`,
    actions: ['先重试一次（瞬时失败很常见：timelines/render-retry）', '仍失败则跑 timelines/validate 与 diagnostics 收集线索'],
  }
}
