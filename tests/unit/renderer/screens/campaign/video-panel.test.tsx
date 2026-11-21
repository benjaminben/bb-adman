// SPEC 14 1.57 TP-6 "Where it lives" and "Commands": the "Make a video" card sends
// generation.startVideo for the chosen variant, prompt only; J-2 for the provider it starts on.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '../../../../../src/renderer/screens/campaign/campaign-view'
import { ErrorBanner } from '../../../../../src/renderer/app/error-banner'
import { axeViolations } from '../../render'
import { P, renderWith, sent } from './campaign-fixture'
import { REFUSED, heldReply } from './held-reply'
import { AFTER_RV1, COMFY, PAID_VIDEO, videoApi } from './video-fixture'

const view = (
  <>
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
    <ErrorBanner />
  </>
)

async function panel(fake = videoApi()) {
  await renderWith(view, fake)
  const p = within(await screen.findByRole('region', { name: 'Make a video' }))
  return { fake, p }
}

const start = (p: Awaited<ReturnType<typeof panel>>['p']) =>
  p.getByRole('button', { name: 'Start' })

describe('VideoPanel [SPEC 14 1.57 TP-6]', () => {
  it('shows the card under "Make pictures", with "Make a video" and Start', async () => {
    const { p } = await panel()
    const pictures = screen.getByRole('region', { name: 'Make pictures' })
    const video = screen.getByRole('region', { name: 'Make a video' })
    expect(pictures.nextElementSibling).toBe(video)
    expect(p.getByRole('heading', { name: 'Make a video' })).toBeInTheDocument()
    expect(start(p)).toBeInTheDocument()
  })

  it('sends generation.startVideo with the prompt, the chosen variant and the length', async () => {
    const { fake } = await panel()
    await userEvent.click(await screen.findByRole('radio', { name: /German post/ }))
    const q = within(await screen.findByRole('region', { name: 'Make a video' }))
    await userEvent.type(q.getByLabelText('Prompt'), 'A can rolls across a table')
    await userEvent.clear(q.getByLabelText('Length (seconds)'))
    await userEvent.type(q.getByLabelText('Length (seconds)'), '4')
    await userEvent.click(q.getByRole('button', { name: 'Start' }))
    expect(sent(fake, 'generation.startVideo').map((c) => c.input)).toEqual([
      {
        projectId: P,
        variantId: 'V2',
        prompt: 'A can rolls across a table',
        durationMs: 4000,
        provider: 'comfyui',
        start: 'none',
        useReferences: false,
        referenceAssetIds: [],
      },
    ])
  })

  it('starts with a length of 2 seconds, least 1, most from the prompt-only workflow', async () => {
    const { p } = await panel()
    const length = p.getByLabelText('Length (seconds)')
    expect(length).toHaveValue(2)
    expect(length).toHaveAttribute('min', '1')
    await waitFor(() => expect(length).toHaveAttribute('max', '15'))
  })

  it('disables Start with no prompt', async () => {
    const { p } = await panel()
    expect(start(p)).toBeDisabled()
    await userEvent.type(p.getByLabelText('Prompt'), '   ')
    expect(start(p)).toBeDisabled()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    expect(start(p)).toBeEnabled()
  })

  it('disables Start and says so with no video provider', async () => {
    const providers = AFTER_RV1.filter((p) => p.id !== 'comfyui')
    const { p } = await panel(videoApi({ providers }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    expect(p.getByText('No video provider is available.')).toBeInTheDocument()
    expect(start(p)).toBeDisabled()
  })

  it('offers only available video providers, and starts on ComfyUI when the saved default is not available [J-2]', async () => {
    const { p } = await panel()
    const select = p.getByLabelText('Provider')
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['ComfyUI'])
    expect(select).toHaveValue('comfyui')
  })

  it('starts on the saved default when it is available [J-2]', async () => {
    const { p } = await panel(videoApi({ providers: [...PAID_VIDEO, COMFY] }))
    expect(p.getByLabelText('Provider')).toHaveValue('fal-seedance')
  })

  it('shows the length note above the most, and sends the most', async () => {
    const { fake, p } = await panel()
    const length = p.getByLabelText('Length (seconds)')
    await waitFor(() => expect(length).toHaveAttribute('max', '15'))
    expect(p.queryByText(/The clip will be shorter/)).toBeNull()
    await userEvent.clear(length)
    await userEvent.type(length, '15')
    expect(p.queryByText(/The clip will be shorter/)).toBeNull()
    await userEvent.clear(length)
    await userEvent.type(length, '20')
    expect(p.getByText('The clip will be shorter: at most 15 s')).toBeInTheDocument()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({ durationMs: 15_000 })
  })

  it('refuses a length that is not a whole number of seconds, 1 or more, and sends nothing', async () => {
    const { fake, p } = await panel()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    for (const typed of ['0', '1.5']) {
      await userEvent.clear(p.getByLabelText('Length (seconds)'))
      await userEvent.type(p.getByLabelText('Length (seconds)'), typed)
      await userEvent.click(start(p))
      expect(p.getByRole('alert')).toHaveTextContent('Enter a whole number of seconds, 1 or more.')
    }
    expect(sent(fake, 'generation.startVideo')).toEqual([])
  })

  it('shows a refusal as the command gives it', async () => {
    const fake = videoApi()
    fake.onCommand('generation.startVideo', () => ({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'ComfyUI makes clips of at most 15 seconds with this workflow.',
        details: { reason: 'video_too_long', maxMs: 15_000 },
      },
    }))
    const { p } = await panel(fake)
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ComfyUI makes clips of at most 15 seconds with this workflow.',
    )
  })

  it('sends one start for two clicks, and enables Start again on the reply', async () => {
    const fake = videoApi()
    const held = heldReply()
    fake.onCommand('generation.startVideo', held.answer)
    const { p } = await panel(fake)
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.dblClick(start(p))
    expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
    expect(start(p)).toBeDisabled()
    held.release(REFUSED)
    await waitFor(() => expect(start(p)).toBeEnabled())
  })

  it('asks first for a paid provider, and sends only on Confirm', async () => {
    const { fake, p } = await panel(videoApi({ providers: PAID_VIDEO }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(p.getByText('This sends 1 paid request(s) to fal.ai Seedance.')).toBeInTheDocument()
    expect(sent(fake, 'generation.startVideo')).toEqual([])
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
  })

  it('shows no server address, reads no first frame or references, and has no axe problems', async () => {
    const { p } = await panel()
    await waitFor(() => expect(p.getByLabelText('Length (seconds)')).toHaveAttribute('max', '15'))
    expect(screen.queryByText(/192\.168/)).toBeNull()
    expect(p.queryByText(/first frame|reference/i)).toBeNull()
    expect(await axeViolations()).toEqual([])
  })
})
