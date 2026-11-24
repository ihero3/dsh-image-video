/**
 * Skill 选择统一交互：选中即把可读 token 插入文本区，删掉 token 后重新出现在下拉。
 *
 * 可以**多次选择**：每次选中的 token 累加，已选的从候选里移出；想取消就直接在文本区删 token。
 * token 只放在界面文本里；所有调模型的入口都要先用 `stripSkillTokens()` 清掉，
 * 避免把「技能标记」误当成剧本正文发给模型。
 */
import type { SkillRecord } from '../workbench/skills.ts'
import type { WorkbenchLocaleKey } from './locales.ts'

/** `【@技能名】`：人眼可读，且用户可以直接在文本区里删掉。 */
export function skillToken(name: string): string {
  return `【@${name}】`
}

/** 文本里当前选中的 Skill id（按技能库顺序，单技能口沿用第一个）。 */
export function selectedSkillIds(text: string, skills: readonly SkillRecord[]): readonly string[] {
  return skills.filter(skill => text.includes(skillToken(skill.name))).map(skill => skill.id)
}

/** 当前生效的 Skill id；没有 token 时返回空串。 */
export function activeSkillId(text: string, skills: readonly SkillRecord[]): string {
  return selectedSkillIds(text, skills)[0] ?? ''
}

/** 清掉文本里的全部 Skill token，供生成 / 拆解 / 提取接口使用。 */
export function stripSkillTokens(text: string, skills: readonly SkillRecord[]): string {
  let cleaned = text
  for (const skill of skills) cleaned = cleaned.split(skillToken(skill.name)).join('')
  return cleaned.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * 选中一个 Skill：把它的 token 追加到文本末尾，已有 token 都保留。
 * 这样每个被选 Skill 都能在文本区里单独删掉，删掉后自然回到下拉候选。
 */
export function insertSkillToken(
  text: string,
  skill: SkillRecord,
  skills: readonly SkillRecord[] = [skill],
): string {
  // 下拉已经会过滤已选项；这里再兜一次底，避免重复插入同一个 token
  if (selectedSkillIds(text, skills).includes(skill.id)) return text
  const token = skillToken(skill.name)
  const cleaned = text.trimEnd()
  return cleaned === '' ? token : `${cleaned} ${token}`
}

/** 从文本区删掉某个 Skill token。 */
export function removeSkillToken(text: string, skill: SkillRecord): string {
  return stripSkillTokens(text.split(skillToken(skill.name)).join(''), [])
}

interface SkillTokenSelectProps {
  readonly skills: readonly SkillRecord[]
  readonly text: string
  readonly onTextChange: (next: string) => void
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly label: string
  readonly disabled?: boolean
  readonly className?: string
  /** 各入口保留自己的定位属性，测试和旧样式继续可用。 */
  readonly selectAttrs?: Readonly<Record<string, string>>
}

/** 紧凑的 Skill 下拉：只列尚未插入文本区的技能，选中后 value 复位。 */
export function SkillTokenSelect(props: SkillTokenSelectProps) {
  const { skills, text, onTextChange, t, label, disabled, className, selectAttrs } = props
  const selected = new Set(selectedSkillIds(text, skills))
  const candidates = skills.filter(skill => !selected.has(skill.id))
  return (
    <select
      {...selectAttrs}
      className={className ?? 'iv-select iv-select--sm'}
      value=""
      disabled={disabled === true}
      aria-label={label}
      title={t('skillInsertHint')}
      onChange={event => {
        const skill = skills.find(candidate => candidate.id === event.target.value)
        if (skill === undefined) return
        onTextChange(insertSkillToken(text, skill, skills))
      }}
    >
      <option value="">{t('skillInsert')}</option>
      {candidates.map(skill => (
        <option key={skill.id} value={skill.id}>{skill.name}</option>
      ))}
    </select>
  )
}
