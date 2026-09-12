# 🎨 dsh-image-video — AI 文生图 / 文生视频插件 for DeepSeek Harness

**为 DeepSeek Harness 对话模型注册 `generate_image` / `generate_video` 两个工具。模型在对话中自主决策调用，生成结果自动下载到本地 `outputs/`，图片经 attachment 服务内嵌渲染——对话即创作，无需离开终端。**

> DSH 生态有丰富的工具插件，但缺少一个轻量、即装即用的文生图/文生视频入口。dsh-image-video 填补这个空白：两个工具、四家服务商、零外部依赖，热插拔即用。

## 核心特性

- **两个工具，自然语言触发** — 模型在对话中自主决策何时调用 `generate_image` / `generate_video`，无需手动指令
- **四家服务商 + 按模型家族自动路由** — Threerouter（聚合器，默认）、万象 wanx（阿里云百炼）、MiniMax 官方平台、Seedance2.5（火山引擎）；显式指定模型时按家族关键词自动选择直连商，Threerouter 永远兜底，回退链透明写入 notes
- **异步任务不阻塞对话** — `TaskManager` 基于 `ctx.effect()` 托管轮询生命周期，插件卸载时自动取消排队任务、清理定时器，杜绝内存泄漏
- **图片内嵌渲染** — 图片字节经 attachment 服务持久化，附件引用走 `presentationMeta` UI-only 通道，模型只见文本摘要，纯文本模型照常工作
- **统一异常分类** — `GenerationError` 五类错误（auth / quota / task / timeout / network），可重试错误指数退避，不可重试错误即时中止
- **声明式服务依赖** — `inject = ['tools']` 顶部声明 + `ctx.inject(['attachments'])` 显式注入，不假设其他插件内部实现

## 能力概览

| 工具 | 能力 | 服务商 | 异步轮询 | 对话渲染 |
|---|---|---|---|---|
| `generate_image` | 文生图 + **图生图**（可选 `image` 参考图入参） | **Threerouter**（默认）/ 万象 wanx / MiniMax 官方 / Seedance2.5 | 同步或异步（自动适配） | 图片经 `presentationMeta` 内嵌渲染；模型只见文本摘要 |
| `generate_video` | 文生短视频 + 图生视频（首帧驱动，上限 10s） | **Threerouter**（默认）/ 万象 wanx / MiniMax 官方 / Seedance2.5 | 始终异步轮询，不阻塞对话 | 本地文件路径 + 源地址 |

## Provider 矩阵

| 服务商 | 渠道 | 文生图 | 图生图 | 文生视频 | 备注 |
|---|---|---|---|---|---|
| **Threerouter**（默认，聚合器） | threerouter.com Bearer Key | ✅ 已验证 | ✅ `/images/edits`（待实测） | ✅ 已验证（MiniMax-H3 / wan 系） | i2i 走 OpenAI Images 风格专用端点（`images[].image_url` + 默认 `gpt-image-2`）；t2i/视频走 `/v1/media/generations` |
| **万象 wanx**（阿里云百炼） | DashScope `sk-` Key | ✅ 已验证（wanx2.1-t2i-turbo） | ✅ `wanx2.1-imageedit`（待 key 实测） | ✅ 已验证（wan2.2-t2v-plus） | i2i 为 description_edit 异步任务；图片同步/异步自适应；视频始终异步 |
| **MiniMax 官方平台** | platform.minimaxi.com Key | ✅ `image-01`（待 key 实测） | ✅ `subject_reference` 主体一致性（待 key 实测） | ✅ 适配器已实现（video-generation v2，待 key 实测） | 图片同步返回 **base64**（无 URL），插件直接落盘；i2i 语义为「保留主体换场景」，每次仅 1 张参考图；Hailuo 系视频；缺省注入 `768P` |
| **Seedance2.5**（火山引擎 Ark） | ARK API Key | ✅ 适配器已实现（即梦 3.0） | ✅ Seedream 4.0 `image` 入参（待 key 实测） | ✅ 适配器已实现 | 图片同步返回 URL（24h 有效立即下载）；i2i 默认模型自动切换 Seedream 4.0（3.0 不支持参考图）；显式关组图与水印；视频走异步任务 |

## 模型家族路由

显式指定 `model` 参数时，插件按厂商关键词（小写包含匹配，一条规则覆盖一个家族）构建候选服务商序列，按序尝试提交：

| model 含关键词 | 家族 | 候选服务商（有序） |
|---|---|---|
| `minimax` / `hailuo` | MiniMax | `minimax`（官方直连）→ `threerouter`（图片+视频） |
| `doubao` / `seedance` / `seedream` | 火山方舟 | `seedance`（直连）→ `threerouter` |
| `wan`（覆盖 `wan*` 与 `wanx*`） | 通义万相 | `wanx`（百炼直连）→ `threerouter` |
| 无命中（自定义模型） | 未知 | 仅配置链 + `threerouter` |

候选序列 = **配置链服务商**（composer 会话选定 > 配置默认 > 激活服务商，配置优先）→ 家族直连商 → **threerouter 聚合器兜底**（其目录覆盖所有家族的模型）。回退规则：

- 仅在提交阶段的「模型不被该服务商接受」类错误（模型不存在 / 能力缺失，判定见 `isModelNotAcceptedError`）时回退下一候选；
- 鉴权（401/403）、配额（429）、网络/超时错误**响亮失败不回退**，不掩盖配置错误；
- 拿到任务 ID 之后的任何失败**不回退**，绝不重复生成、双重扣费；
- 回退链写入结果 `notes` 透明告知。

新模型（wan3.0、qwen-video、minimax 新版本等）无需逐个登记即自动命中家族规则，维护点只按厂商关键词。

## 结果透明与配置自证

- **每次调用自报身份（固定标准输出）**：`generate_video` / `generate_image` 的可见文本固定包含**提示词、服务商、实际发给上游的模型名**（未指定模型时显示服务商内置默认的实际值）、生成模式、时长参数、分辨率与 `notes`（时长被丢弃、候选回退链）。「这次用了哪个服务商、哪个模型、有没有降级」直接看结果即可，不必去服务商后台对账，也不必从配置推断。配合桌面客户端 keyed toolview（消费 `presentationMeta` 的 `localPath`/`prompt` 渲染内嵌播放器），构成「**提示词 + 播放器 + 结果块**」的固定标准输出：任何人安装本插件即自动获得，无需任何配置。
- **启动即打印生效配置**：插件 `apply()` 向宿主日志写一行生效配置摘要（`provider` / `defaultVideoProvider` / `defaultImageProvider` / `defaultVideoModel` / `defaultImageModel` / `defaultVideoDuration` / `outputsDir` / 各服务商 key 是否已配置），**绝不包含 key 明文**。多 profile（web / desktop）场景可直接从日志确认哪个 patch 层生效。

## 快速开始

### 1. 安装

```sh
# GitHub 远程安装
dsh plugin --profile <profile> add github:ihero3/dsh-image-video
```

### 2. 配置 API Key

在 profile 的 `cordis.patch.yml` 中覆盖默认配置（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: image-video
  config:
    provider: threerouter             # threerouter（默认，聚合器） | wanx | minimax | seedance
    threerouter:
      apiKey: !!js process.env.THREEROUTER_API_KEY
      baseURL: ''
    wanx:
      apiKey: !!js process.env.DASHSCOPE_API_KEY
      baseURL: ''
    minimax:
      apiKey: !!js process.env.MINIMAX_API_KEY   # 官方平台 key，可选（无则自动跳过该候选）
      baseURL: ''
    seedance:
      apiKey: ''
      baseURL: ''
    defaultImageSize: '1024*1024'      # 百炼接口要求 * 分隔
    defaultVideoDuration: 5
    timeoutMs: 60000
    pollIntervalMs: 5000
    pollTimeoutMs: 300000
    retryTimes: 3
    outputsDir: './outputs'
```

凭证建议通过环境变量注入（`!!js process.env.XXX`），不要明文写入配置文件。DSH 凭证系统支持 `~/.dsh/.credentials.yaml` 和 `~/.dsh/.env` 两种来源。

### 3. 运行

```sh
# headless 模式（一次性任务）
dsh --profile headless "帮我画一只赛博朋克风格的猫，1080*1080"

# 交互式模式（持续对话）
dsh --profile <profile>
```

模型会自主决策调用 `generate_image` 工具：

```
用户：帮我画一只赛博朋克风格的猫，1080*1080

模型（调用 generate_image）：
  prompt: "赛博朋克风格的猫"
  size: "1080*1080"

→ 图片保存到 outputs/<时间戳>-<随机>.png
→ 附件引用经 presentationMeta 持久化，客户端可内嵌渲染
→ 模型收到文本摘要（路径 / 服务商 / 尺寸 / 大小）
```

**文生视频：**

```
用户：生成一段 5 秒的海浪拍打沙滩视频

模型（调用 generate_video）：
  prompt: "海浪拍打沙滩"
  duration: 5

→ 后台轮询任务状态（不阻塞对话）
→ 完成后视频保存到 outputs/<时间戳>-<随机>.mp4
→ 对话返回文件路径
```

**图生视频（让图片动起来）：**

```
用户：参考这张图 /path/photo.png 生成一段视频

模型（调用 generate_video）：
  prompt: "让画面自然地动起来"
  image: "/path/photo.png"
  duration: 5

→ 本地路径自动编码为 data URL（http(s)/data URL 原样透传）
→ 存在 image 时构图由首帧决定：不传 aspectRatio，模型用服务商内置 i2v 默认模型（图生视频时该参数被忽略）
→ 完成后视频首帧即该图片
```

`resolution` 为可选分辨率档位，取值由服务商与模型决定（如 MiniMax-H3：`480P/768P/2K`；wan 图生视频：`480P/1080P`），留空使用服务商默认（MiniMax 系要求显式携带，未指定时插件自动注入 `768P`），不支持的值由上游响亮报错。图生视频的字段映射：threerouter `image`、wanx `input.img_url`、Seedance content 数组 `image_url` 块、MiniMax 官方 `first_frame_image`（MiniMax/Seedance 分支按官方协议实现，未在真实账号验证）。

**图生图（参考图）语义差异**：`image` 入参各家模型行为不同——threerouter `/images/edits`（gpt-image-2 等）按提示词自由编辑；方舟 Seedream 4.0+ 按参考图编辑/组图（默认模型自动切换为 Seedream 4.0，3.0 不支持参考图）；MiniMax `subject_reference` 是**主体一致性**（保留人物/主体特征换场景换动作），且每次仅支持 1 张参考图、官方示例仅网络 URL（本地图转 data URL 传入待实测）。尺寸分隔符 `*` 会按服务商要求自动归一化为 `x`（threerouter / 方舟）。

**时长与模型能力**：wan 系模型（`wan2.2-t2v-plus`、`wan2.7-t2v`）不支持自定义时长——调用时传入 `duration` 会被插件丢弃（不发给上游，避免 `duration customization is not supported` 报错），并在结果 `notes` 中透明注明，实际时长由上游模型默认决定；MiniMax 系（`minimax-h3`）支持 4–15 秒。能力表见 `src/runtime-defaults.ts` 的 `VIDEO_DURATION_UNSUPPORTED`，按上游实测维护。

## 目录结构

```
dsh-image-video/
├── package.json              # 依赖定义 + dsh.bundle manifest + prepare 脚本
├── cordis.patch.yml          # bundle 层插件清单（image-video 行 + 默认 config）
├── tsconfig.json             # TypeScript 配置
├── tsdown.config.ts          # 构建配置（prepare 脚本调用）
├── README.md
└── src/
    ├── index.ts              # 主入口：name / inject / Config / apply
    ├── config.ts             # 配置 Schema（Schemastery）
    ├── http-client.ts        # 统一 HTTP 客户端 + 异常分类 + 可配置重试
    ├── task-manager.ts       # 异步任务管理器（ctx.effect 托管轮询生命周期）
    ├── media.ts              # 媒体下载 / 落地 / 摘要文本 / presentationMeta
    ├── providers/
    │   ├── types.ts          # ProviderAdapter 接口 + 通用类型
    │   ├── threerouter.ts    # Threerouter API 适配器（默认服务商，聚合器：图片+视频）
    │   ├── wanx.ts           # 万象（wanx）API 适配器
    │   ├── minimax.ts        # MiniMax 官方平台适配器（video-generation v2 + image_generation）
    │   └── seedance.ts       # Seedance2.5 API 适配器
    └── tools/
        ├── generate-image.ts # generate_image 工具注册
        └── generate-video.ts # generate_video 工具注册
```

## 配置

插件配置通过 Schemastery 暴露，可在 profile 的 `cordis.patch.yml` 或 `--patch` 覆盖层中按 `id: image-video` 覆盖。完整字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider` | `'threerouter' \| 'wanx' \| 'minimax' \| 'seedance'` | `threerouter` | 激活的服务商，切换后立即生效（HMR） |
| `threerouter.apiKey` | `string` | `''` | Threerouter API Key；`provider=threerouter` 时必填 |
| `threerouter.baseURL` | `string` | `''` | Threerouter 自定义接口地址，留空用默认端点 |
| `wanx.apiKey` | `string` | `''` | 万象 API Key；`provider=wanx` 时必填 |
| `minimax.apiKey` | `string` | `''` | MiniMax 官方平台 API Key；`provider=minimax` 或模型家族路由命中时使用，留空自动跳过该候选 |
| `wanx.baseURL` | `string` | `''` | 万象自定义接口地址，留空用默认端点 |
| `seedance.apiKey` | `string` | `''` | Seedance2.5 API Key；`provider=seedance` 时必填 |
| `seedance.baseURL` | `string` | `''` | Seedance2.5 自定义接口地址，留空用默认端点 |
| `defaultImageProvider` | `'' \| 'threerouter' \| 'wanx' \| 'seedance'` | `''` | 默认图片服务商，留空跟随激活服务商，adapter 用其内置默认模型 |
| `defaultVideoProvider` | `'' \| 'threerouter' \| 'wanx' \| 'seedance'` | `''` | 默认视频服务商，留空跟随激活服务商，adapter 用其内置默认模型 |
| `defaultImageModel` | `string` | `''` | 默认图片模型，留空用服务商内置默认（模型取值链：调用参数 > 此配置 > 内置默认） |
| `defaultVideoModel` | `string` | `''` | 默认视频模型，留空用服务商内置默认（threerouter 内置 `minimax-h3`） |
| `defaultImageSize` | `string` | `'1024*1024'` | 默认图片尺寸，形如 `宽*高`（百炼接口要求 `*` 分隔） |
| `defaultVideoDuration` | `number` | `5` | 默认视频时长（秒），范围 1-10 |
| `timeoutMs` | `number` | `60000` | 单次 HTTP 请求超时（毫秒） |
| `pollIntervalMs` | `number` | `5000` | 视频任务轮询间隔（毫秒） |
| `pollTimeoutMs` | `number` | `300000` | 视频任务整体超时（毫秒），超时中止轮询 |
| `retryTimes` | `number` | `3` | 可重试错误的最大重试次数（鉴权/配额错误不重试） |
| `outputsDir` | `string` | `'./outputs'` | 生成媒体落地目录（相对路径基于进程 cwd） |

## 图片渲染设计

`generate_image` 的工具结果**只向模型返回文本摘要**（本地路径、服务商、尺寸、大小），不把图片作为 `image` 内容块注入工具结果。原因：纯文本模型或网关不支持图片输入时，生成图片后的下一轮请求会直接 400。

图片字节通过 attachment 服务持久化，附件引用经 `output.presentationMeta` 写入 `tool/result` 事件的 `meta` 字段——**持久化但对模型不可见**，客户端可消费它做内嵌渲染：

- **模型可见**：文本摘要（`render` 产物）
- **UI 可见**：`meta` 中的图片附件信息（`presentationMeta` 产物）
- 图片文件始终落地 `outputs/` 目录

## 服务依赖

插件通过官方服务插槽声明依赖，不假设其他插件内部实现：

| 依赖 | 声明方式 | 必需性 | 提供方 |
|---|---|---|---|
| `tools` | `inject = ['tools']` 顶部声明 | 插件必需，缺失则不加载 | dsh-base |
| `attachments` | `ctx.inject(['attachments'], cb)` | `generate_image` 必需，`generate_video` 不依赖 | dsh-base 的 `attachment-local` |

`generate_image` 通过 `ctx.inject` 显式声明 attachment 服务依赖：服务挂载时注册工具，服务撤销时 fiber dispose 自动注销。`generate_video` 始终注册。`cordis.patch.yml` 用 `- insert` 新增 `image-video` 行，不覆盖任何现有插件行，升级保持组合兼容。

## 异常处理

统一封装的 `GenerationError` 分类捕获，返回友好中文提示：

| 错误种类 | 触发条件 | 是否重试 |
|---|---|---|
| `auth` | HTTP 401/403，API Key 无效或无权限 | 否 |
| `quota` | HTTP 429，配额耗尽或限流 | 否 |
| `task` | 任务逻辑错误（参数非法、服务端任务失败） | 否 |
| `timeout` | 请求超时或任务被取消 | 取消不重试；超时重试 |
| `network` | 网络抖动、5xx 服务端错误 | 是 |

可重试错误按指数退避重试，次数由 `retryTimes` 控制。

## 开发 & 测试

### 前置

```sh
cd dsh-image-video
pnpm install --ignore-workspace --no-frozen-lockfile
```

### 单元测试

```sh
pnpm run test
```

34 个测试覆盖：

| 文件 | 覆盖 |
|---|---|
| `tests/config.test.ts` | 配置 schema 默认值校验、provider 凭证解析、非法输入拒绝 |
| `tests/http-client.test.ts` | HTTP 状态码 → `GenerationError` 分类映射（401→auth / 429→quota / 500→network） |
| `tests/media.test.ts` | `Content-Type` → 扩展名推断、JPEG/PNG/WEBP/MP4 映射 |
| `tests/providers.test.ts` | 万象wanx/Seedance 适配器集成测试：mock `fetch`，覆盖 submit→query 成功路径 + 状态流转 + 异常分类 |

### 类型检查 + 构建

```sh
pnpm run typecheck   # tsc --noEmit
pnpm run build       # tsdown 输出 lib/index.js + 类型
```

### DSH 安装验证

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-image-video
dsh --profile <profile> --dump-config | grep -A3 "dsh-image-video"
```

预期输出出现 `# == dsh-image-video` 分层和 `image-video` 插件行。

### 常见排错

| 症状 | 解决 |
|---|---|
| `pnpm run test` 报 lockfile out of date | 重跑 `pnpm install --ignore-workspace --no-frozen-lockfile` |
| vitest 里 fetch 真实发网请求 | 用 `vi.stubGlobal('fetch', ...)`，`afterEach` 调 `vi.unstubAllGlobals()` |
| DSH 启动报 `cannot find module dsh-image-video` | 先在插件目录跑 `pnpm run build`，再 `dsh plugin add` |
| 生成图片但对话无内嵌渲染 | 确认 profile 包含 `attachment-local`；图片文件始终可在 `outputs/` 查看 |
| `size is not in the correct format` | 百炼接口要求 `*` 分隔（如 `1024*1024`），不是 `x`；插件已自动转换 |

## 服务商 API 参考

- **Threerouter**：[统一媒体生成 API](https://threerouter.com/)（`/v1/media/generations` 创建 → `/v1/media/{id}` 轮询 → `/v1/media/{id}/content` 下载）
- **万象 wanx（阿里云百炼 DashScope）**：[文生图](https://help.aliyun.com/zh/model-studio/text-to-image-guide) / [文生视频](https://help.aliyun.com/zh/model-studio/video-generation)
- **Seedance2.5（火山引擎 Ark）**：[文生图](https://docs.volcengine.com/docs/85621/1616429) / [文生视频](https://docs.volcengine.com/docs/82379/1520757)

## 依赖

- `@deepseek-ai/cordis`（peer）：插件框架
- `@deepseek-ai/dsh-tools`（peer）：`defineTool` 工具注册
- `@deepseek-ai/dsh-attachment`（peer，可选）：图片附件持久化服务
- `@deepseek-ai/dsh-llm`（peer）：ContentBlock 类型
- `@deepseek-ai/schemastery`：配置 Schema

## 诚实声明

模型输出质量由服务商模型决定，插件负责正确传参、可靠轮询和异常分类。API Key 仅在本地使用，不上传任何远程服务。本插件不附属于阿里云或火山引擎。使用各服务商 API 前请确认其服务条款。

## License

[MIT](LICENSE)
