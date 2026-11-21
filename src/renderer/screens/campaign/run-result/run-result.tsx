// A succeeded run's pictures (SPEC 14 1.41 TP-2 "Results"): one <img> per asset ID, with the
// address from assetUrl. When they are first drawn, job.markSeen is sent once for the job.
import { useEffect } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { resultAssetIds, type JobStore } from '@/renderer/stores/job-store'
import type { JobRow } from '@/shared/schemas/rows/job'
import layout from '@/renderer/ui/layout.module.css'

export function RunResult(props: { row: JobRow; projectId: string; store: JobStore }) {
  const { row, projectId, store } = props
  const assetIds = resultAssetIds(row)
  const unseen = assetIds.length > 0 && row.seenAt === null

  useEffect(() => {
    if (unseen) void store.getState().markSeen(row.id)
  }, [store, row.id, unseen])

  if (assetIds.length === 0) return <p className={layout.muted}>No pictures.</p>
  return (
    <div className={layout.row}>
      {assetIds.map((assetId, i) => (
        <img key={assetId} src={assetUrl(projectId, assetId)} alt={`Result ${i + 1}`} width={160} />
      ))}
    </div>
  )
}
