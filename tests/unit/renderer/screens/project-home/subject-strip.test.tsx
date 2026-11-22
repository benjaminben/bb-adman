// HOME-3b (spec/phases/design-wave-screens-b.md): the brief form's subjects are compact blocks
// in a Section "Subjects", each with its photos as a PhotoStrip; the hints sit in InfoTips,
// while the failures, the "add at least one photo" problem and the brief-photos line stay words.
import { describe, it, expect } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { emptySubject } from '@/renderer/screens/project-home/brief-form-model'
import { assetRow } from '../../editor/editor-fixture'
import { axeViolations } from '../../render'
import { subject } from './project-fixture'
import { oneRowForm, photoApi, renderForm, reply, subjectRow } from './subject-photos-fixture'

const added = (assetId: string) => ({ assetId, added: true })
const reused = (assetId: string) => ({ assetId, added: false })
const strip = (form: HTMLElement, n = 1) =>
  within(form).getByRole('list', { name: `Photos of subject ${n}` })
const plusTile = (form: HTMLElement, n = 1) =>
  within(strip(form, n)).getByRole('button', { name: `Add photos to subject ${n}` })
const HINT =
  'Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed. AI pictures are drawn from them.'
const PLACE_HINT =
  'Every photo guides the AI pictures either way. Ticked: the newest photo of the first subject that has one goes in the subject picture slot as it is. Not ticked: the slot starts empty. Any photo can be placed later.'

describe('the Subjects Section [HOME-3b]', () => {
  it('has a heading, the count, "Add subject" and the photos hint in an InfoTip', async () => {
    const { form } = await renderForm(photoApi())
    const section = within(form).getByRole('region', { name: 'Subjects' })
    expect(within(section).getByRole('heading', { name: 'Subjects' })).toBeInTheDocument()
    const add = within(section).getByRole('button', { name: 'Add subject' })
    expect(add).toHaveTextContent('Add')
    expect(within(section).getByText(HINT)).not.toBeVisible()
    await userEvent.click(within(section).getByRole('button', { name: 'About Photos' }))
    expect(within(section).getByText(HINT)).toBeVisible()
    await userEvent.click(add)
    expect(within(section).getAllByRole('group', { name: /^Subject \d$/ })).toHaveLength(2)
  })

  it('draws no fieldset legend "Subject 1" and keeps the block named for a screen reader', async () => {
    const { form } = await renderForm(photoApi())
    const legends = [...form.querySelectorAll('legend')].map((l) => l.textContent)
    expect(legends).not.toContain('Subject 1')
    expect(subjectRow(form, 1).tagName).not.toBe('FIELDSET')
  })

  it('shows "New" | "From project" as segments keeping their old names', async () => {
    const { form } = await renderForm(photoApi())
    const row = subjectRow(form, 1)
    const fresh = within(row).getByRole('radio', { name: 'New subject' })
    const held = within(row).getByRole('radio', { name: 'Use a subject this project has' })
    expect(fresh).toBeChecked()
    expect(held).toBeDisabled()
    expect(row).toHaveTextContent('New')
    expect(row).toHaveTextContent('From project')
    expect(within(row).getByTitle('This project has no subjects yet')).toBeInTheDocument()
    expect(within(row).getByLabelText('Subject ID')).toBeInTheDocument()
    expect(within(row).getByText('ID')).toBeInTheDocument()
  })

  it('shows the project subject select after "From project"', async () => {
    const { form } = await renderForm(photoApi(), oneRowForm(), [subject('tin-1', 'Tin')])
    const row = subjectRow(form, 1)
    await userEvent.click(
      within(row).getByRole('radio', { name: 'Use a subject this project has' }),
    )
    expect(within(row).getByRole('combobox', { name: 'Project subject' })).toBeInTheDocument()
    expect(within(row).queryByLabelText('Subject ID')).toBeNull()
  })

  it("disables the only subject's ✕ with its reason", async () => {
    const { form } = await renderForm(photoApi())
    const remove = within(subjectRow(form, 1)).getByRole('button', { name: 'Remove subject 1' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAttribute('title', 'A campaign needs one subject')
  })
})

describe('the photo strip of a subject [HOME-3b]', () => {
  it('is a list "Photos of subject {n}" holding only the "+" tile with no photo', async () => {
    const { form } = await renderForm(photoApi())
    expect(within(strip(form)).getAllByRole('listitem')).toHaveLength(1)
    expect(plusTile(form)).toBeEnabled()
  })

  it('keeps "add at least one photo" visible as a problem line and marks the "+" tile', async () => {
    const { form } = await renderForm(photoApi())
    const problems = within(form).getByRole('list', { name: 'To fix' })
    expect(problems).toHaveTextContent('Subject 1: add at least one photo.')
    expect(plusTile(form).className).toMatch(/warn/)
  })

  it('opens the picker from the "+" tile and draws the photo by its name, never a path', async () => {
    const fake = photoApi()
    const { form } = await renderForm(fake)
    await userEvent.click(plusTile(form))
    const picture = await within(strip(form)).findByRole('img', { name: 'a.png' })
    expect(picture).toHaveAttribute('src', 'adman-asset://P1/N1')
    expect(fake.queries.map((q) => q.name)).toContain('dialog.pickFiles')
    expect(form.innerHTML).not.toContain('/p/a.png')
    expect(form.innerHTML).not.toContain('/pictures/')
  })

  it.each([
    ['a photo this form added', added('A1'), [{ projectId: 'P1', assetId: 'A1' }]],
    ['a photo the project already had', reused('A1'), []],
  ])('✕ on %s takes it off the subject', async (_, photo, removes) => {
    const fake = photoApi([assetRow('A1')])
    const values = oneRowForm({ subjects: [{ ...emptySubject(), name: 'Can', photos: [photo] }] })
    const { form } = await renderForm(fake, values)
    await userEvent.click(
      within(strip(form)).getByRole('button', { name: 'Remove photo A1.png from subject 1' }),
    )
    expect(within(strip(form)).queryByRole('img')).toBeNull()
    expect(fake.commands.filter((c) => c.name === 'asset.remove').map((c) => c.input)).toEqual(
      removes,
    )
    expect(plusTile(form)).toHaveFocus()
  })

  it('keeps failure notes on the page as words, not in a tooltip', async () => {
    const fake = photoApi()
    fake.answerImport({ ok: false, error: { code: 'INTERNAL', message: 'No such file.' } })
    const { form } = await renderForm(fake)
    await userEvent.click(plusTile(form))
    const notes = await within(form).findByRole('list', {
      name: 'Notes on the photos of subject 1',
    })
    expect(within(notes).getByText('No such file.')).toBeVisible()
    expect(form.querySelector('[title="No such file."]')).toBeNull()
  })

  it('shows a missing file as words on its tile', async () => {
    const fake = photoApi([assetRow('A1', { missing: true })])
    const values = oneRowForm({
      subjects: [{ ...emptySubject(), name: 'Can', photos: [reused('A1')] }],
    })
    const { form } = await renderForm(fake, values)
    expect(within(strip(form)).getByText('File not found')).toBeVisible()
  })
})

describe('the brief-photos line and "Place first photo" [HOME-3b]', () => {
  it.each([
    [[added('A1')], 'This brief added 1 photo. Check them before you create the campaign.'],
    [
      [added('A1'), added('A2')],
      'This brief added 2 photos. Check them before you create the campaign.',
    ],
  ])('says how many photos the brief added with a real plural', async (photos, line) => {
    const fake = photoApi([assetRow('A1'), assetRow('A2')])
    const values = oneRowForm({ subjects: [{ ...emptySubject(), name: 'Can', photos }] })
    const { form } = await renderForm(fake, values)
    expect(within(form).getByText(line)).toBeVisible()
  })

  it('is a switch "Place first photo" with its old name and its help in an InfoTip', async () => {
    const { form } = await renderForm(photoApi())
    const toggle = within(form).getByRole('switch', {
      name: 'Start the ad with a subject photo placed',
    })
    expect(toggle).not.toBeChecked()
    expect(within(form).getByText('Place first photo')).toBeVisible()
    expect(within(form).getByText(PLACE_HINT)).not.toBeVisible()
    await userEvent.click(within(form).getByRole('button', { name: 'About Place first photo' }))
    expect(within(form).getByText(PLACE_HINT)).toBeVisible()
  })
})

describe('what the form sends does not change [HOME-3b]', () => {
  it('sends the filled subject controls as before', async () => {
    const fake = photoApi()
    const { form, onCreate } = await renderForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'Add subject' }))
    const fill = async (n: number, name: string, description: string, id: string) => {
      const row = subjectRow(form, n)
      await userEvent.clear(within(row).getByLabelText('Name'))
      await userEvent.type(within(row).getByLabelText('Name'), name)
      await userEvent.type(within(row).getByLabelText('Description (optional)'), description)
      await userEvent.clear(within(row).getByLabelText('Subject ID'))
      await userEvent.type(within(row).getByLabelText('Subject ID'), id)
    }
    await fill(1, 'Tin', 'A tin can', 'tin-1')
    await fill(2, 'Box', 'A paper box', 'box-1')
    await userEvent.click(plusTile(form, 1))
    await within(strip(form, 1)).findByRole('img', { name: 'a.png' })
    fake.answerImport({ ok: true, data: reply({ assetIds: ['N2'] }) }, [
      assetRow('N2', { displayName: 'b.png' }),
    ])
    await userEvent.click(plusTile(form, 2))
    await within(strip(form, 2)).findByRole('img', { name: 'b.png' })
    await userEvent.click(within(form).getByRole('switch', { name: /subject photo placed/ }))
    const create = within(form).getByRole('button', { name: 'Create campaign' })
    await waitFor(() => expect(create).toBeEnabled())
    await userEvent.click(create)
    const plan = onCreate.mock.calls[0]?.[0]
    expect({
      subjects: plan.subjects,
      attach: plan.attach,
      brief: plan.campaign.brief.subjects,
      subjectMap: plan.campaign.subjectMap,
      placeSubjectPhoto: plan.campaign.placeSubjectPhoto,
    }).toEqual({
      subjects: [
        { projectId: 'P1', id: 'tin-1', name: 'Tin', description: 'A tin can' },
        { projectId: 'P1', id: 'box-1', name: 'Box', description: 'A paper box' },
      ],
      attach: [
        { projectId: 'P1', assetId: 'N1', subjectId: 'tin-1' },
        { projectId: 'P1', assetId: 'N2', subjectId: 'box-1' },
      ],
      brief: [
        { id: 'tin-1', name: 'Tin', description: 'A tin can' },
        { id: 'box-1', name: 'Box', description: 'A paper box' },
      ],
      subjectMap: [
        { subjectId: 'tin-1', create: false },
        { subjectId: 'box-1', create: false },
      ],
      placeSubjectPhoto: true,
    })
  })
})

describe('accessibility [HOME-3b]', () => {
  it('has no axe violations with two subjects, photos and a note', async () => {
    const fake = photoApi([assetRow('A1'), assetRow('A2', { missing: true })])
    const values = oneRowForm({
      subjects: [
        { ...emptySubject(), name: 'Can', photos: [added('A1'), reused('A2')], notes: ['A note'] },
        { ...emptySubject(), name: 'Box' },
      ],
    })
    await renderForm(fake, values)
    expect(await axeViolations()).toEqual([])
  })
})
