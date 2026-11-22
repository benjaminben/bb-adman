// "Paste a brief" (spec/phases/round-2-platform.md, D4): one text area for a brief as JSON,
// YAML or Markdown. "Read brief" sends brief.parse with the text; a refusal shows here (role
// alert) and the text stays; a read brief goes to `onRead`, which closes the dialog and runs
// the loaded brief's flow. "Start from an empty form" opens the form as "Type a brief" did.
// Pasted text names no folder, so brief.parse checks only full paths and asset IDs in it (D3).
import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
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
  const hintId = useId()
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
          aria-describedby={hintId}
          disabled={props.sending}
          onChange={(event) => setText(event.target.value)}
        />
        <p id={hintId} className={styles.hint}>
          Paste a brief as JSON, YAML or Markdown.
        </p>
      </div>
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          <Icon name="alert" />
          {refusal}
        </p>
      )}
      <DialogFoot>
        <button type="button" disabled={props.sending} onClick={props.onClose}>
          Cancel
        </button>
        <button type="button" disabled={props.sending} onClick={props.onEmpty}>
          Start from an empty form
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
      size="wide"
      closable={!sending}
    >
      {props.open && <PasteBody {...props} sending={sending} setSending={setSending} />}
    </DialogFrame>
  )
}
