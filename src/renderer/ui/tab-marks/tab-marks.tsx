// The marks on a campaign or variant tab (spec/editor.md, "The shell" and "Variant tabs"
// [FR-218, Q-042]; SH-1): the spinner alone while running (tooltip and hidden word "Running"),
// a dot for a result not looked at yet, and on variant tabs a dot for "Needs attention". The
// running and unseen marks share one slot of a fixed size, so a tab keeps its width when a
// run starts (a campaign tab keeps room for the slot: tab-row.module.css).
import { Icon } from '@/renderer/ui/icon'
import styles from './tab-marks.module.css'

export type TabMarksProps = { running: boolean; unseen: boolean; attention?: boolean }

export const anyMark = (m: TabMarksProps) => m.running || m.unseen || (m.attention ?? false)

export function TabMarks(props: TabMarksProps) {
  if (!anyMark(props)) return null
  return (
    <span className={styles.marks}>
      {(props.running || props.unseen) && (
        <span className={styles.slot}>
          {props.running ? (
            <span className={styles.running} title="Running">
              <Icon name="spinner" size="small" />
              <span className={styles.hidden}>Running</span>
            </span>
          ) : (
            <span role="img" aria-label="New result" title="New result" className={styles.dot} />
          )}
        </span>
      )}{' '}
      {props.attention && (
        <span role="img" aria-label="Needs attention" className={styles.attention} />
      )}
    </span>
  )
}
