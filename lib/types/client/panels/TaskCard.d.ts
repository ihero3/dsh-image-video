import type { WorkbenchApi } from '../api.ts';
import type { MediaKind, TaskRecord } from '../../workbench/records.ts';
import type { WorkbenchLocaleKey } from '../locales.ts';
export interface TaskCardProps {
    readonly api: WorkbenchApi;
    readonly task: TaskRecord;
    /** 当前项目；无项目时禁用「登记素材」。 */
    readonly projectId: string | undefined;
    /** 已本地化的任务状态。 */
    readonly statusLabel: string;
    /** 状态圆点类名。 */
    readonly dotClass: string;
    /** `模型 · 大小 · 时间` 摘要。 */
    readonly metaText: string;
    readonly onPreview: (path: string, kind: MediaKind) => void;
    /** 把产物路径塞回快速生成的参考图选择器。 */
    readonly onUseAsReference: (path: string, kind: MediaKind) => void;
    /** 追加到当前项目时间轴；无项目/时间轴不可用时为 `undefined`。 */
    readonly onAddToTimeline: ((path: string) => void) | undefined;
    readonly onTasksChanged: () => Promise<void>;
    readonly onAssetsChanged: () => Promise<void>;
    readonly onNotice: (text: string, tone: 'info' | 'error') => void;
    /** 宿主动作包装：统一 busy 与失败通知。 */
    readonly run: (action: () => Promise<void>) => void;
    readonly t: (key: WorkbenchLocaleKey) => string;
}
export declare function TaskCard(props: TaskCardProps): import("react").JSX.Element;
