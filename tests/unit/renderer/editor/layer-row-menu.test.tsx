// ED-1a (spec/phases/design-wave-screens-a.md, choice C-3): the layer row on the shared ObjectRow.
// The eye and the lock always show; the More menu holds Duplicate, Bring forward, Send backward
// and Delete; the head's add buttons are icon buttons; the panel is compact. Arrow keys, F2 and
// drag work as before.
import { createEvent, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V } from './editor-fixture'
import { LAYERS, OFFER, openList } from './layer-list-harness'

const button = (name: string) => screen.getByRole('button', { name })
const selected = () => screen.getByRole('status', { name: 'Selected' })
const rowBox = (id: string) => document.querySelector(`[data-layer-id="${id}"]`) as HTMLElement
const mainButton = (id: string) =>
  document.querySelector(`[data-layer-row="${id}"]`) as HTMLButtonElement

async function openMenu(name: string) {
  await userEvent.click(button(`More actions for ${name}`))
  return screen.getByRole('menu', { name: `More actions for ${name}` })
}

const item = (menu: HTMLElement, name: string) => within(menu).getByRole('menuitem', { name })

describe('Layer row: the eye and the lock always show [ED-1a, AP-12]', () => {
  it('shows both on a row that is not selected or pointed at, with aria-pressed', async () => {
    await openList([BACKGROUND, HEADLINE, { ...LOGO, visible: false, locked: true }])
    expect(button('Hide Headline')).toHaveAttribute('aria-pressed', 'false')
    expect(button('Lock Headline')).toHaveAttribute('aria-pressed', 'false')
    expect(button('Show Logo')).toHaveAttribute('aria-pressed', 'true')
    expect(button('Unlock Logo')).toHaveAttribute('aria-pressed', 'true')
    expect(button('Hide Background')).toBeInTheDocument()
  })

  it('has no trash button on the row', async () => {
    await openList(LAYERS, 'L3')
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull()
  })
})

describe('Layer row: the More menu [ED-1a, C-3]', () => {
  it('holds Duplicate, Bring forward, Send backward, a separator, then Delete', async () => {
    await openList()
    const menu = await openMenu('Headline')
    const entries = [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')]
    expect(entries.map((e) => e.textContent || e.getAttribute('role'))).toEqual([
      'Duplicate',
      'Bring forward',
      'Send backward',
      'separator',
      'Delete',
    ])
  })

  it('Duplicate sends layer.create with "{name} copy" moved 20 px right and down', async () => {
    const { sent } = await openList()
    await userEvent.click(item(await openMenu('Headline'), 'Duplicate'))
    const { geometry, style, copy } = HEADLINE
    expect(sent('layer.create')).toEqual([
      {
        projectId: P,
        variantId: V,
        type: 'text',
        values: {
          name: 'Headline copy',
          copy,
          style,
          geometry: { ...geometry, x: geometry.x + 20, y: geometry.y + 20 },
          visible: true,
          locked: false,
        },
      },
    ])
  })

  it('Duplicate of a picture layer keeps its picture', async () => {
    const { sent } = await openList([BACKGROUND, { ...LOGO, source: { assetId: 'A1' } }])
    await userEvent.click(item(await openMenu('Logo'), 'Duplicate'))
    const [input] = sent('layer.create') as { values: Record<string, unknown> }[]
    expect(input?.values.source).toEqual({ assetId: 'A1' })
    expect(input?.values.copy).toBeUndefined()
  })

  it.each([
    ['Bring forward', ['L2', 'L1', 'L3']],
    ['Send backward', ['L2', 'L1', 'L3']],
  ])('%s sends one layer.reorder step', async (name, ids) => {
    const { sent } = await openList()
    const who = name === 'Bring forward' ? 'Headline' : 'Logo'
    await userEvent.click(item(await openMenu(who), name))
    expect(sent('layer.reorder')).toEqual([{ projectId: P, variantId: V, layerIds: ids }])
  })

  it('Delete sends layer.delete, as the Delete key does', async () => {
    const { sent } = await openList()
    await userEvent.click(item(await openMenu('Offer'), 'Delete'))
    expect(sent('layer.delete')).toEqual([{ projectId: P, layerId: 'L3' }])
  })

  it.each([
    [
      'a locked layer',
      [BACKGROUND, { ...HEADLINE, locked: true }, LOGO],
      'Headline',
      {
        'Bring forward': 'Unlock the layer first',
        'Send backward': 'Unlock the layer first',
        Delete: 'Unlock the layer first',
      },
    ],
    ['the top layer', LAYERS, 'Offer', { 'Bring forward': 'Already at the front' }],
    ['the bottom layer', LAYERS, 'Headline', { 'Send backward': 'Already at the back' }],
  ])(
    'disables items with a reason for %s, and they send nothing',
    async (_c, layers, name, off) => {
      const { fake } = await openList(layers)
      const menu = await openMenu(name)
      for (const label of ['Duplicate', 'Bring forward', 'Send backward', 'Delete']) {
        const reason = (off as Record<string, string>)[label]
        const entry = item(menu, label)
        if (reason) expect(entry).toHaveAttribute('aria-disabled', 'true')
        if (reason) expect(entry).toHaveAttribute('title', reason)
        else expect(entry).not.toHaveAttribute('aria-disabled')
      }
      for (const label of Object.keys(off)) await userEvent.click(item(menu, label))
      expect(fake.commands.filter((c) => c.name.startsWith('layer.'))).toEqual([])
    },
  )

  it('gives the background row no menu; its name ends "Stays at the bottom"', async () => {
    await openList()
    expect(screen.queryByRole('button', { name: 'More actions for Background' })).toBeNull()
    expect(mainButton('L0')).toHaveAccessibleName(/^Background\s*Stays at the bottom$/)
  })
})

describe('Layer list head and density [ED-1a]', () => {
  it.each(['Add text layer', 'Add picture layer'])('%s is an icon button', async (name) => {
    await openList()
    expect(button(name)).toHaveAttribute('title', name)
    expect(button(name)).toHaveTextContent('')
  })

  it('carries data-density="compact" on the panel root', async () => {
    await openList()
    const panel = screen.getByRole('region', { name: 'Layers' })
    expect(panel).toHaveAttribute('data-density', 'compact')
  })
})

describe('Layer row: keys and drag as before [ED-1a]', () => {
  it('arrow keys move between rows and select', async () => {
    await openList(LAYERS, 'L3')
    mainButton('L3').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toHaveTextContent('L2')
    expect(mainButton('L2')).toHaveFocus()
  })

  it('arrow keys inside the More menu move in the menu, not between rows', async () => {
    await openList(LAYERS, 'L3')
    await openMenu('Offer')
    await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toHaveTextContent('L3')
  })

  it('F2 and a double-click rename; focus returns to the row after', async () => {
    const { sent } = await openList()
    mainButton('L1').focus()
    await userEvent.keyboard('{F2}')
    await userEvent.type(screen.getByRole('textbox', { name: 'Layer name' }), ' A{Enter}')
    expect(mainButton('L1')).toHaveFocus()
    await userEvent.dblClick(mainButton('L2'))
    await userEvent.type(screen.getByRole('textbox', { name: 'Layer name' }), ' B{Enter}')
    expect(sent('layer.update').map((u) => (u as { patch: unknown }).patch)).toEqual([
      { name: 'Headline A' },
      { name: 'Logo B' },
    ])
  })

  it('a double-click on the eye does not rename', async () => {
    await openList()
    await userEvent.dblClick(button('Hide Headline'))
    expect(screen.queryByRole('textbox', { name: 'Layer name' })).toBeNull()
  })

  it('drag onto a row sends one layer.reorder and draws the drop line on the box', async () => {
    const { sent } = await openList()
    expect(rowBox('L0')).toHaveAttribute('draggable', 'false')
    fireEvent.dragStart(rowBox('L1'))
    const over = createEvent.dragOver(rowBox('L3'))
    Object.defineProperty(over, 'clientY', { value: -1 })
    fireEvent(rowBox('L3'), over)
    expect(rowBox('L3')).toHaveAttribute('data-drop', 'above')
    const drop = createEvent.drop(rowBox('L3'))
    Object.defineProperty(drop, 'clientY', { value: -1 })
    fireEvent(rowBox('L3'), drop)
    expect(sent('layer.reorder')).toEqual([
      { projectId: P, variantId: V, layerIds: ['L2', 'L3', 'L1'] },
    ])
  })
})

describe('Layer row: accessibility [ED-1a]', () => {
  it('has no violations with marks, a hidden and a locked layer, and the menu open', async () => {
    await openList(
      [
        BACKGROUND,
        { ...HEADLINE, visible: false, overflow: true },
        { ...LOGO, locked: true },
        OFFER,
      ],
      'L3',
    )
    expect(await axeViolations()).toEqual([])
    await openMenu('Offer')
    expect(await axeViolations()).toEqual([])
  })
})
