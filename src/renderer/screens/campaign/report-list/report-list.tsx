// The campaign's reports [P8-12] (spec/phases/phase-08.md "Report", queries): one row per
// report, newest first as report.list gives them, each with "Open", which shows that report's
// view over the list. Every value is React text; the folder is text only, never a link.
import { useId, useState } from 'react'
import { ReportView } from '@/renderer/dialogs/report-view'
import { utcTime } from '@/renderer/dialogs/report-view/report-words'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { ReportListItem } from '@/shared/schemas/queries/report'
import { useReports } from './use-reports'
import styles from './report-list.module.css'

export type ReportListProps = { projectId: string; campaignId: string; onClose: () => void }

export const rowLine = (r: ReportListItem) =>
  `Export ${r.exportNumber} · ${utcTime(r.createdAt)} · ${r.summary.exported} exported, ` +
  `${r.summary.failed} failed · ${r.outputDir}`

function ReportRow(props: { report: ReportListItem; onOpen: () => void }) {
  const id = useId()
  return (
    <li className={styles.row}>
      <p id={id} className={styles.line}>
        {rowLine(props.report)}
      </p>
      <button type="button" className={layout.small} aria-describedby={id} onClick={props.onOpen}>
        Open
      </button>
    </li>
  )
}

export function ReportList(props: ReportListProps) {
  const read = useReports(props.projectId, props.campaignId)
  const [opened, setOpened] = useState<string | null>(null)
  const footer = (
    <button type="button" className={layout.primary} onClick={props.onClose}>
      Close
    </button>
  )
  return (
    <DialogFrame open onClose={props.onClose} title="Reports" footer={footer} size="wide">
      {read.kind === 'loading' && <p className={layout.muted}>Loading the reports…</p>}
      {read.kind === 'refused' && (
        <p role="alert" className={layout.muted}>
          {read.message}
        </p>
      )}
      {read.kind === 'shown' && read.reports.length === 0 && (
        <p className={layout.empty}>No export yet.</p>
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
