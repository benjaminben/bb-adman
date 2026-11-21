// The confirm step for a paid provider (SPEC 14 1.41, "A paid run starts only on the user's
// own confirm"): one line with Confirm and Cancel. Nothing is sent before Confirm.
import styles from '@/renderer/screens/screens.module.css'

export function paidLine(count: number | null, providerLabel: string, references = 0): string {
  // A run whose stored request cannot be read gives no number rather than a guessed one.
  const what = count === null ? 'paid request(s)' : `${count} paid request(s)`
  // SPEC 14 1.46 TP-5: with at least one reference picture the line names how many.
  const pictures = references > 0 ? ` and ${references} reference picture(s)` : ''
  return `This sends ${what}${pictures} to ${providerLabel}.`
}

export function PaidConfirm(props: {
  count: number | null
  providerLabel: string
  references?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className={styles.row}>
      <span>{paidLine(props.count, props.providerLabel, props.references)}</span>
      <button type="button" className={styles.primary} onClick={props.onConfirm}>
        Confirm
      </button>
      <button type="button" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  )
}
