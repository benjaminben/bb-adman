// spec/screens-ai.md, "The picture section of the properties panel": "Make pictures with AI",
// mounted for image and background layers between "Picture" and "Position and size".
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {} }))

async function open(layer: LayerRow) {
  const fake = campaignApi()
  await renderApp(
    <main>
      <PropertiesPanel projectId={P} campaignId="C1" layer={layer} layers={[layer]} />
    </main>,
    fake,
  )
}

const sections = () =>
  [...document.querySelectorAll('fieldset > legend, :is(h2, h3, h4) > button[aria-expanded]')].map(
    (e) => e.textContent,
  )

describe('PictureAi in the properties panel [spec/screens-ai.md]', () => {
  it.each([BACKGROUND, LOGO])(
    'sits between Picture and Position and size: $name',
    async (layer) => {
      await open(layer)
      await screen.findByRole('textbox', { name: 'Prompt' })
      const wanted = ['Picture', 'Generate', 'Position']
      expect(sections().filter((s) => wanted.includes(s ?? ''))).toEqual(wanted)
    },
  )

  it('is not shown for a text layer', async () => {
    await open(HEADLINE)
    // ED-4a: Generate is a Section (a region).
    expect(screen.queryByRole('region', { name: 'Generate' })).toBeNull()
  })
})
