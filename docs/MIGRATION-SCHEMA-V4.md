# 工作台数据迁移说明（`schemaVersion` v1 → v4）

> 适用：dsh-image-video 1.0.0（工作台迭代 78）
> 代码事实源：[`src/workbench/migrate.ts`](../src/workbench/migrate.ts)、
> [`src/workbench/records.ts`](../src/workbench/records.ts)（`WORKBENCH_SCHEMA_VERSION = 4`）

## 一句话

**你不需要做任何操作。** 插件打开旧数据时会沿迁移链逐级升级（v1→v2→v3→v4），
真正发生迁移前会先备份原文件；数据比插件还新时它会**拒绝打开**而不是将就写入。

## 1. 数据在哪

工作台数据是一个 JSON 文档（projects / assets / resources / timelines / workflows /
tasks / runs / exportPresets），由 `WorkbenchStore` 读写。相对路径取决于部署：

- 桌面开发版：`$DSH_HOME/profiles/<profile>/image-video-workbench/`
- 发布版：插件通过宿主配置的 `workbenchDir` 决定；素材文件在 `outputsDir`（默认 `./outputs`）

迁移只动**文档**，不动素材文件本身。

## 2. 迁移链（逐级、幂等、只升不降）

| 步 | 说明 | 对旧数据的实际改写 |
| --- | --- | --- |
| v1 → v2 | 资源补 `scope`（默认 `project`）、时间轴补 `exportFormat` 缺省、文档补 `resourceUsage` 列表 | 补字段；已有值不覆盖（`{ scope: 'project', ...resource }` 顺序保证不覆盖） |
| v2 → v3 | 片段支持特效（`speed` / `fade` / `crop`）与跨段转场（`transition`） | **不改写**：新字段全部可选，旧片段照常播放 |
| v3 → v4 | 新增用户自定义导出预设库 `exportPresets` | 初始化为空数组，不影响既有数据 |

三条纪律（来自实现，不是承诺）：

1. **只升不降**：`schemaVersion > 4` 时直接报错并停止，绝不"当作 v4 打开"；
2. **找不到路径就拒绝**：迁移链缺环时报错，不猜字段；
3. **迁移前备份**：发生迁移时原文件先落一份 `<file>.pre-migrate-v<N>`，可回滚。

## 3. 你会看到什么

- **首次打开（正常）**：无任何提示，数据直接用；日志里记一条迁移记录（含 from/to）。
- **打开后被要求升级插件**：

  ```
  工作台数据是更新的版本（schemaVersion 5 > 插件支持的 4）：
  请升级插件后再打开，或先用旧版本导出项目包。继续打开可能写坏数据，已停止。
  ```

  含义：这份数据被更新的插件写过。**不要手改 `schemaVersion` 硬骗过去**
  （会丢字段、写坏引用）；升级插件即可。

- **找不到升级路径**：

  ```
  找不到 schemaVersion 2 → 4 的升级路径：请升级插件，或把数据文件备份后手工迁移
  （不要直接改 schemaVersion 硬骗过去）。
  ```

  含义：你的插件版本跳过了中间版本（少见，多出现在手工替换过插件目录时）。
  升级到包含完整迁移链的版本，或保留备份后手工迁移。

## 4. 备份与回滚

迁移前自动备份：`<数据文件>.pre-migrate-v<原版本>`（例如 `workbench.json.pre-migrate-v2`）。

回滚步骤：

1. 关闭宿主（避免运行中写回）；
2. 用备份覆盖当前数据文件，并删除备份（否则下次迁移又生成一份）；
3. 装回旧版插件再打开。

> 反向不成立：新版插件打开过的数据**不能**用旧版插件打开（旧版会因版本更高而拒绝）。
> 要回到旧版，必须用上面的备份，或先用新版导出项目包（包格式向下兼容导入）。

## 5. 别把两套版本号搞混

| 版本号 | 位置 | 范围 |
| --- | --- | --- |
| `schemaVersion` | 工作台数据文档 | 1..4，本版自动迁移 |
| `formatVersion` | 项目包 `manifest.json` | 1..3，本版导出 3、可导入 1..3 |
| 插件版本 | `package.json` / `src/version.ts` / `GET /image-video/status` | 本版 `1.0.0` |

项目包是**跨机器/跨用户**的交换格式；`schemaVersion` 是**本机数据文件**的版本。
导入项目包不会触碰你的数据版本——它只会往当前数据里追加一个项目副本。
