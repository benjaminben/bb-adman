// DLG-7 (spec/phases/design-wave-screens-b.md, "DLG-7 — Review dialogs"): the report view uses
// kind="review". The counts are marks, the head facts a "Details" Section folded at first, the
// ads rows on the left and the picked ad's lines on the right. The export folder that
// report.get still sends never reaches the page: not as text, a title, a name or an attribute.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ReportView } from '@/renderer/dialogs/report-view'
import { sampleReport } from '../../../fixtures/report-sample'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { writeFold } from '@/renderer/ui/section/fold-memory'

const P = '01JD00000000000000000000P1'
const FOLDER = '/Users/someone/Exports/Harbour drop 7f3k'

async function openView() {
  const fake = makeFakeApi()
  fake.onQuery('report.get', () => ({
    ok: true,
    data: { report: sampleReport, outputDir: FOLDER },
  }))
  await renderApp(<ReportView projectId={P} reportId="R2" onClose={() => {}} />, fake)
  const dialog = screen.getByRole('dialog', { name: 'Export report' })
  await within(dialog).findByRole('list', { name: 'Ads' })
  return dialog
}

const FIRST = '<img src=x onerror=alert(1)>'

describe('the report view as a review dialog [DLG-7]', () => {
  beforeEach(() => writeFold('report.details', false))

  it('lists the ads on the left and shows the picked one on the right', async () => {
    const dialog = await openView()
    const list = within(dialog).getByRole('list', { name: 'Ads' })
    const rows = within(list).getAllByRole('button')
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      FIRST,
      'Spring fizz, French video',
      'Spring fizz, banner',
    ])
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    expect(within(dialog).getByRole('region', { name: FIRST })).toBeVisible()
    expect(within(dialog).queryByRole('region', { name: 'Spring fizz, banner' })).toBeNull()
    await userEvent.click(rows[2]!)
    expect(within(dialog).getByRole('region', { name: 'Spring fizz, banner' })).toHaveTextContent(
      'The ad could not be drawn.',
    )
    expect(within(dialog).queryByRole('region', { name: FIRST })).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it("marks each ad's outcome with its words as the tooltip", async () => {
    const dialog = await openView()
    const row = (name: string) => within(dialog).getByRole('listitem', { name })
    expect(within(row(FIRST)).getByTitle('Passed every check')).toBeInTheDocument()
    expect(within(row('Spring fizz, French video')).getByTitle('With warnings')).toBeTruthy()
    expect(within(row('Spring fizz, banner')).getByTitle('Failed')).toBeTruthy()
  })

  it('shows the counts as marks, the paid line on the page and the head facts folded', async () => {
    const dialog = await openView()
    const summary = within(dialog).getByRole('region', { name: 'Summary' })
    for (const [title, n] of [
      ['Exported', '2'],
      ['Passed every check', '1'],
      ['With warnings', '1'],
      ['Failed', '1'],
    ])
      expect(within(summary).getByTitle(title)).toHaveTextContent(n!)
    expect(dialog).toHaveTextContent('Paid generations: pictures 4, videos 1, text 7')
    const details = within(dialog).getByRole('button', { name: 'Details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    const audience = within(dialog).getByText('Adults who cycle to work')
    expect(audience).not.toBeVisible()
    await userEvent.click(details)
    expect(audience).toBeVisible()
  })

  it('puts nothing of the export folder on the page', async () => {
    const dialog = await openView()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Details' }))
    for (const row of within(dialog).getAllByRole('button')) await userEvent.hover(row)
    const html = document.body.innerHTML
    for (const part of ['/Users/someone', 'Exports', 'Harbour drop 7f3k', '7f3k'])
      expect(html).not.toContain(part)
  })
})
