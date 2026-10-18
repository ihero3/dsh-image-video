/**
 * 数据迁移框架（Track A / A7，对应总任务书 §8.1「支持数据格式版本 / 支持错误恢复和项目迁移」）。
 *
 * 规则：
 * - 数据文件带 `schemaVersion`；读取时按迁移链逐级升级（v1→v2→v3…）；
 * - **只升不降**：文件版本比插件新 → 明确拒绝并给出可操作提示（避免半懂不懂地写坏数据）；
 * - 找不到升级路径也拒绝（不猜字段）；
 * - 真正发生迁移时，store 会先把原始文件备份成 `<file>.pre-migrate-v<N>` 再落盘。
 */
import { WORKBENCH_SCHEMA_VERSION } from './records.ts'

/** 一级迁移：把 `from` 版本文档升级成 `to` 版本。 */
export interface WorkbenchMigration {
  readonly from: number
  readonly to: number
  /** 人类可读的说明（写进日志/CHANGELOG）。 */
  readonly describe: string
  /** 纯函数：返回升级后的文档（不要原地修改入参）。 */
  readonly migrate: (document: Record<string, unknown>) => Record<string, unknown>
}

/**
 * 当前已登记的迁移链。V1 是首版，因此为空；将来加字段时在这里追加 `{from:1,to:2,...}`。
 * 例：`{ from: 1, to: 2, describe: 'tasks 增加 projectId', migrate: doc => ({ ...doc, schemaVersion: 2 }) }`
 */
export const WORKBENCH_MIGRATIONS: readonly WorkbenchMigration[] = [
  {
    from: 1,
    to: 2,
    describe: 'v2：资源补 scope（默认 project）、时间轴补 exportFormat 缺省、文档补 resourceUsage 列表',
    migrate: document => ({
      ...document,
      schemaVersion: 2,
      resources: (document.resources as Array<Record<string, unknown>> | undefined ?? [])
        .map(resource => ({ scope: 'project', ...resource })),
      timelines: (document.timelines as Array<Record<string, unknown>> | undefined ?? [])
        .map(timeline => ({ ...timeline })),
      resourceUsage: document.resourceUsage ?? [],
    }),
  },
  {
    from: 2,
    to: 3,
    describe: 'v3：片段支持特效（speed/fade/crop）与跨段转场（transition）——字段均可选，无需改写旧数据',
    migrate: document => ({ ...document, schemaVersion: 3 }),
  },
]

/** 迁移结果。 */
export interface MigrationResult {
  /** 升级后的文档。 */
  readonly document: Record<string, unknown>
  /** 实际应用的迁移（按顺序；空 = 本来就是当前版本）。 */
  readonly applied: readonly WorkbenchMigration[]
  /** 原始版本号。 */
  readonly fromVersion: number
  /** 升级后的版本号。 */
  readonly toVersion: number
}

/**
 * 把任意版本的工作台文档升级到当前版本。
 * @param raw - 读到的原始对象。
 * @param migrations - 迁移链（默认 {@link WORKBENCH_MIGRATIONS}，测试可注入）。
 * @returns 升级结果。
 * @throws {Error} 文件来自更新版本、或找不到升级路径时。
 */
export function migrateDocument(
  raw: Record<string, unknown>,
  migrations: readonly WorkbenchMigration[] = WORKBENCH_MIGRATIONS,
): MigrationResult {
  const declared = raw.schemaVersion
  const fromVersion = typeof declared === 'number' && Number.isFinite(declared) ? Math.trunc(declared) : 1
  if (fromVersion > WORKBENCH_SCHEMA_VERSION) {
    throw new Error(
      `工作台数据是更新的版本（schemaVersion ${fromVersion} > 插件支持的 ${WORKBENCH_SCHEMA_VERSION}）：`
      + '请升级插件后再打开，或先用旧版本导出项目包。继续打开可能写坏数据，已停止。',
    )
  }
  let document = raw
  let version = fromVersion
  const applied: WorkbenchMigration[] = []
  while (version < WORKBENCH_SCHEMA_VERSION) {
    const step = migrations.find(candidate => candidate.from === version)
    if (step === undefined) {
      throw new Error(
        `找不到 schemaVersion ${version} → ${WORKBENCH_SCHEMA_VERSION} 的升级路径：`
        + '请升级插件，或把数据文件备份后手工迁移（不要直接改 schemaVersion 硬骗过去）。',
      )
    }
    document = step.migrate(document)
    applied.push(step)
    version = step.to
  }
  return { document, applied, fromVersion, toVersion: version }
}
