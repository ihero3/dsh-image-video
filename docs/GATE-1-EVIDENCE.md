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
| 3 | `/image-video` RPC 健康检查 | ⏳ 宿主半边 | 客户端：已接线（`inject += connection`，挂载即取 `health`，头部显示「版本 · 服务商」，`data-workbench-health` 暴露状态）；`test:` `tests/client-rpc-transport.test.ts` 用**真实传输** `createWebConnectionRpc` 校验通道与提交路由（含"旧名 `/image-video/workbench` 会被拒"的反例）；宿主：`tests/host-workbench-rpc.test.ts` + `tests/host-rpc-integration.test.ts`（真实 cordis `provide`/`inject`/`fiber.dispose`）。**现场（根因已定位并修复）**：`data-workbench-health=failed`、`transport failure for /image-video/health: HTTP 405`。根因不在通道名（那已修）而在**注册上下文**：`connection.rpc.handle()` 把 Web 路由注册在「读取该服务的 ctx」（`HostConnectionService.callerCtx`）上，`webServer` 未注入该子上下文时 `owner.webServer.register` 抛错、路由静默缺席 → 浏览器只见 405。已改为 `ctx.inject(['connection', 'webServer'], …)`，并加 `tests/host-rpc-real-service.test.ts`（真实 `HostConnectionService`，含"webServer 不可见即记录错误"的反例）与 `GET /image-video/status` 自证端点。**当前读数**：`/image-video/status` → 404（宿主仍是旧 bundle）——私有插件无 in-app 重载入口（插件面板只列内置插件，「刷新」不重扫）。**解除动作**：重启宿主进程后跑 `node scripts/verify-workbench-tab.mjs`，期望 exit 0 |
| 4 | 插件生命周期测试 | ✅ | `tests/client-lifecycle.test.ts`（字典/tab 类型/座位三处注册各留 disposer，卸载全撤）、`tests/client-bundle.test.ts`（产物是合法模块表条目：id、工厂可物化、导出与源码 `inject` 对账、只请求白名单模块）、`tests/host-workbench-rpc.test.ts`（注册/撤销/缺 connection 时空挂 disposer/未知端点结构化拒绝）；全量 **276 passed / 5 skipped** |
| 5 | 「媒体素材 / 创作资源」占位布局 + 不可运行提示 | ✅ | 现场（重载渲染进程后读 DOM）：四格占位可见，`paneAssets=true` / `paneResources=true` / `panePreview=false` / `paneTasks=false`，提示文案**恰好出现 2 次**；`test:` `tests/workbench.client.test.tsx` 同样断言「恰好两处 + 两个入口 planned」 |
| 6 | 不接真实项目存储、不接生成调度、不改现有生成工具 | ✅ | `cmd:` `--dump-config` 的 `image-video` 块改动前后**逐字节一致**（24 行）→ cordis 配置面零变化；现有源文件只改注释/文案（`git log` 可查）；宿主侧新增仅 RPC 通道（`src/host/rpc.ts`）+ 一处 `ctx.inject(['connection'])`；真机出图链路照常（`outputs/1791958816089-386ae614.png`，1024×1024、水印已打、提交 1 次） |

## 退出条件（阶段 1 → 阶段 2）

- [x] 计划 §15 六条中 1/2/4/5/6 已过；第 3 条只差宿主重启（判定与解除动作见上）
- [x] `pnpm run typecheck` exit 0；`pnpm run test` 276 passed / 5 skipped
- [x] 插件禁用后无残留（**单元层**：三处注册 disposer 全覆盖；**现场层**：待重启后在 App 里禁用→启用各一次，跑 `verify-workbench-tab.mjs` 对比 exit 码与 tab 是否消失）
- [x] T1-8 真机出图/出片：生图默认 `qwen-image-3.0` 与指定 `minimax-image-01` 各一次、生视频 `minimax-h3` 一次，产物落在 `profiles/desktop/outputs/`（1024×1024 PNG/JPG；5 秒 MP4、827.6 KB），均打品牌水印、附 `request_id`
- [ ] 阶段 1 完全收口后**才**进入阶段 2（门禁：计划 §9）

## 本轮新增的两条防线（供后续阶段复用）

1. `tests/manifest-contract.test.ts`：清单 ⟷ 代码契约（每个注入服务都有对应客户端包且在 `dsh.client.inject`；`exports["./client"]` 指向的入库产物存在；`files` 覆盖产物；`schemastery`/`sharp` 必须留在 `dependencies`）。
2. `tests/client-rpc-transport.test.ts`：通道名与提交路由按**真实传输**校验——单测用替身 `handle` 时抓不到"通道名不合规"这类问题（本阶段实际踩过）。
