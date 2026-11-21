// The report page's parts (spec/phases/phase-08.md "Report", HTML): header, summary, warnings
// exported past, asked for against delivered, one ad. Every value reaches the markup through
// escape.ts (`value`, `element`); the markup around it is fixed text.
import type { Report, ReportVariant } from '@/shared/schemas/report'
import { element, escapeHtml } from './escape'
import * as W from './html-words'

const PROMPT_LIMIT = 2000

// A value as page text, in its own direction run.
const value = (text: string) => element('span', text, 'value')
const note = (text: string) => element('span', text, 'note')
const field = (label: string, html: string) => `${element('dt', label)}<dd>${html}</dd>`
const fields = (rows: string[]) => `<dl>${rows.join('')}</dl>`
const list = (items: string[]) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`
const section = (heading: string, body: string) =>
  `<section>${element('h2', heading)}${body}</section>`

// "YYYY-MM-DD HH:mm UTC". A time that does not parse is shown as it was stored.
export function utcTime(stored: string): string {
  const time = new Date(stored)
  if (Number.isNaN(time.getTime())) return stored
  return `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

// A-206: cut in the HTML only, by whole characters.
export function shownPrompt(prompt: string): string {
  const chars = Array.from(prompt)
  if (chars.length <= PROMPT_LIMIT) return prompt
  return `${chars.slice(0, PROMPT_LIMIT).join('')} ${W.REPORT_WORDS.promptCut}`
}

function table(heads: string[], rows: string[][]): string {
  const head = `<tr>${heads.map((h) => element('th', h)).join('')}</tr>`
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
  return `<table>${head}${body.join('')}</table>`
}

export function headerPart(report: Report): string {
  const exporter = report.exporter.name
    ? value(report.exporter.name)
    : note(W.REPORT_WORDS.nameNotSet)
  return `<header>${element('h1', W.HEADINGS.page)}${fields([
    field(W.LABELS.campaign, value(report.campaignName)),
    field(W.LABELS.market, value(report.market)),
    field(W.LABELS.audience, value(report.audience)),
    field(W.LABELS.campaignId, value(report.campaignId)),
    field(W.LABELS.exportedAt, value(utcTime(report.createdAt))),
    field(W.LABELS.exporter, `${exporter}<br>${note(W.REPORT_WORDS.exporterNote)}`),
    field(W.LABELS.exportNumber, value(String(report.exportNumber))),
    field(W.LABELS.appVersion, value(report.appVersion)),
    field(W.LABELS.paid, value(W.paidLine(report.paidGenerations))),
  ])}</header>`
}

export function summaryPart(report: Report): string {
  const { summary } = report
  const counts = fields([
    field(W.LABELS.exported, value(String(summary.exported))),
    field(W.LABELS.passedAll, value(String(summary.passedAll))),
    field(W.LABELS.withWarnings, value(String(summary.withWarnings))),
    field(W.LABELS.failed, value(String(summary.failed))),
  ])
  const notRun = report.checksRun ? '' : element('p', W.REPORT_WORDS.checksNotRun, 'note')
  return section(W.HEADINGS.summary, counts + notRun)
}

// Each warning with who exported past it, when, and the reason; a warning the gate did not see
// says so instead (A-204).
export function warningsPart(report: Report): string {
  if (report.warningsExportedPast.length === 0)
    return section(W.HEADINGS.warnings, element('p', W.NOTES.noWarnings, 'note'))
  const titles = new Map(report.variants.map((v) => [v.variantId, v.title]))
  const { proceeded } = report
  const items = report.warningsExportedPast.map((warning) => {
    const what = fields([
      field(W.LABELS.ad, value(titles.get(warning.variantId) ?? warning.variantId)),
      field(W.LABELS.check, value(W.CHECK_NAMES[warning.checkId])),
      field(W.LABELS.warning, element('span', warning.message, 'value warn')),
    ])
    if (!warning.seenBeforeExport) return what + element('p', W.WARNING_AFTER_START, 'note')
    if (!proceeded) return what
    return (
      what +
      fields([
        field(
          W.LABELS.proceededBy,
          proceeded.by ? value(proceeded.by) : note(W.REPORT_WORDS.nameNotSet),
        ),
        field(W.LABELS.proceededAt, value(utcTime(proceeded.at))),
        field(
          W.LABELS.reason,
          proceeded.reason ? value(proceeded.reason) : note(W.REPORT_WORDS.noReason),
        ),
      ])
    )
  })
  return section(W.HEADINGS.warnings, list(items))
}

export function deliveredPart(report: Report): string {
  if (report.missing.length === 0)
    return section(W.HEADINGS.delivered, element('p', W.NOTES.allDelivered, 'note'))
  const rows = report.missing.map((pair) => [
    value(pair.sizeLabel),
    value(pair.language),
    value(W.MISSING_WORDS[pair.reason]),
  ])
  return section(
    W.HEADINGS.delivered,
    table([W.LABELS.size, W.LABELS.language, W.LABELS.why], rows),
  )
}

function translationsHtml(ad: ReportVariant): string {
  if (ad.translations === null) return value(W.REPORT_WORDS.mainLanguage)
  if (ad.translations.length === 0) return note(W.NOTES.none)
  return list(
    ad.translations.map((t) => {
      const source = W.SOURCE_WORDS[t.source ?? 'none']
      const status = t.status ? W.STATUS_WORDS[t.status] : W.SOURCE_WORDS.none
      return value(`${t.layerKey}: ${source}, ${status}`)
    }),
  )
}

function checksHtml(report: Report, ad: ReportVariant): string {
  if (!report.checksRun) return note(W.REPORT_WORDS.checksNotRun)
  if (ad.checks.length === 0) return note(W.NOTES.none)
  return list(
    ad.checks.map((check) => {
      const head = value(`${W.CHECK_NAMES[check.checkId]}: ${W.CHECK_STATUS_WORDS[check.status]}`)
      const findings = check.findings.map((finding) => value(finding.message))
      return findings.length > 0 ? head + list(findings) : head
    }),
  )
}

function assetsHtml(ad: ReportVariant): string {
  if (ad.assets.length === 0) return note(W.NOTES.none)
  return list(
    ad.assets.map((asset) => {
      const head = value(
        `${asset.displayName} (${asset.assetId}): ${W.ROLE_WORDS[asset.role]}, ${W.ORIGIN_WORDS[asset.origin]}`,
      )
      const rows = [
        asset.provider === undefined ? '' : field(W.LABELS.provider, value(asset.provider)),
        asset.model === undefined ? '' : field(W.LABELS.model, value(asset.model)),
        asset.prompt === undefined ? '' : field(W.LABELS.prompt, value(shownPrompt(asset.prompt))),
      ].filter(Boolean)
      return rows.length > 0 ? head + fields(rows) : head
    }),
  )
}

function changedHtml(report: Report, ad: ReportVariant): string {
  if (ad.changedSincePrevious === null || report.previousExport === null) return ''
  const words = W.CHANGED_WORDS[ad.changedSincePrevious](report.previousExport.exportNumber)
  return field(W.LABELS.changed, value(words))
}

// The picture is base64 text, so it cannot leave the attribute; it is escaped all the same.
function pictureHtml(picture: Uint8Array | undefined): string {
  if (!picture) return element('div', W.NOTES.noPicture, 'picture')
  const data = escapeHtml(Buffer.from(picture).toString('base64'))
  return `<div class="picture"><img alt="" src="data:image/jpeg;base64,${data}"></div>`
}

export function adPart(report: Report, ad: ReportVariant, picture: Uint8Array | undefined): string {
  const subjects = ad.subjects.map((s) => value(`${s.displayName} (${s.subjectId})`))
  const agent = ad.lastAgentChangeAt
    ? W.lastAgentChange(utcTime(ad.lastAgentChangeAt))
    : W.REPORT_WORDS.noAgentChanges
  const rows = [
    field(W.LABELS.id, value(ad.variantId)),
    field(W.LABELS.size, value(ad.sizeLabel)),
    field(W.LABELS.language, value(ad.language)),
    field(W.LABELS.format, value(W.FORMAT_WORDS[ad.format])),
    field(W.LABELS.file, ad.file ? value(ad.file) : note(W.NOTES.noFile)),
    field(W.LABELS.subjects, subjects.length > 0 ? list(subjects) : note(W.NOTES.none)),
    changedHtml(report, ad),
    field(W.LABELS.agent, value(agent)),
    field(W.LABELS.translations, translationsHtml(ad)),
    field(W.LABELS.checks, checksHtml(report, ad)),
    field(W.LABELS.assets, assetsHtml(ad)),
    ad.failure === null
      ? ''
      : field(W.LABELS.failure, element('span', ad.failure, 'value failure')),
  ]
  return `<section class="ad">${pictureHtml(picture)}<div>${element('h3', ad.title, 'value')}${fields(rows)}</div></section>`
}
