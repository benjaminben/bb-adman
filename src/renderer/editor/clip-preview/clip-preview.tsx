// A done video run's clip in the Generate panel (spec/phases/round-2-editor.md D6): drawn by
// its asset address, with controls, metadata only and no autoplay. When first drawn it sends
// job.markSeen once for the job. ED-4b: a clip on the timeline carries the mark "On timeline".
import { useEffect, useRef } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { assetUrl } from '@/renderer/ui/asset-url'
import { StatusMark } from '@/renderer/ui/status-mark'
import { videoJobResult } from '@/shared/schemas/jobs/video-generation'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './clip-preview.module.css'

export function ClipPreview(props: { projectId: string; row: JobRow }) {
  const { projectId, row } = props
  const command = useApp((s) => s.command)
  const parsed = videoJobResult.safeParse(row.result)
  const unseen = parsed.success && row.seenAt === null
  const marked = useRef<string | null>(null)

  useEffect(() => {
    if (!unseen || marked.current === row.id) return
    marked.current = row.id
    void command('job.markSeen', { projectId, jobIds: [row.id] })
  }, [command, projectId, row.id, unseen])

  if (!parsed.success) return null
  return (
    <div className={styles.preview}>
      <video
        className={styles.clip}
        controls
        preload="metadata"
        src={assetUrl(projectId, parsed.data.assetId)}
        aria-label="Video result"
      />
      {parsed.data.clipId !== null && (
        <StatusMark tone="ok" icon="film" label="On timeline" tip="On timeline" />
      )}
    </div>
  )
}
