// spec/screens-ai.md, "Attached jobs and the close warning" [D-036, OI-31]: the dialog shown
// before a close that would leave attached jobs running. "Keep open" has the focus and closes
// nothing (Escape and a click outside do the same). "Stop and close" sends job.cancel for each
// job and forgets them, so a late success never applies, then closes.
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { attachedStoreFor, type AttachedJob } from '@/renderer/stores/attached-store'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { PAID_LINE, anyPaid, closeBody, closeTitle, type ClosePlace } from './close-words'
import styles from './close-warning.module.css'

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
      title={closeTitle(jobs)}
      description={closeBody(jobs, props.place)}
    >
      {anyPaid(jobs, providers) && (
        <p className={`${layout.notice} ${layout.warn} ${styles.paid}`}>
          <span className={styles.mark}>
            <Icon name="alert" size="small" />
          </span>
          {PAID_LINE}
        </p>
      )}
      <DialogFoot>
        <button type="button" onClick={props.onKeep}>
          Keep open
        </button>
        <button type="button" className={layout.primary} onClick={stop}>
          Stop and close
        </button>
      </DialogFoot>
    </DialogFrame>
  )
}
