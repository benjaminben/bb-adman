// Moved word for word from properties-panel.test.tsx by ED-1b, so ED-2 owns the text layer's
// order without touching ED-3's file; legends() now reads Section heading buttons too.
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

const SECOND = { ...LOGO, id: 'L3', name: 'Badge', z: 3 }
const LAYERS = [BACKGROUND, HEADLINE, LOGO, SECOND]

const sent = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => [c.name, c.input])

// LK-5: the Box section after "Text settings" for text layers, and the Shade section after
// "Picture" for image and background layers, each with the campaign palette.
describe('PropertiesPanel, Box and Shade [spec/editor.md "Properties panel"; LK-5]', () => {
  // The panel's group legends and Section heading buttons, in page order (ED-1b).
  const legends = () =>
    [
      ...screen
        .getByRole('region', { name: 'Properties' })
        .querySelectorAll('fieldset > legend, :is(h2, h3, h4) > button[aria-expanded]'),
    ].map((e) => e.textContent ?? '')

  async function withPalette(layer: LayerRow) {
    const fake = makeFakeApi()
    // A picture layer also mounts the AI section, which reads the campaign's facts.
    const campaign = { audience: 'All', region: 'US', message: 'Hello' }
    const data = { ruleSet: { palette: ['#F4E9D8'] }, campaign, variants: [], subjects: [] }
    fake.onQuery('campaign.get', () => ({ ok: true, data }))
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
    expect(legends()).toEqual(['Text settings', 'Box', 'Position'])
  })

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
})
