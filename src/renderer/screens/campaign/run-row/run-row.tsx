// One run (SPEC 14 1.41 TP-2 "A run's row, by status"). queued: Waiting. running: Working,
// with the stage, the place in the queue and the percent when the row has them. succeeded:
// its results. failed: RunFailure (the sentence by reason or kind, S2-5), and Retry. cancelled:
// Cancelled, and Retry. Cancel shows for a queued or running run when the provider can cancel. A failed
// run never shows raw error text: the wire row holds none (SPEC 3.3 [1.9]). A video run
// (SPEC 14 1.57 TP-6) says "Video" and, while running, the text from video-status.ts.
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { picturesLeft } from '@/shared/generation/pictures-left'
import type { JobRow } from '@/shared/schemas/rows/job'
import { requestCount, type JobStore } from '@/renderer/stores/job-store'
import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'
import { RunFailure } from '@/renderer/screens/campaign/run-failure'
import { RunResult } from '@/renderer/screens/campaign/run-result'
import { VideoResult } from '@/renderer/screens/campaign/video-result'
import { useNow, videoRunningText } from './video-status'
import layout from '@/renderer/ui/layout.module.css'

// What a provider reports while it works (SPEC 6.11.1 [1.38]): read from `result` only when
// it is there and of the right type.
export function workingDetail(row: JobRow): string {
  const shown = (typeof row.result === 'object' && row.result !== null ? row.result : {}) as {
    stage?: unknown
    queuePosition?: unknown
  }
  const parts: string[] = []
  if (typeof shown.stage === 'string') parts.push(shown.stage)
  if (typeof shown.queuePosition === 'number') parts.push(`place in queue ${shown.queuePosition}`)
  if (row.progress !== null) parts.push(`${Math.round(row.progress * 100)}%`)
  return parts.join(' · ')
}

// FN-4: a picture run's Retry asks only for the pictures not yet kept, as job.retry does.
function retryCount(row: JobRow): number | null {
  const count = requestCount(row)
  if (row.kind !== 'image_generation' || count === null) return count
  return picturesLeft(count, row.result)
}

const STATUS_TEXT = {
  queued: 'Waiting',
  running: 'Working',
  succeeded: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const

export function RunRow(props: { row: JobRow; projectId: string; store: JobStore }) {
  const { row, projectId, store } = props
  const command = useApp((s) => s.command)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const [asking, setAsking] = useState(false)
  // SPEC 14 1.48 TL-2: true from the send until any reply, so a second click starts nothing.
  const [sending, setSending] = useState(false)
  const provider = providers.find((p) => p.id === row.provider)
  const label = provider?.label ?? row.provider ?? 'The provider'
  const active = row.status === 'queued' || row.status === 'running'
  const ended = row.status === 'failed' || row.status === 'cancelled'
  // SPEC 14 1.57 TP-6: a video run says "Video", and its own text while it runs.
  const video = row.kind === 'video_generation'
  const now = useNow(video && row.status === 'running')
  const statusText =
    video && row.status === 'running' ? videoRunningText(row, now) : STATUS_TEXT[row.status]
  const detail = row.status === 'running' && !video ? workingDetail(row) : ''

  async function retry() {
    setAsking(false)
    setSending(true)
    try {
      const result = await command('job.retry', { projectId, jobId: row.id })
      if (result.ok) store.getState().track(result.data)
    } finally {
      setSending(false)
    }
  }

  // An unknown provider is treated as paid, so a retry never skips the confirm.
  const paid = provider?.local !== true
  return (
    <li className={layout.card}>
      <div className={layout.row}>
        <span>{label}</span>
        {video && <span>Video</span>}
        <span>{statusText}</span>
        {detail && <span className={layout.muted}>{detail}</span>}
        {active && provider !== undefined && provider.cancel !== 'none' && (
          <button
            type="button"
            onClick={() => void command('job.cancel', { projectId, jobId: row.id })}
          >
            Cancel
          </button>
        )}
        {ended && !asking && (
          <button
            type="button"
            disabled={sending}
            onClick={() => (paid ? setAsking(true) : void retry())}
          >
            Retry
          </button>
        )}
      </div>
      {row.startedBy === 'agent' && <p className={layout.muted}>Started by an agent</p>}
      {row.status === 'failed' && (
        <RunFailure row={row} projectId={projectId} provider={provider} providerLabel={label} />
      )}
      {asking && (
        <PaidConfirm
          count={retryCount(row)}
          providerLabel={label}
          onConfirm={() => void retry()}
          onCancel={() => setAsking(false)}
        />
      )}
      {row.status === 'succeeded' && !video && (
        <RunResult row={row} projectId={projectId} store={store} />
      )}
      {row.status === 'succeeded' && video && (
        <VideoResult row={row} projectId={projectId} store={store} />
      )}
    </li>
  )
}
