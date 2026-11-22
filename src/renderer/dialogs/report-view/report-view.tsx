// One export report in the app [P8-12] (spec/phases/phase-08.md "Report"), drawn from
// report.get: the pictures note and the folder, then the HTML file's sections in its order.
// Every value from the report is React text; the folder is text only, never a link or opened.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { ReportGetReply } from '@/shared/schemas/queries/report'
import { ReportAd } from './report-ad'
import {
  Field,
  ReportDelivered,
  ReportHeader,
  ReportSummary,
  ReportWarnings,
} from './report-summary'
import * as W from './report-words'
import styles from './report-view.module.css'

export type ReportViewProps = { projectId: string; reportId: string; onClose: () => void }

type Loaded =
  | { kind: 'loading' }
  | { kind: 'shown'; data: ReportGetReply }
  | { kind: 'refused'; message: string }

function useReport(projectId: string, reportId: string): Loaded {
  const api = useApi()
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  useEffect(() => {
    let live = true
    void api.query('report.get', { projectId, reportId }).then((reply) => {
      if (!live) return
      if (reply.ok) setLoaded({ kind: 'shown', data: reply.data as ReportGetReply })
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
    <button type="button" className={layout.primary} onClick={props.onClose}>
      Close
    </button>
  )
  return (
    <DialogFrame open onClose={props.onClose} title={W.HEADINGS.page} footer={footer} size="large">
      <div className={styles.body}>
        {loaded.kind === 'loading' && <p className={layout.muted}>Loading the report…</p>}
        {loaded.kind === 'refused' && (
          <p role="alert" className={styles.note}>
            {loaded.message}
          </p>
        )}
        {loaded.kind === 'shown' && (
          <>
            <p className={styles.note}>{W.REPORT_WORDS.picturesInFile}</p>
            <dl className={styles.fields}>
              <Field label={W.LABELS.folder}>
                <span className={styles.path}>{loaded.data.outputDir}</span>
              </Field>
            </dl>
            <ReportHeader report={loaded.data.report} />
            <ReportSummary report={loaded.data.report} />
            <ReportWarnings report={loaded.data.report} />
            <ReportDelivered report={loaded.data.report} />
            {loaded.data.report.variants.map((ad) => (
              <ReportAd key={ad.variantId} report={loaded.data.report} ad={ad} />
            ))}
          </>
        )}
      </div>
    </DialogFrame>
  )
}
