/**
 * 单集导出（集重构 M5）：只导出一集，不连带整部剧集。
 *
 * 产物是一个自描述的 `episode.json` 加 `files/` 里被本集镜头引用到的素材副本；
 * 文件缺失时照实记进 `missing`，不静默跳过。剧本、分段、分镜、提示词都写进清单，
 * 因此拿到这一个目录就能看到这一集的全部内容。
 *
 * @module dsh-image-video/workbench/episode-export
 */

import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { WorkbenchStore } from './store.ts'

/** 单集清单版本。 */
export const EPISODE_EXPORT_VERSION = 1

/** 单集清单里的一条文件。 */
interface EpisodeExportFile {
  readonly assetId: string
  readonly kind: string
  readonly file: string
  readonly bytes: number
}

/** 单集清单。 */
export interface EpisodeExportManifest {
  readonly formatVersion: number
  readonly plugin: 'dsh-image-video'
  readonly exportedAt: string
  readonly projectId: string
  readonly episode: {
    readonly id: string
    readonly no: number
    readonly title: string
    readonly script: string
    readonly durationSec: number
  }
  readonly segments: readonly unknown[]
  readonly files: readonly EpisodeExportFile[]
  readonly missing: readonly string[]
}

/** 导出结果。 */
export interface EpisodeExportResult {
  readonly manifestPath: string
  readonly manifest: EpisodeExportManifest
}

/**
 * 导出一集到指定目录。
 * @param input.store - 工作台仓储。
 * @param input.episodeId - 集 id。
 * @param input.targetDir - 目标目录（不存在会创建）。
 * @param input.now - 时钟（测试注入）。
 * @returns 清单路径与内容。
 * @throws {Error} 集不存在时。
 */
export async function exportEpisode(input: {
  readonly store: WorkbenchStore
  readonly episodeId: string
  readonly targetDir: string
  readonly now?: () => Date
}): Promise<EpisodeExportResult> {
  const episode = await input.store.getEpisode(input.episodeId)
  await mkdir(join(input.targetDir, 'files'), { recursive: true })

  const referenced = new Set(episode.storyboards.flatMap(storyboard => storyboard.shots.flatMap(shot => shot.refs))
    .filter(ref => ref.kind === 'asset')
    .map(ref => ref.id))
  const files: EpisodeExportFile[] = []
  const missing: string[] = []
  for (const asset of await input.store.listAssets()) {
    if (!referenced.has(asset.id)) continue
    const info = await stat(asset.path).catch(() => undefined)
    if (info === undefined || !info.isFile()) {
      missing.push(asset.path)
      continue
    }
    const file = `files/${asset.id}-${basename(asset.path)}`
    await copyFile(asset.path, join(input.targetDir, file))
    files.push({ assetId: asset.id, kind: asset.kind, file, bytes: info.size })
  }

  const manifest: EpisodeExportManifest = {
    formatVersion: EPISODE_EXPORT_VERSION,
    plugin: 'dsh-image-video',
    exportedAt: (input.now?.() ?? new Date()).toISOString(),
    projectId: episode.projectId,
    episode: {
      id: episode.id,
      no: episode.no,
      title: episode.title,
      script: episode.script.text,
      durationSec: episode.segments.reduce((total, segment) => total + segment.durationSec, 0),
    },
    segments: episode.segments,
    files,
    missing,
  }
  const manifestPath = join(input.targetDir, 'episode.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { manifestPath, manifest }
}
