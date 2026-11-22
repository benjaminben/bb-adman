// The newest translation jobs of one language (spec/phases/phase-06.md, design addition 8;
// A-157; CAMP-5). A queued or running job is a spinner mark "Translating" and a "Stop" icon
// button (job.cancel) in the language's header. A failed job stays on the page under the header
// as a danger notice "Failed: {sentence}" with "Retry", which opens the run dialog for a new
// translation.propose of that direction and language (never job.retry). A finished or stopped
// job shows nothing. The sentence names the job's provider, read with job.get.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useJobRow } from '@/renderer/dialogs/brief-reading-dialog/use-job-row'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import type { TranslationJobState } from '@/shared/schemas/queries/translation'
import { ProposeDialog } from './translate-again'

type JobProps = { projectId: string; campaignId: string; job: TranslationJobState }

const NONE: never[] = []

export const isRunning = (job: TranslationJobState) =>
  job.status === 'queued' || job.status === 'running'

export function FailedNotice(props: JobProps) {
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
    <div className={`${layout.notice} ${layout.danger}`}>
      <span role="alert">{`Failed: ${sentence}`}</span>
      <button
        type="button"
        className={`${layout.secondary} ${layout.small}`}
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

export function RunningMark(props: JobProps) {
  const api = useApi()
  const { projectId, job } = props
  const stop = () => {
    void api.command('job.cancel', { projectId, jobId: job.jobId })
    attachedStoreFor(api).getState().end(job.jobId)
  }
  return (
    <>
      <StatusMark tone="running" tip="Translating" />
      <button
        type="button"
        className={layout.iconButton}
        aria-label="Stop"
        title="Stop"
        onClick={stop}
      >
        <Icon name="stop" />
      </button>
    </>
  )
}
