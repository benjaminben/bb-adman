// DLG-6b (spec/phases/design-wave-screens-b.md "DLG-6b — Publish and the approval dialog"): the
// publish dialog's new look keeps its gates (no path on the page, the prompt line visible and
// the description, Publish only after the "Replace" switch, a destination that is not set up
// cannot be published to) and the approval dialog's turn-off question is a confirm dialog
// that sends approvals.endLink only on "Turn off link".
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import { PublishDialog } from '@/renderer/dialogs/publish-dialog'
import { dateText } from '@/renderer/ui/signoff-list'
import { rememberedPage } from '@/renderer/screens/settings/settings-screen/settings-pages'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { C, P, TITLES, forCampaign } from '../stores/approvals-fixture'
import {
  COMPONENTS,
  NOTHING_PUBLISHED,
  PUBLISHED,
  STORAGES,
  component,
  font,
} from './publish-fixture'

const PROMPT_LINE =
  'Generated images and videos carry the prompt that made them. Anyone with these files can read it.'
const SECRET_FOLDER = '/Users/made-up-person/Private Folder Nine'
const FILES = [
  ...COMPONENTS,
  component({ assetId: '01JD0000000000000000000020', localPath: `${SECRET_FOLDER}/a.png` }),
  font({ share: 'confirmed' }),
]

async function openPublish(
  opts: { existing?: PublishInspect['existing']; storages?: PublishInspect['storages'] } = {},
) {
  const fake = makeFakeApi()
  fake.onQuery('publish.inspect', (input) => {
    const storage = (input as { storage: string | null }).storage
    const existing = storage === null ? null : (opts.existing ?? NOTHING_PUBLISHED)
    const storages = opts.storages ?? STORAGES
    return { ok: true, data: { storages, existing, components: FILES } }
  })
  fake.onCommand('publish.run', () => ({ ok: true, data: { jobId: 'job1' } }))
  const onClose = vi.fn()
  const view = await renderApp(
    <PublishDialog projectId="p1" campaignId="c1" campaignName="Harbor Day" onClose={onClose} />,
    fake,
  )
  const dialog = screen.getByRole('dialog', { name: 'Publish Harbor Day' })
  await screen.findByRole('radio', { name: 'Amazon S3' })
  return { ...view, fake, onClose, dialog }
}

const publish = () => screen.getByRole('button', { name: 'Publish' })
const runs = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'publish.run').map((c) => c.input)
const inspected = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'publish.inspect').map((q) => q.input)

async function chooseS3() {
  await userEvent.click(screen.getByRole('radio', { name: 'Amazon S3' }))
  await waitFor(() => expect(screen.queryByText('Looking at the published folder…')).toBeNull())
}

// Not inside an InfoTip's popover, a hidden attribute or a visually hidden span.
function shownOnPage(el: HTMLElement) {
  expect(el.closest('[hidden]')).toBeNull()
  expect(el.className).not.toMatch(/hidden/)
}

describe('the publish dialog keeps paths off the page [DLG-6b, AP-9]', () => {
  // The font tick part (ui/font-share-choice, not this slice's) still draws a font's path, so
  // the made-up folder holds a picture only; the file list itself holds no path of any file.
  it('has no picture path in its text, titles, names or any attribute', async () => {
    const { dialog } = await openPublish({ existing: { ...PUBLISHED, otherProject: true } })
    await chooseS3()
    const html = dialog.outerHTML
    expect(html).not.toContain(SECRET_FOLDER)
    expect(html).not.toContain('Private Folder Nine')
    for (const c of FILES.filter((f) => f.kind !== 'font')) expect(html).not.toContain(c.localPath)
  })

  it('draws no path of any file in the file list', async () => {
    const { dialog } = await openPublish()
    const list = within(dialog).getByRole('region', { name: 'Files that will be uploaded' })
    for (const c of FILES) expect(list.outerHTML).not.toContain(c.localPath)
    expect(list.outerHTML).not.toContain('/Users/')
  })

  it('lists each file by name and kind, with a thumbnail by asset address only', async () => {
    const { dialog } = await openPublish()
    const list = within(dialog).getByRole('region', { name: 'Files that will be uploaded' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(FILES.length)
    expect(list).toHaveTextContent('Beach at dawn')
    expect(list).toHaveTextContent('Picture')
    expect(list).toHaveTextContent('Font')
    const sources = [...list.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    for (const src of sources) expect(src).toMatch(/^adman-asset:\/\/p1\/[0-9A-Z]+$/)
  })
})

describe('the data-leaving lines stay on the page [DLG-6b]', () => {
  it('shows "Files carry their prompts." and is described by the full prompt sentence', async () => {
    const { dialog } = await openPublish()
    const line = within(dialog).getByText('Files carry their prompts.')
    shownOnPage(line)
    expect(dialog).toHaveAccessibleDescription(PROMPT_LINE)
    expect(within(dialog).getByRole('button', { name: 'About prompts' })).toBeInTheDocument()
  })

  it('shows what else is uploaded as chips', async () => {
    const { dialog } = await openPublish()
    const also = within(dialog).getByRole('list', { name: 'Also uploaded' })
    expect(
      within(also)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Ads', 'Report', 'Sheet', 'List'])
    expect(await axeViolations()).toEqual([])
  })
})

describe('Publish is gated by the "Replace" switch [DLG-6b, FR-241]', () => {
  it('shows "First publish" when nothing is there, and Publish needs no switch', async () => {
    const { dialog, fake } = await openPublish()
    await chooseS3()
    expect(within(dialog).getByText('First publish')).toBeInTheDocument()
    expect(within(dialog).queryByRole('switch')).toBeNull()
    await userEvent.click(publish())
    expect(runs(fake)).toEqual([
      {
        projectId: 'p1',
        campaignId: 'c1',
        storage: 's3',
        replaceConfirmed: false,
        proceedDespiteWarnings: false,
      },
    ])
  })

  it('keeps Publish disabled until the switch is on, then sends replaceConfirmed once', async () => {
    const { dialog, fake } = await openPublish({ existing: PUBLISHED })
    await chooseS3()
    const notice = within(dialog).getByText(
      `Replaces publish 3 · ${dateText(PUBLISHED.publishedAt ?? '')}`,
    )
    shownOnPage(notice)
    const replace = within(dialog).getByRole('switch', { name: 'Replace the published files' })
    expect(replace).not.toBeChecked()
    expect(publish()).toBeDisabled()
    await userEvent.click(publish())
    expect(runs(fake)).toEqual([])
    await userEvent.click(replace)
    expect(publish()).toBeEnabled()
    await userEvent.dblClick(publish())
    expect(runs(fake)).toEqual([expect.objectContaining({ replaceConfirmed: true })])
    expect(await axeViolations()).toEqual([])
  })

  it('turning the switch off again disables Publish', async () => {
    await openPublish({ existing: PUBLISHED })
    await chooseS3()
    const replace = screen.getByRole('switch', { name: 'Replace the published files' })
    await userEvent.click(replace)
    await userEvent.click(replace)
    expect(publish()).toBeDisabled()
  })

  it('keeps "from another project" as visible words on the notice', async () => {
    const { dialog } = await openPublish({ existing: { ...PUBLISHED, otherProject: true } })
    await chooseS3()
    shownOnPage(within(dialog).getByText('From another project'))
  })
})

describe('a destination that is not set up [DLG-6b]', () => {
  const storages: PublishInspect['storages'] = [
    { id: 's3', label: 'Amazon S3', ready: 'not_set_up' },
    { id: 'dropbox', label: 'Dropbox', ready: 'ready' },
  ]

  it('marks it "Not set", reads nothing for it, keeps Publish off, and offers Settings', async () => {
    const { dialog, fake, store, onClose } = await openPublish({ storages })
    expect(within(dialog).getByText('Not set')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Amazon S3' }))
    expect(inspected(fake).map((i) => (i as { storage: unknown }).storage)).toEqual([null])
    expect(publish()).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Settings' }))
    expect(fake.commands).toEqual([])
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(rememberedPage()).toBe('publish')
    expect(onClose).toHaveBeenCalled()
  })

  it('has no Settings button when the chosen one is set up', async () => {
    const { dialog } = await openPublish({ storages })
    await userEvent.click(screen.getByRole('radio', { name: 'Dropbox' }))
    expect(within(dialog).queryByRole('button', { name: 'Settings' })).toBeNull()
  })
})

describe('while publishing [DLG-6b]', () => {
  it('shows the "Publishing" bar with "Run in background", which closes the dialog', async () => {
    const { dialog, onClose } = await openPublish()
    await chooseS3()
    await userEvent.click(publish())
    expect(await within(dialog).findByRole('progressbar', { name: 'Publishing' })).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run in background' }))
    expect(onClose).toHaveBeenCalled()
  })
})

async function openApproval() {
  const fake = makeFakeApi()
  fake.onQuery('approvals.getPassword', () => ({ ok: true, data: { password: 'made-up-pass-1' } }))
  const user = userEvent.setup()
  await renderApp(
    <ApprovalDialog
      projectId={P}
      campaignId={C}
      open
      onClose={vi.fn()}
      data={forCampaign()}
      titles={TITLES}
    />,
    fake,
  )
  return { fake, user, dialog: screen.getByRole('dialog', { name: 'Approval link' }) }
}

describe('the approval dialog [DLG-6b]', () => {
  it('has icon buttons to copy, "New password…" in a menu, and sign-offs as rows', async () => {
    const { user, dialog } = await openApproval()
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Copy password' })).toBeInTheDocument()
    const list = within(dialog).getByRole('list', { name: 'Sign-offs for Square post' })
    expect(within(list).getByRole('listitem')).toHaveTextContent('ana@example.com')
    expect(await axeViolations()).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: /^More actions for/ }))
    await user.click(screen.getByRole('menuitem', { name: 'New password…' }))
    expect(dialog).toHaveTextContent(
      'People who already opened the link must enter the new password.',
    )
  })

  it('asks in a confirm dialog with "Keep link" focused; Escape and Keep send nothing', async () => {
    const { user, fake, dialog } = await openApproval()
    const turnOff = within(dialog).getByRole('button', { name: 'Turn off link…' })
    expect(turnOff).toHaveTextContent('Turn off…')
    await user.click(turnOff)
    const ask = screen.getByRole('dialog', { name: 'Turn off link?' })
    expect(ask).toHaveAccessibleDescription('Reviewers lose access. The gallery is deleted.')
    shownOnPage(within(ask).getByText(/The gallery and its pictures are deleted/))
    expect(within(ask).getByRole('button', { name: 'Keep link' })).toHaveFocus()
    expect(await axeViolations()).toEqual([])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Turn off link?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Approval link' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Turn off link…' }))
    await user.click(screen.getByRole('button', { name: 'Keep link' }))
    expect(fake.commands).toEqual([])
  })

  it('sends approvals.endLink once, only on "Turn off link"', async () => {
    const { user, fake, dialog } = await openApproval()
    await user.click(within(dialog).getByRole('button', { name: 'Turn off link…' }))
    const ask = screen.getByRole('dialog', { name: 'Turn off link?' })
    await user.dblClick(within(ask).getByRole('button', { name: 'Turn off link' }))
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['approvals.endLink', { projectId: P, campaignId: C }],
    ])
  })
})
