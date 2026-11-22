// spec/screens-variants.md, "Direction dialogs" [D-099]: the warning before direction.delete,
// which has no undo. "Delete {name}?", "Its {n} variants go with it. This cannot be undone."
// (a real plural), then "Keep" (first, so it has the focus; sends nothing) and "Delete
// direction". A refusal shows here as well as in the banner, and the dialog stays open.
// Design wave CAMP-2: the `confirm` kind; the warning line is in the body and is the dialog's
// description; "Keep" is quiet and "Delete direction" the danger action.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import type { DirectionRow } from '@/shared/schemas/rows/direction'

export type DeleteDirectionProps = {
  open: boolean
  projectId: string
  direction: DirectionRow
  variantCount: number
  onClose: () => void
}

export function deleteDirectionWords(count: number): string {
  const go = count === 1 ? 'goes' : 'go'
  return `Its ${plural(count, 'variant')} ${go} with it. This cannot be undone.`
}

export function DeleteDirection(props: DeleteDirectionProps) {
  const command = useApp((s) => s.command)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const lineId = useId()

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
      kind="confirm"
      describedBy={lineId}
      closable={!sending}
    >
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      <p id={lineId}>{deleteDirectionWords(props.variantCount)}</p>
      <DialogFoot>
        <button type="button" className={layout.quiet} disabled={sending} onClick={close}>
          Keep
        </button>
        <button
          type="button"
          className={`${layout.primary} ${layout.danger}`}
          disabled={sending}
          onClick={() => void remove()}
        >
          Delete direction
        </button>
      </DialogFoot>
    </DialogFrame>
  )
}
