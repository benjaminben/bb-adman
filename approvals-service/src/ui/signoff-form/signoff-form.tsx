import { Button } from '../button/button'
import styles from './signoff-form.module.css'

type Props = { slug: string; variantKey: string; version: number }

// One form per card, so each field's id carries the card's variant key.
export function SignoffForm({ slug, variantKey, version }: Props) {
  const id = `email-${variantKey}`
  return (
    <form method="post" action={`/l/${slug}/signoffs`} className={styles.form}>
      <input type="hidden" name="variant" value={variantKey} />
      <input type="hidden" name="version" value={version} />
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
        <Button look="primary">Sign off</Button>
      </div>
    </form>
  )
}
