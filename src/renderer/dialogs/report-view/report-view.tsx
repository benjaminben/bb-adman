// One export report in the app [P8-12] (spec/phases/phase-08.md "Report"), drawn from
// report.get. Every value from the report is React text. DLG-7: kind="review"; the counts as
// marks with the paid line, the head facts in a "Details" Section folded at first, the ads in
// two panes (report-ads.tsx), then the warnings exported past and asked for against delivered.
// The export folder that report.get sends is never read here, so no part of it is drawn.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { ReportGetReply } from '@/shared/schemas/queries/report'
import { Section } from '@/renderer/ui/section'
import { ReportAds } from './report-ads'
import { ReportDelivered, ReportHeader, ReportSummary, ReportWarnings } from './report-summary'
import * as W from './report-words'
import styles from './report-view.module.css'

export type ReportViewProps = { projectId: string; reportId: string; onClose: () => void }

type Loaded =
  | { kind: 'loading' }
  | { kind: 'shown'; report: ReportGetReply['report'] }
  | { kind: 'refused'; message: string }

function useReport(projectId: string, reportId: string): Loaded {
  const api = useApi()
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  useEffect(() => {
    let live = true
    void api.query('report.get', { projectId, reportId }).then((reply) => {
      if (!live) return
      if (reply.ok) setLoaded({ kind: 'shown', report: (reply.data as ReportGetReply).report })
      else setLoaded({ kind: 'refused', message: reply.error.message })
    })
    return () => {
      live = false
    }
  }, [api, projectId, reportId])
  return loaded
}

export function ReportView(props: ReportViewProps) {
  const loaded = useReport(props.projectId, props.reportId)
  const footer = (
    <button type="button" className={layout.quiet} onClick={props.onClose}>
      Close
    </button>
  )
  return (
    <DialogFrame open onClose={props.onClose} title={W.HEADINGS.page} footer={footer} kind="review">
      <div className={styles.body}>
        {loaded.kind === 'loading' && <p className={layout.muted}>Loading the report…</p>}
        {loaded.kind === 'refused' && (
          <p role="alert" className={styles.note}>
            {loaded.message}
          </p>
        )}
        {loaded.kind === 'shown' && (
          <>
            <ReportSummary report={loaded.report} />
            <Section id="report.details" title={W.HEADINGS.details} fold="closed">
              <p className={styles.note}>{W.REPORT_WORDS.picturesInFile}</p>
              <ReportHeader report={loaded.report} />
            </Section>
            <ReportAds projectId={props.projectId} report={loaded.report} />
            <ReportWarnings report={loaded.report} />
            <ReportDelivered report={loaded.report} />
          </>
        )}
      </div>
    </DialogFrame>
  )
}
