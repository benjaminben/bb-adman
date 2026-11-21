// The licence dialog's box and buttons. The box is left out when the model is unknown, since
// "This model" is not a name the main process could match. Mounted afresh at each open.
import { useState } from 'react'
import styles from './licence-dialog.module.css'

export type LicenceChoicesProps = {
  model: string | null
  saving: boolean
  onCancel: () => void
  onConfirm: (remember: string | null) => void
}

export function LicenceChoices(props: LicenceChoicesProps) {
  const [ticked, setTicked] = useState(false)
  const { model } = props

  return (
    <div className={styles.body}>
      {model !== null && (
        <label className={styles.box}>
          <input
            type="checkbox"
            checked={ticked}
            disabled={props.saving}
            onChange={(e) => setTicked(e.target.checked)}
          />
          don&apos;t show again for {model}
        </label>
      )}
      <div className={styles.actions}>
        <button type="button" disabled={props.saving} onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={props.saving}
          onClick={() => props.onConfirm(ticked ? model : null)}
        >
          {props.saving ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
