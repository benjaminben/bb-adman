import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '../../../../src/renderer/app/app-shell'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

const two = [
  { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' },
  { projectId: 'P2', name: 'Winter', filePath: '/w/Winter.adman' },
]

describe('project tabs [FR-003]', () => {
  it('shows one tab per open project beside the start tab', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ openProjects: two })))
    const tabs = within(screen.getByRole('tablist', { name: 'Open projects' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Start', 'Summer', 'Winter'])
  })

  it('switches to a project tab by click and by keyboard', async () => {
    const { store } = await renderApp(<AppShell />, makeFakeApi(baseState({ openProjects: two })))
    await userEvent.click(screen.getByRole('tab', { name: 'Summer' }))
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
    expect(screen.getByRole('heading', { name: 'Summer' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}')
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
  })

  it('closes a project from its tab with project.close', async () => {
    const fake = makeFakeApi(baseState({ openProjects: two }))
    await renderApp(<AppShell />, fake)
    await userEvent.click(screen.getByRole('tab', { name: 'Winter' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close Winter' }))
    expect(fake.commands).toContainEqual({ name: 'project.close', input: { projectId: 'P2' } })
  })

  it('opens settings from the toolbar', async () => {
    const { store } = await renderApp(<AppShell />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('shows a failed command message in an alert that can be dismissed', async () => {
    const fake = makeFakeApi(baseState({ openProjects: two }))
    fake.onCommand('project.close', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That project is not open.' },
    }))
    await renderApp(<AppShell />, fake)
    await userEvent.click(screen.getByRole('tab', { name: 'Summer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close Summer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That project is not open.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('has no axe violations', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ openProjects: two })))
    expect(await axeViolations()).toEqual([])
  })
})
