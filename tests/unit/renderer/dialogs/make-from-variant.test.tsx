// MV-6 (spec/screens-variants.md, "The variant tile" and "Make variants"; spec/make-variants.md,
// "Making variants from a variant"): a tile's "Make variants from this one…" opens the Make
// variants dialog with that variant as the source. Its size and language are fixed, its format
// starts on, the fits are judged against its size and its background picture, the cost lines
// follow the counts, and the one click sends variant.fanOut with sourceVariantId. The master's
// tile opens the header's dialog and sends no sourceVariantId. Nothing is sent before the click.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../render'
import { costLine } from '../cost-line'
import {
  P,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
  variant,
} from '../screens/campaign/campaign-fixture'

const MASTER = variant('V1', { title: 'Master post', isMaster: true, sizeLabel: '1x1' })
const SOURCE = variant('V2', {
  title: 'German post',
  language: 'de',
  sizeLabel: '9x16',
  width: 1080,
  height: 1920,
})
const WIDE_EN = variant('V3', { title: 'Wide post', sizeLabel: '16x9', width: 1920, height: 1080 })
const SIZES = [
  { label: '1x1', width: 1080, height: 1080 },
  { label: '9x16', width: 1080, height: 1920 },
  { label: '16x9', width: 1920, height: 1080 },
]

function data(variants: VariantSummary[]): CampaignGet {
  const base = campaignGet(variants)
  return {
    ...base,
    campaign: { ...base.campaign, sizes: SIZES, languages: ['en', 'de', 'ja'] },
    directions: [{ id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 }],
  }
}

// Which variants' backgrounds hold a picture, as variant.get answers for each.
async function open(
  opts: { variants?: VariantSummary[]; pictures?: string[]; tile?: string } = {},
) {
  const variants = opts.variants ?? [MASTER, SOURCE]
  const pictures = opts.pictures ?? ['V1', 'V2']
  const fake = campaignApi()
  fake.onQuery('sync.preview', () => ({
    ok: true,
    data: { directionId: 'D1', masterVariantId: 'V1', masterRev: 1, variants: [] },
  }))
  fake.onQuery('variant.get', (input) => {
    const { variantId } = input as { variantId: string }
    const source = pictures.includes(variantId) ? { assetId: 'A1' } : null
    return { ok: true, data: { layers: [{ id: 'L1', type: 'background', source }] } }
  })
  fake.onCommand('variant.fanOut', () => ({ ok: true, data: { variantIds: ['V9'], fill: [] } }))
  await renderWith(
    <main>
      <h2>Campaign</h2>
      <DirectionGrids
        projectId={P}
        campaign={data(variants)}
        chosenId="V1"
        onChoose={() => {}}
        onOpenBehind={() => {}}
      />
    </main>,
    fake,
  )
  const tile = opts.tile ?? 'German post'
  await userEvent.click(screen.getByRole('button', { name: `More actions for ${tile}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Make variants from this one…' }))
  return { fake, dialog: await screen.findByRole('dialog') }
}

const TITLE = 'Make variants from German post · 9x16 · de'
const FIRST_LINE =
  'New variants start from this one: its words, boxes, pictures and look. They stay linked to the master.'
const tick = (name: string) => userEvent.click(screen.getByRole('button', { name }))
const make = () => screen.getByRole('button', { name: /^Make (\d+ )?variants?$/ })
const groupOf = (size: string) => screen.queryByRole('group', { name: `Background for ${size}` })

describe('Make variants from a variant [MV-6]', () => {
  it('is titled by the source and opens with the first line', async () => {
    const { dialog } = await open()
    expect(dialog).toHaveAccessibleName(TITLE)
    expect(within(dialog).getByText(FIRST_LINE)).toBeVisible()
  })

  it("presses and fixes the source's size and language chips, not the master's", async () => {
    const { dialog } = await open()
    const sizes = within(dialog).getByRole('group', { name: 'Sizes' })
    const tall = within(sizes).getByRole('button', { name: '9x16 (1080×1920)' })
    expect(tall).toHaveAttribute('aria-pressed', 'true')
    expect(tall).toBeDisabled()
    const square = within(sizes).getByRole('button', { name: '1x1 (1080×1080)' })
    expect(square).toHaveAttribute('aria-pressed', 'false')
    expect(square).toBeEnabled()
    const languages = within(dialog).getByRole('group', { name: 'Languages' })
    expect(within(languages).getByRole('button', { name: 'de' })).toBeDisabled()
    expect(within(languages).getByRole('button', { name: 'en' })).toBeEnabled()
    expect(make()).toHaveTextContent(/^Make variants$/)
    expect(make()).toBeDisabled()
  })

  it("starts with the source's format on", async () => {
    const video = { ...SOURCE, format: 'video' as const }
    const { dialog } = await open({ variants: [MASTER, video] })
    const formats = within(dialog).getByRole('group', { name: 'Formats' })
    expect(within(formats).getByRole('button', { name: 'Video' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(formats).getByRole('button', { name: 'Image' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it("draws a fit group only for sizes whose pixel size differs from the source's", async () => {
    await open()
    await tick('1x1 (1080×1080)')
    await tick('16x9 (1920×1080)')
    expect(groupOf('1x1 (1080×1080)')).toBeInTheDocument()
    expect(groupOf('16x9 (1920×1080)')).toBeInTheDocument()
    expect(groupOf('9x16 (1080×1920)')).toBeNull()
  })

  it('draws no fit group when the source has no background picture, and sends scale', async () => {
    const { fake } = await open({ pictures: ['V1'] })
    await tick('1x1 (1080×1080)')
    expect(groupOf('1x1 (1080×1080)')).toBeNull()
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'variant.fanOut')).toHaveLength(1))
    expect(sent(fake, 'variant.fanOut')[0]?.input).toMatchObject({ fits: { '1x1': 'scale' } })
  })

  it('sends nothing before the click, then variant.fanOut with sourceVariantId and its fits', async () => {
    const { fake } = await open()
    await tick('1x1 (1080×1080)')
    await tick('ja')
    await userEvent.click(
      within(groupOf('1x1 (1080×1080)')!).getByRole('radio', {
        name: 'Crop: fill the size and hide the edges',
      }),
    )
    expect(fake.commands).toEqual([])
    await userEvent.click(make())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([
      {
        name: 'variant.fanOut',
        input: {
          projectId: P,
          directionId: 'D1',
          sizes: ['1x1', '9x16'],
          languages: ['de', 'ja'],
          formats: ['image'],
          fits: { '1x1': 'crop' },
          sourceVariantId: 'V2',
        },
      },
    ])
  })

  it("opens the header's dialog from the master's tile and sends no sourceVariantId", async () => {
    const { fake, dialog } = await open({ tile: 'Master post' })
    expect(dialog).toHaveAccessibleName('Make variants of Beach day')
    expect(within(dialog).queryByText(FIRST_LINE)).toBeNull()
    await tick('ja')
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'variant.fanOut')).toHaveLength(1))
    expect(sent(fake, 'variant.fanOut')[0]?.input).not.toHaveProperty('sourceVariantId')
  })

  it('says how many of the chosen variants already exist, leaving out the source', async () => {
    const { dialog } = await open({ variants: [MASTER, SOURCE, WIDE_EN] })
    expect(within(dialog).queryByText(/already exist/)).toBeNull()
    await tick('1x1 (1080×1080)')
    await tick('en')
    expect(within(dialog).getByText('1 of these already exists and stays as it is.')).toBeVisible()
    await tick('16x9 (1920×1080)')
    expect(within(dialog).getByText('2 of these already exist and stay as they are.')).toBeVisible()
  })

  it('cost lines follow the counts, before the click and in the description', async () => {
    const { dialog, fake } = await open()
    await tick('en')
    expect(within(dialog).queryByText(/translation/)).toBeNull()
    await tick('ja')
    const words = 'Paid: up to 1 translation → Google Gemini'
    expect(within(dialog).getByText(costLine(words))).toBeVisible()
    await tick('1x1 (1080×1080)')
    await userEvent.click(
      within(groupOf('1x1 (1080×1080)')!).getByRole('radio', {
        name: 'Generate fill: extend the picture with AI',
      }),
    )
    expect(within(dialog).getByText(costLine('Paid: 1 fill → Google Gemini'))).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(/Paid: 1 fill to Google Gemini/)
    expect(dialog).toHaveAccessibleDescription(/Paid: up to 1 translation to Google Gemini/)
    expect(make()).toHaveTextContent('Make 4 variants')
    expect(fake.commands).toEqual([])
  })

  it('has no accessibility violations', async () => {
    await open({ variants: [MASTER, SOURCE, WIDE_EN] })
    await tick('1x1 (1080×1080)')
    await tick('en')
    expect(await axeViolations()).toEqual([])
  })
})
