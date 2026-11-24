// D-109 (spec/screens-campaign.md, "Project home", item 2): the project's library drawn in the
// home page's own Assets block. The header row (InfoTip, missing mark, import buttons, "New
// subject…"), then the same groups as the Assets panel, from the shared list. No path drawn.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HomeAssets } from '@/renderer/screens/project-home/home-assets'
import { AssetsScope } from '@/renderer/screens/assets/assets-scope'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { PLANTED_ABS, PLANTED_REL, asset, type ListedAsset } from '../assets/assets-fixture'

const SUBJECTS: SubjectRow[] = [
  {
    id: 's-kite',
    name: 'Red Kite',
    description: 'A paper kite',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
]

const FILES: ListedAsset[] = [
  asset('a1', { displayName: 'cup.png' }),
  asset('a2', { displayName: 'kite.png', subjectId: 's-kite' }),
  asset('v1', { kind: 'video', displayName: 'pour.mp4', durationMs: 4000 }),
  asset('f1', { kind: 'font', displayName: 'Kettle.otf', fontFamily: 'Kettle Sans' }),
]

function listApi(rows: ListedAsset[] = FILES) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  return fake
}

async function draw(fake = listApi(), missingCount = 0) {
  await renderApp(
    <AssetsScope projectId="P1">
      <main>
        <HomeAssets projectId="P1" subjects={SUBJECTS} missingCount={missingCount} />
      </main>
    </AssetsScope>,
    fake,
  )
  return screen.getByRole('region', { name: 'Assets' })
}

describe('Project home, Assets block [D-109]', () => {
  it('is a region named by its h2 "Assets", with the groups and their counts', async () => {
    const block = await draw()
    expect(within(block).getByRole('heading', { name: 'Assets', level: 2 })).toBeInTheDocument()
    await within(block).findByText('cup.png')
    const groups = within(block).getAllByRole('region')
    expect(groups.map((g) => g.querySelector('h3')?.textContent)).toEqual([
      'Subjects',
      'Pictures',
      'Clips',
      'Fonts',
    ])
    expect(within(block).getByRole('region', { name: 'Pictures' })).toHaveTextContent('2')
    expect(within(block).getByRole('region', { name: 'Subjects' })).toHaveTextContent('1')
  })

  it('shows a picture, a clip, a font and a subject card', async () => {
    const block = await draw()
    await within(block).findByText('cup.png')
    expect(within(block).getByRole('region', { name: 'Clips' })).toHaveTextContent('pour.mp4')
    expect(within(block).getByRole('region', { name: 'Fonts' })).toHaveTextContent(
      'Family: Kettle Sans',
    )
    const card = within(within(block).getByRole('region', { name: 'Subjects' })).getByRole(
      'article',
    )
    expect(within(card).getByRole('heading', { name: 'Red Kite', level: 4 })).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'kite.png' })).toBeInTheDocument()
  })

  it('opens the subject dialog from "New subject…"', async () => {
    const block = await draw()
    const button = within(block).getByRole('button', { name: 'New subject…' })
    expect(button).toHaveTextContent('Subject')
    await userEvent.click(button)
    expect(await screen.findByRole('dialog', { name: 'New subject' })).toBeInTheDocument()
  })

  it('has "Import files…", "Import a folder…" and "About Assets", and no "Open assets"', async () => {
    const block = await draw()
    expect(within(block).getByRole('button', { name: 'Import files…' })).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Import a folder…' })).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'About Assets' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open assets' })).toBeNull()
  })

  it('shows the missing mark only when files are missing', async () => {
    await draw(listApi(), 2)
    expect(screen.getByRole('button', { name: /^2 missing/ })).toBeInTheDocument()
  })

  it('shows no missing mark when no file is missing', async () => {
    await draw()
    expect(screen.queryByRole('button', { name: /missing/ })).toBeNull()
  })

  it('shows a loading line until the first reply', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => new Promise(() => {}))
    await draw(fake)
    expect(screen.getByText('Loading the assets…')).toBeInTheDocument()
  })

  it('shows a refused read and reads again on Retry', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'The project is not open.' },
    }))
    await draw(fake)
    expect(await screen.findByRole('alert')).toHaveTextContent('The project is not open.')
    fake.onQuery('asset.list', () => ({ ok: true, data: FILES }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('cup.png')).toBeInTheDocument()
  })

  it('shows the empty lines with no asset', async () => {
    await draw(listApi([]))
    expect(await screen.findByText('No pictures yet.')).toBeInTheDocument()
    expect(screen.getByText('No clips yet.')).toBeInTheDocument()
    expect(screen.getByText('No fonts yet.')).toBeInTheDocument()
  })

  it('draws no path, hash or type anywhere', async () => {
    await draw()
    await screen.findByText('cup.png')
    const html = document.body.innerHTML
    for (const planted of [PLANTED_ABS, PLANTED_REL, 'Secret Folder', 'hash-a1', 'image/png'])
      expect(html).not.toContain(planted)
  })

  it('has no accessibility violations with files listed', async () => {
    await draw()
    await screen.findByText('cup.png')
    await waitFor(() => expect(screen.getByRole('region', { name: 'Fonts' })).toBeInTheDocument())
    expect(await axeViolations()).toEqual([])
  })
})
