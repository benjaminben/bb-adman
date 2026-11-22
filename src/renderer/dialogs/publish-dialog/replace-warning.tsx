// What is already published for the campaign in the chosen storage (DLG-6b; spec/phases/
// phase-09.md "Screens"; FR-241). Nothing there: a "First publish" mark. Files there: a warn
// notice "Replaces publish {n} · {date}" with the switch "Replace" (named "Replace the
// published files"), never on to start: only the user's own switch lets Publish replace them.
// The other replace sentences are in the notice's InfoTip; "From another project" stays a
// visible mark on the notice. It is information; it never stands in for the switch.
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { dateText } from '@/renderer/ui/signoff-list/time-text'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import styles from './publish-dialog.module.css'

export type ReplaceWarningProps = {
  existing: NonNullable<PublishInspect['existing']>
  confirmed: boolean
  disabled: boolean
  onConfirm: (confirmed: boolean) => void
}

const OTHER_PROJECT = 'These files were published from another project with the same campaign ID.'

function noticeText(existing: ReplaceWarningProps['existing']): string {
  const { publishNumber, publishedAt } = existing
  if (publishNumber === null || publishedAt === null) return 'Replaces the published files'
  return `Replaces publish ${publishNumber} · ${dateText(publishedAt)}`
}

export function ReplaceWarning(props: ReplaceWarningProps) {
  const { existing } = props
  if (existing.files === 0) {
    return (
      <p className={styles.first}>
        <StatusMark
          tone="info"
          icon="info"
          label="First publish"
          tip="Nothing is published for this campaign yet."
        />
      </p>
    )
  }
  return (
    <div className={`${layout.notice} ${layout.warn} ${styles.replace}`}>
      <span className={styles.replaceText}>{noticeText(existing)}</span>
      <InfoTip about="replacing">
        This will replace the files published for this campaign. Someone may be reviewing the files
        that will be replaced.
      </InfoTip>
      {existing.otherProject && (
        <StatusMark tone="warn" icon="alert" label="From another project" tip={OTHER_PROJECT} />
      )}
      <label className={styles.switchLabel}>
        <input
          type="checkbox"
          role="switch"
          className={layout.switch}
          aria-label="Replace the published files"
          checked={props.confirmed}
          disabled={props.disabled}
          onChange={(e) => props.onConfirm(e.target.checked)}
        />
        <span aria-hidden="true">Replace</span>
      </label>
    </div>
  )
}
