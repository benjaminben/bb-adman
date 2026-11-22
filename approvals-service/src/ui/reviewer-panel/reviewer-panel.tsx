import type { NoticeKey } from '../../visitor/notices'
import { LogOutForm } from '../log-out-form/log-out-form'
import { ReviewerForm } from '../reviewer-form/reviewer-form'
import { SignoffAll } from '../signoff-all/signoff-all'
import styles from './reviewer-panel.module.css'

type Props = {
  slug: string
  campaignName: string
  reviewer: string | null
  stamp: string
  notice: NoticeKey | null
  // Live variants this reviewer has not signed, and live variants in all.
  left: number
  live: number
  // Live video variants with a clip, for the "Sign off all" confirmation.
  videos: number
}

// spec/phases/round-2-approvals.md "The sidebar (item 20)": first in the page's order, so the
// email field and its default button come before every card.
export function ReviewerPanel(props: Props) {
  const { slug, campaignName, reviewer, stamp, notice, left, live, videos } = props
  return (
    <aside aria-label="Review" className={styles.panel}>
      <h1 className={styles.title}>{campaignName}</h1>
      <p className={styles.instructions}>
        Look at each variant and sign off on the ones you approve. Your email is saved with each
        sign-off. Anyone with this link can see who signed off, and can remove a sign-off.
      </p>
      <ReviewerForm slug={slug} reviewer={reviewer} stamp={stamp} notice={notice} />
      <SignoffAll slug={slug} reviewer={reviewer} left={left} live={live} videos={videos} />
      <LogOutForm slug={slug} />
    </aside>
  )
}
