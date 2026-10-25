# 发布说明：dsh-image-video v1.0.0（workbench 78）

> 发布日 2026-10-22 · 插件版本 `1.0.0` · 工作台迭代号 78
> 上一个版本：`0.3.77-workbench-77`

## 一句话

这一版把**画布依赖从插件产物里搬到了宿主平台模块表**：入口产物从 87% 预算落到 39%，
同时补齐示例项目包、3 分钟演示脚本和数据迁移说明——「能跑」升级为「能交付」。

## 1. 体积改造（本版核心）：自包含 + 按需加载

**做法（v1.0.0 定稿）**：插件入口只做注册（44.8 KB），整套界面——含 `@xyflow/react`（React Flow +
`d3-*` 闭包）——打包成**插件自己的包内 chunk**，首次打开工作台时经宿主的 `require.async` 按需取。

| 口径 | 改前（全部内联进入口） | v1.0.0 | 变化 |
| --- | --- | --- | --- |
| 入口 `lib/client/plugin.js` | 834,204 B / 180,161 B(gz) | **44,782 B / 15,013 B(gz)** | −94.6% / −91.7% |
| 包内 chunk（打开工作台才下载） | — | 793,139 B / 166,771 B(gz) | 新增 |
| 总产物 | 834,204 B | 837,921 B | +0.4%（同一份库，改成按需） |

- **宿主零改动、插件自包含**：装到**任何** DSH（含上游原版）都有画布，不要求宿主先加平台词、
  也不需要为插件升级宿主。这是本版放弃"宿主模块表外置"方案的原因（那条路要求用户先换宿主，
  第三方安装者会直接没有画布）。
- **为什么不做"入口 + 多个 chunk"**：宿主的 `require` 是**同步查表**，取不到尚未 `require.async`
  回来的 chunk；入口与 chunk 一旦有共享模块，rolldown 会提升出中间 chunk → 整包 materialize 抛错。
  所以入口做成"零界面依赖"，共享问题从根上消失。
- 守门：`tests/client-bundle.test.ts` 6 条断言（入口只请求宿主基线词、入口内是
  `require.async("./client.Workbench.js")`、入口无 `react-flow__` 且 <120 KB、`dsh.client.external` 为空、
  chunk 以 `<包名>/client.Workbench.js` 注册、chunk 自带 React Flow）；`check:bundle` **同时守
  入口与总产物**两个口径。

## 2. 模型流重试恢复（宿主侧改动）

工作台本身不承载 LLM 重试；这项是宿主能力在桌面 profile 的落地：

- **真问题不是插件没挂**：`@deepseek-ai/dsh-llm-retry` 早已在 base bundle 里，且没有
  `disabled`；它本身**没有配置**，`retryPolicy` 挂在各 provider 上，缺省是 `normal` + 5 次
  + 500ms 起退避。
- **丢的是 profile 里的策略**：桌面 profile 的 `llm-pi-ai.providers.threevideo` 一度没有
  `retryPolicy` 段，于是回落到框架默认。现已按 fork 台账 **R26** 恢复：
  `mode: normal`、`maxRetries: 8`、退避 `1000 → 20000ms`，重试码用默认五类瞬时错误
  （`TRANSPORT` / `SERVER` / `TIMEOUT` / `RATE_LIMIT` / `EMPTY_RESPONSE`）。
  刻意**不用** `mode: always`——确定性错误（参数非法、内容被拒）必须立刻收手。
- 宿主侧回归守卫：`packages/bundle/base/tests/base.spec.ts` 断言该行必须被挂载且未被禁用。
- ⚠️ **口径说明**：交接里写的是「重试 5 次」，与 fork 台账 R26（8 次 + 1s→20s 退避）不一致。
  本版按**台账**恢复（它是这条定制的权威判据）；若确实要 5 次，改 profile 里
  `retryPolicy.maxRetries` 一行即可，其余不变。

## 3. 新增交付件（P1）

| 文件 | 用途 |
| --- | --- |
| [`examples/hello-workbench/`](../examples/hello-workbench/README.md) | 可直接导入的示例项目包（包格式 v3，含素材/资源/工作流/时间轴），由真实导出实现生成 |
| [`docs/DEMO-3MIN.md`](./DEMO-3MIN.md) | 3 分钟演示脚本（分镜 + 时间码 + 预期画面 + 录制注意） |
| [`docs/MIGRATION-SCHEMA-V4.md`](./MIGRATION-SCHEMA-V4.md) | 工作台数据 `schemaVersion` v1→v4 迁移说明（用户看什么、出错怎么修） |
| [`scripts/smoke-export.ts`](../scripts/smoke-export.ts) | 零花费导出冒烟：ffmpeg 本地合成夹具 → 真实导出 → 断言成片/封面/字幕/登记 |

## 4. 升级步骤

1. 更新插件到 `1.0.0`（`lib/` 随包分发，无需本地构建）。
2. **重启桌面宿主**：平台模块表在启动时装配，热更新不足以让它出现新模块词。
3. 打开工作台，确认两处：
   - `GET /image-video/status` 返回的 `version` 为 `1.0.0`（**以宿主端点为准**，界面头部
     可能来自旧客户端实例）；
   - 画布能正常渲染（说明 `@xyflow/react` 命中了模块表）。
4. 首次打开会触发数据迁移（见迁移说明），迁移前会自动备份 `<file>.pre-migrate-v<N>`。

## 5. 兼容性

| 面 | 兼容性 |
| --- | --- |
| 工作台数据 `schemaVersion` | 1→4 自动迁移（只升不降；比插件新的数据会明确拒绝并提示） |
| 项目包 `formatVersion` | 支持 1..3 导入；本版导出 3 |
| 旧宿主 / 上游原版宿主 | **兼容**：插件自包含（界面走包内 chunk），不要求宿主新增任何平台词 |
| 宿主：插件对 | 插件仍只依赖稳定的客户端服务（connection / locale / slots / sidebar-right），无新增服务依赖 |

## 6. 发布前验收清单

- [x] `pnpm run build` 产出 `lib/**`，`lib/index.js` 里 `PLUGIN_VERSION = "1.0.0"`
- [x] `pnpm run check:bundle` 通过：入口 44,782 B / 预算 53,736 B（83%）；总产物 837,921 B / 预算 1,005,504 B（83%）
- [x] `pnpm run typecheck` 退出码 0（宿主 + 客户端两个 tsconfig）
- [x] `npx vitest run`：**822 passed / 5 skipped**，144 个套件通过、0 失败
- [x] 宿主侧：`base.spec.ts` / `client/modules` / `client/web` 共 **209 passed**，`build:lib:client` 全量构建通过
- [x] 版本四处一致：`package.json` / `src/version.ts` / `CHANGELOG` 最新条目 / 构建产物
- [x] 示例项目包可导入：`npx vitest run tests/example-package.test.ts`
- [ ] **真实生成验收（owner 执行，会产生费用）**：图片 1 次 + 视频 1 次，各留任务 id 与产物路径
- [x] **零花费导出冒烟**（本机已跑通，可复现）：
  `npx tsx scripts/smoke-export.ts` → 本地 ffmpeg 合成 3 秒夹具 → 真实导出 →
  成片 76,309 B / 3000 ms、封面帧、随片 SRT、成片自动登记素材、台账 1 条 succeeded，
  **全程 0 次模型调用**。
- [ ] 打 tag `v1.0.0-workbench-78` 并推送——**需 owner 明确指令**（本项目约定：git 写操作听 owner）

## 7. 已知缺口（不粉饰）

- **画布样式表仍是副本**：`src/client/canvas-style.ts` 是从 `@xyflow/react` 官方 CSS 同步来的
  内嵌副本，升级 React Flow 大版本时必须重跑 `scripts/sync-canvas-style.mjs`，否则画布样式
  会与新版本运行时不匹配。本版未改成运行时注入（宿主不提供 CSS 通道）。
- **演示「录制」不在仓库里**：录制需要一次真实图片生成（花费），按约定由 owner 执行；
  脚本、分镜与录制注意事项已就绪（`docs/DEMO-3MIN.md`）。
- **示例包只覆盖格式与导入**：`examples/hello-workbench` 验证的是「包能导入且完整」，
  不包含真实生成产物（那是真实生成验收的事）。
- **重试策略挂在宿主**：工作台侧无法自我验证 5xx 重试，只能由宿主侧测试与真机日志证明
  （`llm/retry` 事件会落盘在会话里）。

## 8. 发布记录（2026-10-23）

| 项 | 值 |
| --- | --- |
| 插件仓库 | `ihero3/dsh-image-video@a41417c`（main；含最终 `lib/` 产物，构建已验证幂等） |
| 发布 tag | `v1.0.0-workbench-78` → 本提交 |
| Harness 仓库 | `ihero3/deepseek-harness@840dd40`（Fork A-6 平台词 + A-10 守卫 + 指针 bump） |
| 子模块指针 | `plugins/dsh-image-video` → `a41417c` |
| 发布门禁 | `bash scripts/gate.sh` **5/5 全绿**（typecheck / 822 passed / build / 427,503 B / 覆盖度 83.83·72.46·83.2·86.81） |

**重启后真机核对（2026-10-23 20:32，已通过）**：

| 检查 | 结果 |
| --- | --- |
| `GET /image-video/status` | `version: 1.0.0`（新宿主进程，端口 61687） |
| 启动图里的插件行 | **`external: null`** —— 插件不向宿主索要任何平台词（宿主壳已回退，不含 `@xyflow/react`） |
| 入口产物 | 200、39,347 B、含 `require.async("./client.Workbench.js")` |
| 包内 chunk | 200、778,226 B、注册为 `chunk: "client.Workbench.js"`、内含 React Flow |
| 工作台挂载 | 7 个面板（画布/体检/素材/预览/资源/任务/诊断） |
| **画布真机渲染** | 切「专业工作流」后 **5 个 `.react-flow__node` + 2 条边 + 1 个 viewport** 全部渲染 → **自包含 chunk 在真实 Electron 宿主里加载成功**，控制台只有一条与插件无关的 `/plugins/events` 重连失败 |

> 这条证据的意义：宿主**没有** `@xyflow/react` 平台词，插件仍然渲染出画布 ——
> 即"任何人装了这个插件就有画布"，与宿主版本无关。

重启前的旧进程实测仍是 `0.3.77`（预期）：

```bash
curl -s http://127.0.0.1:54274/image-video/status   # 重启后 version 应为 1.0.0
npx tsx scripts/smoke-export.ts                     # 零花费导出冒烟（不调用模型）
```

> 注：`lib/` 是入库产物。若本机工具链版本与锁文件不一致，`pnpm run build` 可能只产生
> 空行/注释缩进级差异——用 `git diff lib` 确认无语义变化即可，不必惊慌。
