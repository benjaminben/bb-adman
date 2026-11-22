import { NOTICES, type NoticeKey } from '../../visitor/notices'
import styles from './reviewer-form.module.css'

type Props = { slug: string; reviewer: string | null; stamp: string; notice: NoticeKey | null }

// spec/phases/round-2-approvals.md "The sidebar" 3: the email every sign-off on the page uses.
// Every sign-off button names this form, and "Use this email" is its first submit button, so
// Enter in the field saves the email and never signs anything. The slug is the page's checked
// one; the email is only ever a field value, which React escapes.
export function ReviewerForm({ slug, reviewer, stamp, notice }: Props) {
  const bad = notice === 'bad-email'
  return (
    <form id="reviewer" method="post" action={`/l/${slug}/reviewer`} className={styles.form}>
      <label htmlFor="reviewer-email" className={styles.label}>
        Signing off as:
      </label>
      <input
        id="reviewer-email"
        className={styles.input}
        type="email"
        name="email"
        autoComplete="email"
        required
        defaultValue={reviewer ?? ''}
        aria-invalid={bad ? true : undefined}
        aria-describedby={bad ? 'reviewer-hint reviewer-error' : 'reviewer-hint'}
      />
      <p id="reviewer-hint" className={styles.hint}>
        Used for every sign-off on this page. Kept until you log out or close the browser.
      </p>
      {bad ? (
        <p id="reviewer-error" role="alert" className={styles.error}>
          {NOTICES['bad-email'].text}
        </p>
      ) : null}
      {notice === 'email-saved' ? (
        <p role="status" className={styles.ok}>
          {NOTICES['email-saved'].text}
        </p>
      ) : null}
      <input type="hidden" name="seen" value={stamp} />
      <button type="submit" className={styles.use}>
        Use this email
      </button>
    </form>
  )
}
