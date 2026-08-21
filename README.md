# dsh-image-video

DeepSeek Harness 插件：为对话模型注册 `generate_image` / `generate_video` 两个工具，支持在 **万象 wanx（阿里云百炼）** 与 **Seedance2.5（火山引擎）** 之间切换，生成结果自动下载到本地 `outputs/` 目录，图片内嵌渲染在对话中，视频返回本地文件链接。

## 能力概览

| 工具 | 能力 | 服务商 | 异步轮询 | 对话渲染 |
|---|---|---|---|---|
| `generate_image` | 文生图 | 万象 wanx / Seedance2.5 | 同步或异步（自动适配） | 内嵌图片（attachment 服务） |
| `generate_video` | 文生短视频（上限 10s） | 万象 wanx / Seedance2.5 | 始终异步轮询，不阻塞对话 | 本地文件路径 + 源地址 |

视频生成耗时较长（1-5 分钟），任务提交后由 `TaskManager` 在后台按配置间隔轮询状态，轮询过程不产生中间输出，仅最终结果返回模型，**不会卡死对话上下文**。插件卸载时通过 `ctx.effect()` 注册的清理函数自动取消所有排队任务、清理轮询定时器，杜绝内存泄漏。

### 服务依赖（组合声明）

插件通过官方服务插槽声明依赖，不假设其他插件内部实现：

| 依赖 | 声明方式 | 必需性 | 提供方 |
|---|---|---|---|
| `tools` | `inject = ['tools']` 顶部声明 | 插件必需，缺失则不加载 | dsh-base |
| `attachments` | `ctx.inject(['attachments'], cb)` | `generate_image` 必需，`generate_video` 不依赖 | dsh-base 的 `attachment-local` |

`generate_image` 通过 `ctx.inject` 显式声明 attachment 服务依赖：服务挂载时注册工具，服务撤销时 fiber dispose 自动注销。`generate_video` 始终注册。`cordis.patch.yml` 用 `- insert` 新增 `image-video` 行，不覆盖任何现有插件行，升级保持组合兼容。

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
    ├── media.ts              # 媒体下载 / 落地 / 内嵌渲染
    ├── providers/
    │   ├── types.ts          # ProviderAdapter 接口 + 通用类型
    │   ├── wanx.ts          # 万象（wanx）API 适配器
    │   └── seedance.ts       # Seedance2.5 API 适配器
    └── tools/
        ├── generate-image.ts # generate_image 工具注册
        └── generate-video.ts  # generate_video 工具注册
```

## 安装

以下命令中的 `<profile>` 替换为你的 profile 名（如 `default`）。若从源码 checkout 运行 `dsh`，请用 `pnpm dsh ...` 代替 `dsh ...`，详见 [source execution](https://deepseek-harness.github.io/deepseek-harness/)。

### 方式一：本地文件夹安装

```sh
dsh plugin --profile <profile> add ./dsh-image-video
```

`dsh` 会将本地目录链接进 profile 的 `node_modules`，并把 `dsh-image-video` 追加到 `dsh.profile.bundles`。本地安装不触发 `prepare` 脚本（已构建或源码直接可用），无需 `allowBuilds` 放行。

验证安装并启动：

```sh
dsh --profile <profile> --dump-config   # 应看到 "# == dsh-image-video" 层
dsh --profile <profile>
```

### 方式二：GitHub 远程一键安装

```sh
dsh plugin --profile <profile> add github:<owner>/dsh-image-video
```

Git 安装拉取的是**源码而非构建产物**，需要两步配合：

1. **作者侧**：本插件 `package.json` 已声明 `prepare: tsdown`，pnpm 在 git 安装后会自动构建 `lib/` 输出，自包含无外部 monorepo 依赖。

2. **用户侧**：pnpm ≥10 默认拒绝运行 git 依赖的 `prepare` 脚本，首次 `add` 会失败。按 `dsh` 提示将包名加入 profile 目录下的 `pnpm-workspace.yaml`：

   ```yaml
   allowBuilds:
     dsh-image-video: true
   ```

   然后重新执行 `add` 命令。

> 安全提示：`allowBuilds` 等同于授权该包在安装时执行代码，请仅对源码可信的包放行，并建议固定 commit：`dsh plugin --profile <profile> add github:<owner>/dsh-image-video#<sha>`。

不想要求用户配置 `allowBuilds`，可改为发布到 npm（`dsh plugin add dsh-image-video`）或分发 tarball（`dsh plugin add ./dsh-image-video-0.1.0.tgz`），两种方式都安装预构建产物，无需构建权限。

## 配置

插件配置通过 Schemastery 暴露，可在 profile 的 `cordis.patch.yml` 或 `--patch` 覆盖层中按 `id: image-video` 覆盖。完整字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider` | `'wanx' \| 'seedance'` | `wanx` | 激活的服务商，切换后立即生效（HMR） |
| `wanx.apiKey` | `string` | `''` | 万象（wanx）API Key；`provider=wanx` 时必填 |
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

### 配置示例

在 profile 的 `cordis.patch.yml` 中覆盖默认值（patch 替换整行 config，需重述所有字段）：

```yaml
- id: image-video
  config:
    provider: seedance
    wanx:
      apiKey: ''
      baseURL: ''
    seedance:
      apiKey: 'your-volcengine-ark-api-key'
      baseURL: ''
    defaultImageSize: '1280*720'
    defaultVideoDuration: 5
    timeoutMs: 60000
    pollIntervalMs: 5000
    pollTimeoutMs: 300000
    retryTimes: 3
    outputsDir: './outputs'
```

凭证建议通过环境变量或 DSH 凭证管理注入，不要明文写入 `cordis.patch.yml`。

## 工具调用示例

安装并配置后，模型会在对话中自主决策调用工具。典型对话示例：

**文生图：**

```
用户：帮我画一只赛博朋克风格的猫，1080*1080

模型（调用 generate_image）：
  prompt: "赛博朋克风格的猫"
  size: "1080*1080"

→ 图片内嵌显示在对话中，并保存到 outputs/<时间戳>-<随机>.png
```

**文生视频：**

```
用户：生成一段 5 秒的海浪拍打沙滩视频

模型（调用 generate_video）：
  prompt: "海浪拍打沙滩"
  duration: 5

→ 后台轮询任务状态（不阻塞对话），完成后视频保存到
  outputs/<时间戳>-<随机>.mp4，对话返回文件路径
```

工具参数：

- `generate_image`：`prompt`（必填）、`size`（可选，默认 `defaultImageSize`）、`model`（可选）
- `generate_video`：`prompt`（必填）、`duration`（可选，1-10 秒）、`model`（可选）、`aspectRatio`（可选，如 `16:9`）

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

## 服务商 API 参考

- **万象 wanx（阿里云百炼 DashScope）**：文生图、文生视频，[API 文档](https://help.aliyun.com/zh/model-studio/text-to-video-guide)
- **Seedance2.5（火山引擎 Ark）**：文生图（即梦 3.0）、文生视频，[视频 API](https://docs.volcengine.com/docs/82379/1520757) / [文生图 API](https://docs.volcengine.com/docs/85621/1616429)

## 依赖

- `@deepseek-ai/cordis`（peer）：插件框架
- `@deepseek-ai/dsh-tools`（peer）：`defineTool` 工具注册
- `@deepseek-ai/dsh-attachment`（peer，可选）：图片内嵌渲染服务
- `@deepseek-ai/dsh-llm`（peer）：ContentBlock 类型
- `@deepseek-ai/schemastery`：配置 Schema

## 开发 & 测试运行

本地有两种运行模式：**免 DSH 的纯逻辑测试**（最快、最常用，开发时循环跑）和 **DSH profile 安装验证**（确认 Harness 能识别并加载插件）。**真实 API 冒烟测试**建议配合你自己的 Key 做一次，其他时候用 mock 即可。

### 0. 前置

```sh
cd dsh-image-video
# 使用 --ignore-workspace 让 dsh-image-video 脱离 deepseek-harness monorepo，
# 模拟独立仓库的依赖解析方式；--no-frozen-lockfile 允许新建/更新 pnpm-lock.yaml
pnpm install --ignore-workspace --no-frozen-lockfile
```

> 如果你之前在 workspace 根运行过 `pnpm install`，本目录可能出现 `Cannot resolve @deepseek-ai/cordis` 等 peer 错误——那是因为子包 `peerDependencies` 在根 workspace 能解析、但作为独立仓库时缺失。此时只要跑上面这条 `--ignore-workspace` 即可解决。

### 1. 纯逻辑单元测试（推荐每次提交前都跑）

```sh
pnpm run test
```

**预期输出**：

```
Test Files  4 passed (4)
     Tests  34 passed (34)
```

四个测试文件覆盖：

| 文件 | 覆盖 |
|---|---|
| `tests/config.test.ts` | 配置 schema 默认值校验、provider 凭证解析、非法 size / duration 输入拒绝 |
| `tests/http-client.test.ts` | HTTP 状态码 → `GenerationError` 分类映射（401→auth / 403→auth / 429→quota / 400→task / 500→network） |
| `tests/media.test.ts` | `Content-Type` → 扩展名推断、JPEG/PNG/WEBP/MP4 映射、图片 mediaType 转换 |
| `tests/providers.test.ts` | **适配器集成测试**：mock `fetch`（`vi.stubGlobal`），覆盖 万象wanx/Seedance 的 submit→query 成功路径 + PENDING/RUNNING 状态 + 500/401/429 异常分类 |

单文件调试：`pnpm exec vitest run tests/providers.test.ts`。`test:watch` 模式（开发时）：`pnpm run test:watch`。

### 2. 类型检查 + 构建

```sh
pnpm run typecheck   # tsc --noEmit
pnpm run build       # tsdown 输出 lib/index.js + 类型
```

Build 成功会看到 `Build complete in xxxms`，且生成 `lib/index.js` 与 `lib/index-xxx.d.ts`（发布到 npm 或 git 安装后 `prepare` 会自动执行）。

### 3. DSH 安装验证（推荐首次跑一次）

把本目录作为本地 bundle 安装到你的某个 DSH profile：

```sh
# 用你实际的 profile 名替换 <profile>
dsh plugin --profile <profile> add /absolute/path/to/dsh-image-video
```

然后用 `--dump-config` 确认插件层被识别：

```sh
dsh --profile <profile> --dump-config | grep -A3 "dsh-image-video"
```

**预期输出**里出现 `# == dsh-image-video` 分层，并且有 `image-video` 插件行。如果想快速切换服务商，不需要改安装：

```yaml
# <profile>/cordis.patch.yml
- id: image-video
  config:
    provider: seedance
    seedance: { apiKey: '${SEEDANCE_API_KEY}', baseURL: '' }
    # ...其他字段参考 README 配置示例
```

启动后用一段自然语言触发工具：

```
用户：帮我画一只戴墨镜的猫，1024*1024
```

预期模型会**调用** `generate_image`，完成后对话内嵌显示图片，且 `outputs/` 目录下新增一个 PNG 文件。

### 4. 真实 API 冒烟（可选，需 Key）

`tests/providers.test.ts` 里的 fetch 是 mock。要验证对接真实服务商，最快的方式是写一个 10 行小脚本（不要提交到 git）：

```sh
# 临时脚本（自己手建一个，别 commit）
cat > /tmp/smoke.mjs << 'EOF'
import { wanxAdapter } from '/path/to/dsh-image-video/src/providers/wanx.ts'
const r = await wanxAdapter.submitImage(
  { prompt: 'a cat', size: '1024*1024' },
  { apiKey: process.env.DASHSCOPE_KEY, baseURL: '', timeoutMs: 60_000, retryTimes: 2 },
)
console.log(r)
EOF
DASHSCOPE_KEY=sk-xxx pnpm exec tsx /tmp/smoke.mjs
```

**注意**：
- 这一步会产生真实费用，建议只跑一次最小尺寸
- 万象 wanx / Seedance 的 Key 分别放在环境变量，不要硬编码进源码

### 5. 常见排错

| 症状 | 原因 | 解决 |
|---|---|---|
| `pnpm run test` 报 lockfile out of date | 升级 package.json 后没重生成 lockfile | 重新执行 `pnpm install --ignore-workspace --no-frozen-lockfile` |
| `vitest` 里 fetch 没被拦截、真实请求外发 | 用了 `globalThis.fetch = fn` 而非 `vi.stubGlobal` | 统一用 `vi.stubGlobal('fetch', ...)`，`afterEach` 里 `vi.unstubAllGlobals()` |
| provider 测试报 "Authorization header 缺失" 但明明传了 key | mock `_url` 和断言写死的 key 不匹配 | 检查 mock 里断言的 `Bearer` 字符串和构造 `opts.apiKey` 是否一致 |
| DSH 启动报 `cannot find module dsh-image-video` | 只 add 了路径但 profile 没 `pnpm install`，或构建产物缺失 | 重新 `dsh plugin add <path>` 或在 dsh-image-video 先跑 `pnpm run build` |
| 生成图片但对话没有内嵌 | attachments 服务未加载 | 确认 profile 的 cordis 配置包含 `attachment-local`；本插件通过 `ctx.inject(['attachments'])` 延迟注册 `generate_image`，服务挂载即生效 |

## License

MIT
