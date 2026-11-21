// "Package project…" (spec/screens-campaign.md, "Package project"): the button in the
// project home's "Package" section, and the dialog it opens.
import { useState } from 'react'
import { PackageDialog } from '@/renderer/dialogs/package-dialog'

export type PackageProjectProps = { projectId: string }

export function PackageProject(props: PackageProjectProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Package project…
      </button>
      <PackageDialog projectId={props.projectId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
