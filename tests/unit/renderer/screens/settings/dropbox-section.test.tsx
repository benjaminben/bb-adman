// P9-6: the Dropbox part of "Cloud storage" (spec/phases/phase-09.md "Screens"). The commands
// are answered by the fake API: no sign-in runs, no browser opens, nothing leaves. Made-up
// account names only.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { AppState } from '@/shared/schemas/queries/app'
import type { Result } from '@/shared/schemas/result'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const WAITING = 'Waiting for you to finish in the browser…'
const TOKEN = { name: 'dropbox.refreshToken', lastFour: '' } as const

function dropboxState(dropbox: AppState['settings']['storage']['dropbox']): AppState {
  const base = baseState()
  return {
    ...base,
    settings: { ...base.settings, storage: { s3: null, dropbox } },
    secrets: dropbox === null ? [] : [TOKEN],
  }
}

const signedIn = (accountName: string, rootPath = '') => dropboxState({ accountName, rootPath })

function refusal(reason: string, message: string): Result<unknown> {
  return { ok: false, error: { code: 'RULE_VIOLATION', message, details: { reason } } }
}

async function open(state: AppState) {
  const fake = makeFakeApi(state)
  const { store } = await renderApp(<SettingsScreen />, fake)
  store.getState().subscribe()
  const box = await screen.findByRole('group', { name: 'Dropbox' })
  return { fake, box }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name)

describe('settings: Dropbox, signed out [P9-6]', () => {
  it('shows the line, "Not signed in." and the sign-in button', async () => {
    const { box } = await open(dropboxState(null))
    expect(
      within(box).getByText(
        'Adman keeps published files in its own folder in your Dropbox, under Apps.',
      ),
    ).toBeInTheDocument()
    expect(within(box).getByText('Not signed in.')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Sign in to Dropbox' })).toBeEnabled()
  })

  it('a saved name without a saved token is not signed in', async () => {
    const { box } = await open({ ...signedIn('Ann Example'), secrets: [] })
    expect(within(box).getByText('Not signed in.')).toBeInTheDocument()
  })

  it('sends storage.dropboxSignIn once and waits, the button disabled until the reply', async () => {
    let answer: (r: Result<unknown>) => void = () => undefined
    const { fake, box } = await open(dropboxState(null))
    fake.onCommand('storage.dropboxSignIn', () => new Promise((resolve) => (answer = resolve)))
    const button = within(box).getByRole('button', { name: 'Sign in to Dropbox' })
    await userEvent.click(button)
    await userEvent.click(button)
    expect(await within(box).findByText(WAITING)).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(sent(fake, 'storage.dropboxSignIn')).toEqual([
      { name: 'storage.dropboxSignIn', input: {} },
    ])
    fake.setState(signedIn('Ann Example'))
    answer({ ok: true, data: { accountName: 'Ann Example' } })
    expect(await within(box).findByText('Signed in as Ann Example.')).toBeInTheDocument()
    expect(within(box).queryByText(WAITING)).not.toBeInTheDocument()
  })

  it.each([
    ['sign_in_timed_out', 'The Dropbox sign-in took too long. Try again.'],
    ['sign_in_port_busy', 'Another program is using the port Adman needs for the sign-in.'],
  ])('a %s refusal shows its sentence and enables the button again', async (reason, text) => {
    const { fake, box } = await open(dropboxState(null))
    fake.onCommand('storage.dropboxSignIn', () => refusal(reason, text))
    await userEvent.click(within(box).getByRole('button', { name: 'Sign in to Dropbox' }))
    expect(await within(box).findByRole('alert')).toHaveTextContent(text)
    expect(within(box).getByRole('button', { name: 'Sign in to Dropbox' })).toBeEnabled()
    expect(within(box).queryByText(WAITING)).not.toBeInTheDocument()
  })
})

describe('settings: Dropbox, signed in [P9-6]', () => {
  it('draws the account name as text, tags and all', async () => {
    const { box } = await open(signedIn('<b>Ann</b> Example'))
    expect(within(box).getByText('Signed in as <b>Ann</b> Example.')).toBeInTheDocument()
    expect(box.querySelector('b')).toBeNull()
  })

  it('"Sign out" sends storage.dropboxSignOut', async () => {
    const { fake, box } = await open(signedIn('Ann Example'))
    fake.onCommand('storage.dropboxSignOut', () => {
      fake.setState(dropboxState(null))
      return { ok: true, data: null }
    })
    await userEvent.click(within(box).getByRole('button', { name: 'Sign out' }))
    expect(sent(fake, 'storage.dropboxSignOut')).toEqual([
      { name: 'storage.dropboxSignOut', input: {} },
    ])
    expect(await within(box).findByText('Not signed in.')).toBeInTheDocument()
  })

  it('a refused sign-out shows its sentence and stays signed in', async () => {
    const text = 'Saved keys could not be read, so Adman did not sign out of Dropbox.'
    const { fake, box } = await open(signedIn('Ann Example'))
    fake.onCommand('storage.dropboxSignOut', () => refusal('secrets_unreadable', text))
    await userEvent.click(within(box).getByRole('button', { name: 'Sign out' }))
    expect(await within(box).findByRole('alert')).toHaveTextContent(text)
    expect(within(box).getByText('Signed in as Ann Example.')).toBeInTheDocument()
  })

  it('the folder field starts with rootPath and "Save folder" sends it', async () => {
    const { fake, box } = await open(signedIn('Ann Example', 'Adman'))
    const field = within(box).getByLabelText('Folder in the app folder')
    expect(field).toHaveValue('Adman')
    expect(field).toHaveAccessibleDescription('Leave empty to use the app folder itself.')
    await userEvent.clear(field)
    await userEvent.type(field, ' Spring ads ')
    await userEvent.click(within(box).getByRole('button', { name: 'Save folder' }))
    expect(sent(fake, 'storage.setDropboxFolder')).toEqual([
      { name: 'storage.setDropboxFolder', input: { rootPath: 'Spring ads' } },
    ])
  })

  it.each([
    ['dropbox_folder_refused', 'This folder name cannot be used in Dropbox.'],
    ['dropbox_not_signed_in', 'Sign in to Dropbox in Settings.'],
  ])('a %s refusal shows its sentence and keeps the typed text', async (reason, text) => {
    const { fake, box } = await open(signedIn('Ann Example'))
    fake.onCommand('storage.setDropboxFolder', () => refusal(reason, text))
    const field = within(box).getByLabelText('Folder in the app folder')
    await userEvent.type(field, 'bad:name')
    await userEvent.click(within(box).getByRole('button', { name: 'Save folder' }))
    expect(await within(box).findByRole('alert')).toHaveTextContent(text)
    expect(field).toHaveValue('bad:name')
  })
})

describe('settings: Dropbox, safety and access [P9-6]', () => {
  it.each([
    ['signed out', dropboxState(null)],
    ['signed in', signedIn('Ann Example', 'Adman')],
  ])('%s: no password input, no token field, no axe violations', async (_, state) => {
    const { box } = await open(state)
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(within(box).queryByLabelText(/token/i)).toBeNull()
    expect(await axeViolations()).toEqual([])
  })
})
