// "Reports" beside "Export…" [P8-12] opens the campaign's reports list. CAMP-6: `useReports`
// gives `open()` and the dialog node, so CAMP-3 can put the opener in a menu. The empty list's
// "Export…" closes the list and opens the export dialog with the same props as the campaign's
// own "Export…" (a fresh mount, nothing ticked off and no folder); it sends nothing itself.
import { useState, type ReactNode } from 'react'
import { ExportDialog } from '@/renderer/dialogs/export-dialog'
import { ReportList } from './report-list'

export type CampaignReportsProps = { projectId: string; campaignId: string }

type Shown = 'none' | 'reports' | 'export'

export function useReports(
  projectId: string,
  campaignId: string,
): { open(): void; dialog: ReactNode } {
  const [shown, setShown] = useState<Shown>('none')
  const close = () => setShown('none')
  const dialog =
    shown === 'reports' ? (
      <ReportList
        projectId={projectId}
        campaignId={campaignId}
        onClose={close}
        onExport={() => setShown('export')}
      />
    ) : shown === 'export' ? (
      <ExportDialog projectId={projectId} campaignId={campaignId} onClose={close} />
    ) : null
  return { open: () => setShown('reports'), dialog }
}

export function CampaignReports(props: CampaignReportsProps) {
  const reports = useReports(props.projectId, props.campaignId)
  return (
    <>
      <button type="button" onClick={reports.open}>
        Reports
      </button>
      {reports.dialog}
    </>
  )
}
