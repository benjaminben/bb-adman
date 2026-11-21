import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StartScreen } from '@/renderer/screens/start/start-screen'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

const recent = [
  { path: '/w/Summer.adman', name: 'Summer', openedAt: '2026-11-20T10:00:00.000Z' },
  { path: '/w/Winter.adman', name: 'Winter', openedAt: '2026-11-19T10:00:00.000Z' },
]

describe('start screen [FR-002, FR-004]', () => {
  it('creates a project in the default location from settings', async () => {
    const fake = makeFakeApi()
    await renderApp(<StartScreen />, fake)
    expect(screen.getByText('/Users/me/Documents/Adman Projects')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Project name'), 'Summer Splash')
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }))
    expect(fake.commands).toContainEqual({
      name: 'project.create',
      input: { name: 'Summer Splash', location: '/Users/me/Documents/Adman Projects' },
    })
  })

  it('lets the user choose another location for one project', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: '/Volumes/Work' } }))
    await renderApp(<StartScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Change location' }))
    await userEvent.type(screen.getByLabelText('Project name'), 'A')
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }))
    expect(fake.commands).toContainEqual({
      name: 'project.create',
      input: { name: 'A', location: '/Volumes/Work' },
    })
  })

  it('opens a project file chosen in the system dialog', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickProjectFile', () => ({ ok: true, data: { path: '/w/X.adman' } }))
    await renderApp(<StartScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Open project…' }))
    expect(fake.commands).toContainEqual({
      name: 'project.open',
      input: { filePath: '/w/X.adman' },
    })
  })

  it('does nothing when the open dialog is cancelled', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickProjectFile', () => ({ ok: true, data: { path: null } }))
    await renderApp(<StartScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Open project…' }))
    expect(fake.commands).toEqual([])
  })

  it('lists recent projects and opens one', async () => {
    const fake = makeFakeApi(baseState({ recentProjects: recent }))
    await renderApp(<StartScreen />, fake)
    const items = screen.getAllByRole('button', { name: /^Open (Summer|Winter)/ })
    expect(items).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: /^Open Winter/ }))
    expect(fake.commands).toContainEqual({
      name: 'project.open',
      input: { filePath: '/w/Winter.adman' },
    })
  })

  it('says so when there are no recent projects', async () => {
    await renderApp(<StartScreen />)
    expect(screen.getByText('No recent projects yet.')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    await renderApp(<StartScreen />, makeFakeApi(baseState({ recentProjects: recent })))
    expect(await axeViolations()).toEqual([])
  })
})
