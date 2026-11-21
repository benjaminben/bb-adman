// SP-4 (spec/subject-photos.md, "Photos from a loaded brief", "Create campaign"; A-124): a
// loaded brief's checked photo paths are copied into the project before the form opens, the
// notes show as lines, and "Create campaign" attaches the photos before campaign.create.
// Security: only a subjectPictures path reaches asset.import from here, always with copy: true;
// no path is drawn, logged or put in the campaign's brief.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PictureNote, SubjectPictures } from '@/shared/schemas/commands/brief'
import { noteLine } from '@/renderer/screens/project-home/brief-load/photo-notes'
import {
  PATHS,
  briefApi,
  imports,
  openForm,
  openPage,
  photoNames,
  sent,
} from './brief-load-photos-fixture'

const NOTES: PictureNote[] = [
  { name: 'out.png', reason: 'outside_folder' },
  { name: 'gone.png', reason: 'not_found' },
  { name: 'd.png', reason: 'not_a_picture' },
  { name: 'locked.png', reason: 'not_readable' },
  { name: 'typed.png', reason: 'no_folder' },
  { name: 'home.png', reason: 'wide_folder' },
]

afterEach(() => vi.restoreAllMocks())

describe("Load a brief: the brief's photos [SP-4, A-124]", () => {
  it('sends one asset.import per subject, each with copy: true, and opens the form with the photos', async () => {
    const { fake } = briefApi()
    const form = await openForm(fake)
    expect(imports(fake)).toEqual([
      { projectId: 'P1', paths: [PATHS[0]], library: 'asset', copy: true },
      { projectId: 'P1', paths: [PATHS[1]], library: 'asset', copy: true },
    ])
    expect(photoNames(form, 1)).toEqual(['can.png'])
    expect(photoNames(form, 2)).toEqual(['bottle.png'])
  })

  it('shows "Adding the brief\'s photos…" until the imports are back', async () => {
    const { fake, hold } = briefApi()
    const release = hold()
    await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Adding the brief's photos…")
    expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull()
    await act(async () => release())
    await screen.findByRole('region', { name: 'Brief' })
    expect(screen.queryByText("Adding the brief's photos…")).toBeNull()
  })

  it("shows every note's line, in the brief's order, and imports nothing for a subject with no path", async () => {
    const pictures: SubjectPictures[] = [
      { paths: [], notes: NOTES },
      { paths: [PATHS[1]], notes: [] },
    ]
    const { fake } = briefApi(pictures)
    const form = await openForm(fake)
    const notes = within(form).getByRole('list', { name: 'Notes on the photos of subject 1' })
    expect(
      within(notes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(NOTES.map(noteLine))
    expect(imports(fake).map((i) => i.paths)).toEqual([[PATHS[1]]])
  })

  it('gives the "could not be added" note for a refused copy, and not the banner', async () => {
    const { fake } = briefApi()
    const message = "The project's assets folder is missing."
    fake.refuseImport(PATHS[1], message)
    const form = await openForm(fake)
    const notes = within(form).getByRole('list', { name: 'Notes on the photos of subject 2' })
    expect(within(notes).getByRole('listitem')).toHaveTextContent(
      `The brief's photos could not be added: ${message}`,
    )
    expect(photoNames(form, 1)).toEqual(['can.png'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('removes the new assets when the page goes away during the import [A-111]', async () => {
    const { fake, hold } = briefApi()
    fake.reuse('B2')
    const release = hold()
    const { unmount } = await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await screen.findByRole('status')
    unmount()
    await act(async () => release())
    await waitFor(() =>
      expect(sent(fake, 'asset.remove')).toEqual([{ projectId: 'P1', assetId: 'B1' }]),
    )
  })

  it('draws, logs and sends on no path and logs no note', async () => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation(() => {}),
    )
    const { fake } = briefApi([
      { paths: [PATHS[0]], notes: NOTES },
      { paths: [PATHS[1]], notes: [] },
    ])
    await openForm(fake)
    for (const path of PATHS) expect(document.body.innerHTML).not.toContain(path)
    expect(document.body.innerHTML).not.toContain('/b/')
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(sent(fake, 'campaign.create')).toHaveLength(1))
    // brief.parse gets the picker's path; asset.import the reply's paths; nothing else any.
    const others = fake.commands.filter((c) => !['brief.parse', 'asset.import'].includes(c.name))
    expect(others.map((c) => c.name)).toContain('campaign.create')
    expect(JSON.stringify(others)).not.toContain('/b/')
    expect(JSON.stringify(others)).not.toContain('photos/')
    const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls))
    expect(logged).not.toContain('/b/')
    for (const note of NOTES) expect(logged).not.toContain(note.name)
  })
})
