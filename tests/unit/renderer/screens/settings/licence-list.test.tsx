// spec/screens-campaign.md, "Settings: confirmed licences" (S2-8) [D-088]: the saved model
// names as text, each with "Forget", which sends settings.update without that name.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { ErrorBanner } from '@/renderer/app/error-banner'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'
import { heldReply } from '../campaign/held-reply'

const EMPTY = 'You have not confirmed a commercial license for any model.'
const H3 = 'MiniMax H3'
const FLUX = 'FLUX 3 klein'
// A name from the settings file that looks like markup is drawn as text.
const MARKUP = '<b>Bold</b> model'

// A fake whose settings.update saves the list, as the real command does.
function licenceFake(saved: string[], answer?: () => Promise<Result<unknown>>) {
  const start = baseState()
  const fake = makeFakeApi(baseState({ settings: { ...start.settings, licenceConfirmed: saved } }))
  fake.onCommand('settings.update', async (input) => {
    const reply = answer ? await answer() : { ok: true as const, data: null }
    if (!reply.ok) return reply
    const { licenceConfirmed } = input as { licenceConfirmed: string[] }
    fake.setState(baseState({ settings: { ...start.settings, licenceConfirmed } }))
    return reply
  })
  return fake
}

async function list() {
  const heading = await screen.findByRole('heading', { name: 'Licences you confirmed', level: 3 })
  return within(heading.parentElement!)
}

const updates = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'settings.update').map((c) => c.input)

describe('Settings: confirmed licences [S2-8, D-088]', () => {
  it('lists each saved name as text, in saved order, with its own Forget button', async () => {
    await renderApp(<SettingsScreen />, licenceFake([H3, MARKUP, FLUX]))
    const box = await list()
    expect(box.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `${H3}Forget`,
      `${MARKUP}Forget`,
      `${FLUX}Forget`,
    ])
    expect(box.getByText(MARKUP)).toBeInTheDocument()
    expect(box.getByRole('button', { name: `Forget ${FLUX}` })).toBeInTheDocument()
  })

  it('sends settings.update without the name on Forget, and drops its row', async () => {
    const fake = licenceFake([H3, FLUX])
    await renderApp(<SettingsScreen />, fake)
    const box = await list()
    await userEvent.click(box.getByRole('button', { name: `Forget ${H3}` }))
    expect(updates(fake)).toEqual([{ licenceConfirmed: [FLUX] }])
    await waitFor(() => expect(box.queryByText(H3)).not.toBeInTheDocument())
    expect(box.getByText(FLUX)).toBeInTheDocument()
  })

  it('disables every Forget button while one is sent', async () => {
    const held = heldReply()
    await renderApp(<SettingsScreen />, licenceFake([H3, FLUX], held.answer))
    const box = await list()
    await userEvent.click(box.getByRole('button', { name: `Forget ${H3}` }))
    for (const name of [H3, FLUX]) {
      expect(box.getByRole('button', { name: `Forget ${name}` })).toBeDisabled()
    }
    held.release({ ok: true, data: null })
    await waitFor(() =>
      expect(box.getByRole('button', { name: `Forget ${FLUX}` })).not.toBeDisabled(),
    )
  })

  it('shows the empty sentence when no name is saved, and after the last is forgotten', async () => {
    await renderApp(<SettingsScreen />, licenceFake([H3]))
    const box = await list()
    expect(box.queryByText(EMPTY)).not.toBeInTheDocument()
    await userEvent.click(box.getByRole('button', { name: `Forget ${H3}` }))
    expect(await box.findByText(EMPTY)).toBeInTheDocument()
    expect(box.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows a refusal in the banner and as a line under the list, and keeps the row', async () => {
    const message = 'The settings could not be saved.'
    const refusal = async (): Promise<Result<unknown>> => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message },
    })
    const page = (
      <>
        <SettingsScreen />
        <ErrorBanner />
      </>
    )
    await renderApp(page, licenceFake([H3], refusal))
    const box = await list()
    await userEvent.click(box.getByRole('button', { name: `Forget ${H3}` }))
    expect(await box.findByText(message)).toBeInTheDocument()
    expect(screen.getAllByText(message)).toHaveLength(2)
    expect(box.getByText(H3)).toBeInTheDocument()
    expect(box.getByRole('button', { name: `Forget ${H3}` })).not.toBeDisabled()
  })

  it.each([
    ['two names', [H3, FLUX]],
    ['no name', []],
  ])('has no axe violations with %s', async (_, saved) => {
    await renderApp(<SettingsScreen />, licenceFake(saved))
    await list()
    expect(await axeViolations()).toEqual([])
  })
})
