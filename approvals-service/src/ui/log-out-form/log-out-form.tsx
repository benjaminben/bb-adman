import styles from './log-out-form.module.css'

// spec/phases/round-2-approvals.md "The sidebar" 5: ends the session and clears both cookies.
// The route path stays `/leave`; the slug is the page's checked one.
export function LogOutForm({ slug }: { slug: string }) {
  return (
    <form method="post" action={`/l/${slug}/leave`}>
      <button type="submit" className={styles.quiet}>
        Log out
      </button>
    </form>
  )
}
