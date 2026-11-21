// SPEC 14 1.41 TP-2 "The panel": provider, slot, prompt and count, and the confirm step
// inside the panel before any paid run (the screen rule "A paid run starts only on the
// user's own confirm").
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { KeyDialog } from '@/renderer/dialogs/key-dialog'
import { prefilledPrompt } from '@/shared/generation/prompt'
import { baseState } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { LOCAL, P, campaignApi, renderWith, sent } from './campaign-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />

async function panel() {
  return within(await screen.findByRole('region', { name: 'Make pictures' }))
}

describe('GeneratePanel [SPEC 14 1.41 TP-2]', () => {
  it('offers only available picture providers, starting at the default', async () => {
    await renderWith(view)
    const select = (await panel()).getByLabelText('Provider')
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Google Gemini'])
    expect(select).toHaveValue('gemini')
  })

  it('offers the picture slots, the first one chosen, and no copy slot', async () => {
    await renderWith(view)
    const select = (await panel()).getByLabelText('Slot')
    const names = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(names).toEqual(['subject-image', 'logo'])
    expect(select).toHaveValue('subject-image')
  })

  it('fills the prompt from the campaign, and the count from the settings', async () => {
    await renderWith(view)
    const p = await panel()
    expect(p.getByLabelText('Prompt')).toHaveValue(
      prefilledPrompt({
        subjects: [{ name: 'Citrus can', description: 'A slim can' }],
        audience: 'Adults 21 to 35',
        region: 'US',
        message: '<b>Cool</b> down',
      }),
    )
    expect(p.getByLabelText('Pictures')).toHaveValue(4)
  })

  it('shows the confirm line on Generate with Gemini and sends nothing', async () => {
    const { fake } = await renderWith(view)
    await userEvent.click((await panel()).getByRole('button', { name: 'Generate' }))
    expect(
      await screen.findByText('This sends 4 paid request(s) to Google Gemini.'),
    ).toBeInTheDocument()
    expect(sent(fake, 'generation.runImages')).toEqual([])
  })

  it('sends generation.runImages on Confirm with the variant, slot, prompt, count and provider', async () => {
    const { fake } = await renderWith(view)
    const p = await panel()
    await userEvent.clear(p.getByLabelText('Prompt'))
    await userEvent.type(p.getByLabelText('Prompt'), 'A cold can')
    await userEvent.clear(p.getByLabelText('Pictures'))
    await userEvent.type(p.getByLabelText('Pictures'), '2')
    await userEvent.selectOptions(p.getByLabelText('Slot'), 'logo')
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'generation.runImages').map((c) => c.input)).toEqual([
      {
        projectId: P,
        variantId: 'V1',
        slot: 'logo',
        prompt: 'A cold can',
        referenceAssetIds: [],
        count: 2,
        provider: 'gemini',
      },
    ])
  })

  it('shows the started run when its row arrives, with no new job.list', async () => {
    const fake = campaignApi()
    fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J5' } }))
    await renderWith(view, fake)
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(sent(fake, 'generation.runImages')).toHaveLength(1))
    fake.emit('job.updated', jobRow('J5'))
    expect(await screen.findByText('Waiting')).toBeInTheDocument()
    expect(fake.queries.filter((q) => q.name === 'job.list')).toHaveLength(1)
  })

  it('names the provider the run goes to, even when the select changes after Generate [review DV-1]', async () => {
    const providers = baseState().providers.map((p) =>
      p.id === 'firefly' ? { ...p, available: true } : p,
    )
    const fake = campaignApi({ state: { providers } })
    await renderWith(view, fake)
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.selectOptions(p.getByLabelText('Provider'), 'firefly')
    expect(p.getByText('This sends 4 paid request(s) to Google Gemini.')).toBeInTheDocument()
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'generation.runImages').map((c) => c.input)).toMatchObject([
      { provider: 'gemini' },
    ])
  })

  it('sends nothing on Cancel and hides the confirm line', async () => {
    const { fake } = await renderWith(view)
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Cancel' }))
    expect(p.queryByText(/paid request/)).toBeNull()
    expect(sent(fake, 'generation.runImages')).toEqual([])
  })

  it('asks no confirm for a local provider', async () => {
    const state = baseState()
    const fake = campaignApi({ state: { providers: [LOCAL, ...state.providers] } })
    await renderWith(view, fake)
    const p = await panel()
    await userEvent.selectOptions(p.getByLabelText('Provider'), 'fake')
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    expect(sent(fake, 'generation.runImages')).toHaveLength(1)
  })

  it('shows the schema message for an empty prompt and sends nothing', async () => {
    const { fake } = await renderWith(view)
    const p = await panel()
    await userEvent.clear(p.getByLabelText('Prompt'))
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    expect(p.getByText('Enter a prompt.')).toBeInTheDocument()
    expect(p.queryByText(/paid request/)).toBeNull()
    expect(sent(fake, 'generation.runImages')).toEqual([])
  })

  it('opens the key dialog on NEEDS_KEY and sends the run again after a save', async () => {
    const fake = campaignApi()
    let calls = 0
    fake.onCommand('generation.runImages', () =>
      ++calls === 1
        ? {
            ok: false,
            error: { code: 'NEEDS_KEY', message: 'Add your key.', details: { provider: 'gemini' } },
          }
        : { ok: true, data: { jobId: 'J5' } },
    )
    await renderWith(
      <>
        {view}
        <KeyDialog />
      </>,
      fake,
    )
    const p = await panel()
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    await userEvent.type(await screen.findByLabelText('API key'), 'made-up-value')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() =>
      expect(fake.commands.map((c) => c.name)).toEqual([
        'generation.runImages',
        'secret.set',
        'generation.runImages',
      ]),
    )
  })
})
