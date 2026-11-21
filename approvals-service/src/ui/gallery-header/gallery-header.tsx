import { Button } from '../button/button'
import styles from './gallery-header.module.css'

type Props = { slug: string; campaignName: string }

export function GalleryHeader({ slug, campaignName }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.words}>
        <h1 className={styles.heading}>{campaignName}</h1>
        <p className={styles.text}>
          Sign off on a variant by entering your email address. Anyone with this link can see who
          signed off, and can remove a sign-off.
        </p>
      </div>
      <form method="post" action={`/l/${slug}/leave`}>
        <Button look="quiet">Leave</Button>
      </form>
    </header>
  )
}
