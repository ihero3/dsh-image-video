/** 机器可读的失败码（UI 据此给不同下一步动作）。 */
export type MediaFfmpegCode = 'MEDIA_FFMPEG_UNAVAILABLE' | 'MEDIA_FFMPEG_ENCODER_MISSING' | 'MEDIA_FFMPEG_NOT_EXECUTABLE';
/** 探测结果。 */
export interface FfmpegProbe {
    readonly available: boolean;
    readonly code?: MediaFfmpegCode;
    readonly path?: string;
    readonly version?: string;
    /** 导出需要的两个编码器是否都在。 */
    readonly encoders?: {
        readonly h264: boolean;
        readonly aac: boolean;
    };
    /** 给人看的、可操作的一句话。 */
    readonly message?: string;
}
/** 跑一个命令，返回 stdout（测试可注入）。 */
export type RunCommand = (file: string, args: readonly string[]) => Promise<{
    code: number;
    stdout: string;
    stderr: string;
}>;
/** 环境里可覆盖 ffmpeg 位置的变量名。 */
export declare const FFMPEG_PATH_ENV = "DSH_FFMPEG_PATH";
/** 从 `ffmpeg -version` 输出里取版本号。 */
export declare function parseFfmpegVersion(stdout: string): string | undefined;
/** 从 `-encoders` 输出里看有没有需要的编码器。 */
export declare function parseEncoders(stdout: string): {
    h264: boolean;
    aac: boolean;
};
/**
 * 解析 ffmpeg 并检测特性。解析顺序：`DSH_FFMPEG_PATH` → PATH 上的 `ffmpeg` → 常见安装位置。
 * @param options.env - 环境变量（默认 `process.env`）。
 * @param options.run - 命令执行器（测试注入）。
 * @param options.candidates - 额外候选路径。
 * @returns 探测结果；不可用时 `available: false` 且带 code 与可操作文案。
 */
export declare function probeFfmpeg(options?: {
    env?: Record<string, string | undefined>;
    run?: RunCommand;
    candidates?: readonly string[];
    /** 只认给定候选（不再退回 PATH/常见安装位置）——"检查指定副本"的诊断用。 */
    strict?: boolean;
}): Promise<FfmpegProbe>;
