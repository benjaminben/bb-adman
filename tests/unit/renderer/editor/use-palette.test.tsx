// The campaign palette's swatches (spec/editor.md, "Properties panel"; P4-T3 security review):
// palette text from campaign.get is drawn as a swatch's background only when it is an exact
// #RRGGBB. Anything else (CSS a hostile project file planted) is not shown at all, in the text
// colour field and in the colour choices (here the Box and outline colours) alike.
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

const VALID = '#E85D2A'

async function open(layer: LayerRow, palette: string[]) {
  const fake = makeFakeApi()
  fake.onQuery('campaign.get', () => ({ ok: true, data: { ruleSet: { palette } } }))
  await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={[BACKGROUND, HEADLINE, LOGO]}
      />
    </main>,
    fake,
  )
}

const swatchNames = () =>
  screen.queryAllByRole('button', { name: /^Palette / }).map((b) => b.getAttribute('aria-label'))

describe('palette swatches show exact #RRGGBB only', () => {
  it.each([
    ['url(x)', 'url(x)'],
    ['a colour name', 'red'],
    ['a short hex', '#FFF'],
    ['empty text', ''],
    ['hex followed by CSS', '#E85D2A; background-image: url(x)'],
  ])('leaves out %s, in the text, box and outline colours', async (_c, bad) => {
    await open(HEADLINE, [VALID, bad])
    await screen.findByRole('button', { name: `Palette colour ${VALID}` })
    expect(swatchNames()).toEqual([
      `Palette colour ${VALID}`,
      `Palette ${VALID} for box colour`,
      `Palette ${VALID} for outline colour`,
    ])
  })
})
