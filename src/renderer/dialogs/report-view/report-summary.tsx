// The report view's first parts, in the HTML file's order (spec/phases/phase-08.md "Report",
// HTML): the header, the summary, the warnings exported past and asked for against delivered.
// Every value is React text. Field and Section are shared with report-ad.tsx. DLG-7: the header
// sits in the folded "Details"; the paid line moves out of it to the summary, on the page.
import { useId, type ReactNode } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { Report } from '@/shared/schemas/report'
import * as W from './report-words'
import styles from './report-view.module.css'

export const Note = (props: { children: ReactNode }) => (
  <span className={styles.note}>{props.children}</span>
)

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </div>
  )
}

export function Section(props: { heading: string; className?: string; children: ReactNode }) {
  const id = useId()
  const extra = props.className === undefined ? '' : ` ${props.className}`
  return (
    <section aria-labelledby={id} className={`${styles.section}${extra}`}>
      <h3 id={id} className={styles.heading}>
        {props.heading}
      </h3>
      {props.children}
    </section>
  )
}

const nameOr = (name: string | null) => (name ? name : <Note>{W.REPORT_WORDS.nameNotSet}</Note>)

export function ReportHeader(props: { report: Report }) {
  const { report } = props
  return (
    <dl className={styles.fields}>
      <Field label={W.LABELS.campaign}>{report.campaignName}</Field>
      <Field label={W.LABELS.market}>{report.market}</Field>
      <Field label={W.LABELS.audience}>{report.audience}</Field>
      <Field label={W.LABELS.campaignId}>{report.campaignId}</Field>
      <Field label={W.LABELS.exportedAt}>{W.utcTime(report.createdAt)}</Field>
      <Field label={W.LABELS.exporter}>
        {nameOr(report.exporter.name)}
        <br />
        <Note>{W.REPORT_WORDS.exporterNote}</Note>
      </Field>
      <Field label={W.LABELS.exportNumber}>{String(report.exportNumber)}</Field>
      <Field label={W.LABELS.appVersion}>{report.appVersion}</Field>
    </dl>
  )
}

// DLG-7: the counts as marks, each named by its words; the paid line stays on the page.
export function ReportSummary(props: { report: Report }) {
  const { report } = props
  const { summary } = report
  return (
    <section aria-label={W.HEADINGS.summary} className={styles.summary}>
      <div className={styles.marks}>
        <StatusMark
          tone="none"
          icon="export"
          label={String(summary.exported)}
          tip={W.LABELS.exported}
        />
        <StatusMark
          tone="ok"
          icon="check"
          label={String(summary.passedAll)}
          tip={W.LABELS.passedAll}
        />
        <StatusMark
          tone="warn"
          icon="alert"
          label={String(summary.withWarnings)}
          tip={W.LABELS.withWarnings}
        />
        <StatusMark tone="danger" icon="x" label={String(summary.failed)} tip={W.LABELS.failed} />
      </div>
      <p className={styles.paid}>{`${W.LABELS.paid}: ${W.paidLine(report.paidGenerations)}`}</p>
      {!report.checksRun && <p className={styles.note}>{W.REPORT_WORDS.checksNotRun}</p>}
    </section>
  )
}

// Each warning with who exported past it, when and the reason; one the gate did not see says
// so instead (A-204).
export function ReportWarnings(props: { report: Report }) {
  const { report } = props
  const { proceeded } = report
  const titles = new Map(report.variants.map((v) => [v.variantId, v.title]))
  return (
    <Section heading={W.HEADINGS.warnings}>
      {report.warningsExportedPast.length === 0 ? (
        <p className={styles.note}>{W.NOTES.noWarnings}</p>
      ) : (
        <ul className={styles.list}>
          {report.warningsExportedPast.map((warning, index) => (
            <li key={index}>
              <dl className={styles.fields}>
                <Field label={W.LABELS.ad}>
                  {titles.get(warning.variantId) ?? warning.variantId}
                </Field>
                <Field label={W.LABELS.check}>{W.CHECK_NAMES[warning.checkId]}</Field>
                <Field label={W.LABELS.warning}>{warning.message}</Field>
                {warning.seenBeforeExport && proceeded && (
                  <>
                    <Field label={W.LABELS.proceededBy}>{nameOr(proceeded.by)}</Field>
                    <Field label={W.LABELS.proceededAt}>{W.utcTime(proceeded.at)}</Field>
                    <Field label={W.LABELS.reason}>
                      {proceeded.reason ?? <Note>{W.REPORT_WORDS.noReason}</Note>}
                    </Field>
                  </>
                )}
              </dl>
              {!warning.seenBeforeExport && <p className={styles.note}>{W.WARNING_AFTER_START}</p>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function ReportDelivered(props: { report: Report }) {
  const { missing } = props.report
  return (
    <Section heading={W.HEADINGS.delivered}>
      {missing.length === 0 ? (
        <p className={styles.note}>{W.NOTES.allDelivered}</p>
      ) : (
        <table className={layout.table}>
          <thead>
            <tr>
              <th scope="col">{W.LABELS.size}</th>
              <th scope="col">{W.LABELS.language}</th>
              <th scope="col">{W.LABELS.why}</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((pair, index) => (
              <tr key={index}>
                <td>{pair.sizeLabel}</td>
                <td>{pair.language}</td>
                <td>{W.MISSING_WORDS[pair.reason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
