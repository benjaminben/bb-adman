// The confirm step for a paid provider (SPEC 14 1.41, "A paid run starts only on the user's
// own confirm"): one line with Confirm and Cancel. Nothing is sent before Confirm.
import styles from '../screens.module.css'

export function paidLine(count: number | null, providerLabel: string): string {
  // A run whose stored request cannot be read gives no number rather than a guessed one.
  const what = count === null ? 'paid request(s)' : `${count} paid request(s)`
  return `This sends ${what} to ${providerLabel}.`
}

export function PaidConfirm(props: {
  count: number | null
  providerLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className={styles.row}>
      <span>{paidLine(props.count, props.providerLabel)}</span>
      <button type="button" className={styles.primary} onClick={props.onConfirm}>
        Confirm
      </button>
      <button type="button" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  )
}
