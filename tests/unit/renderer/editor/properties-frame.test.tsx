// ED-1b (spec/phases/design-wave-screens-a.md, choice C-3): the properties panel's frame. The
// head is the layer's type icon and name, with a Locked mark that unlocks; the Layer section is
// gone (its actions are on the layer row); Position is a folded Section; the empty panel is an
// EmptyState, with an InfoTip on a video post; the panel is compact.
import '../../shared/scene/fake-fonts'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { writeFold } from '@/renderer/ui/section/fold-memory'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'

const LAYERS = [BACKGROUND, HEADLINE, LOGO]
const PLACED = { ...HEADLINE, geometry: { ...HEADLINE.geometry, x: 65, y: 1190 } }

async function open(layer: LayerRow | null, format: 'image' | 'video' = 'image') {
  const fake = makeFakeApi()
  const canvas = { width: 1080, height: 1350, format, durationMs: 8000 }
  await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={LAYERS}
        canvas={canvas}
      />
    </main>,
    fake,
  )
  return fake
}

// The fold memory lasts for the window's life (C-8): each case starts as a new window would.
beforeEach(() => writeFold('props.position', false))

const panel = () => screen.getByRole('region', { name: 'Properties' })
const positionButton = () => screen.getByRole('button', { name: 'Position' })

describe('Properties panel head [ED-1b]', () => {
  it.each([HEADLINE, LOGO, BACKGROUND])(
    '$name: the head is a heading with the name and no kind word',
    async (layer) => {
      await open(layer)
      const heading = within(panel()).getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(layer.name)
      expect(heading.parentElement?.textContent).toBe(layer.name)
      expect(heading.parentElement?.querySelector('svg')).not.toBeNull()
    },
  )

  it('a locked layer shows "Locked"; one click sends layer.update { locked: false }', async () => {
    const fake = await open({ ...HEADLINE, locked: true })
    const mark = screen.getByRole('button', { name: 'Locked. Unlock' })
    expect(mark).toHaveTextContent('Locked')
    await userEvent.click(mark)
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['layer.update', { projectId: P, layerId: HEADLINE.id, patch: { locked: false } }],
    ])
  })

  it('an unlocked layer has no Locked mark', async () => {
    await open(HEADLINE)
    expect(screen.queryByText('Locked')).toBeNull()
  })

  it('carries data-density="compact" on the panel root', async () => {
    await open(HEADLINE)
    expect(panel()).toHaveAttribute('data-density', 'compact')
  })
})

describe('Properties panel: no Layer section [ED-1b, C-3]', () => {
  it.each([HEADLINE, LOGO])('$name: no group "Layer", no Duplicate or Delete layer', async (l) => {
    await open(l)
    expect(screen.queryByRole('group', { name: 'Layer' })).toBeNull()
    for (const name of ['Duplicate', 'Delete layer', 'Bring forward', 'Send backward'])
      expect(screen.queryByRole('button', { name })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
    for (const name of ['Visible', 'Locked'])
      expect(screen.queryByRole('checkbox', { name })).toBeNull()
  })
})

describe('Properties panel: Position [ED-1b]', () => {
  it('starts folded with "{x}, {y}" and opens to four inline fields and Rotation', async () => {
    await open(PLACED)
    expect(positionButton()).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel()).getByText('65, 1190')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'X' })).toBeNull()
    await userEvent.click(positionButton())
    for (const name of ['X', 'Y', 'Width', 'Height', 'Rotation'])
      expect(screen.getByRole('spinbutton', { name })).toHaveAccessibleName(name)
    expect(screen.getByText('°')).toBeInTheDocument()
    expect(within(panel()).queryByText('Position and size')).toBeNull()
  })

  it('a field sends one layer.update with its geometry only', async () => {
    const fake = await open(PLACED)
    await userEvent.click(positionButton())
    const field = screen.getByRole('spinbutton', { name: 'Y' })
    await userEvent.clear(field)
    await userEvent.type(field, '900{Enter}')
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['layer.update', { projectId: P, layerId: HEADLINE.id, patch: { geometry: { y: 900 } } }],
    ])
  })
})

describe('Properties panel: nothing selected [ED-1b]', () => {
  it('shows "Select a layer" with no action and no InfoTip on an image post', async () => {
    await open(null)
    expect(within(panel()).getByText('Select a layer')).toBeInTheDocument()
    expect(within(panel()).queryByRole('button')).toBeNull()
  })

  it('on a video post, adds an InfoTip about making a video', async () => {
    await open(null, 'video')
    const tip = screen.getByRole('button', { name: 'About making a video' })
    await userEvent.click(tip)
    expect(screen.getByText('To make a video, select the background layer.')).toBeVisible()
  })
})

describe('Properties panel frame: accessibility [ED-1b]', () => {
  it.each([
    ['a locked text layer', { ...HEADLINE, locked: true }, 'image'],
    ['a picture layer', LOGO, 'image'],
    ['nothing selected on a video post', null, 'video'],
  ] as const)('%s has no violations', async (_c, layer, format) => {
    await open(layer, format)
    expect(await axeViolations()).toEqual([])
  })

  it('has no violations with Position open', async () => {
    await open(PLACED)
    await userEvent.click(positionButton())
    expect(await axeViolations()).toEqual([])
  })
})
