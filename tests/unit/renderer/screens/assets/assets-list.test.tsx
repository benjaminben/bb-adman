// D-109 (spec/screens-campaign.md, "Project home" and "The Assets panel"): one list for the
// panel and the home page. Where it is drawn sets the fold IDs ('assets.{key}' in the panel,
// 'home.assets.{key}' on the page) and the grids (two pictures a row in the panel; on the page,
// pictures and subject cards fill the width).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetsList, type ListPlace } from '@/renderer/screens/assets/assets-list'
import styles from '@/renderer/screens/assets/assets-list/assets-list.module.css'
import { readFold, writeFold } from '@/renderer/ui/section/fold-memory'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { asset } from './assets-fixture'

const SUBJECTS: SubjectRow[] = [
  { id: 's-kite', name: 'Red Kite', description: '', createdAt: '2026-11-20T00:00:00.000Z' },
]

async function draw(place: ListPlace) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: [asset('a1', { displayName: 'cup.png' })] }))
  await renderApp(<AssetsList projectId="P1" subjects={SUBJECTS} place={place} />, fake)
  await screen.findByText('cup.png')
}

const toggle = (name: string) =>
  within(screen.getByRole('region', { name })).getByRole('button', { name })

describe('AssetsList, where it is drawn [D-109]', () => {
  afterEach(() => {
    for (const id of ['assets.pictures', 'home.assets.pictures']) writeFold(id, true)
  })

  it('keeps the panel folds under assets.{key}', async () => {
    await draw('panel')
    await userEvent.click(toggle('Pictures'))
    expect(readFold('assets.pictures', true)).toBe(false)
    expect(readFold('home.assets.pictures', true)).toBe(true)
  })

  it('keeps the page folds under home.assets.{key}', async () => {
    await draw('page')
    await userEvent.click(toggle('Pictures'))
    expect(readFold('home.assets.pictures', true)).toBe(false)
    expect(readFold('assets.pictures', true)).toBe(true)
  })

  it('draws the panel grid of two pictures and subject cards in a column', async () => {
    await draw('panel')
    expect(screen.getByText('cup.png').closest('ul')).toHaveClass(styles.grid as string)
    const card = screen.getByRole('article')
    expect(card.parentElement).toHaveClass(styles.list as string)
  })

  it('draws the page grids for pictures and subject cards', async () => {
    await draw('page')
    expect(screen.getByText('cup.png').closest('ul')).toHaveClass(styles.pageGrid as string)
    const card = screen.getByRole('article')
    expect(card.parentElement).toHaveClass(styles.cards as string)
  })
})
