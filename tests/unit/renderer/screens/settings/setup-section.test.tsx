// R2E-10 (spec/phases/round-2-editor.md D8): the Setup card in Settings opens the first-run
// setup at its welcome step whatever the mark says.
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirstRun, closeSetup } from '@/renderer/app/first-run'
import { SetupSection } from '@/renderer/screens/settings/setup-section'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi } from '../../fake-api'

afterEach(() => closeSetup())

describe('the Setup card [R2E-10, D8]', () => {
  it('opens the setup at the welcome step with the mark set', async () => {
    const fake = makeFakeApi()
    await renderApp(
      <>
        <SetupSection />
        <FirstRun />
      </>,
      fake,
    )
    expect(screen.getByRole('heading', { name: 'Setup', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Walk through adding keys again.')).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open the setup…' }))
    expect(screen.getByRole('dialog', { name: 'Set up AdManager' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open the setup…' })).toHaveFocus()
    expect(fake.commands).toEqual([{ name: 'settings.update', input: { setup: { done: true } } }])
  })
})
