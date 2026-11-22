import { describe, it, expect } from 'vitest'
import { reportHtml } from '@/main/export/report/html'
import type { Report } from '@/shared/schemas/report'
import { LONG_PROMPT, samplePictures, sampleReport } from '../../../../fixtures/report-sample'

const CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'">'

const page = reportHtml(sampleReport, samplePictures)

function withChanges(changes: Partial<Report>): string {
  return reportHtml({ ...sampleReport, ...changes }, samplePictures)
}

describe('reportHtml: what the page may hold [FR-233, A-203]', () => {
  it('carries the content security policy exactly as the design gives it', () => {
    expect(page).toContain(CSP)
    expect(page.indexOf(CSP)).toBeLessThan(page.indexOf('<style>'))
  })

  it('holds no script, no link and no source but an inline JPEG', () => {
    expect(page.toLowerCase()).not.toContain('<script')
    expect(page.toLowerCase()).not.toContain('href')
    expect(page.toLowerCase()).not.toContain('<a ')
    expect(page.toLowerCase()).not.toContain('url(')
    expect(page.toLowerCase()).not.toContain('@import')
    // Inside tags only: escaped text such as a title may say "src=" as words.
    const tags = page.match(/<[^>]+>/g) ?? []
    const sources = tags.flatMap((tag) => tag.match(/src=[^>\s]*/gi) ?? [])
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) expect(source).toMatch(/^src="data:image\/jpeg;base64,/)
  })

  it('shows a title made of markup as text', () => {
    expect(page).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(page).not.toContain('<img src=x')
  })

  it('shows a prompt that closes the style element as text', () => {
    expect(page).toContain('bubbles rising &lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(page.match(/<\/style>/g)).toHaveLength(1)
  })

  it('has one picture for each ad that has one, as the bytes given', () => {
    const images = page.match(/<img [^>]*>/g) ?? []
    expect(images).toHaveLength(2)
    const first = Buffer.from(samplePictures.get('01JVARIANT00000000000000001')!).toString('base64')
    expect(images[0]).toContain(`src="data:image/jpeg;base64,${first}"`)
  })
})

describe('reportHtml: order and words [FR-231, FR-233]', () => {
  it('puts the header, summary, warnings, asked for against delivered, then each ad in order', () => {
    const marks = [
      'Spring Fizz Launch',
      'Summary',
      'Warnings exported past',
      'Asked for against delivered',
      '01JVARIANT00000000000000001',
      '01JVARIANT00000000000000002',
      '01JVARIANT00000000000000003',
    ].map((mark) => page.indexOf(mark))
    expect(marks.every((at) => at >= 0)).toBe(true)
    expect([...marks].sort((a, b) => a - b)).toEqual(marks)
    expect(page.indexOf('Summary')).toBeLessThan(page.indexOf('<section class="ad"'))
  })

  it('shows the header facts', () => {
    for (const text of [
      'Northern Europe',
      'Adults who cycle to work',
      '01JCAMPAIGN0000000000000001',
      'Typed by the user in Settings. Not checked.',
      '0.8.0',
      'pictures 4, videos 1, text 7',
    ])
      expect(page).toContain(text)
  })

  it('says "name not set" and "no reason given" when there is none', () => {
    expect(page).toContain('name not set')
    expect(page).toContain('no reason given')
    const named = withChanges({
      exporter: { name: 'Avery Example' },
      proceeded: { by: 'Avery Example', at: '2026-11-21T09:04:00.000Z', reason: 'Legal agreed' },
    })
    expect(named).not.toContain('name not set')
    expect(named).not.toContain('no reason given')
    expect(named).toContain('Legal agreed')
  })

  it('says "no agent changes" or the date of the last one', () => {
    expect(page).toContain('no agent changes')
    expect(page).toContain('last changed by an agent on 2026-11-19 22:15 UTC')
  })

  it('shows every time as YYYY-MM-DD HH:mm UTC', () => {
    expect(page).toContain('2026-11-21 09:05 UTC')
    expect(page).toContain('2026-11-21 09:04 UTC')
    expect(page).not.toContain('T09:05')
  })

  it('cuts a prompt over 2,000 characters with "(cut)"', () => {
    expect(LONG_PROMPT).toHaveLength(3000)
    expect(page).toContain(`${LONG_PROMPT.slice(0, 2000)} (cut)`)
    expect(page).not.toContain(LONG_PROMPT.slice(0, 2001))
  })

  it('shows changed since, translations, the missing pair and the failure', () => {
    for (const text of [
      'Changed since export 1',
      'Not changed since export 1',
      'Not in export 1',
      'Main language',
      'an agent',
      'proposed, not approved',
      'No ad was made for this size and language.',
      'The ad could not be drawn.',
      'Headline contains “free”.',
    ])
      expect(page).toContain(text)
  })

  it('says the checks were not run when they were not', () => {
    expect(page).not.toContain('Checks were not run: not built in this version.')
    expect(withChanges({ checksRun: false })).toContain(
      'Checks were not run: not built in this version.',
    )
  })

  it('marks a warning that appeared after the export was started', () => {
    const late = withChanges({
      warningsExportedPast: [{ ...sampleReport.warningsExportedPast[0]!, seenBeforeExport: false }],
    })
    expect(late).toContain('This warning appeared after the export was started.')
    expect(page).not.toContain('This warning appeared after the export was started.')
  })
})
