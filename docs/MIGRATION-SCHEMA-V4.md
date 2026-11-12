# 工作台数据版本（schemaVersion）

**当前只认 `schemaVersion: 1`**，没有迁移链。

## 读入规则

| 文件情况 | 行为 |
| --- | --- |
| 缺少 `schemaVersion`，或等于 1 | 按当前结构归一化后读入 |
| 任何其他版本（含早期的 2–5） | 原文件整份复制为 `workbench.json.legacy-v<N>`，宿主打印一条 warning，然后以**空工作台**重开并写入 v1 |

备份文件不会被删除，也不会被读回；需要旧数据时由用户自行取用。

## 为什么取消迁移

2026-11-11 之前每个界面轮次都会抬 `schemaVersion` 并维护一条 vN→vN+1 的迁移函数。
预发布阶段这份迁移链没有真实用户数据需要保护，却在每次改结构时增加双份测试与"半懂字段写回磁盘"的风险。
现在改为：**结构改动直接改归一化逻辑，版本号保持 1；旧文件留证后重开**。

## 涉及代码

- 版本常量：`src/workbench/records.ts` 的 `WORKBENCH_SCHEMA_VERSION`
- 读入与留证：`src/workbench/store.ts` 的 `readDocument()`
- 归一化：同文件的 `normalize()`（缺字段补默认值，非法值丢弃）
