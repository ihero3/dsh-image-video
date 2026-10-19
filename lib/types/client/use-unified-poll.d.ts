/**
 * 统一轮询（`B1`）：把导出 2s / 运行 2.5s / 项目 5s 三个定时器收敛成一个。
 *
 * 口径（任务书 `TASKS-TRACK-B.md` B1）：
 * - 间隔按活跃度自适应：有 running 任务 2s，否则 5s；
 * - `document.hidden` 时**停表**（不发请求），恢复可见时立即补跳一次；
 * - 每跳间隔加 ±20% 抖动，避免多客户端/多标签页同相位撞车。
 *
 * 为什么用递归 `setTimeout` 而不是 `setInterval`：间隔随活跃度变化，
 * 每跳重新取一次基准 + 新抖动，`setInterval` 做不到（改间隔等于重置定时器）。
 */
/** 有 running 任务时的轮询基准（毫秒）。 */
export declare const POLL_ACTIVE_MS = 2000;
/** 空闲时的轮询基准（毫秒）。 */
export declare const POLL_IDLE_MS = 5000;
/** 抖动幅度（相对值）：±20%。 */
export declare const POLL_JITTER = 0.2;
/** 统一轮询的入参。 */
export interface UnifiedPollingOptions {
    /** 是否有 running 任务（决定 2s / 5s 节奏）。 */
    readonly active: boolean;
    /** 每一跳要做的事（刷新项目/任务/素材/运行/导出）。 */
    readonly onTick: () => void;
    /** 是否启用（座位不可见时不启，省掉无意义往返）。 */
    readonly enabled?: boolean;
    /** 抖动源（测试注入确定性随机）。 */
    readonly random?: () => number;
}
/**
 * 算一跳的实际间隔：基准 × (1 ± 20%)。
 * @param baseMs - 基准间隔（毫秒）。
 * @param random - [0,1) 随机源。
 * @returns 抖动后的间隔（毫秒，至少 50ms）。
 */
export declare function jitteredInterval(baseMs: number, random?: () => number): number;
/**
 * 挂载统一轮询：一个定时器链，按活跃度换基准，隐藏即停。
 * @param options - 见 {@link UnifiedPollingOptions}。
 */
export declare function useUnifiedPolling({ active, onTick, enabled, random, }: UnifiedPollingOptions): void;
