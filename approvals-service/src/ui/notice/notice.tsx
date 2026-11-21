import type { ReactNode } from 'react'
import styles from './notice.module.css'

export type Tone = 'info' | 'error'

// A status box: read out politely (info) or at once (error).
export function Notice({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={styles[tone]}>
      {children}
    </div>
  )
}
