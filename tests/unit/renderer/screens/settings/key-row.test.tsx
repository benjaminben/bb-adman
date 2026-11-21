import { describe, it, expect } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'
import type { Result } from '@/shared/schemas/result'

const TYPED = 'not-a-real-key-WXYZ'

function holdsTyped(row: HTMLElement): boolean {
  return Array.from(row.querySelectorAll('input')).some(
    (i) => i.value === TYPED || i.getAttribute('value') === TYPED,
  )
}

async function typeKey(fake: ReturnType<typeof makeFakeApi>) {
  const { store } = await renderApp(<SettingsScreen />, fake)
  store.getState().subscribe()
  const row = screen.getByRole('group', { name: 'Google Gemini API key' })
  await userEvent.click(within(row).getByRole('button', { name: 'Add' }))
  await userEvent.type(within(row).getByLabelText('New Google Gemini API key'), TYPED)
  return row
}

describe('settings key row: the typed key leaves the page before the row says saved [R-10]', () => {
  it('no input holds the typed key while the row says "Saved, ends in"', async () => {
    const fake = makeFakeApi()
    let reply: (r: Result<unknown>) => void = () => undefined
    fake.onCommand('secret.set', () => new Promise((resolve) => (reply = resolve)))
    const row = await typeKey(fake)
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))

    // The main process saves and announces the new state before the command reply arrives.
    fake.setState(baseState({ secrets: [{ name: 'gemini.apiKey', lastFour: 'WXYZ' }] }))
    act(() => fake.emit('app.stateChanged', {}))
    expect(await within(row).findByText('Saved, ends in WXYZ')).toBeInTheDocument()
    expect(holdsTyped(row)).toBe(false)
    expect(document.body.innerHTML).not.toContain(TYPED)

    await act(async () => reply({ ok: true, data: null }))
    expect(within(row).queryByLabelText('New Google Gemini API key')).toBeNull()
    expect(document.body.innerHTML).not.toContain(TYPED)
  })

  it('a refused save keeps the form open, empty, so the user can type and try again', async () => {
    const fake = makeFakeApi()
    fake.onCommand('secret.set', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'The key could not be saved.' },
    }))
    const row = await typeKey(fake)
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    const field = within(row).getByLabelText('New Google Gemini API key')
    expect(field).toHaveValue('')
    expect(within(row).getByText('Not set')).toBeInTheDocument()

    fake.onCommand('secret.set', () => ({ ok: true, data: null }))
    await userEvent.type(field, 'another-made-up-value')
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(fake.commands.filter((c) => c.name === 'secret.set').at(-1)).toEqual({
      name: 'secret.set',
      input: { name: 'gemini.apiKey', value: 'another-made-up-value' },
    })
    expect(within(row).queryByLabelText('New Google Gemini API key')).toBeNull()
  })
})
