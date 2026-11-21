// A succeeded video run's clip (SPEC 14 1.57 TP-6 "The result"): <video controls
// preload="metadata"> at the run's width, src from assetUrl, no autoplay, sound as the clip
// has it. When it is first drawn, job.markSeen is sent once for the job, as for pictures.
import { useEffect } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { JobStore } from '@/renderer/stores/job-store'
import { videoJobResult } from '@/shared/schemas/jobs/video-generation'
import type { JobRow } from '@/shared/schemas/rows/job'
import layout from '@/renderer/ui/layout.module.css'
import styles from './video-result.module.css'

export function VideoResult(props: { row: JobRow; projectId: string; store: JobStore }) {
  const { row, projectId, store } = props
  const parsed = videoJobResult.safeParse(row.result)
  const unseen = parsed.success && row.seenAt === null

  useEffect(() => {
    if (unseen) void store.getState().markSeen(row.id)
  }, [store, row.id, unseen])

  if (!parsed.success) return <p className={layout.muted}>No clip.</p>
  return (
    <video
      className={styles.clip}
      controls
      preload="metadata"
      src={assetUrl(projectId, parsed.data.assetId)}
      aria-label="Video result"
    />
  )
}
