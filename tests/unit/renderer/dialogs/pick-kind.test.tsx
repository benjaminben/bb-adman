// Design wave DLG-5 (spec/phases/design-wave-screens-b.md, "DLG-5 — Pick dialogs"; C-16): the
// layout dialog, the reference dialog and the picture chooser are the `pick` kind, with their
// pictures in a `.pickGrid` and no visible captions; each tile is named and titled by what its
// caption said. Reference ticks keep their order and are what "Done" hands back.
import '../../shared/scene/fake-fonts'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LayoutDialog } from '@/renderer/dialogs/layout-dialog'
import layoutStyles from '@/renderer/dialogs/layout-dialog/layout-dialog.module.css'
import { PictureChooser } from '@/renderer/dialogs/picture-chooser'
import chooserStyles from '@/renderer/dialogs/picture-chooser/picture-chooser.module.css'
import { ReferenceDialog } from '@/renderer/dialogs/reference-dialog'
import refStyles from '@/renderer/ui/reference-picker/reference-picker.module.css'
import { dialogStyles } from '@/renderer/ui/dialog-frame'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { layer } from '../../shared/scene/fixtures'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, variant } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { asset } from './relink-fixture'

// The words a user reads in `el`: text outside elements of the `hidden` class and outside the
// drawn pictures (aria-hidden).
function shownText(el: HTMLElement, hidden: string | undefined): string {
  const copy = el.cloneNode(true) as HTMLElement
  copy.querySelectorAll(`.${hidden ?? 'none'}, [aria-hidden='true']`).forEach((n) => n.remove())
  return (copy.textContent ?? '').trim()
}

async function openReferences(opts: { chosen?: string[]; refs?: AssetList } = {}) {
  const fake = makeFakeApi()
  const made = [ref('G1', { library: 'asset', origin: 'generated' })]
  const refs = opts.refs ?? [ref('R1'), ref('R2')]
  fake.onQuery('asset.list', (input) => ({
    ok: true,
    data: (input as { library?: string }).library === 'asset' ? made : refs,
  }))
  const onDone = vi.fn()
  const onCancel = vi.fn()
  await renderApp(
    <ReferenceDialog
      open
      projectId={P}
      layerName="Logo"
      subjectId={undefined}
      chosen={opts.chosen ?? []}
      onDone={onDone}
      onCancel={onCancel}
    />,
    fake,
  )
  const dialog = await screen.findByRole('dialog', { name: 'Reference pictures for Logo' })
  await within(dialog).findByRole('checkbox', { name: 'G1.png' })
  await within(dialog).findByRole('checkbox', { name: 'R1.png' })
  return { dialog, onDone, onCancel }
}

const VARIANT = variant('V1', { width: 1080, height: 1920, sizeLabel: '9:16' })
const LAYERS: LayerRow[] = [
  layer({ id: 'background', type: 'background', z: 0 }),
  layer({ id: 'subject-image', type: 'image', z: 1 }),
  layer({ id: 'headline', type: 'text', z: 2, copy: 'Cool down this summer' }),
]

async function openLayout(layers = LAYERS) {
  const fake = makeFakeApi()
  const onClose = vi.fn()
  await renderApp(
    <LayoutDialog
      open
      projectId={P}
      variant={VARIANT}
      layers={layers}
      assets={{}}
      onClose={onClose}
    />,
    fake,
  )
  const dialog = await screen.findByRole('dialog', { name: 'Choose a layout' })
  return { fake, dialog, onClose }
}

const sentLayouts = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.updateMany')

describe('Layout dialog on the pick kind [DLG-5]', () => {
  it('is wide, holds five previews in a pickGrid, and the tiles have no visible caption', async () => {
    const { dialog } = await openLayout()
    expect(dialog).toHaveClass(dialogStyles.wide as string)
    const grid = within(dialog).getByRole('radiogroup', { name: 'Layouts' })
    expect(grid).toHaveClass(dialogStyles.pickGrid as string)
    const tiles = Array.from(grid.children) as HTMLElement[]
    expect(tiles).toHaveLength(5)
    expect(grid.querySelectorAll('[data-layout-preview]')).toHaveLength(5)
    STARTER_LAYOUTS.forEach((layout, i) => {
      const tile = tiles[i] as HTMLElement
      expect(tile).toHaveAttribute('title', `${layout.name}. ${layout.description}`)
      expect(shownText(tile, layoutStyles.hidden)).toBe('')
      const radio = within(tile).getByRole('radio')
      expect(radio).toHaveAccessibleName(layout.name)
      expect(radio).toHaveAccessibleDescription(layout.description)
    })
    expect(await axeViolations()).toEqual([])
  })

  it('puts the locked-layers line in an InfoTip about Layout', async () => {
    const { dialog } = await openLayout()
    const tip = within(dialog).getByRole('button', { name: 'About Layout' })
    await userEvent.click(tip)
    expect(within(dialog).getByText('Locked layers stay as they are.')).toBeVisible()
    expect(within(dialog).queryByTitle('Locked layers stay as they are')).toBeNull()
  })

  it('shows a "{n} kept" lock mark when layers are locked', async () => {
    const locked = LAYERS.map((l, i) => (i < 2 ? { ...l, locked: true } : l))
    const { dialog } = await openLayout(locked)
    const mark = within(dialog).getByTitle('Locked layers stay as they are')
    expect(mark).toHaveTextContent(/^2 kept/)
  })

  it('sends nothing when a preview is picked, and one command on Apply', async () => {
    const { fake, dialog, onClose } = await openLayout()
    await userEvent.click(within(dialog).getByRole('radio', { name: STARTER_LAYOUTS[2]!.name }))
    await userEvent.click(within(dialog).getByRole('radio', { name: STARTER_LAYOUTS[1]!.name }))
    expect(sentLayouts(fake)).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(sentLayouts(fake)).toHaveLength(1)
  })
})

describe('Reference dialog on the pick kind [DLG-5]', () => {
  it('is wide, with grids "Library" and "Made here" that keep their old names', async () => {
    const { dialog } = await openReferences()
    expect(dialog).toHaveClass(dialogStyles.wide as string)
    for (const [old, shown] of [
      ['Reference pictures', 'Library'],
      ['Made in this project', 'Made here'],
    ] as const) {
      const region = within(dialog).getByRole('region', { name: old })
      expect(within(region).getByRole('heading', { name: shown })).toBeVisible()
      expect(region.querySelector('ul')).toHaveClass(dialogStyles.pickGrid as string)
    }
    expect(await axeViolations()).toEqual([])
  })

  it('names and titles each tile by its display name or "Photo of {subject}", never a path', async () => {
    const photo = ref('S1', { library: 'asset', subjectId: 'citrus-can' })
    const { dialog } = await openReferences({ refs: [ref('R1'), photo] })
    const tick = within(dialog).getByRole('checkbox', { name: 'R1.png' })
    const tile = tick.closest('li') as HTMLElement
    expect(tile.querySelector('label')).toHaveAttribute('title', 'R1.png')
    expect(shownText(tile, refStyles.hidden)).toBe('')
    const photoTile = within(dialog).getByRole('checkbox', { name: 'S1.png' }).closest('li')
    expect(photoTile?.querySelector('label')).toHaveAttribute(
      'title',
      'S1.png · Photo of citrus-can',
    )
    expect(dialog.querySelector('img')).toHaveAttribute('src', `adman-asset://${P}/R1`)
    expect(dialog.outerHTML).not.toContain('/Users/me')
  })

  it('ends the Library grid with a dashed "+" tile named "Add pictures"', async () => {
    const { dialog } = await openReferences()
    const grid = within(dialog).getByRole('region', { name: 'Reference pictures' })
    const last = grid.querySelector('ul > li:last-child') as HTMLElement
    expect(within(last).getByRole('button', { name: 'Add pictures' })).toBeVisible()
  })

  it('shows "{k} / 8" and the order numbers as ticks change', async () => {
    const { dialog } = await openReferences({ chosen: ['R2'] })
    expect(within(dialog).getByText('1 / 8')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'G1.png' }))
    expect(within(dialog).getByText('2 / 8')).toBeVisible()
    const g1 = within(dialog).getByRole('checkbox', { name: 'G1.png' }).closest('li')
    const r2 = within(dialog).getByRole('checkbox', { name: 'R2.png' }).closest('li')
    expect(shownText(g1 as HTMLElement, refStyles.hidden)).toBe('2')
    expect(shownText(r2 as HTMLElement, refStyles.hidden)).toBe('1')
  })

  it('at eight, disables the unticked tiles with the reason; no limit sentence', async () => {
    const refs = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'].map((id) => ref(id))
    const chosen = refs.slice(0, 8).map((r) => r.id)
    const { dialog } = await openReferences({ refs, chosen })
    expect(within(dialog).getByText('8 / 8')).toBeVisible()
    const ninth = within(dialog).getByRole('checkbox', { name: 'R9.png' })
    expect(ninth).toBeDisabled()
    expect(ninth).toHaveAccessibleDescription('At most 8 pictures')
    expect(ninth.closest('label')).toHaveAttribute('title', 'R9.png · At most 8 pictures')
    expect(within(dialog).queryByText('At most 8 pictures.')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('Done hands back exactly the ticked tiles in their numbered order', async () => {
    const { dialog, onDone } = await openReferences({ chosen: ['R2'] })
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'G1.png' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'R1.png' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'R2.png' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'R2.png' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(onDone.mock.calls).toEqual([[['G1', 'R1', 'R2']]])
  })

  it.each([
    ['Cancel', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('%s hands back nothing', async (_c, act) => {
    const { dialog, onDone, onCancel } = await openReferences({ chosen: ['R1'] })
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'G1.png' }))
    await act()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })
})

async function openChooser(rows = [asset('a1', 'summer-hero.jpg', { missing: false })]) {
  const fake = makeFakeApi()
  const photo = asset('r1', 'can-shot.png', {
    library: 'reference',
    subjectId: 'citrus-can',
    missing: false,
  })
  fake.onQuery('asset.list', (input) => ({
    ok: true,
    data: (input as { library: string }).library === 'reference' ? [photo] : rows,
  }))
  const onChoose = vi.fn(async (): Promise<string | null> => null)
  await renderApp(
    <PictureChooser projectId={P} layerName="Hero" open onChoose={onChoose} onClose={vi.fn()} />,
    fake,
  )
  const dialog = screen.getByRole('dialog', { name: 'Choose a picture for Hero' })
  await within(dialog).findByRole('list', { name: 'Subject photos in the reference library' })
  return { fake, dialog }
}

describe('Picture chooser on the pick kind [DLG-5]', () => {
  it('is wide, its grids are pickGrids, and tiles are titled with no visible caption', async () => {
    const { dialog } = await openChooser([
      asset('a1', 'summer-hero.jpg', { missing: false }),
      asset('a2', 'old-logo.png'),
    ])
    expect(dialog).toHaveClass(dialogStyles.wide as string)
    const grid = within(dialog).getByRole('list', { name: 'Pictures' })
    expect(grid).toHaveClass(dialogStyles.pickGrid as string)
    const hero = within(grid).getByRole('button', { name: 'summer-hero.jpg' })
    expect(hero).toHaveAttribute('title', 'summer-hero.jpg')
    expect(shownText(hero, chooserStyles.hidden)).toBe('')
    const missing = within(grid).getByRole('button', { name: 'old-logo.png file not found' })
    expect(shownText(missing, chooserStyles.hidden)).toBe('file not found')
    const second = within(dialog).getByRole('list', {
      name: 'Subject photos in the reference library',
    })
    expect(second).toHaveClass(dialogStyles.pickGrid as string)
    const photo = within(second).getByRole('button', { name: 'can-shot.png Photo of citrus-can' })
    expect(photo).toHaveAttribute('title', 'can-shot.png · Photo of citrus-can')
    expect(shownText(photo, chooserStyles.hidden)).toBe('')
    expect(dialog.outerHTML).not.toContain('/Users/me')
    expect(await axeViolations()).toEqual([])
  })

  it('keeps the subject photos hint in an InfoTip', async () => {
    const { dialog } = await openChooser()
    const hint =
      'Choosing one moves it to the asset library, so it can go on a post. It still guides AI pictures.'
    expect(within(dialog).getByText(hint)).not.toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: /^About / }))
    expect(within(dialog).getByText(hint)).toBeVisible()
  })

  it('with no pictures shows "No pictures yet" and "Import pictures…" that imports', async () => {
    const { fake, dialog } = await openChooser([])
    expect(within(dialog).getByText('No pictures yet')).toBeVisible()
    const buttons = within(dialog).getAllByRole('button', { name: 'Import pictures…' })
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[0] as HTMLElement)
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true))
    expect(await axeViolations()).toEqual([])
  })
})
