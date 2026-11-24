// The progress of "Update gallery" (spec/approvals.md "An update in the background", D-110): a
// line of words, the JobProgress bar under it with "Stop", then the note that the dialog can be
// closed. Drawn while approvals.publish runs; its state lives in the app store.
import { JobProgress } from '@/renderer/ui/job-progress'
import { progressLine, progressValue, useUpdateProgress } from './use-update-progress'
import styles from './approval-dialog.module.css'

export function UpdateProgress(props: { projectId: string; campaignId: string }) {
  const progress = useUpdateProgress(props.projectId, props.campaignId)
  return (
    <div className={styles.progress}>
      <p className={styles.waiting}>{progressLine(progress)}</p>
      <JobProgress
        label="Updating the gallery"
        value={progressValue(progress)}
        action={{ label: 'Stop', onClick: progress.stop, disabled: progress.stopping }}
      />
      <p className={styles.line}>You can close this dialog. The update keeps going.</p>
    </div>
  )
}
