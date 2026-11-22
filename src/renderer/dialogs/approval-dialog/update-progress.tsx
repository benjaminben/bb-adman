// The waiting line of "Update gallery" and its quiet "Stop" (round-2-approvals-video.md "The
// dialog"). Mounted only while approvals.publish runs, so each update starts afresh.
import { progressLine, useUpdateProgress } from './use-update-progress'
import layout from '@/renderer/ui/layout.module.css'
import styles from './approval-dialog.module.css'

export function UpdateProgress(props: { projectId: string; campaignId: string }) {
  const progress = useUpdateProgress(props.projectId, props.campaignId)
  return (
    <div className={styles.progress}>
      <p className={styles.waiting}>{progressLine(progress)}</p>
      <button
        type="button"
        className={layout.quiet}
        disabled={progress.stopping}
        onClick={progress.stop}
      >
        Stop
      </button>
    </div>
  )
}
