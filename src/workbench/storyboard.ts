/**
 * Script → storyboard planning (A-7).
 *
 * Deterministic on purpose: with no LLM adapter injected the plan must still be
 * honest and useful (split the script into shots, attach known characters and
 * derive image/video prompts). When a LLM adapter exists it can replace
 * {@link planStoryboard} later without changing the contract.
 *
 * @module dsh-image-video/workbench/storyboard
 */

/** One planned shot. */
export interface StoryboardShot {
  /** 1-based shot number. */
  readonly index: number
  /** Human-readable shot label (first sentence of the chunk, trimmed). */
  readonly shot: string
  /** Character names detected from the project's creative resources. */
  readonly characters: readonly string[]
  /** Scene name detected from the project's creative resources, when any. */
  readonly scene?: string
  /** Image prompt for this shot. */
  readonly imagePrompt: string
  /** Video prompt for this shot. */
  readonly videoPrompt: string
}

/** Resource projection needed for planning. */
export interface PlanResource {
  readonly id: string
  readonly kind: string
  readonly name: string
  readonly note?: string
}

/** Split a script into sentence-ish chunks. */
function chunkScript(script: string): string[] {
  return script
    .split(/[\n。！？!?；;]+/u)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk !== '')
}

/**
 * Plan a storyboard from a script.
 * @param input - script text, optional target shot count, and project resources.
 * @returns shots (1-based) plus the resources that were actually referenced.
 */
export function planStoryboard(input: {
  script: string
  shots?: number
  resources?: readonly PlanResource[]
}): { shots: StoryboardShot[]; referencedResourceIds: string[] } {
  const chunks = chunkScript(input.script)
  if (chunks.length === 0) throw new Error('剧本不能为空：至少需要一句话')
  const target = Math.min(60, Math.max(1, Math.round(input.shots ?? chunks.length)))
  // 均匀分组：把 chunks 平均切成 target 段（target 多于句子时按句子数封顶）
  const count = Math.min(target, chunks.length)
  const buckets: string[][] = Array.from({ length: count }, () => [])
  chunks.forEach((chunk, index) => { buckets[Math.floor(index * count / chunks.length)]!.push(chunk) })

  const resources = input.resources ?? []
  const referenced = new Set<string>()
  const shots: StoryboardShot[] = buckets.map((bucket, index) => {
    const text = bucket.join('，')
    const characters: string[] = []
    let scene: string | undefined
    for (const resource of resources) {
      if (!text.includes(resource.name)) continue
      referenced.add(resource.id)
      if (resource.kind === 'role') characters.push(resource.name)
      if (resource.kind === 'scene' && scene === undefined) scene = resource.name
    }
    const subject = characters.length === 0 ? '' : `${characters.join('、')}的`
    const where = scene === undefined ? '' : `，场景：${scene}`
    return {
      index: index + 1,
      shot: text.slice(0, 40),
      characters,
      ...scene === undefined ? {} : { scene },
      imagePrompt: `${subject}${text}${where}；电影感构图，主体清晰，光影统一`,
      videoPrompt: `${text}${where}；镜头运动克制，画面连贯，时长约 5 秒`,
    }
  })
  return { shots, referencedResourceIds: [...referenced] }
}
