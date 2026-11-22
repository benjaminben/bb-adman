// P10-7 (spec/phases/phase-10-slices.md; phase-10.md ask flow, A-238 to A-240): the dialog an
// agent's ask opens. Refuse is focused first, Escape refuses, the tick goes only with Allow,
// the client name and target from outside are drawn as text, and it closes at expiresAt.
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']

const TARGET = 'Campaign "Summer Splash!" (6 variants) in "Spring Work"'

function request(overrides: Partial<Ask> = {}): Ask {
  return {
    requestId: 'made-up-request-1',
    agentClient: null,
    action: 'delete campaigns',
    target: TARGET,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  }
}

async function open(ask: Ask = request(), fake = makeFakeApi()) {
  const view = await renderApp(<PermissionDialog />, fake)
  act(() => fake.emit('agent.permissionRequested', ask))
  const dialog = await screen.findByRole('dialog', { name: 'An agent asks to delete' })
  const answers = () => fake.commands.filter((c) => c.name === 'agent.answerPermission')
  return { ...view, dialog, answers }
}

// Allow waits 750 ms after the ask is shown (P10-7 review); these tests use real time.
async function allowReady() {
  const allow = screen.getByRole('button', { name: 'Allow' })
  await waitFor(() => expect(allow).not.toHaveAttribute('aria-disabled', 'true'), {
    timeout: 5000,
  })
  return allow
}

describe('permission dialog [P10-7]', () => {
  it('shows the ask in the spec words, with no axe violations', async () => {
    const { dialog } = await open()
    expect(dialog).toHaveTextContent(`An agent wants to delete campaigns: ${TARGET}.`)
    expect(dialog).toHaveTextContent('Answer within 2 minutes.')
    const tick = within(dialog).getByRole('checkbox', { name: "Don't ask again for deletes" })
    expect(tick).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: 'Refuse' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Allow' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('focuses Refuse first, so Enter refuses', async () => {
    const { answers } = await open()
    expect(screen.getByRole('button', { name: 'Refuse' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(answers()).toEqual([
        {
          name: 'agent.answerPermission',
          input: { requestId: 'made-up-request-1', allow: false, rememberAuto: false },
        },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('allows by the keyboard only through a deliberate path, the tick going with it', async () => {
    const { answers } = await open()
    const tick = screen.getByRole('checkbox', { name: "Don't ask again for deletes" })
    const allow = screen.getByRole('button', { name: 'Allow' })
    while (document.activeElement !== tick) await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(tick).toBeChecked()
    await allowReady()
    while (document.activeElement !== allow) await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-1', allow: true, rememberAuto: true },
      ]),
    )
  })

  it.each([
    ['Escape', () => userEvent.keyboard('{Escape}')],
    ['Refuse', () => userEvent.click(screen.getByRole('button', { name: 'Refuse' }))],
  ])('%s refuses and never sends the tick', async (_how, press) => {
    const { answers } = await open()
    await userEvent.click(screen.getByRole('checkbox', { name: "Don't ask again for deletes" }))
    await press()
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-1', allow: false, rememberAuto: false },
      ]),
    )
  })

  it('sends Allow without the tick when it is not ticked', async () => {
    const { answers } = await open()
    await userEvent.click(await allowReady())
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-1', allow: true, rememberAuto: false },
      ]),
    )
  })

  it('draws the client name and the target as text, the name as a value apart', async () => {
    const name = '<img src=x onerror="alert(1)"><b>Adman</b>'
    const target = 'Campaign "<i>x</i>" (2 variants) in "<script>bad()</script>"'
    const { dialog } = await open(request({ agentClient: name, target }))
    expect(dialog.querySelector('img, b, i, script')).toBeNull()
    expect(dialog).toHaveTextContent(`Agent named ${name} wants to delete campaigns: ${target}.`)
    const tag = within(dialog).getByText(name)
    expect(tag.tagName).toBe('SPAN')
    expect(tag.className).not.toBe('')
  })

  it('closes at expiresAt with nothing sent', async () => {
    const { answers } = await open(request({ expiresAt: new Date(Date.now() + 200).toISOString() }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(answers()).toEqual([])
  })

  it('does not open for a request that has already ended', async () => {
    const fake = makeFakeApi()
    await renderApp(<PermissionDialog />, fake)
    act(() =>
      fake.emit(
        'agent.permissionRequested',
        request({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      ),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the message of a refused answer, and Close then sends nothing more', async () => {
    const fake = makeFakeApi()
    fake.onCommand('agent.answerPermission', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    }))
    const { answers } = await open(request(), fake)
    await userEvent.click(await allowReady())
    expect(await screen.findByRole('alert')).toHaveTextContent('That request has ended.')
    expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(answers()).toHaveLength(1)
  })

  // P10-7b: what allowing costs, chosen from the fixed action, never from agent text.
  const VARIANT_COST = 'This cannot be undone. It also clears the undo list of this campaign.'
  const CAMPAIGN_COST = 'This cannot be undone.'
  const VARIANT_TARGET = 'Variant "Hero · 9x16 · de" in campaign "Summer Splash!" in "Spring Work"'

  it.each([
    [
      'a variant delete',
      request({ action: 'delete variants', target: VARIANT_TARGET }),
      VARIANT_COST,
    ],
    ['a campaign delete', request(), CAMPAIGN_COST],
  ])('says what allowing %s costs, as the dialog description', async (_case, ask, cost) => {
    const { dialog } = await open(ask)
    expect(dialog).toHaveAccessibleDescription(cost)
    expect(within(dialog).getByText(cost).tagName).toBe('P')
    expect(await axeViolations()).toEqual([])
  })

  it('keeps the campaign cost line whatever the agent name and target say', async () => {
    const words = 'delete variants. It also clears the undo list of this campaign.'
    const ask = request({ agentClient: words, target: `Campaign "${words}" in "${words}"` })
    const { dialog } = await open(ask)
    expect(dialog).toHaveAccessibleDescription(CAMPAIGN_COST)
  })

  it.each(['Adman', 'The user'])(
    'labels the client name %s as the agent name, not the app or the user',
    async (name) => {
      const { dialog } = await open(request({ agentClient: name }))
      expect(dialog).toHaveTextContent(`Agent named ${name} wants to delete campaigns: ${TARGET}.`)
      expect(within(dialog).getByText(name).tagName).toBe('SPAN')
    },
  )
})
