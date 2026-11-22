// spec/phases/round-2-platform.md, D9 window side: with two or more open the switcher's button
// adds " · {n} open"; its menu has "Open another project…", which opens the picked file and
// shows it while the first stays open.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

const SPRING = { projectId: 'P1', name: 'Spring Launch', filePath: '/w/Spring Launch.adman' }
const HARBOUR = { projectId: 'P2', name: 'Harbour Lights', filePath: '/w/Harbour Lights.adman' }

async function draw(openProjects = [SPRING]) {
  const fake = makeFakeApi(baseState({ openProjects }))
  const view = await renderApp(
    <header>
      <ProjectSwitcher />
    </header>,
    fake,
  )
  act(() => view.store.getState().show({ kind: 'project', projectId: 'P1' }))
  return { ...view, fake }
}

describe('project switcher with several projects [R2P-10, D9]', () => {
  it.each([
    ['one open: the name alone', [SPRING], 'Spring Launch'],
    ['two open: the name and the count', [SPRING, HARBOUR], 'Spring Launch 2 projects open'],
  ])('labels the button with %s', async (_, open, name) => {
    await draw(open)
    expect(screen.getByRole('button', { name })).toHaveTextContent(name)
  })

  it('opens another project from the menu and shows it, the first staying in the list', async () => {
    const { fake, store } = await draw()
    fake.onQuery('dialog.pickProjectFile', () => ({
      ok: true,
      data: { path: HARBOUR.filePath },
    }))
    fake.onCommand('project.open', () => {
      fake.setState(baseState({ openProjects: [SPRING, HARBOUR] }))
      return { ok: true, data: HARBOUR }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Spring Launch' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open…' }))
    expect(fake.commands).toContainEqual({
      name: 'project.open',
      input: { filePath: HARBOUR.filePath },
    })
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
    await userEvent.click(screen.getByRole('button', { name: 'Harbour Lights 2 projects open' }))
    const names = within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .map((i) => i.getAttribute('aria-label') ?? i.textContent)
    expect(names.slice(0, 4)).toEqual([
      'Spring Launch',
      'Close Spring Launch',
      'Harbour Lights',
      'Close Harbour Lights',
    ])
  })

  it('opens nothing when the picker is cancelled', async () => {
    const { fake, store } = await draw()
    fake.onQuery('dialog.pickProjectFile', () => ({ ok: true, data: { path: null } }))
    await userEvent.click(screen.getByRole('button', { name: 'Spring Launch' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open…' }))
    expect(fake.commands).toEqual([])
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })
})
