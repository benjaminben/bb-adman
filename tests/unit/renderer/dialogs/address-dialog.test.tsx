import { describe, it, expect } from 'vitest'
import { screen, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressDialog } from '@/renderer/dialogs/address-dialog'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi } from '../fake-api'

const TITLE = "Enter your ComfyUI server's address"
const REFUSED = 'Enter an address that starts with http:// or https://.'

async function open(fake = makeFakeApi()) {
  const view = await renderApp(<AddressDialog />, fake)
  let saved: boolean | undefined
  act(() => {
    view.store.setState({ addressRequest: { resolve: (s) => (saved = s) } })
  })
  return { ...view, saved: () => saved }
}

describe('address dialog [S2-6, FR-255]', () => {
  it('shows the title, the privacy paragraph and an empty field with its hint', async () => {
    await open()
    const dialog = screen.getByRole('dialog', { name: TITLE })
    expect(dialog).toHaveTextContent(COMFY_PRIVACY)
    const field = screen.getByLabelText('Server address')
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('autocomplete', 'off')
    expect(field).toHaveAttribute('spellcheck', 'false')
    expect(field).toHaveAccessibleDescription(/For example http:\/\/127\.0\.0\.1:8188/)
  })

  it('puts focus on the field, then Cancel, then Save and continue', async () => {
    await open()
    expect(screen.getByLabelText('Server address')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save and continue' })).toHaveFocus()
  })

  it('saves the typed address with comfy.setAddress on Enter and reports the save', async () => {
    const fake = makeFakeApi()
    const view = await open(fake)
    await userEvent.type(screen.getByLabelText('Server address'), 'http://127.0.0.1:8188{Enter}')
    expect(fake.commands).toContainEqual({
      name: 'comfy.setAddress',
      input: { address: 'http://127.0.0.1:8188' },
    })
    await waitFor(() => expect(view.saved()).toBe(true))
  })

  it('shows a refused address under the field and stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('comfy.setAddress', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: REFUSED, details: { reason: 'address_scheme' } },
    }))
    const view = await open(fake)
    await userEvent.type(screen.getByLabelText('Server address'), 'ftp://127.0.0.1:21')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    const dialog = screen.getByRole('dialog', { name: TITLE })
    expect(await screen.findByLabelText('Server address')).toHaveAccessibleDescription(
      expect.stringContaining(REFUSED),
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(REFUSED)
    expect(view.saved()).toBeUndefined()
  })

  it('shows Saving… with both buttons disabled while the address is saved', async () => {
    const fake = makeFakeApi()
    let answer: (r: { ok: true; data: null }) => void = () => {}
    fake.onCommand('comfy.setAddress', () => new Promise((r) => (answer = r)))
    const view = await open(fake)
    await userEvent.type(screen.getByLabelText('Server address'), 'http://127.0.0.1:8188')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument()
    act(() => answer({ ok: true, data: null }))
    await waitFor(() => expect(view.saved()).toBe(true))
  })

  it.each([
    ['the Cancel button', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('reports a cancel by %s and sends nothing', async (_how, cancel) => {
    const fake = makeFakeApi()
    const view = await open(fake)
    await cancel()
    await waitFor(() => expect(view.saved()).toBe(false))
    expect(fake.commands).toEqual([])
  })

  it('has no axe violations', async () => {
    await open()
    expect(await axeViolations()).toEqual([])
  })
})
