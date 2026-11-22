// Lows C (spec/data-rules.md, "Fan-out", step 7): the fan-out dialog's "Formats" group. Image
// starts ticked, Video not; at least one stays ticked, else "Make variants" is disabled with
// "Choose at least one format."; the ticked formats go in the order image, video, and the count
// line counts each new size, language and format once, as variant.fanOut does.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, campaignGet, sent, variant } from '../screens/campaign/campaign-fixture'

const MASTER = variant('V1', { title: 'Master post', isMaster: true, sizeLabel: '1x1' })

function data(): CampaignGet {
  const base = campaignGet([MASTER])
  const sizes = [
    { label: '1x1', width: 1080, height: 1080 },
    { label: '9x16', width: 1080, height: 1920 },
  ]
  return {
    ...base,
    campaign: { ...base.campaign, sizes, languages: ['en', 'de'] },
    directions: [{ id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 }],
  }
}

async function open() {
  const fake = makeFakeApi(baseState())
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: { variant: MASTER, campaignId: 'C1', layers: [], assets: [] },
  }))
  fake.onCommand('variant.fanOut', () => ({ ok: true, data: { variantIds: ['V2'], fill: [] } }))
  await renderApp(
    <main>
      <h1>Summer Splash</h1>
      <FanOutButton projectId={P} campaign={data()} direction={data().directions[0]!} />
    </main>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Fan out…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Fan out Beach day' })
  return { fake, dialog }
}

const box = (name: string) => screen.getByRole('checkbox', { name })
const tick = (name: string) => userEvent.click(box(name))
const make = () => screen.getByRole('button', { name: 'Make variants' })

async function formatsSent(fake: Awaited<ReturnType<typeof open>>['fake']) {
  await userEvent.click(make())
  await waitFor(() => expect(sent(fake, 'variant.fanOut')).toHaveLength(1))
  return (sent(fake, 'variant.fanOut')[0]?.input as { formats: string[] }).formats
}

describe('Fan-out dialog, formats [lows C, data-rules fan-out step 7]', () => {
  it('draws a Formats group after Languages, Image ticked and Video not', async () => {
    const { dialog } = await open()
    const groups = within(dialog).getAllByRole('group')
    expect(groups.map((g) => g.querySelector('legend')?.textContent)).toEqual([
      'Sizes',
      'Languages',
      'Formats',
    ])
    const formats = within(dialog).getByRole('group', { name: 'Formats' })
    expect(formats.tagName).toBe('FIELDSET')
    expect(within(formats).getByRole('checkbox', { name: 'Image' })).toBeChecked()
    expect(within(formats).getByRole('checkbox', { name: 'Video' })).not.toBeChecked()
    expect(await axeViolations()).toEqual([])
  })

  it('reaches Image then Video by keyboard after the languages', async () => {
    await open()
    box('de').focus()
    await userEvent.tab()
    expect(box('Image')).toHaveFocus()
    await userEvent.tab()
    expect(box('Video')).toHaveFocus()
  })

  it('sends images only by default', async () => {
    const { fake } = await open()
    await tick('de')
    expect(await formatsSent(fake)).toEqual(['image'])
  })

  it('sends image and video, in that order, once Video is ticked', async () => {
    const { fake } = await open()
    await tick('Video')
    expect(await formatsSent(fake)).toEqual(['image', 'video'])
  })

  it('sends video only when Image is unticked with Video ticked', async () => {
    const { fake } = await open()
    await tick('Video')
    await tick('Image')
    expect(await formatsSent(fake)).toEqual(['video'])
  })

  it('disables "Make variants" with no format ticked and says why', async () => {
    const { dialog, fake } = await open()
    await tick('de')
    await tick('Image')
    expect(make()).toBeDisabled()
    expect(within(dialog).getByText('Choose at least one format.')).toBeVisible()
    await userEvent.click(make())
    expect(fake.commands).toEqual([])
    await tick('Video')
    expect(make()).toBeEnabled()
    expect(within(dialog).queryByText('Choose at least one format.')).toBeNull()
  })

  it('counts each new size and language once per ticked format', async () => {
    const { dialog } = await open()
    await tick('de')
    expect(within(dialog).getByText('This makes 1 variant(s).')).toBeInTheDocument()
    await tick('Video')
    expect(within(dialog).getByText('This makes 3 variant(s).')).toBeInTheDocument()
    await tick('9x16 (1080×1920)')
    expect(within(dialog).getByText('This makes 7 variant(s).')).toBeInTheDocument()
  })
})
