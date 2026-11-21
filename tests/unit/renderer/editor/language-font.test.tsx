// spec/phases/phase-06.md, design additions 6 and 8 (P6-14, A-166): under the font field of a
// translated text layer, "Use this font for every {language} post" sends one layer.setFonts for
// the layers of the same direction, language and key, read from translation.forCampaign. Not
// shown on a layer in the campaign's main language.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LanguageFont } from '@/renderer/editor/language-font'
import type { TranslationForCampaign, TranslationRow } from '@/shared/schemas/queries/translation'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { HEADLINE } from './editor-fixture'

function row(over: Partial<TranslationRow>): TranslationRow {
  return {
    directionId: 'D1',
    variantId: 'V2',
    title: 'Summer sale',
    sizeLabel: 'Feed',
    language: 'ja',
    layerId: 'L1',
    layerKey: 'headline',
    layerName: 'Headline',
    sourceText: 'Cool down this summer',
    text: '[ja] Cool down this summer',
    status: 'proposed',
    source: 'ai',
    fontAssetId: null,
    ...over,
  }
}

const ROWS = [
  row({}),
  row({ variantId: 'V3', layerId: 'L5' }),
  row({ variantId: 'V4', layerId: 'L6', directionId: 'D2' }),
  row({ variantId: 'V3', layerId: 'L7', layerKey: 'cta' }),
  row({ variantId: 'V5', layerId: 'L8', language: 'fr' }),
]

const reply = (rows: TranslationRow[]): TranslationForCampaign => ({
  primaryLanguage: 'en',
  rows,
  jobs: [],
})

const JAPANESE: LayerRow = {
  ...HEADLINE,
  variantId: 'V2',
  style: { ...HEADLINE.style, fontAssetId: 'F1' },
  translationStatus: 'proposed',
}

async function setup(layer: LayerRow, rows = ROWS, campaignId: string | null = 'C1') {
  const fake = makeFakeApi()
  let current = rows
  fake.onQuery('translation.forCampaign', () => ({ ok: true, data: reply(current) }))
  await renderApp(
    <main>
      <LanguageFont projectId="P1" campaignId={campaignId} layer={layer} />
    </main>,
    fake,
  )
  return { fake, setRows: (next: TranslationRow[]) => (current = next) }
}

const button = () => screen.findByRole('button', { name: 'Use this font for every ja post' })

describe('LanguageFont [P6-14, A-166]', () => {
  it('sends one layer.setFonts with the layers of the same direction, language and key', async () => {
    const { fake } = await setup(JAPANESE)
    expect(fake.queries).toContainEqual({
      name: 'translation.forCampaign',
      input: { projectId: 'P1', campaignId: 'C1' },
    })
    await userEvent.click(await button())
    expect(fake.commands).toEqual([
      {
        name: 'layer.setFonts',
        input: {
          projectId: 'P1',
          items: [
            { layerId: 'L1', fontAssetId: 'F1' },
            { layerId: 'L5', fontAssetId: 'F1' },
          ],
        },
      },
    ])
  })

  it('sends the default font as null', async () => {
    const { fake } = await setup({ ...JAPANESE, style: { ...JAPANESE.style, fontAssetId: null } })
    await userEvent.click(await button())
    const input = fake.commands[0]?.input as { items: Array<{ fontAssetId: string | null }> }
    expect(input.items.map((i) => i.fontAssetId)).toEqual([null, null])
  })

  it('is hidden on a layer in the main language', async () => {
    const { fake } = await setup({ ...HEADLINE, id: 'L9' })
    await act(async () => {})
    expect(fake.queries.some((q) => q.name === 'translation.forCampaign')).toBe(true)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is hidden outside a campaign and reads nothing', async () => {
    const { fake } = await setup(JAPANESE, ROWS, null)
    await act(async () => {})
    expect(fake.queries.some((q) => q.name === 'translation.forCampaign')).toBe(false)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reads the translations again on project.changed for this project', async () => {
    const { fake, setRows } = await setup(JAPANESE, [])
    await act(async () => {})
    expect(screen.queryByRole('button')).toBeNull()
    setRows(ROWS)
    await act(async () => {
      fake.emit('project.changed', { projectId: 'P1', changed: {}, removed: {}, actor: 'agent' })
    })
    expect(await button()).toBeInTheDocument()
  })

  it('a refusal shows its message', async () => {
    const { fake } = await setup(JAPANESE)
    fake.onCommand('layer.setFonts', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'These layers are in different campaigns.' },
    }))
    await userEvent.click(await button())
    expect(await screen.findByText('These layers are in different campaigns.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await setup(JAPANESE)
    await button()
    expect(await axeViolations()).toEqual([])
  })
})
