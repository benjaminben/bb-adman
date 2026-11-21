import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

const withKey = () => baseState({ secrets: [{ name: 'gemini.apiKey', lastFour: '9xQ7' }] })

describe('settings: keys [FR-170, R-10, ADR-011]', () => {
  it('shows a saved key only by its last four characters', async () => {
    await renderApp(<SettingsScreen />, makeFakeApi(withKey()))
    const row = screen.getByRole('group', { name: 'Google Gemini API key' })
    expect(within(row).getByText('Saved, ends in 9xQ7')).toBeInTheDocument()
    expect(within(row).queryByRole('textbox')).toBeNull()
  })

  it('replaces a key through a password field, and the field is cleared afterwards', async () => {
    const fake = makeFakeApi(withKey())
    await renderApp(<SettingsScreen />, fake)
    const row = screen.getByRole('group', { name: 'Google Gemini API key' })
    await userEvent.click(within(row).getByRole('button', { name: 'Replace' }))
    const field = within(row).getByLabelText('New Google Gemini API key')
    expect(field).toHaveAttribute('type', 'password')
    await userEvent.type(field, 'new-key-value')
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.set',
      input: { name: 'gemini.apiKey', value: 'new-key-value' },
    })
    expect(within(row).queryByLabelText('New Google Gemini API key')).toBeNull()
  })

  it('deletes a saved key', async () => {
    const fake = makeFakeApi(withKey())
    await renderApp(<SettingsScreen />, fake)
    const row = screen.getByRole('group', { name: 'Google Gemini API key' })
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.delete',
      input: { name: 'gemini.apiKey' },
    })
  })

  it('lists a provider that is not available yet as such, with no key fields', async () => {
    await renderApp(<SettingsScreen />)
    const firefly = screen.getByRole('group', { name: 'Adobe Firefly' })
    expect(within(firefly).getByText('Not yet available')).toBeInTheDocument()
    expect(within(firefly).queryByRole('button')).toBeNull()
  })
})

describe('settings: default project location [FR-004]', () => {
  it('changes the default location through the folder dialog', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: '/Volumes/Work' } }))
    await renderApp(<SettingsScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Change default location' }))
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { defaultProjectDir: '/Volumes/Work' },
    })
  })
})

describe('settings: default providers [FR-067]', () => {
  it('offers each job its providers and disables those not yet available', async () => {
    const fake = makeFakeApi()
    await renderApp(<SettingsScreen />, fake)
    const image = screen.getByLabelText('Image generation')
    const options = within(image).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => [o.textContent, o.disabled])).toEqual([
      ['Google Gemini', false],
      ['Adobe Firefly (not yet available)', true],
    ])
    const video = within(screen.getByLabelText('Video generation'))
    expect(
      video.getByRole('option', { name: 'fal.ai Seedance (not yet available)' }),
    ).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Layout'), 'gemini')
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { defaultProviders: { layout: 'gemini' } },
    })
  })
})

describe('settings screen accessibility [SPEC 8.6]', () => {
  it('has no axe violations', async () => {
    await renderApp(<SettingsScreen />, makeFakeApi(withKey()))
    expect(await axeViolations()).toEqual([])
  })
})
