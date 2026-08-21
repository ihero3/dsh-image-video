# 🎨 dsh-image-video — AI 文生图 / 文生视频插件 for DeepSeek Harness

**为 DeepSeek Harness 对话模型注册 `generate_image` / `generate_video` 两个工具。模型在对话中自主决策调用，生成结果自动下载到本地 `outputs/`，图片经 attachment 服务内嵌渲染——对话即创作，无需离开终端。**

> DSH 生态有丰富的工具插件，但缺少一个轻量、即装即用的文生图/文生视频入口。dsh-image-video 填补这个空白：两个工具、两个服务商、零外部依赖，热插拔即用。

## 核心特性

- **两个工具，自然语言触发** — 模型在对话中自主决策何时调用 `generate_image` / `generate_video`，无需手动指令
- **双服务商热切换** — 万象 wanx（阿里云百炼）与 Seedance2.5（火山引擎），配置 `provider` 字段一键切换，HMR 即时生效
- **异步任务不阻塞对话** — `TaskManager` 基于 `ctx.effect()` 托管轮询生命周期，插件卸载时自动取消排队任务、清理定时器，杜绝内存泄漏
- **图片内嵌渲染** — 图片字节经 attachment 服务持久化，附件引用走 `presentationMeta` UI-only 通道，模型只见文本摘要，纯文本模型照常工作
- **统一异常分类** — `GenerationError` 五类错误（auth / quota / task / timeout / network），可重试错误指数退避，不可重试错误即时中止
- **声明式服务依赖** — `inject = ['tools']` 顶部声明 + `ctx.inject(['attachments'])` 显式注入，不假设其他插件内部实现

## 能力概览

| 工具 | 能力 | 服务商 | 异步轮询 | 对话渲染 |
|---|---|---|---|---|
| `generate_image` | 文生图 | 万象 wanx / Seedance2.5 | 同步或异步（自动适配） | 图片经 `presentationMeta` 内嵌渲染；模型只见文本摘要 |
| `generate_video` | 文生短视频（上限 10s） | 万象 wanx / Seedance2.5 | 始终异步轮询，不阻塞对话 | 本地文件路径 + 源地址 |

## Provider 矩阵

| 服务商 | 渠道 | 文生图 | 文生视频 | 备注 |
|---|---|---|---|---|
| **万象 wanx**（阿里云百炼） | DashScope `sk-` Key | ✅ 已验证（wanx2.1-t2i-turbo） | ✅ 已验证（wan2.2-t2v-plus） | 图片同步/异步自适应；视频始终异步 |
| **Seedance2.5**（火山引擎 Ark） | ARK API Key | ✅ 适配器已实现（即梦 3.0） | ✅ 适配器已实现 | 图片同步返回 URL；视频走异步任务 |

## 快速开始

### 1. 安装

```sh
# 本地安装（开发推荐）
dsh plugin --profile <profile> add ./dsh-image-video

# GitHub 远程安装
dsh plugin --profile <profile> add github:<owner>/dsh-image-video
```

### 2. 配置 API Key

在 profile 的 `cordis.patch.yml` 中覆盖默认配置（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: image-video
  config:
    provider: wanx                    # wanx | seedance
    wanx:
      apiKey: !!js process.env.DASHSCOPE_API_KEY
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
    │   ├── wanx.ts           # 万象（wanx）API 适配器
    │   └── seedance.ts       # Seedance2.5 API 适配器
    └── tools/
        ├── generate-image.ts # generate_image 工具注册
        └── generate-video.ts # generate_video 工具注册
```

## 配置

插件配置通过 Schemastery 暴露，可在 profile 的 `cordis.patch.yml` 或 `--patch` 覆盖层中按 `id: image-video` 覆盖。完整字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider` | `'wanx' \| 'seedance'` | `wanx` | 激活的服务商，切换后立即生效（HMR） |
| `wanx.apiKey` | `string` | `''` | 万象 API Key；`provider=wanx` 时必填 |
| `wanx.baseURL` | `string` | `''` | 万象自定义接口地址，留空用默认端点 |
| `seedance.apiKey` | `string` | `''` | Seedance2.5 API Key；`provider=seedance` 时必填 |
| `seedance.baseURL` | `string` | `''` | Seedance2.5 自定义接口地址，留空用默认端点 |
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
