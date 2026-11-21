// The approvals service address: Save and Remove send approvals.setService (spec/approvals.md
// "Screens", Settings). A refused address shows the command's sentence under the field and
// keeps the typed text; the main process judges the address, not this form.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'

const REFUSAL_ID = 'approvals-address-refusal'

export function AddressForm(props: { saved: string | null; onSaved: () => void }) {
  const command = useApp((s) => s.command)
  const [typed, setTyped] = useState(props.saved ?? '')
  const [refusal, setRefusal] = useState<string | null>(null)

  async function setService(address: string | null) {
    const result = await command('approvals.setService', { address })
    if (!result.ok) return setRefusal(result.error.message)
    setRefusal(null)
    props.onSaved()
  }

  function save(event: FormEvent) {
    event.preventDefault()
    void setService(typed)
  }

  return (
    <form className={layout.field} onSubmit={save}>
      <label htmlFor="approvals-address">Service address</label>
      <div className={layout.row}>
        <input
          id="approvals-address"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-describedby={refusal === null ? undefined : REFUSAL_ID}
        />
        <button type="submit" className={layout.primary}>
          Save
        </button>
        {props.saved !== null && (
          <button type="button" onClick={() => void setService(null)}>
            Remove
          </button>
        )}
      </div>
      {refusal !== null && <p id={REFUSAL_ID}>{refusal}</p>}
    </form>
  )
}
