import type { WorkbenchApi } from './api.ts';
import type { WorkbenchLocaleKey } from './locales.ts';
/** 卡片 props。 */
export interface VoiceCardProps {
    readonly api: WorkbenchApi;
    readonly t: (key: WorkbenchLocaleKey) => string;
    /** 当前时间轴 id；没有时间轴时只显示状态与提示。 */
    readonly timelineId?: string;
}
/**
 * 配音卡片。
 * @param props - 见 {@link VoiceCardProps}。
 * @returns 状态行 + 「生成配音计划」按钮 + 计划摘要。
 */
export declare function VoiceCard(props: VoiceCardProps): import("react").JSX.Element;
