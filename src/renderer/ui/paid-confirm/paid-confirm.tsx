// The two-step line for a paid provider (choice C-15, spec/screens.md "Rules for every
// screen"), used from places not opened to pay: the sync review's Translate and the activity
// row's video Retry. The first click (the caller's) shows this line; only its Confirm sends.
// DLG-4a: the cost is a MoneyLine directly left of Confirm and Cancel, and Confirm is
// described by it, so the words are read at the click.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { MoneyLine } from '@/renderer/ui/money-line'
import { plural } from '@/renderer/ui/plural'
import styles from './paid-confirm.module.css'

export function paidLine(count: number | null, providerLabel: string, references = 0): string {
  // A run whose stored request cannot be read gives no number rather than a guessed one.
  const what = count === null ? 'requests' : plural(count, 'request')
  // SPEC 14 1.46 TP-5: with at least one reference picture the line names how many.
  const pictures = references > 0 ? ` + ${plural(references, 'reference')}` : ''
  return `Paid: ${what}${pictures} → ${providerLabel}`
}

export function PaidConfirm(props: {
  count: number | null
  providerLabel: string
  references?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const costId = useId()
  return (
    <div className={styles.line}>
      <MoneyLine id={costId}>
        {paidLine(props.count, props.providerLabel, props.references)}
      </MoneyLine>
      <button
        type="button"
        className={layout.primary}
        aria-describedby={costId}
        onClick={props.onConfirm}
      >
        Confirm
      </button>
      <button type="button" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  )
}
