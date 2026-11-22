// P10-8 (spec/phases/phase-10.md, A-241): the line that says what an agent just did. It shows
// "Agent working: {tool}" and the project's name when the app store knows it, as text only, in
// a role="status" region with no control, and hides 10 seconds after the last event.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { AgentActivity } from '@/renderer/app/agent-activity'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

type Activity = EventMap['agent.activity']

const PROJECT_ID = '01JD3MADEUPPROJECTID000001'

const event = (overrides: Partial<Activity> = {}): Activity => ({
  tool: 'render_variant',
  projectId: null,
  ok: true,
  at: new Date().toISOString(),
  ...overrides,
})

afterEach(() => vi.useRealTimers())

async function shown(fake = makeFakeApi()) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const view = await renderApp(<AgentActivity />, fake)
  const send = (e: Activity) => act(() => fake.emit('agent.activity', e))
  const later = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  return { ...view, send, later }
}

describe('agent activity line [P10-8; A-241]', () => {
  it('shows nothing before an event', async () => {
    await shown()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('shows the tool, then hides 10 seconds after the last event', async () => {
    const { send, later } = await shown()
    send(event())
    expect(screen.getByRole('status')).toHaveTextContent('Agent working: render_variant')
    later(9_000)
    send(event({ tool: 'get_variant' }))
    later(9_000)
    expect(screen.getByRole('status')).toHaveTextContent('Agent working: get_variant')
    later(1_000)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it("adds the project's name from the open projects when it is known", async () => {
    const project = { projectId: PROJECT_ID, name: 'Spring Work', filePath: '/made/up.adman' }
    const fake = makeFakeApi(baseState({ openProjects: [project] }))
    const { send } = await shown(fake)
    send(event({ projectId: PROJECT_ID }))
    expect(screen.getByRole('status')).toHaveTextContent('Agent working: render_variant')
    expect(screen.getByRole('status')).toHaveTextContent('Spring Work')
    expect(screen.getByRole('status')).not.toHaveTextContent('/made/up.adman')
    send(event({ projectId: '01JD3MADEUPPROJECTID000002' }))
    expect(screen.getByRole('status')).toHaveTextContent(/^Agent working: render_variant$/)
  })

  it('draws a tool name with markup as text', async () => {
    const { send, container } = await shown()
    send(event({ tool: '<img src=x onerror=alert(1)><b>bold</b>' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Agent working: <img src=x onerror=alert(1)><b>bold</b>',
    )
    expect(container.querySelector('img, b')).toBeNull()
  })

  it('holds no control and has no axe violations', async () => {
    const { send } = await shown()
    send(event())
    expect(screen.getByRole('status').querySelector('button, a, input, [tabindex]')).toBeNull()
    vi.useRealTimers()
    expect(await axeViolations()).toEqual([])
  })
})
