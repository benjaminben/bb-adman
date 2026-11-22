// P7-22: the "Make a video" card reuses the commercial-licence dialog (D-088) as the other run
// dialogs do: a start refused with licence_not_confirmed opens it, Cancel sends nothing more,
// Confirm sends the start again with licenceConfirmed.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { P, renderWith, sent } from './campaign-fixture'
import { INFO, videoApi } from './video-fixture'

const TITLE =
  'Clipmaker 2 requires a commercial license, please confirm that you have one before production use'

const LICENCE = {
  ok: false as const,
  error: {
    code: 'INVALID_INPUT' as const,
    message: 'This model requires a commercial license.',
    details: { reason: 'licence_not_confirmed', workflow: 'h3-text-to-video' },
  },
}

async function startOnComfy() {
  const fake = videoApi()
  // The dialog names the model of the refused workflow from comfy.getInfo.
  const workflows = INFO.workflows.map((w) => ({ ...w, model: { label: 'Clipmaker 2' } }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: { ...INFO, workflows } }))
  fake.onCommand('generation.startVideo', (input) =>
    (input as { licenceConfirmed?: boolean }).licenceConfirmed ? { ok: true, data: null } : LICENCE,
  )
  await renderWith(
    <>
      <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
      <LicenceDialog />
      <ErrorBanner />
    </>,
    fake,
  )
  const p = within(await screen.findByRole('region', { name: 'Make a video' }))
  await userEvent.type(p.getByLabelText('Prompt'), 'A can')
  await userEvent.click(p.getByRole('button', { name: 'Start' }))
  const dialog = within(await screen.findByRole('dialog', { name: TITLE }))
  return { fake, dialog }
}

describe('"Make a video" and the licence dialog [P7-22, D-088]', () => {
  it('sends nothing more on Cancel', async () => {
    const { fake, dialog } = await startOnComfy()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
  })

  it('sends the start again with licenceConfirmed on Confirm', async () => {
    const { fake, dialog } = await startOnComfy()
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(sent(fake, 'generation.startVideo')).toHaveLength(2))
    expect(sent(fake, 'generation.startVideo')[1]?.input).toMatchObject({ licenceConfirmed: true })
  })
})
