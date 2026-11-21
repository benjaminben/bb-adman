// The import dialog (spec/screens-campaign.md, "The import dialog"; FR-050, FR-052 to FR-054).
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ImportDialog } from '@/renderer/dialogs/import-dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../fake-api'
import { renderApp, axeViolations } from '../render'
import { asset } from './relink-fixture'

const SUBJECTS: SubjectRow[] = [
  { id: 'citrus-can', name: 'Citrus can', description: '', createdAt: '2026-11-20T00:00:00Z' },
  { id: 'berry-bottle', name: 'Berry bottle', description: '', createdAt: '2026-11-20T00:00:00Z' },
]
const PATHS = ['/Users/me/Shoots/summer/can-front.png', 'C:\\Users\\me\\Pictures\\bottle.jpg']

type Reply = { assetIds: string[]; reusedAssetIds: string[]; skippedCount: number }

function Host(props: { paths: string[]; folder: boolean; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <main>
      <h1>Summer</h1>
      <ImportDialog
        projectId="P1"
        open={open}
        paths={props.paths}
        folder={props.folder}
        subjects={SUBJECTS}
        onClose={() => {
          props.onClose()
          setOpen(false)
        }}
      />
    </main>
  )
}

async function openDialog(opts: { paths?: string[]; folder?: boolean; reply?: Reply } = {}) {
  const fake = makeFakeApi()
  const reply = opts.reply ?? { assetIds: ['A1', 'A2'], reusedAssetIds: [], skippedCount: 0 }
  fake.onCommand('asset.import', () => ({ ok: true, data: reply }))
  const onClose = vi.fn()
  await renderApp(
    <Host paths={opts.paths ?? PATHS} folder={opts.folder ?? false} onClose={onClose} />,
    fake,
  )
  const dialog = await screen.findByRole('dialog')
  return { fake, dialog, onClose }
}

const imported = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'asset.import')

describe('import dialog: choosing [FR-050, FR-052, FR-054]', () => {
  it('starts on Asset library, no copy and No subject, with the first radio focused', async () => {
    const { dialog } = await openDialog()
    const asset = within(dialog).getByRole('radio', { name: 'Asset library (can go on a post)' })
    expect(asset).toBeChecked()
    expect(asset).toHaveFocus()
    expect(
      within(dialog).getByRole('radio', { name: 'Reference library (only to guide AI pictures)' }),
    ).not.toBeChecked()
    expect(
      within(dialog).getByRole('checkbox', { name: "Copy into the project's assets folder" }),
    ).not.toBeChecked()
    expect(within(dialog).getByRole('combobox', { name: 'Attach to a subject' })).toHaveValue('')
    expect(within(dialog).getByRole('option', { name: 'No subject' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('option', { name: 'Citrus can (citrus-can)' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['the defaults', [], { library: 'asset', copy: false }],
    ['Reference library', ['reference'], { library: 'reference', copy: false }],
    ['copy ticked', ['copy'], { library: 'asset', copy: true }],
    ['a subject', ['subject'], { library: 'asset', copy: false, subjectId: 'berry-bottle' }],
    [
      'all three',
      ['reference', 'copy', 'subject'],
      { library: 'reference', copy: true, subjectId: 'berry-bottle' },
    ],
  ])('sends asset.import with %s', async (_label, steps, expected) => {
    const { fake, dialog } = await openDialog()
    for (const step of steps) {
      if (step === 'reference')
        await userEvent.click(within(dialog).getByRole('radio', { name: /Reference/ }))
      if (step === 'copy') await userEvent.click(within(dialog).getByRole('checkbox'))
      if (step === 'subject')
        await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'berry-bottle')
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(imported(fake)).toHaveLength(1))
    expect(imported(fake)[0]?.input).toStrictEqual({ projectId: 'P1', paths: PATHS, ...expected })
  })

  it('sends nothing on Cancel or Escape', async () => {
    for (const close of ['Cancel', 'Escape']) {
      const { fake, dialog, onClose } = await openDialog()
      if (close === 'Cancel')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      else await userEvent.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(imported(fake)).toEqual([])
    }
  })
})

describe('import dialog: names [spec/screens-campaign.md, Paths]', () => {
  it("titles the dialog by count and shows base names only, never a path's folders", async () => {
    const { dialog } = await openDialog()
    expect(dialog).toHaveAccessibleName('Import 2 file(s)')
    expect(dialog).toHaveTextContent('can-front.png')
    expect(dialog).toHaveTextContent('bottle.jpg')
    for (const folder of ['Users', 'Shoots', 'summer/', 'Pictures', 'C:']) {
      expect(dialog.textContent).not.toContain(folder)
    }
  })

  it('titles a folder import "Import a folder" and shows the folder\'s own name', async () => {
    const { dialog } = await openDialog({ paths: ['/Users/me/Shoots/Summer pack'], folder: true })
    expect(dialog).toHaveAccessibleName('Import a folder')
    expect(dialog).toHaveTextContent('Summer pack')
    expect(dialog.textContent).not.toContain('Shoots')
  })

  it('shows ten names and "and 1 more" for eleven files', async () => {
    const paths = Array.from({ length: 11 }, (_, i) => `/pics/shot-${i + 1}.png`)
    const { dialog } = await openDialog({ paths })
    const names = within(dialog).getByRole('list', { name: 'Files to import' })
    expect(within(names).getAllByRole('listitem')).toHaveLength(10)
    expect(names).not.toHaveTextContent('shot-11.png')
    expect(dialog).toHaveTextContent('and 1 more')
  })
})

describe('import dialog: importing and the result [FR-053]', () => {
  it('disables both buttons and Escape while the command waits', async () => {
    const { fake, dialog, onClose } = await openDialog()
    fake.onCommand('asset.import', () => new Promise(() => {}))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(await within(dialog).findByText('Importing…')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it.each([
    [
      'a mix of added, reused and skipped',
      { assetIds: ['A1', 'A2', 'A2', 'R1', 'R1'], reusedAssetIds: ['R1'], skippedCount: 3 },
      [
        '2 file(s) added.',
        '1 file(s) were already in the project and were kept as they were.',
        '3 item(s) in the folder were skipped: links, hidden files, and files Adman cannot use.',
      ],
    ],
    ['only added', { assetIds: ['A1'], reusedAssetIds: [], skippedCount: 0 }, ['1 file(s) added.']],
    [
      'only reused',
      { assetIds: ['R1', 'R2'], reusedAssetIds: ['R1', 'R2'], skippedCount: 0 },
      ['2 file(s) were already in the project and were kept as they were.'],
    ],
    [
      'all zero',
      { assetIds: [], reusedAssetIds: [], skippedCount: 0 },
      ['Nothing was imported. The folder holds no file Adman can use.'],
    ],
  ])('shows the result lines for %s, then Done closes', async (_label, reply, lines) => {
    const { dialog, onClose } = await openDialog({ reply })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    const done = await within(dialog).findByRole('button', { name: 'Done' })
    expect(done).toHaveFocus()
    const result = within(dialog).getByRole('list', { name: 'Import result' })
    expect(
      within(result)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(lines)
    expect(within(dialog).queryByRole('radio')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Import' })).toBeNull()
    await userEvent.click(done)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a refusal inside, keeps the choices, and lets Import be sent again', async () => {
    const { fake, dialog } = await openDialog()
    const message = 'bottle.jpg could not be read.'
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'file_not_readable' } },
    }))
    await userEvent.click(within(dialog).getByRole('checkbox'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(within(dialog).getByRole('checkbox')).toBeChecked()
    const again = within(dialog).getByRole('button', { name: 'Import' })
    expect(again).toBeEnabled()
    await userEvent.click(again)
    await waitFor(() => expect(imported(fake)).toHaveLength(2))
  })
})

describe('import dialog: accessibility', () => {
  it('has no axe violations while choosing or once done', async () => {
    const { dialog } = await openDialog()
    expect(await axeViolations()).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await within(dialog).findByRole('button', { name: 'Done' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('import dialog: animated WebP files [S2-17]', () => {
  it('names each animated WebP from asset.list, as text, after the counts', async () => {
    const animated = { assetIds: ['A1', 'A2'], reusedAssetIds: [], animatedAssetIds: ['A2'] }
    const reply: Reply = { ...animated, skippedCount: 0 }
    const { fake, dialog } = await openDialog({ reply })
    const rows = [asset('A1', 'can-front.png'), asset('A2', '<b>spin</b>.webp')]
    fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await within(dialog).findByText(/holds an animation/)
    const result = within(dialog).getByRole('list', { name: 'Import result' })
    expect(
      within(result)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '2 file(s) added.',
      '<b>spin</b>.webp holds an animation. Adman uses its first picture.',
    ])
    expect(result.querySelector('b')).toBeNull()
    expect(fake.queries).toContainEqual({ name: 'asset.list', input: { projectId: 'P1' } })
  })
})
