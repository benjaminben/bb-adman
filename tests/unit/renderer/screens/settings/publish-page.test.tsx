// SET-4: the Publish page (spec/phases/design-wave-screens-a.md "SET-4"). Three service rows in
// two Sections. Made-up values only; no test here contacts a bucket, Dropbox or a service.
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
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
const SAVED = { bucket: 'my-bucket', region: 'eu-west-1', prefix: '' }
const WRONG_KEYS =
  'Amazon S3 did not accept these keys. Check the access key ID and the secret access key.'
const S3_LINE = 'Pictures are kept in your own Amazon S3 bucket.'
const DROPBOX_LINE = 'Adman keeps published files in its own folder in your Dropbox, under Apps.'
const GALLERY_LINE = 'Gallery pictures are kept in your Amazon S3 bucket.'

type Opts = {
  s3?: AppState['settings']['storage']['s3']
  dropbox?: AppState['settings']['storage']['dropbox']
  approvals?: string | null
  secrets?: AppState['secrets']
}

function state(opts: Opts = {}): AppState {
  const base = baseState()
  return {
    ...base,
    providers: [...base.providers, S3_PROVIDER],
    settings: {
      ...base.settings,
      storage: { s3: opts.s3 ?? null, dropbox: opts.dropbox ?? null },
      approvals: { baseUrl: opts.approvals ?? null },
    },
    secrets: opts.secrets ?? [],
  }
}

async function page(s: AppState) {
  const fake = makeFakeApi(s)
  const { store } = await renderApp(<SettingsScreen page="publish" />, fake)
  store.getState().subscribe()
  const storage = await screen.findByRole('region', { name: 'Cloud storage' })
  const approvals = screen.getByRole('region', { name: 'Approvals service' })
  const s3 = within(storage).getByRole('group', { name: 'Amazon S3' })
  return { fake, storage, approvals, s3 }
}

const rowButton = (box: HTMLElement, name: string) =>
  within(box)
    .getAllByRole('button', { name })
    .find((b) => b.hasAttribute('aria-expanded'))

const outside = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) =>
    ['storage.checkS3', 'approvals.check', 'storage.dropboxSignIn'].includes(c.name),
  )

describe('Publish page: rows and Sections [SET-4]', () => {
  it('holds three service rows in two Sections', async () => {
    const { storage, approvals } = await page(state())
    expect(within(storage).getByRole('group', { name: 'Amazon S3' })).toBeInTheDocument()
    expect(within(storage).getByRole('group', { name: 'Dropbox' })).toBeInTheDocument()
    expect(within(storage).queryByRole('group', { name: 'Approvals' })).toBeNull()
    expect(within(approvals).getByRole('group', { name: 'Approvals' })).toBeInTheDocument()
  })

  it('S3 not set up starts open with "Not set"', async () => {
    const { s3 } = await page(state())
    expect(rowButton(s3, 'Amazon S3')).toHaveAttribute('aria-expanded', 'true')
    expect(within(s3).getByLabelText('Bucket')).toBeInTheDocument()
    expect(within(s3).getByRole('status')).toHaveTextContent(/^Not set$/)
  })

  it('S3 set up starts closed with "my-bucket · eu-west-1", and opens on a click', async () => {
    const { s3 } = await page(state({ s3: SAVED }))
    const row = rowButton(s3, 'Amazon S3') as HTMLElement
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(within(s3).getByText('my-bucket · eu-west-1')).toBeInTheDocument()
    expect(within(s3).queryByLabelText('Bucket')).toBeNull()
    await userEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(within(s3).getByLabelText('Bucket')).toHaveValue('my-bucket')
    expect(within(s3).getByLabelText('Region')).toHaveAttribute('placeholder', 'eu-west-1')
    expect(within(s3).getByLabelText('Folder in the bucket')).toHaveAttribute(
      'placeholder',
      'Whole bucket',
    )
  })

  it('keeps each line that says where data goes on the page while the rows are closed', async () => {
    const { storage, approvals } = await page(
      state({
        s3: SAVED,
        dropbox: { accountName: 'Ann Example', rootPath: '' },
        approvals: 'https://made-up.example',
        secrets: [{ name: 'dropbox.refreshToken', lastFour: '' }],
      }),
    )
    expect(within(storage).getByText(S3_LINE)).toBeVisible()
    expect(within(storage).getByText(DROPBOX_LINE)).toBeVisible()
    expect(within(approvals).getByText(/Gallery pictures are kept in your/)).toBeVisible()
    expect(within(approvals).getByText(/Gallery pictures/)).toHaveTextContent(GALLERY_LINE)
  })

  it('Save sends one settings.update with the three values', async () => {
    const { fake, s3 } = await page(state())
    await userEvent.type(within(s3).getByLabelText('Bucket'), 'my-bucket')
    await userEvent.type(within(s3).getByLabelText('Region'), 'eu-west-1')
    await userEvent.type(within(s3).getByLabelText('Folder in the bucket'), 'ads')
    await userEvent.click(within(s3).getByRole('button', { name: 'Save' }))
    expect(fake.commands.filter((c) => c.name === 'settings.update')).toEqual([
      {
        name: 'settings.update',
        input: { storage: { s3: { bucket: 'my-bucket', region: 'eu-west-1', prefix: 'ads' } } },
      },
    ])
  })
})

describe('Publish page: Test on the S3 row [SET-4]', () => {
  it('is disabled with its reason when not set up', async () => {
    const { s3 } = await page(state())
    const test = within(s3).getByRole('button', { name: 'Test connection' })
    expect(test).toBeDisabled()
    expect(test).toHaveAttribute('title', 'Save a bucket and region first')
    expect(test).toHaveTextContent(/^Test$/)
  })

  it('is reachable on the closed row and an ok reply shows "Connected"', async () => {
    const { fake, s3 } = await page(state({ s3: SAVED }))
    fake.onCommand('storage.checkS3', () => ({ ok: true, data: { ok: true } }))
    await userEvent.click(within(s3).getByRole('button', { name: 'Test connection' }))
    expect(fake.commands).toContainEqual({ name: 'storage.checkS3', input: {} })
    expect(await within(s3).findByText('Connected')).toBeInTheDocument()
    expect(rowButton(s3, 'Amazon S3')).toHaveAttribute('aria-expanded', 'false')
  })

  it('a refused test shows "Failed" and the sentence on the page', async () => {
    const { fake, s3 } = await page(state({ s3: SAVED }))
    const refused: Result<unknown> = {
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: WRONG_KEYS, details: {} },
    }
    fake.onCommand('storage.checkS3', () => refused)
    await userEvent.click(within(s3).getByRole('button', { name: 'Test connection' }))
    expect(await within(s3).findByText('Failed')).toBeInTheDocument()
    const notice = within(s3)
      .getAllByText(WRONG_KEYS)
      .find((n) => n.tagName === 'P')
    expect(notice).toBeVisible()
  })

  it('contacts no service when the page shows, a row opens or a field loses focus', async () => {
    const { fake, s3, approvals } = await page(state({ s3: SAVED, approvals: 'https://a.example' }))
    await userEvent.click(rowButton(s3, 'Amazon S3') as HTMLElement)
    await userEvent.click(within(s3).getByLabelText('Bucket'))
    await userEvent.tab()
    await userEvent.click(rowButton(approvals, 'Approvals') as HTMLElement)
    await userEvent.click(within(approvals).getByLabelText('Service address'))
    await userEvent.tab()
    expect(outside(fake)).toEqual([])
  })
})

describe('Publish page: Dropbox and approvals rows [SET-4]', () => {
  it('"Sign in to Dropbox" sends storage.dropboxSignIn and the waiting status exists', async () => {
    const { fake, storage } = await page(state())
    fake.onCommand('storage.dropboxSignIn', () => new Promise(() => undefined))
    const box = within(storage).getByRole('group', { name: 'Dropbox' })
    expect(within(box).getByText('Not signed in')).toBeInTheDocument()
    await userEvent.click(within(box).getByRole('button', { name: 'Sign in to Dropbox' }))
    expect(fake.commands).toContainEqual({ name: 'storage.dropboxSignIn', input: {} })
    const status = await within(box).findByRole('status')
    expect(status).toHaveTextContent('Waiting for you to finish in the browser…')
    expect(within(box).getByText('Waiting')).toBeInTheDocument()
  })

  it('the approvals row shows the host when set up and Test waits for an address', async () => {
    const set = await page(state({ approvals: 'https://approvals.made-up.example' }))
    expect(within(set.approvals).getByText('approvals.made-up.example')).toBeInTheDocument()
    expect(rowButton(set.approvals, 'Approvals')).toHaveAttribute('aria-expanded', 'false')
  })

  it('Test is disabled with its reason while no address is saved', async () => {
    const { approvals } = await page(state())
    const test = within(approvals).getByRole('button', { name: 'Test connection' })
    expect(test).toBeDisabled()
    expect(test).toHaveAttribute('title', 'Save an address first')
    expect(rowButton(approvals, 'Approvals')).toHaveAttribute('aria-expanded', 'true')
  })

  it('the link "Amazon S3" opens the S3 row and moves focus to it', async () => {
    const { approvals, s3 } = await page(state({ s3: SAVED, approvals: 'https://a.example' }))
    await userEvent.click(within(approvals).getByRole('button', { name: 'Amazon S3' }))
    const row = rowButton(s3, 'Amazon S3') as HTMLElement
    expect(row).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(row).toHaveFocus())
  })

  it('the link also opens a folded Cloud storage Section', async () => {
    const { approvals, storage } = await page(state({ s3: SAVED }))
    await userEvent.click(screen.getByRole('button', { name: 'Cloud storage' }))
    expect(screen.getByRole('button', { name: 'Cloud storage' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await userEvent.click(within(approvals).getByRole('button', { name: 'Amazon S3' }))
    const row = rowButton(storage, 'Amazon S3') as HTMLElement
    await waitFor(() => expect(row).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Cloud storage' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('S3Section alone, and access [SET-4]', () => {
  it('renders the two storage rows and no approvals row', async () => {
    await renderApp(<S3Section fold="none" />, makeFakeApi(state()))
    const storage = await screen.findByRole('region', { name: 'Cloud storage' })
    expect(within(storage).getByRole('group', { name: 'Amazon S3' })).toBeInTheDocument()
    expect(within(storage).getByRole('group', { name: 'Dropbox' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Approvals' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cloud storage' })).toBeNull()
  })

  it.each([
    ['nothing set up', state()],
    [
      'everything set up',
      state({
        s3: SAVED,
        dropbox: { accountName: 'Ann Example', rootPath: 'Ads' },
        approvals: 'https://a.example',
        secrets: [
          { name: 's3.accessKeyId', lastFour: 'AB12' },
          { name: 'dropbox.refreshToken', lastFour: '' },
          { name: 'approvals.apiKey', lastFour: 'K9QZ' },
        ],
      }),
    ],
  ])('has no accessibility violations with %s', async (_, s) => {
    await page(s)
    expect(await axeViolations()).toEqual([])
  })
})
