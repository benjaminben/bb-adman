import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandTestScreen } from '../../../../src/renderer/dev/hand-test-screen'
import { KeyDialog } from '../../../../src/renderer/dialogs/key/key-dialog'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'
import type { ProviderInfo } from '../../../../src/shared/schemas/queries/app'

const S3: ProviderInfo = {
  id: 's3',
  label: 'Amazon S3',
  jobs: ['storage'],
  available: true,
  secrets: ['s3.accessKeyId', 's3.secretAccessKey'],
  defaultModels: {},
}

function devState() {
  const state = baseState({ devTools: true })
  return { ...state, providers: [...state.providers, S3] }
}

const storageCalls = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'dev.storage').map((c) => c.input)

async function pick(storage: string) {
  await userEvent.selectOptions(screen.getByLabelText('Storage'), storage)
}

describe('hand-test screen: storage [SPEC 14 slice I part 1]', () => {
  it('uploads the file at the typed path and shows its name and size', async () => {
    const fake = makeFakeApi(devState())
    fake.onCommand('dev.storage', () => ({ ok: true, data: { name: 'note.txt', size: 9 } }))
    await renderApp(<HandTestScreen />, fake)
    await pick('s3')
    await userEvent.type(screen.getByLabelText('File to upload (full path)'), '/tmp/note.txt')
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
    expect(storageCalls(fake)).toEqual([
      { storage: 's3', action: 'write', filePath: '/tmp/note.txt' },
    ])
    expect(await screen.findByText('Uploaded note.txt (9 bytes).')).toBeInTheDocument()
  })

  it('lists the names in the folder', async () => {
    const fake = makeFakeApi(devState())
    fake.onCommand('dev.storage', () => ({ ok: true, data: { names: ['a.txt', 'b.txt'] } }))
    await renderApp(<HandTestScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(storageCalls(fake)).toEqual([{ storage: 'local', action: 'list' }])
    expect(await screen.findByText('2 files: a.txt, b.txt')).toBeInTheDocument()
  })

  it('says so when the folder is empty', async () => {
    const fake = makeFakeApi(devState())
    fake.onCommand('dev.storage', () => ({ ok: true, data: { names: [] } }))
    await renderApp(<HandTestScreen />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(await screen.findByText('No files.')).toBeInTheDocument()
  })

  it('removes everything in the folder and says how many', async () => {
    const fake = makeFakeApi(devState())
    fake.onCommand('dev.storage', () => ({ ok: true, data: { removed: 2 } }))
    await renderApp(<HandTestScreen />, fake)
    await pick('dropbox')
    await userEvent.click(screen.getByRole('button', { name: 'Remove all' }))
    expect(storageCalls(fake)).toEqual([{ storage: 'dropbox', action: 'remove' }])
    expect(await screen.findByText('Removed 2 files.')).toBeInTheDocument()
  })

  it('shows the plain error message when a call fails', async () => {
    const fake = makeFakeApi(devState())
    const message = 'Amazon S3 did not accept your key. Check it in Settings and try again.'
    fake.onCommand('dev.storage', () => ({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message, details: { provider: 's3', kind: 'bad_key' } },
    }))
    await renderApp(<HandTestScreen />, fake)
    await pick('s3')
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(await screen.findByText(`Failed: ${message}`)).toBeInTheDocument()
  })

  it('asks for the S3 keys in the key dialog, then runs the call again', async () => {
    const fake = makeFakeApi(devState())
    let calls = 0
    fake.onCommand('dev.storage', () =>
      ++calls === 1
        ? {
            ok: false,
            error: { code: 'NEEDS_KEY', message: 'Add your key.', details: { provider: 's3' } },
          }
        : { ok: true, data: { names: [] } },
    )
    await renderApp(
      <>
        <HandTestScreen />
        <KeyDialog />
      </>,
      fake,
    )
    await pick('s3')
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    await userEvent.type(await screen.findByLabelText('Access key ID'), 'made-up-id')
    await userEvent.type(screen.getByLabelText('Secret access key'), 'made-up-secret')
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByText('No files.')).toBeInTheDocument()
    expect(fake.commands.map((c) => c.name)).toEqual([
      'dev.storage',
      'secret.set',
      'secret.set',
      'dev.storage',
    ])
  })

  it('has no accessibility violations', async () => {
    await renderApp(<HandTestScreen />, makeFakeApi(devState()))
    expect(await axeViolations()).toEqual([])
  })
})
