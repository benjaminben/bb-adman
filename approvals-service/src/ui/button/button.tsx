import type { ReactNode } from 'react'
import styles from './button.module.css'

type Props = { children: ReactNode; look: 'primary' | 'quiet'; label?: string }

// A submit button; `label`, when given, is its accessible name.
export function Button({ children, look, label }: Props) {
  return (
    <button type="submit" className={styles[look]} aria-label={label}>
      {children}
    </button>
  )
}
