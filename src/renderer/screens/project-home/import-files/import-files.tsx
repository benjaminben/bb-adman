// "Import files…" and "Import a folder…" (spec/screens-campaign.md, "Import buttons"). Each
// asks the system picker for paths, then opens the import dialog with them. A cancelled
// picker sends nothing and opens nothing.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { ImportDialog } from '@/renderer/dialogs/import-dialog'
import type { PickedPath, PickedPaths } from '@/shared/schemas/queries/dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'

export type ImportFilesProps = { projectId: string; subjects: SubjectRow[] }

type Picked = { paths: string[]; folder: boolean }

export function ImportFiles(props: ImportFilesProps) {
  const api = useApi()
  const [picked, setPicked] = useState<Picked | null>(null)

  async function pickFiles() {
    const reply = await api.query('dialog.pickFiles', { purpose: 'import', multiple: true })
    const paths = reply.ok ? ((reply.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length > 0) setPicked({ paths, folder: false })
  }

  async function pickFolder() {
    const reply = await api.query('dialog.pickFolder', { title: 'Choose a folder to import' })
    const path = reply.ok ? (reply.data as PickedPath | null)?.path : null
    if (path) setPicked({ paths: [path], folder: true })
  }

  return (
    <div className={layout.row}>
      <button type="button" onClick={() => void pickFiles()}>
        <Icon name="upload" />
        Import files…
      </button>
      <button type="button" onClick={() => void pickFolder()}>
        <Icon name="folder" />
        Import a folder…
      </button>
      <ImportDialog
        projectId={props.projectId}
        open={picked !== null}
        paths={picked?.paths ?? []}
        folder={picked?.folder ?? false}
        subjects={props.subjects}
        onClose={() => setPicked(null)}
      />
    </div>
  )
}
