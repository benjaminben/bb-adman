// START-2 (spec/phases/design-wave-screens-a.md, "START-2 — The rest of the start screen"): no top
// bar on the start screen, Activity and Settings in the right half's corner, and "New project"
// as one row in place: a name field, a folder button whose name holds the folder, and Create.
// No path is printed on the page.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/renderer/app/app-shell'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const DEFAULT_DIR = '/Users/me/Documents/Adman Projects'
const OTHER_DIR = '/Volumes/Work'
const recent = [{ path: '/w/Summer.adman', name: 'Summer', openedAt: '2026-11-20T10:00:00.000Z' }]

const startHalf = () => screen.getByRole('region', { name: 'AdManager' })
const location = (dir: string) => `Location: ${dir}. Change`

async function openRow() {
  await userEvent.click(screen.getByRole('button', { name: 'New project' }))
  return screen.getByRole('textbox', { name: 'Project name' })
}

// Every element's own text (not its tooltip or accessible name) and every data- attribute.
function printedText(root: Element): string[] {
  const out: string[] = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const node of el.childNodes) if (node.nodeType === 3) out.push(node.textContent ?? '')
    for (const attr of el.attributes) if (attr.name.startsWith('data-')) out.push(attr.value)
    if (el instanceof HTMLInputElement) out.push(el.value, el.placeholder)
  }
  return out.filter((t) => t.trim() !== '')
}

describe('the start screen has no top bar [START-2, C-6]', () => {
  it('draws no banner and no project switcher', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ recentProjects: recent })))
    expect(screen.queryByRole('banner')).toBeNull()
    expect(document.querySelector('button[aria-haspopup="menu"]')).toBeNull()
  })

  it('has Activity and Settings in the right half, and they work', async () => {
    const { store } = await renderApp(<AppShell />)
    const half = startHalf()
    const activity = within(half).getByRole('button', { name: 'Activity' })
    await userEvent.click(activity)
    expect(activity).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Activity' })).toBeInTheDocument()
    await userEvent.click(within(half).getByRole('button', { name: 'Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
  })

  it.each([
    ['Escape', () => userEvent.keyboard('{Escape}')],
    [
      'the close button',
      () => userEvent.click(screen.getByRole('button', { name: 'Close settings' })),
    ],
    [
      'the Settings button',
      () => userEvent.click(screen.getByRole('button', { name: 'Settings' })),
    ],
  ])('Settings opened here has the bar and returns here by %s [SH-2]', async (_, leave) => {
    const { store } = await renderApp(<AppShell />)
    await userEvent.click(within(startHalf()).getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'true')
    await leave()
    expect(store.getState().view).toEqual({ kind: 'start' })
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
  })
})

describe('New project in place [START-2]', () => {
  it('shows New project and Open… as the two buttons', async () => {
    await renderApp(<AppShell />)
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open…' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('swaps in the row with the name field focused', async () => {
    await renderApp(<AppShell />)
    const field = await openRow()
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('placeholder', 'Project name')
    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open…' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('names the default folder in the folder button, and a chosen one after Change', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: OTHER_DIR } }))
    await renderApp(<AppShell />, fake)
    await openRow()
    const folder = screen.getByRole('button', { name: location(DEFAULT_DIR) })
    expect(folder).toHaveAttribute('title', location(DEFAULT_DIR))
    await userEvent.click(folder)
    expect(screen.getByRole('button', { name: location(OTHER_DIR) })).toHaveAttribute(
      'title',
      location(OTHER_DIR),
    )
  })

  it.each([
    ['Create', () => userEvent.click(screen.getByRole('button', { name: 'Create' }))],
    ['Enter', () => userEvent.keyboard('{Enter}')],
  ])('sends project.create once with the name and folder on %s', async (_, send) => {
    const fake = makeFakeApi()
    fake.onCommand('project.create', () => new Promise(() => {}))
    await renderApp(<AppShell />, fake)
    await userEvent.type(await openRow(), 'Summer Splash')
    await send()
    await send()
    expect(fake.commands).toEqual([
      { name: 'project.create', input: { name: 'Summer Splash', location: DEFAULT_DIR } },
    ])
  })

  it('sends nothing for an empty name', async () => {
    const fake = makeFakeApi()
    await renderApp(<AppShell />, fake)
    await openRow()
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(fake.commands).toEqual([])
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveFocus()
  })

  it('keeps a refusal under the row as words, with the typed name kept', async () => {
    const fake = makeFakeApi()
    const message = 'A file with this name already exists in that folder.'
    fake.onCommand('project.create', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message },
    }))
    await renderApp(<AppShell />, fake)
    await userEvent.type(await openRow(), 'Summer')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(within(startHalf()).getByRole('alert')).toHaveTextContent(message)
    expect(screen.getAllByText(message)).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('Summer')
  })

  it('Escape brings the two buttons back and focus goes to New project', async () => {
    await renderApp(<AppShell />)
    await userEvent.type(await openRow(), 'Half typed')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'New project' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Open…' })).toBeInTheDocument()
  })

  it('leaving the row with an empty field brings the two buttons back', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ recentProjects: recent })))
    await openRow()
    await userEvent.click(screen.getByRole('button', { name: location(DEFAULT_DIR) }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
  })

  it('prints no path, in either state', async () => {
    const fake = makeFakeApi(baseState({ recentProjects: recent }))
    fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: OTHER_DIR } }))
    await renderApp(<AppShell />, fake)
    const noPath = () =>
      expect(printedText(document.body).filter((t) => /[/\\]/.test(t))).toEqual([])
    noPath()
    await openRow()
    noPath()
    await userEvent.click(screen.getByRole('button', { name: location(DEFAULT_DIR) }))
    noPath()
  })

  it('has no axe violations in both states', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ recentProjects: recent })))
    expect(await axeViolations()).toEqual([])
    await openRow()
    expect(await axeViolations()).toEqual([])
  })
})
