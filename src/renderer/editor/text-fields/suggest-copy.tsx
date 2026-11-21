// "Suggest copy…" beside Copy (spec/screens-ai.md, "Copy options") [REQ: FR-045]: not for the
// headline slot (the campaign message, FR-043), disabled for a locked layer. It opens the copy
// options dialog for the shown project; the dialog is drawn only while open.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { CopyOptionsDialog } from '@/renderer/dialogs/copy-options-dialog'
import type { LayerRow } from '@/shared/schemas/rows/layer'

function ShownProjectDialog(props: { layer: LayerRow; onClose: () => void }) {
  const projectId = useApp((s) => (s.view.kind === 'project' ? s.view.projectId : null))
  if (projectId === null) return null
  return <CopyOptionsDialog open projectId={projectId} layer={props.layer} onClose={props.onClose} />
}

export function SuggestCopy(props: { layer: LayerRow }) {
  const [open, setOpen] = useState(false)
  if (props.layer.slot === 'headline') return null
  return (
    <>
      <button type="button" disabled={props.layer.locked} onClick={() => setOpen(true)}>
        Suggest copy…
      </button>
      {open && <ShownProjectDialog layer={props.layer} onClose={() => setOpen(false)} />}
    </>
  )
}
