// "Package project" (spec/screens-campaign.md, "Package project"; FR-008, D-027). The frame
// closes only while no package is being made. Its body mounts afresh at each open, so every
// open starts ready, with no folder kept from the last one.
import { useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { PackageBody } from './package-body'

export type PackageDialogProps = {
  projectId: string
  open: boolean
  onClose: () => void
}

const DESCRIPTION =
  'Adman copies the project file and every file it uses into one new folder that can be ' +
  'opened on another computer. The project you have open does not change.'

export function PackageDialog(props: PackageDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Package project"
      description={DESCRIPTION}
      closable={!busy}
    >
      <PackageBody projectId={props.projectId} onBusy={setBusy} onClose={props.onClose} />
    </DialogFrame>
  )
}
