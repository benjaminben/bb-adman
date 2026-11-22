import { describe, it, expect } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { emptySubject } from '@/renderer/screens/project-home/brief-form-model'
import { assetRow } from '../../editor/editor-fixture'
import {
  oneRowForm,
  photoApi,
  photosOf,
  renderForm,
  sentNames,
  subjectRow,
} from './subject-photos-fixture'

const added = (assetId: string) => ({ assetId, added: true })
const reused = (assetId: string) => ({ assetId, added: false })
const IMAGES = [assetRow('A1'), assetRow('A2'), assetRow('A3')]
const three = () =>
  oneRowForm({
    subjects: [
      { ...emptySubject(), name: 'Can', photos: [added('A1'), reused('A2'), added('A3')] },
    ],
  })
const removeOf = (name: string) =>
  screen.getByRole('button', { name: `Remove photo ${name} from subject 1` })
const removes = (fake: ReturnType<typeof photoApi>) =>
  fake.commands.filter((c) => c.name === 'asset.remove').map((c) => c.input)

describe('removing a form photo [subject-photos "Removing a form photo", A-111]', () => {
  it('sends asset.remove for an added photo and takes it out of the row', async () => {
    const fake = photoApi(IMAGES)
    const { form } = await renderForm(fake, three())
    await userEvent.click(removeOf('A1.png'))
    expect(removes(fake)).toEqual([{ projectId: 'P1', assetId: 'A1' }])
    expect(within(photosOf(form, 1)).queryByRole('img', { name: 'A1.png' })).toBeNull()
  })

  it('ignores a refused asset.remove', async () => {
    const fake = photoApi(IMAGES)
    fake.onCommand('asset.remove', () => ({
      ok: false,
      error: { code: 'INTERNAL', message: 'No.' },
    }))
    const { form } = await renderForm(fake, three())
    await userEvent.click(removeOf('A3.png'))
    expect(within(photosOf(form, 1)).queryByRole('img', { name: 'A3.png' })).toBeNull()
    expect(form).not.toHaveTextContent('No.')
  })

  it.each([
    ['the next photo', 'A1.png', 'Remove photo A2.png from subject 1'],
    ['the previous photo when it was the last', 'A3.png', 'Remove photo A2.png from subject 1'],
  ])('puts focus on %s', async (_, name, target) => {
    await renderForm(photoApi(IMAGES), three())
    await userEvent.click(removeOf(name))
    expect(screen.getByRole('button', { name: target })).toHaveFocus()
  })

  it('puts focus on "Add photos" when no photo is left', async () => {
    const values = oneRowForm({
      subjects: [{ ...emptySubject(), name: 'Can', photos: [added('A1')] }],
    })
    await renderForm(photoApi(IMAGES), values)
    await userEvent.click(removeOf('A1.png'))
    expect(screen.getByRole('button', { name: 'Add photos to subject 1' })).toHaveFocus()
  })

  it('"Remove subject" removes the added photos of that row only', async () => {
    const fake = photoApi(IMAGES)
    const values = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can', photos: [added('A1'), reused('A2')] },
        { ...emptySubject(), name: 'Box', photos: [added('A3')] },
      ],
    })
    const { form } = await renderForm(fake, values)
    await userEvent.click(
      within(subjectRow(form, 1)).getByRole('button', { name: 'Remove subject 1' }),
    )
    expect(removes(fake)).toEqual([{ projectId: 'P1', assetId: 'A1' }])
    expect(within(photosOf(form, 1)).getByRole('img', { name: 'A3.png' })).toBeInTheDocument()
  })
})

describe('the photo rule on the form [subject-photos "Problem lines", "Reading the project\'s pictures"]', () => {
  it('reads asset.list for the pictures and blocks Create until the row has a photo', async () => {
    const fake = photoApi()
    const { form, onCreate } = await renderForm(fake)
    expect(fake.queries.find((q) => q.name === 'asset.list')?.input).toEqual({
      projectId: 'P1',
      kind: 'image',
    })
    expect(form).toHaveTextContent('Subject 1: add at least one photo.')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to subject 1' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(onCreate.mock.calls[0]?.[0].attach).toEqual([
      { projectId: 'P1', assetId: 'N1', subjectId: 'Can' },
    ])
  })

  it('shows a refused read as an alert and blocks Create', async () => {
    const fake = photoApi()
    fake.onQuery('asset.list', () => ({
      ok: false,
      error: { code: 'INTERNAL', message: 'Read failed.' },
    }))
    const { form } = await renderForm(fake)
    expect(within(form).getByRole('alert')).toHaveTextContent('Read failed.')
    expect(form).toHaveTextContent("The project's pictures could not be read.")
  })

  it('reads again on project.changed for this project and drops an older reply', async () => {
    const fake = photoApi()
    const answers: ((rows: typeof IMAGES) => void)[] = []
    fake.onQuery(
      'asset.list',
      () => new Promise((done) => answers.push((rows) => done({ ok: true, data: rows }))),
    )
    const { form } = await renderForm(
      fake,
      oneRowForm({ subjects: [{ ...emptySubject(), name: 'Can', photos: [added('A1')] }] }),
    )
    fake.emit('project.changed', { projectId: 'other', changed: {}, removed: {}, actor: 'user' })
    expect(answers).toHaveLength(1)
    fake.changed()
    await act(async () => answers[1]?.(IMAGES))
    await act(async () => answers[0]?.([]))
    expect(within(photosOf(form, 1)).getByRole('img', { name: 'A1.png' })).toBeInTheDocument()
  })
})

describe('the place box and the brief line [subject-photos "Start the ad…", A-119, A-125]', () => {
  it('starts unticked with its hint and follows placeSubjectPhoto', async () => {
    const { form } = await renderForm(photoApi())
    const box = within(form).getByRole('switch', {
      name: 'Start the ad with a subject photo placed',
    })
    expect(box).not.toBeChecked()
    await userEvent.click(within(form).getByRole('button', { name: 'About Place first photo' }))
    expect(
      within(form).getByText(
        'Every photo guides the AI pictures either way. Ticked: the newest photo of the first subject that has one goes in the subject picture slot as it is. Not ticked: the slot starts empty. Any photo can be placed later.',
      ),
    ).toBeVisible()
    await userEvent.click(box)
    expect(box).toBeChecked()
  })

  it('shows a ticked box when the values say so', async () => {
    const { form } = await renderForm(photoApi(), oneRowForm({ placeSubjectPhoto: true }))
    expect(within(form).getByRole('switch', { name: /subject photo placed/ })).toBeChecked()
  })

  it('counts the photos the form opened with and keeps the count', async () => {
    const fake = photoApi(IMAGES)
    const values = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can', photos: [added('A1'), reused('A2')] },
        { ...emptySubject(), name: 'Box', photos: [added('A3')] },
      ],
    })
    const { form } = await renderForm(fake, values)
    const line = 'This brief added 3 photos. Check them before you create the campaign.'
    expect(form).toHaveTextContent(line)
    await userEvent.click(removeOf('A1.png'))
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to subject 1' }))
    await screen.findByRole('button', { name: 'Remove photo a.png from subject 1' })
    expect(form).toHaveTextContent(line)
  })

  it('does not draw the line when the form opened with no photo', async () => {
    const { form } = await renderForm(photoApi())
    expect(form).not.toHaveTextContent('This brief added')
  })

  it('never sends asset.remove for a reused photo on "Remove subject"', async () => {
    const fake = photoApi(IMAGES)
    const values = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can', photos: [reused('A2')] },
        { ...emptySubject(), name: 'Box' },
      ],
    })
    const { form } = await renderForm(fake, values)
    await userEvent.click(
      within(subjectRow(form, 1)).getByRole('button', { name: 'Remove subject 1' }),
    )
    expect(sentNames(fake)).toEqual([])
  })
})
