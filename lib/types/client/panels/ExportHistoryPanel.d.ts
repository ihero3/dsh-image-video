import type { ExportRecord, WorkbenchApi } from '../api.ts';
import type { ProjectRecord } from '../../workbench/records.ts';
import type { WorkbenchLocaleKey } from '../locales.ts';
interface ExportHistoryPanelProps {
    readonly api: WorkbenchApi;
    readonly projects: readonly ProjectRecord[];
    readonly formatBytes: (bytes: number) => string;
    /** 父级在导出收尾时自增，触发面板刷新（运行中的记录要能看到终态）。 */
    readonly refreshTick: number;
    /** 重试入口：交给工作台记账 + 重渲，面板不直接碰渲染端点。 */
    readonly onRetry: (record: ExportRecord, label: string) => void;
    readonly t: (key: WorkbenchLocaleKey) => string;
}
export declare function ExportHistoryPanel({ api, projects, formatBytes, refreshTick, onRetry, t }: ExportHistoryPanelProps): import("react").JSX.Element;
export {};
