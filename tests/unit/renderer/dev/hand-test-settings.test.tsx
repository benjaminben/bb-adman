import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandTestScreen } from '@/renderer/dev/hand-test-screen'
import { DropboxSignIn } from '@/renderer/dev/dropbox-sign-in'
import { renderApp } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

const saved = { bucket: 'example-bucket', region: 'eu-west-1', prefix: 'team' }

describe('hand-test screen: S3 settings [SPEC 14 slice I part 1, 13.1]', () => {
  it('shows the saved S3 settings', async () => {
    const state = baseState({ devTools: true })
    state.settings.storage.s3 = saved
    await renderApp(<HandTestScreen />, makeFakeApi(state))
    expect(screen.getByLabelText('Bucket')).toHaveValue('example-bucket')
    expect(screen.getByLabelText('Region')).toHaveValue('eu-west-1')
    expect(screen.getByLabelText('Prefix (optional)')).toHaveValue('team')
  })

  it('saves bucket, region and prefix with settings.update', async () => {
    const fake = makeFakeApi(baseState({ devTools: true }))
    await renderApp(<HandTestScreen />, fake)
    await userEvent.type(screen.getByLabelText('Bucket'), 'example-bucket')
    await userEvent.type(screen.getByLabelText('Region'), 'eu-west-1')
    await userEvent.click(screen.getByRole('button', { name: 'Save S3 settings' }))
    expect(fake.commands).toEqual([
      {
        name: 'settings.update',
        input: { storage: { s3: { bucket: 'example-bucket', region: 'eu-west-1', prefix: '' } } },
      },
    ])
    expect(await screen.findByText('S3 settings saved.')).toBeInTheDocument()
  })

  it('shows the message when saving fails', async () => {
    const fake = makeFakeApi(baseState({ devTools: true }))
    fake.onCommand('settings.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Check the values and try again.' },
    }))
    await renderApp(<HandTestScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Save S3 settings' }))
    expect(await screen.findByText('Failed: Check the values and try again.')).toBeInTheDocument()
  })

  it('has no field for a key: keys go through the key dialog and Settings', async () => {
    await renderApp(<HandTestScreen />, makeFakeApi(baseState({ devTools: true })))
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0)
  })
})

describe('hand-test screen: Dropbox sign-in button [SPEC 14 slice I part 1]', () => {
  it('sends storage.dropboxSignIn and shows the account name', async () => {
    const fake = makeFakeApi(baseState({ devTools: true }))
    fake.onCommand('storage.dropboxSignIn', () => ({ ok: true, data: { accountName: 'Sam' } }))
    await renderApp(<DropboxSignIn />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to Dropbox' }))
    expect(fake.commands).toEqual([{ name: 'storage.dropboxSignIn', input: {} }])
    expect(await screen.findByText('Signed in to Dropbox as Sam.')).toBeInTheDocument()
  })

  it('shows the message while the sign-in does not exist yet', async () => {
    const fake = makeFakeApi(baseState({ devTools: true }))
    fake.onCommand('storage.dropboxSignIn', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: storage.dropboxSignIn' },
    }))
    await renderApp(<DropboxSignIn />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to Dropbox' }))
    expect(
      await screen.findByText('Failed: Unknown command: storage.dropboxSignIn'),
    ).toBeInTheDocument()
  })
})
