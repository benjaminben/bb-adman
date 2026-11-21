// One group of the rule set panel, named by its small heading, and the line under a list that
// shows why a change was not made.
import { useId, type ReactNode } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import styles from './rule-set-panel.module.css'

export function RuleGroup(props: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className={styles.group}>
      <h3 id={id} className={styles.title}>
        {props.title}
      </h3>
      {props.children}
    </div>
  )
}

export function Refusal(props: { message: string | undefined }) {
  if (props.message === undefined) return null
  return (
    <p role="alert" className={`${layout.notice} ${layout.danger}`}>
      {props.message}
    </p>
  )
}
