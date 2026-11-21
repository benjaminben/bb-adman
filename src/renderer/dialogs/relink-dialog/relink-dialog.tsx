// "Find missing files" (spec/screens-campaign.md, "Finding missing files: the relink dialog";
// FR-009). The frame closes only while no relink is waiting. Its body mounts afresh at each
// open, so the list is read again and the box is ticked again every time.
import { useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { RelinkBody } from './relink-body'

export type RelinkDialogProps = {
  projectId: string
  open: boolean
  onClose: () => void
  onlyAssetIds?: string[]
}

export function RelinkDialog(props: RelinkDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Find missing files"
      closable={!busy}
    >
      <RelinkBody
        projectId={props.projectId}
        onlyAssetIds={props.onlyAssetIds}
        busy={busy}
        onBusy={setBusy}
        onClose={props.onClose}
      />
    </DialogFrame>
  )
}
