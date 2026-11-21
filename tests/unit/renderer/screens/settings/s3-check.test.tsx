// Test connection in Settings' Cloud storage (spec/storage-and-publish.md "Test connection
// (S3)"). Made-up values only; no test here contacts a bucket.
import { describe, it, expect } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { S3Section } from '@/renderer/screens/settings/s3-section'
import type { AppState } from '@/shared/schemas/queries/app'
import type { Result } from '@/shared/schemas/result'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const S3_PROVIDER: AppState['providers'][number] = {
  id: 's3',
  label: 'Amazon S3',
  jobs: ['storage'],
  available: true,
  secrets: ['s3.accessKeyId', 's3.secretAccessKey'],
  defaultModels: {},
  local: false,
  cancel: 'none',
  serverText: false,
}
const SAVED = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
const KEYS: AppState['secrets'] = [
  { name: 's3.accessKeyId', lastFour: 'AB12' },
  { name: 's3.secretAccessKey', lastFour: 'CD34' },
]
const CONNECTED = 'Connected. Adman can list, write, read and delete files in this folder.'
const WRONG_KEYS =
  'Amazon S3 did not accept these keys. Check the access key ID and the secret access key.'

function s3State(
  s3: AppState['settings']['storage']['s3'],
  secrets: AppState['secrets'] = KEYS,
): AppState {
  const base = baseState()
  return {
    ...base,
    providers: [...base.providers, S3_PROVIDER],
    settings: { ...base.settings, storage: { s3, dropbox: null } },
    secrets,
  }
}

async function section(state: AppState) {
  const fake = makeFakeApi(state)
  const { store } = await renderApp(<S3Section />, fake)
  store.getState().subscribe()
  const box = await screen.findByRole('region', { name: 'Cloud storage' })
  const button = () => within(box).getByRole('button', { name: /^(Test connection|Testing…)$/ })
  return { fake, box, button }
}

const refused: Result<unknown> = {
  ok: false,
  error: { code: 'PROVIDER_ERROR', message: WRONG_KEYS, details: { reason: 's3_wrong_keys' } },
}

describe('settings: Test connection for Amazon S3 [spec "Test connection (S3)"]', () => {
  it.each([
    ['nothing saved', null],
    ['an empty bucket', { ...SAVED, bucket: '' }],
    ['an empty region', { ...SAVED, region: '' }],
  ])('is disabled with %s', async (_n, s3) => {
    const { button } = await section(s3State(s3))
    expect(button()).toBeDisabled()
  })

  it('is enabled once a bucket and region are saved, even with no keys', async () => {
    const { button, box } = await section(s3State(SAVED, []))
    expect(button()).toBeEnabled()
    expect(button()).toHaveAccessibleDescription('Tests the saved bucket, region and keys.')
    expect(within(box).getByText('Tests the saved bucket, region and keys.')).toBeInTheDocument()
  })

  it('sends storage.checkS3 and shows "Testing…" while it works, then the Connected line', async () => {
    const { fake, box, button } = await section(s3State(SAVED))
    let answer: (r: Result<unknown>) => void = () => {}
    fake.onCommand('storage.checkS3', () => new Promise((resolve) => (answer = resolve)))
    await userEvent.click(button())
    expect(fake.commands).toContainEqual({ name: 'storage.checkS3', input: {} })
    expect(button()).toHaveTextContent('Testing…')
    expect(button()).toBeDisabled()
    await act(async () => answer({ ok: true, data: { ok: true } }))
    expect(within(box).getByRole('status')).toHaveTextContent(CONNECTED)
    expect(button()).toHaveTextContent('Test connection')
    expect(button()).toBeEnabled()
  })

  it("shows a refusal's sentence in the result line", async () => {
    const { fake, box, button } = await section(s3State(SAVED))
    fake.onCommand('storage.checkS3', () => refused)
    await userEvent.click(button())
    expect(within(box).getByRole('status')).toHaveTextContent(WRONG_KEYS)
  })

  it.each([
    ['the saved settings change', s3State({ ...SAVED, prefix: 'other' })],
    ['a key changes', s3State(SAVED, [KEYS[0] as AppState['secrets'][number]])],
  ])('clears the line when %s', async (_n, next) => {
    const { fake, box, button } = await section(s3State(SAVED))
    fake.onCommand('storage.checkS3', () => ({ ok: true, data: { ok: true } }))
    await userEvent.click(button())
    expect(within(box).getByRole('status')).toHaveTextContent(CONNECTED)
    fake.setState(next)
    await act(async () => fake.emit('app.stateChanged', {}))
    expect(within(box).queryByText(CONNECTED)).toBeNull()
  })

  it('keeps the line when the state is read again with nothing changed', async () => {
    const { fake, box, button } = await section(s3State(SAVED))
    fake.onCommand('storage.checkS3', () => refused)
    await userEvent.click(button())
    await act(async () => fake.emit('app.stateChanged', {}))
    expect(within(box).getByRole('status')).toHaveTextContent(WRONG_KEYS)
  })

  it('has no accessibility violations, before and after a result', async () => {
    const { fake, box, button } = await section(s3State(SAVED))
    expect(await axeViolations(box)).toEqual([])
    fake.onCommand('storage.checkS3', () => refused)
    await userEvent.click(button())
    expect(await axeViolations(box)).toEqual([])
  })
})
