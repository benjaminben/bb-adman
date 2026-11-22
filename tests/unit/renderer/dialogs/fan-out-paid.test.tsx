// DLG-4b (C-15): in the fan-out dialog "Make {n} variants" is the one click that pays. The cost
// lines (MoneyLines when paid) are last above the foot and in the dialog's description, and
// follow each chip; nothing is sent before the click; one click sends one fan-out, whose input
// agrees with the words on screen at that click. No provider is called: the fake API answers.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { FanOutFit } from '@/shared/schemas/links'
import { costLine, spoken } from '../cost-line'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { LOCAL, P, campaignGet, sent, variant } from '../screens/campaign/campaign-fixture'
import { heldReply } from '../screens/campaign/held-reply'

const MASTER = variant('V1', { title: 'Master post', isMaster: true, sizeLabel: '1x1' })
const FAKE_TEXT: ProviderInfo = { ...LOCAL, label: 'Fake provider', jobs: ['image', 'text'] }
const SIZES = [
  { label: '1x1', width: 1080, height: 1080 },
  { label: '9x16', width: 1080, height: 1920 },
  { label: '16x9', width: 1920, height: 1080 },
]
const TALL = '9x16 (1080×1920)'
const WIDE = '16x9 (1920×1080)'
const FILL = 'Generate fill: extend the picture with AI'
const MAKE = /^Make (\d+ )?variants?$/

function data(extra: VariantSummary[] = []): CampaignGet {
  const base = campaignGet([MASTER, ...extra])
  return {
    ...base,
    campaign: { ...base.campaign, sizes: SIZES, languages: ['en', 'de', 'fr'] },
    directions: [{ id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 }],
  }
}

type Ask = { text?: string; providers?: ProviderInfo[]; extra?: VariantSummary[] }

function api(ask: Ask = {}) {
  const base = baseState()
  const settings = {
    ...base.settings,
    defaultProviders: { ...base.settings.defaultProviders, text: ask.text ?? 'gemini' },
  }
  const providers = ask.providers ?? [...base.providers, FAKE_TEXT]
  const fake = makeFakeApi(baseState({ settings, providers }))
  const layers = [{ id: 'L1', type: 'background', source: { assetId: 'A1' } }]
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: { variant: MASTER, campaignId: 'C1', layers, assets: [] },
  }))
  return fake
}

// The words that describe the dialog, read when variant.fanOut arrives: what was on screen at
// the click.
function described() {
  const ids = screen.getByRole('dialog').getAttribute('aria-describedby') ?? ''
  return ids.split(' ').map((id) => document.getElementById(id)?.textContent ?? '')
}

async function open(ask: Ask = {}) {
  const fake = api(ask)
  const atClick: string[][] = []
  fake.onCommand('variant.fanOut', () => {
    atClick.push(described())
    return { ok: true, data: { variantIds: ['V2'], fill: [] } }
  })
  const campaign = data(ask.extra)
  await renderApp(
    <main>
      <h1>Summer Splash</h1>
      <FanOutButton projectId={P} campaign={campaign} direction={campaign.directions[0]!} />
    </main>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Fan out…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Fan out Beach day' })
  return { fake, dialog, atClick }
}

const chip = (name: string) => screen.getByRole('button', { name })
const press = (name: string) => userEvent.click(chip(name))
const make = () => screen.getByRole('button', { name: MAKE })
const shownCount = () => Number(/\d+/.exec(make().textContent ?? '')?.[0] ?? 0)
const fill = (size: string) =>
  userEvent.click(
    within(screen.getByRole('group', { name: `Background for ${size}` })).getByRole('radio', {
      name: FILL,
    }),
  )
type Sent = { sizes: string[]; languages: string[]; formats: string[] }
type Fits = Record<string, FanOutFit>
const inputOf = (fake: ReturnType<typeof api>) =>
  sent(fake, 'variant.fanOut')[0]?.input as Sent & { fits: Fits }

describe('Fan-out, the paid click [DLG-4b, C-15]', () => {
  it('sends nothing on open, on chips, fits or provider; one click sends one fan-out', async () => {
    const { fake } = await open()
    const held = heldReply()
    fake.onCommand('variant.fanOut', held.answer)
    await press(TALL)
    await press('de')
    await press('Video')
    await fill(TALL)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'fake')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'gemini')
    expect(fake.commands).toEqual([])
    await userEvent.click(make())
    expect(make()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.click(make())
    expect(sent(fake, 'variant.fanOut')).toHaveLength(1)
    expect(fake.commands.map((c) => c.name)).toEqual(['variant.fanOut'])
    held.release({ ok: true, data: { variantIds: ['V2'], fill: [] } })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it.each([
    [[TALL], 1],
    [['de'], 1],
    [[TALL, WIDE, 'de'], 5],
    [[TALL, 'de', 'fr', 'Video'], 11],
    [['Video', 'Image', 'de'], 2],
  ])('after %j the button names %i variants, as many as the input asks for', async (taps, n) => {
    const { fake } = await open()
    for (const name of taps) await press(name)
    expect(shownCount()).toBe(n)
    expect(make()).toHaveTextContent(n === 1 ? 'Make 1 variant' : `Make ${n} variants`)
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'variant.fanOut')).toHaveLength(1))
    const { sizes, languages, formats } = inputOf(fake)
    const masterImage = formats.includes('image') ? 1 : 0
    expect(sizes.length * languages.length * formats.length - masterImage).toBe(n)
  })

  it('names the fills and the provider the select shows, and they are what is sent', async () => {
    const { fake, dialog, atClick } = await open()
    await press(TALL)
    await press(WIDE)
    await fill(TALL)
    expect(screen.getByText(costLine('Paid: 1 fill → Google Gemini'))).toBeVisible()
    await fill(WIDE)
    const paid = 'Paid: 2 fills → Google Gemini'
    expect(screen.getByText(costLine(paid))).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(spoken(paid))
    const select = screen.getByRole('combobox', { name: 'Provider' })
    await userEvent.selectOptions(select, 'fake')
    expect(screen.queryByText(costLine(paid))).toBeNull()
    expect(within(dialog).queryByText(/Paid/)).toBeNull()
    expect(within(dialog).getByText('2 fills on Fake provider. Nothing is charged.')).toBeVisible()
    await userEvent.selectOptions(select, 'gemini')
    fake.onCommand('generation.runFill', () => ({ ok: true, data: { jobId: 'J7' } }))
    fake.onCommand('variant.fanOut', () => {
      atClick.push(described())
      const fills = [
        { sizeLabel: '9x16', variantId: 'V2' },
        { sizeLabel: '16x9', variantId: 'V3' },
      ]
      return { ok: true, data: { variantIds: ['V2', 'V3'], fill: fills } }
    })
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'generation.runFill')).toHaveLength(2))
    expect(atClick).toEqual([[spoken(paid)]])
    const fits = Object.values(inputOf(fake).fits).filter((f) => f === 'fill')
    expect(fits).toHaveLength(2)
    const providers = sent(fake, 'generation.runFill').map((c) => c.input)
    expect(providers).toMatchObject([{ provider: 'gemini' }, { provider: 'gemini' }])
  })

  it('counts no fill for a size whose master-language variant exists, as variant.fanOut', async () => {
    const tallEn = variant('V5', { sizeLabel: '9x16', width: 1080, height: 1920 })
    const { dialog } = await open({ text: 'fake', extra: [tallEn] })
    await press(TALL)
    await press('de')
    await fill(TALL)
    expect(within(dialog).queryByText(/Paid|fills? on/)).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Provider' })).toBeNull()
    await press('Video')
    expect(screen.getByText(costLine('Paid: 1 fill → Google Gemini'))).toBeVisible()
    expect(within(dialog).getAllByText(/Paid/)).toHaveLength(1)
  })

  it('names the translations and the text provider, following the language chips', async () => {
    const { dialog, atClick } = await open()
    await press('de')
    expect(screen.getByText(costLine('Paid: up to 1 translation → Google Gemini'))).toBeVisible()
    await press('fr')
    const paid = 'Paid: up to 2 translations → Google Gemini'
    expect(screen.getByText(costLine(paid))).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(spoken(paid))
    await press('fr')
    await press('de')
    expect(within(dialog).queryByText(/Paid/)).toBeNull()
    await press('de')
    await press('fr')
    await userEvent.click(make())
    await waitFor(() => expect(atClick).toEqual([[spoken(paid)]]))
  })

  it('a free text provider draws its plain line and no MoneyLine', async () => {
    const { dialog } = await open({ text: 'fake' })
    await press('de')
    await press('fr')
    const free = 'Translating 2 languages uses the fake provider. Nothing is charged.'
    expect(within(dialog).getByText(free)).toBeVisible()
    expect(within(dialog).queryByText(/Paid/)).toBeNull()
    expect(dialog).toHaveAccessibleDescription(free)
  })

  it('puts both money lines last in the body and in the description, fills first', async () => {
    const { dialog } = await open()
    await press(TALL)
    await press('de')
    await fill(TALL)
    const fills = 'Paid: 1 fill → Google Gemini'
    const words = 'Paid: up to 1 translation → Google Gemini'
    expect(dialog).toHaveAccessibleDescription(`${spoken(fills)} ${spoken(words)}`)
    const lines = [screen.getByText(costLine(fills)), screen.getByText(costLine(words))]
    const body = lines[1]!.parentElement!
    expect(body.lastElementChild).toBe(lines[1])
    expect(lines[1]!.previousElementSibling).toBe(lines[0])
    expect(await axeViolations()).toEqual([])
  })

  it('with nothing new to make the button says why and sends nothing', async () => {
    const { fake } = await open()
    expect(make()).toHaveTextContent(/^Make variants$/)
    expect(make()).toBeDisabled()
    expect(make()).toHaveAttribute('title', 'Nothing new to make')
    await userEvent.click(make())
    expect(fake.commands).toEqual([])
  })

  it('with a fill and no provider shows the alert with Settings and sends nothing', async () => {
    const { providers } = baseState()
    const { fake, dialog } = await open({ providers: providers.filter((p) => p.id !== 'gemini') })
    await press(TALL)
    await fill(TALL)
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('No provider can do this yet.')
    expect(within(alert).getByRole('button', { name: 'Settings' })).toBeEnabled()
    expect(make()).toBeDisabled()
    expect(within(dialog).queryByText(/Paid/)).toBeNull()
    expect(fake.commands).toEqual([])
  })
})

describe('Fan-out, the chips [DLG-4b]', () => {
  it("draws sizes as chips with their pixels in the title, the master's pressed and fixed", async () => {
    const { dialog } = await open()
    const sizes = within(dialog).getByRole('group', { name: 'Sizes' })
    const square = within(sizes).getByRole('button', { name: '1x1 (1080×1080)' })
    expect(square).toHaveAttribute('aria-pressed', 'true')
    expect(square).toBeDisabled()
    expect(square).toHaveAttribute('title', "The master's size")
    const tall = within(sizes).getByRole('button', { name: TALL })
    expect(tall).toHaveAttribute('aria-pressed', 'false')
    expect(tall).toHaveAttribute('title', '1080×1920')
    expect(tall).toHaveTextContent('9x16')
    await press(TALL)
    expect(tall).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps one format on: the last one on cannot be turned off', async () => {
    await open()
    expect(chip('Image')).toHaveAttribute('aria-disabled', 'true')
    expect(chip('Image')).toHaveAttribute('title', 'Choose at least one format')
    await press('Image')
    expect(chip('Image')).toHaveAttribute('aria-pressed', 'true')
    await press('Video')
    expect(chip('Image')).not.toHaveAttribute('aria-disabled')
    await press('Image')
    expect(chip('Image')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Video')).toHaveAttribute('aria-disabled', 'true')
    expect(chip('Video')).toHaveAttribute('aria-pressed', 'true')
  })

  it('draws each fit as an icon choice named by its words, the size label visible', async () => {
    const { dialog } = await open()
    await press(TALL)
    const group = within(dialog).getByRole('group', { name: `Background for ${TALL}` })
    expect(group).toHaveTextContent('9x16')
    const radios = within(group).getAllByRole('radio')
    expect(
      radios.map((r) => r.getAttribute('title') ?? r.closest('[title]')?.getAttribute('title')),
    ).toEqual([
      'Scale: show the whole picture, black at the edges',
      'Crop: fill the size and hide the edges',
      FILL,
    ])
    expect(await axeViolations()).toEqual([])
  })
})
