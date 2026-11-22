// "Package project…" (spec/screens-campaign.md, "Package project"): the button in the
// project home's "Package" section, and the dialog it opens. usePackageProject (SH-3) lets the
// project menu's "Package…" open the same dialog for the shown project.
import { useState, type ReactNode } from 'react'
import { PackageDialog } from '@/renderer/dialogs/package-dialog'
import { Icon } from '@/renderer/ui/icon'

export type PackageProjectProps = { projectId: string }

export function usePackageProject(projectId: string | null): {
  open: () => void
  dialog: ReactNode
} {
  const [shown, setShown] = useState(false)
  const dialog =
    projectId === null ? null : (
      <PackageDialog projectId={projectId} open={shown} onClose={() => setShown(false)} />
    )
  return { open: () => setShown(true), dialog }
}

export function PackageProject(props: PackageProjectProps) {
  const { open, dialog } = usePackageProject(props.projectId)

  return (
    <>
      <button type="button" onClick={open}>
        <Icon name="box" />
        Package project…
      </button>
      {dialog}
    </>
  )
}
