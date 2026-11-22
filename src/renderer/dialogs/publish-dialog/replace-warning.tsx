// What is already published for the campaign in the chosen storage (spec/phases/phase-09.md
// "Screens"; FR-241). With files there, the replace lines and "Replace the published files",
// never ticked to start: only the user's own tick lets Publish replace them. "Published from
// another project" is information; it never stands in for the tick.
import { dateText } from '@/renderer/ui/signoff-list/time-text'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import styles from './publish-dialog.module.css'

export type ReplaceWarningProps = {
  existing: NonNullable<PublishInspect['existing']>
  confirmed: boolean
  disabled: boolean
  onConfirm: (confirmed: boolean) => void
}

export function ReplaceWarning(props: ReplaceWarningProps) {
  const { existing } = props
  if (existing.files === 0) {
    return <p className={styles.line}>Nothing is published for this campaign yet.</p>
  }
  const { publishNumber, publishedAt } = existing
  return (
    <div className={styles.replace}>
      <p className={styles.strong}>This will replace the files published for this campaign.</p>
      <p className={styles.line}>Someone may be reviewing the files that will be replaced.</p>
      {existing.otherProject && (
        <p className={styles.line}>
          These files were published from another project with the same campaign ID.
        </p>
      )}
      {publishNumber !== null && publishedAt !== null && (
        <p className={styles.line}>
          Last published {dateText(publishedAt)}, publish {publishNumber}.
        </p>
      )}
      <label className={styles.choice}>
        <input
          type="checkbox"
          checked={props.confirmed}
          disabled={props.disabled}
          onChange={(e) => props.onConfirm(e.target.checked)}
        />
        Replace the published files
      </label>
    </div>
  )
}
