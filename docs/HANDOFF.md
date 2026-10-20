# Track A → Track B 交接清单（`A142`）

> 目的：把这 60 个后端版本攒下的能力**变成界面能用上的东西**。本文只列"界面可以做什么"，
> 契约细节见 `docs/API-SURFACE.md`（端点表由漂移测试守护，永远是最新的）。

## 一、可以立刻接的三个"信息面板"（都是加法字段，老代码不受影响）

| 界面位置 | 用哪个端点 | 能显示什么 |
| --- | --- | --- |
| 导出按钮旁 / 进度条 | `timelines/render` 返回的任务 | `progressStep{current,total}`（第 N 段）· `progressEtaSec`（还要几秒）· `percent` |
| 导出前确认框 | `timelines/preflight` | `summaryLine`（一句人话：能不能导 / 多大 / 多久 / 有没有素材浪费）+ `issues[]` + `estimate` + `usage` |
| 成片列表 / 项目页 | `renders/overview` | `recentItems[]`（**视频 + 封面 + 字幕三件套路径**）+ `running/queued` + `throughput` |

## 二、值得做的交互（按价值排序）

1. **导出前体检弹窗**：`timelines/preflight` → 有阻断问题时禁用"导出"按钮并列出 `issues`；
   没有时显示 `summaryLine` 作为确认文案（用户点之前就知道"多大、要等多久"）。
2. **成片卡片**：`renders/overview` 的 `recentItems[].thumbnailFile` 直接当封面图；
   `outputPath` 做"播放/打开位置"；`subtitleFile` 做"下载字幕"。
3. **失败自助修复**：渲染任务失败时读 `diagnosis`（`{title, hint, actions[]}`）→
   把 `actions` 逐条渲染成建议（不必自己写错误文案）。
4. **字幕互通**：`subtitles/export`（`format: srt | vtt`）导出、
   `subtitles/import`（支持 `offsetMs` 平移）导入现成字幕；导出成片时用
   `timelines/render` 的 `subtitleFormat: 'vtt'` 让随片字幕直接是 Web 平台格式。
5. **清理向导**（三件套，全部"只报告不删除"）：
   `assets/usage`（哪些素材没用）· `assets/duplicates`（同一份存了几遍）·
   `assets/size-report`（哪些最大）· `assets/project-stats`（哪个项目最占地方）
   → 界面做勾选 + 二次确认后调 `assets/remove` / `maintenance/retention`。
6. **自定义导出预设**：`presets/list`（内置 `custom:false` + 自定义 `custom:true`）→
   `presets/save` / `presets/remove`；`timeline set-format presetId` 两种都能用。

## 三、必须知道的坑（踩过）

| 事项 | 说明 |
| --- | --- |
| **数据 schema v4** | 自定义预设是 v4 新增；旧版本宿主**读不了** v4 文件 → 升级后必须重启到 0.3.44+ |
| **lib 先构建再提交** | `lib/` 是入库产物；改动源码后必须 `pnpm run build` 再提交，否则 tag 里是旧代码（`EXECUTION.md` 有完整事故链） |
| **端点/动作必须写文档** | 加端点忘了写 `API-SURFACE.md`、加动作忘了写工具描述 → **漂移测试直接红**（`rpc-contract-drift` / `tool-actions-drift`） |
| **推送前五道门** | `bash scripts/gate.sh`（typecheck / 测试 / 构建 / 体积 / 覆盖率）；日常可用 `--fast`（15s），**但不能作为推送依据** |
| **`projectId` 不再全局必填** | `timeline`/`workflow` 工具只对 `list`/`save`/`runs` 必填（`A67`），别按老文档硬传 |
| **渲染取消即时生效** | 传 `signal` 时若**已 abort**，会立刻返回 `cancelled`（`A138` 修的，别再等 8 秒） |

## 四、质检与证据

- 全量 **724 passed / 5 skipped**（函数覆盖 **83.66%**）
- 一致性测试：工具描述 / RPC 文档 / 版本一致 / 版本连续 / tag 内版本 —— **五条都守着**
- 发布流程：`scripts/release.mjs` → `build` → `gate` → commit → tag → push → Harness 指针

## 五、如果你（B）要改契约

先发消息给 A（或直接改 `API-SURFACE.md` 的"B 申请区"），A 负责：
端点实现、契约文档、漂移测试、`lib/` 构建、子模块指针。
**B 只改 `src/client/**` 与客户端测试**，验收标准相同：`gate.sh` 五道门全绿。

## 六、快速创作「生成」按钮接线（`A145`，B 可直接做）

契约已就绪：`media/generate`。

**请求**（字段与面板上那排「当前生效参数」一一对应）：
```ts
await api.call('media/generate', {
  mediaMode: 'image' | 'video',
  prompt: '……',
  projectId: 当前项目 id,          // 传了就自动登记素材 + 写任务账本
  // image：
  size: '1024*1024', image: 参考图路径或 URL, images: [多参考图],
  // video：
  duration: 5, aspectRatio: '16:9', resolution: '768P', image: 首帧,
  model: 可选覆盖,
})
```

**返回**：`{ mediaMode, path, bytes?, asset?, taskId? }` —— `asset` 可直接插进素材列表，
`taskId` 可用来在「生成任务」里定位那一条。

**注意**：
- 这是**真实计费调用**，按钮要二次确认（"这次会用 threerouter 生成一张 1024*1024 图，约 xx 秒"）。
- **不会自动重试**（生成类禁止自动重试）。
- **视频建议用非阻塞**：`wait: false` 会立刻返回 `{ pending: true, taskId }`，然后轮询 `tasks/running`（进度）与 `tasks/list`（结果：`status` + `outputPath`，素材也会自动登记）。图片很快，直接用默认（阻塞）就好。
- **支持中途取消**：`tasks/running` 里能看到进行中的生成（`id` + `kind`），对它调 `tasks/cancel` 即可；取消后工具会真的中止，任务状态落 `cancelled`（不是 failed，也不是一直转圈）。
- 服务商/风格/时长取「生效默认值」即可，用户改了就随请求发 `size/duration/aspectRatio`。

## 七、B 的优先待办（`A145`–`A147` 之后，按价值排序）

1. **快速创作的「生成」按钮**（最高价值）：按 `§六` 调 `media/generate`；视频建议 `wait:false` + 轮询；生成中可 `tasks/cancel`；成功后把返回的 `asset` 直接插进素材列表。
2. **预览去掉过度保守的判断**：现在 `src/client/Workbench.tsx` 里 `isLoopback(location.host)` 在 `dsh-app://app` 下为 false，于是显示"预览需要本机访问宿主"并挡掉预览。
   **A 侧真机实测**：`dsh-app://app` 下 `HEAD /outputs/<png>` → 200 + `image/png`；`Range: bytes=0-99` → **206** + `content-range`。**同源相对路径本来就能用**，把这道门去掉/放宽即可（视频拖动也有 Range 支持）。
3. **过时文案**：`src/client/locales.ts` 的 `emptyHint`（zh 第 ~492 行 / en 对应项）里"（执行与项目存储随后端接入）"已经不成立 —— 后端早已接入，删掉括号部分。
4. **可选**：`outputs/list` 返回的条目可直接拼 `/outputs/<文件名>`（A 已保证该路由可用），避免客户端自己拼 host/端口。

> A 侧不会再改 `src/client/**`；以上都在 B 的地盘，契约与真机证据已备好。
