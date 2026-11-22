// "Paste a brief" (spec/phases/round-2-platform.md, D4): one text area for a brief as JSON,
// YAML or Markdown. "Read brief" sends brief.parse with the text; a refusal shows here (role
// alert) and the text stays; a read brief goes to `onRead`, which closes the dialog and runs
// the loaded brief's flow. "Start from an empty form" opens the form as "Type a brief" did.
// DLG-3b: the `form` kind; a placeholder in place of the hint line; the foot is "Empty form"
// (named "Start from an empty form", on the left), "Cancel", "Read brief"; a refusal is a
// DialogAlert.
// Pasted text names no folder, so brief.parse checks only full paths and asset IDs in it (D3).
import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-paste.module.css'

export type BriefPasteProps = {
  open: boolean
  projectId: string
  onClose: () => void
  onEmpty: () => void
  onRead: (parsed: BriefParsed) => void
}

type BodyProps = BriefPasteProps & { sending: boolean; setSending: (on: boolean) => void }

function PasteBody(props: BodyProps) {
  const command = useApp((s) => s.command)
  const fieldId = useId()
  const [text, setText] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    props.setSending(true)
    const reply = await command('brief.parse', { projectId: props.projectId, text })
    props.setSending(false)
    if (reply.ok) return props.onRead(reply.data as BriefParsed)
    setRefusal(reply.error.message)
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className={layout.field}>
        <label htmlFor={fieldId} className={layout.label}>
          Brief text
        </label>
        <textarea
          id={fieldId}
          className={styles.text}
          rows={16}
          spellCheck={false}
          value={text}
          placeholder="JSON, YAML or Markdown"
          disabled={props.sending}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      <DialogFoot>
        <button
          type="button"
          className={`${layout.quiet} ${styles.empty}`}
          aria-label="Start from an empty form"
          disabled={props.sending}
          onClick={props.onEmpty}
        >
          Empty form
        </button>
        <button type="button" disabled={props.sending} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="submit"
          className={layout.primary}
          disabled={props.sending || text.trim() === ''}
        >
          Read brief
        </button>
      </DialogFoot>
    </form>
  )
}

export function BriefPaste(props: BriefPasteProps) {
  const [sending, setSending] = useState(false)
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Paste a brief"
      kind="form"
      closable={!sending}
    >
      {props.open && <PasteBody {...props} sending={sending} setSending={setSending} />}
    </DialogFrame>
  )
}
