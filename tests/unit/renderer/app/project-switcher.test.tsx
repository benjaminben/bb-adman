// spec/editor.md, "The shell" [FR-003]: a menu button showing the shown project's name, or
// "AdManager" on the start screen. Its menu lists the open projects, then "Start", then "Close
// project" for the shown one.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

const TWO = [
  { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' },
  { projectId: 'P2', name: 'Winter', filePath: '/w/Winter.adman' },
]

async function draw(shown: string | null = null) {
  const fake = makeFakeApi(baseState({ openProjects: TWO }))
  const view = await renderApp(
    <header>
      <ProjectSwitcher />
    </header>,
    fake,
  )
  // The app store shows the newest project on its first read; each test picks its own view.
  const next = shown ? { kind: 'project' as const, projectId: shown } : { kind: 'start' as const }
  act(() => view.store.getState().show(next))
  return { ...view, fake }
}

const items = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((i) => i.getAttribute('aria-label') ?? i.textContent)

describe('project switcher [FR-003]', () => {
  it.each([
    ['"AdManager" on the start screen', null, 'AdManager 2 projects open'],
    ['the shown project name', 'P2', 'Winter 2 projects open'],
  ])('shows %s', async (_, shown, label) => {
    await draw(shown)
    expect(await screen.findByRole('button', { name: label })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    )
  })

  it('lists the open projects with their Close items, then Package…, Open… and Start screen', async () => {
    await draw('P1')
    await userEvent.click(screen.getByRole('button', { name: 'Summer 2 projects open' }))
    expect(items()).toEqual([
      'Summer',
      'Close Summer',
      'Winter',
      'Close Winter',
      'Package…',
      'Open…',
      'Start screen',
    ])
    expect(screen.getByRole('menuitem', { name: 'Summer' })).toHaveFocus()
  })

  it('has no Package… item on the start screen', async () => {
    await draw()
    await userEvent.click(screen.getByRole('button', { name: 'AdManager 2 projects open' }))
    expect(items()).toEqual([
      'Summer',
      'Close Summer',
      'Winter',
      'Close Winter',
      'Open…',
      'Start screen',
    ])
  })

  it.each([
    ['a project shows it', 'Winter', { kind: 'project', projectId: 'P2' }],
    ['Start shows the start screen', 'Start screen', { kind: 'start' }],
  ])('choosing %s and closes the menu', async (_, item, view) => {
    const { store } = await draw('P1')
    await userEvent.click(screen.getByRole('button', { name: 'Summer 2 projects open' }))
    await userEvent.click(screen.getByRole('menuitem', { name: item }))
    expect(store.getState().view).toEqual(view)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes the shown project with project.close', async () => {
    const { fake } = await draw('P2')
    await userEvent.click(screen.getByRole('button', { name: 'Winter 2 projects open' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Close Winter' }))
    expect(fake.commands).toContainEqual({ name: 'project.close', input: { projectId: 'P2' } })
  })

  it('moves with the arrow keys, wraps, and Escape closes it and gives focus back', async () => {
    await draw('P1')
    const button = screen.getByRole('button', { name: 'Summer 2 projects open' })
    await userEvent.click(button)
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Close Summer' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Start screen' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('has no accessibility violations with the menu open', async () => {
    await draw('P1')
    await userEvent.click(screen.getByRole('button', { name: 'Summer 2 projects open' }))
    expect(await axeViolations()).toEqual([])
  })
})

describe('project switcher look [ST-3]', () => {
  it('shows a hidden caret beside the name and keeps the name', async () => {
    await draw('P2')
    const button = screen.getByRole('button', { name: 'Winter 2 projects open' })
    const caret = button.querySelectorAll('svg')
    expect(caret).toHaveLength(1)
    expect(caret[0]).toHaveAttribute('aria-hidden', 'true')
    expect(button).toHaveTextContent(/^Winter 2 projects open$/)
  })
})
