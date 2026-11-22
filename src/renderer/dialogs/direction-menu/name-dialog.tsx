// spec/screens-variants.md, "Direction dialogs": the dialog for "New direction" and for
// "Rename {name}". One field, "Name", and the button that sends the command. The name rules are
// the command's; a refusal shows here (role alert) as well as in the banner, and the dialog
// stays open. Success closes it.
import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'

export type NameDialogProps = {
  open: boolean
  title: string
  action: string
  initialName: string
  command: string
  input: (name: string) => Record<string, unknown>
  onClose: () => void
}

type BodyProps = NameDialogProps & { sending: boolean; setSending: (on: boolean) => void }

function NameBody(props: BodyProps) {
  const command = useApp((s) => s.command)
  const fieldId = useId()
  const [name, setName] = useState(props.initialName)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    props.setSending(true)
    const reply = await command(props.command, props.input(name))
    props.setSending(false)
    if (reply.ok) return props.onClose()
    setRefusal(reply.error.message)
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className={layout.field}>
        <label htmlFor={fieldId} className={layout.label}>
          Name
        </label>
        <input
          id={fieldId}
          type="text"
          value={name}
          disabled={props.sending}
          onChange={(event) => setName(event.target.value)}
        />
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
        <button type="submit" className={layout.primary} disabled={props.sending}>
          {props.action}
        </button>
      </DialogFoot>
    </form>
  )
}

export function NameDialog(props: NameDialogProps) {
  const [sending, setSending] = useState(false)
  return (
    <DialogFrame open={props.open} onClose={props.onClose} title={props.title} closable={!sending}>
      {props.open && <NameBody {...props} sending={sending} setSending={setSending} />}
    </DialogFrame>
  )
}
