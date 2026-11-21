// spec/screens-variants.md, "Direction dialogs" [D-099]: the warning before direction.delete,
// which has no undo. "Delete {name}?", "Its {n} variant(s) go with it. This cannot be undone.",
// then "Keep" (first, so it has the focus; sends nothing) and "Delete direction". A refusal
// shows here as well as in the banner, and the dialog stays open.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { DirectionRow } from '@/shared/schemas/rows/direction'

export type DeleteDirectionProps = {
  open: boolean
  projectId: string
  direction: DirectionRow
  variantCount: number
  onClose: () => void
}

export function deleteDirectionWords(count: number): string {
  return `Its ${count} variant(s) go with it. This cannot be undone.`
}

export function DeleteDirection(props: DeleteDirectionProps) {
  const command = useApp((s) => s.command)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  function close() {
    setRefusal(null)
    props.onClose()
  }

  async function remove() {
    setSending(true)
    const input = { projectId: props.projectId, directionId: props.direction.id }
    const reply = await command('direction.delete', input)
    setSending(false)
    if (reply.ok) return close()
    setRefusal(reply.error.message)
  }

  return (
    <DialogFrame
      open={props.open}
      onClose={close}
      title={`Delete ${props.direction.name}?`}
      description={deleteDirectionWords(props.variantCount)}
      closable={!sending}
    >
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          <Icon name="alert" />
          {refusal}
        </p>
      )}
      <DialogFoot>
        <button type="button" disabled={sending} onClick={close}>
          Keep
        </button>
        <button
          type="button"
          className={layout.danger}
          disabled={sending}
          onClick={() => void remove()}
        >
          Delete direction
        </button>
      </DialogFoot>
    </DialogFrame>
  )
}
