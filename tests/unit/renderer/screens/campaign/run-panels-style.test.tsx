// ST-12 (spec/app-style.md "Component by component", "Campaign page, grid and tiles"): the
// slot view and the run panels are cards; the paid confirm line is an info notice with a
// hidden icon, its words as given and its two buttons in their order; run rows are drawn as
// table rows; results sit on the soft ground. Every CSS module of these folders is marked.
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { PaidConfirm, paidLine } from '@/renderer/screens/campaign/paid-confirm/paid-confirm'
import layout from '@/renderer/ui/layout.module.css'
import rowStyles from '@/renderer/screens/campaign/run-row/run-row.module.css'
import resultStyles from '@/renderer/screens/campaign/run-result/run-result.module.css'
import { jobRow } from '../../stores/job-fixture'
import { P, campaignApi, renderWith } from './campaign-fixture'

const CAMPAIGN = path.resolve('src/renderer/screens/campaign')
const FOLDERS = [
  'slot-view',
  'generate-panel',
  'paid-confirm',
  'run-list',
  'run-row',
  'run-result',
  'video-picture-choice',
  'video-result',
  'provider-select',
]
const MODULES = ['paid-confirm', 'run-row', 'run-result', 'slot-view', 'video-picture-choice']

const cssIn = (folder: string): string[] =>
  fs
    .readdirSync(path.join(CAMPAIGN, folder))
    .filter((name) => name.endsWith('.css'))
    .map((name) => path.join(CAMPAIGN, folder, name))

const A1 = '01JD00000000000000000000A1'

describe('campaign run panels: the app style [ST-12]', () => {
  it('marks every CSS module of the run panel and slot view folders', () => {
    for (const folder of MODULES) expect(cssIn(folder), folder).not.toEqual([])
    for (const file of FOLDERS.flatMap(cssIn)) {
      expect(fs.readFileSync(file, 'utf8').split('\n')[0], file).toBe('/* app-style */')
    }
  })

  it('draws the paid confirm line as an info notice, words and buttons unchanged', () => {
    render(
      <PaidConfirm
        count={2}
        providerLabel="Made-up Cloud"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    const text = paidLine(2, 'Made-up Cloud')
    const line = screen.getByText(text).parentElement!
    expect(line).toHaveClass(layout.notice as string, layout.info as string)
    expect(line.textContent).toBe(`${text}ConfirmCancel`)
    expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(
      within(line)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Confirm', 'Cancel'])
  })

  it('draws run rows as table rows and results on the soft ground', async () => {
    const done = jobRow('J1', { status: 'succeeded', result: { assetIds: [A1], failures: {} } })
    const failed = jobRow('J2', { status: 'failed' })
    await renderWith(
      <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
      campaignApi({ jobs: [done, failed] }),
    )
    const list = await screen.findByRole('list', { name: 'Runs' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toHaveClass(rowStyles.row as string)
      expect(row).not.toHaveClass(layout.card as string)
    }
    const picture = await within(list).findByRole('img', { name: 'Result 1' })
    expect(picture.parentElement).toHaveClass(resultStyles.results as string)
  })

  it('draws the slot view as a card', async () => {
    await renderWith(
      <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
      campaignApi({ jobs: [] }),
    )
    expect(await screen.findByRole('region', { name: 'Slots' })).toHaveClass(layout.card as string)
  })
})
