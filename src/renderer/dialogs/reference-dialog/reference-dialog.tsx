// The reference dialog (spec/screens-ai.md, "Reference dialog"; A-68): two reference pickers,
// the project's reference pictures and the pictures made in it, over one ordered list of
// ticks, at most MAX_REFERENCES_PER_RUN. "Done" gives the ticks to the caller; "Cancel" and
// Escape drop this visit's changes. Each opening starts from the caller's chosen pictures.
import { useId, useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { ReferencePicker } from '@/renderer/ui/reference-picker'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import styles from './reference-dialog.module.css'

export type ReferenceDialogProps = {
  open: boolean
  projectId: string
  layerName: string
  // Pictures added here are filed under this subject (the variant's first), as on the
  // campaign page.
  subjectId: string | undefined
  chosen: string[]
  onDone: (ids: string[]) => void
  onCancel: () => void
}

const LIMIT_LINE = `At most ${MAX_REFERENCES_PER_RUN} pictures.`

function ReferenceBody(props: ReferenceDialogProps) {
  const [ticks, setTicks] = useState(props.chosen)
  const fullNoteId = useId()
  const full = ticks.length >= MAX_REFERENCES_PER_RUN
  return (
    <div className={styles.body}>
      {(['reference', 'asset'] as const).map((library) => (
        <ReferencePicker
          key={library}
          projectId={props.projectId}
          subjectId={props.subjectId}
          local={false}
          ticks={ticks}
          setTicks={setTicks}
          library={library}
          shared={{ fullNoteId }}
        />
      ))}
      {full && (
        <p id={fullNoteId} className={styles.muted}>
          {LIMIT_LINE}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primary} onClick={() => props.onDone(ticks)}>
          Done
        </button>
      </div>
    </div>
  )
}

export function ReferenceDialog(props: ReferenceDialogProps) {
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onCancel}
      title={`Reference pictures for ${props.layerName}`}
    >
      {props.open && <ReferenceBody {...props} />}
    </DialogFrame>
  )
}
