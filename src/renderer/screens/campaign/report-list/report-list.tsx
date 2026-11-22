// The campaign's reports [P8-12; CAMP-6]: one ObjectRow per export, newest first as report.list
// gives them; a row's click shows that report's view over the list. No path is drawn: a row's
// tooltip is its folder's base name. A refused read stays as a visible alert. With no export,
// "Export…" asks the caller to open the export dialog; it starts nothing itself.
import { useState } from 'react'
import { ReportView } from '@/renderer/dialogs/report-view'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { EmptyState } from '@/renderer/ui/empty-state'
import layout from '@/renderer/ui/layout.module.css'
import { useReportRead } from './read-reports'
import { ReportRow } from './report-row'
import styles from './report-list.module.css'

export type ReportListProps = {
  projectId: string
  campaignId: string
  onClose: () => void
  onExport: () => void
}

export function ReportList(props: ReportListProps) {
  const read = useReportRead(props.projectId, props.campaignId)
  const [opened, setOpened] = useState<string | null>(null)
  const footer = (
    <button type="button" className={layout.primary} onClick={props.onClose}>
      Close
    </button>
  )
  return (
    <DialogFrame open onClose={props.onClose} title="Reports" footer={footer} size="wide">
      {read.kind === 'loading' && <DialogAlert tone="busy">Loading the reports…</DialogAlert>}
      {read.kind === 'refused' && <DialogAlert tone="danger">{read.message}</DialogAlert>}
      {read.kind === 'shown' && read.reports.length === 0 && (
        <EmptyState
          icon="export"
          words="No exports yet"
          action={{ label: 'Export…', onClick: props.onExport }}
        />
      )}
      {read.kind === 'shown' && read.reports.length > 0 && (
        <ul aria-label="Reports" className={styles.list}>
          {read.reports.map((report) => (
            <ReportRow
              key={report.reportId}
              report={report}
              onOpen={() => setOpened(report.reportId)}
            />
          ))}
        </ul>
      )}
      {opened !== null && (
        <ReportView projectId={props.projectId} reportId={opened} onClose={() => setOpened(null)} />
      )}
    </DialogFrame>
  )
}
