// SPEC 14 1.48 TL-2 "one run per click": from the moment generation.runImages is sent until
// its reply arrives, Generate is disabled, for every provider. The paid confirm step is
// unchanged: Confirm still sends the held request and the line closes.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import type { Result } from '@/shared/schemas/result'
import { baseState } from '../../fake-api'
import { LOCAL, P, campaignApi, renderWith, sent } from './campaign-fixture'
import { REFUSED, heldReply } from './held-reply'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J5' } }

async function panel() {
  return within(await screen.findByRole('region', { name: 'Make pictures' }))
}

async function localPanel() {
  const fake = campaignApi({ state: { providers: [LOCAL, ...baseState().providers] } })
  const held = heldReply()
  fake.onCommand('generation.runImages', held.answer)
  await renderWith(view, fake)
  const p = await panel()
  await userEvent.selectOptions(p.getByLabelText('Provider'), 'fake')
  return { fake, held, p }
}

async function paidPanel() {
  const fake = campaignApi()
  const held = heldReply()
  fake.onCommand('generation.runImages', held.answer)
  await renderWith(view, fake)
  const p = await panel()
  await userEvent.click(p.getByRole('button', { name: 'Generate' }))
  return { fake, held, p }
}

describe('GeneratePanel, one run per click [SPEC 14 1.48 TL-2]', () => {
  for (const [name, reply] of [
    ['a start', STARTED],
    ['a refusal', REFUSED],
  ] as const) {
    it(`sends one run for two clicks on Generate with a local provider, enabled again on ${name}`, async () => {
      const { fake, held, p } = await localPanel()
      const generate = p.getByRole('button', { name: 'Generate' })
      await userEvent.dblClick(generate)
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
      expect(generate).toBeDisabled()
      held.release(reply)
      await waitFor(() => expect(generate).toBeEnabled())
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
    })

    it(`sends one run for two clicks on Confirm with a paid provider, enabled again on ${name}`, async () => {
      const { fake, held, p } = await paidPanel()
      await userEvent.dblClick(p.getByRole('button', { name: 'Confirm' }))
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
      const generate = p.getByRole('button', { name: 'Generate' })
      expect(generate).toBeDisabled()
      await userEvent.click(generate)
      expect(p.queryByText(/paid request/)).toBeNull()
      held.release(reply)
      await waitFor(() => expect(generate).toBeEnabled())
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
    })
  }

  it('still asks the confirm line again after the reply, and sends nothing until Confirm', async () => {
    const { fake, held, p } = await paidPanel()
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    held.release(STARTED)
    const generate = p.getByRole('button', { name: 'Generate' })
    await waitFor(() => expect(generate).toBeEnabled())
    await userEvent.click(generate)
    expect(p.getByText('This sends 4 paid request(s) to Google Gemini.')).toBeInTheDocument()
    expect(sent(fake, 'generation.runImages')).toHaveLength(1)
  })
})
