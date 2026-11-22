// The sign-offs of every variant, by variant title (spec/approvals.md "The approval link
// dialog", "Sign-off list"; DLG-6b): one ObjectRow per sign-off, newest first, with the email
// as its name and the time as its meta (R-10: older versions are never given). The email comes
// from the service and is drawn as text only, here and nowhere else in the dialog. A variant
// with no sign-offs is left out.
import type { ApprovalsSignoff, ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { timeText } from '@/renderer/ui/signoff-list'
import styles from './approval-dialog.module.css'

type Props = { variants: ApprovalsVariant[]; titles: Record<string, string> }

// The rows hold no action; the main button only covers them.
const COVER = { tabIndex: -1, 'aria-hidden': true } as const

function SignoffRows(props: { label: string; signoffs: ApprovalsSignoff[] }) {
  const newest = [...props.signoffs].sort((a, b) => b.signedAt.localeCompare(a.signedAt))
  return (
    <ul aria-label={props.label} className={layout.list}>
      {newest.map((signoff) => (
        <li key={signoff.id}>
          <ObjectRow
            name={signoff.email}
            label={signoff.email}
            meta={timeText(signoff.signedAt)}
            thumb={<Icon name="check" />}
            mainProps={COVER}
          />
        </li>
      ))}
    </ul>
  )
}

export function SignoffsByVariant(props: Props) {
  const signed = props.variants.filter((v) => v.signoffs.length > 0)
  return (
    <section className={styles.section} aria-label="Sign-offs">
      <h3 className={styles.heading}>Sign-offs</h3>
      {signed.length === 0 && <p className={layout.muted}>No sign-offs yet.</p>}
      {signed.map((variant) => {
        const title = props.titles[variant.variantId] ?? 'A variant'
        return (
          <div key={variant.variantId}>
            <p className={layout.label}>{title}</p>
            <SignoffRows label={`Sign-offs for ${title}`} signoffs={variant.signoffs} />
          </div>
        )
      })}
    </section>
  )
}
