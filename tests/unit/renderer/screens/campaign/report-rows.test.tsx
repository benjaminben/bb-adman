// CAMP-6 (spec/phases/design-wave-screens-b.md, "CAMP-6 — Reports"): each export is one
// ObjectRow, "Export {n}" with its time and marks for files written and failed; a click or
// Enter opens the report (report.get, nothing written). Only the folder's base name appears,
// in the row's title. Empty: "No exports yet" with "Export…", which opens the export dialog.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignExport } from '@/renderer/screens/campaign/campaign-export'
import type { ReportListItem } from '@/shared/schemas/queries/report'
import { sampleReport } from '../../../../fixtures/report-sample'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { P } from './campaign-fixture'

const POSIX = '/Users/me/Desktop/Spring handover'
const WINDOWS = 'C:\\Exports\\Autumn launch\\'

const item = (n: number, outputDir: string, failed: number): ReportListItem => ({
  reportId: `R${n}`,
  createdAt: `2026-11-2${n}T09:05:42.123Z`,
  exportNumber: n,
  outputDir,
  summary: { exported: 3, passedAll: 2, withWarnings: 1, failed },
})

async function openList(
  reply: ReportListItem[] | Error = [item(2, WINDOWS, 1), item(1, POSIX, 0)],
) {
  const fake = makeFakeApi()
  fake.onQuery('report.list', () =>
    reply instanceof Error
      ? { ok: false, error: { code: 'INTERNAL', message: reply.message } }
      : { ok: true, data: reply },
  )
  fake.onQuery('report.get', () => ({
    ok: true,
    data: { report: sampleReport, outputDir: POSIX },
  }))
  fake.onQuery('campaign.get', () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }))
  await renderApp(<CampaignExport projectId={P} campaignId="C1" />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Reports' }))
  const dialog = screen.getByRole('dialog', { name: 'Reports' })
  return { fake, dialog }
}

// Every attribute value and every text node of an element.
function allStrings(root: Element): string[] {
  const out: string[] = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of el.attributes) out.push(attr.value)
  }
  out.push(root.textContent ?? '')
  return out
}

describe('the reports rows [CAMP-6]', () => {
  it('draws one row per export, named "Export {n}…", with the time and its marks', async () => {
    const { dialog } = await openList()
    const list = await within(dialog).findByRole('list', { name: 'Reports' })
    const rows = within(list).getAllByRole('button')
    expect(rows.map((b) => b.getAttribute('aria-label'))).toEqual(['Export 2…', 'Export 1…'])
    const [second, first] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement]
    expect(second).toHaveTextContent('Export 2')
    expect(second).toHaveTextContent('2026-11-22 09:05 UTC')
    expect(within(second).getByTitle('3 files written')).toHaveTextContent('3')
    expect(within(second).getByTitle('1 file failed')).toHaveTextContent('1 failed')
    expect(within(first).queryByTitle(/failed/)).toBeNull()
    expect(within(first).queryByText(/failed/)).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it("gives only the folder's base name, in the row's title, and no path anywhere", async () => {
    const { dialog } = await openList()
    const list = await within(dialog).findByRole('list', { name: 'Reports' })
    const [second, first] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement]
    expect(second.querySelector('[title="Autumn launch"]')).not.toBeNull()
    expect(first.querySelector('[title="Spring handover"]')).not.toBeNull()
    for (const text of allStrings(dialog)) {
      expect(text).not.toMatch(/[\\/](Users|me|Desktop|Exports|Spring|Autumn)/)
      expect(text).not.toContain('C:')
    }
  })

  it('opens the report with a click or with Enter, sending only report.get', async () => {
    const { fake, dialog } = await openList()
    const list = await within(dialog).findByRole('list', { name: 'Reports' })
    await userEvent.click(within(list).getByRole('button', { name: 'Export 1…' }))
    expect(await screen.findByRole('dialog', { name: 'Export report' })).toBeTruthy()
    expect(fake.queries).toContainEqual({
      name: 'report.get',
      input: { projectId: P, reportId: 'R1' },
    })
    await userEvent.keyboard('{Escape}')
    within(list).getByRole('button', { name: 'Export 2…' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: 'Export report' })
    expect(fake.queries).toContainEqual({
      name: 'report.get',
      input: { projectId: P, reportId: 'R2' },
    })
    expect(fake.commands).toEqual([])
  })

  it('offers "Export…" when there is none, which opens the export dialog only', async () => {
    const { fake, dialog } = await openList([])
    expect(await within(dialog).findByText('No exports yet')).toBeTruthy()
    expect(await axeViolations()).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Export…' }))
    expect(await screen.findByRole('dialog', { name: 'Export campaign' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Reports' })).toBeNull()
    expect(fake.commands).toEqual([])
  })

  it('keeps a refused read visible as words', async () => {
    const { dialog } = await openList(new Error('The reports could not be read.'))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('The reports could not be read.')
  })
})
