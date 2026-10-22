/**
 * 已用时秒表（`F3` 生成进度）：给一个开始时间戳，每秒推一次渲染。
 *
 * 单独成模块是为了可单测：进度条没有百分比时，界面只能显示"生成中 · 12s"，
 * 这个秒表就是那句话的数据源。`startedAt` 为 `undefined` 时停表（没有在飞的生成）。
 */
/**
 * 从开始时间戳算已用时（整秒），每秒钟推一次。
 * @param startedAt - 开始的毫秒时间戳；`undefined` 表示没有在跑的任务。
 * @returns 已用时秒数；没有在跑的任务时为 `undefined`。
 */
export declare function useElapsedSeconds(startedAt: number | undefined): number | undefined;
