// The publish dialog after the start (DLG-6b): the "Publishing" bar with "Run in background",
// which only closes the dialog (the job goes on and shows in Activity). The old started
// sentence stays as the hidden status. When the job ends, one mark says how.
import { JobProgress } from '@/renderer/ui/job-progress'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { PublishJob } from './use-publish-job'
import styles from './publish-dialog.module.css'

const STARTED =
  'Publishing has started. You can close this window and follow it in the activity list.'

const ENDED = {
  succeeded: <StatusMark tone="ok" icon="check" label="Done" tip="Published" />,
  failed: <StatusMark tone="danger" icon="alert" label="Failed" tip="Publishing failed" />,
  cancelled: <StatusMark tone="none" label="Cancelled" tip="Publishing was cancelled" />,
}

export function PublishStarted(props: { job: PublishJob; onClose: () => void }) {
  const { job } = props
  return (
    <div className={styles.body}>
      <p role="status" className={styles.hidden}>
        {STARTED}
      </p>
      {job.kind === 'running' ? (
        <JobProgress
          label="Publishing"
          value={job.value}
          action={{ label: 'Run in background', onClick: props.onClose }}
        />
      ) : (
        <p>{ENDED[job.status]}</p>
      )}
    </div>
  )
}
