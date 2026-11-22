// P9-12 (spec/phases/phase-09.md "Screens", "Publishing"; FR-241, A-218, A-229): the publish
// dialog's first view and the started view. Nothing is sent but publish.inspect, and
// publish.run on the user's own "Publish".
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublishDialog } from '@/renderer/dialogs/publish-dialog'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import {
  COMPONENTS,
  NOTHING_PUBLISHED,
  PUBLISHED,
  STORAGES,
  font,
  inspectReply,
} from './publish-fixture'

const PROMPT_LINE =
  'Generated images and videos carry the prompt that made them. Anyone with these files can read it.'
const STARTED =
  'Publishing has started. You can close this window and follow it in the activity list.'

type Answer = (input: { storage: string | null }) => Result<unknown> | Promise<Result<unknown>>

async function openDialog(opts: { existing?: PublishInspect['existing']; answer?: Answer } = {}) {
  const fake = makeFakeApi()
  const existing = opts.existing ?? NOTHING_PUBLISHED
  fake.onQuery(
    'publish.inspect',
    (input) =>
      opts.answer?.(input as { storage: string | null }) ?? {
        ok: true,
        data: inspectReply({
          existing: (input as { storage: string | null }).storage === null ? null : existing,
        }),
      },
  )
  fake.onCommand('publish.run', () => ({ ok: true, data: { jobId: 'job1' } }))
  const onClose = vi.fn()
  await renderApp(
    <PublishDialog
      projectId="p1"
      campaignId="01JD00000000000000000000CA"
      campaignName="Summer Launch"
      onClose={onClose}
    />,
    fake,
  )
  const dialog = screen.getByRole('dialog', { name: 'Publish Summer Launch' })
  return { fake, onClose, dialog }
}

const inspects = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'publish.inspect').map((q) => q.input)
const runs = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'publish.run').map((c) => c.input)
const publish = () => screen.getByRole('button', { name: 'Publish' })
const chooseS3 = async () => {
  await userEvent.click(screen.getByRole('radio', { name: 'Amazon S3' }))
  await screen.findByText(/Nothing is published|This will replace/)
}

describe('the publish dialog [P9-12]', () => {
  it('inspects with no storage on open and lists the choices, the lines and the files', async () => {
    const { fake, dialog } = await openDialog()
    await screen.findByRole('radio', { name: 'Amazon S3' })
    expect(inspects(fake)).toEqual([
      { projectId: 'p1', campaignId: '01JD00000000000000000000CA', storage: null },
    ])
    expect(dialog).toHaveTextContent(PROMPT_LINE)
    expect(dialog).toHaveTextContent('Also uploaded')
    expect(dialog).toHaveTextContent('/Users/ann/Pictures/Summer/beach-at-dawn.png')
    expect(publish()).toBeDisabled()
    expect(await axeViolations()).toEqual([])
  })

  it.each([
    ['not_set_up', 'Set up Amazon S3 in Settings.'],
    ['needs_key', 'Add your Amazon S3 keys in Settings.'],
  ] as const)('marks a storage that is %s "Not set", with its line', async (ready, line) => {
    const storages = [{ ...STORAGES[0], ready }, STORAGES[1]] as PublishInspect['storages']
    await openDialog({
      answer: () => ({ ok: true, data: inspectReply({ storages }) }),
    })
    const s3 = await screen.findByRole('radio', { name: 'Amazon S3' })
    expect(s3).toHaveAccessibleDescription(new RegExp(`^Not set.*${line}$`))
    expect(screen.getByRole('radio', { name: 'Dropbox' })).toHaveAccessibleDescription(
      /^Not set.*Sign in to Dropbox in Settings\.$/,
    )
    await userEvent.click(s3)
    expect(publish()).toBeDisabled()
  })

  it('inspects again when a storage is chosen, showing "Looking…", then nothing published', async () => {
    let release: () => void = () => {}
    const { fake } = await openDialog({
      answer: (input) =>
        input.storage === null
          ? { ok: true, data: inspectReply() }
          : new Promise((resolve) => {
              release = () =>
                resolve({ ok: true, data: inspectReply({ existing: NOTHING_PUBLISHED }) })
            }),
    })
    await userEvent.click(await screen.findByRole('radio', { name: 'Amazon S3' }))
    expect(await screen.findByText('Looking at the published folder…')).toBeInTheDocument()
    expect(publish()).toBeDisabled()
    release()
    expect(
      await screen.findByText('Nothing is published for this campaign yet.'),
    ).toBeInTheDocument()
    expect(inspects(fake).at(-1)).toMatchObject({ storage: 's3' })
    expect(publish()).toBeEnabled()
  })

  it('shows the replace block and keeps Publish disabled until the box is ticked', async () => {
    const { dialog } = await openDialog({ existing: { ...PUBLISHED, otherProject: true } })
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    expect(dialog).toHaveTextContent('This will replace the files published for this campaign.')
    expect(dialog).toHaveTextContent('Someone may be reviewing the files that will be replaced.')
    expect(dialog).toHaveTextContent(
      'These files were published from another project with the same campaign ID.',
    )
    expect(dialog).toHaveTextContent(/Replaces publish 3 · .+/)
    const box = screen.getByRole('switch', { name: 'Replace the published files' })
    expect(box).not.toBeChecked()
    expect(publish()).toBeDisabled()
    await userEvent.click(box)
    expect(publish()).toBeEnabled()
  })

  it('has no other-project line for files of this project', async () => {
    const { dialog } = await openDialog({ existing: PUBLISHED })
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    expect(dialog).not.toHaveTextContent('another project')
  })

  it('sends publish.run once with the tick, disabled while waiting, then the started view', async () => {
    let finish: () => void = () => {}
    const { fake, dialog, onClose } = await openDialog({ existing: PUBLISHED })
    fake.onCommand(
      'publish.run',
      () => new Promise((resolve) => (finish = () => resolve({ ok: true, data: { jobId: 'j1' } }))),
    )
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    await userEvent.click(screen.getByRole('switch', { name: 'Replace the published files' }))
    await userEvent.click(publish())
    expect(publish()).toBeDisabled()
    await userEvent.click(publish())
    expect(runs(fake)).toEqual([
      {
        projectId: 'p1',
        campaignId: '01JD00000000000000000000CA',
        storage: 's3',
        replaceConfirmed: true,
        proceedDespiteWarnings: false,
      },
    ])
    finish()
    expect(await within(dialog).findByText(STARTED)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('sends replaceConfirmed false when nothing is published', async () => {
    const { fake } = await openDialog()
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    await userEvent.click(publish())
    await screen.findByText(STARTED)
    expect(runs(fake)).toEqual([expect.objectContaining({ replaceConfirmed: false })])
  })

  it('shows a refusal as its sentence and stays open on the first view', async () => {
    const { fake, onClose } = await openDialog()
    const message = 'This campaign is being published. Wait until it ends.'
    fake.onCommand('publish.run', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'publish_running' } },
    }))
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    await userEvent.click(publish())
    const alerts = await within(screen.getByRole('dialog')).findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toContain(message)
    expect(publish()).toBeEnabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a failed inspect as its sentence with Retry, which inspects again', async () => {
    const message = 'Adman could not look at the published folder.'
    let fail = true
    const { fake } = await openDialog({
      answer: () =>
        fail
          ? { ok: false, error: { code: 'PROVIDER_ERROR', message } }
          : { ok: true, data: inspectReply() },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('radio', { name: 'Amazon S3' })).toBeEnabled()
    expect(inspects(fake)).toHaveLength(2)
  })

  it('sends nothing on Cancel or Escape', async () => {
    const { fake, onClose } = await openDialog()
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
    expect(runs(fake)).toEqual([])
    expect(fake.commands.map((c) => c.name)).not.toContain('publish.setFontConsent')
  })

  it("never lets one storage's answer or tick stand for another", async () => {
    const storages = STORAGES.map((s) => ({ ...s, ready: 'ready' as const }))
    const message = 'Adman could not look at the published folder.'
    let dropboxFails = true
    const { fake } = await openDialog({
      answer: (input) =>
        input.storage === 'dropbox' && dropboxFails
          ? { ok: false, error: { code: 'PROVIDER_ERROR', message } }
          : {
              ok: true,
              data: inspectReply({ storages, existing: input.storage === null ? null : PUBLISHED }),
            },
    })
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    await userEvent.click(screen.getByRole('switch', { name: 'Replace the published files' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Dropbox' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/^Replaces publish/)).toBeNull()
    expect(publish()).toBeDisabled()
    dropboxFails = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/^Replaces publish/)
    expect(screen.getByRole('radio', { name: 'Dropbox' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Replace the published files' })).not.toBeChecked()
    expect(publish()).toBeDisabled()
    expect(runs(fake)).toEqual([])
  })
})

describe('the replace tick and the folder listing never outlive a read [P9-12 review]', () => {
  const REPLACE = /^Replaces publish/
  const withFont = (existing: PublishInspect['existing']) =>
    inspectReply({ existing, components: [...COMPONENTS, font({ share: 'needs_confirming' })] })

  // S3 chosen with files there, the replace box ticked; then a font tick reads the folder again.
  async function tickThenReadAgain(next: () => Result<unknown>) {
    let reads = 0
    await openDialog({
      answer: (input) => {
        if (input.storage === null) return { ok: true, data: withFont(null) }
        reads += 1
        return reads === 1 ? { ok: true, data: withFont(PUBLISHED) } : next()
      },
    })
    await screen.findByRole('radio', { name: 'Amazon S3' })
    await chooseS3()
    await userEvent.click(screen.getByRole('switch', { name: 'Replace the published files' }))
    expect(publish()).toBeEnabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'I am allowed to share this font' }))
  }

  it('clears the replace tick when the same storage is read again', async () => {
    await tickThenReadAgain(() => ({ ok: true, data: withFont(PUBLISHED) }))
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Replace the published files' })).not.toBeChecked(),
    )
    expect(screen.getByText(REPLACE)).toBeInTheDocument()
    expect(publish()).toBeDisabled()
  })

  it('clears the earlier answer when a read fails, so no replace block or Publish beside the error', async () => {
    const message = 'Adman could not look at the published folder.'
    await tickThenReadAgain(() => ({ ok: false, error: { code: 'PROVIDER_ERROR', message } }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText(REPLACE)).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Replace the published files' })).toBeNull()
    expect(publish()).toBeDisabled()
  })
})
