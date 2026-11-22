import type { ReactNode } from 'react'
import styles from './page-shell.module.css'

type Props = { children: ReactNode; side?: ReactNode }

// The page's <main>, centred and at most --width-wide wide. With `side` (the gallery's sidebar),
// two columns on a wide window: the side first in the page's order, then the main column.
export function PageShell({ children, side }: Props) {
  if (side === undefined) return <main className={styles.shell}>{children}</main>
  return (
    <div className={styles.frame}>
      {side}
      <main className={styles.column}>{children}</main>
    </div>
  )
}
