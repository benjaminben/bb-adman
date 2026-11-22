// The newest translation job of one direction in one language (spec/phases/phase-06.md, design
// addition 8; A-157): "Running…" with "Stop" (job.cancel) while it is queued or running; when it
// failed, "The translation did not finish: {sentence}" with "Retry", which opens the run dialog
// for a new translation.propose of that direction and language (never job.retry). A finished
// or stopped job shows nothing. The sentence names the job's provider, read with job.get.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useJobRow } from '@/renderer/dialogs/brief-reading-dialog/use-job-row'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import layout from '@/renderer/ui/layout.module.css'
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import type { TranslationJobState } from '@/shared/schemas/queries/translation'
import { ProposeDialog } from './translate-again'

type LineProps = { projectId: string; campaignId: string; job: TranslationJobState }

const NONE: never[] = []

function FailedLine(props: LineProps) {
  const { projectId, job } = props
  const row = useJobRow(projectId, job.jobId)
  const providers = useApp((s) => s.app?.providers ?? NONE)
  const [retrying, setRetrying] = useState(false)
  if (row === null) return null
  const label = providers.find((p) => p.id === row.provider)?.label ?? row.provider ?? ''
  const sentence = row.errorReason
    ? fillMarks(reasonMessage(row.errorReason), { provider: label })
    : plainMessage(job.errorKind ?? row.errorKind ?? 'other', label)
  return (
    <div className={`${layout.notice} ${layout.warn}`}>
      <span role="alert">{`The translation did not finish: ${sentence}`}</span>
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        onClick={() => setRetrying(true)}
      >
        Retry
      </button>
      {retrying && (
        <ProposeDialog
          projectId={projectId}
          campaignId={props.campaignId}
          target={{ directionId: job.directionId, language: job.language }}
          onClose={() => setRetrying(false)}
        />
      )}
    </div>
  )
}

function RunningLine(props: LineProps) {
  const api = useApi()
  const { projectId, job } = props
  const stop = () => {
    void api.command('job.cancel', { projectId, jobId: job.jobId })
    attachedStoreFor(api).getState().end(job.jobId)
  }
  return (
    <div className={layout.row}>
      <span className={layout.muted}>Running…</span>
      <button type="button" className={`${layout.quiet} ${layout.small}`} onClick={stop}>
        Stop
      </button>
    </div>
  )
}

export function JobLine(props: LineProps) {
  const { status } = props.job
  if (status === 'queued' || status === 'running') return <RunningLine {...props} />
  if (status === 'failed') return <FailedLine {...props} />
  return null
}
