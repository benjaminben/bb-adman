import type { ReactNode } from 'react'
import styles from './gallery-grid.module.css'

// As many columns as fit, so it holds one variant or hundreds.
export function GalleryGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>
}
