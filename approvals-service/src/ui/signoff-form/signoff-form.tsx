import buttonStyles from '../button/button.module.css'
import styles from './signoff-form.module.css'

type Props = { slug: string; variantKey: string; version: number }

// One form per card, so each field's id carries the card's variant key. The button carries the
// variant and its version as one field, `one` (spec/phases/round-2-approvals.md R2A-3); it has
// the shared button's look until R2A-7 replaces this form.
export function SignoffForm({ slug, variantKey, version }: Props) {
  const id = `email-${variantKey}`
  return (
    <form method="post" action={`/l/${slug}/signoffs`} className={styles.form}>
      <label htmlFor={id} className={styles.label}>
        Your email
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
        <button
          type="submit"
          className={buttonStyles.primary}
          name="one"
          value={`${variantKey}.${version}`}
        >
          Sign off
        </button>
      </div>
    </form>
  )
}
