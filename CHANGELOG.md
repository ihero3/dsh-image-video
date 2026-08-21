# Changelog

本文件记录 dsh-image-video 的版本演进。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-08-21

### 变更
- `generate_image` 工具结果不再向模型返回 `image` 内容块，改为纯文本摘要（本地路径、服务商、尺寸、大小），修复纯文本模型生成图片后下一轮请求 400（`unknown variant 'image_url', expected 'text'`）的问题
- 图片字节仍通过 attachment 服务持久化，附件引用改经 `output.presentationMeta` 持久化为 UI-only 数据（`tool/result` 事件 `meta` 字段），对模型不可见，客户端可消费做内嵌渲染
- `media.ts` 拆分为 `saveImageAttachment`（持久化附件引用）与 `createImageSummaryText`（模型可见文本），原 `createImageContent` 移除
- 文档与工具描述同步更新：图片"内嵌渲染在对话中"→"模型只见文本摘要，附件走 UI-only 通道"

### 修复
- 修复：使用不支持图片输入的对话模型（如 pi-ai 的 threerouter 网关）时，`generate_image` 成功生成图片后，会话的后续请求因历史含 `image` 块而持续 400，会话无法继续

## [0.2.0] - 2026-08-20

### 变更
- 阿里系服务商统一使用 万象 wanx（阿里云百炼）：`provider` 取值 `'wanx'`，配置字段 `wanx:`，适配器 `wanxAdapter`（文件 `providers/wanx.ts`）
- `generate_video` 默认模型改为 `wan2.2-t2v-plus`（无需开通独立产品即可使用）
- 默认图片尺寸改为 `1024*1024`（百炼接口要求 `*` 分隔，`1024x1024` 会报 "size is not in the correct format"）
- 文档、工具描述、报错文案中的表述统一为 万象 wanx
- Seedance2.5 相关代码与配置保持不变

## [0.1.0] - 2026-08-20

首次发布。文生图与文生视频工具插件，支持 万象 wanx（阿里云百炼）与 Seedance2.5（火山引擎）服务商切换。

### 新增
- `generate_image` 工具：文生图，wanx / Seedance2.5 切换，结果内嵌对话并落地 `outputs/`
- `generate_video` 工具：文生短视频（上限 10s），后台异步轮询不阻塞对话，结果落地 `outputs/`
- 配置 Schema：`provider` 切换、API Key、自定义 baseURL、默认图片尺寸、默认视频时长、超时、重试次数、outputs 目录
- 统一 HTTP 客户端：异常分类（鉴权/配额/任务/超时/网络）+ 中文友好提示 + 可配置重试
- 异步任务管理器：基于 `ctx.effect` 托管轮询生命周期，卸载自动取消任务 + 清理定时器
- 媒体渲染模块：图片通过 attachment 服务内嵌，视频返回本地文件链接
- `cordis.patch.yml`：`- insert` 新增 `image-video` 行，不覆盖现有插件
- 双安装方式：本地文件夹 `dsh plugin add ./` + GitHub `dsh plugin add github:ihero3/dsh-image-video`

### 服务依赖声明
- `tools`（必需）：`inject = ['tools']` 顶部声明
- `attachments`（generate_image 必需）：`ctx.inject(['attachments'], cb)` 显式声明，服务撤销时自动注销工具
