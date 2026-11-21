// The line under "Cut out the subject…" (spec/screens-ai.md, "Cut-out"): it follows the
// started job by job.updated, as the generate fields' line does. "Cutting out…" until it ends,
// then "Done. The cut-out is under Earlier options.", the failure sentence (ui/run-failure/),
// or "Cancelled.". It reads job.list for the layer once, so a change it missed is shown; a
// listed row that is not newer than the one it holds is dropped, as the job store does (F-10).
import { useEffect, useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './picture-fields.module.css'

function useJobRow(projectId: string, layerId: string, jobId: string): JobRow | null {
  const api = useApi()
  const [row, setRow] = useState<JobRow | null>(null)
  useEffect(() => {
    let live = true
    const stop = api.on('job.updated', (next) => {
      if (next.id === jobId) setRow(next)
    })
    void api.query('job.list', { projectId, layerId }).then((result) => {
      const rows = result.ok ? ((result.data as JobRow[] | null) ?? []) : []
      const found = rows.find((r) => r.id === jobId)
      if (live && found)
        setRow((held) => (held && held.updatedAt >= found.updatedAt ? held : found))
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, layerId, jobId])
  return row
}

export function CutOutStatus(props: { projectId: string; layerId: string; jobId: string }) {
  const row = useJobRow(props.projectId, props.layerId, props.jobId)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const status = row?.status ?? 'queued'
  const provider = providers.find((p) => p.id === row?.provider)
  return (
    <div className={styles.status} aria-live="polite">
      {(status === 'queued' || status === 'running') && <p>Cutting out…</p>}
      {status === 'succeeded' && <p>Done. The cut-out is under Earlier options.</p>}
      {status === 'cancelled' && <p>Cancelled.</p>}
      {status === 'failed' && row && (
        <RunFailure
          row={row}
          projectId={props.projectId}
          provider={provider}
          providerLabel={provider?.label ?? row.provider ?? 'The provider'}
        />
      )}
    </div>
  )
}
