// The still-only lines under "Gallery" (round-2-approvals-video.md "The still-only note"): one
// per variant the gallery shows as a still picture, by title, with its reason.
import type { ApprovalsStillOnly, ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import styles from './approval-dialog.module.css'

const REASONS: Record<ApprovalsStillOnly, string> = {
  no_tool: 'This copy of Adman cannot make videos, because FFmpeg is missing.',
  too_long: 'Videos longer than 3 minutes are not sent.',
  too_large: 'Its video is larger than 384 MB.',
}

export function StillOnlyNotes(props: {
  variants: ApprovalsVariant[]
  titles: Record<string, string>
}) {
  return props.variants.map((v) =>
    v.stillOnly ? (
      <p key={v.variantId} className={styles.line}>
        {`${props.titles[v.variantId] ?? ''}: sent as a still picture. ${REASONS[v.stillOnly]}`}
      </p>
    ) : null,
  )
}
