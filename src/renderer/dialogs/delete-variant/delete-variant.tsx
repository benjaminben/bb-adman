// The delete warning (spec/screens-variants.md, "The tile's actions") [D-099]: "Delete
// {title}?" with "This cannot be undone.", then "Keep" (focused, sends nothing) and "Delete
// variant", which sends variant.delete. Deleting is not undoable, so nothing here offers to
// bring the variant back. A refusal (jobs_running, master_variant) shows in the banner through
// the app store's command and in the dialog, since the banner is behind the overlay (A-50).
// Design wave DLG-2: the `confirm` kind, with no word changed. The body line is the dialog's
// description; "Keep" is quiet and "Delete variant" the danger action, with the busy spinner
// inside it; a refusal is a danger DialogAlert.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'

export type DeleteVariantProps = {
  projectId: string
  // The variant asked about; null while closed.
  variant: VariantSummary | null
  onClose: () => void
}

export function DeleteVariant(props: DeleteVariantProps) {
  const command = useApp((s) => s.command)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [askedFor, setAskedFor] = useState<string | null>(null)
  const lineId = useId()
  const id = props.variant?.id ?? null
  if (id !== askedFor) {
    setAskedFor(id)
    setRefusal(null)
  }

  async function remove() {
    if (id === null) return
    setBusy(true)
    setRefusal(null)
    const result = await command('variant.delete', { projectId: props.projectId, variantId: id })
    setBusy(false)
    if (result.ok) props.onClose()
    else setRefusal(result.error.message)
  }

  return (
    <DialogFrame
      open={props.variant !== null}
      onClose={props.onClose}
      title={`Delete ${props.variant?.title ?? ''}?`}
      kind="confirm"
      describedBy={lineId}
      closable={!busy}
      footer={
        <>
          <button
            type="button"
            className={layout.quiet}
            autoFocus
            disabled={busy}
            onClick={props.onClose}
          >
            Keep
          </button>
          <button
            type="button"
            className={`${layout.primary} ${layout.danger}`}
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy && <BusySpinner />}
            Delete variant
          </button>
        </>
      }
    >
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      <p id={lineId}>This cannot be undone.</p>
    </DialogFrame>
  )
}
