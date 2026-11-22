// A translation row's status and source (CAMP-5). "Missing" (amber, alert icon) and "Approved"
// (green, check icon) are marks; "Proposed" (blue, clock icon) is the button that approves the
// row, named "Proposed: approve", disabled while the field holds an unsaved edit. Each keeps its
// icon and its word, so colour is never alone. The source is a small icon with its words in the
// title and as hidden text.
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { TranslationRow } from '@/shared/schemas/queries/translation'
import { markWords } from './translation-words'
import styles from './translation-panel.module.css'

const APPROVE = 'Proposed: approve'

export function RowMark(props: {
  status: TranslationRow['status']
  disabled: boolean
  onApprove: () => void
}) {
  if (props.status === 'approved')
    return <StatusMark tone="ok" icon="check" label="Approved" tip="Approved" />
  if (props.status !== 'proposed')
    return <StatusMark tone="warn" icon="alert" label="Missing" tip="Missing" />
  return (
    <button
      type="button"
      className={`${layout.quiet} ${layout.small} ${styles.proposed}`}
      title={APPROVE}
      aria-label={APPROVE}
      disabled={props.disabled}
      onClick={props.onApprove}
    >
      <span className={styles.markIcon}>
        <Icon name="clock" />
      </span>
      <span className={styles.markWord}>Proposed</span>
    </button>
  )
}

const SOURCE_ICONS: Record<NonNullable<TranslationRow['source']>, IconName> = {
  ai: 'sparkle',
  agent: 'bot',
  user: 'pencil',
  brief: 'book',
}

export function SourceIcon(props: { source: TranslationRow['source'] }) {
  const { from } = markWords(null, props.source)
  if (props.source === null || from === null) return <span className={styles.from} />
  return (
    <span className={styles.from} title={from}>
      <Icon name={SOURCE_ICONS[props.source]} />
      <span className={styles.hidden}>{from}</span>
    </span>
  )
}
