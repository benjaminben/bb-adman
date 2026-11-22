// The key dialog of the NEEDS_KEY flow (FR-171): it opens when an action needs a key,
// saves it with secret.set, and reports back so the action can retry. Keys are not
// tested when entered (FR-172). DLG-3a: a `form` DialogFrame; the help sentence sits in an
// InfoTip beside the first field. Fields are password fields and start empty: a saved key is
// never read back. Cancel, Escape and a click outside send nothing. The fields are uncontrolled,
// so a typed key never becomes a `value` attribute; it is read from the form on Save.
import { useState, type FormEvent } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { secretLabel } from '@/renderer/ui/secret-labels'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './key-dialog.module.css'

const KEY_HELP =
  'The key is stored encrypted on this computer and is used only for actions you start.'

export function KeyDialog() {
  const api = useApi()
  const request = useApp((s) => s.keyRequest)
  const refresh = useApp((s) => s.refresh)
  const [error, setError] = useState<string | null>(null)

  function finish(saved: boolean) {
    setError(null)
    request?.resolve(saved)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!request) return
    const form = new FormData(event.currentTarget)
    for (const name of request.provider.secrets) {
      const value = form.get(name)
      const result = await api.command('secret.set', {
        name,
        value: typeof value === 'string' ? value : '',
      })
      if (!result.ok) return setError(result.error.message)
    }
    await refresh()
    finish(true)
  }

  const secrets = request?.provider.secrets ?? []

  return (
    <DialogFrame
      open={request !== null}
      onClose={() => finish(false)}
      title={`${request?.provider.label ?? ''} key`}
      icon="key"
      kind="form"
    >
      <form className={styles.form} onSubmit={(e) => void save(e)}>
        {secrets.map((name, i) => (
          <div key={name} className={layout.field}>
            <span className={layout.row}>
              <label htmlFor={`dialog-${name}`}>{secretLabel(name)}</label>
              {i === 0 && <InfoTip about="keys">{KEY_HELP}</InfoTip>}
            </span>
            <input
              id={`dialog-${name}`}
              type="password"
              autoComplete="off"
              autoFocus={i === 0}
              name={name}
              required
            />
          </div>
        ))}
        {error !== null && <DialogAlert tone="danger">{error}</DialogAlert>}
        <DialogFoot>
          <button type="button" className={layout.quiet} onClick={() => finish(false)}>
            Cancel
          </button>
          <button type="submit" className={layout.primary}>
            Save
          </button>
        </DialogFoot>
      </form>
    </DialogFrame>
  )
}
