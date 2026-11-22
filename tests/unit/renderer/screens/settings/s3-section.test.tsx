import { describe, it, expect } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

// Made-up values only. No test here contacts a bucket.
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
const PERMISSIONS =
  'The keys need permission to list the bucket and to read, write and delete files in it.'

function s3State(
  s3: AppState['settings']['storage']['s3'],
  secrets: AppState['secrets'] = [],
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
  const { store } = await renderApp(<SettingsScreen page="publish" />, fake)
  store.getState().subscribe()
  const box = await screen.findByRole('region', { name: 'Cloud storage' })
  return { fake, box }
}

describe('settings: cloud storage, Amazon S3 [D-096, A-95]', () => {
  it('saves bucket, region and folder together in one settings.update', async () => {
    const { fake, box } = await section(s3State(null))
    await userEvent.type(within(box).getByLabelText('Bucket'), 'made-up-bucket')
    await userEvent.type(within(box).getByLabelText('Region'), 'eu-west-1')
    await userEvent.type(within(box).getByLabelText('Folder in the bucket'), 'adman')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    expect(fake.commands.filter((c) => c.name === 'settings.update')).toEqual([
      {
        name: 'settings.update',
        input: {
          storage: { s3: { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: 'adman' } },
        },
      },
    ])
  })

  it.each([
    ['nothing saved', null, 'Not set'],
    ['an empty region', { bucket: 'b', region: '', prefix: '' }, 'Not set'],
    ['a saved region', { bucket: 'b', region: 'us-east-2', prefix: '' }, 'b · us-east-2'],
  ])('shows the saved state with %s', async (_, s3, text) => {
    const { box } = await section(s3State(s3))
    const row = within(box).getByRole('group', { name: 'Amazon S3' })
    expect(within(row).getByRole('status')).toHaveTextContent(text)
  })

  it('reads the examples from the placeholders', async () => {
    const { box } = await section(s3State(null))
    expect(within(box).getByLabelText('Region')).toHaveAttribute('placeholder', 'eu-west-1')
    expect(within(box).getByLabelText('Folder in the bucket')).toHaveAttribute(
      'placeholder',
      'Whole bucket',
    )
  })

  it('fills the fields with the saved values', async () => {
    const { box } = await section(s3State({ bucket: 'kept', region: 'eu-west-1', prefix: 'p/' }))
    await userEvent.click(within(box).getByRole('button', { name: 'Amazon S3', expanded: false }))
    expect(within(box).getByLabelText('Bucket')).toHaveValue('kept')
    expect(within(box).getByLabelText('Region')).toHaveValue('eu-west-1')
    expect(within(box).getByLabelText('Folder in the bucket')).toHaveValue('p/')
  })

  it('a refused region shows its sentence and keeps what the user typed', async () => {
    const sentence = 'Amazon S3 regions in China are not supported in this build.'
    const fake = makeFakeApi(s3State(null))
    fake.onCommand('settings.update', () => ({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: sentence,
        details: { reason: 'storage_not_supported' },
      },
    }))
    await renderApp(<SettingsScreen page="publish" />, fake)
    const box = await screen.findByRole('region', { name: 'Cloud storage' })
    await userEvent.type(within(box).getByLabelText('Bucket'), 'made-up-bucket')
    await userEvent.type(within(box).getByLabelText('Region'), 'cn-north-1')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
    expect(within(box).getByLabelText('Region')).toHaveValue('cn-north-1')
    expect(within(box).getByLabelText('Bucket')).toHaveValue('made-up-bucket')
  })

  it('states the permissions the keys need', async () => {
    const { box } = await section(s3State(null))
    await userEvent.click(within(box).getByRole('button', { name: 'About Amazon S3' }))
    expect(within(box).getByText(new RegExp(PERMISSIONS))).toBeInTheDocument()
  })

  it.each([
    ['s3.accessKeyId', 'Amazon S3 Access key ID'],
    ['s3.secretAccessKey', 'Amazon S3 Secret access key'],
  ] as const)('%s is added with secret.set and shown by its last four', async (name, label) => {
    const { fake, box } = await section(s3State(null))
    const row = within(box).getByRole('group', { name: label })
    await userEvent.click(within(row).getByRole('button', { name: 'Add key' }))
    const field = within(row).getByLabelText(`New ${label}`)
    expect(field).toHaveAttribute('type', 'password')
    await userEvent.type(field, 'made-up-value-WXYZ')
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.set',
      input: { name, value: 'made-up-value-WXYZ' },
    })
    fake.setState(s3State(null, [{ name, lastFour: 'WXYZ' }]))
    act(() => fake.emit('app.stateChanged', {}))
    expect(await within(row).findByText('•••WXYZ')).toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('made-up-value-WXYZ')
  })

  it('removes a saved key with secret.delete', async () => {
    const { fake, box } = await section(
      s3State(null, [{ name: 's3.secretAccessKey', lastFour: 'AB12' }]),
    )
    const row = within(box).getByRole('group', { name: 'Amazon S3 Secret access key' })
    await userEvent.click(within(row).getByRole('button', { name: 'Delete key' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.delete',
      input: { name: 's3.secretAccessKey' },
    })
  })

  it('has no accessibility violations', async () => {
    const { box } = await section(
      s3State({ bucket: 'b', region: '', prefix: '' }, [
        { name: 's3.accessKeyId', lastFour: 'AB12' },
      ]),
    )
    expect(await axeViolations(box)).toEqual([])
  })
})
