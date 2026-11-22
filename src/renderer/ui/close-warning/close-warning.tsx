// spec/screens-ai.md, "Attached jobs and the close warning" [D-036, OI-31]: the dialog shown
// before a close that would leave attached jobs running. "Keep open" has the focus and closes
// nothing (Escape and a click outside do the same). "Stop and close" sends job.cancel for each
// job and forgets them, so a late success never applies, then closes.
// SH-5: one close question, a confirm dialog. With a paid provider the paid line is its warning
// (visible in the head and its accessible description). A tab's question has no sentence that
// repeats the title; a dialog's (copy options, brief reading) keeps it.
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { attachedStoreFor, type AttachedJob } from '@/renderer/stores/attached-store'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { PAID_LINE, anyPaid, closeBody, closeTitle, type ClosePlace } from './close-words'

export type CloseWarningProps = {
  jobs: AttachedJob[]
  place: ClosePlace
  onKeep: () => void
  onStopped: () => void
}

export function CloseWarning(props: CloseWarningProps) {
  const api = useApi()
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const { jobs } = props

  function stop() {
    const store = attachedStoreFor(api).getState()
    for (const { jobId, owner } of jobs) {
      void api.command('job.cancel', { projectId: owner.projectId, jobId })
      store.end(jobId)
    }
    props.onStopped()
  }

  return (
    <DialogFrame
      open={jobs.length > 0}
      onClose={props.onKeep}
      kind="confirm"
      title={closeTitle(jobs)}
      {...(props.place === 'dialog' && { description: closeBody(jobs, props.place) })}
      {...(anyPaid(jobs, providers) && { warning: PAID_LINE })}
    >
      <DialogFoot>
        <button type="button" className={layout.quiet} onClick={props.onKeep}>
          Keep open
        </button>
        <button type="button" className={layout.primary} onClick={stop}>
          Stop and close
        </button>
      </DialogFoot>
    </DialogFrame>
  )
}
