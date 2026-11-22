// R3-3: the Translations tab is laid out like the Variants tab. The primary language is the
// first block, marked "Source", its texts editable through layer.update (the editor's command);
// each language starts with a title-sized level 2 heading; the rows follow the Variants tab's
// order; a translation whose source text changed shows "Out of date". Nothing here is paid.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type {
  SourceRow,
  TranslationRow,
  TranslationSources,
} from '@/shared/schemas/queries/translation'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { P, campaignGet, variant } from './campaign-fixture'
import { translationRow, translations } from './translation-fixture'

const sizes = [
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'Story', width: 1080, height: 1920 },
]

// The master is a Story, though Square comes first in the campaign's sizes.
function campaign(twoDirections = false): CampaignGet {
  const data = campaignGet([
    variant('V1', { sizeLabel: 'Story', isMaster: true, title: 'Morning' }),
    variant('VS', { sizeLabel: 'Square', title: 'Morning' }),
    variant('GS', { sizeLabel: 'Square', language: 'de', title: 'Morning' }),
    variant('GT', { sizeLabel: 'Story', language: 'de', title: 'Morning' }),
    variant('FT', { sizeLabel: 'Story', language: 'fr', title: 'Morning' }),
    ...(twoDirections
      ? [
          variant('V9', { directionId: 'D2', sizeLabel: 'Story', isMaster: true }),
          variant('G9', { directionId: 'D2', sizeLabel: 'Story', language: 'de' }),
        ]
      : []),
  ])
  data.campaign.sizes = sizes
  data.campaign.languages = ['en', 'de', 'fr']
  data.directions = [{ id: 'D1', campaignId: 'C1', name: 'Main', masterVariantId: 'V1', sort: 0 }]
  if (twoDirections) {
    data.directions.push({
      id: 'D2',
      campaignId: 'C1',
      name: 'Night',
      masterVariantId: 'V9',
      sort: 1,
    })
  }
  return data
}

const source = (
  variantId: string,
  sizeLabel: string,
  over: Partial<SourceRow> = {},
): SourceRow => ({
  directionId: 'D1',
  variantId,
  title: 'Morning',
  sizeLabel,
  language: 'en',
  layerId: `${variantId}-H`,
  layerName: 'Headline',
  text: 'Fresh coffee',
  copyRev: 1,
  ...over,
})

const tr = (
  variantId: string,
  sizeLabel: string,
  language: string,
  over: Partial<TranslationRow> = {},
) => translationRow(`${variantId}-H`, { variantId, sizeLabel, language, ...over })

const ROWS = [
  tr('FT', 'Story', 'fr', { text: 'Café frais' }),
  tr('GS', 'Square', 'de'),
  tr('GT', 'Story', 'de'),
]
const SOURCES = [source('VS', 'Square'), source('V1', 'Story')]

function setup(options: { refuse?: string; twoDirections?: boolean } = {}) {
  const fake = makeFakeApi()
  let sources: TranslationSources = { rows: SOURCES, outOfDate: [] }
  const rows = [
    ...ROWS,
    ...(options.twoDirections ? [tr('G9', 'Story', 'de', { directionId: 'D2' })] : []),
  ]
  const extra = options.twoDirections ? [source('V9', 'Story', { directionId: 'D2' })] : []
  sources = { ...sources, rows: [...sources.rows, ...extra] }
  fake.onQuery('translation.forCampaign', () => ({ ok: true, data: translations(rows) }))
  fake.onQuery('translation.sources', () => ({ ok: true, data: sources }))
  fake.onCommand('layer.update', (input): Result<unknown> => {
    if (options.refuse)
      return { ok: false, error: { code: 'RULE_VIOLATION', message: options.refuse } }
    const { layerId, patch } = input as { layerId: string; patch: { copy: string } }
    const rows = sources.rows.map((r) =>
      r.layerId === layerId ? { ...r, text: patch.copy, copyRev: 2 } : r,
    )
    sources = { rows, outOfDate: ['GT-H'] }
    return { ok: true, data: { layerId } }
  })
  return fake
}

async function show(options: { refuse?: string; twoDirections?: boolean } = {}) {
  const fake = setup(options)
  await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaign(options.twoDirections)} />,
    fake,
  )
  await screen.findByRole('region', { name: 'English' })
  return fake
}

const updates = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
const field = (name: string) => screen.findByRole('textbox', { name })
const STORY = 'English Morning · Story · Headline'

describe('Translations tab layout [R3-3]', () => {
  it('starts each language with a level 2 heading, the primary first and marked Source', async () => {
    await show()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['English', 'German', 'French'])
    const english = within(screen.getByRole('region', { name: 'English' }))
    expect(english.getByText('Source')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'German' })).queryByText('Source')).toBeNull()
  })

  it("orders each block's rows as the Variants tab: the master's size first", async () => {
    await show()
    const posts = (name: string) =>
      within(screen.getByRole('list', { name }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    await waitFor(() => expect(posts('English texts')[0]).toContain('Story'))
    expect(posts('English texts')[1]).toContain('Square')
    expect(posts('German translations')[0]).toContain('Story')
    expect(posts('German translations')[1]).toContain('Square')
  })

  it('names each direction inside a language block when there are two', async () => {
    await show({ twoDirections: true })
    const german = within(screen.getByRole('region', { name: 'German' }))
    expect(german.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Main',
      'Night',
    ])
    expect(german.getByRole('list', { name: 'German translations in Night' })).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'English' })).getAllByRole('heading', { level: 3 }),
    ).toHaveLength(2)
  })

  it('names no direction when there is one', async () => {
    await show()
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([])
    expect(await axeViolations()).toEqual([])
  })
})

describe('the source block [R3-3]', () => {
  it('commits an edit with Enter through layer.update once, and the translations show Out of date', async () => {
    const fake = await show()
    const german = within(screen.getByRole('region', { name: 'German' }))
    expect(german.queryByText('Out of date')).toBeNull()
    await userEvent.clear(await field(STORY))
    await userEvent.type(await field(STORY), 'Hot coffee{Enter}')
    await waitFor(() =>
      expect(updates(fake)).toEqual([
        { projectId: P, layerId: 'V1-H', patch: { copy: 'Hot coffee' } },
      ]),
    )
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: STORY }) as HTMLTextAreaElement).value).toBe(
        'Hot coffee',
      ),
    )
    const story = german.getByRole('textbox', { name: 'German Morning · Story · Headline' })
    await waitFor(() =>
      expect(within(story.closest('li') as HTMLElement).getByText('Out of date')).toBeTruthy(),
    )
    await userEvent.tab()
    expect(updates(fake)).toHaveLength(1)
    expect(fake.commands.some((c) => c.name.startsWith('translation.'))).toBe(false)
  })

  it('commits on leaving the field and adds a line with Shift+Enter', async () => {
    const fake = await show()
    await userEvent.type(await field(STORY), '{Shift>}{Enter}{/Shift}today')
    expect(updates(fake)).toEqual([])
    await userEvent.tab()
    await waitFor(() =>
      expect(updates(fake)).toEqual([
        { projectId: P, layerId: 'V1-H', patch: { copy: 'Fresh coffee\ntoday' } },
      ]),
    )
  })

  it('puts the old words back on Escape and sends nothing', async () => {
    const fake = await show()
    await userEvent.type(await field(STORY), ' now{Escape}')
    expect((await field(STORY)) as HTMLTextAreaElement).toHaveProperty('value', 'Fresh coffee')
    await userEvent.tab()
    expect(updates(fake)).toEqual([])
  })

  it("shows a refusal's own message beside the field", async () => {
    await show({ refuse: 'This layer is locked.' })
    await userEvent.type(await field(STORY), '!{Enter}')
    const row = within((await field(STORY)).closest('li') as HTMLElement)
    expect((await row.findByRole('alert')).textContent).toBe('This layer is locked.')
    expect((await field(STORY)) as HTMLTextAreaElement).toHaveProperty('value', 'Fresh coffee!')
  })
})
