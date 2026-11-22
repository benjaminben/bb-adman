// A status shown as a dot or an icon plus at most two words (T3b, spec/app-style-parts.md
// "StatusMark"). The caller passes every word: the standard marks' labels and tips are in that
// file's table. Colour is never alone: a label, an icon, or (for a bare dot) the tip as hidden
// text. Not clickable, it is a span with the tip in `title`; with `onClick`, a quiet button
// named by the tip, which begins with the visible words.
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './status-mark.module.css'

export type StatusTone = 'none' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'running'

export type StatusMarkProps = {
  tone: StatusTone
  label?: string
  tip: string
  icon?: IconName
  onClick?: () => void
}

function Mark(props: StatusMarkProps) {
  const icon = props.tone === 'running' ? 'spinner' : props.icon
  return (
    <>
      {icon === undefined ? (
        <span className={styles.dot} />
      ) : (
        <span className={styles.icon}>
          <Icon name={icon} />
        </span>
      )}
      {props.label !== undefined && <span className={styles.label}>{props.label}</span>}
    </>
  )
}

export function StatusMark(props: StatusMarkProps) {
  const look = `${styles.mark} ${styles[props.tone]}`
  if (props.onClick !== undefined) {
    return (
      <button
        type="button"
        className={`${layout.quiet} ${layout.small} ${look} ${styles.button}`}
        title={props.tip}
        aria-label={props.tip}
        onClick={props.onClick}
      >
        <Mark {...props} />
      </button>
    )
  }
  const spoken = props.tip !== props.label
  return (
    <span className={look} title={props.tip}>
      <Mark {...props} />
      {spoken && <span className={styles.hidden}>{props.tip}</span>}
    </span>
  )
}
