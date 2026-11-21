// spec/editor.md, "Layer list" (P3-12) [FR-090, FR-092]: add text and add picture, hide and
// show, lock and unlock, rename, drag to reorder, Mod+] and Mod+[, delete, and axe.
import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, layer } from './editor-fixture'
import { LAYERS, OFFER, openList } from './layer-list-harness'

const button = (name: string) => screen.getByRole('button', { name })
const selected = () => screen.getByRole('status', { name: 'Selected' })
// A row's select button, by its layer's name (its marks follow the name).
const rowButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
// The row's draggable box, around its select button.
const rowBox = (name: string) => rowButton(name).parentElement as HTMLElement
const NAMES: Record<string, string> = { L0: 'Background', L1: 'Headline', L2: 'Logo', L3: 'Offer' }

// jsdom has no DragEvent, so the pointer's height is set on the event by hand.
function dragAt(kind: 'dragOver' | 'drop', name: string, clientY: number) {
  const event = createEvent[kind](rowBox(name))
  Object.defineProperty(event, 'clientY', { value: clientY })
  fireEvent(rowBox(name), event)
}

describe('Layer list: add buttons [spec/editor.md "Layer list"]', () => {
  it.each([
    ['Add text layer', 'text', true],
    ['Add picture layer', 'image', false],
  ] as const)('%s sends layer.create, selects the new layer', async (name, type, copyFocused) => {
    const { fake, sent } = await openList()
    const made = layer({ id: 'L9', variantId: V, type, name: 'New', z: 4 })
    fake.onCommand('layer.create', () => {
      fake.emit('project.changed', {
        projectId: P,
        changed: { layer: [made] },
        removed: {},
        actor: 'user',
      })
      return { ok: true, data: { layerId: 'L9' } }
    })
    await userEvent.click(button(name))
    expect(sent('layer.create')).toEqual([{ projectId: P, variantId: V, type }])
    await waitFor(() => expect(selected()).toHaveTextContent('L9'))
    const copy = screen.queryByRole('textbox', { name: 'Copy' })
    if (copyFocused) await waitFor(() => expect(copy).toHaveFocus())
    else expect(copy).toBeNull()
  })

  it('selects nothing new when layer.create is refused', async () => {
    const { fake } = await openList(LAYERS, 'L1')
    fake.onCommand('layer.create', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That variant was not found.' },
    }))
    await userEvent.click(button('Add text layer'))
    expect(selected()).toHaveTextContent('L1')
  })
})

describe('Layer list: hide, show, lock, unlock', () => {
  it.each([
    [{}, 'Hide Headline', false, { visible: false }],
    [{ visible: false }, 'Show Headline', true, { visible: true }],
    [{}, 'Lock Headline', false, { locked: true }],
    [{ locked: true }, 'Unlock Headline', true, { locked: false }],
  ])('%o: %s (pressed %s) sends layer.update %o', async (state, name, pressed, patch) => {
    const { sent } = await openList([BACKGROUND, { ...HEADLINE, ...state }], 'L1')
    expect(button(name)).toHaveAttribute('aria-pressed', String(pressed))
    await userEvent.click(button(name))
    expect(sent('layer.update')).toEqual([{ projectId: P, layerId: 'L1', patch }])
  })

  it('shows a row actions while it is selected; otherwise only a hidden or locked state', async () => {
    await openList([BACKGROUND, { ...HEADLINE, visible: false }, { ...LOGO, locked: true }, OFFER])
    const list = within(screen.getByRole('list', { name: 'Layers' }))
    const names = () => list.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names()).toEqual([null, null, 'Unlock Logo', null, 'Show Headline', null])
    await userEvent.click(button('Offer'))
    expect(names()).toContain('Hide Offer')
    expect(names()).toContain('Lock Offer')
    expect(names()).toContain('Delete Offer')
  })
})

describe('Layer list: rename', () => {
  const start = {
    'double-click on the name': () => userEvent.dblClick(screen.getByText('Headline')),
    'F2 on the focused row': async () => {
      button('Headline').focus()
      await userEvent.keyboard('{F2}')
    },
  }
  it.each(Object.keys(start))('opens by %s; Enter saves the name', async (how) => {
    const { sent } = await openList()
    await start[how as keyof typeof start]()
    const field = screen.getByRole('textbox', { name: 'Layer name' })
    expect(field).toHaveValue('Headline')
    expect(field).toHaveFocus()
    await userEvent.clear(field)
    await userEvent.type(field, 'Summer headline{Enter}')
    expect(sent('layer.update')).toEqual([
      { projectId: P, layerId: 'L1', patch: { name: 'Summer headline' } },
    ])
    expect(screen.queryByRole('textbox', { name: 'Layer name' })).toBeNull()
  })

  it.each([
    ['Escape', '{Escape}'],
    ['an unchanged name', '{Enter}'],
    ['an empty name', '{Control>}a{/Control}{Backspace}{Enter}'],
  ])('sends nothing on %s', async (_case, keys) => {
    const { sent } = await openList(LAYERS, 'L1')
    await userEvent.dblClick(screen.getByText('Headline'))
    await userEvent.keyboard(keys)
    expect(sent('layer.update')).toEqual([])
    expect(screen.queryByRole('textbox', { name: 'Layer name' })).toBeNull()
    expect(selected()).toHaveTextContent('L1')
  })
})

describe('Layer list: reorder', () => {
  // Rows top first: Offer (L3), Logo (L2), Headline (L1), Background. jsdom has no layout, so
  // every row's middle is at 0: a pointer at -1 is over its upper half, at 1 its lower half.
  it.each([
    ['Headline', 'Offer', -1, ['L2', 'L3', 'L1']],
    ['Offer', 'Headline', 1, ['L3', 'L1', 'L2']],
    ['Offer', 'Background', -1, ['L3', 'L1', 'L2']],
    ['Logo', 'Headline', -1, ['L1', 'L2', 'L3']],
  ])('drag %s onto %s (at %d) sends one layer.reorder', async (from, to, y, ids) => {
    const { sent } = await openList()
    fireEvent.dragStart(rowBox(from))
    dragAt('dragOver', to, y)
    dragAt('drop', to, y)
    const same = ids.join() === 'L1,L2,L3'
    expect(sent('layer.reorder')).toEqual(
      same ? [] : [{ projectId: P, variantId: V, layerIds: ids }],
    )
  })

  it('shows a line where the row will land while dragging, and none after', async () => {
    await openList()
    fireEvent.dragStart(rowBox('Headline'))
    dragAt('dragOver', 'Offer', -1)
    expect(rowBox('Offer')).toHaveAttribute('data-drop', 'above')
    fireEvent.dragEnd(rowBox('Headline'))
    expect(rowBox('Offer')).not.toHaveAttribute('data-drop')
  })

  it.each([
    ['L1', '{Control>}[BracketRight]{/Control}', ['L2', 'L1', 'L3']],
    ['L2', '{Control>}[BracketLeft]{/Control}', ['L2', 'L1', 'L3']],
    ['L3', '{Control>}[BracketRight]{/Control}', null],
    ['L1', '{Control>}[BracketLeft]{/Control}', null],
    ['L0', '{Control>}[BracketRight]{/Control}', null],
  ])('with %s selected, %s sends %o', async (id, keys, ids) => {
    const { sent } = await openList(LAYERS, id)
    rowButton(NAMES[id]!).focus()
    await userEvent.keyboard(keys)
    expect(sent('layer.reorder')).toEqual(
      ids ? [{ projectId: P, variantId: V, layerIds: ids }] : [],
    )
  })

  it('does not let the background be dragged', async () => {
    await openList()
    expect(rowBox('Background')).toHaveAttribute('draggable', 'false')
    expect(rowBox('Headline')).toHaveAttribute('draggable', 'true')
  })
})

describe('Layer list: delete', () => {
  it('Delete Offer, and the Delete and Backspace keys, send layer.delete', async () => {
    const { sent } = await openList(LAYERS, 'L3')
    await userEvent.click(button('Delete Offer'))
    rowButton('Offer').focus()
    await userEvent.keyboard('{Delete}{Backspace}')
    expect(sent('layer.delete')).toEqual(Array(3).fill({ projectId: P, layerId: 'L3' }))
  })

  it.each([
    ['the background', LAYERS, 'L0'],
    ['a locked layer', [BACKGROUND, { ...HEADLINE, locked: true }], 'L1'],
  ])('offers no delete for %s, by button or key', async (_case, layers, id) => {
    const { sent } = await openList(layers, id)
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull()
    rowButton(NAMES[id]!).focus()
    await userEvent.keyboard('{Delete}')
    expect(sent('layer.delete')).toEqual([])
  })
})

describe('Layer list: accessibility', () => {
  it('has no violations with a hidden, a locked and a selected layer, and while renaming', async () => {
    await openList(
      [BACKGROUND, { ...HEADLINE, visible: false }, { ...LOGO, locked: true }, OFFER],
      'L3',
    )
    expect(await axeViolations()).toEqual([])
    await act(() => userEvent.dblClick(screen.getByText('Offer')))
    expect(screen.getByRole('textbox', { name: 'Layer name' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })
})
