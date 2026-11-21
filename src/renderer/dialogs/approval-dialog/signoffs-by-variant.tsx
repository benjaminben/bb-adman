// The sign-off list of every variant, by variant title (spec/approvals.md "The approval link
// dialog"). A variant with no sign-offs is left out.
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { SignoffList } from '@/renderer/ui/signoff-list'
import layout from '@/renderer/ui/layout.module.css'
import styles from './approval-dialog.module.css'

type Props = { variants: ApprovalsVariant[]; titles: Record<string, string> }

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
            <SignoffList label={`Sign-offs for ${title}`} signoffs={variant.signoffs} />
          </div>
        )
      })}
    </section>
  )
}
