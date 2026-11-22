// The Checks tab's header row (CAMP-4): "Run checks" (a spinner inside while it runs, disabled,
// and "Checking…" as hidden status), the summary marks "{n} warnings" (opens the first warned
// row) and "{n} not checked" (runs checks), each only when its count is above 0, and the
// InfoTip "About Checks" with one line per check.
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import { ABOUT, CHECKS } from './check-words'
import styles from './check-panel.module.css'

export function CheckHead(props: {
  running: boolean
  warnings: number
  firstFinding: string | undefined
  stale: number
  onRun: () => void
  onShowWarned: () => void
}) {
  const warned = plural(props.warnings, 'warning')
  const staleWords = plural(props.stale, 'not checked', 'not checked')
  return (
    <div className={styles.head}>
      <button
        type="button"
        className={`${layout.primary} ${styles.run}`}
        disabled={props.running}
        onClick={props.onRun}
      >
        {props.running && <BusySpinner />}
        Run checks
      </button>
      <span role="status" className={styles.hidden}>
        {props.running ? 'Checking…' : ''}
      </span>
      {props.warnings > 0 && (
        <StatusMark
          tone="warn"
          icon="alert"
          label={warned}
          tip={props.firstFinding === undefined ? warned : `${warned}. ${props.firstFinding}`}
          onClick={props.onShowWarned}
        />
      )}
      {props.stale > 0 && (
        <StatusMark
          tone="none"
          icon="clock"
          label={staleWords}
          tip={`${staleWords}: changed since the last check. Check again`}
          onClick={props.onRun}
        />
      )}
      <InfoTip about="Checks">
        {CHECKS.map((id) => (
          <span key={id} className={styles.line}>
            {ABOUT[id]}
          </span>
        ))}
      </InfoTip>
    </div>
  )
}
