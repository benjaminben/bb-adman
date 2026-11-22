// spec/editor.md, "Properties panel": the Picture section shows for image and background layers,
// between Layer and Position and size, and each of its changes is one layer.update for the
// selected layer, the same path the other fields use.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, assetRow } from './editor-fixture'

const LAYERS = [BACKGROUND, HEADLINE, LOGO]
const ASSETS = { A1: { ...assetRow('A1', { displayName: 'beach-sunset.jpg' }), version: 0 } }

async function open(layer: LayerRow) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: [assetRow('A2')] }))
  await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={LAYERS}
        assets={ASSETS}
        canvas={{ width: 1080, height: 1350 }}
      />
    </main>,
    fake,
  )
  return fake
}

const groups = () =>
  screen
    .getAllByRole('group')
    .map((g) => g.getAttribute('aria-label') ?? g.querySelector('legend')?.textContent)

describe('PropertiesPanel, Picture [spec/editor.md "Properties panel"; FR-094]', () => {
  it('shows the Picture section after Layer and before Position and size', async () => {
    await open(BACKGROUND)
    await userEvent.click(screen.getByRole('button', { name: 'Position' }))
    expect(groups().filter((g) => g === 'Picture' || g === 'Position and size')).toEqual([
      'Picture',
      'Position and size',
    ])
    expect(
      screen.getByRole('group', { name: 'Picture' }).querySelector('[title="beach-sunset.jpg"]'),
    ).not.toBeNull()
  })

  it('a text layer has no Picture section', async () => {
    await open(HEADLINE)
    expect(screen.queryByRole('group', { name: 'Picture' })).toBeNull()
  })

  it.each([
    ['Remove picture', BACKGROUND, { source: null }],
    [
      'Fill the canvas',
      BACKGROUND,
      { geometry: { x: 0, y: 0, width: 1080, height: 1350, rotation: 0, crop: null } },
    ],
  ])('%s sends one layer.update for the selected layer', async (name, layer, patch) => {
    const fake = await open(layer)
    await userEvent.click(screen.getByRole('button', { name }))
    expect(fake.commands).toEqual([
      { name: 'layer.update', input: { projectId: P, layerId: layer.id, patch } },
    ])
  })

  it('choosing in the picture chooser sends one layer.update with the source', async () => {
    const fake = await open(LOGO)
    await userEvent.click(screen.getByRole('button', { name: 'Choose picture…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Choose a picture for Logo' })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'A2.png' }))
    expect(fake.commands).toEqual([
      {
        name: 'layer.update',
        input: { projectId: P, layerId: LOGO.id, patch: { source: { assetId: 'A2' } } },
      },
    ])
  })
})
