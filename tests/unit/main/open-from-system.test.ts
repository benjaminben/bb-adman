import { describe, expect, it, vi } from 'vitest'
import { systemOpener } from '@/main/open-from-system'
import type { BusEvent } from '@/main/commands/bus'
import { fail, ok } from '@/shared/schemas/result'

// spec/phases/round-2-platform.md D9 (R2P-9): a file the system hands the app goes through
// project.open; on success the window is told to show it, new or already open alike.
function setup(reply = ok({ projectId: 'p-1', name: 'Spring', filePath: '/a/Spring.adman' })) {
  const execute = vi.fn(async () => reply)
  const events: BusEvent[] = []
  const warn = vi.fn(async () => undefined)
  const mainWindow = vi.fn(() => 'win')
  let ready = false
  const opener = systemOpener({
    execute: () => (ready ? execute : null),
    mainWindow,
    emit: (e) => events.push(e),
    warn,
  })
  return { opener, execute, events, warn, mainWindow, setReady: () => (ready = true) }
}

describe('open from the system [R2P-9, D9]', () => {
  it('opens through project.open as the user and shows the project', async () => {
    const t = setup()
    t.setReady()
    await t.opener.open('/a/Spring.adman')
    expect(t.execute).toHaveBeenCalledWith(
      'project.open',
      { filePath: '/a/Spring.adman' },
      { actor: 'user' },
    )
    expect(t.mainWindow).toHaveBeenCalled()
    expect(t.events).toEqual([{ name: 'app.showProject', payload: { projectId: 'p-1' } }])
  })

  it('shows the refusal in a box and sends no show event', async () => {
    const t = setup(fail({ code: 'NOT_FOUND', message: 'The project file could not be found.' }))
    t.setReady()
    await t.opener.open('/a/Gone.adman')
    expect(t.warn).toHaveBeenCalledWith('win', 'The project file could not be found.')
    expect(t.events).toEqual([])
  })

  it('keeps opens that come before start-up and runs them once ready', async () => {
    const t = setup()
    await t.opener.open('/a/Early.adman')
    expect(t.execute).not.toHaveBeenCalled()
    expect(t.opener.pending).toEqual(['/a/Early.adman'])
    t.setReady()
    t.opener.openPending()
    await vi.waitFor(() => expect(t.events).toHaveLength(1))
    expect(t.opener.pending).toEqual([])
    expect(t.execute).toHaveBeenCalledTimes(1)
  })
})
