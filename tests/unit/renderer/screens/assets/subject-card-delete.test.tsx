// SUBJ-1 (spec/phases/subject-delete.md, D-101): the subject card's trash button "Delete
// {name}", after the pencil, opens the delete dialog for that subject and sends nothing itself.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { subjectPhotos } from '@/renderer/screens/assets/assets-panel/asset-groups'
import { assetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { SubjectCard } from '@/renderer/screens/assets/subject-card'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { asset, type ListedAsset } from './assets-fixture'

const BLEND: SubjectRow = {
  id: 's-blend',
  name: 'Harbour Blend',
  description: 'A dark roast in a blue tin.',
  createdAt: '2026-11-20T00:00:00.000Z',
}
const PARK: SubjectRow = { ...BLEND, id: 's-park', name: 'Linnea Park', description: '' }

const ROWS: ListedAsset[] = [
  asset('tin', { displayName: 'tin.png', subjectId: 's-blend' }),
  asset('lid', { displayName: 'lid.png', subjectId: 's-blend' }),
  asset('face', { displayName: 'face.png', subjectId: 's-park' }),
]

async function renderCards() {
  const fake = makeFakeApi()
  const views = ROWS.map(assetView)
  const view = await renderApp(
    <main>
      <h1>Tidewater Coffee</h1>
      {[BLEND, PARK].map((subject) => (
        <SubjectCard
          key={subject.id}
          projectId="P1"
          subject={subject}
          photos={subjectPhotos(views, subject.id)}
          subjects={[BLEND, PARK]}
        />
      ))}
    </main>,
    fake,
  )
  return { ...view, fake }
}

describe('SubjectCard delete [SUBJ-1, D-101]', () => {
  it('has an icon button "Delete {name}" after the pencil', async () => {
    await renderCards()
    const card = screen.getByRole('article', { name: 'Harbour Blend' })
    const buttons = within(card).getAllByRole('button')
    const edit = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Edit Harbour Blend')
    const remove = within(card).getByRole('button', { name: 'Delete Harbour Blend' })
    expect(buttons[edit + 1]).toBe(remove)
    expect(remove).toHaveAttribute('title', 'Delete Harbour Blend')
    expect(remove).toHaveClass(layout.iconButton!)
  })

  it('opens the delete dialog for that subject, and sends nothing', async () => {
    const { fake } = await renderCards()
    const card = screen.getByRole('article', { name: 'Harbour Blend' })
    await userEvent.click(within(card).getByRole('button', { name: 'Delete Harbour Blend' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Harbour Blend?' })
    expect(dialog).toHaveAccessibleDescription(
      'This cannot be undone. Its 2 photos stay in the project without a subject.',
    )
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(fake.commands).toEqual([])
    expect(await axeViolations()).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([])
  })

  it('sends subject.delete for that subject only on "Delete subject"', async () => {
    const { fake } = await renderCards()
    const card = screen.getByRole('article', { name: 'Linnea Park' })
    await userEvent.click(within(card).getByRole('button', { name: 'Delete Linnea Park' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Linnea Park?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete subject' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([
      { name: 'subject.delete', input: { projectId: 'P1', subjectId: 's-park' } },
    ])
  })
})
