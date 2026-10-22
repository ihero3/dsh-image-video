/**
 * 重新生成 `examples/hello-workbench` 示例项目包。
 *
 * 示例包刻意**不是手写 JSON**：它由真实的导出实现（`exportProjectPackage`）产出，
 * 所以格式版本、`files/` 目录、每个副本的 sha256/字节数都与用户导出的包完全同构；
 * 唯一的人工步骤是把清单里会泄露本机绝对路径的 `originPath` 换成包内文件名。
 *
 * 用法：`npx tsx examples/build-hello-workbench.ts`
 * 校验：`npx vitest run tests/example-package.test.ts`（真的把这个包导进临时工作台）
 */
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportProjectPackage, type ProjectPackageManifest } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const HERE = import.meta.dirname
const SAMPLE = join(HERE, 'hello-workbench', 'files', 'sample-cover.png')
const OUT = join(HERE, 'hello-workbench')
const PROJECT_NAME = 'Hello Workbench（示例）'

const scratch = await mkdtemp(join(tmpdir(), 'dsh-example-pkg-'))
try {
  const store = new WorkbenchStore({ directory: join(scratch, 'workbench') })
  const project = await store.createProject(PROJECT_NAME)

  // 1) 素材：示例封面（真实文件 → 导出时复制进 files/ 并记 sha256）
  await store.attachAsset({
    projectId: project.id,
    path: SAMPLE,
    kind: 'image',
    prompt: '示例封面：青蓝到琥珀的横向渐变（320×180，由 build-hello-workbench.ts 生成）',
  })

  // 2) 创作资源：一条风格约束，演示「资源会被剧本/生成引用」
  await store.createResource({
    projectId: project.id,
    kind: 'style',
    name: '示例风格：冷静科技感 / 低饱和',
    note: '低饱和青蓝主色，克制的琥珀点缀，避免高对比度噪点。',
  })

  // 3) 画布：三节点一条线（提示词 → 首帧 → 视频），让新用户打开就能看到"能跑的样子"
  await store.saveWorkflow({
    projectId: project.id,
    name: '示例：三节点生成链',
    nodes: [
      { id: 'n-prompt', kind: 'creative-input', position: { x: 40, y: 120 }, params: { text: '一只在雨后街道上行走的猫，电影感侧光' } },
      { id: 'n-image', kind: 'image-generate', position: { x: 320, y: 120 }, params: { prompt: '一只在雨后街道上行走的猫，电影感侧光', ratio: '16:9' } },
      { id: 'n-video', kind: 'video-generate', position: { x: 600, y: 120 }, params: { prompt: '镜头缓慢推近，雨后街道反光' } },
    ],
    edges: [
      { id: 'e1', source: 'n-prompt', target: 'n-image' },
      { id: 'e2', source: 'n-image', target: 'n-video' },
    ],
  })

  // 4) 时间轴：一条 5 秒视频轨 + 一条字幕轨，演示导出前的成片结构
  await store.saveTimeline({
    projectId: project.id,
    name: '示例：5 秒成片',
    burnSubtitles: true,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: SAMPLE, startMs: 0, durationMs: 5000 }] },
      { id: 's1', kind: 'subtitle', clips: [{ id: 'c2', startMs: 0, durationMs: 2500, text: 'Hello Workbench' }] },
    ],
  })

  const { manifest } = await exportProjectPackage({
    store,
    projectId: project.id,
    targetDir: OUT,
    now: () => new Date('2026-10-22T00:00:00.000Z'),
  })

  // 5) 去掉会泄露本机路径的来源列，副本改名成稳定名字（sha256 与字节数照旧有效）
  const asset = manifest.assets[0]
  if (asset?.file !== undefined) {
    const stable = 'files/sample-cover.png'
    await rename(join(OUT, asset.file), join(OUT, stable))
    const rewritten: ProjectPackageManifest = {
      ...manifest,
      assets: [{ ...asset, file: stable, originPath: 'sample-cover.png' }],
      missing: [],
    }
    await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(rewritten, null, 2)}\n`, 'utf8')
  }
  await readFile(join(OUT, 'manifest.json'), 'utf8')
  console.log(`示例包已生成：${OUT}`)
} finally {
  await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
}
