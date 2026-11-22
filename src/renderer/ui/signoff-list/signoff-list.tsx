// spec/approvals.md "Sign-off list": one line per sign-off, newest first, "{email} · {date and
// time}" only (R-10: older versions are never given). Used by the tile and the dialog. The
// email comes from the service and is drawn as text only.
import type { ApprovalsSignoff } from '@/shared/schemas/queries/approvals'
import { timeText } from './time-text'
import styles from './signoff-list.module.css'

export type SignoffListProps = { label: string; signoffs: ApprovalsSignoff[] }

const lineOf = (signoff: ApprovalsSignoff) => `${signoff.email} · ${timeText(signoff.signedAt)}`

export function SignoffList(props: SignoffListProps) {
  const newest = [...props.signoffs].sort((a, b) => b.signedAt.localeCompare(a.signedAt))
  return (
    <ul className={styles.list} aria-label={props.label}>
      {newest.map((signoff) => (
        <li key={signoff.id} className={styles.line}>
          {lineOf(signoff)}
        </li>
      ))}
    </ul>
  )
}
