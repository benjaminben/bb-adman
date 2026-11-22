// The one line under "Generate…" (spec/screens-ai.md, "Generate fields"; the words of
// spec/phases/round-2-editor.md D6): it follows the started job by job.updated. "Making {n}
// pictures…" until it ends and, on a layer that was empty, until its first picture is placed
// (stores/placed-runs.ts); then the done words, the failure sentence (ui/run-failure/), or
// "Cancelled.". A visit after the start reads job.list for the layer once, so a change it
// missed is shown. R2E-8: a video run has its own words, and its clip once done.
import { useEffect, useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { ClipPreview } from '@/renderer/editor/clip-preview'
import { useNow, videoRunningText } from '@/renderer/screens/campaign/run-row/video-status'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { GenerateRun } from '@/renderer/stores/generate-drafts'
import { firstKept, usePlacedOutcome, type PlacedOutcome } from '@/renderer/stores/placed-runs'
import { videoJobResult } from '@/shared/schemas/jobs/video-generation'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './generate-fields.module.css'

function useRunRow(projectId: string, layerId: string, jobId: string): JobRow | null {
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
      if (live && found) setRow((held) => (held && held.updatedAt > found.updatedAt ? held : found))
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, layerId, jobId])
  return row
}

const making = (count: number) => (count === 1 ? 'Making 1 picture…' : `Making ${count} pictures…`)

function doneWords(row: JobRow, outcome: PlacedOutcome | undefined): string {
  if (firstKept(row) === null) return 'The run ended with no pictures.'
  return outcome === 'placed'
    ? 'Done. The first new picture is on the layer. Click another below to use it instead.'
    : 'Done. Click a new picture below to put it on the layer.'
}

function videoDoneWords(row: JobRow): string {
  const result = videoJobResult.safeParse(row.result)
  if (result.success && result.data.clipId === null) {
    return 'Done, but the clip could not be put on the timeline. Add it with Add clip… on the timeline.'
  }
  return result.success && result.data.replacedStill === true
    ? 'Done. The new clip is on the timeline below, in place of the still.'
    : 'Done. The new clip is on the timeline below.'
}

function VideoWords(props: { row: JobRow | null; projectId: string }) {
  const { row } = props
  const status = row?.status ?? 'queued'
  const now = useNow(status === 'running')
  if (status === 'queued') return <p>Making the video. Waiting.</p>
  if (status === 'running' && row)
    return <p>{`Making the video. ${videoRunningText(row, now)}.`}</p>
  if (status !== 'succeeded' || !row) return null
  return (
    <>
      <p>{videoDoneWords(row)}</p>
      <ClipPreview projectId={props.projectId} row={row} />
    </>
  )
}

export function RunStatus(props: { projectId: string; layerId: string; run: GenerateRun }) {
  const { run } = props
  const row = useRunRow(props.projectId, props.layerId, run.jobId)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const outcome = usePlacedOutcome(run.jobId)
  const ran = row?.status ?? 'queued'
  const status = ran === 'succeeded' && outcome === 'placing' ? 'running' : ran
  const provider = providers.find((p) => p.id === row?.provider)
  return (
    <div className={styles.status} aria-live="polite">
      {run.kind === 'video' ? (
        <VideoWords row={row} projectId={props.projectId} />
      ) : (
        <>
          {(status === 'queued' || status === 'running') && <p>{making(run.count)}</p>}
          {status === 'succeeded' && row && <p>{doneWords(row, outcome)}</p>}
        </>
      )}
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
