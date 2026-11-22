// The cut-out's words (spec/screens-ai.md, "Cut-out"; ED-3): it follows the started job by
// job.updated, as the generate fields' line does. "Cutting out…" until it ends, then "Done. The
// cut-out is under Earlier options." Those two are a hidden role="status" (the ring over the
// picture shows the run); a failure (ui/run-failure/) and "Cancelled." stay on the page. It
// reads job.list for the layer once, so a change it missed is shown; a listed row that is not
// newer than the one it holds is dropped, as the job store does (F-10).
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { RunFailure } from '@/renderer/ui/run-failure'
import { useRunName } from '@/renderer/ui/run-name'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './picture-fields.module.css'

export function useJobRow(projectId: string, layerId: string, jobId: string | null) {
  const api = useApi()
  const [row, setRow] = useState<JobRow | null>(null)
  useEffect(() => {
    if (jobId === null) return
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

// Whether a started cut-out is still going: queued or running, or not yet heard of.
export const cutOutRunning = (jobId: string | null, row: JobRow | null) =>
  jobId !== null && (row === null || row.status === 'queued' || row.status === 'running')

export type CutOutLinesProps = { projectId: string; jobId: string | null; row: JobRow | null }

export function CutOutLines(props: CutOutLinesProps) {
  const { row } = props
  const status = props.jobId === null ? null : (row?.status ?? 'queued')
  const { provider, words: name } = useRunName(row, 'The provider')
  return (
    <>
      <p role="status" className={styles.hidden}>
        {(status === 'queued' || status === 'running') && 'Cutting out…'}
        {status === 'succeeded' && 'Done. The cut-out is under Earlier options.'}
      </p>
      {status === 'cancelled' && <p className={styles.status}>Cancelled.</p>}
      {status === 'failed' && row && (
        <RunFailure
          row={row}
          projectId={props.projectId}
          provider={provider}
          providerLabel={name}
        />
      )}
    </>
  )
}

export function CutOutStatus(props: { projectId: string; layerId: string; jobId: string }) {
  const row = useJobRow(props.projectId, props.layerId, props.jobId)
  return <CutOutLines projectId={props.projectId} jobId={props.jobId} row={row} />
}
