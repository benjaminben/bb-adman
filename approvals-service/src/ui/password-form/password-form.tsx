import { Button } from '../button/button'
import styles from './password-form.module.css'

// Posts to the catch-all's enter route; the slug is the page's checked one.
export function PasswordForm({ slug }: { slug: string }) {
  return (
    <form method="post" action={`/l/${slug}/enter`} className={styles.form}>
      <label htmlFor="password" className={styles.label}>
        Password
      </label>
      <input
        id="password"
        className={styles.input}
        type="password"
        name="password"
        autoComplete="current-password"
        required
      />
      <Button look="primary">Open</Button>
    </form>
  )
}
