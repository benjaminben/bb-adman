import { describe, it, expect } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyDialog } from '../../../../src/renderer/dialogs/key/key-dialog'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi } from '../fake-api'

async function openFor(providerId: string, fake = makeFakeApi()) {
  const view = await renderApp(<KeyDialog />, fake)
  const provider = view.store.getState().app?.providers.find((p) => p.id === providerId)
  if (!provider) throw new Error(`no provider ${providerId}`)
  let saved: boolean | undefined
  act(() => {
    view.store.setState({ keyRequest: { provider, resolve: (s) => (saved = s) } })
  })
  return { ...view, saved: () => saved }
}

describe('key dialog, NEEDS_KEY flow [FR-171, FR-172]', () => {
  it('asks for each key the provider needs, in password fields', async () => {
    await openFor('firefly')
    expect(screen.getByRole('dialog', { name: 'Add your Adobe Firefly key' })).toBeInTheDocument()
    expect(screen.getByLabelText('Client ID')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Client secret')).toHaveAttribute('type', 'password')
  })

  it('saves the key with secret.set and reports success so the action can retry', async () => {
    const fake = makeFakeApi()
    const view = await openFor('gemini', fake)
    await userEvent.type(screen.getByLabelText('API key'), 'abc-123-key')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.set',
      input: { name: 'gemini.apiKey', value: 'abc-123-key' },
    })
    await waitFor(() => expect(view.saved()).toBe(true))
  })

  it('shows the message and stays open when the key cannot be stored', async () => {
    const fake = makeFakeApi()
    fake.onCommand('secret.set', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'This computer cannot store keys securely.' },
    }))
    const view = await openFor('gemini', fake)
    await userEvent.type(screen.getByLabelText('API key'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByText('This computer cannot store keys securely.')).toBeInTheDocument()
    expect(view.saved()).toBeUndefined()
  })

  it('reports a cancel by Escape, so the user can carry on by hand', async () => {
    const view = await openFor('gemini')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(view.saved()).toBe(false))
  })

  it('reports a cancel by the Cancel button', async () => {
    const view = await openFor('gemini')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(view.saved()).toBe(false))
  })

  it('has no axe violations', async () => {
    await openFor('gemini')
    expect(await axeViolations()).toEqual([])
  })
})
