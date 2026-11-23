// CW-4 (spec/comfyui-custom.md "Screens", D-104): "Change workflow", a form dialog. "Name";
// the size choices only when the graph has size marks; the video values only for a video
// workflow. Nothing is sent before "Save", which sends comfyWorkflow.update once; "Cancel"
// and Escape send nothing. A refusal is a danger DialogAlert at the top, and the dialog stays.
import { useRef, useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { MAX_WORKFLOW_NAME } from '@/shared/comfy/custom-workflow'
import layout from '@/renderer/ui/layout.module.css'
import { startValues, updateInput, type ChangeValues } from './change-values'
import { SizeFields, VideoFields } from './workflow-fields'
import styles from './change-workflow.module.css'

export type ChangeWorkflowProps = {
  // The workflow to change; null while closed.
  workflow: WorkflowInfo | null
  // Whether its graph has width and height marks, so it takes a size.
  sizeMarks: boolean
  onClose: () => void
}

export function ChangeWorkflow(props: ChangeWorkflowProps) {
  const { workflow: w } = props
  const command = useApp((s) => s.command)
  const [values, setValues] = useState<ChangeValues | null>(null)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [shownFor, setShownFor] = useState<string | null>(null)
  // Set at the click, before React draws the disabled button, so a double click sends once.
  const sending = useRef(false)
  const id = w?.id ?? null
  if (id !== shownFor) {
    setShownFor(id)
    setValues(w === null ? null : startValues(w))
    setRefusal(null)
  }

  const change = (part: Partial<ChangeValues>) =>
    setValues((old) => (old === null ? old : { ...old, ...part }))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (w === null || values === null || sending.current) return
    sending.current = true
    setBusy(true)
    setRefusal(null)
    const result = await command('comfyWorkflow.update', updateInput(w, values, props.sizeMarks))
    sending.current = false
    setBusy(false)
    if (result.ok) props.onClose()
    else setRefusal(result.error.message)
  }

  return (
    <DialogFrame
      open={w !== null}
      onClose={props.onClose}
      title="Change workflow"
      kind="form"
      closable={!busy}
    >
      {values !== null && w !== null && (
        <form className={styles.form} onSubmit={(e) => void save(e)}>
          {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
          <div className={layout.field}>
            <label htmlFor="change-workflow-name">Name</label>
            <input
              id="change-workflow-name"
              type="text"
              autoComplete="off"
              maxLength={MAX_WORKFLOW_NAME}
              required
              value={values.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </div>
          {props.sizeMarks && <SizeFields values={values} onChange={change} />}
          {w.job === 'video' && <VideoFields values={values} onChange={change} />}
          <DialogFoot>
            <button type="button" className={layout.quiet} disabled={busy} onClick={props.onClose}>
              Cancel
            </button>
            <button type="submit" className={layout.primary} disabled={busy}>
              {busy && <BusySpinner />}
              Save
            </button>
          </DialogFoot>
        </form>
      )}
    </DialogFrame>
  )
}
