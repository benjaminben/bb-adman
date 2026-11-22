// MoneyLine (spec/app-style-parts.md, "Dialog", T4; choice C-15): the one way to show a cost.
// Security part: it draws exactly the words it is given, as React text (never as HTML), sends
// nothing and decides nothing. Its `id` goes in the dialog's `describedBy`, so the cost is read
// when the dialog opens. In the arrow form ("Paid: 4 pictures → {Provider}") the arrow is the
// `right` icon, hidden, followed by a visually hidden "to".
import type { ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import styles from './money-line.module.css'

export type MoneyLineProps = { id: string; children: ReactNode }

const ARROW = ' → '

function Words(props: { children: ReactNode }) {
  const words = props.children
  if (typeof words !== 'string' || !words.includes(ARROW)) return <>{words}</>
  const at = words.indexOf(ARROW)
  return (
    <>
      {words.slice(0, at)} <Icon name="right" size="small" />
      <span className={styles.hidden}>to</span> {words.slice(at + ARROW.length)}
    </>
  )
}

export function MoneyLine(props: MoneyLineProps) {
  return (
    <p id={props.id} className={styles.line}>
      <Icon name="coin" size="small" />
      <span className={styles.words}>
        <Words>{props.children}</Words>
      </span>
    </p>
  )
}
