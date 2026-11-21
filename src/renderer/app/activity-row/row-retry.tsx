// Retry from an activity row (spec/screens-ai.md, "The activity panel", Row 4) [REQ: FR-069]:
// for a failed or cancelled background job only; an attached job is started again from its
// own dialog or tab (A-63). A local provider retries at once. A paid picture or cut-out run
// goes through the run dialog in retry mode, with the count job.retry will ask for (FN-4).
// Any other paid kind (video) keeps the run row's one-line paid confirm: the run dialog has
// no video job.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { RunDialog, type RunCount, type RunJob } from '@/renderer/dialogs/run-dialog'
import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'
import { requestCount } from '@/renderer/stores/job-store'
import layout from '@/renderer/ui/layout.module.css'
import { JOB_KIND_CLASSES } from '@/shared/config/job-kinds'
import { picturesLeft } from '@/shared/generation/pictures-left'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

const DIALOG_JOBS: Partial<Record<JobRow['kind'], RunJob>> = {
  image_generation: 'image',
  cutout: 'cutout',
}

export const retryShown = (job: JobRow) =>
  (job.status === 'failed' || job.status === 'cancelled') &&
  JOB_KIND_CLASSES[job.kind] === 'background'

function pictureCount(job: JobRow): RunCount | undefined {
  const count = requestCount(job)
  if (job.kind !== 'image_generation' || count === null) return undefined
  const left = picturesLeft(count, job.result)
  return { label: 'Pictures', value: left, min: left, max: left }
}

export function RowRetry(props: {
  job: JobRow
  projectId: string
  provider: ProviderInfo | undefined
  providerLabel: string
}) {
  const { job, projectId } = props
  const command = useApp((s) => s.command)
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  // An unknown provider is treated as paid, so a retry never skips the confirm.
  const paid = props.provider?.local !== true
  const dialogJob = DIALOG_JOBS[job.kind]
  const send = () => command('job.retry', { projectId, jobId: job.id })

  async function retryNow() {
    setAsking(false)
    setSending(true)
    try {
      await send()
    } finally {
      setSending(false)
    }
  }

  async function confirmInDialog() {
    const reply = await send()
    if (reply.ok) setAsking(false)
    return reply
  }

  return (
    <>
      {!(asking && dialogJob === undefined) && (
        <button
          type="button"
          className={layout.small}
          disabled={sending}
          onClick={() => (paid ? setAsking(true) : void retryNow())}
        >
          Retry
        </button>
      )}
      {asking && dialogJob !== undefined && (
        <RunDialog
          open
          projectId={projectId}
          job={dialogJob}
          title="Try again"
          confirmLabel="Try again"
          count={pictureCount(job)}
          campaignId={job.campaignId ?? undefined}
          retry={{ provider: job.provider ?? '' }}
          onConfirm={confirmInDialog}
          onCancel={() => setAsking(false)}
        />
      )}
      {asking && dialogJob === undefined && (
        <PaidConfirm
          count={requestCount(job)}
          providerLabel={props.providerLabel}
          onConfirm={() => void retryNow()}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
