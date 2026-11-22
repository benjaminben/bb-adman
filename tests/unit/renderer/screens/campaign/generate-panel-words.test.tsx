// spec/phases/round-2-editor.md, D1 [R2E-1]: the "Make pictures" panel reads variant.get once
// for its variant; until that answer it shows the prompt as before, and replaces it once when
// the answer comes if the user has not typed in the box.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { prefilledPrompt } from '@/shared/generation/prompt'
import { HEADLINE, LOGO, variantGet } from '../../editor/editor-fixture'
import { P, campaignApi, renderWith } from './campaign-fixture'
import { heldReply } from './held-reply'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const facts = {
  subjects: [{ name: 'Citrus can', description: 'A slim can' }],
  audience: 'Adults 21 to 35',
  region: 'US',
  message: '<b>Cool</b> down',
}
const OLD = prefilledPrompt(facts)
const NEW = prefilledPrompt({ ...facts, wordsOnLayers: true })

async function open() {
  const held = heldReply()
  const fake = campaignApi()
  fake.onQuery('variant.get', held.answer)
  await renderWith(view, fake)
  const panel = within(await screen.findByRole('region', { name: 'Make pictures' }))
  const box = panel.getByLabelText('Prompt')
  const answer = (layers = [HEADLINE, LOGO]) =>
    act(async () => held.release({ ok: true, data: variantGet({ layers }) }))
  return { fake, box, answer }
}

describe('the picture panel and the words on layers [R2E-1, D1]', () => {
  it('shows the old prompt until variant.get answers, then the prompt without the message', async () => {
    const { fake, box, answer } = await open()
    expect(box).toHaveValue(OLD)
    await answer()
    await waitFor(() => expect(box).toHaveValue(NEW))
    const reads = fake.queries.filter((q) => q.name === 'variant.get').map((q) => q.input)
    expect(reads).toContainEqual({ projectId: P, variantId: 'V1' })
  })

  it('keeps the old prompt when the variant has no words on its layers', async () => {
    const { box, answer } = await open()
    await answer([LOGO])
    await waitFor(() => expect(box).toHaveValue(OLD))
  })

  it('does not replace what the user typed before the answer', async () => {
    const { box, answer } = await open()
    await userEvent.clear(box)
    await userEvent.type(box, 'A cold can on ice')
    await answer()
    await waitFor(() => expect(box).toHaveValue('A cold can on ice'))
  })

  it('does not change the prompt again after the user edits it', async () => {
    const { box, answer } = await open()
    await answer()
    await waitFor(() => expect(box).toHaveValue(NEW))
    await userEvent.type(box, ' On ice.')
    expect(box).toHaveValue(`${NEW} On ice.`)
  })
})
