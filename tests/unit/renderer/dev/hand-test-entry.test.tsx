import { describe, it, expect } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '../../../../src/renderer/app/app-shell'
import { renderApp } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

describe('the hand-test screen is reachable only with devTools [SPEC 14 slice I, 13]', () => {
  it('has no hand-test button when app.getState says devTools is false', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ devTools: false })))
    expect(screen.queryByRole('button', { name: 'Hand test' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Hand test' })).toBeNull()
  })

  it('opens the hand-test screen from the toolbar when devTools is true', async () => {
    const { store } = await renderApp(<AppShell />, makeFakeApi(baseState({ devTools: true })))
    await userEvent.click(screen.getByRole('button', { name: 'Hand test' }))
    expect(store.getState().view).toEqual({ kind: 'handTest' })
    expect(screen.getByRole('heading', { name: 'Hand test' })).toBeInTheDocument()
  })

  it('does not show the screen even if asked for it while devTools is false', async () => {
    const { store } = await renderApp(<AppShell />, makeFakeApi(baseState({ devTools: false })))
    act(() => store.getState().show({ kind: 'handTest' }))
    expect(screen.queryByRole('heading', { name: 'Hand test' })).toBeNull()
  })
})
