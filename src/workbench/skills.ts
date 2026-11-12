/**
 * 双技能库：导演库（提示词 → 专业分镜）与逆向库（图片 / 短视频 → 可编辑提示词）。
 *
 * 两类技能彼此独立（`kind` 区分），存储在工作台数据目录下：
 * `skills/<kind>/<id>/skill.json` 是每条技能的清单，`skills/index.json` 记录启用状态，
 * `skills/_backup/` 保存覆盖或删除前的副本。数据与界面同源：清单只描述技能本身，
 * 不引用项目、集或素材，因此可以像素材库一样在多个剧集之间共用。
 *
 * 内置技能是代码常量（只读），首次访问时把清单落盘供查看；用户只能禁用、不能修改或删除。
 *
 * @module dsh-image-video/workbench/skills
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

/** 技能库类型：生成分镜用 director，逆向提示词用 reverse。 */
export type SkillKind = 'director' | 'reverse'

/** 两类技能库的固定顺序（界面按这个顺序排标签页）。 */
export const SKILL_KINDS: readonly SkillKind[] = ['director', 'reverse']

/** 单条技能清单的 schema 版本。 */
export const SKILL_SCHEMA_VERSION = 1

/** 技能名称上限。 */
export const MAX_SKILL_NAME_LENGTH = 100

/** 技能说明上限。 */
export const MAX_SKILL_DESCRIPTION_LENGTH = 500

/** 技能提示词上限（技能是长文提示词模板，给足空间但仍防无界增长）。 */
export const MAX_SKILL_PROMPT_LENGTH = 40_000

/** 导入源（zip / json）的字节上限。 */
export const MAX_SKILL_IMPORT_BYTES = 20 * 1024 * 1024

/** 技能 id 的合法字符：不做路径解释，直接排除 `/`、`\`、`.` 与空白。 */
const SKILL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u

/** 内置技能的固定时间戳（代码常量没有真实的创建时间）。 */
const BUILTIN_TIMESTAMP = '2026-11-01T00:00:00.000Z'

/** 一条技能。 */
export interface SkillRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly kind: SkillKind
  readonly name: string
  readonly description: string
  /** 技能正文（模型提示词模板）。 */
  readonly prompt: string
  /** 内置技能为 `true`：不可修改、不可删除，但可以禁用。 */
  readonly builtin: boolean
  /** 是否出现在选择器里（禁用的技能仍保留在库中）。 */
  readonly enabled: boolean
  /** 导入来源（本地路径或 https URL）；内置技能为 `builtin`。 */
  readonly source?: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** 磁盘清单（不含启用状态：那是索引的事）。 */
interface SkillManifest {
  readonly schemaVersion: number
  readonly id: string
  readonly kind: SkillKind
  readonly name: string
  readonly description: string
  readonly prompt: string
  readonly source?: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** 索引里的一条：启用状态 + 内置标记。 */
interface SkillIndexEntry {
  readonly id: string
  readonly kind: SkillKind
  readonly enabled: boolean
  readonly builtin: boolean
}

/** 索引文件。 */
interface SkillIndexFile {
  readonly version: number
  readonly entries: readonly SkillIndexEntry[]
}

/** 内置技能定义（代码权威，清单落盘只是为了让用户能看到内容）。 */
interface BuiltinSkill {
  readonly id: string
  readonly kind: SkillKind
  readonly name: string
  readonly description: string
  readonly prompt: string
}

/** 内置技能：导演库 2 条。 */
const BUILTIN_DIRECTOR: readonly BuiltinSkill[] = [
  {
    id: 'builtin-director-cinema',
    kind: 'director',
    name: '电影感分镜导演',
    description: '把一段中文提示词拆成专业分镜：景别、机位、运镜、光影与时长都写清楚。',
    prompt: [
      '你是电影分镜导演。用户会给你一段剧情提示词与目标时长，请把它拆成连续镜头。',
      '每个镜头必须包含：镜号、时长（秒）、景别（远景/全景/中景/近景/特写）、机位与角度、运镜（推/拉/摇/移/跟/升降）、画面主体与动作、光线与色调、环境细节。',
      '输出严格 JSON：{"shots":[{"order":1,"durationSec":5,"imagePrompt":"...","videoPrompt":"..."}]}。',
      'imagePrompt 面向生图模型，写静态画面：主体、构图、景别、光线、风格；不要写运镜。',
      'videoPrompt 面向视频模型，写动作与运镜：主体如何运动、镜头如何移动、时间如何推进。',
      '不要把同一动作拆成两个镜头；镜头之间要能顺接，不要跳轴。',
    ].join('\n'),
  },
  {
    id: 'builtin-director-anime',
    kind: 'director',
    name: '日系动画分镜导演',
    description: '强调动画式的节奏、夸张表演与镜头语言，适合二次元短剧。',
    prompt: [
      '你是日系动画分镜导演。把用户给的提示词拆成动画镜头。',
      '每个镜头写清：镜号、时长、景别、机位、运镜、角色表演（表情/动作/口型）、背景层次、特效（速度线/集中线/光晕）与色调。',
      '输出严格 JSON：{"shots":[{"order":1,"durationSec":4,"imagePrompt":"...","videoPrompt":"..."}]}。',
      'imagePrompt 写静态关键帧：角色站位、表情、背景、画风与配色；',
      'videoPrompt 写动画运动：角色动作、镜头运动、节奏变化与特效出现时机。',
      '保持角色造型一致；转场优先用动作接动作，不要无意义地叠化。',
    ].join('\n'),
  },
]

/** 内置技能：逆向库 2 条。 */
const BUILTIN_REVERSE: readonly BuiltinSkill[] = [
  {
    id: 'builtin-reverse-shot',
    kind: 'reverse',
    name: '镜头逆向解析',
    description: '从一张图片或一段短视频反推出可编辑的生图 / 视频提示词。',
    prompt: [
      '你是镜头逆向解析器。用户会给你图片或短视频作为参考，请提取可复用的提示词。',
      '只描述看得见的事实，不猜测剧情、不补写台词、不虚构参考里没有的角色。',
      '输出严格 JSON：{"style":"...","subject":"...","material":"...","details":"...","imagePrompt":"...","videoPrompt":"..."}。',
      'style 写画风与色调（如胶片、赛博朋克、日系动画）；subject 写主体与身份特征；',
      'material 写材质与质感；details 写构图、景别、光线、环境与镜头语言。',
      'imagePrompt 合并成一段可直接生图的完整提示词；videoPrompt 补充动作、运镜与节奏。',
    ].join('\n'),
  },
  {
    id: 'builtin-reverse-drama',
    kind: 'reverse',
    name: '短剧节拍逆向',
    description: '把十来秒的短剧片段拆成节拍，并给每拍生成可编辑的提示词。',
    prompt: [
      '你是短剧节拍逆向分析师。用户会给你一段短视频，请按时间轴拆成节拍。',
      '每拍写清：起止时间、景别、机位、人物动作与表情、台词或音效（能听清才写）、画面变化。',
      '输出严格 JSON：{"beats":[{"order":1,"startSec":0,"endSec":3,"shot":"...","imagePrompt":"...","videoPrompt":"..."}]}。',
      'imagePrompt 写该拍的代表性静态画面；videoPrompt 写这一拍内的动作与运镜。',
      '节拍之间必须连续，不要漏掉转场；听不清的台词标注为“（听不清）”，不要编造。',
    ].join('\n'),
  },
]

/** 内置技能全集。 */
const BUILTINS: readonly BuiltinSkill[] = [...BUILTIN_DIRECTOR, ...BUILTIN_REVERSE]

/** 构造选项。 */
export interface SkillLibraryOptions {
  /** 工作台数据目录（`workbench.json` 所在目录）。 */
  readonly directory: string
  /** 时钟覆盖，测试用。 */
  readonly now?: () => Date
  /** `fetch` 覆盖，测试用（默认用全局 fetch）。 */
  readonly fetch?: typeof fetch
}

/**
 * 校验技能库类型。
 * @param value - 原始输入。
 * @returns 类型。
 * @throws {Error} 不是 director/reverse 时。
 */
export function normalizeSkillKind(value: unknown): SkillKind {
  if (value === 'director' || value === 'reverse') return value
  throw new Error('技能库类型必须是 director 或 reverse')
}

/**
 * 校验技能 id：只接受字母数字与 `_`/`-`，保证它可以直接当目录名。
 * @param value - 原始输入。
 * @returns 合法 id。
 * @throws {Error} 为空、超长或含路径字符时。
 */
export function normalizeSkillId(value: unknown): string {
  if (typeof value !== 'string' || !SKILL_ID_PATTERN.test(value.trim())) {
    throw new Error('技能 id 必须是 1–64 个字母/数字/_/-，且不能包含路径字符')
  }
  return value.trim()
}

/**
 * 校验技能名称。
 * @param value - 原始输入。
 * @returns 去空白后的名称。
 * @throws {Error} 为空或超长时。
 */
export function normalizeSkillName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('技能名称必须是字符串')
  const name = value.trim()
  if (name === '') throw new Error('技能名称不能为空')
  if (name.length > MAX_SKILL_NAME_LENGTH) {
    throw new Error(`技能名称最多 ${MAX_SKILL_NAME_LENGTH} 个字符（收到 ${name.length}）`)
  }
  return name
}

/**
 * 校验技能说明。
 * @param value - 原始输入；缺省即空串。
 * @returns 去空白后的说明。
 * @throws {Error} 非字符串或超长时。
 */
export function normalizeSkillDescription(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('技能说明必须是字符串')
  const description = value.trim()
  if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    throw new Error(`技能说明最多 ${MAX_SKILL_DESCRIPTION_LENGTH} 个字符（收到 ${description.length}）`)
  }
  return description
}

/**
 * 校验技能提示词正文。
 * @param value - 原始输入。
 * @returns 正文。
 * @throws {Error} 非字符串、为空或超长时。
 */
export function normalizeSkillPrompt(value: unknown): string {
  if (typeof value !== 'string') throw new Error('技能提示词必须是字符串')
  const prompt = value.trim()
  if (prompt === '') throw new Error('技能提示词不能为空')
  if (prompt.length > MAX_SKILL_PROMPT_LENGTH) {
    throw new Error(`技能提示词最多 ${MAX_SKILL_PROMPT_LENGTH} 个字符（收到 ${prompt.length}）`)
  }
  return prompt
}

/**
 * 技能库：清单落盘 + 索引 + 覆盖前备份。
 */
export class SkillLibrary {
  /** 工作台数据目录。 */
  readonly directory: string
  /** 技能根目录。 */
  readonly root: string
  readonly #now: () => Date
  readonly #fetch: typeof fetch

  /**
   * @param options - 数据目录、可选时钟与 fetch。
   */
  constructor(options: SkillLibraryOptions) {
    this.directory = options.directory
    this.root = join(options.directory, 'skills')
    this.#now = options.now ?? (() => new Date())
    this.#fetch = options.fetch ?? globalThis.fetch
  }

  /**
   * 技能所在的绝对目录（供「在文件管理器里打开」使用）。
   * @param id - 技能 id。
   * @returns 绝对目录。
   * @throws {Error} id 不合法或技能不存在时。
   */
  async directoryOf(id: unknown): Promise<string> {
    const skillId = normalizeSkillId(id)
    await this.#ensure()
    const entry = (await this.#readIndex()).entries.find(candidate => candidate.id === skillId)
    if (entry === undefined) throw new Error(`未知的技能：${skillId}`)
    return this.#manifestDirectory(entry.kind, entry.id)
  }

  /**
   * 列出技能；默认按库类型过滤。
   * @param options - `kind` 缺省列出全部；`enabledOnly` 只要启用中的。
   * @returns 技能列表（内置在前，其余按更新时间倒序）。
   * @throws {Error} kind 不合法时。
   */
  async list(options: { kind?: unknown; enabledOnly?: boolean } = {}): Promise<SkillRecord[]> {
    const kind = options.kind === undefined ? undefined : normalizeSkillKind(options.kind)
    await this.#ensure()
    const index = await this.#readIndex()
    const records: SkillRecord[] = []
    for (const entry of index.entries) {
      if (kind !== undefined && entry.kind !== kind) continue
      if (options.enabledOnly === true && !entry.enabled) continue
      const record = await this.#recordFor(entry)
      if (record !== undefined) records.push(record)
    }
    return records.sort((left, right) => {
      if (left.builtin !== right.builtin) return left.builtin ? -1 : 1
      if (left.kind !== right.kind) return SKILL_KINDS.indexOf(left.kind) - SKILL_KINDS.indexOf(right.kind)
      if (left.builtin) return left.name.localeCompare(right.name)
      return right.updatedAt.localeCompare(left.updatedAt)
    })
  }

  /**
   * 读取一条技能。
   * @param id - 技能 id。
   * @returns 技能。
   * @throws {Error} id 不合法或不存在时。
   */
  async get(id: unknown): Promise<SkillRecord> {
    const skillId = normalizeSkillId(id)
    await this.#ensure()
    const index = await this.#readIndex()
    const entry = index.entries.find(candidate => candidate.id === skillId)
    if (entry === undefined) throw new Error(`未知的技能：${skillId}`)
    const record = await this.#recordFor(entry)
    if (record === undefined) throw new Error(`技能清单缺失：${skillId}`)
    return record
  }

  /**
   * 新建或修改一条用户技能。内置技能不可修改，覆盖用户技能前会备份。
   * @param input - 库类型、名称、说明与提示词；`id` 缺省新建。
   * @returns 写入后的技能。
   * @throws {Error} 字段不合法、试图修改内置技能或 id 属于别的库时。
   */
  async save(input: {
    readonly id?: unknown
    readonly kind: unknown
    readonly name: unknown
    readonly description?: unknown
    readonly prompt: unknown
    readonly source?: string
  }): Promise<SkillRecord> {
    await this.#ensure()
    const kind = normalizeSkillKind(input.kind)
    const name = normalizeSkillName(input.name)
    const description = normalizeSkillDescription(input.description)
    const prompt = normalizeSkillPrompt(input.prompt)
    const requestedId = input.id === undefined || input.id === null || input.id === ''
      ? undefined
      : normalizeSkillId(input.id)
    const index = await this.#readIndex()
    const existingEntry = requestedId === undefined ? undefined : index.entries.find(candidate => candidate.id === requestedId)
    if (existingEntry !== undefined) {
      if (existingEntry.builtin) throw new Error('内置技能只读：不能修改，只能禁用')
      if (existingEntry.kind !== kind) throw new Error(`技能 ${requestedId} 属于 ${existingEntry.kind} 库，不能写入 ${kind} 库`)
      await this.#backup(existingEntry.kind, existingEntry.id)
    }
    const existingManifest = existingEntry === undefined || requestedId === undefined
      ? undefined
      : await this.#readManifest(existingEntry.kind, requestedId)
    const stamp = this.#now().toISOString()
    const manifest: SkillManifest = {
      schemaVersion: SKILL_SCHEMA_VERSION,
      id: requestedId ?? this.#newId(),
      kind,
      name,
      description,
      prompt,
      ...input.source === undefined ? {} : { source: input.source },
      createdAt: existingManifest?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    await this.#writeManifest(manifest)
    const entries = [...index.entries.filter(candidate => candidate.id !== manifest.id), {
      id: manifest.id, kind, enabled: true, builtin: false,
    }]
    await this.#writeIndex(entries)
    return { ...manifest, builtin: false, enabled: true }
  }

  /**
   * 从本地路径或 https URL 导入技能。
   *
   * 支持：`.json` 清单、`.zip`（内含 `skill.json`）、本地目录（含 `skill.json`）。
   * 只接受 `https://`；http、file 与其它协议一律拒绝。zip 先校验全部条目名再解包。
   * @param input - 目标库类型与导入源。
   * @returns 导入后的技能。
   * @throws {Error} 源协议/大小/清单结构不合法时。
   */
  async import(input: { readonly kind: unknown; readonly source: string }): Promise<SkillRecord> {
    const kind = normalizeSkillKind(input.kind)
    await this.#ensure()
    const raw = await this.#loadImportSource(input.source)
    const manifest = parseManifest(raw, kind)
    const index = await this.#readIndex()
    const existing = index.entries.find(candidate => candidate.id === manifest.id)
    if (existing?.builtin === true) throw new Error(`内置技能 id 不可占用：${manifest.id}`)
    if (existing !== undefined) {
      if (existing.kind !== kind) throw new Error(`技能 ${manifest.id} 属于 ${existing.kind} 库，不能导入到 ${kind} 库`)
      await this.#backup(existing.kind, existing.id)
    }
    const stamp = this.#now().toISOString()
    const stored: SkillManifest = {
      ...manifest,
      schemaVersion: SKILL_SCHEMA_VERSION,
      kind,
      source: input.source,
      createdAt: existing === undefined ? stamp : (await this.#readManifest(existing.kind, manifest.id))?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    await this.#writeManifest(stored)
    await this.#writeIndex([...index.entries.filter(candidate => candidate.id !== stored.id), {
      id: stored.id, kind, enabled: true, builtin: false,
    }])
    return { ...stored, builtin: false, enabled: true }
  }

  /**
   * 启用 / 禁用一条技能（内置技能也允许禁用）。
   * @param id - 技能 id。
   * @param enabled - 目标状态。
   * @returns 更新后的技能。
   * @throws {Error} 技能不存在时。
   */
  async toggle(id: unknown, enabled: unknown): Promise<SkillRecord> {
    if (typeof enabled !== 'boolean') throw new Error('enabled 必须是布尔值')
    const skillId = normalizeSkillId(id)
    await this.#ensure()
    const index = await this.#readIndex()
    const entry = index.entries.find(candidate => candidate.id === skillId)
    if (entry === undefined) throw new Error(`未知的技能：${skillId}`)
    const next = index.entries.map(candidate => (candidate.id === skillId ? { ...candidate, enabled } : candidate))
    await this.#writeIndex(next)
    const record = await this.#recordFor({ ...entry, enabled })
    if (record === undefined) throw new Error(`技能清单缺失：${skillId}`)
    return record
  }

  /**
   * 删除一条用户技能（先备份到 `_backup/`）；内置技能只读，删除会被拒绝。
   * @param id - 技能 id。
   * @returns 是否删除。
   * @throws {Error} 技能不存在或为内置技能时。
   */
  async remove(id: unknown): Promise<boolean> {
    const skillId = normalizeSkillId(id)
    await this.#ensure()
    const index = await this.#readIndex()
    const entry = index.entries.find(candidate => candidate.id === skillId)
    if (entry === undefined) throw new Error(`未知的技能：${skillId}`)
    if (entry.builtin) throw new Error('内置技能只读：不能删除，只能禁用')
    await this.#backup(entry.kind, entry.id)
    await rm(this.#manifestDirectory(entry.kind, entry.id), { recursive: true, force: true })
    await this.#writeIndex(index.entries.filter(candidate => candidate.id !== entry.id))
    return true
  }

  /** 首次访问时把内置技能的索引项与清单补齐（清单已存在则不覆盖）。 */
  async #ensure(): Promise<void> {
    const index = await this.#readIndex()
    let changed = false
    const entries = [...index.entries]
    for (const builtin of BUILTINS) {
      if (!entries.some(entry => entry.id === builtin.id)) {
        entries.push({ id: builtin.id, kind: builtin.kind, enabled: true, builtin: true })
        changed = true
      }
      const manifest = await this.#readManifest(builtin.kind, builtin.id)
      if (manifest === undefined) {
        await this.#writeManifest(builtinManifest(builtin))
      }
    }
    if (changed) await this.#writeIndex(entries)
  }

  /** 读取索引；缺失或损坏时按磁盘清单重建（失败不抛给界面）。 */
  async #readIndex(): Promise<SkillIndexFile> {
    try {
      const parsed = JSON.parse(await readFile(this.#indexPath(), 'utf8')) as Partial<SkillIndexFile>
      if (Array.isArray(parsed.entries)) {
        const entries = parsed.entries.filter((entry): entry is SkillIndexEntry =>
          typeof entry === 'object' && entry !== null
          && typeof (entry as SkillIndexEntry).id === 'string'
          && ((entry as SkillIndexEntry).kind === 'director' || (entry as SkillIndexEntry).kind === 'reverse')
          && typeof (entry as SkillIndexEntry).enabled === 'boolean'
          && typeof (entry as SkillIndexEntry).builtin === 'boolean')
        return { version: 1, entries }
      }
    } catch {
      // 索引坏了就按磁盘清单重建；重建结果覆盖原文件。
    }
    return { version: 1, entries: await this.#scanEntries() }
  }

  /** 扫描 `skills/<kind>/<id>/skill.json`，重建索引项（默认启用）。 */
  async #scanEntries(): Promise<SkillIndexEntry[]> {
    const entries: SkillIndexEntry[] = []
    for (const kind of SKILL_KINDS) {
      const kindDir = join(this.root, kind)
      let names: string[]
      try {
        names = await readdir(kindDir)
      } catch {
        continue
      }
      for (const name of names) {
        if (!SKILL_ID_PATTERN.test(name)) continue
        if ((await this.#readManifest(kind, name)) === undefined) continue
        entries.push({ id: name, kind, enabled: true, builtin: this.#builtin(name) !== undefined })
      }
    }
    return entries
  }

  /** 索引项 → 对外记录（内置用代码常量，用户读磁盘清单）。 */
  async #recordFor(entry: SkillIndexEntry): Promise<SkillRecord | undefined> {
    const builtin = this.#builtin(entry.id)
    if (entry.builtin || builtin !== undefined) {
      if (builtin === undefined) return undefined
      return { ...builtinManifest(builtin), builtin: true, enabled: entry.enabled }
    }
    const manifest = await this.#readManifest(entry.kind, entry.id)
    if (manifest === undefined) return undefined
    return { ...manifest, builtin: false, enabled: entry.enabled }
  }

  /** 读一条清单；结构不合法视作缺失。 */
  async #readManifest(kind: SkillKind, id: string): Promise<SkillManifest | undefined> {
    try {
      const parsed = JSON.parse(await readFile(join(this.#manifestDirectory(kind, id), 'skill.json'), 'utf8')) as Record<string, unknown>
      if (parsed.kind !== kind || parsed.id !== id) return undefined
      if (typeof parsed.name !== 'string' || typeof parsed.prompt !== 'string') return undefined
      return {
        schemaVersion: SKILL_SCHEMA_VERSION,
        id,
        kind,
        name: parsed.name,
        description: typeof parsed.description === 'string' ? parsed.description : '',
        prompt: parsed.prompt,
        ...typeof parsed.source === 'string' ? { source: parsed.source } : {},
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : BUILTIN_TIMESTAMP,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : BUILTIN_TIMESTAMP,
      }
    } catch {
      return undefined
    }
  }

  /** 写清单到 `skills/<kind>/<id>/skill.json`。 */
  async #writeManifest(manifest: SkillManifest): Promise<void> {
    const directory = this.#manifestDirectory(manifest.kind, manifest.id)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'skill.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  /** 写索引。 */
  async #writeIndex(entries: readonly SkillIndexEntry[]): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const payload: SkillIndexFile = { version: 1, entries: [...entries] }
    await writeFile(this.#indexPath(), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }

  /** 覆盖 / 删除前备份整条技能目录；备份失败不应阻断操作。 */
  async #backup(kind: SkillKind, id: string): Promise<void> {
    const source = this.#manifestDirectory(kind, id)
    try {
      await stat(source)
    } catch {
      return
    }
    const stamp = this.#now().toISOString().replace(/[-:.TZ]/gu, '')
    const target = join(this.root, '_backup', kind, `${id}-${stamp}`)
    await mkdir(dirname(target), { recursive: true })
    await cp(source, target, { recursive: true, force: true }).catch(() => undefined)
  }

  /** 生成新技能 id。 */
  #newId(): string {
    return `skl-${this.#now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** 内置技能定义查询。 */
  #builtin(id: string): BuiltinSkill | undefined {
    return BUILTINS.find(candidate => candidate.id === id)
  }

  /** 清单目录（始终落在受控根目录内：id 已排除路径字符）。 */
  #manifestDirectory(kind: SkillKind, id: string): string {
    return join(this.root, kind, id)
  }

  /** 索引路径。 */
  #indexPath(): string {
    return join(this.root, 'index.json')
  }

  /** 读取导入源：本地路径（目录/JSON/zip）或 https URL。 */
  async #loadImportSource(source: string): Promise<unknown> {
    const trimmed = source.trim()
    if (trimmed === '') throw new Error('导入源不能为空')
    if (/^https:/iu.test(trimmed)) return this.#loadUrl(trimmed)
    if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) {
      throw new Error('只支持 https:// 链接或本地路径（http / file 等协议不导入）')
    }
    return this.#loadLocal(trimmed)
  }

  /** 本地目录 / JSON / zip。 */
  async #loadLocal(source: string): Promise<unknown> {
    const path = expandHome(source)
    if (!isAbsolute(path)) throw new Error('本地导入需要绝对路径')
    let info
    try {
      info = await stat(path)
    } catch {
      throw new Error(`导入源不存在：${path}`)
    }
    if (info.isDirectory()) {
      const manifestPath = join(path, 'skill.json')
      const manifestInfo = await stat(manifestPath).catch(() => undefined)
      if (manifestInfo === undefined || !manifestInfo.isFile()) throw new Error('目录里缺少 skill.json')
      if (manifestInfo.size > MAX_SKILL_IMPORT_BYTES) throw new Error('skill.json 超过 20MB')
      return readJson(await readFile(manifestPath, 'utf8'))
    }
    if (!info.isFile()) throw new Error('导入源必须是目录、.json 或 .zip 文件')
    if (info.size > MAX_SKILL_IMPORT_BYTES) throw new Error('导入文件超过 20MB')
    const bytes = await readFile(path)
    return looksLikeZip(bytes) ? readManifestFromZip(bytes) : readJson(bytes.toString('utf8'))
  }

  /** https URL：限制大小、按内容嗅探 zip / JSON。 */
  async #loadUrl(url: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.#fetch(url, { signal: AbortSignal.timeout(20_000) })
    } catch (error) {
      throw new Error(`下载技能失败：${error instanceof Error ? error.message : String(error)}`)
    }
    if (!response.ok) throw new Error(`下载技能失败：HTTP ${response.status}`)
    const declared = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_SKILL_IMPORT_BYTES) throw new Error('技能包超过 20MB')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > MAX_SKILL_IMPORT_BYTES) throw new Error('技能包超过 20MB')
    if (looksLikeZip(bytes)) return readManifestFromZip(bytes)
    return readJson(bytes.toString('utf8'))
  }
}

/** 内置技能 → 清单。 */
function builtinManifest(builtin: BuiltinSkill): SkillManifest {
  return {
    schemaVersion: SKILL_SCHEMA_VERSION,
    id: builtin.id,
    kind: builtin.kind,
    name: builtin.name,
    description: builtin.description,
    prompt: builtin.prompt,
    source: 'builtin',
    createdAt: BUILTIN_TIMESTAMP,
    updatedAt: BUILTIN_TIMESTAMP,
  }
}

/** 把清单对象校验成内部结构；id 缺省时生成一个稳定可读的新 id。 */
function parseManifest(raw: unknown, kind: SkillKind): SkillManifest {
  if (typeof raw !== 'object' || raw === null) throw new Error('skill.json 必须是对象')
  const entry = raw as Record<string, unknown>
  if (entry.kind !== kind) throw new Error(`skill.json 的 kind 必须是 ${kind}`)
  const name = normalizeSkillName(entry.name)
  const description = normalizeSkillDescription(entry.description)
  const prompt = normalizeSkillPrompt(entry.prompt)
  const id = entry.id === undefined || entry.id === null || entry.id === ''
    ? `skl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    : normalizeSkillId(entry.id)
  return {
    schemaVersion: SKILL_SCHEMA_VERSION,
    id,
    kind,
    name,
    description,
    prompt,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/** 读 JSON 文本；格式错误给可读原因。 */
function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`skill.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 展开 `~`（只处理 `~/` 与单独的 `~`）。 */
function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}

/** zip 文件头（本地文件头或空压缩包）。 */
function looksLikeZip(bytes: Buffer): boolean {
  return bytes.length >= 4
    && (bytes.readUInt32LE(0) === 0x04034b50 || bytes.readUInt32LE(0) === 0x06054b50)
}

/** 从 zip 里找 `skill.json`（优先根目录，其次层级最浅的）。 */
function readManifestFromZip(bytes: Buffer): unknown {
  const entries = readZipEntries(bytes)
  const candidates = [...entries.entries()].filter(([name]) => basename(name) === 'skill.json')
  if (candidates.length === 0) throw new Error('zip 里缺少 skill.json')
  candidates.sort(([left], [right]) => left.split('/').length - right.split('/').length)
  const content = candidates[0]![1]
  if (content.byteLength > MAX_SKILL_IMPORT_BYTES) throw new Error('zip 里的 skill.json 超过 20MB')
  return readJson(content.toString('utf8'))
}

/**
 * 解析 zip 中央目录并解出全部条目（不写磁盘）。
 *
 * 安全口径：先校验**所有**条目名（拒绝绝对路径、`..`、反斜杠、控制字符），
 * 再限制单条与总解压大小；不支持加密与未知压缩算法。
 * @param bytes - zip 文件内容。
 * @returns 条目名 → 内容。
 * @throws {Error} 结构损坏、条目名不安全或超出限额时。
 */
function readZipEntries(bytes: Buffer): Map<string, Buffer> {
  if (bytes.length > MAX_SKILL_IMPORT_BYTES) throw new Error('zip 文件超过 20MB')
  let eocd = -1
  const floor = Math.max(0, bytes.length - 22 - 65_535)
  for (let offset = bytes.length - 22; offset >= floor; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset
      break
    }
  }
  if (eocd < 0) throw new Error('zip 结构损坏：找不到中央目录')
  const count = bytes.readUInt16LE(eocd + 10)
  const directorySize = bytes.readUInt32LE(eocd + 12)
  const directoryOffset = bytes.readUInt32LE(eocd + 16)
  if (directoryOffset + directorySize > bytes.length) throw new Error('zip 结构损坏：中央目录越界')

  const entries = new Map<string, Buffer>()
  let total = 0
  let cursor = directoryOffset
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('zip 结构损坏：中央目录条目不完整')
    }
    const flags = bytes.readUInt16LE(cursor + 8)
    if ((flags & 0x0001) !== 0) throw new Error('不支持加密的 zip')
    const method = bytes.readUInt16LE(cursor + 10)
    const compressedSize = bytes.readUInt32LE(cursor + 20)
    const uncompressedSize = bytes.readUInt32LE(cursor + 24)
    const nameLength = bytes.readUInt16LE(cursor + 28)
    const extraLength = bytes.readUInt16LE(cursor + 30)
    const commentLength = bytes.readUInt16LE(cursor + 32)
    const localOffset = bytes.readUInt32LE(cursor + 42)
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    assertSafeZipEntryName(name)
    if (uncompressedSize > MAX_SKILL_IMPORT_BYTES) throw new Error(`zip 条目过大：${name}`)
    total += uncompressedSize
    if (total > MAX_SKILL_IMPORT_BYTES) throw new Error('zip 解压后超过 20MB')

    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`zip 条目头损坏：${name}`)
    }
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localExtraLength = bytes.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    if (dataStart + compressedSize > bytes.length) throw new Error(`zip 条目数据越界：${name}`)
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    let content: Buffer
    if (method === 0) {
      content = Buffer.from(compressed)
    } else if (method === 8) {
      content = inflateRawSync(compressed)
    } else {
      throw new Error(`zip 使用了不支持的压缩算法（${method}）：${name}`)
    }
    if (content.byteLength > MAX_SKILL_IMPORT_BYTES) throw new Error(`zip 条目过大：${name}`)
    entries.set(name, content)
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** 条目名安全校验：不允许绝对路径、上跳、反斜杠或控制字符。 */
function assertSafeZipEntryName(name: string): void {
  if (name === '' || name.includes('\\') || name.startsWith('/') || name.includes('\0')) {
    throw new Error(`zip 条目名不安全：${name}`)
  }
  if (name.split('/').some(segment => segment === '..' || segment === '.')) {
    throw new Error(`zip 条目名不安全：${name}`)
  }
  if (/[\u0000-\u001f]/u.test(name)) throw new Error(`zip 条目名包含控制字符：${name}`)
}
