// Agent access's port (SPEC 6.8; SET-5, SET-6): an inline number field that saves on Enter or
// when left (choice C-4), then "Saved", and the refusal under it. An empty field sends nothing
// and shows the saved port again. The section sends the command; this part only draws.
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { SavedMark, onEnter, useSingleSave } from '@/renderer/screens/settings/saved-mark'
import layout from '@/renderer/ui/layout.module.css'
import styles from './mcp-section.module.css'

type Props = {
  saved: number
  refusal: string | null
  sending: boolean
  onSave: (port: number) => Promise<boolean>
}

export function PortField(props: Props) {
  const field = useSingleSave(String(props.saved), (value) => props.onSave(Number(value)))

  function save() {
    const value = field.text.trim()
    if (value === '') return field.reset()
    if (!props.sending) void field.save(value)
  }

  return (
    <div className={styles.port}>
      <div className={`${layout.field} ${layout.inline}`}>
        <label htmlFor="mcp-port">Port</label>
        <div className={layout.row}>
          {/* No min or max: settings.update owns the range, so its sentence is the one shown. */}
          <input
            id="mcp-port"
            type="number"
            className={styles.portInput}
            value={field.text}
            onChange={(e) => field.type(e.target.value)}
            onBlur={save}
            onKeyDown={onEnter(save)}
            aria-describedby={props.refusal === null ? undefined : 'mcp-port-refusal'}
          />
          <SavedMark shown={field.saved} />
        </div>
      </div>
      {props.refusal !== null && (
        <NoticeLine kind="danger" id="mcp-port-refusal">
          {props.refusal}
        </NoticeLine>
      )}
    </div>
  )
}
