# v1.0.0 发布前走查记录（Track B · B-17）

> 走查人：同事 B（Track B）。日期：2026-10-24。
> 范围：发布前 UI 收尾的**静态走查**——真实生成端到端（图片 + 视频各一次）
> 需要宿主授权/API key，按同事 A 的分工「需我在场或授权后跑」，**本轮未跑真实生成**，
> 已把待跑清单与操作路径写在下面，A 授权后 10 分钟内可完成。

## 一、本轮交付（B-15 / B-16 / B-17）

| # | 交付 | 测试 |
| --- | --- | --- |
| B-15 | 分镜工坊：剧本 → `storyboard/plan` → 可编辑镜头表（改描述/角色/场景/双提示词、增删、上移下移重排序号）→「带入生成」/「送入画布」（无图片节点则新建，有则改写提示词） | `tests/client-storyboard-edit.test.tsx`（7 项） |
| B-16 | 导出历史面板：`exports/list` 四态徽标 + 产物链接/字节/耗时/失败原因、按项目筛选、空态、失败重试（先 `exports/record` 再重渲）；时间轴导出全链路自动记账并在终态回写 | `tests/client-export-history.test.tsx`（5 项，含集成链路） |
| B-17 | 帮助入口（快捷键 + 模式说明，只写真实绑定的键）、示例项目（一键建项 + 套用 quick-image 模板） | `tests/client-release-polish.test.tsx`（3 项） |

门禁：`pnpm run typecheck` 通过；`tests/client-*` + `workbench.client` + `workflow-canvas.client`
共 36 个文件全绿（较同步前基线 32 文件 +4，新增 15 项测试）。

## 二、静态走查：真实生成路径（代码级 traced，假宿主测试覆盖）

### 图片生成（快速模式）
1. 选项目 → 提示词框输入 → `Ctrl/⌘+Enter`（或点「生成图片」）。
2. 请求体：`media/generate {mediaMode:'image', prompt, projectId, size?}`；
   有参考图时 1 张走 `image`、≥2 张走按序 `images[]`（工具侧 `image` 优先，不混发）。
3. 同步返回 → 素材自动登记 → 预览面板可看 → 结果卡三个动作
   （重新生成 / 用作参考图 / 加入时间轴）均有测试。
4. 分镜工坊「带入生成」只填表不自动生成（用户确认后再发）。

### 视频生成（快速模式）
1. 同上，但 `wait:false`：立刻拿 `taskId`，进度由统一轮询（`tasks/running` 的
   `startedAt` 优先，退化本地点击时间）驱动，显示「生成中 · Ns」+ 不定进度条。
2. 尾帧/参考视频槽走 `media[]`（首帧也必须进 `media`，工具的 `image` 在 `media`
   存在时被忽略）；真人勾选透传 `realPerson`。
3. 取消走 `tasks/cancel`；任务终态（成功/失败/取消）由追踪 effect 收尾并刷新素材。

### 导出链路（时间轴模式）
1. 有视频片段 → 选规格 → 「导出」：先 `exports/record` 记一笔（遥测，记账失败不挡导出），
   再 `timelines/render`。
2. 统一轮询跟进度；终态时 `exports/update` 回写状态/产物/字节/耗时
   （取消映射为 failed + 宿主给的取消原因，不伪装成功）。
3. 导出历史面板可见四态、可按项目筛选、失败可重试（重试同样先记账再重渲；
   不在时间轴模式也会被轮询跟着收尾）。

## 三、待 A 授权后跑的真实走查（截图 + 结论）

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| 1 | 快速模式：图片生成一次（带 1 张参考图） | 出图 → 素材登记 → 预览可见 |
| 2 | 快速模式：视频生成一次（可带尾帧） | 任务进度 → 完成通知 → 素材登记 |
| 3 | 分镜工坊：贴一段剧本 → 拆解 → 改一镜 → 送入画布 | 画布图片节点提示词被改写 |
| 4 | 时间轴：加片段 → 导出 → 看导出历史 | 记录 succeeded + 产物可点开 |
| 5 | 三个模式各截一张图（补 `docs/ui-baseline/`） | 视觉回归基线更新 |

## 四、环境备注（给 A）

1. **本地构建跑不了**：本机 pnpm store 缺 `@jridgewell/sourcemap-codec`
   （`magic-string` 的依赖，`tsdown.config.ts` 要用），`pnpm run build` 在 tsdown 处失败。
   A 的发版构建请重跑 `pnpm run check:bundle`——A-6 后入口已按需加载（入口 −94.6%），
   本轮新增主要在按需块里，预计不触预算，但需要真机构建数字确认。
2. **远端历史被重组**（同步时发现）：`origin/main` 现为一条**分叉 lineage**
   （`478832a`，树里没有 `src/client`、`src/host`、`src/workbench`、`src/media`、
   `docs/` 与 134 个测试文件）；含全部双轨工作的 `38e0314`（v1.0.0）本地完好。
   本轮提交基于 `38e0314`。远端如何 reconcile（re-push 完整树 or 确认重组是有意的）
   需要 A 决定——**在没搞清楚之前不要向 origin 推送**。
3. 帮助浮层只陈述真实快捷键（`Ctrl/⌘+Enter` 生成、`Ctrl/⌘+Z/Shift+Z` 撤销重做、
   空格播放、Delete 删除）；没有绑定的键（如 `Ctrl+S`）没有写进去。
