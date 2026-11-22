// AP-10: Settings, the approvals service (spec/approvals.md "Settings", "Screens"). Made-up
// addresses and keys only; no test here contacts a service.
import { describe, it, expect } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { AppState } from '@/shared/schemas/queries/app'
import type { ErrorCode } from '@/shared/schemas/result'
import {
  APPROVALS_ADDRESS_MESSAGE,
  APPROVALS_FAILURE_MESSAGES,
  APPROVALS_REASON_MESSAGES,
} from '@/shared/approvals/messages'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const INTRO =
  "Share a campaign's variants with a password-protected link and see who signed off. The service runs on your own Vercel account."
const PICTURES = 'Gallery pictures are kept in your Amazon S3 bucket.'
const KEY_ROW = 'Service API key'

function approvalsState(baseUrl: string | null, secrets: AppState['secrets'] = []): AppState {
  const base = baseState()
  return { ...base, settings: { ...base.settings, approvals: { baseUrl } }, secrets }
}

async function section(state: AppState) {
  const fake = makeFakeApi(state)
  const { store } = await renderApp(<SettingsScreen page="publish" />, fake)
  store.getState().subscribe()
  const box = await screen.findByRole('region', { name: 'Approvals service' })
  return { fake, box }
}

// The address field is in the row's form, which starts closed once an address is saved.
const openRow = (box: HTMLElement) =>
  userEvent.click(within(box).getByRole('button', { name: 'Approvals', expanded: false }))

function refusal(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
  return () => ({ ok: false as const, error: { code, message, details } })
}

describe('settings: approvals service [AP-10]', () => {
  it('is mounted after Cloud storage', async () => {
    await section(approvalsState(null))
    const names = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'))
    const titles = names.map((id) => document.getElementById(id ?? '')?.textContent)
    expect(titles.indexOf('Approvals service')).toBe(titles.indexOf('Cloud storage') + 1)
  })

  it('shows the two lines the spec gives: the intro in the InfoTip, the pictures line', async () => {
    const { box } = await section(approvalsState(null))
    await userEvent.click(within(box).getByRole('button', { name: 'About approvals service' }))
    expect(within(box).getByText(INTRO)).toBeInTheDocument()
    expect(within(box).getByText(/Gallery pictures are kept in your/)).toHaveTextContent(PICTURES)
  })

  it('save sends approvals.setService with the typed address', async () => {
    const { fake, box } = await section(approvalsState(null))
    await userEvent.type(within(box).getByLabelText('Service address'), 'https://made-up.example')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    expect(fake.commands.filter((c) => c.name === 'approvals.setService')).toEqual([
      { name: 'approvals.setService', input: { address: 'https://made-up.example' } },
    ])
  })

  it('fills the field with the saved address and offers Remove', async () => {
    const { box } = await section(approvalsState('https://kept.example'))
    await openRow(box)
    expect(within(box).getByLabelText('Service address')).toHaveValue('https://kept.example')
    expect(within(box).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('offers no Remove when no address is saved', async () => {
    const { box } = await section(approvalsState(null))
    expect(within(box).queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it("a refused address shows the rule's sentence under the field and keeps the text", async () => {
    const fake = makeFakeApi(approvalsState(null))
    fake.onCommand('approvals.setService', refusal('INVALID_INPUT', APPROVALS_ADDRESS_MESSAGE))
    await renderApp(<SettingsScreen page="publish" />, fake)
    const box = await screen.findByRole('region', { name: 'Approvals service' })
    const field = within(box).getByLabelText('Service address')
    await userEvent.type(field, 'http://made-up.example/path')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    const line = await within(box).findByText(APPROVALS_ADDRESS_MESSAGE)
    expect(field).toHaveValue('http://made-up.example/path')
    expect(field.getAttribute('aria-describedby')).toBe(line.id)
  })

  it('Remove sends approvals.setService with null', async () => {
    const { fake, box } = await section(approvalsState('https://kept.example'))
    await openRow(box)
    await userEvent.click(within(box).getByRole('button', { name: 'Remove' }))
    expect(fake.commands).toContainEqual({
      name: 'approvals.setService',
      input: { address: null },
    })
  })

  it('the key is saved with secret.set and shown by its last four', async () => {
    const { fake, box } = await section(approvalsState(null))
    const row = within(box).getByRole('group', { name: KEY_ROW })
    await userEvent.click(within(row).getByRole('button', { name: 'Add key' }))
    const field = within(row).getByLabelText(`New ${KEY_ROW}`)
    expect(field).toHaveAttribute('type', 'password')
    await userEvent.type(field, 'made-up-approvals-key-K9QZ')
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.set',
      input: { name: 'approvals.apiKey', value: 'made-up-approvals-key-K9QZ' },
    })
    fake.setState(approvalsState(null, [{ name: 'approvals.apiKey', lastFour: 'K9QZ' }]))
    act(() => fake.emit('app.stateChanged', {}))
    expect(await within(row).findByText('•••K9QZ')).toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('made-up-approvals-key-K9QZ')
  })

  it('a saved key is removed with secret.delete', async () => {
    const { fake, box } = await section(
      approvalsState(null, [{ name: 'approvals.apiKey', lastFour: 'K9QZ' }]),
    )
    const row = within(box).getByRole('group', { name: KEY_ROW })
    await userEvent.click(within(row).getByRole('button', { name: 'Delete key' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.delete',
      input: { name: 'approvals.apiKey' },
    })
  })

  it.each([
    ['the service answers', () => ({ ok: true as const, data: { ok: true } }), 'Connected.'],
    [
      'it is not set up',
      refusal('RULE_VIOLATION', APPROVALS_REASON_MESSAGES.approvals_not_set_up, {
        reason: 'approvals_not_set_up',
      }),
      APPROVALS_REASON_MESSAGES.approvals_not_set_up,
    ],
    [
      'the key is refused',
      refusal('PROVIDER_ERROR', APPROVALS_FAILURE_MESSAGES.bad_key, { kind: 'bad_key' }),
      APPROVALS_FAILURE_MESSAGES.bad_key,
    ],
    [
      'the service is offline',
      refusal('PROVIDER_ERROR', APPROVALS_FAILURE_MESSAGES.offline, { kind: 'offline' }),
      APPROVALS_FAILURE_MESSAGES.offline,
    ],
  ])('Test connection when %s shows its line', async (_, answer, line) => {
    const fake = makeFakeApi(approvalsState('https://kept.example'))
    fake.onCommand('approvals.check', answer)
    await renderApp(<SettingsScreen page="publish" />, fake)
    const box = await screen.findByRole('region', { name: 'Approvals service' })
    await userEvent.click(within(box).getByRole('button', { name: 'Test connection' }))
    expect(fake.commands).toContainEqual({ name: 'approvals.check', input: {} })
    const status = await within(box).findByRole('status')
    expect(status).toHaveTextContent(line)
  })

  it('a new address clears an earlier Test connection line', async () => {
    const fake = makeFakeApi(approvalsState('https://kept.example'))
    fake.onCommand('approvals.check', () => ({ ok: true, data: { ok: true } }))
    await renderApp(<SettingsScreen page="publish" />, fake)
    const box = await screen.findByRole('region', { name: 'Approvals service' })
    await userEvent.click(within(box).getByRole('button', { name: 'Test connection' }))
    expect(await within(box).findByText('Connected.')).toBeInTheDocument()
    await openRow(box)
    await userEvent.click(within(box).getByRole('button', { name: 'Remove' }))
    expect(within(box).queryByText('Connected.')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const fake = makeFakeApi(
      approvalsState('https://kept.example', [{ name: 'approvals.apiKey', lastFour: 'K9QZ' }]),
    )
    fake.onCommand('approvals.setService', refusal('INVALID_INPUT', APPROVALS_ADDRESS_MESSAGE))
    await renderApp(<SettingsScreen page="publish" />, fake)
    const box = await screen.findByRole('region', { name: 'Approvals service' })
    await openRow(box)
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    await within(box).findByText(APPROVALS_ADDRESS_MESSAGE)
    expect(await axeViolations(box)).toEqual([])
  })
})
