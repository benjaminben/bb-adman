// spec/editor.md, "The shell" [FR-003, FR-211, FR-242]: the project switcher, the campaign tabs
// of the shown project, Settings, and the error alert.
import { describe, it, expect } from 'vitest'
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/renderer/app/app-shell'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'
import { campaign, projectGet } from '../screens/project-home/project-fixture'

const two = [
  { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' },
  { projectId: 'P2', name: 'Winter', filePath: '/w/Winter.adman' },
]

function twoProjects() {
  const fake = makeFakeApi(baseState({ openProjects: two }))
  const campaigns = [campaign('C1', 'Summer Splash'), campaign('C2', 'Fall Harvest')]
  fake.onQuery('project.get', () => ({ ok: true, data: projectGet(campaigns) }))
  fake.onQuery('campaign.get', () => new Promise(() => {}))
  return fake
}

async function choose(menuButton: string, item: string) {
  // Two projects are open in these tests, so the switcher's name carries the count.
  await userEvent.click(screen.getByRole('button', { name: `${menuButton} 2 projects open` }))
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

const campaignTabs = () =>
  within(screen.getByRole('tablist', { name: 'Open campaigns' }))
    .getAllByRole('tab')
    .map((t) => t.textContent)

describe('the shell [FR-003]', () => {
  it('reaches every open project and the start screen from the switcher', async () => {
    const { store } = await renderApp(<AppShell />, twoProjects())
    await choose('Winter', 'Summer')
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
    expect(screen.getByRole('heading', { name: 'Summer' })).toBeInTheDocument()
    await choose('Summer', 'Winter')
    expect(screen.getByRole('heading', { name: 'Winter' })).toBeInTheDocument()
    await choose('Winter', 'Start screen')
    expect(store.getState().view).toEqual({ kind: 'start' })
    expect(screen.getByRole('button', { name: 'AdManager 2 projects open' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Open campaigns' })).toBeNull()
  })

  it('switches project by keyboard', async () => {
    const { store } = await renderApp(<AppShell />, twoProjects())
    screen.getByRole('button', { name: 'Winter 2 projects open' }).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Enter}')
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it.each([
    ['the switcher', () => choose('Winter', 'Close Winter')],
    [
      'the project page',
      () => userEvent.click(screen.getByRole('button', { name: 'Close Winter' })),
    ],
  ])('closes the shown project with project.close from %s', async (_, close) => {
    const fake = twoProjects()
    await renderApp(<AppShell />, fake)
    await close()
    expect(fake.commands).toContainEqual({ name: 'project.close', input: { projectId: 'P2' } })
  })

  it('opens settings from the toolbar', async () => {
    const { store } = await renderApp(<AppShell />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('shows a failed command message in an alert that can be dismissed', async () => {
    const fake = twoProjects()
    fake.onCommand('project.close', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That project is not open.' },
    }))
    await renderApp(<AppShell />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Close Winter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That project is not open.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('has no axe violations', async () => {
    await renderApp(<AppShell />, twoProjects())
    await screen.findByRole('button', { name: 'Open Summer Splash' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('the shell: campaign tabs [FR-211, FR-242]', () => {
  it('opens a campaign tab from the project page and keeps it per project', async () => {
    const { store } = await renderApp(<AppShell />, twoProjects())
    await userEvent.click(await screen.findByRole('button', { name: 'Open Fall Harvest' }))
    expect(await screen.findByRole('tab', { name: 'Fall Harvest' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('region', { name: 'Campaign' })).toBeInTheDocument()
    await choose('Winter', 'Summer')
    expect(campaignTabs()).toEqual(['Project'])
    act(() => store.getState().show({ kind: 'project', projectId: 'P2' }))
    await waitFor(() => expect(campaignTabs()).toEqual(['Project', 'Fall Harvest']))
    await userEvent.click(screen.getByRole('tab', { name: 'Project' }))
    expect(screen.getByRole('heading', { name: 'Winter' })).toBeInTheDocument()
  })

  it('steps through the campaign tabs with Mod+Shift+] and wraps', async () => {
    await renderApp(<AppShell />, twoProjects())
    await userEvent.click(await screen.findByRole('button', { name: 'Open Fall Harvest' }))
    await screen.findByRole('tab', { name: 'Fall Harvest' })
    fireEvent.keyDown(document.body, { code: 'BracketRight', ctrlKey: true, shiftKey: true })
    expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true')
  })
})

// ST-3 (spec/app-style.md, "App shell and tabs"): the icons are drawn beside the words and
// hidden from assistive tech, so every name stays what it was.
const icons = (el: HTMLElement) => [...el.querySelectorAll('svg')]

describe('the shell: icons beside the words [ST-3]', () => {
  it.each(['Settings', 'Activity'])('"%s" shows a hidden icon and keeps its name', async (name) => {
    await renderApp(<AppShell />)
    const button = screen.getByRole('button', { name })
    expect(icons(button)).toHaveLength(1)
    expect(icons(button)[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('the error alert shows a hidden icon and still reads the message', async () => {
    const fake = twoProjects()
    fake.onCommand('project.close', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That project is not open.' },
    }))
    await renderApp(<AppShell />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Close Winter' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That project is not open.')
    expect(icons(alert)[0]).toHaveAttribute('aria-hidden', 'true')
    expect(within(alert).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })
})
