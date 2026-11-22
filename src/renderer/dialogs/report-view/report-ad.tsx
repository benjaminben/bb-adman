// One ad of the report view, in the HTML file's order (spec/phases/phase-08.md "Report", HTML):
// title, ID, size, language, format, file, subjects, changed, last agent change, translations,
// checks, assets, failure. The picture stays in the report file. Every value is React text.
import type { Report, ReportVariant } from '@/shared/schemas/report'
import { Field, Note, Section } from './report-summary'
import * as W from './report-words'
import styles from './report-view.module.css'

type AdProps = { report: Report; ad: ReportVariant }

function Translations(props: { ad: ReportVariant }) {
  const { translations } = props.ad
  if (translations === null) return <>{W.REPORT_WORDS.mainLanguage}</>
  if (translations.length === 0) return <Note>{W.NOTES.none}</Note>
  return (
    <ul className={styles.list}>
      {translations.map((t, index) => {
        const source = W.SOURCE_WORDS[t.source ?? 'none']
        const status = t.status ? W.STATUS_WORDS[t.status] : W.SOURCE_WORDS.none
        return <li key={index}>{`${t.layerKey}: ${source}, ${status}`}</li>
      })}
    </ul>
  )
}

function Checks(props: AdProps) {
  const { report, ad } = props
  if (!report.checksRun) return <Note>{W.REPORT_WORDS.checksNotRun}</Note>
  if (ad.checks.length === 0) return <Note>{W.NOTES.none}</Note>
  return (
    <ul className={styles.list}>
      {ad.checks.map((check, index) => (
        <li key={index}>
          {`${W.CHECK_NAMES[check.checkId]}: ${W.CHECK_STATUS_WORDS[check.status]}`}
          {check.findings.length > 0 && (
            <ul className={styles.list}>
              {check.findings.map((finding, at) => (
                <li key={at}>{finding.message}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function Assets(props: { ad: ReportVariant }) {
  if (props.ad.assets.length === 0) return <Note>{W.NOTES.none}</Note>
  return (
    <ul className={styles.list}>
      {props.ad.assets.map((asset, index) => (
        <li key={index}>
          {`${asset.displayName} (${asset.assetId}): ${W.ROLE_WORDS[asset.role]}, ${W.ORIGIN_WORDS[asset.origin]}`}
          {(asset.provider ?? asset.model ?? asset.prompt) !== undefined && (
            <dl className={styles.fields}>
              {asset.provider !== undefined && (
                <Field label={W.LABELS.provider}>{asset.provider}</Field>
              )}
              {asset.model !== undefined && <Field label={W.LABELS.model}>{asset.model}</Field>}
              {asset.prompt !== undefined && (
                <Field label={W.LABELS.prompt}>{W.shownPrompt(asset.prompt)}</Field>
              )}
            </dl>
          )}
        </li>
      ))}
    </ul>
  )
}

function changedWords(report: Report, ad: ReportVariant): string | null {
  if (ad.changedSincePrevious === null || report.previousExport === null) return null
  return W.CHANGED_WORDS[ad.changedSincePrevious](report.previousExport.exportNumber)
}

export function ReportAd(props: AdProps) {
  const { report, ad } = props
  const changed = changedWords(report, ad)
  const agent = ad.lastAgentChangeAt
    ? W.lastAgentChange(W.utcTime(ad.lastAgentChangeAt))
    : W.REPORT_WORDS.noAgentChanges
  return (
    <Section heading={ad.title} className={styles.ad}>
      <dl className={styles.fields}>
        <Field label={W.LABELS.id}>{ad.variantId}</Field>
        <Field label={W.LABELS.size}>{ad.sizeLabel}</Field>
        <Field label={W.LABELS.language}>{ad.language}</Field>
        <Field label={W.LABELS.format}>{W.FORMAT_WORDS[ad.format]}</Field>
        <Field label={W.LABELS.file}>{ad.file ?? <Note>{W.NOTES.noFile}</Note>}</Field>
        <Field label={W.LABELS.subjects}>
          {ad.subjects.length === 0 ? (
            <Note>{W.NOTES.none}</Note>
          ) : (
            <ul className={styles.list}>
              {ad.subjects.map((s, index) => (
                <li key={index}>{`${s.displayName} (${s.subjectId})`}</li>
              ))}
            </ul>
          )}
        </Field>
        {changed !== null && <Field label={W.LABELS.changed}>{changed}</Field>}
        <Field label={W.LABELS.agent}>{agent}</Field>
        <Field label={W.LABELS.translations}>
          <Translations ad={ad} />
        </Field>
        <Field label={W.LABELS.checks}>
          <Checks report={report} ad={ad} />
        </Field>
        <Field label={W.LABELS.assets}>
          <Assets ad={ad} />
        </Field>
        {ad.failure !== null && (
          <Field label={W.LABELS.failure}>
            <span className={styles.failure}>{ad.failure}</span>
          </Field>
        )}
      </dl>
    </Section>
  )
}
