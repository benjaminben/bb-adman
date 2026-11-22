// SH-6 (spec/phases/design-wave-screens-a.md, "SH-6 — Result notice and agent line"): the agent
// line draws the bot icon, hidden, in place of the dot; "Agent working: " is hidden words, so
// its text is still "Agent working: {tool} · {project}"; it holds no control and hides 10
// seconds after the last event. The result notice's ✕ is an icon button named and titled
// "Dismiss".
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityScope } from '@/renderer/app/activity-panel'
import { AgentActivity } from '@/renderer/app/agent-activity'
import { NavScope } from '@/renderer/app/nav-context'
import { ResultNotice } from '@/renderer/app/result-notice'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const PROJECT_ID = '01JD3MADEUPPROJECTID000001'
const project = { projectId: PROJECT_ID, name: 'Harbour Lights', filePath: '/made/up.adman' }

const activity = (tool: string): EventMap['agent.activity'] => ({
  tool,
  projectId: PROJECT_ID,
  ok: true,
  at: new Date().toISOString(),
})

afterEach(() => vi.useRealTimers())

async function line() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const fake = makeFakeApi(baseState({ openProjects: [project] }))
  const view = await renderApp(<AgentActivity />, fake)
  act(() => fake.emit('agent.activity', activity('get_project')))
  return view
}

function botMarkup() {
  const { container, unmount } = render(<Icon name="bot" />)
  const markup = container.querySelector('svg')!.innerHTML
  unmount()
  return markup
}

describe('agent line [SH-6]', () => {
  it('draws the bot icon hidden, in place of the dot', async () => {
    const bot = botMarkup()
    await line()
    const icon = screen.getByRole('status').querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon!.innerHTML).toBe(bot)
  })

  it('reads "Agent working: {tool} · {project}" with the first words hidden from view', async () => {
    await line()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/^Agent working: get_project · Harbour Lights$/)
    const hidden = screen.getByText('Agent working:', { exact: false })
    expect(hidden.textContent).toBe('Agent working: ')
    expect(hidden.className).toMatch(/hidden/)
    expect(status).not.toHaveTextContent('/made/up.adman')
    expect(status.innerHTML).not.toContain('/made/up.adman')
  })

  it('has no control and hides 10 seconds after the event', async () => {
    await line()
    const status = screen.getByRole('status')
    expect(status.querySelector('button, a, input, [tabindex]')).toBeNull()
    act(() => vi.advanceTimersByTime(9_999))
    expect(status).not.toBeEmptyDOMElement()
    act(() => vi.advanceTimersByTime(1))
    expect(status).toHaveTextContent('')
  })

  it('has no axe violations', async () => {
    await line()
    vi.useRealTimers()
    expect(await axeViolations()).toEqual([])
  })
})

describe('result notice dismiss [SH-6]', () => {
  async function notice() {
    const fake = makeFakeApi()
    const job = jobRow('J1', {
      status: 'running',
      layerId: 'L1',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const place = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }
    fake.onQuery('job.activity', () => ({ ok: true, data: [{ job, place }] }))
    await renderApp(
      <NavScope>
        <ActivityScope projectId="P1">
          <main>
            <ResultNotice projectId="P1" />
          </main>
        </ActivityScope>
      </NavScope>,
      fake,
    )
    await act(async () => {})
    const updatedAt = new Date(Date.now() + 1000).toISOString()
    act(() => fake.emit('job.updated', { ...job, status: 'succeeded', updatedAt }))
  }

  it('is an icon button named and titled "Dismiss"', async () => {
    await notice()
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(dismiss).toHaveAttribute('title', 'Dismiss')
    expect(dismiss).toHaveClass(layout.iconButton)
    expect(dismiss).not.toHaveClass(layout.iconOnly)
    expect(dismiss.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(await axeViolations()).toEqual([])
  })
})
