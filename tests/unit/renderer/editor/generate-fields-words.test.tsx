// spec/phases/round-2-editor.md, D1 [R2E-1]: the editor's first draft leaves out the brief's
// message when the variant's text layers already hold words.
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { prefilledPrompt } from '@/shared/generation/prompt'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

const facts = {
  subjects: [{ name: 'Citrus can', description: 'A slim can' }],
  audience: 'Adults 21 to 35',
  region: 'US',
  message: '<b>Cool</b> down',
}

beforeEach(() => generateDrafts.setState({ drafts: {} }))

async function promptBox(ui: React.ReactElement) {
  const fake = campaignApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
  await renderApp(ui, fake)
  await screen.findByText('None chosen')
  return screen.getByRole('textbox', { name: 'Prompt' })
}

const fields = (layers?: LayerRow[]) => (
  <GenerateFields projectId={P} campaignId="C1" layer={LOGO} {...(layers ? { layers } : {})} />
)

describe('the first draft and the words on layers [R2E-1, D1]', () => {
  it('leaves out the message when a headline holds words', async () => {
    const box = await promptBox(fields([BACKGROUND, HEADLINE, LOGO]))
    expect(box).toHaveValue(prefilledPrompt({ ...facts, wordsOnLayers: true }))
    expect((box as HTMLTextAreaElement).value).not.toContain('Cool')
  })

  it('keeps the old prompt when no text layer holds words', async () => {
    const blank = { ...HEADLINE, copy: '  ' }
    const box = await promptBox(fields([BACKGROUND, blank, LOGO]))
    expect(box).toHaveValue(prefilledPrompt(facts))
  })

  it('keeps the old prompt when no layers are passed', async () => {
    expect(await promptBox(fields())).toHaveValue(prefilledPrompt(facts))
  })

  it('reaches the draft through the picture section', async () => {
    const box = await promptBox(
      <GeneratePanel projectId={P} campaignId="C1" layer={LOGO} layers={[HEADLINE, LOGO]} />,
    )
    expect(box).toHaveValue(prefilledPrompt({ ...facts, wordsOnLayers: true }))
  })
})
