import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../../../../../src/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { ADDRESS, comfyFake, info } from './comfy-fixture'

async function section() {
  return screen.findByRole('region', { name: 'ComfyUI server' })
}

describe('settings: the ComfyUI address [SPEC 14 1.41 TP-3]', () => {
  it('shows the saved address in full', async () => {
    const { fake } = comfyFake()
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    expect(await within(box).findByText(ADDRESS)).toBeInTheDocument()
    expect(fake.queries.some((q) => q.name === 'comfy.getInfo')).toBe(true)
  })

  it('says no address is saved when there is none, and Check is disabled', async () => {
    await renderApp(<SettingsScreen />, comfyFake(info({ address: null })).fake)
    const box = await section()
    expect(await within(box).findByText('No address saved.')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Check' })).toBeDisabled()
    expect(within(box).queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('Save sends the typed text and nothing else, and shows the new address', async () => {
    const { fake, setInfo } = comfyFake(info({ address: null }))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await userEvent.type(within(box).getByLabelText('Server address'), 'http://10.0.0.7:8188')
    setInfo(info({ address: 'http://10.0.0.7:8188' }))
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    const sent = fake.commands.filter((c) => c.name.startsWith('comfy.'))
    expect(sent).toEqual([{ name: 'comfy.setAddress', input: { address: 'http://10.0.0.7:8188' } }])
    expect(await within(box).findByText('http://10.0.0.7:8188')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Check' })).toBeEnabled()
  })

  it('a refused address shows the command sentence under the field and keeps the old address', async () => {
    const { fake } = comfyFake()
    const sentence = 'The address must start with http:// or https://.'
    fake.onCommand('comfy.setAddress', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: sentence, details: { reason: 'address_scheme' } },
    }))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await within(box).findByText(ADDRESS)
    await userEvent.type(within(box).getByLabelText('Server address'), 'ftp://x')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    const field = within(box).getByLabelText('Server address')
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
    expect(field).toHaveAccessibleDescription(sentence)
    expect(within(box).getByText(ADDRESS)).toBeInTheDocument()
  })

  it('Remove sends null', async () => {
    const { fake, setInfo } = comfyFake()
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await within(box).findByText(ADDRESS)
    setInfo(info({ address: null }))
    await userEvent.click(within(box).getByRole('button', { name: 'Remove' }))
    expect(fake.commands).toContainEqual({ name: 'comfy.setAddress', input: { address: null } })
    expect(await within(box).findByText('No address saved.')).toBeInTheDocument()
  })

  it('Save contacts nothing: it sends no check', async () => {
    const { fake } = comfyFake()
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await userEvent.type(within(box).getByLabelText('Server address'), 'http://10.0.0.8:8188')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    expect(fake.commands.some((c) => c.name === 'comfy.check')).toBe(false)
  })

  it('has no axe violations', async () => {
    await renderApp(<SettingsScreen />, comfyFake().fake)
    await within(await section()).findByText(ADDRESS)
    expect(await axeViolations()).toEqual([])
  })
})

describe('settings: the ComfyUI privacy note [SPEC 14 1.48 TL-1; 6.10.10]', () => {
  const NOTE =
    'When ComfyUI makes a picture or a video, your brief text, prompts and reference pictures are sent to the server at this address. Whoever runs that server can see them.'

  it('shows the note word for word when no address is saved', async () => {
    await renderApp(<SettingsScreen />, comfyFake(info({ address: null })).fake)
    const box = await section()
    await within(box).findByText('No address saved.')
    expect(within(box).getByText(NOTE)).toBeInTheDocument()
  })

  it('shows the same note, without the address, when one is saved', async () => {
    await renderApp(<SettingsScreen />, comfyFake().fake)
    const box = await section()
    await within(box).findByText(ADDRESS)
    const note = within(box).getByText(NOTE)
    expect(note.textContent).toBe(NOTE)
    expect(note.textContent).not.toContain(ADDRESS)
  })

  it('has no axe violations with the note and no saved address', async () => {
    await renderApp(<SettingsScreen />, comfyFake(info({ address: null })).fake)
    await within(await section()).findByText(NOTE)
    expect(await axeViolations()).toEqual([])
  })
})
