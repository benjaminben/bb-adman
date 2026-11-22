// R2E-3 (spec/phases/round-2-editor.md D3, "In the editor"): "Built-in styles" in Text settings,
// shown only while the project has no font of its own. Five buttons, the one matching the layer
// pressed; a click sends one update of the three fields with the font back to the default.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TypeStyles } from '@/renderer/editor/type-styles'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { HEADLINE, assetRow } from './editor-fixture'

const P = 'P1'
const FONT = assetRow('F1', { kind: 'font', mime: 'font/woff2', fontFamily: 'Grotesk' })
const LABELS = ['Regular', 'Bold', 'Black capitals', 'Light', 'Spaced capitals']
const NO_FONTS_LINE = 'This project has no fonts of its own. Use Upload font… to add one.'

const withStyle = (style: Record<string, unknown>, over: Partial<LayerRow> = {}): LayerRow => ({
  ...HEADLINE,
  ...over,
  style: { ...HEADLINE.style, ...style } as LayerRow['style'],
})

async function setup(
  opts: { layer?: LayerRow; fonts?: unknown[]; refusal?: string; projectId?: string } = {},
) {
  const fake = makeFakeApi()
  const fonts = { list: opts.fonts ?? [] }
  fake.onQuery('asset.list', () => ({ ok: true, data: fonts.list }))
  const onUpdate = vi.fn(async (_patch: LayerPatch) => opts.refusal ?? null)
  const { store } = await renderApp(
    <main>
      <TypeStyles layer={opts.layer ?? HEADLINE} onUpdate={onUpdate} />
    </main>,
    fake,
  )
  act(() => store.getState().show({ kind: 'project', projectId: opts.projectId ?? P }))
  return { fake, fonts, onUpdate }
}

const group = () => screen.findByRole('group', { name: 'Built-in styles' })
const fontQueries = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'asset.list')

describe('TypeStyles [R2E-3, D3 "In the editor"]', () => {
  it('shows the five styles and the no-fonts line when the project has no font', async () => {
    const { fake } = await setup()
    const buttons = within(await group()).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(LABELS)
    expect(screen.getByText(NO_FONTS_LINE)).toBeInTheDocument()
    expect(fontQueries(fake).map((q) => q.input)).toEqual([
      { projectId: P, library: 'asset', kind: 'font' },
    ])
    expect(await axeViolations()).toEqual([])
  })

  it('shows nothing when the project has a font of its own', async () => {
    const { fake } = await setup({ fonts: [FONT] })
    await vi.waitFor(() => expect(fontQueries(fake)).toHaveLength(1))
    await act(async () => undefined)
    expect(screen.queryByRole('group', { name: 'Built-in styles' })).toBeNull()
    expect(screen.queryByText(NO_FONTS_LINE)).toBeNull()
  })

  it.each([
    [{ fontWeight: 400, letterSpacing: 0 }, 'Regular'],
    [{ fontWeight: 900, allCaps: true, letterSpacing: 0.02 }, 'Black capitals'],
    [{ fontWeight: 500, allCaps: true, letterSpacing: 0.12 }, 'Spaced capitals'],
  ])('presses the style that matches the layer (%j)', async (style, name) => {
    await setup({ layer: withStyle(style) })
    const pressed = within(await group())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual([name])
  })

  it('presses none when the layer matches no style', async () => {
    await setup({ layer: withStyle({ fontWeight: 600, letterSpacing: 0.3 }) })
    const buttons = within(await group()).getAllByRole('button')
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('a click sends one update of the three fields with the default font', async () => {
    const { onUpdate } = await setup()
    await userEvent.click(within(await group()).getByRole('button', { name: 'Black capitals' }))
    expect(onUpdate.mock.calls).toEqual([
      [{ style: { fontAssetId: null, fontWeight: 900, allCaps: true, letterSpacing: 0.02 } }],
    ])
  })

  it('shows a refusal under the group', async () => {
    await setup({ refusal: 'That layer is no longer here.' })
    await userEvent.click(within(await group()).getByRole('button', { name: 'Bold' }))
    expect(await screen.findByText('That layer is no longer here.')).toBeInTheDocument()
  })

  it('is disabled on a locked layer', async () => {
    const { onUpdate } = await setup({ layer: withStyle({}, { locked: true }) })
    const buttons = within(await group()).getAllByRole('button')
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    await userEvent.click(buttons[1] as HTMLElement)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('goes away after a font is added to the project, and not for another project', async () => {
    const { fake, fonts } = await setup()
    await group()
    fonts.list = [FONT]
    const changed = (projectId: string) =>
      act(() =>
        fake.emit('project.changed', {
          projectId,
          changed: { asset: [FONT] },
          removed: {},
          actor: 'user',
        }),
      )
    await changed('P2')
    await changed(P)
    await vi.waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Built-in styles' })).toBeNull(),
    )
    expect(fontQueries(fake)).toHaveLength(2)
  })

  it('reads again on a change that removes an asset, and not on one that names none', async () => {
    const { fake } = await setup()
    await group()
    const emit = (payload: { changed?: object; removed?: object }) =>
      act(() =>
        fake.emit('project.changed', {
          projectId: P,
          changed: {},
          removed: {},
          actor: 'user',
          ...payload,
        }),
      )
    await emit({ changed: { layer: [HEADLINE] } })
    await emit({ removed: { asset: ['F9'] } })
    await vi.waitFor(() => expect(fontQueries(fake)).toHaveLength(2))
  })

  it('draws nothing outside the app, as when Text settings is drawn alone', () => {
    const { container } = render(<TypeStyles layer={HEADLINE} onUpdate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
