// The reference dialog (spec/screens-ai.md, "Reference dialog"; A-68): two reference pickers,
// the project's reference pictures and the pictures made in it, over one ordered list of
// ticks, at most MAX_REFERENCES_PER_RUN. "Done" gives the ticks to the caller; "Cancel" and
// Escape drop this visit's changes. Each opening starts from the caller's chosen pictures.
// DLG-5 (C-16): the `pick` kind; "{k} / {limit}" above the grids counts the ticks, and each
// tile that cannot be ticked at the limit says why (the picker). What "Done" hands back is
// exactly the ticks, in their order: these pictures are what a paid run sends.
import { useState } from 'react'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
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

function ReferenceBody(props: ReferenceDialogProps) {
  const [ticks, setTicks] = useState(props.chosen)
  return (
    <div className={styles.body}>
      <p
        className={styles.count}
        title={`${ticks.length} of ${MAX_REFERENCES_PER_RUN} pictures chosen`}
      >
        <span>{`${ticks.length} / ${MAX_REFERENCES_PER_RUN}`}</span>
      </p>
      {(['reference', 'asset'] as const).map((library) => (
        <ReferencePicker
          key={library}
          projectId={props.projectId}
          subjectId={props.subjectId}
          local={false}
          ticks={ticks}
          setTicks={setTicks}
          library={library}
          shared
        />
      ))}
      <DialogFoot>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" className={layout.primary} onClick={() => props.onDone(ticks)}>
          Done
        </button>
      </DialogFoot>
    </div>
  )
}

export function ReferenceDialog(props: ReferenceDialogProps) {
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onCancel}
      title={`Reference pictures for ${props.layerName}`}
      kind="pick"
    >
      {props.open && <ReferenceBody {...props} />}
    </DialogFrame>
  )
}
