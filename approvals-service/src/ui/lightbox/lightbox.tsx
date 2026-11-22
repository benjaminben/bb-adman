import type { Signoff, Variant } from '../../visitor/actions'
import { formatDate } from '../format-date'
import { LightboxMedia } from '../lightbox-media/lightbox-media'
import { TickMark } from '../signoff-tick/signoff-tick'
import styles from './lightbox.module.css'

type Props = { slug: string; variant: Variant; signoffs: Signoff[]; reviewer: string | null }

// HTML's command buttons; React passes these lowercase names through as written. A spread,
// since React's types do not list them yet.
const closes = (id: string) => ({ commandfor: id, command: 'close' })

// The variant's sign-offs of its current version, oldest first, whatever the caller passes.
const currentOf = (signoffs: Signoff[], { variantKey, version }: Variant) =>
  signoffs
    .filter((s) => s.variantKey === variantKey && s.version === version)
    .sort((a, b) => a.createdAt - b.createdAt)

// spec/phases/round-2-approvals.md "The lightbox (item 22)": one per card, inside its article
// and outside every form. The sign-off button sends the reviewer form; `formnovalidate` lets an
// empty email reach the server's `bad-email` notice, since the field behind the dialog is inert.
export function Lightbox({ slug, variant, signoffs, reviewer }: Props) {
  const { variantKey, version, title } = variant
  const id = `view-${variantKey}`
  const current = currentOf(signoffs, variant)
  const mine = reviewer !== null && current.some((s) => s.email === reviewer)
  return (
    <dialog
      id={id}
      className={styles.lightbox}
      aria-labelledby={`lt-${variantKey}`}
      data-lightbox=""
    >
      <div className={styles.frame}>
        <div className={styles.top}>
          <div className={styles.words}>
            <h2 id={`lt-${variantKey}`} className={styles.title}>
              {title}
            </h2>
            <p className={styles.size}>{variant.sizeLine}</p>
          </div>
          <button type="button" className={styles.quiet} {...closes(id)}>
            Close
          </button>
        </div>
        <LightboxMedia slug={slug} variant={variant} />
        {mine ? (
          <p className={styles.mine}>
            <TickMark /> Signed off by you.
          </p>
        ) : variant.expired ? null : (
          <div className={styles.sign}>
            <button
              type="submit"
              form="reviewer"
              name="one"
              value={`${variantKey}.${version}`}
              formNoValidate
              aria-label={`Sign off: ${title}`}
              className={styles.primary}
            >
              Sign off
            </button>
            <p className={styles.muted}>
              {reviewer === null
                ? 'Uses the email under “Signing off as:”.'
                : `Signing off as ${reviewer}.`}
            </p>
          </div>
        )}
        <section className={styles.signoffs}>
          <h3 className={styles.heading}>Signed off by</h3>
          {current.length === 0 ? (
            <p className={styles.muted}>No sign-offs yet.</p>
          ) : (
            <ul className={styles.rows}>
              {current.map((signoff) => (
                <li key={signoff.id} className={styles.row}>
                  <span className={styles.who}>
                    {signoff.email} · {formatDate(signoff.createdAt)}
                  </span>
                  <form method="post" action={`/l/${slug}/signoffs/${signoff.id}/remove`}>
                    <button
                      type="submit"
                      className={styles.remove}
                      aria-label={`Remove sign-off by ${signoff.email}`}
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={styles.steps}>
          <button type="button" className={styles.quiet} data-step="-1" hidden>
            Previous
          </button>
          <button type="button" className={styles.quiet} data-step="1" hidden>
            Next
          </button>
        </div>
      </div>
    </dialog>
  )
}
