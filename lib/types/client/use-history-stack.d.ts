/** 同 tag 连续改动的合并窗口（毫秒）。 */
export declare const COALESCE_MS = 800;
/** 历史栈深度上限。 */
export declare const UNDO_LIMIT = 100;
/** 历史栈的对外形态。 */
export interface HistoryStack<T> {
    /** 当前态。 */
    readonly present: T;
    /** 还能撤几步。 */
    readonly undoDepth: number;
    /** 还能重做几步。 */
    readonly redoDepth: number;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /**
     * 提交一个新状态。
     * @param next - 新状态。
     * @param tag - 合并标签：同 tag 且在合并窗口内则替换当前态（不推历史）。
     */
    readonly commit: (next: T, tag?: string) => void;
    /** 撤销；返回新的当前态，无历史可撤时返回 undefined。 */
    readonly undo: () => T | undefined;
    /** 重做；返回新的当前态，无可重做时返回 undefined。 */
    readonly redo: () => T | undefined;
    /** 换文档（切项目/重新播种）时重置历史。 */
    readonly reset: (next: T) => void;
}
/**
 * 建一个快照历史栈。
 * @param initial - 初始状态。
 * @returns 栈操作（见 {@link HistoryStack}）。
 */
export declare function useHistoryStack<T>(initial: T): HistoryStack<T>;
