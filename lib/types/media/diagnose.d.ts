/**
 * 渲染失败的诊断建议（Track A / A88）。
 *
 * 问题：导出失败只给错误码 + 一句话 ✗ —— 用户（和 Agent）知道"错了"，但**不知道下一步做什么** ✗。
 * 这里把错误码翻成"人话 + 可执行动作"，让自助修复成为可能。
 */
/** 一条诊断建议。 */
export interface Diagnosis {
    /** 错误码（原样保留，便于程序判断）。 */
    readonly code: string;
    /** 一句话结论。 */
    readonly title: string;
    /** 为什么/怎么判断出来的。 */
    readonly hint: string;
    /** 建议动作（按优先级，界面可渲染成按钮/Agent 可逐个尝试）。 */
    readonly actions: readonly string[];
}
/**
 * 把错误码翻译成诊断建议。
 * @param code - `RenderError.code`（未知码走通用建议）。
 * @param message - 原始错误消息（附在 hint 尾部便于排查）。
 * @returns 诊断建议。
 */
export declare function diagnoseRenderError(code: string | undefined, message?: string): Diagnosis;
