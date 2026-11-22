// "Export…" in the campaign page's header row [P8-11] opens the export dialog. The dialog
// mounts afresh at each open, so every open starts with every ad ticked and no folder. CAMP-3:
// the head offers "Reports…" in its More menu (CAMP-6's useReports).
import { useState } from 'react'
import { ExportDialog } from '@/renderer/dialogs/export-dialog'

export type CampaignExportProps = { projectId: string; campaignId: string }

export function CampaignExport(props: CampaignExportProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Export…
      </button>
      {open && (
        <ExportDialog
          projectId={props.projectId}
          campaignId={props.campaignId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
