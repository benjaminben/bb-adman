// The export job's state in the dialog (DLG-6a): while it runs a bar "Exporting" with the
// percent as its value; when done an `ok` mark "{n} exported" and, when any failed, a danger
// mark "{n} failed"; a failed or cancelled job keeps its sentence as visible words.
import { JobProgress } from '@/renderer/ui/job-progress'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { ExportStep } from './use-export-job'
import styles from './export-dialog.module.css'

const ENDED = { failed: 'The export failed.', cancelled: 'The export was cancelled.' }

export function ExportEnd(props: { step: ExportStep }) {
  const { step } = props
  if (step.kind === 'running') return <JobProgress label="Exporting" value={step.percent / 100} />
  if (step.kind === 'done') {
    return (
      <p role="status" className={styles.done}>
        <StatusMark
          tone="ok"
          icon="check"
          label={`${step.exported} exported`}
          tip={`${plural(step.exported, 'ad')} exported`}
        />
        {step.failed > 0 && (
          <StatusMark
            tone="danger"
            icon="alert"
            label={`${step.failed} failed`}
            tip={`${plural(step.failed, 'ad')} failed`}
          />
        )}
      </p>
    )
  }
  if (step.kind !== 'ended') return null
  return (
    <p role="status" className={styles.line}>
      {ENDED[step.status]}
    </p>
  )
}
