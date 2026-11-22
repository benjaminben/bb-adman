// Moved word for word from properties-panel.test.tsx by ED-1b, so ED-3 owns the picture
// layer's order without touching ED-2's file; legends() now reads Section heading buttons too.
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { NEW_SHADE } from '@/shared/config/look'
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
