import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Result } from '@/shared/schemas/result'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import { emptySubject } from '@/renderer/screens/project-home/brief-form-model'
import { assetRow } from '../../editor/editor-fixture'
import { axeViolations } from '../../render'
import { subject } from './project-fixture'
import {
  oneRowForm,
  photoApi,
  photosOf,
  renderForm,
  reply,
  sentNames,
  subjectRow,
} from './subject-photos-fixture'

const added = (assetId: string) => ({ assetId, added: true })
const reused = (assetId: string) => ({ assetId, added: false })
const withPhotos = (photos: { assetId: string; added: boolean }[]) =>
  oneRowForm({ subjects: [{ ...emptySubject(), name: 'Can', photos }] })
const addButton = (form: HTMLElement, n = 1) =>
  within(photosOf(form, n)).getByRole('button', { name: `Add photos to subject ${n}` })
const removeButton = (form: HTMLElement, name: string, n = 1) =>
  within(photosOf(form, n)).getByRole('button', { name: `Remove photo ${name} from subject ${n}` })

describe('the "Photos" part of a subject row [subject-photos "What a row shows"]', () => {
  it('shows the legend, the hint, "No photos yet." and "Add photos"', async () => {
    const { form } = await renderForm(photoApi())
    const photos = photosOf(form, 1)
    expect(photos).toHaveTextContent(
      'Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed. AI pictures are drawn from them.',
    )
    expect(photos).toHaveTextContent('No photos yet.')
    expect(addButton(form)).toHaveTextContent('Add photos')
    expect(within(photos).queryByRole('list')).toBeNull()
  })

  it('lists each photo with its picture, a hidden name and "Remove"', async () => {
    const fake = photoApi([assetRow('A1', { displayName: 'can.png' })])
    const { form } = await renderForm(fake, withPhotos([added('A1')]))
    const list = within(photosOf(form, 1)).getByRole('list', { name: 'Photos of subject 1' })
    const picture = within(list).getByRole('img', { name: 'can.png' })
    expect(picture).toHaveAttribute('src', 'adman-asset://P1/A1')
    expect(within(list).getByText('can.png')).toHaveAttribute('aria-hidden', 'true')
    expect(removeButton(form, 'can.png')).toHaveTextContent('Remove')
    expect(photosOf(form, 1)).not.toHaveTextContent('No photos yet.')
  })

  it('shows "Already in this project" for a reused photo and "file not found" for a missing one', async () => {
    const fake = photoApi([assetRow('A1', { missing: true })])
    const { form } = await renderForm(fake, withPhotos([reused('A1')]))
    const list = within(photosOf(form, 1)).getByRole('list', { name: 'Photos of subject 1' })
    expect(list).toHaveTextContent('Already in this project')
    expect(list).toHaveTextContent('file not found')
    expect(within(list).queryByRole('img')).toBeNull()
  })

  it('shows an attached picture with "Already attached" and no button', async () => {
    const fake = photoApi([assetRow('C1', { subjectId: 'can-1', displayName: 'c.png' })])
    const values = oneRowForm({
      subjects: [{ ...emptySubject(), name: 'Can', mode: 'existing', existingId: 'can-1' }],
    })
    const { form } = await renderForm(fake, values, [subject('can-1', 'Can')])
    const list = within(photosOf(form, 1)).getByRole('list', { name: 'Photos of subject 1' })
    expect(list).toHaveTextContent('Already attached')
    expect(within(list).queryByRole('button')).toBeNull()
  })

  it('shows the notes as a list', async () => {
    const values = oneRowForm({
      subjects: [{ ...emptySubject(), name: 'Can', notes: ['The photo "x.png" was not found.'] }],
    })
    const { form } = await renderForm(photoApi(), values)
    const notes = within(photosOf(form, 1)).getByRole('list', {
      name: 'Notes on the photos of subject 1',
    })
    expect(
      within(notes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['The photo "x.png" was not found.'])
  })

  it('has no axe violations with photos, notes and the place box', async () => {
    const fake = photoApi([assetRow('A1'), assetRow('A2', { missing: true })])
    const values = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can', photos: [added('A1'), reused('A2')], notes: ['A note'] },
      ],
    })
    await renderForm(fake, values)
    expect(await axeViolations()).toEqual([])
  })
})

describe('"Add photos" [subject-photos "Add photos", A-110]', () => {
  it('picks pictures and imports them linked into the asset library with no subject', async () => {
    const fake = photoApi()
    const { form } = await renderForm(fake)
    await userEvent.click(addButton(form))
    await screen.findByRole('button', { name: 'Remove photo a.png from subject 1' })
    expect(fake.queries.find((q) => q.name === 'dialog.pickFiles')?.input).toEqual({
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    const input = fake.commands.find((c) => c.name === 'asset.import')?.input
    expect(input).toEqual({ projectId: 'P1', paths: ['/p/a.png'], library: 'asset', copy: false })
    expect(addButton(form)).toHaveFocus()
    expect(form).not.toHaveTextContent('/p/a.png')
  })

  it('sends nothing when the picker is cancelled', async () => {
    const fake = photoApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: null }))
    const { form } = await renderForm(fake)
    await userEvent.click(addButton(form))
    await waitFor(() => expect(fake.queries.map((q) => q.name)).toContain('dialog.pickFiles'))
    expect(fake.commands).toEqual([])
  })

  it('shows "Adding photos…" and disables "Add photos" while the import runs', async () => {
    const fake = photoApi()
    let finish = () => {}
    fake.onCommand(
      'asset.import',
      () => new Promise((done) => (finish = () => done({ ok: true, data: reply() }))),
    )
    const { form } = await renderForm(fake)
    await userEvent.click(addButton(form))
    expect(await within(photosOf(form, 1)).findByRole('status')).toHaveTextContent('Adding photos…')
    expect(addButton(form)).toBeDisabled()
    expect(form).toHaveTextContent('Subject 1: wait for the photos to be added.')
    finish()
    await waitFor(() => expect(addButton(form)).toBeEnabled())
    expect(within(photosOf(form, 1)).queryByRole('status')).toBeNull()
  })

  it('shows a reused photo as "Already in this project" and does not remove it on Remove', async () => {
    const fake = photoApi([assetRow('R1', { displayName: 'old.png' })])
    fake.answerImport({ ok: true, data: reply({ assetIds: ['R1'], reusedAssetIds: ['R1'] }) })
    const { form } = await renderForm(fake)
    await userEvent.click(addButton(form))
    await userEvent.click(await screen.findByRole('button', { name: /Remove photo old.png/ }))
    expect(sentNames(fake)).toEqual(['asset.import'])
  })

  const cases: [string, Result<AssetImportReply>, string][] = [
    [
      'a refusal adds its message',
      { ok: false, error: { code: 'INTERNAL', message: 'No such file.' } },
      'No such file.',
    ],
    [
      'an animated picture adds its note',
      { ok: true, data: reply({ assetIds: ['N1'], animatedAssetIds: ['N1'] }) },
      'a.png holds an animation. Adman uses its first picture.',
    ],
  ]
  it.each(cases)('%s to the notes', async (_, result, line) => {
    const fake = photoApi()
    fake.answerImport(result, [assetRow('N1', { displayName: 'a.png' })])
    const { form } = await renderForm(fake)
    await userEvent.click(addButton(form))
    const notes = await within(photosOf(form, 1)).findByRole('list', {
      name: 'Notes on the photos of subject 1',
    })
    expect(notes).toHaveTextContent(line)
  })

  it('removes the new photos at once when the row is gone before the import answers', async () => {
    const fake = photoApi()
    let finish = () => {}
    fake.onCommand(
      'asset.import',
      () =>
        new Promise((done) => {
          finish = () =>
            done({ ok: true, data: reply({ assetIds: ['N1', 'R1'], reusedAssetIds: ['R1'] }) })
        }),
    )
    const two = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can' },
        { ...emptySubject(), name: 'Box' },
      ],
    })
    const { form } = await renderForm(fake, two)
    await userEvent.click(addButton(form, 1))
    await userEvent.click(
      within(subjectRow(form, 1)).getByRole('button', { name: 'Remove subject 1' }),
    )
    finish()
    await waitFor(() => expect(sentNames(fake)).toContain('asset.remove'))
    expect(fake.commands.filter((c) => c.name === 'asset.remove').map((c) => c.input)).toEqual([
      { projectId: 'P1', assetId: 'N1' },
    ])
    expect(photosOf(form, 1)).toHaveTextContent('No photos yet.')
  })
})
