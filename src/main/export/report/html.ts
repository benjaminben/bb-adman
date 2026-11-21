// The export report as one self-contained HTML file (spec/phases/phase-08.md "Report", HTML
// [FR-233, A-203, A-206]). No script, no link, nothing loaded from anywhere: the content security
// policy allows only inline style and data: pictures. Order: header, summary, warnings exported
// past, asked for against delivered, then one section per ad.
import type { Report } from '@/shared/schemas/report'
import { element } from './escape'
import { adPart, deliveredPart, headerPart, summaryPart, warningsPart } from './html-parts'
import { HEADINGS } from './html-words'
import { REPORT_CSS } from './report.css'

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">`

// `pictures`: each ad's JPEG (longest side 240) by variant ID; an ad with none shows no picture.
export function reportHtml(report: Report, pictures: ReadonlyMap<string, Uint8Array>): string {
  const ads = report.variants.map((ad) => adPart(report, ad, pictures.get(ad.variantId)))
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    CSP,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    element('title', `${HEADINGS.page}: ${report.campaignName}`),
    `<style>${REPORT_CSS}</style>`,
    '</head>',
    '<body>',
    headerPart(report),
    summaryPart(report),
    warningsPart(report),
    deliveredPart(report),
    ...ads,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
