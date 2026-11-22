// JobProgress (DLG-1; spec/app-style-parts.md, "Dialog"): a long job's progress bar and its one
// button, "Run in background" where the job can go on alone or "Stop" where it cannot. It only
// draws: the button calls the function it is given, and a failure is never shown here (that is
// DialogAlert's job). With no known value the bar moves, and stands still under reduce motion.
import layout from '@/renderer/ui/layout.module.css'
import styles from './job-progress.module.css'

export type JobProgressAction = {
  // "Run in background" or "Stop"; a caller may pass its own words for Stop ("Stop publishing").
  label: 'Run in background' | 'Stop' | (string & {})
  onClick(): void
  disabled?: boolean
}

export type JobProgressProps = {
  label: string
  // 0 to 1, or null when the job cannot say how far it is.
  value: number | null
  // When given, a screen reader reads "{done} of {total}" in place of the percent.
  count?: { done: number; total: number }
  action?: JobProgressAction
}

export function JobProgress(props: JobProgressProps) {
  const { label, value, count, action } = props
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100)
  const text = count ? `${count.done} of ${count.total}` : `${percent}%`
  return (
    <div className={styles.job}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? undefined : text}
        className={`${layout.progress} ${styles.bar}`}
      >
        {percent === null ? (
          <span className={styles.moving} />
        ) : (
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        )}
      </div>
      {action && (
        <button
          type="button"
          className={layout.secondary}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
