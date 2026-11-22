// The export dialog [P8-11] (spec/phases/phase-08.md "The output folder", "Export run"): the
// ad ticks, the folder from the system picker only, the format controls, the sent input, one
// send per click, a refusal in the banner, then the progress and the end counts of the job.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignExport } from '@/renderer/screens/campaign/campaign-export'
import { OVERWRITE_NOTE } from '@/shared/export/messages'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, campaignGet } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import * as fx from './export-fixture'

const ticked = () =>
  screen
    .getAllByRole('checkbox')
    .filter((box) => (box as HTMLInputElement).checked)
    .map((box) => box.getAttribute('aria-label'))
    .filter((name) => name !== 'All ads')

describe('the export dialog [P8-11]', () => {
  it('opens with every ad ticked, no folder and Export disabled', async () => {
    const { dialog } = await fx.openExport()
    const ads = within(screen.getByRole('group', { name: 'Ads to export' }))
    for (const row of fx.ROWS) expect(ads.getByRole('checkbox', { name: row })).toBeChecked()
    expect(dialog).toHaveTextContent('No folder chosen')
    expect(dialog).toHaveTextContent(OVERWRITE_NOTE)
    const format = within(screen.getByRole('group', { name: 'Picture format' }))
    expect(format.getByRole('button', { name: 'PNG' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('spinbutton', { name: 'JPG quality' })).toBeNull()
    expect(fx.button('Export')).toBeDisabled()
    expect(await axeViolations()).toEqual([])
  })

  it('sends nothing when the folder picker is cancelled', async () => {
    const { fake, dialog } = await fx.openExport([], [null])
    await fx.chooseFolder()
    expect(fake.queries).toContainEqual({
      name: 'dialog.pickFolder',
      input: { title: 'Export to' },
    })
    expect(dialog).toHaveTextContent('No folder chosen')
    expect(fx.button('Export')).toBeDisabled()
    expect(fx.exportsSent(fake)).toEqual([])
  })

  it('shows the picked folder, sends nothing before the click, then the whole input', async () => {
    const { fake, dialog } = await fx.openExport()
    await fx.chooseFolder()
    expect(dialog).toHaveTextContent('Summer handover')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(fx.exportsSent(fake)).toEqual([])
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input()])
  })

  it('sends only the ticked ads; All ads unticks (Export disabled) and ticks every ad', async () => {
    const { fake } = await fx.openExport()
    await fx.chooseFolder()
    await userEvent.click(screen.getByRole('checkbox', { name: 'All ads' }))
    expect(ticked()).toEqual([])
    expect(fx.button('Export')).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'All ads' }))
    expect(ticked()).toEqual(fx.ROWS)
    await userEvent.click(screen.getByRole('checkbox', { name: fx.ROWS[1] }))
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input({ variantIds: ['V1', 'V3'] })])
  })

  it('shows JPG quality for JPG and sends the format and quality chosen', async () => {
    const { fake } = await fx.openExport()
    await fx.chooseFolder()
    await fx.click('JPG')
    const quality = screen.getByRole('spinbutton', { name: 'JPG quality' })
    expect(quality).toHaveValue(90)
    await userEvent.clear(quality)
    await userEvent.type(quality, '75')
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input({ imageFormat: 'jpg', jpgQuality: 75 })])
  })

  it('shows Frames per second only while a video ad is ticked', async () => {
    const { fake } = await fx.openExport()
    await fx.chooseFolder()
    const fps = screen.getByRole('combobox', { name: 'Frames per second' })
    expect(fps).toHaveValue('30')
    await userEvent.selectOptions(fps, '60')
    await userEvent.click(screen.getByRole('checkbox', { name: fx.ROWS[2] }))
    expect(screen.queryByRole('combobox', { name: 'Frames per second' })).toBeNull()
    await userEvent.click(screen.getByRole('checkbox', { name: fx.ROWS[2] }))
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input({ fps: 60 })])
  })

  it('sends once per click: Export stays disabled until the reply', async () => {
    let finish: (r: Result<unknown>) => void = () => {}
    const held = new Promise<Result<unknown>>((resolve) => (finish = resolve))
    const { fake } = await fx.openExport([held])
    await fx.chooseFolder()
    await fx.click('Export')
    expect(fx.button('Export')).toBeDisabled()
    await userEvent.click(fx.button('Export'))
    expect(fx.exportsSent(fake)).toHaveLength(1)
    finish(fx.STARTED)
    const bar = await screen.findByRole('progressbar', { name: 'Exporting' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows a refusal other than the warnings in the error banner and stays ready', async () => {
    const { store } = await fx.openExport([fx.RUNNING])
    await fx.chooseFolder()
    await fx.click('Export')
    const banner = 'This campaign is already being exported. Wait for it to finish.'
    await waitFor(() => expect(store.getState().error).toBe(banner))
    expect(fx.button('Export')).toBeEnabled()
    expect(ticked()).toEqual(fx.ROWS)
  })

  it('follows its own job: the percent, then the end counts and Close', async () => {
    const { fake, dialog } = await fx.openExport()
    await fx.chooseFolder()
    await fx.click('Export')
    await screen.findByRole('progressbar', { name: 'Exporting' })
    const row = { kind: 'export' as const, variantId: null, provider: 'adman' }
    fake.emit('job.updated', jobRow('J8', { ...row, status: 'running', progress: 0.9 }))
    fake.emit('job.updated', jobRow('J9', { ...row, status: 'running', progress: 0.416 }))
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42'),
    )
    const result = { exported: 2, failed: 1, reportId: 'R1' }
    fake.emit('job.updated', jobRow('J9', { ...row, status: 'succeeded', progress: 1, result }))
    expect(await screen.findByText('2 exported')).toBeInTheDocument()
    expect(within(dialog).getByText('1 failed')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(fx.button('Close')).toBeEnabled()
  })

  it('can be used by keyboard alone, every control labelled', async () => {
    const { fake } = await fx.openExport()
    screen.getByRole('button', { name: 'Choose folder…' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findByText('Summer handover')
    fx.button('Export').focus()
    await userEvent.keyboard('{Enter}')
    expect(fx.exportsSent(fake)).toEqual([fx.input()])
  })

  it('opens from Export… on the campaign page and closes with Cancel, having sent nothing', async () => {
    const fake = makeFakeApi()
    fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet(fx.ADS) }))
    await renderApp(<CampaignExport projectId={P} campaignId="C1" />, fake)
    expect(screen.queryByRole('dialog')).toBeNull()
    await fx.click('Export…')
    expect(await screen.findByRole('checkbox', { name: fx.ROWS[0] })).toBeChecked()
    await fx.click('Cancel')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fake.commands).toEqual([])
  })
})
