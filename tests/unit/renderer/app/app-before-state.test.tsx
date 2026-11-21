import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('button', { name: 'Adman' })).toBeInTheDocument()
    await store.getState().refresh()
    expect(await screen.findByText('/Users/me/Documents/Adman Projects')).toBeInTheDocument()
  })
})
