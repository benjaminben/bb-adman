import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PackageDialog } from '@/renderer/dialogs/package-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { asset, serveAssets } from './relink-fixture'

const FOLDER = '/Users/me/Desktop/Handover'
const DONE = { packagePath: `${FOLDER}/Summer Launch`, fileCount: 12, totalBytes: 50_593_792 }
const MISSING: Result<unknown> = {
  ok: false,
  error: {
    code: 'MISSING_FILE',
    message: 'A file this project uses cannot be found.',
    details: { assetIds: ['a3', 'a1'] },
  },
}
const TAKEN: Result<unknown> = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'A folder named Summer Launch is already there and not empty.',
  },
}

async function openDialog(
  replies: Array<Result<unknown>>,
  folders: Array<string | null> = [FOLDER],
) {
  const fake = makeFakeApi()
  serveAssets(fake, [
    asset('a1', 'picnic-table-wide.png'),
    asset('a2', 'logo-mark.png', { missing: false }),
    asset('a3', 'hero-can-sunset.png'),
  ])
  const picks = [...folders]
  fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: picks.shift() ?? null } }))
  const sends = [...replies]
  fake.onCommand('project.package', () => sends.shift() ?? done([]))
  const onClose = vi.fn()
  const view = await renderApp(<PackageDialog projectId="p1" open onClose={onClose} />, fake)
  const dialog = screen.getByRole('dialog', { name: 'Package project' })
  return { ...view, fake, onClose, dialog }
}

function packages(fake: ReturnType<typeof makeFakeApi>) {
  return fake.commands.filter((c) => c.name === 'project.package').map((c) => c.input)
}

const choose = () => userEvent.click(screen.getByRole('button', { name: /^Choose a.* folder/ }))
const send = (skipMissing: boolean) => ({ projectId: 'p1', targetDir: FOLDER, skipMissing })
function done(skippedAssetIds: string[]): Result<unknown> {
  return { ok: true, data: { ...DONE, skippedAssetIds } }
}

describe('the package dialog [spec/screens-campaign.md, Package project; FR-008, D-027]', () => {
  it('says what a package is and has the primary button focused on open', async () => {
    const { dialog } = await openDialog([])
    expect(dialog).toHaveTextContent(
      'Adman copies the project file and every file it uses into one new folder that can be ' +
        'opened on another computer. The project you have open does not change.',
    )
    expect(screen.getByRole('button', { name: 'Choose a folder and package…' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('sends nothing when the folder picker is cancelled', async () => {
    const { fake } = await openDialog([], [null])
    await choose()
    expect(fake.queries).toContainEqual({
      name: 'dialog.pickFolder',
      input: { title: 'Choose where to put the package' },
    })
    expect(packages(fake)).toEqual([])
    expect(screen.getByRole('button', { name: 'Choose a folder and package…' })).toBeEnabled()
  })

  it.each([
    [[], 'The package is ready: 12 file(s), 48.3 MB.'],
    [['a1', 'a3'], 'The package is ready: 12 file(s), 48.3 MB. 2 missing file(s) were left out.'],
  ])('with %j skipped shows the done line and Close', async (skipped, line) => {
    const { fake, onClose } = await openDialog([done(skipped)])
    await choose()
    expect(await screen.findByRole('status')).toHaveTextContent(line)
    expect(packages(fake)).toEqual([send(false)])
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    await userEvent.click(close)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Packaging… with every button disabled and stays open on Escape', async () => {
    let finish: (r: Result<unknown>) => void = () => {}
    const waiting = new Promise<Result<unknown>>((resolve) => (finish = resolve))
    const { fake, onClose } = await openDialog([])
    fake.onCommand('project.package', () => waiting)
    await choose()
    expect(screen.getByRole('status')).toHaveTextContent('Packaging… Large projects take a while.')
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    finish({ ok: true, data: { ...DONE, skippedAssetIds: [] } })
    expect(await screen.findByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('lists the missing files by name when refused with MISSING_FILE', async () => {
    const { dialog } = await openDialog([MISSING])
    await choose()
    const list = await screen.findByRole('list', { name: 'Missing files' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['hero-can-sunset.png', 'picnic-table-wide.png'])
    expect(dialog).toHaveTextContent(
      '2 file(s) cannot be found, so the package would not open with nothing missing.',
    )
    expect(screen.getByRole('button', { name: 'Find missing files…' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Package without them' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('"Package without them" sends skipMissing true with the same folder', async () => {
    const { fake } = await openDialog([MISSING, done(['a1', 'a3'])])
    await choose()
    await userEvent.click(await screen.findByRole('button', { name: 'Package without them' }))
    expect(await screen.findByRole('status')).toHaveTextContent('2 missing file(s) were left out.')
    expect(packages(fake)).toEqual([send(false), send(true)])
    expect(fake.queries.filter((q) => q.name === 'dialog.pickFolder')).toHaveLength(1)
  })

  it('"Find missing files…" opens the relink dialog with only those files, then packages again', async () => {
    const { fake } = await openDialog([MISSING])
    await choose()
    await userEvent.click(await screen.findByRole('button', { name: 'Find missing files…' }))
    const relink = await screen.findByRole('dialog', { name: 'Find missing files' })
    const rows = await within(relink).findAllByRole('listitem')
    expect(rows.map((r) => r.textContent?.split(' ')[0])).toEqual([
      'hero-can-sunset.png',
      'picnic-table-wide.png',
    ])
    expect(packages(fake)).toEqual([send(false)])

    await userEvent.click(within(relink).getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('button', { name: 'Close' })).toHaveFocus()
    expect(screen.queryByRole('dialog', { name: 'Find missing files' })).toBeNull()
    expect(packages(fake)).toEqual([send(false), send(false)])
  })

  it('shows another refusal and offers "Choose another folder…"', async () => {
    const other = '/Users/me/Desktop/Handover 2'
    const { fake } = await openDialog([TAKEN], [FOLDER, other])
    await choose()
    expect(await screen.findByRole('alert')).toHaveTextContent(TAKEN.ok ? '' : TAKEN.error.message)
    const again = screen.getByRole('button', { name: 'Choose another folder…' })
    expect(again).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Choose a folder and package…' })).toBeNull()
    await userEvent.click(again)
    await screen.findByRole('button', { name: 'Close' })
    expect(packages(fake)).toEqual([send(false), { ...send(false), targetDir: other }])
  })

  it('never draws the chosen folder or a file path', async () => {
    const { dialog } = await openDialog([MISSING, TAKEN])
    await choose()
    await screen.findByRole('list', { name: 'Missing files' })
    expect(dialog.textContent).not.toMatch(/[/\\]/)
    await userEvent.click(screen.getByRole('button', { name: 'Package without them' }))
    await screen.findByRole('alert')
    expect(dialog.textContent).not.toMatch(/[/\\]/)
  })

  it.each([
    ['ready', [] as Array<Result<unknown>>, null],
    ['done', [done(['a1'])], 'Close'],
    ['missing', [MISSING], 'Package without them'],
    ['refused', [TAKEN], 'Choose another folder…'],
  ])('has no axe violations when %s', async (state, replies, button) => {
    await openDialog(replies)
    if (button !== null) {
      await choose()
      await screen.findByRole('button', { name: button })
    }
    expect(await axeViolations()).toEqual([])
  })
})
