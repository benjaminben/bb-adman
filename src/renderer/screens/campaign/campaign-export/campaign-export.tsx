// "Export…" in the campaign page's header row [P8-11] opens the export dialog. The dialog
// mounts afresh at each open, so every open starts with every ad ticked and no folder. CAMP-3:
// the head passes `reports={false}` and offers "Reports…" in its More menu; the "Reports" button
// beside "Export…" stays for callers that draw the pair alone.
import { useState } from 'react'
import { ExportDialog } from '@/renderer/dialogs/export-dialog'
import { CampaignReports } from '@/renderer/screens/campaign/report-list'

export type CampaignExportProps = { projectId: string; campaignId: string; reports?: boolean }

export function CampaignExport(props: CampaignExportProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Export…
      </button>
      {props.reports !== false && (
        <CampaignReports projectId={props.projectId} campaignId={props.campaignId} />
      )}
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
