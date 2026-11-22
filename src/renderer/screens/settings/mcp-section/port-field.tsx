// Agent access's port (SPEC 6.8; SET-5): an inline number field with "Save port" (until SET-6),
// and the refusal under it. The section sends the command; this part only draws.
import type { FormEvent } from 'react'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import styles from './mcp-section.module.css'

type Props = {
  value: string
  refusal: string | null
  sending: boolean
  onType: (text: string) => void
  onSave: () => void
}

export function PortField(props: Props) {
  function submit(event: FormEvent) {
    event.preventDefault()
    props.onSave()
  }

  return (
    <div className={styles.port}>
      <form className={`${layout.field} ${layout.inline}`} onSubmit={submit}>
        <label htmlFor="mcp-port">Port</label>
        <div className={layout.row}>
          {/* No min or max: settings.update owns the range, so its sentence is the one shown. */}
          <input
            id="mcp-port"
            type="number"
            className={styles.portInput}
            value={props.value}
            onChange={(e) => props.onType(e.target.value)}
            aria-describedby={props.refusal === null ? undefined : 'mcp-port-refusal'}
          />
          <button type="submit" className={layout.secondary} disabled={props.sending}>
            Save port
          </button>
        </div>
      </form>
      {props.refusal !== null && (
        <NoticeLine kind="danger" id="mcp-port-refusal">
          {props.refusal}
        </NoticeLine>
      )}
    </div>
  )
}
