// Design wave DLG-3a (spec/phases/design-wave-screens-b.md, "DLG-3a"): the key dialog and the
// address dialog take the `form` kind. Keys stay password fields and never show anywhere else;
// nothing is sent on Cancel, Escape or a click outside; Save sends what it sent before, once.
// The ComfyUI privacy paragraph stays on the page and is the address dialog's description.
import { describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyDialog } from '@/renderer/dialogs/key-dialog'
import { AddressDialog } from '@/renderer/dialogs/address-dialog'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import frame from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

const FAKE_KEY = 'fake-key-not-real'
const KEY_TIP =
  'The key is stored encrypted on this computer and is used only for actions you start.'

async function openKey(providerId: string, fake = makeFakeApi()) {
  const view = await renderApp(<KeyDialog />, fake)
  const provider = view.store.getState().app?.providers.find((p) => p.id === providerId)
  if (!provider) throw new Error(`no provider ${providerId}`)
  let saved: boolean | undefined
  act(() => {
    view.store.setState({ keyRequest: { provider, resolve: (s) => (saved = s) } })
  })
  return { ...view, fake, saved: () => saved }
}

async function openAddress(fake = makeFakeApi()) {
  const view = await renderApp(<AddressDialog />, fake)
  let saved: boolean | undefined
  act(() => {
    view.store.setState({ addressRequest: { resolve: (s) => (saved = s) } })
  })
  return { ...view, fake, saved: () => saved }
}

function cls(name: string | undefined): string {
  if (!name) throw new Error('missing class name')
  return name
}
const CONTENT = cls(frame.content)
const QUIET = cls(layout.quiet)
const PRIMARY = cls(layout.primary)

// Every attribute of every element in the page, as "name=value" texts.
function allAttributes(): string[] {
  return [...document.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes].map((a) => `${a.name}=${a.value}`),
  )
}

const pressEscape = () => userEvent.keyboard('{Escape}')
const clickOutside = () => {
  const overlay = document.querySelector(`.${frame.overlay}`)
  if (!overlay) throw new Error('no overlay')
  fireEvent.pointerDown(overlay, { button: 0 })
  fireEvent.click(overlay)
}
const pressCancel = () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

describe('key dialog on the form frame [DLG-3a]', () => {
  it('is a DialogFrame titled "{Provider} key" with Cancel (quiet) and Save (primary)', async () => {
    await openKey('gemini')
    const dialog = screen.getByRole('dialog', { name: 'Google Gemini key' })
    expect(dialog).toHaveClass(CONTENT)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveClass(QUIET)
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveClass(PRIMARY)
    expect(screen.queryByRole('button', { name: 'Save and continue' })).toBeNull()
  })

  it('keeps the old description sentence word for word in the tip "About keys"', async () => {
    await openKey('gemini')
    const dialog = screen.getByRole('dialog', { name: 'Google Gemini key' })
    expect(within(dialog).getByText(KEY_TIP)).not.toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'About keys' }))
    expect(within(dialog).getByText(KEY_TIP)).toBeVisible()
  })

  it('has one password field per secret, the first focused, and none filled in', async () => {
    await openKey('firefly')
    const id = screen.getByLabelText('Client ID')
    const secret = screen.getByLabelText('Client secret')
    for (const field of [id, secret]) {
      expect(field).toHaveAttribute('type', 'password')
      expect(field).toHaveValue('')
    }
    expect(id).toHaveFocus()
  })

  it('shows a typed key nowhere but as dots in its field', async () => {
    await openKey('gemini')
    const field = screen.getByLabelText('API key')
    await userEvent.type(field, FAKE_KEY)
    expect(field).toHaveAttribute('type', 'password')
    const dialog = screen.getByRole('dialog', { name: 'Google Gemini key' })
    expect(dialog).not.toHaveTextContent(FAKE_KEY)
    expect(field).not.toHaveAccessibleName(expect.stringContaining(FAKE_KEY))
    expect(field).not.toHaveAccessibleDescription(expect.stringContaining(FAKE_KEY))
    expect(allAttributes().filter((a) => a.includes(FAKE_KEY))).toEqual([])
  })

  it('Save sends exactly one secret.set per secret for one click, then reports the save', async () => {
    const view = await openKey('firefly')
    await userEvent.type(screen.getByLabelText('Client ID'), FAKE_KEY)
    await userEvent.type(screen.getByLabelText('Client secret'), `${FAKE_KEY}-2`)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(view.saved()).toBe(true))
    expect(view.fake.commands).toEqual([
      { name: 'secret.set', input: { name: 'firefly.clientId', value: FAKE_KEY } },
      { name: 'secret.set', input: { name: 'firefly.clientSecret', value: `${FAKE_KEY}-2` } },
    ])
  })

  it.each([
    ['Cancel', pressCancel],
    ['Escape', pressEscape],
    ['a click outside', clickOutside],
  ])('sends nothing on %s, even with a key typed', async (_how, leave) => {
    const view = await openKey('gemini')
    await userEvent.type(screen.getByLabelText('API key'), FAKE_KEY)
    await leave()
    await waitFor(() => expect(view.saved()).toBe(false))
    expect(view.fake.commands).toEqual([])
  })

  it('does not read a key back into the field when it opens again', async () => {
    const view = await renderApp(<KeyDialog />, makeFakeApi())
    const provider = view.store.getState().app?.providers.find((p) => p.id === 'gemini')
    if (!provider) throw new Error('no provider gemini')
    // As the app store does: an answer clears the request, which closes the dialog.
    const ask = () =>
      act(() => {
        view.store.setState({
          keyRequest: { provider, resolve: () => view.store.setState({ keyRequest: null }) },
        })
      })
    ask()
    await userEvent.type(screen.getByLabelText('API key'), FAKE_KEY)
    await pressCancel()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    ask()
    expect(await screen.findByLabelText('API key')).toHaveValue('')
  })

  it('shows a refusal as a danger alert and stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('secret.set', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'This computer cannot store keys securely.' },
    }))
    const view = await openKey('gemini', fake)
    await userEvent.type(screen.getByLabelText('API key'), FAKE_KEY)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This computer cannot store keys securely.')
    expect(view.saved()).toBeUndefined()
  })

  it('has no axe violations', async () => {
    await openKey('firefly')
    expect(await axeViolations()).toEqual([])
  })
})

describe('address dialog on the form frame [DLG-3a]', () => {
  it('is titled "ComfyUI address" with a placeholder, Cancel (quiet) and Save (primary)', async () => {
    await openAddress()
    const dialog = screen.getByRole('dialog', { name: 'ComfyUI address' })
    expect(dialog).toHaveClass(CONTENT)
    const field = within(dialog).getByLabelText('Server address')
    expect(field).toHaveAttribute('placeholder', 'http://127.0.0.1:8188')
    expect(dialog).not.toHaveTextContent('For example')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveClass(QUIET)
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveClass(PRIMARY)
  })

  it('shows the privacy paragraph word for word and is described by it', async () => {
    await openAddress()
    const dialog = screen.getByRole('dialog', { name: 'ComfyUI address' })
    expect(within(dialog).getByText(COMFY_PRIVACY)).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(COMFY_PRIVACY)
  })

  it('shows a refusal as a danger alert under the field, which describes the field', async () => {
    const refused = 'Enter an address that starts with http:// or https://.'
    const fake = makeFakeApi()
    fake.onCommand('comfy.setAddress', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: refused, details: { reason: 'address_scheme' } },
    }))
    const view = await openAddress(fake)
    const field = screen.getByLabelText('Server address')
    await userEvent.type(field, 'ftp://127.0.0.1:21')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(refused)
    expect(field.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(field).toHaveAccessibleDescription(refused)
    expect(view.saved()).toBeUndefined()
  })

  it('Save sends exactly one comfy.setAddress for one click', async () => {
    const view = await openAddress()
    await userEvent.type(screen.getByLabelText('Server address'), 'http://127.0.0.1:8188')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(view.saved()).toBe(true))
    expect(view.fake.commands).toEqual([
      { name: 'comfy.setAddress', input: { address: 'http://127.0.0.1:8188' } },
    ])
  })

  it.each([
    ['Cancel', pressCancel],
    ['Escape', pressEscape],
    ['a click outside', clickOutside],
  ])('sends nothing on %s, even with an address typed', async (_how, leave) => {
    const view = await openAddress()
    await userEvent.type(screen.getByLabelText('Server address'), 'http://127.0.0.1:8188')
    await leave()
    await waitFor(() => expect(view.saved()).toBe(false))
    expect(view.fake.commands).toEqual([])
  })

  it('has no axe violations', async () => {
    await openAddress()
    expect(await axeViolations()).toEqual([])
  })
})
