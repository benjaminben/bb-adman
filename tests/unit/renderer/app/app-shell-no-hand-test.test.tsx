// P9-14: the hand-test screen is removed. With the dev tools on, the top row shows no
// "Hand test" button and no screen of that name; Settings is still there.
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { AppShell } from '@/renderer/app/app-shell'
import { renderApp } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

describe('the shell has no hand-test screen [P9-14]', () => {
  it('shows no "Hand test" button or heading with dev tools on', async () => {
    await renderApp(<AppShell />, makeFakeApi(baseState({ devTools: true })))
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hand test' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Hand test' })).toBeNull()
  })
})
