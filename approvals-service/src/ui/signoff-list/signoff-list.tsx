import { Button } from '../button/button'
import { formatDate } from '../format-date'
import type { Signoff } from '../group-signoffs'
import styles from './signoff-list.module.css'

type Props = {
  slug: string
  heading: string
  signoffs: Signoff[]
  muted: boolean
  emptyText?: string
}

// Each sign-off as `{email} · {date}` with its Remove form.
export function SignoffList({ slug, heading, signoffs, muted, emptyText }: Props) {
  return (
    <section className={muted ? styles.muted : styles.list}>
      <h3 className={styles.heading}>{heading}</h3>
      {signoffs.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.items}>
          {signoffs.map((signoff) => (
            <li key={signoff.id} className={styles.item}>
              <span className={styles.who}>
                {signoff.email} · {formatDate(signoff.createdAt)}
              </span>
              <form method="post" action={`/l/${slug}/signoffs/${signoff.id}/remove`}>
                <Button look="quiet" label={`Remove sign-off by ${signoff.email}`}>
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
