// The missing-file mark and its relink dialog (spec/screens-campaign.md, "Finding missing
// files: the relink dialog"; HOME-1). `missingCount` is project.get's missingAssetCount. A
// failure stays on the page as words: the mark reads "{n} missing" and a click opens the
// dialog. The dialog stays mounted while open, so finding the last file does not close it.
import { useState } from 'react'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { StatusMark } from '@/renderer/ui/status-mark'

export type MissingFilesProps = { projectId: string; missingCount: number }

export function MissingFiles(props: MissingFilesProps) {
  const [open, setOpen] = useState(false)
  const count = props.missingCount
  if (count === 0 && !open) return null

  return (
    <>
      {count > 0 && (
        <StatusMark
          tone="warn"
          icon="alert"
          label={`${count} missing`}
          tip={`${count} missing: Find missing files…`}
          onClick={() => setOpen(true)}
        />
      )}
      <RelinkDialog projectId={props.projectId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
