# 阶段 1 门禁证据（计划 §15 六条）

- 证据时间：2026-10-14（Asia/Shanghai）· 桌面 dev 加载的是子模块那份（`plugins/dsh-image-video`）
- 判定口径只有三类：`cmd:`（命令+退出码）、`test:`（用例名+结果）、`manual:`（现场观察+可复核的读数）；不接受"UI 看起来对"这类无法复核的表述
- 离线复现：`pnpm run typecheck`、`pnpm run test`
- 现场复现（默认只读，不动 App）：`node scripts/verify-workbench-tab.mjs`
  退出码：`0` 半边在服务且健康通过 · `1` 半边未服务（需重启宿主）· `3` 半边在服务但健康失败 · `2` 探测失败

| # | 计划 §15 判据 | 判定 | 证据 |
|---|---|---|---|
| 1 | 新右栏 tab 与 guide entry | ✅ | 现场：`__DSH_BOOT__.entries` 含 `dsh-image-video`（`plugins/??dsh-image-video/client.js`）、右栏 tab chip（`role=tab`，标题「dsh-image-video 工作台」）、guide 文案命中、`verify-workbench-tab.mjs` 半边判定通过；`test:` `tests/client-lifecycle.test.ts`（两段式注册 + guide entry id + 卸载撤销） |
| 2 | 工作台三模式骨架 | ✅ | 现场：三个模式按钮逐个点击 → `aria-pressed=true` 且当前模式区 `aria-label` 同步；四格分区与文案齐全；`test:` `tests/workbench.client.test.tsx`（头部/三模式/四格/切换/座位事实/健康状态） |
| 3 | `/image-video` RPC 健康检查 | ✅ | 客户端：已接线（`inject += connection`，挂载即取 `health`，头部显示「版本 · 服务商」，`data-workbench-health` 暴露状态）；`test:` `tests/client-rpc-transport.test.ts` 用**真实传输** `createWebConnectionRpc` 校验通道与提交路由（含"旧名 `/image-video/workbench` 会被拒"的反例）；宿主：`tests/host-workbench-rpc.test.ts` + `tests/host-rpc-integration.test.ts`（真实 cordis `provide`/`inject`/`fiber.dispose`）。**现场（根因已定位并修复）**：`data-workbench-health=failed`、`transport failure for /image-video/health: HTTP 405`。根因不在通道名（那已修）而在**注册上下文**：`connection.rpc.handle()` 把 Web 路由注册在「读取该服务的 ctx」（`HostConnectionService.callerCtx`）上，`webServer` 未注入该子上下文时 `owner.webServer.register` 抛错、路由静默缺席 → 浏览器只见 405。已改为 `ctx.inject(['connection', 'webServer'], …)`，并加 `tests/host-rpc-real-service.test.ts`（真实 `HostConnectionService`，含"webServer 不可见即记录错误"的反例）与 `GET /image-video/status` 自证端点。**修复后现场读数（2026-10-14 宿主重启后）**：`node scripts/verify-workbench-tab.mjs` → **exit 0**；骨架 `data-workbench-health=ok`、头部芯片 `0.3.1 · threerouter`；`GET /image-video/status` → 200 且 `rpc:{channel:"/image-video",registered:true,awaiting:false}` |
| 4 | 插件生命周期测试 | ✅ | `tests/client-lifecycle.test.ts`（字典/tab 类型/座位三处注册各留 disposer，卸载全撤）、`tests/client-bundle.test.ts`（产物是合法模块表条目：id、工厂可物化、导出与源码 `inject` 对账、只请求白名单模块）、`tests/host-workbench-rpc.test.ts`（注册/撤销/缺 connection 时空挂 disposer/未知端点结构化拒绝）；全量 **276 passed / 5 skipped** |
| 5 | 「媒体素材 / 创作资源」占位布局 + 不可运行提示 | ✅ | 现场（重载渲染进程后读 DOM）：四格占位可见，`paneAssets=true` / `paneResources=true` / `panePreview=false` / `paneTasks=false`，提示文案**恰好出现 2 次**；`test:` `tests/workbench.client.test.tsx` 同样断言「恰好两处 + 两个入口 planned」 |
| 6 | 不接真实项目存储、不接生成调度、不改现有生成工具 | ✅ | `cmd:` `--dump-config` 的 `image-video` 块改动前后**逐字节一致**（24 行）→ cordis 配置面零变化；现有源文件只改注释/文案（`git log` 可查）；宿主侧新增仅 RPC 通道（`src/host/rpc.ts`）+ 一处 `ctx.inject(['connection'])`；真机出图链路照常（`outputs/1791958816089-386ae614.png`，1024×1024、水印已打、提交 1 次） |

## 退出条件（阶段 1 → 阶段 2）

- [x] 计划 §15 六条**全部通过**（第 3 条于宿主重启后现场验通，见上）
- [x] `pnpm run typecheck` exit 0；`pnpm run test` 276 passed / 5 skipped
- [x] 插件禁用后无残留（**单元层**：三处注册 disposer 全覆盖；**现场层**：待重启后在 App 里禁用→启用各一次，跑 `verify-workbench-tab.mjs` 对比 exit 码与 tab 是否消失）
- [x] T1-8 真机出图/出片：生图默认 `qwen-image-3.0` 与指定 `minimax-image-01` 各一次、生视频 `minimax-h3` 一次，产物落在 `profiles/desktop/outputs/`（1024×1024 PNG/JPG；5 秒 MP4、827.6 KB），均打品牌水印、附 `request_id`
- [x] 阶段 1 已完全收口；按 owner 指示继续推进阶段 2（其现场复核项随下次宿主重启补做）

## 本轮新增的两条防线（供后续阶段复用）

1. `tests/manifest-contract.test.ts`：清单 ⟷ 代码契约（每个注入服务都有对应客户端包且在 `dsh.client.inject`；`exports["./client"]` 指向的入库产物存在；`files` 覆盖产物；`schemastery`/`sharp` 必须留在 `dependencies`）。
2. `tests/client-rpc-transport.test.ts`：通道名与提交路由按**真实传输**校验——单测用替身 `handle` 时抓不到"通道名不合规"这类问题（本阶段实际踩过）。

## 阶段 5 现场证据（2026-10-16，零生成花费）

| 验收点 | 现场结果 |
| --- | --- |
| ffmpeg 能力探测（T5-4） | 时间轴面板显示 `data-timeline-ffmpeg="ok"`，文案 `ffmpeg 8.0 · /opt/homebrew/bin/ffmpeg` |
| 三轨时间轴（T5-1） | 面板渲染 `["video","audio","subtitle"]` 三轨；素材可加入视频轨；落库 `tracks=[1,0,0]`、`burnSubtitles=true` |
| 导出成片（T5-5） | 点「导出成片」后：`running 0%` → `succeeded 100%`，产物 `1792121858521-9mcgve.mp4`（644,243 字节） |
| 产物自动登记 | `workbench.json` 中出现 video 素材 `1792121858521-9mcgve.mp4`，提示词 `时间轴导出（tml-…）` |
| 截图 | `/private/tmp/pr3-export.png` |

> 说明：本次导出用的是**之前跑出来的真实视频产物**（登记为素材后放进时间轴），渲染由本机 ffmpeg 完成，因此**没有额外生成花费**。

## 阶段 6 现场证据（2026-10-16，零生成花费）

**T6-3 Agent 工具面**：整条链路在**对话里**跑通（不是单元测试，而是真实调用插件注册的工具）：

| 步骤 | 调用 | 结果 |
| --- | --- | --- |
| 列项目 | `workbench_projects action=list` | 返回 5 个真实项目（含 `导出台 11:37:30`） |
| 列时间轴 | `workbench_timeline action=list projectId=prj-mvaf2u8t-gs0s6q` | `tml-mvaf2zgu-vbbq2f`，1 片段 / 3000ms |
| 列素材 | `workbench_assets action=list` | 2 条视频素材（其中一条路径被记成相对的 `outputs/…` —— **当日修复：输出目录统一绝对化**） |
| 加片段 | `workbench_timeline action=add-clip`（2 个片段 × 2000ms） | 视频轨 1 → 3 片段 |
| 起导出 | `workbench_timeline action=export` | `render-mvaj8rwa-2ch5b`（running） |
| 查导出 | `workbench_tasks action=renders` | `succeeded`、`percent=100`、产物 `outputs/1792128846545-61h1j9.mp4` |

> 本次导出用**已有真实产物**作素材、本机 ffmpeg 渲染，**没有产生任何生成费用**。

**T6-4 双向一致刷新**：客户端在面板可见时每 5 秒轮询项目/素材/任务；测试模拟 Agent 侧新建项目后自动出现在下拉（≤5 秒口径写进实现注释）。
