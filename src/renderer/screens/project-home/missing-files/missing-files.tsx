// The missing-file line and "Find missing files…" (spec/screens-campaign.md, "Finding missing
// files: the relink dialog"). `missingCount` is project.get's missingAssetCount. The dialog
// stays mounted while open, so finding the last file does not close it under the user.
import { useState } from 'react'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './missing-files.module.css'

export type MissingFilesProps = { projectId: string; missingCount: number }

export function MissingFiles(props: MissingFilesProps) {
  const [open, setOpen] = useState(false)
  if (props.missingCount === 0 && !open) return null

  return (
    <>
      {props.missingCount > 0 && (
        <div className={`${layout.notice} ${layout.warn} ${styles.notice}`}>
          <Icon name="alert" />
          <p className={styles.line}>
            {props.missingCount} file(s) this project links to cannot be found.
          </p>
          <button type="button" onClick={() => setOpen(true)}>
            Find missing files…
          </button>
        </div>
      )}
      <RelinkDialog projectId={props.projectId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
