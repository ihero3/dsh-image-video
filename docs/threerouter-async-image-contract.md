# Threerouter 异步图片契约（客户端视角）

> 本文是 `dsh-image-video` 对 **threerouter 网关异步图片能力**的客户端实现记录：
> 契约原文见服务端仓库 `threerouter-sub2api/docs/ASYNC_IMAGE_TASKS.md`；
> 本文回答三个问题——客户端按什么契约发请求、哪些保证只靠客户端做不到、
> 服务端上线前/后分别会发生什么。

## 1. 客户端依赖的端点与语义

| 端点 | 方法 | 客户端用法 |
|---|---|---|
| `/v1/images/generations/async` | POST | 提交图片任务（与同步端点完全相同的 payload），立即返回 202 + `task_id` |
| `/v1/images/tasks/{task_id}` | GET | 轮询任务状态，取 `image_url` / `result.data[0].url` |
| `/v1/images/generations/by-request/{request_id}` | GET | **提交响应丢失后凭幂等键找回原任务**（唯一自救通道） |
| `/v1/images/generations` | POST | 同步降级路径（异步端点不可用时），单次提交、永不自动重试 |

客户端实现位于 `src/providers/threerouter.ts`（`imageAsync` 能力）与
`src/image-transaction.ts`（事务层），协议测试在
`tests/threerouter-async.test.ts` / `tests/image-transaction.test.ts`，
线上验证脚本在 `tests/live-image-contract.test.ts`（env 门控）。

### 1.1 幂等键

- 客户端只发 `Idempotency-Key` **请求头**，不在 body 里放 `request_id`。
  原因：同步端点的请求体会原样转发上游，而 OpenAI 系上游对未知顶层参数是严格
  拒绝的（`Unrecognized request argument`）；只有异步端点会在下发前摘掉
  `request_id`。头形式对两条路径都无害且语义一致。
- 一次 `generate_image` 调用 = 一个 UUID 幂等键；候选服务商回退时**复用同一个键**
  （服务端幂等域按 API Key 隔离，键复用不会串任务）。
- 重放语义：同一键 + 同一请求体 → 服务端回放原响应（`X-Idempotency-Replayed: true`），
  客户端据此时别「本次没有新建任务」。
- 冲突语义：同一键 + 不同请求体 → `409 IDEMPOTENCY_KEY_CONFLICT`，客户端响亮失败
  （这是客户端事务 ID 复用 bug，不允许静默换家）。

### 1.2 HTTP 状态码边界（客户端决策依据）

| 响应 | 服务端是否已创建任务 | 客户端行为 |
|---|---|---|
| 202 / 200 | **是** | 轮询 `task_id`，等待结果 |
| 400 / 401 / 403 / 404(其他) / 413 / 429 | **否**（落库前拦截） | 模型/分组不被接受时可回退下一候选；其余响亮失败 |
| 409 `IDEMPOTENCY_IN_PROGRESS` | **是** | 等 `Retry-After`，凭 request_id 反查，绝不重提 |
| 409 `IDEMPOTENCY_KEY_CONFLICT` | — | 响亮失败（客户端 bug） |
| 404 `async image tasks are not enabled` / `not supported for this platform` | **否** | **降级同步**单次提交（同键），并把该服务商标记为不可用（10 分钟 TTL） |
| 超时 / 断连 / 5xx | **未知** | 不重提、不换模型；先凭 request_id 反查，查到就继续等原任务 |

最后一条是整个设计的核心：客户端**无法**区分「请求没到」和「请求已到、结果没回来」，
所以任何自动重提都可能重复扣费。反查（只读、不计费）是唯一安全的动作。

## 2. 只靠客户端做不到的事（服务端已支持的部分）

- **超时后的真实状态**：需要异步端点 + `by-request` 反查（服务端已实现）。
- **幂等去重**：需要服务端按 `Idempotency-Key` 去重（服务端已实现）。
- **模型一次出图的审美质量**：客户端只锁定「哪个模型、一次提交、完整提示词」；
  人物一致性/构图保真/面部增强等仍由上游模型决定。

## 3. 上线检查清单（服务端）

服务端代码已改完（`threerouter-sub2api`，见其 `docs/ASYNC_IMAGE_TASKS.md`），**尚未部署**。
2026-09-18 实测线上状态：

```text
POST /v1/images/generations/async   → 404 "async image tasks are not enabled"
GET  /v1/images/generations/by-request/x → 404 page not found   ← 新路由未部署
GET  /v1/images/tasks/xxx           → 404 IMAGE_TASK_NOT_FOUND   ← 旧能力已在
```

需要做两件事：

1. **部署**：`go build` 出新二进制并重启 `sub2api`（`by-request` 路由随本次代码上线）。
2. **开启异步对象存储**：Admin → Backup → Async image object storage（或 `config.yaml`
   的 `image_storage` 块）。不开启的话异步端点永远 404，客户端会一直走同步降级路径。

另外注意：异步端点仅对 **OpenAI / Grok 平台的分组**开放；若生成图片用的 key 所在分组
是其他平台，会返回 `Images API is not supported for this platform`，客户端同样降级同步。

## 4. 上线前 / 上线后，客户端分别是什么行为

| 阶段 | `imageTransport` | 实际传输 | 保证 |
|---|---|---|---|
| 服务端未上线（现状） | `auto`（默认） | **同步单次提交** | 只提交一次；超时/断连绝不重提、绝不换模型；丢失的结果无法找回（同步端点无记录），错误信息会说明 |
| 服务端未上线 | `async`（强制） | 提交前响亮失败 | 上线验收口径：明确告诉你异步还没好，而不是悄悄降级 |
| 服务端已上线 | `auto` | **异步任务**（202 + 轮询） | 上述全部 + 超时/断连后凭 request_id 找回原任务；同键重复提交只创建一个任务 |

`auto` 模式的切换是自动的：客户端对「异步不可用」的判定缓存 10 分钟
（`TRANSPORT_PROBE_TTL_MS`），服务端上线后**无需重启 DSH**，最多 10 分钟内自动切回异步。
想立即验证就用 `imageTransport: async` 强制异步——失败会响亮报错。

## 5. 客户端配置（`cordis.patch.yml` / profile）

```yaml
imageTransport: auto                  # auto（默认）| async（强制，上线验收）| sync（强制同步）
imageUnknownStatePolicy: fail         # fail（默认，不重提）| resubmit-same-key（同键重提一次，服务端按键去重）
watermark:
  enabled: true
  text: Threerouter
  position: bottom-right              # 四角之一
  opacity: 0.68
  fontSizeRatio: 0.032                # 相对图片宽度
  marginXRatio: 0.028
  marginYRatio: 0.012
  glowEnabled: true
  glowColor: '#ffffff'
  glowBlurRatio: 0.18
```

## 6. 验证方式（服务端上线后）

```bash
# 真实打线上（最多消耗 1-2 张图的额度）
DSH_IMAGE_VIDEO_LIVE=1 THREEROUTER_MEDIA_API_KEY=sk-… \
  npx vitest run tests/live-image-contract.test.ts
```

断言内容：202 + task_id → 同键重提交回放同一任务（`X-Idempotency-Replayed`）→
`by-request` 找回同一任务 → 同键不同请求体 409 → 轮询出结果且图片可下载。
这条链就是「提交响应丢失后不重复扣费」的完整证据。
