// SPEC 14 1.46 TP-5 "Ticks", "The paid confirm line" and "One line for a local provider":
// the run sends the ticked IDs in tick order, and a paid run only after Confirm.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { baseState } from '../../fake-api'
import { LOCAL, P, renderWith, sent } from './campaign-fixture'
import { ref, referenceApi } from './reference-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const LOCAL_LINE =
  "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel."

async function panel() {
  return within(await screen.findByRole('region', { name: 'Make pictures' }))
}

async function tick(name: string) {
  await userEvent.click(await screen.findByRole('checkbox', { name }))
}

function runs(fake: ReturnType<typeof referenceApi>['fake']) {
  return sent(fake, 'generation.runImages').map((c) => c.input as { referenceAssetIds: string[] })
}

describe('Reference ticks [SPEC 14 1.46 TP-5]', () => {
  it('sends two ticked IDs in the order they were ticked, and shows each place', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    await renderWith(view, fake)
    await tick('A2.png')
    await tick('A1.png')
    const p = await panel()
    expect(within(p.getByRole('checkbox', { name: 'A2.png' }).closest('li')!).getByText('1'))
    expect(within(p.getByRole('checkbox', { name: 'A1.png' }).closest('li')!).getByText('2'))
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake).map((r) => r.referenceAssetIds)).toEqual([['A2', 'A1']])
  })

  it('sends an empty list with no tick', async () => {
    const { fake } = referenceApi([ref('A1')])
    await renderWith(view, fake)
    await screen.findByRole('checkbox', { name: 'A1.png' })
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    expect(p.getByText('This sends 4 paid request(s) to Google Gemini.')).toBeInTheDocument()
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake).map((r) => r.referenceAssetIds)).toEqual([[]])
  })

  it('removes an unticked ID', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    await renderWith(view, fake)
    await tick('A1.png')
    await tick('A2.png')
    await tick('A1.png')
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake).map((r) => r.referenceAssetIds)).toEqual([['A2']])
  })

  it('cannot tick a missing asset or a WebP asset, and says why', async () => {
    const { fake } = referenceApi([
      ref('M1', { missing: true }),
      ref('W1', { mime: 'image/webp', displayName: 'W1.webp' }),
    ])
    await renderWith(view, fake)
    const missing = await screen.findByRole('checkbox', { name: 'M1.png' })
    const webp = screen.getByRole('checkbox', { name: 'W1.webp' })
    expect(missing).toBeDisabled()
    expect(webp).toBeDisabled()
    expect(missing).toHaveAccessibleDescription('file not found')
    expect(webp).toHaveAccessibleDescription('WebP cannot be sent yet')
  })

  it('names the number of pictures from the held request, and sends nothing before Confirm', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    await renderWith(view, fake)
    await tick('A1.png')
    await tick('A2.png')
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    const line = 'This sends 4 paid request(s) and 2 reference picture(s) to Google Gemini.'
    expect(p.getByText(line)).toBeInTheDocument()
    await tick('A2.png')
    expect(p.getByText(line)).toBeInTheDocument()
    expect(sent(fake, 'generation.runImages')).toEqual([])
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake).map((r) => r.referenceAssetIds)).toEqual([['A1', 'A2']])
  })

  it('shows the local-provider line only with a tick and a local provider', async () => {
    const providers = [LOCAL, ...baseState().providers]
    const { fake } = referenceApi([ref('A1')], { state: { providers } })
    await renderWith(view, fake)
    const p = await panel()
    await screen.findByRole('checkbox', { name: 'A1.png' })
    expect(p.queryByText(LOCAL_LINE)).toBeNull()
    await tick('A1.png')
    expect(p.queryByText(LOCAL_LINE)).toBeNull()
    await userEvent.selectOptions(p.getByLabelText('Provider'), 'fake')
    expect(p.getByText(LOCAL_LINE)).toBeInTheDocument()
    await tick('A1.png')
    expect(p.queryByText(LOCAL_LINE)).toBeNull()
  })

  it('keeps the ticks when another variant is chosen', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    await renderWith(view, fake)
    await tick('A2.png')
    await userEvent.click(screen.getByRole('radio', { name: /German post/ }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'A2.png' })).toBeChecked())
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake)).toMatchObject([{ variantId: 'V2', referenceAssetIds: ['A2'] }])
  })

  it('drops the tick of an asset that left the list', async () => {
    const { fake, list } = referenceApi([ref('A1'), ref('A2')])
    await renderWith(view, fake)
    await tick('A1.png')
    await tick('A2.png')
    list.rows = [ref('A2')]
    await userEvent.click(screen.getByRole('radio', { name: /German post/ }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'A1.png' })).toBeNull())
    const p = await panel()
    expect(within(p.getByRole('checkbox', { name: 'A2.png' }).closest('li')!).getByText('1'))
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(runs(fake).map((r) => r.referenceAssetIds)).toEqual([['A2']])
  })
})
