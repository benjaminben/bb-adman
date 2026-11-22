// D10: the app mark, the same drawing as the app icon. It sits beside the name, so it is
// hidden from screen readers (alt="", aria-hidden), as the start screen's pictures are.
import markUrl from './app-mark.svg'
import styles from './app-mark.module.css'

export function AppMark() {
  return <img className={styles.mark} src={markUrl} alt="" aria-hidden="true" />
}
