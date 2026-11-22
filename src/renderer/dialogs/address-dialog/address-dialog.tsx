// The address dialog (spec/screens-campaign.md, "The address dialog"; FR-255): a run command
// refused with comfy_address_needed opens it. It saves the typed address with comfy.setAddress
// and reports back, so the app store sends the run again; Cancel sends nothing more.
// DLG-3a: a `form` DialogFrame. The privacy paragraph stays on the page, word for word, as the
// body's line above the buttons, and is the dialog's accessible description. A refusal is a
// danger DialogAlert under the field, which also describes the field.
import { useRef, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import layout from '@/renderer/ui/layout.module.css'
import styles from './address-dialog.module.css'

const PRIVACY_ID = 'address-dialog-privacy'
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

  return (
    <DialogFrame
      open={request !== null}
      onClose={() => finish(false)}
      title="ComfyUI address"
      kind="form"
      describedBy={PRIVACY_ID}
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
            placeholder="http://127.0.0.1:8188"
            value={address}
            aria-describedby={refusal === null ? undefined : REFUSAL_ID}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        {refusal !== null && (
          <div id={REFUSAL_ID}>
            <DialogAlert tone="danger">{refusal}</DialogAlert>
          </div>
        )}
        <p id={PRIVACY_ID} className={styles.privacy}>
          {COMFY_PRIVACY}
        </p>
        <DialogFoot>
          <button
            type="button"
            className={layout.quiet}
            disabled={saving}
            onClick={() => finish(false)}
          >
            Cancel
          </button>
          <button type="submit" className={layout.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFoot>
      </form>
    </DialogFrame>
  )
}
