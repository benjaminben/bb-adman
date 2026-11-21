import type { ReactNode } from 'react'
import styles from './page-shell.module.css'

// The page's <main>, centred and at most --page-max wide.
export function PageShell({ children }: { children: ReactNode }) {
  return <main className={styles.shell}>{children}</main>
}
