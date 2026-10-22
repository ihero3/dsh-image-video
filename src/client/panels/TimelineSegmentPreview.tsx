/**
 * B-13 时间轴逐段预览：按片段顺序播放视频轨上的素材，显示当前段与总时长。
 *
 * 这里只做逐段播放，不合成；真成片由宿主 ffmpeg 导出。切段时通过 `key` 重挂
 * `<video>`，避免残留上一段的位置与播放状态。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { TimelineClip, TimelineRecord } from '../../workbench/timeline.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface TimelineSegmentPreviewProps {
  readonly timeline: TimelineRecord | undefined
  readonly t: (key: WorkbenchLocaleKey) => string
}

/** `m:ss` 文案（`0:03`）。 */
function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
}

/** 视频轨上带素材的片段，按起点排序。 */
function collectVideoClips(timeline: TimelineRecord | undefined): readonly TimelineClip[] {
  if (timeline === undefined) return []
  const track = timeline.tracks.find(item => item.kind === 'video')
  if (track === undefined) return []
  return track.clips
    .filter(clip => clip.assetPath !== undefined)
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
}

/** `/outputs/<文件名>`：宿主把 outputs 目录按文件名暴露给界面。 */
function outputUrl(path: string): string {
  return `/outputs/${encodeURIComponent(path.split(/[\\/]/).pop() ?? '')}`
}

export function TimelineSegmentPreview({ timeline, t }: TimelineSegmentPreviewProps) {
  const clips = useMemo(() => collectVideoClips(timeline), [timeline])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const totalMs = clips.reduce((sum, clip) => sum + clip.durationMs, 0)
  const current = clips[Math.min(index, clips.length - 1)]

  // 时间轴换成别的项目时回到第一段。
  useEffect(() => { setIndex(0); setPlaying(false) }, [timeline?.id])

  // 段播完自动前进；最后一段停在结尾。
  useEffect(() => {
    const video = videoRef.current
    if (!playing || video === null) return
    const advance = () => {
      if (index < clips.length - 1) setIndex(index + 1)
      else setPlaying(false)
    }
    video.addEventListener('ended', advance)
    return () => { video.removeEventListener('ended', advance) }
  }, [playing, index, clips.length])

  // 播放状态与当前段对齐：换段后从该段开头播。
  useEffect(() => {
    const video = videoRef.current
    if (video === null) return
    if (playing) void video.play().catch(() => { setPlaying(false) })
    else video.pause()
  }, [playing, index])

  if (clips.length === 0 || current === undefined) {
    return (
      <div className="iv-seg-preview" data-seg-preview="true">
        <div className="iv-empty">{t('segPreviewEmpty')}</div>
      </div>
    )
  }

  const seek = (next: number) => {
    if (next < 0 || next >= clips.length) return
    setIndex(next)
    setPlaying(true)
  }

  return (
    <div className="iv-seg-preview" data-seg-preview="true">
      <div className="iv-seg-head">
        <button type="button" className="iv-btn iv-btn--sm" onClick={() => { setPlaying(value => !value) }}>
          <Icon name={playing ? 'pause' : 'play'} size={11} />
          {playing ? t('segPause') : t('segPlay')}
        </button>
        <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { seek(0) }}>
          <Icon name="undo" size={11} />{t('segReplay')}
        </button>
        <span className="iv-meta" data-seg-counter="true">
          {index + 1} / {clips.length} · {t('segTotal')} {formatMs(totalMs)}
        </span>
      </div>

      <video
        key={`${current.id}`}
        ref={videoRef}
        className="iv-seg-video"
        src={outputUrl(current.assetPath ?? '')}
        preload="metadata"
        playsInline
        muted
      />

      <div className="iv-seg-bar" role="group" aria-label={t('segPreviewTitle')}>
        {clips.map((clip, position) => (
          <button
            key={clip.id}
            type="button"
            className={`iv-seg-cell${position === index ? ' on' : ''}`}
            style={{ flexGrow: Math.max(1, clip.durationMs) }}
            aria-label={`${t('segJump')} ${position + 1}`}
            title={`#${position + 1} · ${formatMs(clip.durationMs)}`}
            onClick={() => { seek(position) }}
          />
        ))}
      </div>
    </div>
  )
}
