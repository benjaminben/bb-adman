// The spinner of a dialog's busy or waiting line (spec/app-style.md, "Dialogs"): decorative,
// turning in the spot colour; the line's own words say what is happening.
import { Icon } from '@/renderer/ui/icon'
import styles from './dialog-frame.module.css'

export function BusySpinner() {
  return (
    <span className={styles.spin}>
      <Icon name="spinner" />
    </span>
  )
}
