// R2P-3 [D3]: a brief may name a picture by the asset ID of an image already in the project.
// It becomes a form photo with no import: one with no subject shows as already in the project
// and is attached at Create; one attached to the row's own subject shows as attached. The two
// new note lines show in the subject's notes.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SubjectPictures } from '@/shared/schemas/commands/brief'
import { assetRow } from '../../editor/editor-fixture'
import { briefApi, imports, openForm, photoNames, sent } from './brief-load-photos-fixture'
import { projectGet, subject } from './project-fixture'

const FREE_ID = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const OWN_ID = '01JABCDEFGHJKMNPQRSTVWXYZ1'
const UNKNOWN_ID = '01JABCDEFGHJKMNPQRSTVWXYZ2'

function api(pictures: SubjectPictures[]) {
  const { fake } = briefApi(pictures)
  const images = [
    assetRow(FREE_ID, { displayName: 'citrus-front.png' }),
    assetRow(OWN_ID, { displayName: 'berry-side.png', subjectId: 'berry-bottle' }),
  ]
  fake.onQuery('asset.list', () => ({ ok: true, data: images.map((row) => ({ ...row })) }))
  const reply = projectGet([], [subject('berry-bottle', 'Berry bottle')])
  fake.onQuery('project.get', () => ({ ok: true, data: reply }))
  return fake
}

describe('Load a brief: photos named by asset ID [D3, R2P-3]', () => {
  it('shows a free asset as already in the project, imports nothing, and attaches it at Create', async () => {
    const fake = api([
      { paths: [], assetIds: [FREE_ID], notes: [] },
      { paths: [], assetIds: [], notes: [] },
    ])
    const form = await openForm(fake)
    expect(photoNames(form, 1)).toEqual(['citrus-front.png'])
    const row = within(form).getByRole('group', { name: 'Subject 1' })
    expect(row).toHaveTextContent('Already in this project')
    expect(form).toHaveTextContent('This brief added 1 photo(s). Check them before you')
    expect(imports(fake)).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(sent(fake, 'campaign.create')).toHaveLength(1))
    expect(sent(fake, 'asset.update')).toContainEqual({
      projectId: 'P1',
      assetId: FREE_ID,
      subjectId: 'citrus-can',
    })
  })

  it("shows an asset of the row's own subject as attached, once", async () => {
    const fake = api([
      { paths: [], assetIds: [FREE_ID], notes: [] },
      { paths: [], assetIds: [OWN_ID], notes: [] },
    ])
    const form = await openForm(fake)
    const row = within(form).getByRole('group', { name: 'Subject 2' })
    expect(within(row).getAllByText('berry-side.png')).toHaveLength(1)
    expect(row).toHaveTextContent('Already attached')
    expect(photoNames(form, 2)).toEqual([])
  })

  it('shows the not_full_path and unknown_asset lines in the notes', async () => {
    const fake = api([
      {
        paths: [],
        assetIds: [FREE_ID],
        notes: [
          { name: 'jar.png', reason: 'not_full_path' },
          { name: UNKNOWN_ID, reason: 'unknown_asset' },
        ],
      },
      { paths: [], assetIds: [], notes: [] },
    ])
    const form = await openForm(fake)
    const notes = within(form).getByRole('list', { name: 'Notes on the photos of subject 1' })
    expect(
      within(notes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'The photo "jar.png" was not used: a pasted brief has no folder, so give the photo\'s full path or its asset ID.',
      `No picture with the asset ID "${UNKNOWN_ID}" is in this project.`,
    ])
  })
})
