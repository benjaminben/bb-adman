// SUBJ-1 (spec/phases/subject-delete.md, D-101): the delete warning for a subject, built like
// dialogs/delete-variant. "Delete {name}?" with "This cannot be undone." and what happens to
// its photos, which is the dialog's description; "Keep" is focused and sends nothing; "Delete
// subject" sends subject.delete once. A refusal (the subject is in use) stays in the dialog as
// a danger DialogAlert. Deleting is not undoable, so nothing here offers to bring it back.
import { useId, useRef, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import layout from '@/renderer/ui/layout.module.css'

export type DeleteSubjectProps = {
  projectId: string
  // The subject asked about; null while closed.
  subject: SubjectRow | null
  photoCount: number
  onClose: () => void
}

function photosLine(count: number): string {
  if (count === 0) return ''
  if (count === 1) return ' Its photo stays in the project without a subject.'
  return ` Its ${count} photos stay in the project without a subject.`
}

export function DeleteSubject(props: DeleteSubjectProps) {
  const command = useApp((s) => s.command)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [askedFor, setAskedFor] = useState<string | null>(null)
  // Set at the click, before React draws the disabled button, so a double click sends once.
  const sending = useRef(false)
  const lineId = useId()
  const id = props.subject?.id ?? null
  if (id !== askedFor) {
    setAskedFor(id)
    setRefusal(null)
  }

  async function remove() {
    if (id === null || sending.current) return
    sending.current = true
    setBusy(true)
    setRefusal(null)
    const result = await command('subject.delete', { projectId: props.projectId, subjectId: id })
    sending.current = false
    setBusy(false)
    if (result.ok) props.onClose()
    else setRefusal(result.error.message)
  }

  return (
    <DialogFrame
      open={props.subject !== null}
      onClose={props.onClose}
      title={`Delete ${props.subject?.name ?? ''}?`}
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
            Delete subject
          </button>
        </>
      }
    >
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      <p id={lineId}>This cannot be undone.{photosLine(props.photoCount)}</p>
    </DialogFrame>
  )
}
