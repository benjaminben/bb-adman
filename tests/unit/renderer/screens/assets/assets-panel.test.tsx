// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "The panel"): reading, groups,
// marks, the subject choice, the refused read, no path drawn, Escape and focus return.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { AssetsPanel } from '@/renderer/screens/assets/assets-panel'
import { AssetsScope } from '@/renderer/screens/assets/assets-scope'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { PLANTED_ABS, PLANTED_REL, asset, type ListedAsset } from './assets-fixture'

const SUBJECTS: SubjectRow[] = [
  { id: 's-blend', name: 'Harbour Blend', description: '', createdAt: '2026-11-20T00:00:00.000Z' },
]

const FILES: ListedAsset[] = [
  asset('a1', { displayName: 'cup.png', library: 'reference' }),
  asset('a2', { displayName: 'beans.png', origin: 'generated', subjectId: 's-blend' }),
  asset('a3', { displayName: 'shop.png', storage: 'linked', missing: true }),
  asset('v1', {
    kind: 'video',
    displayName: 'pour.mp4',
    width: 1080,
    height: 1920,
    durationMs: 65000,
  }),
  asset('f1', { kind: 'font', displayName: 'Harbour.otf', fontFamily: 'Harbour Sans' }),
]

function listApi(rows: ListedAsset[] = FILES) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  return fake
}

async function openPanel(fake = listApi()) {
  const view = await renderApp(
    <AssetsScope projectId="P1">
      <main>
        <AssetsButton projectId="P1" />
      </main>
      <AssetsPanel projectId="P1" subjects={SUBJECTS} />
    </AssetsScope>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Assets' }))
  return { ...view, panel: screen.getByRole('region', { name: 'Assets' }) }
}

const lists = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'asset.list')
const changed = (projectId: string) => ({
  projectId,
  actor: 'user' as const,
  changed: {},
  removed: {},
})
const group = (name: RegExp) => screen.getByRole('region', { name })

describe('AssetsPanel [R2C-5]', () => {
  it('reads nothing while closed, then asset.list for its project on open', async () => {
    const fake = listApi()
    await renderApp(
      <AssetsScope projectId="P1">
        <AssetsPanel projectId="P1" subjects={[]} />
      </AssetsScope>,
      fake,
    )
    expect(lists(fake)).toEqual([])
    const { panel } = await openPanel(fake)
    expect(lists(fake)).toEqual([{ name: 'asset.list', input: { projectId: 'P1' } }])
    expect(panel).toHaveFocus()
  })

  it('reads again on project.changed and asset.changedOnDisk for this project only', async () => {
    const fake = listApi()
    await openPanel(fake)
    await screen.findByText('cup.png')
    act(() => fake.emit('project.changed', changed('P2')))
    act(() => fake.emit('asset.changedOnDisk', { projectId: 'P2', assetIds: ['x'] }))
    expect(lists(fake)).toHaveLength(1)
    act(() => fake.emit('project.changed', changed('P1')))
    act(() => fake.emit('asset.changedOnDisk', { projectId: 'P1', assetIds: ['a1'] }))
    await waitFor(() => expect(lists(fake)).toHaveLength(3))
  })

  it('drops a reply older than the newest read', async () => {
    const fake = makeFakeApi()
    const held: Array<(r: Result<unknown>) => void> = []
    fake.onQuery('asset.list', () => new Promise((resolve) => held.push(resolve)))
    await openPanel(fake)
    act(() => fake.emit('project.changed', changed('P1')))
    await waitFor(() => expect(held).toHaveLength(2))
    await act(async () => held[1]?.({ ok: true, data: [asset('n', { displayName: 'new.png' })] }))
    await act(async () => held[0]?.({ ok: true, data: [asset('o', { displayName: 'old.png' })] }))
    expect(screen.getByText('new.png')).toBeInTheDocument()
    expect(screen.queryByText('old.png')).toBeNull()
  })

  it('shows a loading line until the first reply', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => new Promise(() => {}))
    await openPanel(fake)
    expect(screen.getByText('Loading the assets…')).toBeInTheDocument()
  })

  it('draws the groups with counts, details and marks', async () => {
    await openPanel()
    await screen.findByText('cup.png')
    expect(group(/^Pictures · 3$/)).toBeInTheDocument()
    expect(within(group(/^Clips · 1$/)).getByText('1080×1920 · 1:05')).toBeInTheDocument()
    expect(within(group(/^Fonts · 1$/)).getByText('Family: Harbour Sans')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Other files/ })).toBeNull()
    const pictures = group(/^Pictures/)
    const row = (name: string) => within(pictures).getByText(name).closest('li') as HTMLElement
    expect(row('cup.png')).toHaveTextContent('Reference only')
    expect(row('beans.png')).toHaveTextContent('Made with AI')
    expect(row('shop.png')).toHaveTextContent('Linked')
    expect(row('cup.png')).toHaveTextContent('1200×800')
  })

  it('shows "File not found" in place of a missing picture', async () => {
    await openPanel()
    const row = (await screen.findByText('shop.png')).closest('li') as HTMLElement
    expect(within(row).getByText('File not found')).toBeInTheDocument()
    expect(row.querySelector('img')).toBeNull()
    const cup = screen.getByText('cup.png').closest('li') as HTMLElement
    expect(cup.querySelector('img')).toHaveAttribute('src', 'adman-asset://P1/a1')
  })

  it('shows each empty line with no asset, and keeps the action row', async () => {
    await openPanel(listApi([]))
    expect(await screen.findByText('No pictures yet.')).toBeInTheDocument()
    expect(screen.getByText('No clips yet.')).toBeInTheDocument()
    expect(screen.getByText('No fonts yet.')).toBeInTheDocument()
    expect(group(/^Pictures · 0$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import files…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import a folder…' })).toBeInTheDocument()
  })

  it('sends asset.update with the chosen subject, and with null for "No subject"', async () => {
    const { fake } = await openPanel()
    const cup = await screen.findByRole('combobox', { name: 'Subject of cup.png' })
    await userEvent.selectOptions(cup, 'Harbour Blend')
    const beans = screen.getByRole('combobox', { name: 'Subject of beans.png' })
    expect(beans).toHaveValue('s-blend')
    await userEvent.selectOptions(beans, 'No subject')
    expect(fake.commands.filter((c) => c.name === 'asset.update')).toEqual([
      { name: 'asset.update', input: { projectId: 'P1', assetId: 'a1', subjectId: 's-blend' } },
      { name: 'asset.update', input: { projectId: 'P1', assetId: 'a2', subjectId: null } },
    ])
    expect(screen.queryByRole('combobox', { name: 'Subject of pour.mp4' })).toBeNull()
  })

  it('shows a refused read with its message and reads again on Retry', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'The project is not open.' },
    }))
    await openPanel(fake)
    expect(await screen.findByRole('alert')).toHaveTextContent('The project is not open.')
    fake.onQuery('asset.list', () => ({ ok: true, data: FILES }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('cup.png')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('draws no path, hash or type anywhere in the panel', async () => {
    const { panel } = await openPanel()
    await screen.findByText('cup.png')
    const html = panel.outerHTML
    for (const planted of [PLANTED_ABS, PLANTED_REL, 'Secret Folder', 'hash-a1', 'image/png'])
      expect(html).not.toContain(planted)
  })

  it('closes on Escape and on "Close assets", giving the opener the focus', async () => {
    await openPanel()
    await screen.findByText('cup.png')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Assets' })).toBeNull()
    const button = screen.getByRole('button', { name: 'Assets' })
    expect(button).toHaveFocus()
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Close assets' }))
    expect(screen.queryByRole('region', { name: 'Assets' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('has no accessibility violations with files listed', async () => {
    await openPanel()
    await screen.findByText('cup.png')
    expect(await axeViolations()).toEqual([])
  })
})

describe('AssetsPanel, Subjects [R2C-6]', () => {
  const PARK: SubjectRow = { ...SUBJECTS[0]!, id: 's-park', name: 'linnea Park' }
  const ZINC: SubjectRow = { ...SUBJECTS[0]!, id: 's-zinc', name: 'Zinc Mug' }

  async function openWith(subjects: SubjectRow[], rows: ListedAsset[] = FILES) {
    await renderApp(
      <AssetsScope projectId="P1">
        <main>
          <AssetsButton projectId="P1" />
        </main>
        <AssetsPanel projectId="P1" subjects={subjects} />
      </AssetsScope>,
      listApi(rows),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Assets' }))
    return screen.getByRole('region', { name: 'Assets' })
  }

  it('draws the Subjects group first, a card per subject by name, with its photos', async () => {
    const panel = await openWith([ZINC, ...SUBJECTS, PARK])
    await screen.findByText('cup.png')
    const groups = within(panel).getAllByRole('region')
    expect(groups[0]).toHaveAccessibleName('Subjects · 3')
    const cards = within(groups[0]!).getAllByRole('article')
    expect(cards.map((c) => within(c).getByRole('heading', { level: 4 }).textContent)).toEqual([
      'Harbour Blend',
      'linnea Park',
      'Zinc Mug',
    ])
    expect(within(cards[0]!).getByRole('img', { name: 'beans.png' })).toBeInTheDocument()
    const empty = within(cards[1]!).getByRole('list', { name: 'Photos of linnea Park' })
    expect(within(empty).getAllByRole('listitem')).toHaveLength(1)
    expect(within(empty).getByRole('button', { name: 'Add photos to linnea Park' })).toBeVisible()
  })

  it('shows the empty lines with no subject', async () => {
    await openWith([], [])
    const subjects = await screen.findByRole('region', { name: 'Subjects · 0' })
    expect(within(subjects).getByText('No subjects yet.')).toBeInTheDocument()
    expect(
      within(subjects).getByText(
        'A subject is the product, service or person an ad is about. Its photos guide AI pictures and can be placed in ads.',
      ),
    ).toBeInTheDocument()
  })

  it('opens the new subject dialog from "New subject…" in the action row', async () => {
    await openWith(SUBJECTS)
    await screen.findByText('cup.png')
    await userEvent.click(screen.getByRole('button', { name: 'New subject…' }))
    expect(await screen.findByRole('dialog', { name: 'New subject' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: 'Assets' })).toBeInTheDocument()
  })
})
