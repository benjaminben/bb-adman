// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject dialog"): New makes
// the subject, imports the picked photos to it and runs the attach step; Edit sends only what
// changed. The picked files show by base name only; nothing is imported before Create.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'

const BLEND: SubjectRow = {
  id: 'Harbour-Blend',
  name: 'Harbour Blend',
  description: 'A dark roast.',
  createdAt: '2026-11-20T00:00:00.000Z',
}
const PICKED = ['/Users/linnea/Secret Shoot/tin-front.png', 'C:\\Shoots\\Hidden\\tin-side.webp']
const IMPORTED = { assetIds: ['n1', 'old'], reusedAssetIds: ['old'], skippedCount: 0 }
const LISTED = [{ id: 'old', displayName: 'tin-side.webp', subjectId: null }]

function Host(props: { subject?: SubjectRow }) {
  const [open, setOpen] = useState(true)
  return (
    <main>
      <h1>Tidewater Coffee</h1>
      <SubjectDialog
        projectId="P1"
        open={open}
        subjects={[BLEND]}
        {...(props.subject && { subject: props.subject })}
        onClose={() => setOpen(false)}
      />
    </main>
  )
}

function api() {
  const fake = makeFakeApi()
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: PICKED } }))
  fake.onQuery('asset.list', () => ({ ok: true, data: LISTED }))
  fake.onCommand('subject.create', () => ({ ok: true, data: { subjectId: 'Harbour-Blend-2' } }))
  fake.onCommand('asset.import', () => ({ ok: true, data: { ...IMPORTED, animatedAssetIds: [] } }))
  return fake
}

async function open(fake = api(), subject?: SubjectRow) {
  await renderApp(<Host {...(subject && { subject })} />, fake)
  return { fake, dialog: await screen.findByRole('dialog') }
}

const sent = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => c.name)
const field = (name: string) => screen.getByRole('textbox', { name })

async function fillAndPick(name = 'Harbour Blend') {
  await userEvent.type(field('Name'), name)
  await userEvent.click(screen.getByRole('button', { name: 'Add photos…' }))
  await screen.findByRole('list', { name: 'Photos to add' })
}

describe('SubjectDialog, New [R2C-6]', () => {
  it('shows the problems as lines and moves the focus to the first bad field', async () => {
    const { fake, dialog } = await open()
    expect(dialog).toHaveAccessibleName('New subject')
    await userEvent.click(screen.getByRole('button', { name: 'Create subject' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a name.')
    expect(alert).toHaveTextContent('Add at least one photo.')
    expect(field('Name')).toHaveFocus()
    await userEvent.type(field('Name'), 'Harbour Blend')
    await userEvent.click(screen.getByRole('button', { name: 'Create subject' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/^Add at least one photo\.$/)
    expect(screen.getByRole('button', { name: 'Add photos…' })).toHaveFocus()
    expect(fake.commands).toEqual([])
  })

  it('lists the picked files by base name only, and removes one', async () => {
    const { fake, dialog } = await open()
    await fillAndPick()
    const list = screen.getByRole('list', { name: 'Photos to add' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['tin-front.png', 'tin-side.webp'])
    for (const part of ['Secret Shoot', 'Hidden', '/Users', 'C:']) {
      expect(dialog.outerHTML).not.toContain(part)
    }
    await userEvent.click(screen.getByRole('button', { name: 'Remove tin-front.png' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(fake.commands).toEqual([])
  })

  it('adds nothing when the picker is cancelled', async () => {
    const fake = api()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await open(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Add photos…' }))
    expect(screen.queryByRole('list', { name: 'Photos to add' })).toBeNull()
    expect(fake.queries.find((q) => q.name === 'dialog.pickFiles')?.input).toEqual({
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
  })

  it('sends subject.create, asset.import with the picked paths, then asset.update', async () => {
    const { fake } = await open()
    await fillAndPick()
    await userEvent.type(screen.getByRole('textbox', { name: 'Description (optional)' }), 'Tin')
    await userEvent.click(screen.getByRole('button', { name: 'Create subject' }))
    await screen.findByText('Harbour Blend was made with 2 photo(s).')
    expect(fake.commands).toEqual([
      {
        name: 'subject.create',
        input: {
          projectId: 'P1',
          id: 'Harbour-Blend-2',
          name: 'Harbour Blend',
          description: 'Tin',
        },
      },
      {
        name: 'asset.import',
        input: {
          projectId: 'P1',
          paths: PICKED,
          library: 'asset',
          copy: false,
          subjectId: 'Harbour-Blend-2',
        },
      },
      {
        name: 'asset.update',
        input: { projectId: 'P1', assetId: 'old', subjectId: 'Harbour-Blend-2' },
      },
    ])
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus()
  })

  it('sends nothing more after a refused subject.create, and shows its message', async () => {
    const fake = api()
    fake.onCommand('subject.create', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'That subject ID is taken.' },
    }))
    await open(fake)
    await fillAndPick()
    await userEvent.click(screen.getByRole('button', { name: 'Create subject' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That subject ID is taken.')
    expect(sent(fake)).toEqual(['subject.create'])
    expect(screen.getByRole('button', { name: 'Create subject' })).toBeEnabled()
  })

  it('says the subject was made but its photos were not, after a refused import', async () => {
    const fake = api()
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That file cannot be read.' },
    }))
    await open(fake)
    await fillAndPick()
    await userEvent.click(screen.getByRole('button', { name: 'Create subject' }))
    expect(
      await screen.findByText(
        'Harbour Blend was made, but its photos could not be added: That file cannot be read.',
      ),
    ).toBeInTheDocument()
    expect(sent(fake)).toEqual(['subject.create', 'asset.import'])
  })

  it('has no accessibility violations with photos picked', async () => {
    await open()
    await fillAndPick()
    expect(await axeViolations()).toEqual([])
  })
})

describe('SubjectDialog, Edit [R2C-6]', () => {
  it('is filled in, has no photo part, and sends only the changed fields', async () => {
    const { fake, dialog } = await open(api(), BLEND)
    expect(dialog).toHaveAccessibleName('Edit Harbour Blend')
    expect(field('Name')).toHaveValue('Harbour Blend')
    expect(field('Description (optional)')).toHaveValue('A dark roast.')
    expect(screen.queryByRole('button', { name: 'Add photos…' })).toBeNull()
    await userEvent.clear(field('Description (optional)'))
    await userEvent.type(field('Description (optional)'), 'A light roast.')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([
      {
        name: 'subject.update',
        input: { projectId: 'P1', subjectId: 'Harbour-Blend', description: 'A light roast.' },
      },
    ])
  })

  it('closes without a command when nothing changed', async () => {
    const { fake } = await open(api(), BLEND)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([])
  })

  it('asks for a name, and shows a refusal in the dialog', async () => {
    const fake = api()
    fake.onCommand('subject.update', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'The subject is gone.' },
    }))
    await open(fake, BLEND)
    await userEvent.clear(field('Name'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.')
    expect(field('Name')).toHaveFocus()
    await userEvent.type(field('Name'), 'Harbour Roast')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The subject is gone.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await open(api(), BLEND)
    expect(await axeViolations()).toEqual([])
  })
})
