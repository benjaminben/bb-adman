// spec/editor.md, "The editor screen" (P3-9): loads the variant, selects by click and by the
// layer list, undo and redo on the variant's list, rename, the banner, the overflow report.
import '../../shared/scene/fake-fonts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { HEADLINE, LOGO, P, V, assetRow, variantGet } from './editor-fixture'

const SCOPE = { projectId: P, scope: `variant:${V}` }

async function open(reply: VariantGet = variantGet(), history = { canUndo: true, canRedo: false }) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: history }))
  const view = await renderApp(<Editor projectId={P} variantId={V} />, fake)
  const canvas = await screen.findByRole('region', { name: 'Canvas, Master post' })
  return { ...view, fake, canvas }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)
const asked = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.queries.filter((q) => q.name === name).map((q) => q.input)

const panelHeading = () =>
  within(screen.getByRole('region', { name: 'Properties' })).queryByRole('heading', { level: 3 })

// The canvas draws at the smallest zoom in jsdom (no layout), so a variant point is a quarter.
function clickCanvasAt(canvas: HTMLElement, x: number, y: number) {
  const stage = canvas.querySelector('[data-stage]') as HTMLElement
  fireEvent.click(stage, { clientX: x / 4, clientY: y / 4 })
}

describe('Editor [spec/editor.md "The editor screen"]', () => {
  it('loads the variant: top bar, size line, Master mark, layers and the empty properties panel', async () => {
    const { fake } = await open()
    expect(asked(fake, 'variant.get')).toEqual([{ projectId: P, variantId: V }])
    expect(screen.getByRole('heading', { name: 'Master post' })).toBeInTheDocument()
    expect(screen.getByText('Master')).toBeInTheDocument()
    expect(screen.getByText('1080 × 1350')).toHaveAttribute('title', '4:5 · en')
    const rows = [...document.querySelectorAll('[data-layer-row]')]
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAccessibleName(/^Logo\s*Empty$/)
    expect(rows[1]).toHaveAccessibleName('Headline')
    expect(rows[2]).toHaveAccessibleName(/^Background\s*Stays at the bottom$/)
    expect(screen.getByText('Select a layer')).toBeInTheDocument()
  })

  it('selects by click on the canvas: topmost layer, else the background; the backdrop clears', async () => {
    const { canvas } = await open()
    clickCanvasAt(canvas, 500, 200)
    expect(panelHeading()).toHaveTextContent('Headline')
    clickCanvasAt(canvas, 900, 1200)
    expect(panelHeading()).toHaveTextContent('Logo')
    clickCanvasAt(canvas, 40, 600)
    expect(panelHeading()).toHaveTextContent('Background')
    fireEvent.click(canvas.querySelector('[data-backdrop]') as HTMLElement)
    expect(panelHeading()).toBeNull()
  })

  it('does not pick a locked or hidden layer by click, but the list selects it', async () => {
    const hidden = { ...HEADLINE, visible: false }
    const locked = { ...LOGO, locked: true }
    const { canvas } = await open(variantGet({ layers: [variantGet().layers[0]!, hidden, locked] }))
    clickCanvasAt(canvas, 500, 200)
    expect(panelHeading()).toHaveTextContent('Background')
    await userEvent.click(screen.getByRole('button', { name: /^Logo/ }))
    expect(panelHeading()).toHaveTextContent('Logo')
    expect(screen.getByRole('button', { name: /^Logo/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves the selection with Up and Down in the layer list, and Escape clears it', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: /^Logo/ }))
    await userEvent.keyboard('{ArrowDown}')
    expect(panelHeading()).toHaveTextContent('Headline')
    expect(screen.getByRole('button', { name: /^Headline/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(panelHeading()).toHaveTextContent('Background')
    await userEvent.keyboard('{ArrowUp}')
    expect(panelHeading()).toHaveTextContent('Headline')
    await userEvent.keyboard('{Escape}')
    expect(panelHeading()).toBeNull()
  })

  it('sends history.undo and history.redo with the variant scope, by button and by key', async () => {
    const { fake, canvas } = await open(variantGet(), { canUndo: true, canRedo: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    canvas.focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['history.undo', SCOPE],
      ['history.redo', SCOPE],
      ['history.undo', SCOPE],
      ['history.redo', SCOPE],
    ])
  })

  it('disables Undo and Redo from history.state, and reads it again after an undo and a change', async () => {
    const { fake } = await open(variantGet(), { canUndo: true, canRedo: false })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(asked(fake, 'history.state')).toEqual([SCOPE])
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(asked(fake, 'history.state')).toHaveLength(2))
    fake.emit('project.changed', {
      projectId: P,
      changed: { layer: [{ ...HEADLINE, name: 'Title' }] },
      removed: {},
      actor: 'agent',
    })
    await waitFor(() => expect(asked(fake, 'history.state')).toHaveLength(3))
  })

  it('renames the variant: Enter saves with variant.update, Escape cancels', async () => {
    const { fake } = await open()
    await userEvent.click(screen.getByRole('button', { name: /^Rename / }))
    await userEvent.keyboard('{Escape}')
    expect(sent(fake, 'variant.update')).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /^Rename / }))
    const field = screen.getByRole('textbox', { name: 'Variant title' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Summer post{Enter}')
    expect(sent(fake, 'variant.update')).toEqual([
      { projectId: P, variantId: V, title: 'Summer post' },
    ])
    expect(screen.queryByRole('textbox', { name: 'Variant title' })).toBeNull()
  })

  it.each([
    [
      'a missing file comes first',
      { assets: [assetRow('A1', { missing: true })], overflow: true },
      'A file this variant uses cannot be found. Relink it from the project page.',
    ],
    [
      'one text layer that does not fit',
      { assets: [assetRow('A1')], overflow: true },
      '1 text does not fit',
    ],
  ])('banner: %s', async (_case, given, words) => {
    const layers = [variantGet().layers[0]!, { ...HEADLINE, overflow: given.overflow }, LOGO]
    await open(variantGet({ assets: given.assets, layers }))
    expect(screen.getByRole('status')).toHaveTextContent(words)
  })

  it('says how many text layers do not fit when there are several', async () => {
    const second = { ...HEADLINE, id: 'L3', name: 'Offer', z: 3, overflow: true }
    await open(variantGet({ layers: [{ ...HEADLINE, overflow: true }, second] }))
    expect(screen.getByRole('status')).toHaveTextContent(/^2 texts do not fit$/)
  })

  it('shows no banner when nothing is wrong', async () => {
    await open()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('reports a changed overflow once, with the store variant rev', async () => {
    const layers = [{ ...HEADLINE, overflow: true }, LOGO]
    const { fake } = await open(variantGet({ layers }))
    const report = { projectId: P, layerId: 'L1', overflow: false, variantRev: 7 }
    await waitFor(() => expect(sent(fake, 'layer.reportOverflow')).toEqual([report]))
    fake.emit('project.changed', {
      projectId: P,
      changed: { layer: [{ ...LOGO, name: 'Brand mark' }] },
      removed: {},
      actor: 'user',
    })
    await screen.findByRole('button', { name: /^Brand mark/ })
    await new Promise((done) => setTimeout(done, 50))
    expect(sent(fake, 'layer.reportOverflow')).toEqual([report])
  })

  it('has no accessibility violations, with a layer selected', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: /^Headline/ }))
    expect(await axeViolations()).toEqual([])
  })
})
