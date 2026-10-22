import type { TimelineRecord } from '../../workbench/timeline.ts';
import type { WorkbenchLocaleKey } from '../locales.ts';
interface TimelineSegmentPreviewProps {
    readonly timeline: TimelineRecord | undefined;
    readonly t: (key: WorkbenchLocaleKey) => string;
}
export declare function TimelineSegmentPreview({ timeline, t }: TimelineSegmentPreviewProps): import("react").JSX.Element;
export {};
