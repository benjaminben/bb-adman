// The campaign's reports [P8-12] (spec/phases/phase-08.md "Report", queries): "Reports" opens
// the list from report.list, newest first, read again on project.changed for the project and
// when an export job of the campaign ends; "Open" shows that report's view.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ReportListItem } from '@/shared/schemas/queries/report'
import { sampleReport } from '../../../../fixtures/report-sample'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { P } from './campaign-fixture'
import { ReportsOpener } from './reports-opener'

const FOLDER = '/Users/me/Desktop/Spring <i>handover</i>'

const item = (n: number, over: Partial<ReportListItem> = {}): ReportListItem => ({
  reportId: `R${n}`,
  createdAt: `2026-11-2${n}T09:05:42.123Z`,
  exportNumber: n,
  outputDir: FOLDER,
  summary: { exported: 3, passedAll: 2, withWarnings: 1, failed: n - 1 },
  ...over,
})

const ROW_2 = 'Export 2…'
const ROW_1 = 'Export 1…'

async function openList(answers: ReportListItem[][] = [[item(2), item(1)]]) {
  const fake = makeFakeApi()
  const replies = [...answers]
  let last: ReportListItem[] = []
  fake.onQuery('report.list', () => {
    last = replies.shift() ?? last
    return { ok: true, data: last }
  })
  fake.onQuery('report.get', () => ({
    ok: true,
    data: { report: sampleReport, outputDir: FOLDER },
  }))
  const view = await renderApp(<ReportsOpener projectId={P} campaignId="C1" />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Reports' }))
  const dialog = screen.getByRole('dialog', { name: 'Reports' })
  return { ...view, fake, dialog }
}

const rows = async () => {
  const list = await screen.findByRole('list', { name: 'Reports' })
  return within(list)
    .getAllByRole('button')
    .map((row) => row.getAttribute('aria-label'))
}
const lists = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'report.list')

describe('the reports list [P8-12]', () => {
  it("reads the campaign's reports and shows them newest first", async () => {
    const { fake } = await openList()
    expect(await rows()).toEqual([ROW_2, ROW_1])
    expect(lists(fake)[0]?.input).toEqual({ projectId: P, campaignId: 'C1' })
    expect(document.querySelector('[role="dialog"] a, [role="dialog"] i')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('says "No exports yet" when the campaign has none', async () => {
    const { dialog } = await openList([[]])
    expect(await within(dialog).findByText('No exports yet')).toBeTruthy()
  })

  it('reads again on project.changed for its project only', async () => {
    const { fake } = await openList([[item(1)], [item(2), item(1)]])
    expect(await rows()).toEqual([ROW_1])
    act(() =>
      fake.emit('project.changed', { projectId: 'OTHER', changed: {}, removed: {}, actor: 'user' }),
    )
    expect(lists(fake)).toHaveLength(1)
    act(() =>
      fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' }),
    )
    await screen.findByRole('button', { name: ROW_2 })
    expect(lists(fake)).toHaveLength(2)
  })

  it('reads again when an export job of this campaign ends, not before', async () => {
    const { fake } = await openList([[item(1)], [item(2), item(1)]])
    await rows()
    const job = (over: Parameters<typeof jobRow>[1]) =>
      act(() => fake.emit('job.updated', jobRow('J1', { kind: 'export', ...over })))
    job({ status: 'running' })
    job({ status: 'succeeded', campaignId: 'C2' })
    job({ status: 'succeeded', kind: 'image_generation' })
    expect(lists(fake)).toHaveLength(1)
    job({ status: 'succeeded' })
    await screen.findByRole('button', { name: ROW_2 })
    job({ status: 'failed' })
    expect(lists(fake)).toHaveLength(3)
  })

  it("opens a report's view with a click on its row", async () => {
    const { fake } = await openList()
    await rows()
    await userEvent.click(screen.getByRole('button', { name: ROW_1 }))
    expect(await screen.findByRole('dialog', { name: 'Export report' })).toBeTruthy()
    expect(fake.queries).toContainEqual({
      name: 'report.get',
      input: { projectId: P, reportId: 'R1' },
    })
  })
})
