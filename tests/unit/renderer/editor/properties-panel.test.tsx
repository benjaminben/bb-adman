// spec/editor.md, "Properties panel": what the panel's sections send. Each field is one
// layer.update for the selected layer. Bring forward, Send backward, Duplicate and Delete moved
// to the layer row's More menu (ED-1b; layer-row-menu.test.tsx).
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, assetRow } from './editor-fixture'

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

// ED-1b: Position is a Section, folded at first; its fold lasts for the window's life.
async function openPosition() {
  const position = screen.getByRole('button', { name: 'Position' })
  if (position.getAttribute('aria-expanded') === 'false') await userEvent.click(position)
}

const sent = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => [c.name, c.input])

describe('PropertiesPanel [spec/editor.md "Properties panel"]', () => {
  it('shows the empty state when nothing is selected', async () => {
    await open(null)
    expect(screen.getByText('Select a layer')).toBeInTheDocument()
  })

  it('a field sends one layer.update for the selected layer', async () => {
    const fake = await open(LOGO)
    await openPosition()
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
    await openPosition()
    await userEvent.type(screen.getByRole('spinbutton', { name: 'X' }), '5{Enter}')
    expect(await screen.findByText('That layer was not found.')).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: '#F4E9D8' })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Position' })).toBeInTheDocument()
  })
})
