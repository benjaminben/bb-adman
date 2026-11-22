// The run's state under "Generate…" (spec/screens-ai.md, "Generate fields"; the words of
// spec/phases/round-2-editor.md D6): it follows the started job by job.updated. ED-4b: the
// progress and done sentences ("Making {n} pictures…" until it ends and, on a layer that was
// empty, until its first picture is placed (stores/placed-runs.ts); "Done. …") are the text of a
// visually hidden role="status", since the tiles show the run. Visible words stay for the
// failure (ui/run-failure/), "Cancelled.", "The run ended with no pictures." and a clip that
// could not be put on the timeline. A video run shows a progress bar while it goes, and its clip
// once done. A visit after the start reads job.list for the layer once, so a change it missed
// is shown.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { ClipPreview } from '@/renderer/editor/clip-preview'
import { JobProgress } from '@/renderer/ui/job-progress'
import { useNow, videoRunningText } from '@/renderer/ui/run-status'
import { RunFailure } from '@/renderer/ui/run-failure'
import { useRunName } from '@/renderer/ui/run-name'
import type { GenerateRun } from '@/renderer/stores/generate-drafts'
import { firstKept, usePlacedOutcome, type PlacedOutcome } from '@/renderer/stores/placed-runs'
import { videoJobResult } from '@/shared/schemas/jobs/video-generation'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './generate-fields.module.css'
import own from './run-status.module.css'

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
const NO_PICTURES = 'The run ended with no pictures.'
const NOT_PLACED =
  'Done, but the clip could not be put on the timeline. Add it with Add clip… on the timeline.'

function doneWords(row: JobRow, outcome: PlacedOutcome | undefined): string {
  if (firstKept(row) === null) return NO_PICTURES
  return outcome === 'placed'
    ? 'Done. The first new picture is on the layer. Click another below to use it instead.'
    : 'Done. Click a new picture below to put it on the layer.'
}

function videoDoneWords(row: JobRow): string {
  const result = videoJobResult.safeParse(row.result)
  if (result.success && result.data.clipId === null) return NOT_PLACED
  return result.success && result.data.replacedStill === true
    ? 'Done. The new clip is on the timeline below, in place of the still.'
    : 'Done. The new clip is on the timeline below.'
}

// The sentence of the run's state, or null when there is none.
function useWords(run: GenerateRun, row: JobRow | null, status: string, outcome?: PlacedOutcome) {
  const now = useNow(run.kind === 'video' && status === 'running')
  if (status === 'cancelled') return 'Cancelled.'
  if (run.kind !== 'video') {
    if (status === 'queued' || status === 'running') return making(run.count)
    return status === 'succeeded' && row ? doneWords(row, outcome) : null
  }
  if (status === 'queued') return 'Making the video. Waiting.'
  if (status === 'running' && row) return `Making the video. ${videoRunningText(row, now)}.`
  return status === 'succeeded' && row ? videoDoneWords(row) : null
}

// Failures and their fixes stay on the page; the rest is read out only.
const SHOWN = new Set(['Cancelled.', NO_PICTURES, NOT_PLACED])

export function RunStatus(props: { projectId: string; layerId: string; run: GenerateRun }) {
  const { run } = props
  const row = useRunRow(props.projectId, props.layerId, run.jobId)
  const outcome = usePlacedOutcome(run.jobId)
  const ran = row?.status ?? 'queued'
  const status = ran === 'succeeded' && outcome === 'placing' ? 'running' : ran
  const { provider, words: name } = useRunName(row, 'The provider')
  const words = useWords(run, row, status, outcome)
  const shown = words !== null && SHOWN.has(words)
  const going = status === 'queued' || status === 'running'
  return (
    <div className={styles.status}>
      <p role="status" aria-live="polite" className={own.hidden}>
        {shown ? null : words}
      </p>
      {run.kind === 'video' && going && (
        <JobProgress label="Making the video" value={row?.progress ?? null} />
      )}
      <div aria-live="polite" className={own.shown}>
        {shown && <p>{words}</p>}
        {status === 'failed' && row && (
          <RunFailure
            row={row}
            projectId={props.projectId}
            provider={provider}
            providerLabel={name}
          />
        )}
        {run.kind === 'video' && status === 'succeeded' && row && (
          <ClipPreview projectId={props.projectId} row={row} />
        )}
      </div>
    </div>
  )
}
