// CW-4 (spec/comfyui-custom.md "Screens", D-104): the remove warning for an added ComfyUI
// workflow, built like dialogs/delete-subject. "Remove {name}?" with what removing does as the
// description; "Keep" is focused and sends nothing; "Remove workflow" sends
// comfyWorkflow.remove once. A refusal stays in the dialog as a danger DialogAlert. Removing
// is not undoable, so nothing here offers to bring it back.
import { useId, useRef, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import layout from '@/renderer/ui/layout.module.css'

const BODY =
  'This removes the workflow from this computer and cannot be undone. Runs that have not started yet will fail.'

// The workflow asked about; null while closed.
export type RemoveWorkflowProps = { workflow: WorkflowInfo | null; onClose: () => void }

export function RemoveWorkflow(props: RemoveWorkflowProps) {
  const command = useApp((s) => s.command)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [askedFor, setAskedFor] = useState<string | null>(null)
  // Set at the click, before React draws the disabled button, so a double click sends once.
  const sending = useRef(false)
  const lineId = useId()
  const id = props.workflow?.id ?? null
  if (id !== askedFor) {
    setAskedFor(id)
    setRefusal(null)
  }

  async function remove() {
    if (id === null || sending.current) return
    sending.current = true
    setBusy(true)
    setRefusal(null)
    const result = await command('comfyWorkflow.remove', { workflowId: id })
    sending.current = false
    setBusy(false)
    if (result.ok) props.onClose()
    else setRefusal(result.error.message)
  }

  return (
    <DialogFrame
      open={props.workflow !== null}
      onClose={props.onClose}
      title={`Remove ${props.workflow?.label ?? ''}?`}
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
            Remove workflow
          </button>
        </>
      }
    >
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      <p id={lineId}>{BODY}</p>
    </DialogFrame>
  )
}
