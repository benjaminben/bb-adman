// ED-2 (spec/phases/design-wave-screens-a.md, "Text layer"): the text layer's properties. Copy
// first with "Suggest copy…" as an icon in its corner and the translation as a mark; "Type"
// open with its summary; "Box" folded with its summary. Every change still sends one
// layer.update with that field only. The "does not fit" line and refusals stay on the page.
import '../../shared/scene/fake-fonts'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import layout from '@/renderer/ui/layout.module.css'
import { writeFold } from '@/renderer/ui/section/fold-memory'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

const SWATCH = '#F4E9D8'
const TEXT: LayerRow = {
  ...HEADLINE,
  style: {
    ...HEADLINE.style,
    fontSize: 81,
    fontWeight: 700,
    letterSpacing: 0,
  } as LayerRow['style'],
}
const TAGLINE: LayerRow = { ...TEXT, id: 'L3', name: 'Tagline', slot: 'tag' }
const BOXED: LayerRow = {
  ...TEXT,
  style: {
    ...(TEXT.style as object),
    boxColor: '#FFFFFF',
    boxOutlineColor: '#1B1D22',
    boxOutlineWidth: 4,
  } as LayerRow['style'],
}

async function open(layer: LayerRow, fake = makeFakeApi()) {
  const data = { ruleSet: { palette: [SWATCH] } }
  fake.onQuery('campaign.get', () => ({ ok: true, data }))
  fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
  const { store } = await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={[BACKGROUND, layer, LOGO]}
      />
    </main>,
    fake,
  )
  act(() => store.getState().show({ kind: 'project', projectId: P }))
  await screen.findAllByRole('button', { name: SWATCH })
  return fake
}

const region = (name: string) => screen.getByRole('region', { name })
const fold = (name: string) => screen.getByRole('button', { name })
const updates = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
const patchOf = (patch: unknown) => ({ projectId: P, layerId: 'L1', patch })

// Each case starts as a new window would (C-8).
beforeEach(() => {
  writeFold('props.type', true)
  writeFold('props.box', false)
})

describe('the text layer panel [ED-2]', () => {
  it('Type opens with its summary; Box starts folded with "None"', async () => {
    await open(TEXT)
    expect(fold('Type')).toHaveAttribute('aria-expanded', 'true')
    expect(within(region('Type')).getByText('Inter · Bold · 81')).toBeVisible()
    expect(fold('Box')).toHaveAttribute('aria-expanded', 'false')
    expect(within(region('Box')).getByText('None')).toBeVisible()
    expect(screen.queryByText('Text settings')).toBeNull()
  })

  it('a box with a fill and an outline reads "Fill · Outline"', async () => {
    await open(BOXED)
    expect(within(region('Box')).getByText('Fill · Outline')).toBeVisible()
  })

  it('Copy comes first, before Type', async () => {
    await open(TEXT)
    const copy = screen.getByRole('textbox', { name: 'Copy' })
    expect(
      copy.compareDocumentPosition(fold('Type')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it.each([
    ['Align', 'Left', { align: 'left' }],
    ['Align', 'Right', { align: 'right' }],
    ['Vertical align', 'Bottom', { verticalAlign: 'bottom' }],
    ['Vertical align', 'Middle', { verticalAlign: 'middle' }],
  ])('%s "%s" is an icon button in Type and sends %o', async (group, name, style) => {
    const fake = await open(TEXT)
    const button = within(within(region('Type')).getByRole('group', { name: group })).getByRole(
      'button',
      { name },
    )
    expect(button).toHaveClass(layout.iconButton as string)
    expect(button).toHaveAttribute('title', name)
    await userEvent.click(button)
    expect(updates(fake)).toEqual([patchOf({ style })])
  })

  it('"All capitals" is a pressed-state button in Type that sends allCaps', async () => {
    const fake = await open(TEXT)
    const caps = within(region('Type')).getByRole('button', { name: 'All capitals' })
    expect(caps).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(caps)
    expect(updates(fake)).toEqual([patchOf({ style: { allCaps: true } })])
  })

  it('a colour swatch sends style.color once', async () => {
    const fake = await open(TEXT)
    const colour = within(region('Type')).getByRole('group', { name: 'Colour' })
    await userEvent.click(within(colour).getByRole('button', { name: SWATCH }))
    expect(updates(fake)).toEqual([patchOf({ style: { color: SWATCH } })])
  })

  it('a colour that is not in the palette still shows, as the pressed swatch', async () => {
    await open(TEXT)
    const colour = within(region('Type')).getByRole('group', { name: 'Colour' })
    const own = (TEXT.style as { color: string }).color
    expect(within(colour).getByRole('button', { name: own })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('Weight lists names only', async () => {
    await open(TEXT)
    const weight = screen.getByRole('combobox', { name: 'Weight' })
    expect(within(weight).getByRole('option', { name: 'Bold' })).toBeInTheDocument()
    expect(within(weight).queryByRole('option', { name: 'Bold 700' })).toBeNull()
  })

  it('Outline "Width" has "px" inside and the name "Outline width"', async () => {
    await open(TEXT)
    await userEvent.click(fold('Box'))
    const width = within(region('Box')).getByRole('spinbutton', { name: 'Outline width' })
    expect(width.parentElement).toHaveClass(layout.unitBox as string)
    expect(width.parentElement).toHaveTextContent('px')
    expect(within(region('Box')).getByText('Width')).toBeVisible()
  })

  it('"None" in Box colour is the swatch "No colour" and sends null', async () => {
    const fake = await open(BOXED)
    await userEvent.click(fold('Box'))
    const box = within(region('Box')).getByRole('group', { name: 'Box colour' })
    await userEvent.click(within(box).getByRole('button', { name: 'No colour' }))
    expect(updates(fake)).toEqual([patchOf({ style: { boxColor: null } })])
  })

  it.each([
    ['Size', '64', { style: { fontSize: 64 } }],
    ['Line height', '1.5', { style: { lineHeight: 1.5 } }],
    ['Letter spacing', '0.1', { style: { letterSpacing: 0.1 } }],
    ['Outline width', '6', { style: { boxOutlineWidth: 6 } }],
    ['Corner radius', '12', { style: { boxRadius: 12 } }],
    ['Padding', '20', { style: { boxPadding: 20 } }],
  ])('%s still sends its one field', async (name, typed, patch) => {
    const fake = await open(TEXT)
    if (fold('Box').getAttribute('aria-expanded') === 'false') await userEvent.click(fold('Box'))
    const field = screen.getByRole('spinbutton', { name })
    await userEvent.clear(field)
    await userEvent.type(field, `${typed}{Enter}`)
    expect(updates(fake)).toEqual([patchOf(patch)])
  })

  it('the font select and weight still send their one field', async () => {
    const fake = await open(TEXT)
    const font = screen.getByRole('combobox', { name: 'Font' })
    expect(within(font).getByRole('option', { name: 'Inter (default)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload font…' })).toHaveClass(
      layout.iconButton as string,
    )
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Weight' }), 'Black')
    expect(updates(fake)).toEqual([patchOf({ style: { fontWeight: 900 } })])
  })

  it('the built-in styles are chips drawn in their own style, with their names', async () => {
    await open(TEXT)
    const group = await screen.findByRole('group', { name: 'Built-in styles' })
    const chip = within(group).getByRole('button', { name: 'Black capitals' })
    expect(chip).toHaveAttribute('title', 'Black capitals')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(chip).toHaveStyle({ fontWeight: '900', textTransform: 'uppercase' })
    expect(within(group).getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('a refused update shows its message on the page', async () => {
    const fake = makeFakeApi()
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That layer is no longer here.' },
    }))
    await open(TEXT, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    expect(await screen.findByText('That layer is no longer here.')).toBeVisible()
  })

  it('the "does not fit" line stays on the page, outside Type and Box', async () => {
    await open({ ...TEXT, overflow: true })
    const line = screen.getByText('This text does not fit its box.')
    expect(line).toBeVisible()
    expect(region('Type')).not.toContainElement(line)
  })

  it('"Suggest copy…" is an icon button that opens the copy options dialog', async () => {
    await open(TAGLINE)
    const button = screen.getByRole('button', { name: 'Suggest copy…' })
    expect(button).toHaveClass(layout.iconButton as string)
    expect(button).toHaveAttribute('title', 'Suggest copy…')
    expect(button).not.toHaveTextContent('Suggest')
    await userEvent.click(button)
    expect(await screen.findByRole('dialog', { name: 'Copy options for Tagline' })).toBeVisible()
  })

  it('a proposed translation is a mark with the built words; Approve sends translation.approve', async () => {
    const proposed = {
      ...TEXT,
      translationStatus: 'proposed' as const,
      translationSource: 'ai' as const,
    }
    const fake = await open(proposed)
    const mark = screen.getByTitle('Translation: Proposed, from AI')
    expect(mark).toHaveTextContent(/^Proposed/)
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(fake.commands.filter((c) => c.name === 'translation.approve')).toEqual([
      {
        name: 'translation.approve',
        input: { projectId: P, layers: [{ layerId: 'L1', copyRev: TEXT.revs.copy }] },
      },
    ])
  })

  it('has no accessibility violations, with Box closed and open', async () => {
    await open({ ...BOXED, overflow: true })
    expect(await axeViolations()).toEqual([])
    await userEvent.click(fold('Box'))
    expect(await axeViolations()).toEqual([])
  })
})
