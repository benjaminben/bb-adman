// The address dialog (spec/screens-campaign.md, "The address dialog"; FR-255): a run command
// refused with comfy_address_needed opens it. It saves the typed address with comfy.setAddress
// and reports back, so the app store sends the run again; Cancel sends nothing more.
import { useRef, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import layout from '@/renderer/ui/layout.module.css'
import styles from './address-dialog.module.css'

const HINT_ID = 'address-dialog-hint'
const REFUSAL_ID = 'address-dialog-refusal'

export function AddressDialog() {
  const request = useApp((s) => s.addressRequest)
  const command = useApp((s) => s.command)
  const [address, setAddress] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  function finish(saved: boolean) {
    setAddress('')
    setRefusal(null)
    request?.resolve(saved)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    const result = await command('comfy.setAddress', { address })
    setSaving(false)
    if (!result.ok) {
      setRefusal(result.error.message)
      return field.current?.focus()
    }
    finish(true)
  }

  const described = refusal === null ? HINT_ID : `${HINT_ID} ${REFUSAL_ID}`

  return (
    <DialogFrame
      open={request !== null}
      onClose={() => finish(false)}
      title="Enter your ComfyUI server's address"
      description={COMFY_PRIVACY}
      closable={!saving}
    >
      <form className={styles.form} onSubmit={(e) => void save(e)}>
        <div className={layout.field}>
          <label htmlFor="address-dialog-field">Server address</label>
          <input
            id="address-dialog-field"
            ref={field}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={address}
            aria-describedby={described}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p id={HINT_ID} className={styles.hint}>
            For example http://127.0.0.1:8188
          </p>
          {refusal !== null && (
            <p
              id={REFUSAL_ID}
              role="alert"
              className={`${layout.notice} ${layout.danger} ${styles.alert}`}
            >
              {refusal}
            </p>
          )}
        </div>
        <DialogFoot>
          <button type="button" disabled={saving} onClick={() => finish(false)}>
            Cancel
          </button>
          <button type="submit" className={layout.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </DialogFoot>
      </form>
    </DialogFrame>
  )
}
