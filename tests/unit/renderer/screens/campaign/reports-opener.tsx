// Opens the campaign's reports list the way the campaign head's "Reports…" menu item does
// (`useReports(...).open`), from a plain "Reports" button, so a test can reach the list alone.
import { useReports } from '@/renderer/screens/campaign/report-list'

export function ReportsOpener(props: { projectId: string; campaignId: string }) {
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
