// SET-4: every command the Publish page sent before is still sent, with the same input, after
// the user's own clicks on the new rows. Made-up values only; the fake API answers everything.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp } from '../../render'
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

function state(signedIn: boolean): AppState {
  const base = baseState()
  return {
    ...base,
    providers: [...base.providers, S3_PROVIDER],
    settings: {
      ...base.settings,
      storage: {
        s3: { bucket: 'my-bucket', region: 'eu-west-1', prefix: '' },
        dropbox: signedIn ? { accountName: 'Ann Example', rootPath: '' } : null,
      },
      approvals: { baseUrl: 'https://a.example' },
    },
    secrets: [
      { name: 's3.secretAccessKey', lastFour: 'CD34' },
      { name: 'approvals.apiKey', lastFour: 'K9QZ' },
      ...(signedIn ? [{ name: 'dropbox.refreshToken' as const, lastFour: '' }] : []),
    ],
  }
}

const click = (box: HTMLElement, name: string) =>
  userEvent.click(within(box).getByRole('button', { name }))
const openRow = (box: HTMLElement, name: string) =>
  userEvent.click(within(box).getByRole('button', { name, expanded: false }))
const group = (name: string) => screen.getByRole('group', { name })

async function addKey(label: string) {
  const box = group(label)
  await click(box, 'Add key')
  await userEvent.type(within(box).getByLabelText(`New ${label}`), 'made-up-key')
  await click(box, 'Save')
}

type Case = [string, boolean, () => Promise<unknown>, unknown]

const CASES: Case[] = [
  ['storage.checkS3', false, () => click(group('Amazon S3'), 'Test connection'), {}],
  [
    'settings.update',
    false,
    async () => {
      await openRow(group('Amazon S3'), 'Amazon S3')
      await click(group('Amazon S3'), 'Save')
    },
    { storage: { s3: { bucket: 'my-bucket', region: 'eu-west-1', prefix: '' } } },
  ],
  [
    'secret.set',
    false,
    async () => {
      await openRow(group('Amazon S3'), 'Amazon S3')
      await addKey('Amazon S3 Access key ID')
    },
    { name: 's3.accessKeyId', value: 'made-up-key' },
  ],
  [
    'secret.delete',
    false,
    async () => {
      await openRow(group('Approvals'), 'Approvals')
      await click(group('Service API key'), 'Delete key')
    },
    { name: 'approvals.apiKey' },
  ],
  ['storage.dropboxSignIn', false, () => click(group('Dropbox'), 'Sign in to Dropbox'), {}],
  ['storage.dropboxSignOut', true, () => click(group('Dropbox'), 'Sign out'), {}],
  [
    'storage.setDropboxFolder',
    true,
    async () => {
      await openRow(group('Dropbox'), 'Dropbox')
      const folder = within(group('Dropbox')).getByLabelText('Folder in the app folder')
      await userEvent.type(folder, 'Spring ads{Enter}')
    },
    { rootPath: 'Spring ads' },
  ],
  [
    'approvals.setService',
    false,
    async () => {
      await openRow(group('Approvals'), 'Approvals')
      await click(group('Approvals'), 'Remove')
    },
    { address: null },
  ],
  ['approvals.check', false, () => click(group('Approvals'), 'Test connection'), {}],
]

describe('Publish page: every command is still sent [SET-4]', () => {
  it.each(CASES)('%s is sent once after the clicks', async (name, signedIn, steps, input) => {
    const fake = makeFakeApi(state(signedIn))
    await renderApp(<SettingsScreen page="publish" />, fake)
    await screen.findByRole('region', { name: 'Cloud storage' })
    expect(fake.commands.filter((c) => c.name === name)).toEqual([])
    await steps()
    expect(fake.commands.filter((c) => c.name === name)).toEqual([{ name, input }])
  })
})
