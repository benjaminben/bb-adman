// The "Saved" mark after a single-value field (SET-6, choice C-4): StatusMark ok, check. The
// status region is always there so a screen reader hears "Saved" when it appears. Given the
// field as children, it holds the field and the mark on one line.
import type { ReactNode } from 'react'
import { StatusMark } from '@/renderer/ui/status-mark'
import styles from './saved-mark.module.css'

export function SavedMark(props: { shown: boolean; children?: ReactNode }) {
  const mark = (
    <span role="status">
      {props.shown && <StatusMark tone="ok" icon="check" label="Saved" tip="Saved" />}
    </span>
  )
  if (props.children === undefined) return mark
  return (
    <span className={styles.withMark}>
      {props.children}
      {mark}
    </span>
  )
}
