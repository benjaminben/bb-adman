// One report's view [P8-12] (spec/phases/phase-08.md "Report", sections and words): drawn from
// report.get, the sections in the HTML file's order, every value as text, the folder as text.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ReportView } from '@/renderer/dialogs/report-view'
import { Report } from '@/shared/schemas/report'
import type { Result } from '@/shared/schemas/result'
import { sampleReport } from '../../../fixtures/report-sample'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'

const P = '01JD00000000000000000000P1'
const FOLDER = '/Users/me/Desktop/Spring <b>handover</b>'

async function openView(report: Report = sampleReport, reply?: Result<unknown>) {
  const fake = makeFakeApi()
  fake.onQuery('report.get', () => reply ?? { ok: true, data: { report, outputDir: FOLDER } })
  let closed = 0
  const view = await renderApp(
    <ReportView projectId={P} reportId="R2" onClose={() => (closed += 1)} />,
    fake,
  )
  const dialog = screen.getByRole('dialog', { name: 'Export report' })
  return { ...view, fake, dialog, closed: () => closed }
}

const section = (name: string) => screen.getByRole('region', { name })

describe('the report view [P8-12]', () => {
  it('reads the one report it shows', async () => {
    const { fake } = await openView()
    await screen.findByRole('region', { name: 'Summary' })
    expect(fake.queries).toContainEqual({
      name: 'report.get',
      input: { projectId: P, reportId: 'R2' },
    })
  })

  it('shows the sections in the HTML order, then one per ad', async () => {
    await openView()
    await screen.findByRole('region', { name: 'Summary' })
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'Summary',
      'Warnings exported past',
      'Asked for against delivered',
      '<img src=x onerror=alert(1)>',
      'Spring fizz, French video',
      'Spring fizz, banner',
    ])
  })

  it('shows the pictures note and the folder as plain text', async () => {
    const { dialog } = await openView()
    await screen.findByRole('region', { name: 'Summary' })
    expect(dialog).toHaveTextContent('Pictures of each ad are in the report file.')
    expect(dialog).toHaveTextContent(FOLDER)
    expect(dialog.querySelector('a, b, img')).toBeNull()
  })

  it('shows every header value with its words', async () => {
    const { dialog } = await openView()
    await screen.findByRole('region', { name: 'Summary' })
    for (const text of [
      'Spring Fizz Launch',
      'Northern Europe',
      'Adults who cycle to work',
      '01JCAMPAIGN0000000000000001',
      '2026-11-21 09:05 UTC',
      'name not set',
      'Typed by the user in Settings. Not checked.',
      '0.8.0',
      'pictures 4, videos 1, text 7',
    ])
      expect(dialog).toHaveTextContent(text)
  })

  it('shows the counts, the warnings exported past and the missing pairs', async () => {
    await openView()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    expect(summary).toHaveTextContent('Exported2Passed every check1With warnings1Failed1')
    expect(summary).not.toHaveTextContent('Checks were not run')
    const warnings = section('Warnings exported past')
    expect(warnings).toHaveTextContent('Headline contains “free”.')
    expect(warnings).toHaveTextContent('Prohibited words')
    expect(warnings).toHaveTextContent('2026-11-21 09:04 UTC')
    expect(warnings).toHaveTextContent('no reason given')
    const delivered = section('Asked for against delivered')
    expect(delivered).toHaveTextContent('Story 9:16')
    expect(delivered).toHaveTextContent('No ad was made for this size and language.')
  })

  it("shows each ad's fields with the report's words", async () => {
    await openView()
    await screen.findByRole('region', { name: 'Summary' })
    const first = section('<img src=x onerror=alert(1)>')
    expect(first).toHaveTextContent('Changed since export 1')
    expect(first).toHaveTextContent('no agent changes')
    expect(first).toHaveTextContent('Main language')
    expect(first).toHaveTextContent('Lemon can')
    expect(first).toHaveTextContent('01JCAMPAIGN0000000000000001/square-1-1/en/spring.jpg')
    expect(first).toHaveTextContent('Harbour background (01JASSET0000000000000000001)')
    expect(first).toHaveTextContent('(cut)')
    expect(first).toHaveTextContent('Text overflow: passed')
    const video = section('Spring fizz, French video')
    expect(video).toHaveTextContent('Not changed since export 1')
    expect(video).toHaveTextContent('last changed by an agent on 2026-11-19 22:15 UTC')
    expect(video).toHaveTextContent('headline: an agent, proposed, not approved')
    expect(video).toHaveTextContent('Video')
    expect(video).toHaveTextContent('bubbles rising </style><script>alert(1)</script>')
    const failed = section('Spring fizz, banner')
    expect(failed).toHaveTextContent('Not in export 1')
    expect(failed).toHaveTextContent('no file')
    expect(failed).toHaveTextContent('The ad could not be drawn.')
  })

  it('says the checks were not run when checksRun is false', async () => {
    const report = Report.parse({ ...sampleReport, checksRun: false })
    await openView(report)
    const summary = await screen.findByRole('region', { name: 'Summary' })
    expect(summary).toHaveTextContent('Checks were not run: not built in this version.')
    const first = section('<img src=x onerror=alert(1)>')
    expect(within(first).getByText('Checks were not run: not built in this version.')).toBeTruthy()
  })

  it('shows the name typed in Settings and a given reason', async () => {
    const report = Report.parse({
      ...sampleReport,
      exporter: { name: 'Sam Rivera' },
      proceeded: { by: 'Sam Rivera', at: '2026-11-21T09:04:00.000Z', reason: 'Client asked' },
    })
    const { dialog } = await openView(report)
    await screen.findByRole('region', { name: 'Summary' })
    expect(dialog).toHaveTextContent('Sam Rivera')
    expect(dialog).not.toHaveTextContent('name not set')
    expect(section('Warnings exported past')).toHaveTextContent('Client asked')
  })

  it('shows a refusal as text and closes with Close', async () => {
    const reply: Result<unknown> = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That report was not found.' },
    }
    const { closed } = await openView(sampleReport, reply)
    expect(await screen.findByRole('alert')).toHaveTextContent('That report was not found.')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed()).toBe(1)
  })

  it('has no accessibility problems', async () => {
    await openView()
    await screen.findByRole('region', { name: 'Summary' })
    expect(await axeViolations()).toEqual([])
  })
})
