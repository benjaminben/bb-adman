// P10-7 (security review): Allow cannot be pressed for the first 750 ms after an ask is shown,
// so a click or key meant for something else cannot allow a delete that has no undo. Refuse and
// the tick work at once, a screen reader is told why Allow waits, and a new ask resets the wait.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']

const ask = (requestId: string): Ask => ({
  requestId,
  agentClient: null,
  action: 'delete campaigns',
  target: 'Campaign "Summer Splash!" (1 variant) in "Spring Work"',
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.useRealTimers()
})

async function open() {
  const fake = makeFakeApi()
  await renderApp(<PermissionDialog />, fake)
  act(() => fake.emit('agent.permissionRequested', ask('made-up-request-1')))
  const answers = () =>
    fake.commands.filter((c) => c.name === 'agent.answerPermission').map((c) => c.input)
  const allow = () => screen.getByRole('button', { name: 'Allow' })
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  return { fake, answers, allow, wait }
}

describe('permission dialog, the wait before Allow [P10-7]', () => {
  it('sends nothing for Allow at 0 ms and at 700 ms, and allows at 750 ms', async () => {
    const { answers, allow, wait } = await open()
    fireEvent.click(allow())
    expect(answers()).toEqual([])
    wait(700)
    fireEvent.click(allow())
    expect(answers()).toEqual([])
    wait(50)
    fireEvent.click(allow())
    expect(answers()).toEqual([
      { requestId: 'made-up-request-1', allow: true, rememberAuto: false },
    ])
  })

  it('tells a screen reader why Allow waits, keeps it in the tab order, and stays axe-clean', async () => {
    const { allow, wait } = await open()
    expect(allow()).toHaveAttribute('aria-disabled', 'true')
    expect(allow()).not.toBeDisabled()
    expect(allow()).toHaveAccessibleDescription('Allow can be pressed in a moment.')
    vi.useRealTimers()
    expect(await axeViolations()).toEqual([])
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    wait(0)
  })

  it('lets Refuse and the tick work at once', async () => {
    const { answers } = await open()
    const tick = screen.getByRole('checkbox', { name: "Don't ask again for deletes" })
    fireEvent.click(tick)
    expect(tick).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }))
    expect(answers()).toEqual([
      { requestId: 'made-up-request-1', allow: false, rememberAuto: false },
    ])
  })

  it('starts the wait again when a new ask is swapped in', async () => {
    const { fake, answers, allow, wait } = await open()
    wait(700)
    act(() => fake.emit('agent.permissionRequested', ask('made-up-request-2')))
    wait(100)
    fireEvent.click(allow())
    expect(answers()).toEqual([])
    wait(650)
    fireEvent.click(allow())
    expect(answers()).toEqual([
      { requestId: 'made-up-request-2', allow: true, rememberAuto: false },
    ])
  })
})
