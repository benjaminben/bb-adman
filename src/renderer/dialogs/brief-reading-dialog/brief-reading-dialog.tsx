// The reading dialog (spec/screens-ai.md, "Reading a brief with AI"; FR-022, FR-171): it follows
// one brief_extraction job, which is attached to it. While the job runs it says who is reading
// and offers Stop (job.cancel, then close). Closing it another way while the job runs asks first
// ("Attached jobs and the close warning"). On success it sends job.markSeen and hands the
// draft over; on failure it shows the sentence, "Type it" (named "Fill the form by hand") and
// "Retry". DLG-3b: the `run` kind.
import { useEffect, useRef } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { attachedStoreFor, dialogJobs } from '@/renderer/stores/attached-store'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { RunFailure } from '@/renderer/ui/run-failure'
import { briefJobResult, type BriefJobResult } from '@/shared/schemas/jobs/brief-extraction'
import type { JobRow } from '@/shared/schemas/rows/job'
import { jobEnded, useJobRow } from './use-job-row'
import styles from './brief-reading-dialog.module.css'
import { serviceWords } from '@/shared/providers/model-words'

export type BriefReadingDialogProps = {
  projectId: string
  jobId: string
  provider: string
  onRead: (result: BriefJobResult) => void
  onTryAgain: () => void
  onByHand: () => void
  onClosed: () => void
}

// A succeeded row whose result is not a brief draft is shown as the kind `other`.
function failedRow(row: JobRow | null): JobRow | null {
  if (row === null || !jobEnded(row) || row.status === 'cancelled') return null
  if (row.status === 'failed') return row
  return briefJobResult.safeParse(row.result).success ? null : { ...row, errorKind: 'other' }
}

export function BriefReadingDialog(props: BriefReadingDialogProps) {
  const { projectId, jobId, onRead, onClosed } = props
  const api = useApi()
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const provider = providers.find((p) => p.id === props.provider)
  // R3-2: the provider and the text model that reads the brief.
  const label = provider ? serviceWords(provider, 'text') : props.provider
  const row = useJobRow(projectId, jobId)
  const owner = `brief-reading-${jobId}`
  const { ask, warning } = useCloseWarning('dialog')
  // The ended row is acted on once, though the callbacks change on each draw.
  const settled = useRef(false)

  useEffect(() => {
    attachedStoreFor(api).getState().register(jobId, { projectId, dialog: owner })
  }, [api, projectId, jobId, owner])

  useEffect(() => {
    if (row === null || !jobEnded(row) || settled.current) return
    if (row.status === 'cancelled') {
      settled.current = true
      return onClosed()
    }
    const read = row.status === 'succeeded' ? briefJobResult.safeParse(row.result) : null
    if (!read?.success) return
    settled.current = true
    void api.command('job.markSeen', { projectId, jobIds: [jobId] })
    onRead(read.data)
  }, [api, row, projectId, jobId, onRead, onClosed])

  const failed = failedRow(row)

  function stop() {
    void api.command('job.cancel', { projectId, jobId })
    attachedStoreFor(api).getState().end(jobId)
    props.onClosed()
  }

  function close() {
    if (failed) return props.onClosed()
    ask((s) => dialogJobs(s, owner), props.onClosed)
  }

  const foot = failed ? (
    <>
      <button type="button" aria-label="Fill the form by hand" onClick={props.onByHand}>
        Type it
      </button>
      <button type="button" className={layout.primary} onClick={props.onTryAgain}>
        Retry
      </button>
    </>
  ) : (
    <button type="button" onClick={stop}>
      Stop
    </button>
  )

  return (
    <>
      <DialogFrame open onClose={close} title="Reading the brief" kind="run" footer={foot}>
        {failed ? (
          <RunFailure
            row={failed}
            projectId={projectId}
            provider={provider}
            providerLabel={label}
          />
        ) : (
          <div className={styles.busy}>
            <BusySpinner />
            <p>{`${label} is reading the brief…`}</p>
          </div>
        )}
      </DialogFrame>
      {warning}
    </>
  )
}
