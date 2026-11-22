// Design wave DLG-3b (spec/phases/design-wave-screens-b.md, "DLG-3b"): the import, brief
// reading, subject and paste dialogs. The import dialog shows names only, never a path, and
// draws icons, not pictures loaded from a path; nothing is sent before "Import". Paste: "Read
// brief" is last and the only primary, a refusal is an alert. Reading: "Type it" opens the
// empty form. Subject: descriptions in InfoTips, refusals as alerts, real plurals.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BriefReadingDialog } from '@/renderer/dialogs/brief-reading-dialog'
import { ImportDialog } from '@/renderer/dialogs/import-dialog'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import layout from '@/renderer/ui/layout.module.css'
import { BRIEF_TEXT_UNREADABLE } from '@/shared/brief/text'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { briefApi, openPage } from '../screens/project-home/brief-load-photos-fixture'
import { PROJECT, projectApi } from '../screens/project-home/project-fixture'

type Fake = ReturnType<typeof makeFakeApi>
const FOLDER = '/Users/made-up-person/Hidden Shoots/Spring'
const NINE = Array.from({ length: 9 }, (_, i) => `${FOLDER}/shot-${i + 1}.png`)
const sent = (fake: Fake, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)
const PRIMARY = layout.primary ?? 'primary'
const QUIET = layout.quiet ?? 'quiet'

function ImportHost(props: { paths: string[]; folder?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <main>
      <h1>Summer</h1>
      <ImportDialog
        projectId="P1"
        open={open}
        paths={props.paths}
        folder={props.folder ?? false}
        subjects={[]}
        onClose={() => {
          props.onClose?.()
          setOpen(false)
        }}
      />
    </main>
  )
}

type Reply = { assetIds: string[]; reusedAssetIds: string[] }

async function openImport(paths = NINE, reply: Reply = { assetIds: ['A1'], reusedAssetIds: [] }) {
  const fake = makeFakeApi()
  fake.onCommand('asset.import', () => ({ ok: true, data: { ...reply, skippedCount: 0 } }))
  const onClose = vi.fn()
  await renderApp(<ImportHost paths={paths} onClose={onClose} />, fake)
  return { fake, onClose, dialog: await screen.findByRole('dialog') }
}

describe('import dialog on the form frame [DLG-3b]', () => {
  it('titles nine files "Import 9 files", draws six icons with names and "+3"', async () => {
    const { dialog } = await openImport()
    expect(dialog).toHaveAccessibleName('Import 9 files')
    const strip = within(dialog).getByRole('list', { name: 'Files to import' })
    const items = within(strip).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('title'))).toEqual(
      ['1', '2', '3', '4', '5', '6'].map((n) => `shot-${n}.png`),
    )
    expect(items[0]).toHaveTextContent('shot-1.png')
    expect(dialog.querySelector('img')).toBeNull()
    expect(within(dialog).getByText('+3')).toBeVisible()
  })

  it('says "Import 1 file" for one file', async () => {
    const { dialog } = await openImport([`${FOLDER}/one.jpg`])
    expect(dialog).toHaveAccessibleName('Import 1 file')
  })

  it('never puts a folder of a path anywhere in its HTML', async () => {
    const { dialog } = await openImport([...NINE, 'C:\\Made Up\\Secret Drive\\can.webp'])
    for (const part of ['made-up-person', 'Hidden Shoots', 'Spring/', 'Secret Drive', 'C:']) {
      expect(document.body.innerHTML).not.toContain(part)
    }
    expect(dialog).toHaveAccessibleName('Import 10 files')
  })

  it('draws the library as segments "Assets" | "References" keeping the radio names', async () => {
    const { dialog } = await openImport()
    const assets = within(dialog).getByRole('radio', { name: 'Asset library (can go on a post)' })
    const refs = within(dialog).getByRole('radio', {
      name: 'Reference library (only to guide AI pictures)',
    })
    expect(assets).toBeChecked()
    expect(within(dialog).getByText('Assets')).toBeVisible()
    expect(within(dialog).getByText('References')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'About Assets' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'About References' })).toBeVisible()
    expect(refs).not.toBeChecked()
    const subject = within(dialog).getByRole('combobox', { name: 'Attach to a subject' })
    expect(within(dialog).getByText('Subject')).toBeVisible()
    expect(subject).toHaveValue('')
  })

  it.each([
    ['Assets', 'asset'],
    ['References', 'reference'],
  ])('sends the library chosen with "%s" only on Import', async (segment, library) => {
    const { fake, dialog } = await openImport()
    await userEvent.click(within(dialog).getByText(segment))
    expect(fake.commands).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(sent(fake, 'asset.import')).toHaveLength(1))
    expect(sent(fake, 'asset.import')[0]).toStrictEqual({
      projectId: 'P1',
      paths: NINE,
      library,
      copy: false,
    })
  })

  it('imports nothing on Cancel or Escape', async () => {
    for (const close of ['Cancel', 'Escape']) {
      const { fake, dialog, onClose } = await openImport()
      await userEvent.click(within(dialog).getByText('References'))
      if (close === 'Cancel')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      else await userEvent.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledOnce()
      expect(fake.commands).toEqual([])
    }
  })

  it('shows the result lines as a status, with real plurals', async () => {
    const reply = { assetIds: ['A1', 'R1'], reusedAssetIds: ['R1'] }
    const { dialog } = await openImport(NINE, reply)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    const result = await within(dialog).findByRole('list', { name: 'Import result' })
    expect(result.closest('[role="status"]')).not.toBeNull()
    expect(
      within(result)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1 file added.', '1 file was already in the project and was kept as it was.'])
  })

  it('has no axe violations', async () => {
    await openImport()
    expect(await axeViolations()).toEqual([])
  })
})

describe('paste a brief on the form frame [DLG-3b]', () => {
  async function openPaste(fake = briefApi().fake) {
    await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Paste a brief' }))
    return { fake, dialog: await screen.findByRole('dialog', { name: 'Paste a brief' }) }
  }

  it('has a placeholder, no hint line, and "Read brief" last and the only primary', async () => {
    const { dialog } = await openPaste()
    const area = within(dialog).getByLabelText('Brief text')
    expect(area).toHaveAttribute('placeholder', 'JSON, YAML or Markdown')
    expect(dialog).not.toHaveTextContent('Paste a brief as JSON, YAML or Markdown.')
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Empty form', 'Cancel', 'Read brief'])
    expect(buttons[0]).toHaveAccessibleName('Start from an empty form')
    expect(buttons[0]).toHaveClass(QUIET)
    expect(buttons.filter((b) => b.classList.contains(PRIMARY))).toEqual([buttons[2]])
    expect(await axeViolations()).toEqual([])
  })

  it('shows a refusal as a danger alert and sends only brief.parse', async () => {
    const { fake } = briefApi()
    fake.onCommand('brief.parse', () => ({ ok: false, error: BRIEF_TEXT_UNREADABLE }))
    const { dialog } = await openPaste(fake)
    await userEvent.click(within(dialog).getByLabelText('Brief text'))
    await userEvent.paste('# Brief\n')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Read brief' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(BRIEF_TEXT_UNREADABLE.message)
    expect(fake.commands.map((c) => c.name)).toEqual(['brief.parse'])
    expect(await axeViolations()).toEqual([])
  })
})

const reading = (over: Partial<JobRow>) =>
  jobRow('J1', {
    kind: 'brief_extraction',
    status: 'running',
    campaignId: null,
    variantId: null,
    slot: null,
    provider: 'gemini',
    ...over,
  })

describe('brief reading on the run frame [DLG-3b]', () => {
  it('on failure keeps the sentence, shows "Type it" and "Retry"; Stop before it', async () => {
    const fake = makeFakeApi()
    const calls = { onRead: vi.fn(), onTryAgain: vi.fn(), onByHand: vi.fn(), onClosed: vi.fn() }
    await renderApp(
      <BriefReadingDialog projectId="P1" jobId="J1" provider="gemini" {...calls} />,
      fake,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Reading the brief' })
    act(() => fake.emit('job.updated', reading({})))
    expect(within(dialog).getByRole('button', { name: 'Stop' })).toBeVisible()
    act(() => fake.emit('job.updated', reading({ status: 'failed', errorKind: 'timeout' })))
    expect(screen.getByText('Google Gemini took too long to answer. Try again.')).toBeVisible()
    const byHand = within(dialog).getByRole('button', { name: 'Fill the form by hand' })
    expect(byHand).toHaveTextContent(/^Type it$/)
    expect(within(dialog).getByRole('button', { name: 'Retry' })).toHaveClass(PRIMARY)
    expect(await axeViolations()).toEqual([])
    await userEvent.click(byHand)
    expect(calls.onByHand).toHaveBeenCalledOnce()
    expect(calls.onTryAgain).not.toHaveBeenCalled()
  })

  it('"Type it" opens the empty form after a text brief failed', async () => {
    const fake = projectApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/b/brief.md'] } }))
    fake.onCommand('brief.extract', () => ({ ok: true, data: { jobId: 'J1' } }))
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
    const run = await screen.findByRole('dialog', { name: 'Read the brief with AI' })
    expect(fake.commands).toEqual([])
    await userEvent.click(within(run).getByRole('button', { name: 'Read brief' }))
    await screen.findByRole('dialog', { name: 'Reading the brief' })
    act(() => fake.emit('job.updated', reading({ status: 'failed', errorKind: 'other' })))
    await userEvent.click(await screen.findByRole('button', { name: 'Fill the form by hand' }))
    const form = await screen.findByRole('region', { name: 'New campaign' })
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('')
  })
})

describe('subject dialog on the form frame [DLG-3b]', () => {
  function subjectApi() {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [`${FOLDER}/a.png`] } }))
    fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
    fake.onCommand('subject.create', () => ({ ok: true, data: null }))
    const imported = { assetIds: ['n1'], reusedAssetIds: [], skippedCount: 0 }
    fake.onCommand('asset.import', () => ({
      ok: true,
      data: { ...imported, animatedAssetIds: [] },
    }))
    return fake
  }

  async function openSubject(fake = subjectApi()) {
    await renderApp(<SubjectDialog projectId="P1" open subjects={[]} onClose={() => {}} />, fake)
    return { fake, dialog: await screen.findByRole('dialog', { name: 'New subject' }) }
  }

  it('puts the photos description in an InfoTip and problems in one alert', async () => {
    const { fake, dialog } = await openSubject()
    expect(within(dialog).getByText(/^PNG, JPEG or WebP\./)).not.toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'About Photos' })).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create subject' }))
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('Enter a name.')
    expect(alert).toHaveTextContent('Add at least one photo.')
    expect(fake.commands).toEqual([])
    expect(await axeViolations()).toEqual([])
  })

  it('says "was made with 1 photo." with a real plural, after create then import', async () => {
    const { fake, dialog } = await openSubject()
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Tin')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add photos…' }))
    await within(dialog).findByRole('list', { name: 'Photos to add' })
    expect(document.body.innerHTML).not.toContain('made-up-person')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create subject' }))
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Tin was made with 1 photo.',
    )
    expect(fake.commands.map((c) => c.name).slice(0, 2)).toEqual(['subject.create', 'asset.import'])
  })
})
