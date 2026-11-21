// The marks on a campaign or variant tab (spec/editor.md, "The shell" and "Variant tabs"
// [FR-218, Q-042]): "Running" as a word, a dot for a result not looked at yet, and on variant
// tabs a dot for "Needs attention". Each dot has a text label for screen readers.
import styles from './tab-marks.module.css'

export type TabMarksProps = { running: boolean; unseen: boolean; attention?: boolean }

export const anyMark = (m: TabMarksProps) => m.running || m.unseen || (m.attention ?? false)

export function TabMarks(props: TabMarksProps) {
  if (!anyMark(props)) return null
  return (
    <span className={styles.marks}>
      {props.running && <span className={styles.running}>Running</span>}
      {!props.running && props.unseen && (
        <span role="img" aria-label="New result" className={styles.dot} />
      )}{' '}
      {props.attention && (
        <span role="img" aria-label="Needs attention" className={styles.attention} />
      )}
    </span>
  )
}
