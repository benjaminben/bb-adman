// spec/phases/round-2-platform.md, D9 window side, as ruled for R2P-10: the start screen's
// "Recent" list shows the projects open now first, each with an accent dot and "Open now" as
// its tooltip and in its accessible name. Choosing one shows it; no file is opened again.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StartScreen } from '@/renderer/screens/start/start-screen'
import { axeViolations, renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'

const HARBOUR = { projectId: 'P2', name: 'Harbour Lights', filePath: '/w/Harbour Lights.adman' }
const MEADOW = { projectId: 'P3', name: 'Meadow Run', filePath: '/w/Meadow Run.adman' }
const recent = [
  { path: '/w/Spring Launch.adman', name: 'Spring Launch', openedAt: '2026-11-20T10:00:00.000Z' },
  { path: HARBOUR.filePath, name: 'Harbour Lights', openedAt: '2026-11-19T10:00:00.000Z' },
]

async function draw(openProjects = [HARBOUR, MEADOW], recentProjects = recent) {
  const fake = makeFakeApi(baseState({ openProjects, recentProjects }))
  const view = await renderApp(<StartScreen />, fake)
  act(() => view.store.getState().show({ kind: 'start' }))
  return { ...view, fake }
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Recent' }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'))

describe('open projects in the Recent list [R2P-10, D9]', () => {
  it('lists the open projects first, then the recent ones not open, each once', async () => {
    await draw()
    expect(rows()).toEqual([
      'Show Harbour Lights, open now',
      'Show Meadow Run, open now',
      'Open Spring Launch, /w/Spring Launch.adman',
    ])
  })

  it('marks an open project with "Open now" as its tooltip and a hidden dot', async () => {
    await draw()
    const row = screen.getByRole('button', { name: 'Show Meadow Run, open now' })
    expect(row).toHaveAttribute('title', 'Open now')
    expect(row.querySelector('[data-open-now]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: /^Open Spring Launch/ })).toHaveAttribute(
      'title',
      '/w/Spring Launch.adman',
    )
  })

  it('shows an open project when chosen, without opening its file again', async () => {
    const { fake, store } = await draw()
    await userEvent.click(screen.getByRole('button', { name: 'Show Harbour Lights, open now' }))
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
    expect(fake.commands).toEqual([])
  })

  it('shows the list for an open project when there is no recent one', async () => {
    await draw([MEADOW], [])
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument()
    expect(rows()).toEqual(['Show Meadow Run, open now'])
  })

  it('prints no path for an open project', async () => {
    const { container } = await draw([MEADOW], [])
    expect(container.textContent).toContain('Meadow Run')
    expect(container.textContent).not.toContain('/w/')
  })

  it('has no axe violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})
