import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '@/renderer/app/app-context'
import { AppShell } from '@/renderer/app/app-shell'
import { createAppStore } from '@/renderer/stores/app-store'
import { makeFakeApi } from '../fake-api'

describe('app window before app.getState has answered', () => {
  it('renders the shell and the start screen without looping', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    render(
      <AppProvider api={fake.api} store={store}>
        <AppShell />
      </AppProvider>,
    )
    // START-2: the start screen has no top bar; its own buttons show at once.
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
    await store.getState().refresh()
    await userEvent.click(screen.getByRole('button', { name: 'New project' }))
    expect(
      await screen.findByRole('button', {
        name: 'Location: /Users/me/Documents/Adman Projects. Change',
      }),
    ).toBeInTheDocument()
  })
})
