// "Reports" beside "Export…" [P8-12] opens the campaign's reports list.
import { useState } from 'react'
import { ReportList } from './report-list'

export type CampaignReportsProps = { projectId: string; campaignId: string }

export function CampaignReports(props: CampaignReportsProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reports
      </button>
      {open && (
        <ReportList
          projectId={props.projectId}
          campaignId={props.campaignId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
