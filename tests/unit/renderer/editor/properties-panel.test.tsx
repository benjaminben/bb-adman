// spec/editor.md, "Properties panel" and "Keyboard shortcuts" (Duplicate): what the panel's
// sections send. Each field is one layer.update for the selected layer; Bring forward and Send
// backward are one layer.reorder step; Duplicate is layer.create with the layer's values, named
// "{name} copy", moved 20 px right and down; Delete layer is layer.delete.
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { NEW_SHADE } from '@/shared/config/look'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, assetRow } from './editor-fixture'

const SECOND = { ...LOGO, id: 'L3', name: 'Badge', z: 3 }
const LAYERS = [BACKGROUND, HEADLINE, LOGO, SECOND]

async function open(layer: LayerRow | null) {
  const fake = makeFakeApi()
  await renderApp(
    <main>
      <PropertiesPanel projectId={P} campaignId="C1" layer={layer} layers={LAYERS} />
    </main>,
    fake,
  )
  return fake
}

const sent = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => [c.name, c.input])

describe('PropertiesPanel [spec/editor.md "Properties panel"]', () => {
  it('shows the empty state when nothing is selected', async () => {
    await open(null)
    expect(screen.getByText('Select a layer to change it.')).toBeInTheDocument()
  })

  it('a field sends one layer.update for the selected layer', async () => {
    const fake = await open(LOGO)
    const field = screen.getByRole('spinbutton', { name: 'X' })
    await userEvent.clear(field)
    await userEvent.type(field, '760{Enter}')
    expect(sent(fake)).toEqual([
      ['layer.update', { projectId: P, layerId: 'L2', patch: { geometry: { x: 760 } } }],
    ])
  })

  it('shows the command refusal under the field', async () => {
    const fake = await open(LOGO)
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That layer was not found.' },
    }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' mark{Enter}')
    expect(await screen.findByText('That layer was not found.')).toBeInTheDocument()
  })

  it.each([
    ['Bring forward', ['L1', 'L3', 'L2']],
    ['Send backward', ['L2', 'L1', 'L3']],
  ])('%s sends layer.reorder one step', async (name, layerIds) => {
    const fake = await open(LOGO)
    await userEvent.click(screen.getByRole('button', { name }))
    expect(sent(fake)).toEqual([['layer.reorder', { projectId: P, variantId: V, layerIds }]])
  })

  it('cannot bring the top layer forward', async () => {
    await open(SECOND)
    expect(screen.getByRole('button', { name: 'Bring forward' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send backward' })).toBeEnabled()
  })

  it('Duplicate sends layer.create with the values, named "{name} copy", 20 px right and down', async () => {
    const fake = await open(HEADLINE)
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    const { geometry, style, copy } = HEADLINE
    expect(sent(fake)).toEqual([
      [
        'layer.create',
        {
          projectId: P,
          variantId: V,
          type: 'text',
          values: {
            name: 'Headline copy',
            copy,
            style,
            geometry: { ...geometry, x: geometry.x + 20, y: geometry.y + 20 },
            visible: true,
            locked: false,
          },
        },
      ],
    ])
  })

  it('Duplicate of a picture layer keeps its picture', async () => {
    const fake = await open({ ...LOGO, source: { assetId: 'A1' } })
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    const input = fake.commands[0]?.input as { type: string; values: Record<string, unknown> }
    expect(input.type).toBe('image')
    expect(input.values.source).toEqual({ assetId: 'A1' })
    expect(input.values.copy).toBeUndefined()
  })

  it('a text layer shows the text fields with the campaign palette from campaign.get', async () => {
    const fake = makeFakeApi()
    fake.onQuery('campaign.get', () => ({
      ok: true,
      data: { ruleSet: { palette: ['#E85D2A', '#F4E9D8'] } },
    }))
    await renderApp(
      <main>
        <PropertiesPanel projectId={P} campaignId="C1" layer={HEADLINE} layers={LAYERS} />
      </main>,
      fake,
    )
    expect(
      await screen.findByRole('button', { name: 'Palette colour #F4E9D8' }),
    ).toBeInTheDocument()
    expect(fake.queries.find((q) => q.name === 'campaign.get')?.input).toEqual({
      projectId: P,
      campaignId: 'C1',
    })
    expect(screen.getByRole('textbox', { name: 'Copy' })).toHaveValue(HEADLINE.copy)
  })

  it('the font select sends layer.update with the font in the style', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => ({ ok: true, data: [assetRow('F1', { kind: 'font' })] }))
    await renderApp(
      <main>
        <PropertiesPanel projectId={P} campaignId="C1" layer={HEADLINE} layers={LAYERS} />
      </main>,
      fake,
    )
    const select = screen.getByRole('combobox', { name: 'Font' })
    await screen.findByRole('option', { name: 'F1.png' })
    await userEvent.selectOptions(select, 'F1.png')
    expect(sent(fake)).toEqual([
      ['layer.update', { projectId: P, layerId: 'L1', patch: { style: { fontAssetId: 'F1' } } }],
    ])
  })

  it('a picture layer and the background show no text fields', async () => {
    await open(LOGO)
    expect(screen.queryByRole('textbox', { name: 'Copy' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Font' })).toBeNull()
    expect(screen.getByRole('spinbutton', { name: 'X' })).toBeInTheDocument()
  })

  it('Delete layer sends layer.delete', async () => {
    const fake = await open(LOGO)
    await userEvent.click(screen.getByRole('button', { name: 'Delete layer' }))
    expect(sent(fake)).toEqual([['layer.delete', { projectId: P, layerId: 'L2' }]])
  })
})

// LK-5: the Box section after "Text settings" for text layers, and the Shade section after
// "Picture" for image and background layers, each with the campaign palette.
describe('PropertiesPanel, Box and Shade [spec/editor.md "Properties panel"; LK-5]', () => {
  const legends = () =>
    screen
      .getAllByRole('group')
      .flatMap((g) => g.querySelector(':scope > legend')?.textContent ?? [])

  async function withPalette(layer: LayerRow) {
    const fake = makeFakeApi()
    fake.onQuery('campaign.get', () => ({ ok: true, data: { ruleSet: { palette: ['#F4E9D8'] } } }))
    await renderApp(
      <main>
        <PropertiesPanel projectId={P} campaignId="C1" layer={layer} layers={LAYERS} />
      </main>,
      fake,
    )
    return fake
  }

  it('a text layer shows Box after Text settings, with the palette, and no Shade', async () => {
    await withPalette(HEADLINE)
    await screen.findByRole('button', { name: 'Palette #F4E9D8 for box colour' })
    expect(legends()).toEqual(['Layer', 'Text settings', 'Box', 'Position and size'])
  })

  it.each([LOGO, BACKGROUND])(
    '$name shows Shade after Picture, with the palette, and no Box',
    async (layer) => {
      await withPalette({
        ...layer,
        style: { opacity: 1, shade: { color: '#000000', from: 'top', strength: 0.5, reach: 0.5 } },
      })
      await screen.findByRole('button', { name: 'Palette #F4E9D8 for colour' })
      const shown = legends()
      expect(shown.indexOf('Shade')).toBe(shown.indexOf('Picture') + 1)
      expect(shown).not.toContain('Box')
    },
  )

  it('a Box field sends one layer.update for the selected layer', async () => {
    const fake = await withPalette(HEADLINE)
    await userEvent.click(screen.getByRole('button', { name: 'Bottom' }))
    expect(sent(fake)).toEqual([
      [
        'layer.update',
        { projectId: P, layerId: 'L1', patch: { style: { verticalAlign: 'bottom' } } },
      ],
    ])
  })

  it('the Shade select sends one layer.update for the selected layer', async () => {
    const fake = await withPalette(LOGO)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Shade' }), 'Whole picture')
    expect(sent(fake)).toEqual([
      [
        'layer.update',
        { projectId: P, layerId: 'L2', patch: { style: { shade: { ...NEW_SHADE, from: 'all' } } } },
      ],
    ])
  })

  it('the background gets the palette in its Background colour field', async () => {
    await withPalette(BACKGROUND)
    expect(
      await screen.findByRole('button', { name: 'Palette #F4E9D8 for background colour' }),
    ).toBeInTheDocument()
  })
})
