/**
 * 提示词风险校验（`B-6`）：提交前先扫一遍，把"必被拒/必侵权"的提示词挡在花钱之前。
 *
 * 两条原则：
 * 1. **分级**：`block` = 明确不做（涉政人物、色情、未成年性暗示、违禁品/恐怖），直接拒绝并说明；
 *    `warn` = 可以做但提示风险（血腥、版权/IP、真实人物换脸），不阻断但随结果回传提醒。
 * 2. **不吓人**：词表只覆盖"生成服务商普遍会拒"的类别，不做泛化的敏感词过滤——
 *    误伤正常创作比漏拦更讨厌，而且用户会绕过。
 *
 * 词表故意保持**少而准**：每加一个词都要能说清"为什么它一定该拦/该提醒"。
 *
 * @module dsh-image-video/media/prompt-safety
 */

/** 风险等级。 */
export type RiskLevel = 'ok' | 'warn' | 'block'

/** 一条命中。 */
export interface PromptRiskHit {
  /** 类别：politics / sexual / minor / contraband / violence / copyright / real-person。 */
  readonly category: string
  /** 命中的词。 */
  readonly term: string
  readonly severity: 'warn' | 'block'
  /** 给人话的处理建议。 */
  readonly advice: string
}

/** 扫描结果。 */
export interface PromptRiskReport {
  readonly level: RiskLevel
  readonly hits: readonly PromptRiskHit[]
  /** 汇总建议（按严重度排序）。 */
  readonly advice: readonly string[]
}

/** 一条规则：同类同严重度的一组词。 */
interface RiskRule {
  readonly category: string
  readonly severity: 'warn' | 'block'
  readonly terms: readonly string[]
  readonly advice: string
}

/** 规则表（顺序即命中时的展示顺序）。 */
const RISK_RULES: readonly RiskRule[] = [
  {
    category: 'politics',
    severity: 'block',
    terms: ['国家领导人', '政治人物', '天安门事件', 'political leader', 'head of state'],
    advice: '涉政内容会被服务商直接拒绝，也可能触及法律风险：请换成虚构人物与架空背景',
  },
  {
    category: 'sexual',
    severity: 'block',
    terms: ['色情', '裸体', '性爱', 'porn', 'nude', 'nsfw', 'explicit sexual'],
    advice: '色情/裸露内容不在允许范围：请改为正常着装与情感表达',
  },
  {
    category: 'minor',
    severity: 'block',
    terms: ['未成年性', '萝莉色情', '幼女性', 'child sexual', 'lolicon'],
    advice: '涉及未成年人的性化内容绝对禁止：请更换主体与题材',
  },
  {
    category: 'contraband',
    severity: 'block',
    terms: ['毒品制作', '制毒', '炸弹制作', '恐怖袭击教程', 'how to make a bomb', 'methamphetamine synthesis'],
    advice: '违禁品/暴恐教程类内容禁止生成：请更换题材',
  },
  {
    category: 'violence',
    severity: 'warn',
    terms: ['血腥', '肢解', '爆头', '开膛', 'gore', 'dismember', 'graphic blood'],
    advice: '过度血腥的描写容易被拒或被打码：建议弱化为"紧张冲突"而非具体伤害细节',
  },
  {
    category: 'copyright',
    severity: 'warn',
    terms: ['皮卡丘', '米老鼠', '迪士尼角色', '临摹画师', '复制他人作品', 'pokemon', 'mickey mouse', 'in the style of a living artist'],
    advice: '知名 IP 与在世画师风格有侵权风险：建议改为"通用风格描述"（如日系赛璐璐、水彩插画）',
  },
  {
    category: 'real-person',
    severity: 'warn',
    terms: ['换脸真实人物', '明星换脸', 'deepfake celebrity', 'celebrity face swap'],
    advice: '真实人物换脸涉及肖像权与合规风险：请使用虚构角色；批量投放场景尤其注意',
  },
] as const

/**
 * 扫描一段提示词。
 * @param text - 用户提示词（可为空）。
 * @returns 风险报告：`level` 为 `block` 时**不应提交**。
 */
export function scanPrompt(text: string): PromptRiskReport {
  const haystack = text.toLowerCase()
  if (haystack.trim() === '') return { level: 'ok', hits: [], advice: [] }
  const hits: PromptRiskHit[] = []
  for (const rule of RISK_RULES) {
    for (const term of rule.terms) {
      if (!haystack.includes(term.toLowerCase())) continue
      hits.push({ category: rule.category, term, severity: rule.severity, advice: rule.advice })
    }
  }
  const level: RiskLevel = hits.some(hit => hit.severity === 'block')
    ? 'block'
    : hits.length > 0 ? 'warn' : 'ok'
  // 去重建议（同一规则可能命中多个词）
  const advice = [...new Set(hits.map(hit => hit.advice))]
  return { level, hits, advice }
}

/**
 * 提交前的硬校验：`block` 直接抛错（可操作），`warn` 交给调用方随结果回传。
 * @param report - {@link scanPrompt} 的结果。
 * @param subject - 用于错误文案（如"提示词"/"融合生图提示词"）。
 * @throws {Error} 命中 block 级风险时。
 */
export function assertPromptAllowed(report: PromptRiskReport, subject = '提示词'): void {
  if (report.level !== 'block') return
  const blocked = report.hits.filter(hit => hit.severity === 'block')
  const terms = [...new Set(blocked.map(hit => hit.term))].join('、')
  throw new Error(
    `${subject}未通过合规校验：命中「${terms}」。${blocked[0]?.advice ?? '请修改后再提交'}`,
  )
}
