// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): the Assets panel in the design wave's
// look. A PanelHead with ✕, folding Sections with counts, pictures as a grid of thumbnails, the
// other files as ObjectRows with icon marks, compact density. No path, hash or type reaches the
// new markup, and "File not found" stays on the page as words.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { AssetsPanel } from '@/renderer/screens/assets/assets-panel'
import { AssetsScope } from '@/renderer/screens/assets/assets-scope'
import strip from '@/renderer/ui/photo-strip/photo-strip.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { PLANTED_ABS, PLANTED_REL, asset, type ListedAsset } from './assets-fixture'

const SUBJECTS: SubjectRow[] = [
  { id: 's-tin', name: 'Tin of Tea', description: '', createdAt: '2026-11-20T00:00:00.000Z' },
]

const FILES: ListedAsset[] = [
  asset('a1', { displayName: 'cup.png', library: 'reference' }),
  asset('a2', { displayName: 'leaves.png', origin: 'generated', subjectId: 's-tin' }),
  asset('a3', { displayName: 'shop.png', storage: 'linked', missing: true }),
  asset('v1', { kind: 'video', displayName: 'pour.mp4', origin: 'generated', durationMs: 4000 }),
  asset('v2', { kind: 'video', displayName: 'steam.mp4', missing: true, storage: 'linked' }),
  asset('f1', { kind: 'font', displayName: 'Kettle.otf', fontFamily: 'Kettle Sans' }),
  asset('t1', { kind: 'text', displayName: 'notes.txt', width: null, height: null }),
]

async function openPanel(rows: ListedAsset[] = FILES, subjects: SubjectRow[] = SUBJECTS) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  await renderApp(
    <AssetsScope projectId="P1">
      <main>
        <AssetsButton projectId="P1" />
      </main>
      <AssetsPanel projectId="P1" subjects={subjects} />
    </AssetsScope>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Assets' }))
  const panel = screen.getByRole('region', { name: 'Assets' })
  await within(panel).findByRole('region', { name: 'Pictures' })
  return { fake, panel }
}

const region = (name: string) => screen.getByRole('region', { name })

describe('AssetsPanel, design wave [AST-1]', () => {
  it('has a head "Assets" at level 2 with "Close assets", in compact density', async () => {
    const { panel } = await openPanel()
    expect(panel).toHaveAttribute('data-density', 'compact')
    expect(within(panel).getByRole('heading', { name: 'Assets', level: 2 })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Close assets' })).toHaveAttribute(
      'title',
      'Close assets',
    )
    const subject = within(panel).getByRole('button', { name: 'New subject…' })
    expect(subject).toHaveTextContent(/^Subject$/)
  })

  it('draws each group as a folding Section named by its title, with the count', async () => {
    const { panel } = await openPanel()
    const names = within(panel)
      .getAllByRole('region')
      .map((r) => within(r).getAllByRole('heading')[0]?.textContent)
    expect(names).toEqual(['Subjects', 'Pictures', 'Clips', 'Fonts', 'Other files'])
    for (const [name, count] of [
      ['Subjects', '1'],
      ['Pictures', '3'],
      ['Clips', '2'],
      ['Fonts', '1'],
      ['Other files', '1'],
    ] as const) {
      const group = region(name)
      expect(within(group).getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true')
      expect(within(group).getByText(count)).toBeInTheDocument()
    }
    const clips = within(region('Clips')).getByRole('button', { name: 'Clips' })
    await userEvent.click(clips)
    expect(within(region('Clips')).getByText('pour.mp4')).not.toBeVisible()
    await userEvent.click(clips)
    expect(within(region('Clips')).getByText('pour.mp4')).toBeVisible()
  })

  it('draws the pictures as a grid of images named by file, with the size in the tooltip', async () => {
    await openPanel()
    const pictures = region('Pictures')
    const images = within(pictures).getAllByRole('img')
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(['cup.png', 'leaves.png'])
    expect(images[0]).toHaveAttribute('src', 'adman-asset://P1/a1')
    const cup = images[0]!.closest('li') as HTMLElement
    expect(cup).toHaveAttribute('title', 'cup.png · 1200×800')
    expect(within(pictures).getByRole('combobox', { name: 'Subject of cup.png' })).toBeVisible()
    expect(within(pictures).queryByText('Subject')).toBeNull()
  })

  it('draws clips, fonts and other files as rows with their detail line', async () => {
    await openPanel()
    expect(within(region('Clips')).getByText('1200×800 · 0:04')).toBeInTheDocument()
    expect(within(region('Fonts')).getByText('Family: Kettle Sans')).toBeInTheDocument()
    expect(within(region('Other files')).getByText('notes.txt')).toBeInTheDocument()
  })

  it('draws marks as icons whose words are kept for screen readers and tooltips', async () => {
    await openPanel()
    const ai = within(region('Clips')).getByText('Made with AI')
    expect(ai.closest('[title]')).toHaveAttribute('title', 'Made with AI')
    const pictures = region('Pictures')
    for (const [file, words] of [
      ['cup.png', 'Reference only'],
      ['leaves.png', 'Made with AI'],
      ['shop.png', 'Linked'],
    ] as const) {
      const tile = within(pictures).getByText(file).closest('li') as HTMLElement
      expect(within(tile).getByTitle(words)).toHaveTextContent(words)
    }
  })

  it('keeps "File not found" as visible words on a missing picture and a missing clip', async () => {
    await openPanel()
    const shop = within(region('Pictures')).getByText('shop.png').closest('li') as HTMLElement
    expect(shop.querySelector('img')).toBeNull()
    expect(within(shop).getByTitle('File not found')).toBeVisible()
    expect(within(shop).getByText('File not found')).toBeVisible()
    const steam = within(region('Clips')).getByText('steam.mp4').closest('li') as HTMLElement
    expect(within(steam).getByText('File not found')).toBeVisible()
  })

  it('draws a subject’s photos small, so two or more fit a row', async () => {
    await openPanel()
    const photos = within(region('Subjects')).getByRole('list', { name: 'Photos of Tin of Tea' })
    expect(photos).toHaveClass(strip.small ?? 'missing')
  })

  it('keeps the empty lines, and the Subjects explanation in an InfoTip', async () => {
    await openPanel([], [])
    const subjects = region('Subjects')
    expect(within(subjects).getByText('No subjects yet.')).toBeVisible()
    const about = within(subjects).getByRole('button', { name: 'About Subjects' })
    await userEvent.click(about)
    expect(
      within(subjects).getByText(/^A subject is the product, service or person an ad is about/),
    ).toBeVisible()
    expect(within(region('Pictures')).getByText('No pictures yet.')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Other files' })).toBeNull()
  })

  it('draws no path, hash or type in the new markup, attributes included', async () => {
    const { panel } = await openPanel()
    const html = panel.outerHTML
    for (const planted of [PLANTED_ABS, PLANTED_REL, 'Secret Folder', 'hash-', 'image/png'])
      expect(html).not.toContain(planted)
  })

  it('has no accessibility violations', async () => {
    await openPanel()
    expect(await axeViolations()).toEqual([])
  })
})
