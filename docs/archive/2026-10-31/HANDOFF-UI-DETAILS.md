# 界面细节交接（v1.0.0-workbench-78 之后）

> 给接手界面细节的同学：先看这里，再动代码。基线：`ihero3/dsh-image-video@39c0225`（tag `v1.0.0-workbench-78`）。

## 1. 先把环境跑对（顺序不能反）

```bash
# ① 重启桌面宿主 —— 必须！壳的平台模块表只在启动时装配
#    （本次 A-6 把 @xyflow/react 放进了宿主模块表；旧进程里没有这个词）
# ② 核对运行态版本（界面头部可能来自旧客户端实例，以这个端点为准）
curl -s http://127.0.0.1:54274/image-video/status     # version 应为 1.0.0

# ③ 改插件后的刷新（二选一）
#    A. 只改界面（src/client/**）——**不用重启**：起一个 watch，存盘即生效（HMR 500ms 轮询产物 mtime）
cd <harness 仓库根> && sh scripts/dev-watch-plugin.sh
#    B. 改了宿主半边（src/host|workbench|media|tools）——必须重启（Node 模块不热替换）
cd <harness 仓库根> && sh scripts/refresh-plugin-dev.sh
```

**症状对照**：画布白屏 + 控制台 `require("@xyflow/react") missed the module table`
= 宿主是旧壳（没重启）；界面显示旧版本 = 看到的是旧客户端实例。

## 2. 三条不能碰的红线

1. **客户端产物是自包含单文件**：`lib/client/plugin.js` 一个文件，factory 里只能 `require`
   模块表里有的词。**代码分割/多 chunk 走不通**（实测：chunk 的同步 require 会整包抛错），
   别为了拆包浪费时间——体积问题已经被 A-6 从根上解决了。
2. **`dsh.client.external` 只能写"宿主模块表里有的词"**：现在是 `PLATFORM_MODULES`
   （react / react-dom / cordis / client-store / ui-slots / ui-primitives / ui-dockkit /
   `@xyflow/react`）。要加新词，先改 Harness 侧（`packages/client/web/src/platform.ts` +
   `seed.ts`），再改插件声明——顺序反了就是运行期硬报错。
3. **UI 文案走 locale**：`src/client/locales.ts` 的 `en` / `zh` 两份都要加，
   `WorkbenchLocaleKey` 是类型约束，漏一个编译不过（这是故意的）。

## 3. 体积预算（本版起的新口径）

| 项 | 值 |
| --- | --- |
| 基线 `BUNDLE_BASELINE` | raw 427,503 / gzip 89,329 |
| 预算（+20%） | raw 513,004 / gzip 107,195 |
| 硬天花板（测试） | 入口 < 500,000 B；且**不得**出现 React Flow 内联 |

**界面改动现在只有约 85 KB raw 的余量**（513,004 − 427,503）。加面板/图标/样式前先跑：

```bash
pnpm run build && pnpm run check:bundle
```

超了就按仓库约定：先在 CHANGELOG 说明为什么值得抬，再同步抬 `scripts/bundle-budget.mjs`——
不允许悄悄漂。

## 4. 现在能直接开工的界面项

| # | 项 | 落点提示 |
| --- | --- | --- |
| B-15 | 分镜表 UI（剧本→分镜的表格化编辑） | 宿主侧已就绪：`src/workbench/storyboard.ts` / `workflow` 的 `storyboard`/`script` 节点；**只差界面**（表格 + 逐行编辑 + 一键生成首帧） |
| B-16 | 导出历史面板 | 端点已有：`renders/overview`（含 `recentItems`、`sets` 归组、`diagnosis`）与 `timelines/renders`；客户端 API 在 `src/client/api.ts`，面板照 `PaneBoundary` 写法挂进右栏 |
| B-17 | 发布前 UI 收尾 | 见 [RELEASE-NOTES-v1.0.0.md](./RELEASE-NOTES-v1.0.0.md) §7「已知缺口」：画布样式副本需与新版 React Flow 对齐、演示路径上的文案/空态打磨 |

已有模板可直接抄：`WORKFLOW_TEMPLATES` / `DRAMA_TEMPLATES` 的模板市场面板、
`PaneBoundary`（错误边界）、`VirtualList`（长列表）、`use-unified-poll`（轮询）。

## 5. 每次交付前跑这些（缺一不可）

```bash
pnpm run typecheck                 # 宿主 + 客户端两个 tsconfig
npx vitest run                     # 基线：822 passed / 5 skipped
pnpm run build && pnpm run check:bundle
npx tsx scripts/smoke-export.ts    # 零花费导出冒烟（不调用任何模型）
node scripts/verify-workbench-tab.mjs   # 现场：宿主是否在服务客户端半边
```

## 6. 提交前确认格式版本两件事

- 改数据结构 → 动 `src/workbench/records.ts` 的 `WORKBENCH_SCHEMA_VERSION` 并在
  `migrate.ts` 追加一条迁移（**只升不降**、找不到路径就拒绝、迁移前自动备份）；
- 改项目包格式 → 动 `PACKAGE_FORMAT_VERSION`，并同步 `docs/MIGRATION-SCHEMA-V4.md` 的口径
  （用户会照着那篇修问题）。
