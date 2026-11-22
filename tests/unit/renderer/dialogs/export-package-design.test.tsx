// DLG-6a (spec/phases/design-wave-screens-b.md, "DLG-6a — Export and package"): the export and
// package dialogs redrawn. The ads are rows with ticks under one "All ads" tick; the folder is
// one row showing its base name, the full path only in that row's `title`; the overwrite line
// stays visible; progress is a bar; nothing is sent before the user's own click.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PackageDialog } from '@/renderer/dialogs/package-dialog'
import { OVERWRITE_NOTE } from '@/shared/export/messages'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import * as fx from './export-fixture'
import { asset, serveAssets } from './relink-fixture'

const allAds = () => screen.getByRole('checkbox', { name: 'All ads' })
const job = { kind: 'export' as const, variantId: null, provider: 'adman' }

// Every element under the page that names `text` in any attribute, as "attribute=value".
function attributesHolding(text: string): string[] {
  const found: string[] = []
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes(text)) found.push(`${attr.name}=${attr.value}`)
    }
  }
  return found
}

describe('DLG-6a the export dialog', () => {
  it('is titled by the campaign and shows "Ads {k}/{n}"', async () => {
    const { dialog } = await fx.openExport()
    expect(screen.getByRole('dialog', { name: 'Export Summer Splash' })).toBe(dialog)
    expect(dialog).toHaveTextContent('Ads 3/3')
    expect(screen.queryByRole('button', { name: 'Tick all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Untick all' })).toBeNull()
  })

  it('the "All ads" tick unticks and ticks every ad, and is mixed in between', async () => {
    const { fake, dialog } = await fx.openExport()
    await fx.chooseFolder()
    expect(allAds()).toBeChecked()
    await userEvent.click(allAds())
    for (const row of fx.ROWS) expect(screen.getByRole('checkbox', { name: row })).not.toBeChecked()
    expect(dialog).toHaveTextContent('Ads 0/3')
    expect(fx.button('Export')).toBeDisabled()
    await userEvent.click(allAds())
    for (const row of fx.ROWS) expect(screen.getByRole('checkbox', { name: row })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: fx.ROWS[1] }))
    expect(allAds()).toBePartiallyChecked()
    expect(dialog).toHaveTextContent('Ads 2/3')
    expect(fx.exportsSent(fake)).toEqual([])
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input({ variantIds: ['V1', 'V3'] })])
  })

  it('shows each ad as "{size} · {language}" with its tick', async () => {
    const { dialog } = await fx.openExport()
    const rows = within(dialog).getAllByRole('listitem')
    expect(rows.map((li) => li.textContent)).toEqual(['1x1 · en', '9x16 · de', '9x16 · en'])
  })

  it('shows the folder by its base name; the full path is only the row title', async () => {
    const { fake, dialog } = await fx.openExport()
    expect(attributesHolding('/Users/')).toEqual([])
    await fx.chooseFolder()
    expect(dialog).toHaveTextContent('Summer handover')
    expect(dialog.textContent).not.toContain('/Users/')
    expect(attributesHolding(fx.FOLDER)).toEqual([`title=${fx.FOLDER}`])
    expect(attributesHolding('/Users/')).toEqual([`title=${fx.FOLDER}`])
    expect(screen.queryByRole('textbox')).toBeNull()
    await fx.click('Change…')
    const picks = fake.queries.filter((q) => q.name === 'dialog.pickFolder')
    expect(picks).toEqual(
      [0, 1].map(() => ({ name: 'dialog.pickFolder', input: { title: 'Export to' } })),
    )
    expect(fx.exportsSent(fake)).toEqual([])
    expect(await axeViolations()).toEqual([])
  })

  it('keeps the overwrite sentence as visible words, with or without a folder', async () => {
    await fx.openExport()
    const line = screen.getByText(OVERWRITE_NOTE)
    expect(line).toBeVisible()
    expect(line.closest('[hidden]')).toBeNull()
    await fx.chooseFolder()
    expect(screen.getByText(OVERWRITE_NOTE)).toBeVisible()
  })

  it('chooses the picture format with PNG and JPG segments', async () => {
    const { fake } = await fx.openExport()
    await fx.chooseFolder()
    const format = screen.getByRole('group', { name: 'Picture format' })
    expect(within(format).getByRole('button', { name: 'PNG' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(within(format).getByRole('button', { name: 'JPG' }))
    expect(screen.getByRole('spinbutton', { name: 'JPG quality' })).toHaveValue(90)
    expect(fx.exportsSent(fake)).toEqual([])
    await fx.click('Export')
    expect(fx.exportsSent(fake)).toEqual([fx.input({ imageFormat: 'jpg' })])
  })

  it('shows a progress bar while exporting, then "{n} exported" and the failures', async () => {
    const { fake, dialog } = await fx.openExport()
    await fx.chooseFolder()
    await fx.click('Export')
    const bar = await screen.findByRole('progressbar', { name: 'Exporting' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    fake.emit('job.updated', jobRow('J9', { ...job, status: 'running', progress: 0.416 }))
    await screen.findByRole('progressbar', { name: 'Exporting' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(dialog).not.toHaveTextContent('Exporting…')
    expect(await axeViolations()).toEqual([])
    const result = { exported: 2, failed: 1, reportId: 'R1' }
    fake.emit('job.updated', jobRow('J9', { ...job, status: 'succeeded', progress: 1, result }))
    expect(await screen.findByText('2 exported')).toBeVisible()
    expect(screen.getByText('1 failed')).toBeVisible()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it.each([
    ['failed', 'The export failed.'],
    ['cancelled', 'The export was cancelled.'],
  ] as const)("keeps today's words when the export %s", async (status, words) => {
    const { fake } = await fx.openExport()
    await fx.chooseFolder()
    await fx.click('Export')
    await screen.findByRole('progressbar', { name: 'Exporting' })
    fake.emit('job.updated', jobRow('J9', { ...job, status }))
    expect(await screen.findByText(words)).toBeVisible()
  })

  it('warnings step: rows with visible words, a reason field, and Export anyway needs a click', async () => {
    const { fake, dialog } = await fx.openExport([fx.WARNED])
    await fx.chooseFolder()
    await fx.click('Export')
    const list = await screen.findByRole('list', { name: 'These ads have warnings' })
    expect(within(list).getByText('The headline runs past its box.')).toBeVisible()
    expect(within(list).getByText('<b>Low</b> contrast on the button.')).toBeVisible()
    expect(within(list).getByText('9x16 · de')).toBeVisible()
    const reason = screen.getByRole('textbox', { name: 'Reason for exporting anyway (optional)' })
    expect(reason).toHaveAttribute('placeholder', 'Why export anyway? (optional)')
    expect(fx.exportsSent(fake)).toHaveLength(1)
    expect(dialog.textContent).not.toContain('/Users/')
    expect(await axeViolations()).toEqual([])
    await userEvent.type(reason, 'Signed off')
    expect(fx.exportsSent(fake)).toHaveLength(1)
    await fx.click('Export anyway')
    expect(fx.exportsSent(fake)[1]).toEqual(
      fx.input({ proceedDespiteWarnings: true, reason: 'Signed off' }),
    )
  })
})

const PKG_FOLDER = '/Users/me/Desktop/Made-up handover'
const MISSING: Result<unknown> = {
  ok: false,
  error: {
    code: 'MISSING_FILE',
    message: 'A file this project uses cannot be found.',
    details: { assetIds: ['a3', 'a1'] },
  },
}
const DONE: Result<unknown> = {
  ok: true,
  data: {
    packagePath: `${PKG_FOLDER}/Summer Launch`,
    fileCount: 12,
    totalBytes: 50_593_792,
    skippedAssetIds: ['a1', 'a3'],
  },
}

async function openPackage(replies: Array<Result<unknown> | Promise<Result<unknown>>>) {
  const fake = makeFakeApi()
  serveAssets(fake, [asset('a1', 'picnic-table-wide.png'), asset('a3', 'hero-can-sunset.png')])
  fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: PKG_FOLDER } }))
  const sends = [...replies]
  fake.onCommand('project.package', () => sends.shift() ?? DONE)
  await renderApp(<PackageDialog projectId="p1" open onClose={() => undefined} />, fake)
  return { fake, dialog: screen.getByRole('dialog', { name: 'Package project' }) }
}

const packages = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'project.package')

describe('DLG-6a the package dialog', () => {
  it('keeps the description in an InfoTip and shows "Choose folder…"', async () => {
    const { fake } = await openPackage([])
    expect(screen.getByRole('button', { name: 'About packaging' })).toBeInTheDocument()
    const choose = screen.getByRole('button', { name: 'Choose a folder and package…' })
    expect(choose).toHaveTextContent(/^Choose folder…$/)
    expect(packages(fake)).toEqual([])
    expect(await axeViolations()).toEqual([])
  })

  it('shows "{n} missing" and the files as rows with "Find…" and "Skip them"', async () => {
    const { fake, dialog } = await openPackage([MISSING])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a folder and package…' }))
    expect(await within(dialog).findByText('2 missing')).toBeVisible()
    const list = screen.getByRole('list', { name: 'Missing files' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['hero-can-sunset.png', 'picnic-table-wide.png'])
    expect(screen.getByRole('button', { name: 'Find missing files…' })).toHaveTextContent(/^Find…$/)
    const skip = screen.getByRole('button', { name: 'Package without them' })
    expect(skip).toHaveTextContent(/^Skip them$/)
    expect(attributesHolding('/Users/')).toEqual([])
    expect(await axeViolations()).toEqual([])
    await userEvent.click(skip)
    expect(packages(fake).map((c) => c.input)).toEqual([
      { projectId: 'p1', targetDir: PKG_FOLDER, skipMissing: false },
      { projectId: 'p1', targetDir: PKG_FOLDER, skipMissing: true },
    ])
  })

  it('shows a Packaging bar while waiting, then a done mark with no path', async () => {
    let finish: (r: Result<unknown>) => void = () => {}
    const waiting = new Promise<Result<unknown>>((resolve) => (finish = resolve))
    const { dialog } = await openPackage([waiting])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a folder and package…' }))
    expect(screen.getByRole('progressbar', { name: 'Packaging' })).toBeInTheDocument()
    finish(DONE)
    expect(await within(dialog).findByText('12 files · 48.3 MB')).toBeVisible()
    expect(dialog).toHaveTextContent('2 missing files were left out.')
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(attributesHolding('/Users/')).toEqual([])
    expect(await axeViolations()).toEqual([])
  })
})
