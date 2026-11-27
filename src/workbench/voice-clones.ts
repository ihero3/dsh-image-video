/**
 * 语音克隆音色库。
 *
 * 为什么必须持久化：克隆接口返回的是网关自定义音色 id（形如 `mmxvc_…`），
 * 它是**后续合成唯一的入口**——不记下来，用户克隆完就再也找不回自己的音色。
 * 记录里只保留 id / 展示名 / 模型 / 样本文件名与时间，不存样本字节。
 *
 * 存储口径与提示词库（`prompts.json`）一致：工作台数据目录下的一个小 JSON，
 * 文件缺失或损坏都按「空库」处理，绝不因为读不到库而让语音整体不可用。
 *
 * @module dsh-image-video/workbench/voice-clones
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { TtsVoice } from '../media/tts.ts'

/** 文件格式。 */
interface VoiceCloneFile {
  readonly version: 1
  readonly voices: TtsVoice[]
}

/** 音色库上限（音色是元数据，几百条也不大，仍然设界避免文件无限增长）。 */
const MAX_CLONES = 200

/** 判定读回来的条目是否长得像一条克隆音色。 */
function isCloneVoice(value: unknown): value is TtsVoice {
  if (typeof value !== 'object' || value === null) return false
  const record = value as TtsVoice
  return typeof record.id === 'string' && record.id.trim() !== ''
    && typeof record.name === 'string'
}

/**
 * 克隆音色库（JSON 落盘）。
 */
export class VoiceCloneLibrary {
  readonly #file: string
  readonly #now: () => Date

  /**
   * @param options - `directory` 是工作台数据目录；`now` 可注入时钟（测试用）。
   */
  constructor(options: { directory: string; now?: () => Date }) {
    this.#file = join(options.directory, 'voice-clones.json')
    this.#now = options.now ?? (() => new Date())
  }

  /**
   * 列出已保存的克隆音色（新的在前；文件缺失/损坏读作空库）。
   * @returns 克隆音色记录。
   */
  async list(): Promise<TtsVoice[]> {
    try {
      const raw = await readFile(this.#file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<VoiceCloneFile>
      if (!Array.isArray(parsed.voices)) return []
      return parsed.voices
        .filter(isCloneVoice)
        .map(voice => ({ ...voice, kind: 'clone' as const }))
        .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
    } catch {
      return []
    }
  }

  /**
   * 新增或按 id 覆盖一条克隆音色。
   * @param voice - 克隆结果里的音色记录。
   * @returns 落库后的记录。
   */
  async save(voice: TtsVoice): Promise<TtsVoice> {
    const record: TtsVoice = {
      ...voice,
      kind: 'clone',
      createdAt: voice.createdAt ?? this.#now().toISOString(),
    }
    const existing = await this.list()
    const next = [record, ...existing.filter(entry => entry.id !== record.id)].slice(0, MAX_CLONES)
    await mkdir(dirname(this.#file), { recursive: true })
    await writeFile(this.#file, `${JSON.stringify({ version: 1, voices: next } satisfies VoiceCloneFile, null, 2)}\n`, 'utf8')
    return record
  }

  /**
   * 删除一条克隆音色（仅本地记录；网关侧音色仍在，不影响已生成音频）。
   * @param id - 音色 id。
   * @returns 是否真的删掉了一条。
   */
  async remove(id: string): Promise<boolean> {
    const existing = await this.list()
    const next = existing.filter(entry => entry.id !== id)
    if (next.length === existing.length) return false
    await mkdir(dirname(this.#file), { recursive: true })
    await writeFile(this.#file, `${JSON.stringify({ version: 1, voices: next } satisfies VoiceCloneFile, null, 2)}\n`, 'utf8')
    return true
  }
}
