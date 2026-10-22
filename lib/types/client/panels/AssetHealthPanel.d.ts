import type { WorkbenchApi } from '../api.ts';
import type { WorkbenchLocaleKey } from '../locales.ts';
interface AssetHealthPanelProps {
    readonly api: WorkbenchApi;
    readonly formatBytes: (bytes: number) => string;
    readonly t: (key: WorkbenchLocaleKey) => string;
}
export declare function AssetHealthPanel({ api, formatBytes, t }: AssetHealthPanelProps): import("react").JSX.Element;
export {};
