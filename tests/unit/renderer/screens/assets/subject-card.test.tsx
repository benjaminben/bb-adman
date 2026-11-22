// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject card"): its photos,
// removing one (a detach, the file stays), "Add photos…" with the attach step, and "Edit…".
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { subjectPhotos } from '@/renderer/screens/assets/assets-panel/asset-groups'
import { assetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { SubjectCard } from '@/renderer/screens/assets/subject-card'
import cardStyles from '@/renderer/screens/assets/subject-card/subject-card.module.css'
import stripStyles from '@/renderer/ui/photo-strip/photo-strip.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { PLANTED_ABS, asset, type ListedAsset } from './assets-fixture'

const BLEND: SubjectRow = {
  id: 's-blend',
  name: 'Harbour Blend',
  description: 'A dark roast in a blue tin.',
  createdAt: '2026-11-20T00:00:00.000Z',
}
const PARK: SubjectRow = { ...BLEND, id: 's-park', name: 'Linnea Park', description: '' }

const ROWS: ListedAsset[] = [
  asset('tin', { displayName: 'tin.png', subjectId: 's-blend' }),
  asset('gone', { displayName: 'gone.png', subjectId: 's-blend', missing: true }),
  asset('face', { displayName: 'face.png', subjectId: 's-park' }),
  asset('cup', { displayName: 'cup.png' }),
  asset('clip', { kind: 'video', displayName: 'pour.mp4', subjectId: 's-blend' }),
]
const PICKED = [`${PLANTED_ABS}tin-side.png`, `${PLANTED_ABS}tin-top.png`]

function api(rows: ListedAsset[] = ROWS) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: PICKED } }))
  return fake
}

async function renderCard(fake = api(), subject = BLEND) {
  const photos = subjectPhotos(ROWS.map(assetView), subject.id)
  const view = await renderApp(
    <main>
      <h1>Tidewater Coffee</h1>
      <h2>Assets</h2>
      <h3>Subjects · 2</h3>
      <SubjectCard projectId="P1" subject={subject} photos={photos} subjects={[BLEND, PARK]} />
    </main>,
    fake,
  )
  return { ...view, card: screen.getByRole('article', { name: subject.name }) }
}

const named = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name)

describe('SubjectCard [R2C-6]', () => {
  it('shows the name, the description and the pictures of this subject only', async () => {
    const { card } = await renderCard()
    expect(within(card).getByRole('heading', { level: 4 })).toHaveTextContent('Harbour Blend')
    expect(within(card).getByText('A dark roast in a blue tin.')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'tin.png' })).toHaveAttribute(
      'src',
      'adman-asset://P1/tin',
    )
    expect(within(card).getByText('File not found')).toBeInTheDocument()
    expect(within(card).queryByRole('img', { name: 'face.png' })).toBeNull()
    expect(within(card).queryByRole('img', { name: 'cup.png' })).toBeNull()
    expect(within(card).queryByRole('img', { name: 'pour.mp4' })).toBeNull()
  })

  it('shows an empty strip with the "+" tile with none, and leaves out an empty description', async () => {
    const { card } = await renderCard(api(), { ...PARK, id: 's-none' })
    const list = within(card).getByRole('list', { name: 'Photos of Linnea Park' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(
      within(list).getByRole('button', { name: 'Add photos to Linnea Park' }),
    ).toBeInTheDocument()
    expect(card.querySelectorAll('p')).toHaveLength(1)
  })

  it('removes a photo from the subject with asset.update and subjectId null', async () => {
    const { fake } = await renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Remove tin.png from Harbour Blend' }))
    expect(named(fake, 'asset.update')).toEqual([
      { name: 'asset.update', input: { projectId: 'P1', assetId: 'tin', subjectId: null } },
    ])
    expect(named(fake, 'asset.remove')).toEqual([])
  })

  it('sends nothing when the picker is cancelled', async () => {
    const fake = api()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await renderCard(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    expect(fake.commands).toEqual([])
  })

  it('picks pictures, imports them to the subject and says how many were added', async () => {
    const fake = api()
    let finish: (value: { ok: true; data: unknown }) => void = () => {}
    fake.onCommand('asset.import', () => new Promise((resolve) => (finish = resolve)))
    await renderCard(fake)
    const add = screen.getByRole('button', { name: 'Add photos to Harbour Blend' })
    await userEvent.click(add)
    expect(fake.queries.find((q) => q.name === 'dialog.pickFiles')?.input).toEqual({
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Adding photos…')
    expect(add).toBeDisabled()
    expect(named(fake, 'asset.import')).toEqual([
      {
        name: 'asset.import',
        input: {
          projectId: 'P1',
          paths: PICKED,
          library: 'asset',
          copy: false,
          subjectId: 's-blend',
        },
      },
    ])
    finish({
      ok: true,
      data: { assetIds: ['n1', 'n2'], reusedAssetIds: [], skippedCount: 0, animatedAssetIds: [] },
    })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 photos added.'))
    expect(add).toBeEnabled()
    expect(named(fake, 'asset.update')).toEqual([])
  })

  it('attaches a reused photo with no subject, and leaves another subject’s with a note', async () => {
    const fake = api()
    fake.onCommand('asset.import', () => ({
      ok: true,
      data: {
        assetIds: ['cup', 'face'],
        reusedAssetIds: ['cup', 'face'],
        skippedCount: 0,
        animatedAssetIds: [],
      },
    }))
    await renderCard(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    const status = await screen.findByText('1 photo added.')
    expect(status.closest('[role="status"]')).toHaveTextContent(
      'face.png is already a photo of Linnea Park. It was left there.',
    )
    expect(named(fake, 'asset.update')).toEqual([
      { name: 'asset.update', input: { projectId: 'P1', assetId: 'cup', subjectId: 's-blend' } },
    ])
  })

  it('shows a refused import with its message', async () => {
    const fake = api()
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That file cannot be read.' },
    }))
    await renderCard(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That file cannot be read.')
  })

  it('draws no picked path, and opens the edit dialog from "Edit…"', async () => {
    const { card } = await renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    await screen.findByRole('status')
    expect(document.body.innerHTML).not.toContain(PLANTED_ABS)
    await userEvent.click(within(card).getByRole('button', { name: 'Edit Harbour Blend' }))
    expect(await screen.findByRole('dialog', { name: 'Edit Harbour Blend' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await renderCard()
    expect(await axeViolations()).toEqual([])
  })
})

describe('SubjectCard, the photo strip [AST-2]', () => {
  it('draws the photos as the strip "Photos of {name}" with the "+" tile last', async () => {
    const { card } = await renderCard()
    const list = within(card).getByRole('list', { name: 'Photos of Harbour Blend' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(list).getByTitle('File not found').closest('li')).not.toBe(items[2])
    expect(within(items[2]!).getByRole('button', { name: 'Add photos to Harbour Blend' })).toBe(
      within(card).getByTitle('Add photos to Harbour Blend'),
    )
  })

  it('has no visible "Add photos…", "Edit…" or "No photos yet" words, and a pencil to edit', async () => {
    const { card } = await renderCard()
    expect(within(card).queryByText(/Add photos…|Edit…|No photos yet/)).toBeNull()
    const edit = within(card).getByRole('button', { name: 'Edit Harbour Blend' })
    expect(edit).toHaveAttribute('title', 'Edit Harbour Blend')
    expect(edit).toHaveTextContent('')
  })

  it('says "No photos yet" to a screen reader only, and gives the "+" tile the warn edge', async () => {
    const { card } = await renderCard(api(), { ...PARK, id: 's-none' })
    expect(within(card).getByText('No photos yet')).toHaveClass(cardStyles.hidden ?? 'missing')
    expect(within(card).getByRole('button', { name: 'Add photos to Linnea Park' })).toHaveClass(
      stripStyles.warn ?? 'missing',
    )
  })

  it('removes a photo from the subject only: the ✕ names the subject and sends no delete', async () => {
    const { fake, card } = await renderCard()
    await userEvent.click(
      within(card).getByRole('button', { name: 'Remove gone.png from Harbour Blend' }),
    )
    expect(fake.commands).toEqual([
      { name: 'asset.update', input: { projectId: 'P1', assetId: 'gone', subjectId: null } },
    ])
  })

  it('keeps picked paths out of every title, name and data attribute while and after adding', async () => {
    const fake = api()
    let finish: (value: { ok: true; data: unknown }) => void = () => {}
    fake.onCommand('asset.import', () => new Promise((resolve) => (finish = resolve)))
    await renderCard(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    await screen.findByText('Adding photos…')
    expect(document.body.innerHTML).not.toContain(PLANTED_ABS)
    finish({ ok: true, data: { assetIds: ['n1'], reusedAssetIds: [], animatedAssetIds: [] } })
    await screen.findByText('1 photo added.')
    expect(document.body.innerHTML).not.toContain(PLANTED_ABS)
  })

  it('has no accessibility violations with no photo', async () => {
    await renderCard(api(), { ...PARK, id: 's-none' })
    expect(await axeViolations()).toEqual([])
  })
})
