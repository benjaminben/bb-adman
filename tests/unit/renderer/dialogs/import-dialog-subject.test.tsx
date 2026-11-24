// R2C-7 (spec/phases/round-2-campaign.md, design addition 5, "The import dialog"): the option
// "New subject…" and "Show in assets". The older cases are in import-dialog.test.tsx; these
// live apart only to keep each file under the line limit.
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { ImportDialog } from '@/renderer/dialogs/import-dialog'
import { AssetsScope, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../fake-api'
import { renderApp, axeViolations } from '../render'

const SUBJECTS: SubjectRow[] = [
  { id: 'citrus-can', name: 'Citrus can', description: '', createdAt: '2026-11-20T00:00:00Z' },
  { id: 'berry-bottle', name: 'Berry bottle', description: '', createdAt: '2026-11-20T00:00:00Z' },
]
const PATHS = ['/Users/me/Shoots/summer/can-front.png', 'C:\\Users\\me\\Pictures\\bottle.jpg']

const imported = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'asset.import')

type ScopeAt = 'none' | 'closed' | 'open' | 'other' | 'home'

// A stand-in for the panel: drawn while the scope says open, and focused on open as the real
// one is. `startOpen` opens it before the dialog is used.
function StandInPanel(props: { startOpen: boolean }) {
  const panel = useAssetsPanel()
  const startOpen = props.startOpen
  const show = panel?.show
  useEffect(() => {
    if (startOpen) show?.(null)
  }, [startOpen, show])
  if (!panel?.open) return null
  return <section aria-label="Assets" tabIndex={-1} ref={(el) => el?.focus()} />
}

function ScopedHost(props: { subjects: SubjectRow[]; scope: ScopeAt; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  const host = (
    <main>
      <h1>Summer</h1>
      <StandInPanel startOpen={props.scope === 'open'} />
      <ImportDialog
        projectId="P1"
        open={open}
        paths={PATHS}
        folder={false}
        subjects={props.subjects}
        onClose={() => {
          props.onClose()
          setOpen(false)
        }}
      />
    </main>
  )
  if (props.scope === 'none') return host
  // 'home': the project home, where the panel cannot be drawn (D-109).
  return (
    <AssetsScope
      projectId={props.scope === 'other' ? 'P2' : 'P1'}
      available={props.scope !== 'home'}
    >
      {host}
    </AssetsScope>
  )
}

async function openInScope(opts: { subjects?: SubjectRow[]; scope?: ScopeAt } = {}) {
  const fake = makeFakeApi()
  fake.onCommand('subject.create', (input) => ({
    ok: true,
    data: { subjectId: (input as { id: string }).id },
  }))
  fake.onCommand('asset.import', () => ({
    ok: true,
    data: { assetIds: ['A1', 'A2'], reusedAssetIds: [], skippedCount: 0 },
  }))
  const onClose = vi.fn()
  const subjects = opts.subjects ?? SUBJECTS
  await renderApp(
    <ScopedHost subjects={subjects} scope={opts.scope ?? 'closed'} onClose={onClose} />,
    fake,
  )
  const dialog = await screen.findByRole('dialog')
  return { fake, dialog, onClose }
}

const sent = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'subject.create' || c.name === 'asset.import')

async function chooseNew(dialog: HTMLElement) {
  await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'New subject…')
  return within(dialog).getByRole('textbox', { name: 'Subject name' })
}

describe('import dialog: a new subject [R2C-7]', () => {
  it.each([
    ['no subjects', []],
    ['some subjects', SUBJECTS],
  ])('offers "New subject…" last with %s', async (_label, subjects) => {
    const { dialog } = await openInScope({ subjects })
    const options = within(dialog).getAllByRole('option')
    expect(options.at(-1)).toHaveTextContent('New subject…')
    expect(options).toHaveLength(subjects.length + 2)
    expect(within(dialog).queryByRole('textbox', { name: 'Subject name' })).toBeNull()
  })

  it('shows "Subject name" with the focus once "New subject…" is chosen', async () => {
    const { dialog } = await openInScope()
    expect(await chooseNew(dialog)).toHaveFocus()
  })

  it('says "Enter the subject\'s name." for a blank name and sends nothing', async () => {
    const { fake, dialog } = await openInScope()
    await userEvent.type(await chooseNew(dialog), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Enter the subject's name.")
    expect(sent(fake)).toEqual([])
  })

  it('sends subject.create with an ID around the taken ones, then asset.import with it', async () => {
    const taken = [{ ...SUBJECTS[0]!, id: 'Harbour-Blend', name: 'Old blend' }]
    const { fake, dialog } = await openInScope({ subjects: taken })
    await userEvent.type(await chooseNew(dialog), '  Harbour Blend ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await within(dialog).findByRole('button', { name: 'Done' })
    const id = 'Harbour-Blend-2'
    expect(sent(fake).map((c) => [c.name, c.input])).toStrictEqual([
      ['subject.create', { projectId: 'P1', id, name: 'Harbour Blend', description: '' }],
      [
        'asset.import',
        { projectId: 'P1', paths: PATHS, library: 'asset', copy: false, subjectId: id },
      ],
    ])
  })

  it('shows a refused subject.create and imports nothing', async () => {
    const { fake, dialog } = await openInScope()
    const message = 'A subject with this ID already exists.'
    fake.onCommand('subject.create', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: {} },
    }))
    await userEvent.type(await chooseNew(dialog), 'Harbour Blend')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(imported(fake)).toEqual([])
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('says the subject was made when the import after it is refused', async () => {
    const { fake, dialog } = await openInScope()
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'bottle.jpg could not be read.', details: {} },
    }))
    await userEvent.type(await chooseNew(dialog), 'Harbour Blend')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await within(dialog).findByRole('button', { name: 'Done' })
    expect(dialog).toHaveTextContent(
      'Harbour Blend was made, but the files could not be imported: bottle.jpg could not be read.',
    )
    expect(fake.commands.map((c) => c.name)).not.toContain('subject.delete')
  })
})

describe('import dialog: "Show in assets" [R2C-7]', () => {
  async function importDone(scope: ScopeAt) {
    const opened = await openInScope({ scope })
    await userEvent.click(within(opened.dialog).getByRole('button', { name: 'Import' }))
    await within(opened.dialog).findByRole('button', { name: 'Done' })
    return opened
  }

  it.each([
    ['inside a scope with the panel closed', 'closed', true],
    ['outside a scope', 'none', false],
    ['with the panel open', 'open', false],
    ["in another project's scope", 'other', false],
    ['on the project home, where the library is on the page', 'home', false],
  ] as const)('is offered %s: %s', async (_label, scope, offered) => {
    const { dialog } = await importDone(scope)
    const button = within(dialog).queryByRole('button', { name: 'Show in assets' })
    expect(button !== null).toBe(offered)
  })

  it('closes the dialog and opens the panel, which keeps the focus', async () => {
    const { dialog, onClose } = await importDone('closed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Show in assets' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const panel = await screen.findByRole('region', { name: 'Assets' })
    await waitFor(() => expect(panel).toHaveFocus())
    await new Promise((done) => setTimeout(done, 20))
    expect(panel).toHaveFocus()
  })

  it('has no axe violations with a new subject chosen or "Show in assets" offered', async () => {
    const { dialog } = await openInScope()
    await chooseNew(dialog)
    expect(await axeViolations()).toEqual([])
    await userEvent.type(within(dialog).getByRole('textbox'), 'Harbour Blend')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await within(dialog).findByRole('button', { name: 'Show in assets' })
    expect(await axeViolations()).toEqual([])
  })
})
