// SH-2 (spec/phases/design-wave-screens-a.md, "SH-2 — Settings has a way out", choice C-14):
// the Settings button toggles; Escape, "Close settings" and a campaign tab leave Settings; the
// campaign tabs stay drawn while Settings shows over a project; leaving returns to the view
// Settings was opened from, or the start screen when that project has closed.
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppShell } from '@/renderer/app/app-shell'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { campaign, projectGet } from '../screens/project-home/project-fixture'

const SUMMER = { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }

function oneProject() {
  const fake = makeFakeApi(baseState({ openProjects: [SUMMER] }))
  const campaigns = [campaign('C1', 'Summer Splash'), campaign('C2', 'Fall Harvest')]
  fake.onQuery('project.get', () => ({ ok: true, data: projectGet(campaigns) }))
  fake.onQuery('campaign.get', () => new Promise(() => {}))
  return fake
}

// The project with the "Fall Harvest" tab shown, then Settings opened from the top bar.
async function settingsOverCampaign() {
  const shown = await renderApp(<AppShell />, oneProject())
  await userEvent.click(await screen.findByRole('button', { name: 'Open Fall Harvest' }))
  await screen.findByRole('tab', { name: 'Fall Harvest' })
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('heading', { name: 'Settings', level: 1 })
  return shown
}

const settingsShown = () => screen.queryByRole('heading', { name: 'Settings', level: 1 }) !== null
const fallHarvestShown = () =>
  expect(screen.getByRole('tab', { name: 'Fall Harvest' })).toHaveAttribute('aria-selected', 'true')

describe('Settings over a project [SH-2, C-14]', () => {
  it('keeps the campaign tabs drawn and the view settings', async () => {
    const { store } = await settingsOverCampaign()
    const tabs = screen.getByRole('tablist', { name: 'Open campaigns' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Project', 'Fall Harvest'])
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('region', { name: 'Campaign' })).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it.each([
    [
      'a second click on Settings',
      () => userEvent.click(screen.getByRole('button', { name: 'Settings' })),
    ],
    ['Escape', () => userEvent.keyboard('{Escape}')],
    [
      'Close settings',
      () => userEvent.click(screen.getByRole('button', { name: 'Close settings' })),
    ],
    [
      'a click on the shown tab',
      () => userEvent.click(screen.getByRole('tab', { name: 'Fall Harvest' })),
    ],
  ])('returns to the same campaign tab after %s', async (_, leave) => {
    const { store } = await settingsOverCampaign()
    await leave()
    expect(settingsShown()).toBe(false)
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
    fallHarvestShown()
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('a click on another tab leaves and shows that tab', async () => {
    const { store } = await settingsOverCampaign()
    await userEvent.click(screen.getByRole('tab', { name: 'Project' }))
    expect(settingsShown()).toBe(false)
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
    expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Summer' })).toBeInTheDocument()
  })

  it('"Close settings" is an icon button named by its title', async () => {
    await settingsOverCampaign()
    const close = screen.getByRole('button', { name: 'Close settings' })
    expect(close).toHaveAttribute('title', 'Close settings')
    expect(close.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the start screen on leaving when the project closed meanwhile', async () => {
    const { store, fake } = await settingsOverCampaign()
    fake.setState(baseState({ openProjects: [] }))
    await act(() => store.getState().refresh())
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(settingsShown()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(store.getState().view).toEqual({ kind: 'start' })
  })
})

describe('Settings from the start screen [SH-2]', () => {
  it('returns to the start screen on leaving', async () => {
    const { store } = await renderApp(<AppShell />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
    await userEvent.keyboard('{Escape}')
    expect(store.getState().view).toEqual({ kind: 'start' })
    expect(settingsShown()).toBe(false)
  })
})

describe('Escape that something else takes [SH-2]', () => {
  it('closes only an open InfoTip', async () => {
    await settingsOverCampaign()
    const [about] = screen.getAllByRole('button', { name: /^About / }) as [HTMLElement]
    await userEvent.click(about)
    expect(about).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(about).toHaveAttribute('aria-expanded', 'false')
    expect(settingsShown()).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(settingsShown()).toBe(false)
  })

  it('closes only the open project menu', async () => {
    await settingsOverCampaign()
    // The switcher keeps its built behaviour in Settings: it names the app, not the project.
    await userEvent.click(screen.getByRole('button', { name: 'AdManager' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(settingsShown()).toBe(true)
  })

  it('stays while a dialog is open', async () => {
    await settingsOverCampaign()
    await userEvent.click(screen.getByRole('button', { name: 'Open the setup…' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(settingsShown()).toBe(true)
  })

  it('keeps a typed key: Escape in a key field with text does not leave', async () => {
    await settingsOverCampaign()
    const [addKey] = screen.getAllByRole('button', { name: 'Add key' }) as [HTMLElement]
    await userEvent.click(addKey)
    const field = document.querySelector<HTMLInputElement>('input[type="password"]')
    expect(field).not.toBeNull()
    await userEvent.type(field!, 'typed-key-value')
    fireEvent.keyDown(field!, { key: 'Escape' })
    expect(settingsShown()).toBe(true)
    expect(field!.value).toBe('typed-key-value')
  })
})

describe('"+" in Settings [SH-2]', () => {
  it('leaves Settings for the project home', async () => {
    const { store } = await settingsOverCampaign()
    await userEvent.click(screen.getByRole('button', { name: 'New campaign' }))
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
    expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('a field that saves on leaving [SH-2, SET-6]', () => {
  it('saves before Escape leaves Settings', async () => {
    const { fake } = await settingsOverCampaign()
    await userEvent.click(screen.getByRole('button', { name: 'Files' }))
    const quality = screen.getByRole('textbox', { name: 'Report name' })
    await userEvent.clear(quality)
    await userEvent.type(quality, 'Spring review')
    await userEvent.keyboard('{Escape}')
    expect(settingsShown()).toBe(false)
    expect(fake.commands.some((c) => c.name === 'settings.update')).toBe(true)
  })
})
