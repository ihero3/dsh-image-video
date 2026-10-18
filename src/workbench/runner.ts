/**
 * `WorkflowRunner`（`T4-4`）：按拓扑顺序执行一张图，逐节点写运行记录。
 *
 * 三条设计取舍：
 * - **复用对话里的同一条生成链**：生成节点调用的是 `createGenerateImageTool` /
 *   `createGenerateVideoTool` 造出来的工具（参数语义与对话一致，`R-FLW-4`），
 *   因此账本、取消、幂等这些既有能力自动继承。
 * - **不伪造成功**：`planned` 节点与本期没有执行器的数据节点一律记 `skipped` 并写明原因
 *   （`T3-3` 的防伪造口径）；图不通过校验时整次运行直接失败并带上问题清单（`R-FLW-3`）。
 * - **逐节点落库**：每执行完一个节点就更新运行记录，界面靠轮询就能看到进度（没有推送通道）。
 */
import { extractOutcome } from './ledger.ts'
import { nodeCacheKey } from './node-cache.ts'
import { stat } from 'node:fs/promises'
import {
  validateWorkflow,
  type WorkflowNodeKind,
  type WorkflowEdge, type WorkflowNode, type WorkflowRecord,
  type WorkflowRunNodeRecord, type WorkflowRunRecord,
} from './workflow.ts'
import type { WorkbenchStore } from './store.ts'

/** 真正会调用外部生成的节点种类 -> 用哪个工具。 */
const EXECUTORS = { 'image-generate': 'image', 'video-generate': 'video' } as const

/** 产文本的节点：它们的文字会并入下游生成节点的提示词。 */
const TEXT_KINDS = new Set(['creative-input', 'script', 'subtitle'])

/** 默认单节点超时（毫秒）：图像 3 分钟、视频 15 分钟（生成类本来就慢）。 */
export const DEFAULT_NODE_TIMEOUT_MS: Readonly<Record<string, number>> = {
  'image-generate': 180_000,
  'video-generate': 900_000,
}
/** 其它种类的兜底超时。 */
export const FALLBACK_NODE_TIMEOUT_MS = 120_000

/** 默认的节点尝试次数（1 次首发 + 2 次重试）；瞬时失败才用得上。 */
export const DEFAULT_NODE_ATTEMPTS = 3

/**
 * 判断一个失败是否值得重试。
 *
 * 上游流被中断、网关 5xx、超时、限流、连接被重置都属于"服务商那边的抖动"——
 * owner 明确要求这类错误至少重试 3 次、不要直接判任务失败。参数错误、内容被拒、
 * 取消这类**确定性**失败不重试。
 * @param message - 错误原文。
 * @returns 是否重试。
 */
export function isTransientFailure(message: string): boolean {
  if (/abort|cancel|取消/i.test(message)) return false
  return /interrupted|stream|timeout|timed out|超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network|rate ?limit|too many requests|429|50[0-9]|upstream|gateway/i
    .test(message)
}

/** 执行一个生成节点所需的最小工具面（`ToolDefinition` 的子集）。 */
export interface GenerationTool {
  execute(args: unknown, exec: unknown): Promise<unknown>
}

/** 运行器依赖。 */
export interface WorkflowRunnerDeps {
  /** 运行记录落库。 */
  readonly store: WorkbenchStore
  readonly generateImage: GenerationTool
  readonly generateVideo: GenerationTool
  /** 运行 id 生成（测试注入）。 */
  readonly newRunId?: () => string
  /** 时钟（测试注入）。 */
  readonly now?: () => Date
  /** 后台执行里的意外异常上报。 */
  readonly onError?: (message: string) => void
  /** 结构化日志钩子（`T7-3`）。 */
  readonly log?: (entry: Record<string, unknown>) => void
  /** 是否启用跨运行成功结果缓存（默认启用，`R-FLW-5`）。 */
  readonly cache?: boolean
  /** 单个节点的最大尝试次数（默认 3：首发 + 两次重试，仅对瞬时失败生效）。 */
  readonly nodeAttempts?: number
  /** 重试之间的等待毫秒（默认 800，按次数线性退避）。 */
  readonly retryDelayMs?: number
  /** 单节点超时毫秒（按节点种类给；缺省见 DEFAULT_NODE_TIMEOUT_MS）。 */
  readonly nodeTimeoutMs?: (kind: WorkflowNodeKind) => number
  /** 第 N 次重试前的等待毫秒（缺省 = retryDelayMs × 次数）。 */
  readonly retryBackoffMs?: (attempt: number) => number
}

/** 起跑选项：`only` 用于"重试只重跑失败节点及其下游"。 */
export interface RunOptions {
  readonly only?: readonly string[]
  /** 跳过成功结果缓存，强制真的重新生成（用户在界面上点"重新生成"时用）。 */
  readonly bypassCache?: boolean
}

/** 拓扑排序（Kahn）。存在环时按输入顺序返回——环已由校验拦下。 */
export function topologicalOrder(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): WorkflowNode[] {
  const indegree = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source)?.push(edge.target)
  }
  const byId = new Map(nodes.map(node => [node.id, node]))
  const queue = nodes.filter(node => (indegree.get(node.id) ?? 0) === 0).map(node => node.id)
  const order: WorkflowNode[] = []
  while (queue.length > 0) {
    const id = queue.shift() as string
    const node = byId.get(id)
    if (node !== undefined) order.push(node)
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1)
      if ((indegree.get(next) ?? 0) === 0) queue.push(next)
    }
  }
  return order.length === nodes.length ? order : [...nodes]
}

/** 本次运行要执行哪些节点：全图，或"给定节点 + 其全部下游"（重试语义）。 */
export function selectRunNodes(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  only?: readonly string[],
): Set<string> {
  if (only === undefined) return new Set(nodes.map(node => node.id))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source)?.push(edge.target)
  }
  const selected = new Set<string>()
  const visit = (id: string): void => {
    if (selected.has(id)) return
    selected.add(id)
    for (const next of outgoing.get(id) ?? []) visit(next)
  }
  for (const id of only) visit(id)
  return selected
}

/** 逐节点跑一张图。 */
export class WorkflowRunner {
  private readonly controllers = new Map<string, AbortController>()

  constructor(private readonly deps: WorkflowRunnerDeps) {}

  /** 某个运行是否还在进行。 */
  isRunning(id: string): boolean {
    return this.controllers.has(id)
  }

  /**
   * 取消一次运行，并连带中止正在进行的生成。
   * @param id - 运行 id。
   * @returns 是否确实取消了在跑的运行。
   */
  cancel(id: string): boolean {
    const controller = this.controllers.get(id)
    if (controller === undefined) return false
    controller.abort(new Error('cancelled from the workbench'))
    return true
  }

  /**
   * 建一条运行记录并开始执行（立即返回；执行在后台推进，界面轮询记录看进度）。
   * @param workflow - 要跑的流程文档。
   * @param options - `only` 指定本次只跑哪些节点及其下游。
   * @returns 刚建立（状态 `running`，或校验不过时直接 `failed`）的运行记录。
   */
  async begin(workflow: WorkflowRecord, options: RunOptions = {}): Promise<WorkflowRunRecord> {
    const now = this.deps.now?.() ?? new Date()
    const stamp = now.toISOString()
    const runId = this.deps.newRunId?.() ?? `run-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const selected = selectRunNodes(workflow.nodes, workflow.edges, options.only)
    const validation = validateWorkflow(workflow.nodes, workflow.edges)
    const skeleton: WorkflowRunNodeRecord[] = workflow.nodes.map(node => ({
      nodeId: node.id, kind: node.kind, status: 'skipped', startedAt: stamp,
      ...selected.has(node.id) ? {} : { error: 'not part of this run' },
    }))
    const graph = { nodes: workflow.nodes, edges: workflow.edges }

    if (!validation.ok) {
      const failed: WorkflowRunRecord = {
        schemaVersion: 1, id: runId, workflowId: workflow.id, projectId: workflow.projectId,
        status: 'failed', graph, startedAt: stamp, finishedAt: stamp,
        error: validation.issues.map(issue => issue.message).join('; '),
        nodeRuns: skeleton.map(node => ({ ...node, error: 'graph failed validation' })),
      }
      await this.deps.store.recordRun(failed)
      return failed
    }

    const run: WorkflowRunRecord = {
      schemaVersion: 1, id: runId, workflowId: workflow.id, projectId: workflow.projectId,
      status: 'running', graph, nodeRuns: skeleton, startedAt: stamp,
    }
    await this.deps.store.recordRun(run)
    const controller = new AbortController()
    this.controllers.set(runId, controller)
    void this.execute(run, workflow, controller.signal, selected, options)
      .catch((error: unknown) => {
        this.deps.onError?.(`workflow run ${runId} crashed: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => { this.controllers.delete(runId) })
    return run
  }

  /**
   * 重试：只重跑失败节点及其下游。
   * @param run - 上一次的运行记录。
   * @returns 新建立的运行记录。
   */
  async retry(run: WorkflowRunRecord): Promise<WorkflowRunRecord> {
    const workflow: WorkflowRecord = {
      schemaVersion: 1, id: run.workflowId, projectId: run.projectId, name: 'retry',
      nodes: run.graph.nodes, edges: run.graph.edges, createdAt: run.startedAt, updatedAt: run.startedAt,
    }
    const only = run.nodeRuns.filter(node => node.status === 'failed').map(node => node.nodeId)
    return this.begin(workflow, { only })
  }

  /** 依次执行选中的节点；失败即停，下游标为"被上游阻断"。 */
  private async execute(
    run: WorkflowRunRecord,
    workflow: WorkflowRecord,
    signal: AbortSignal,
    selected: Set<string>,
    options: RunOptions,
  ): Promise<void> {
    const nodeRuns = new Map(run.nodeRuns.map(node => [node.nodeId, node]))
    const order = topologicalOrder(workflow.nodes, workflow.edges)
    let status: WorkflowRunRecord['status'] = 'succeeded'
    let error: string | undefined

    for (const node of order) {
      if (!selected.has(node.id)) continue
      if (signal.aborted) { status = 'cancelled'; error = 'cancelled'; break }
      // 先把节点标成 running 并落库：界面靠轮询，这样"正在跑哪个节点"是真实的
      nodeRuns.set(node.id, {
        nodeId: node.id, kind: node.kind, status: 'running',
        startedAt: (this.deps.now?.() ?? new Date()).toISOString(),
      })
      await this.persist(run, nodeRuns, 'running')
      const nodeStartedAt = Date.now()
      const record = await this.runNode(node, workflow, nodeRuns, signal, run, options)
      // `R-QCK-3`：产物落地时，把"这张图用到的创作资源"记成使用记录（同产物同资源只留最新）
      if (record.status === 'succeeded' && record.outputPath !== undefined) {
        const resourceIds = workflow.nodes
          .filter(candidate => candidate.kind === 'resource-reference')
          .map(candidate => candidate.params.resourceId)
          .filter((value): value is string => typeof value === 'string' && value !== '')
        await this.deps.store.recordResourceUsage?.(resourceIds.map(resourceId => ({
          resourceId, projectId: workflow.projectId, assetPath: record.outputPath as string,
          runId: run.id, nodeId: node.id, at: (this.deps.now?.() ?? new Date()).toISOString(),
        }))).catch?.(() => undefined) ?? 0
      }
      this.deps.log?.({
        event: 'workflow-node', runId: run.id, nodeId: node.id, kind: node.kind,
        status: record.status, attempt: record.attempts ?? 1, durationMs: Date.now() - nodeStartedAt,
        ...record.outputPath === undefined ? {} : { outputPath: record.outputPath },
        ...record.error === undefined ? {} : { error: record.error },
      })
      nodeRuns.set(node.id, record)
      if (record.status === 'failed') { status = 'failed'; error = record.error; break }
      if (record.status === 'cancelled') { status = 'cancelled'; error = record.error; break }
      await this.persist(run, nodeRuns, 'running')
    }

    // 没轮到的下游如实标注（不假装成功）
    if (status === 'failed') {
      for (const node of order) {
        const record = nodeRuns.get(node.id)
        if (record !== undefined && record.status === 'skipped' && record.error === undefined) {
          nodeRuns.set(node.id, { ...record, error: 'blocked by an upstream failure' })
        }
      }
    }
    // controller 提前清理：persist 写 store 之后任何时刻 cancel 都应返回 false。
    // （begin 的 .finally 是异常/提前返回的兜底；两处都 delete 是幂等的。）
    this.controllers.delete(run.id)
    await this.persist(run, nodeRuns, status, error)
  }

  /** 执行单个节点。 */
  private async runNode(
    node: WorkflowNode,
    workflow: WorkflowRecord,
    done: Map<string, WorkflowRunNodeRecord>,
    signal: AbortSignal,
    run: WorkflowRunRecord,
    options: RunOptions,
  ): Promise<WorkflowRunNodeRecord> {
    const startedAt = (this.deps.now?.() ?? new Date()).toISOString()
    const executor = EXECUTORS[node.kind as keyof typeof EXECUTORS]
    if (executor === undefined) {
      // 本期只有生成节点有执行器：其余如实记 skipped，不伪造成功
      return {
        nodeId: node.id, kind: node.kind, status: 'skipped', startedAt, finishedAt: startedAt,
        error: `no executor for ${node.kind} in this version`,
      }
    }
    const tool = executor === 'image' ? this.deps.generateImage : this.deps.generateVideo
    const maxAttempts = Math.max(1, this.deps.nodeAttempts ?? DEFAULT_NODE_ATTEMPTS)
    const args = this.buildArgs(node, workflow, done)

    // 跨运行缓存（`R-FLW-5`）：同参数同上游 → 直接复用上次产物，不再调外部生成
    const cacheKey = nodeCacheKey({ kind: node.kind, args })
    // 防御：缓存是 store 的可选能力，缺了也不该让整次运行崩掉（测试替身就没有）
    const cacheLookup = this.deps.cache === false || options.bypassCache === true
      ? undefined
      : this.deps.store.lookupNodeCache?.bind(this.deps.store)
    if (cacheLookup !== undefined) {
      const hit = await cacheLookup(cacheKey).catch(() => undefined)
      const stillThere = hit === undefined ? false : await stat(hit.outputPath).then(() => true).catch(() => false)
      if (hit !== undefined && stillThere) {
        const finishedAt = (this.deps.now?.() ?? new Date()).toISOString()
        return {
          nodeId: node.id, kind: node.kind, status: 'succeeded', startedAt, finishedAt,
          attempts: 1, cached: true, outputPath: hit.outputPath,
          ...hit.bytes === undefined ? {} : { bytes: hit.bytes },
        }
      }
    }

    let lastMessage = ''
    const timeoutMs = Math.max(1, this.deps.nodeTimeoutMs?.(node.kind)
      ?? DEFAULT_NODE_TIMEOUT_MS[node.kind] ?? FALLBACK_NODE_TIMEOUT_MS)
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // 每次尝试独立控制器 + 超时护栏：既让工具能收到取消信号，也保证"工具不听话"时节点仍能结束
      const attemptController = new AbortController()
      const combined = AbortSignal.any([signal, attemptController.signal])
      let timedOut = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true
          attemptController.abort()
          reject(new Error(`节点执行超时（${Math.round(timeoutMs / 1000)}s）：上游没有在时限内返回`))
        }, timeoutMs)
        timer.unref?.()
      })
      try {
        const value = await Promise.race([tool.execute(args, { signal: combined }), timeoutPromise])
        const extracted = extractOutcome(value)
        if (this.deps.cache !== false && typeof extracted.outputPath === 'string') {
          await this.deps.store.rememberNodeCache?.({
            key: cacheKey, kind: node.kind, args, outputPath: extracted.outputPath,
            ...extracted.bytes === undefined ? {} : { bytes: extracted.bytes },
            runId: run.id, nodeId: node.id, at: (this.deps.now?.() ?? new Date()).toISOString(),
          }).catch(() => undefined)
        }
        return {
          nodeId: node.id, kind: node.kind, status: 'succeeded', startedAt,
          finishedAt: (this.deps.now?.() ?? new Date()).toISOString(), attempts: attempt, ...extracted,
        }
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error)
        const cancelled = signal.aborted || /abort|cancel/i.test(lastMessage)
        if (cancelled) {
          return {
            nodeId: node.id, kind: node.kind, status: 'cancelled', startedAt,
            finishedAt: (this.deps.now?.() ?? new Date()).toISOString(), attempts: attempt, error: lastMessage,
          }
        }
        // 上游抖动这类瞬时失败自动重试（owner 要求 ≥3 次），确定性失败立即收手
        if (attempt < maxAttempts && isTransientFailure(lastMessage)) {
          this.deps.onError?.(`node ${node.id} attempt ${attempt}/${maxAttempts} failed transiently: ${lastMessage}`)
          const delay = this.deps.retryBackoffMs?.(attempt) ?? (this.deps.retryDelayMs ?? 800) * attempt
          await new Promise(resolve => { setTimeout(resolve, delay) })
          continue
        }
        return {
          nodeId: node.id, kind: node.kind, status: 'failed', startedAt,
          finishedAt: (this.deps.now?.() ?? new Date()).toISOString(), attempts: attempt, error: lastMessage,
        }
      } finally {
        if (timer !== undefined) clearTimeout(timer)
        void timedOut
      }
    }
    return {
      nodeId: node.id, kind: node.kind, status: 'failed', startedAt,
      finishedAt: (this.deps.now?.() ?? new Date()).toISOString(), attempts: maxAttempts,
      error: lastMessage === '' ? 'node failed without an error message' : lastMessage,
    }
  }

  /** 节点参数 → 工具参数（与对话里 `generate_image` / `generate_video` 同一套语义）。 */
  private buildArgs(
    node: WorkflowNode,
    workflow: WorkflowRecord,
    done: Map<string, WorkflowRunNodeRecord>,
  ): Record<string, unknown> {
    const upstreamText = this.upstreamTexts(node, workflow, done)
    const own = typeof node.params.prompt === 'string' ? node.params.prompt : ''
    const prompt = [upstreamText, own].filter(part => part !== '').join('\n')
    const model = typeof node.params.model === 'string' ? node.params.model : ''

    if (node.kind === 'image-generate') {
      return {
        prompt,
        size: typeof node.params.ratio === 'string' ? node.params.ratio : '3:4',
        ...model === '' ? {} : { model },
      }
    }

    const reference = typeof node.params.referenceVideo === 'string' ? node.params.referenceVideo : ''
    const resolution = typeof node.params.resolution === 'string' ? node.params.resolution : ''
    const firstFrame = this.upstreamOutput(node, workflow, done)
    return {
      prompt,
      duration: typeof node.params.duration === 'number' ? node.params.duration : 5,
      aspectRatio: typeof node.params.ratio === 'string' ? node.params.ratio : '16:9',
      compare: node.params.compare === true,
      ...model === '' ? {} : { model },
      // 留空就不发：分辨率这类取值各模型不同，交给宿主/模型默认（现场踩过 400）
      ...resolution === '' ? {} : { resolution },
      ...firstFrame === undefined ? {} : { image: firstFrame },
      ...reference === '' ? {} : { media: [{ video: reference }] },
    }
  }

  /** 上游文本节点的文字（按拓扑序拼接），作为生成节点提示词的上下文。 */
  private upstreamTexts(
    node: WorkflowNode,
    workflow: WorkflowRecord,
    done: Map<string, WorkflowRunNodeRecord>,
  ): string {
    const parts: string[] = []
    for (const upstream of this.upstreams(node, workflow)) {
      if (!TEXT_KINDS.has(upstream.kind)) continue
      const text = upstream.params.text ?? upstream.params.brief
      if (typeof text === 'string' && text !== '') parts.push(text)
      void done
    }
    return parts.join('\n')
  }

  /** 最近的上游产物路径（按拓扑序里最后一个已成功的媒体节点），作为首帧。 */
  private upstreamOutput(
    node: WorkflowNode,
    workflow: WorkflowRecord,
    done: Map<string, WorkflowRunNodeRecord>,
  ): string | undefined {
    let found: string | undefined
    for (const upstream of this.upstreams(node, workflow)) {
      const record = done.get(upstream.id)
      if (record?.status === 'succeeded' && record.outputPath !== undefined) found = record.outputPath
    }
    return found
  }

  /** 直接上游节点（入边来源）。 */
  private upstreams(node: WorkflowNode, workflow: WorkflowRecord): WorkflowNode[] {
    const byId = new Map(workflow.nodes.map(candidate => [candidate.id, candidate]))
    return workflow.edges
      .filter(edge => edge.target === node.id)
      .flatMap(edge => {
        const source = byId.get(edge.source)
        return source === undefined ? [] : [source]
      })
  }

  /** 把当前节点状态写回运行记录（界面靠轮询看进度）。 */
  private async persist(
    run: WorkflowRunRecord,
    nodeRuns: Map<string, WorkflowRunNodeRecord>,
    status: WorkflowRunRecord['status'],
    error?: string,
  ): Promise<void> {
    const finishedAt = status === 'running' ? undefined : (this.deps.now?.() ?? new Date()).toISOString()
    try {
      await this.deps.store.updateRun(run.id, {
        status, nodeRuns: [...nodeRuns.values()], ...finishedAt === undefined ? {} : { finishedAt },
        ...error === undefined ? {} : { error },
      })
    } catch (failure) {
      this.deps.onError?.(`could not persist run ${run.id}: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
  }
}
