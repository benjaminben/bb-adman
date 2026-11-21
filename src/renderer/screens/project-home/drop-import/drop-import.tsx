// The drop target (spec/screens-campaign.md, "Importing by dropping files"; FR-246). While
// files are dragged over the window a layer names the project; a drop opens the import
// dialog with the dropped paths. A drop never imports by itself: the user presses "Import".
import { useState } from 'react'
import { ImportDialog } from '@/renderer/dialogs/import-dialog'
import { droppedPaths } from '@/renderer/ui/dropped-paths'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { useFileDrop } from './use-file-drop'
import styles from './drop-import.module.css'

export type DropImportProps = { projectId: string; projectName: string; subjects: SubjectRow[] }

export function DropImport(props: DropImportProps) {
  const [paths, setPaths] = useState<string[] | null>(null)
  const dragging = useFileDrop({
    ignore: paths !== null,
    onFiles: (files) => {
      const found = droppedPaths(files)
      if (found.length > 0) setPaths(found)
    },
  })

  return (
    <>
      {dragging && (
        <div className={styles.layer}>
          <p className={styles.text}>Drop to import into {props.projectName}</p>
        </div>
      )}
      <ImportDialog
        projectId={props.projectId}
        open={paths !== null}
        paths={paths ?? []}
        folder={false}
        subjects={props.subjects}
        onClose={() => setPaths(null)}
      />
    </>
  )
}
