import { NOTICES, type NoticeKey } from '../../visitor/notices'
import { Notice } from '../notice/notice'
import { PageShell } from '../page-shell/page-shell'
import { PasswordForm } from '../password-form/password-form'
import styles from './password-screen.module.css'

// No campaign name here: the visitor has proven nothing yet.
export function PasswordScreen({ slug, notice }: { slug: string; notice: NoticeKey | null }) {
  return (
    <PageShell>
      <title>Review campaign</title>
      <section className={styles.card}>
        <h1 className={styles.heading}>Review campaign</h1>
        <p className={styles.text}>Enter the password you were given.</p>
        {notice === null ? null : <Notice tone="error">{NOTICES[notice].text}</Notice>}
        <PasswordForm slug={slug} />
      </section>
    </PageShell>
  )
}
