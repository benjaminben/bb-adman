// spec/phases/phase-07-slices-2.md, P7-19: in the properties panel of a text layer on a video
// ad, "Entrance" and "Exit", each a preset select ("None", "Fade", "Fade up", "Slide", "Words
// one by one") and a length in seconds. Each change is one layer.update { animation } with
// that block only, in whole milliseconds. A block given a preset for the first time is half a
// second long, an entrance at the layer's start and an exit at its end. An image ad, and any
// layer but text, shows neither.
import '../../shared/scene/fake-fonts'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const VIDEO = { ...variant('V1'), format: 'video' as const, durationMs: 8000 }
const IMAGE = variant('V1')
const TITLE: LayerRow = {
  ...HEADLINE,
  timing: { startMs: 1000, endMs: 5000 },
  animation: {
    entrance: { preset: 'none', startMs: 0, durationMs: 0 },
    exit: { preset: 'slide', startMs: 4000, durationMs: 1000 },
  },
}

async function open(layer: LayerRow, canvas: typeof VIDEO | typeof IMAGE = VIDEO) {
  const fake = makeFakeApi()
  await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={[BACKGROUND, layer, LOGO]}
        canvas={canvas}
      />
    </main>,
    fake,
  )
  // ED-6: Animation is a folded Section; open it when it is closed (the fold lasts the session).
  const fold = screen.queryByRole('button', { name: 'Animation' })
  if (fold?.getAttribute('aria-expanded') === 'false') await userEvent.click(fold)
  const patches = () =>
    fake.commands
      .filter((c) => c.name === 'layer.update')
      .map((c) => (c.input as { patch: unknown }).patch)
  return { fake, patches }
}

const select = (name: string) => screen.getByRole('combobox', { name })
const length = (name: string) => screen.getByRole('spinbutton', { name })

describe('AnimationFields [P7-19]', () => {
  it("shows each block's preset and length, the length off while there is no preset", async () => {
    await open(TITLE)
    expect(select('Entrance')).toHaveValue('none')
    expect(select('Exit')).toHaveValue('slide')
    expect(
      within(select('Entrance'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['None', 'Fade', 'Fade up', 'Slide', 'Words one by one'])
    expect(length('Entrance length')).toBeDisabled()
    expect(length('Exit length')).toHaveValue('1')
    expect(screen.getByText('In')).toBeVisible()
    expect(screen.getByText('Out')).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })

  it('a first preset places a half-second block; a new preset keeps the place', async () => {
    const { patches } = await open(TITLE)
    const user = userEvent.setup()
    await user.selectOptions(select('Entrance'), 'Fade up')
    await user.selectOptions(select('Exit'), 'Words one by one')
    await user.selectOptions(select('Exit'), 'None')
    expect(patches()).toEqual([
      { animation: { entrance: { preset: 'fade-up', startMs: 1000, durationMs: 500 } } },
      { animation: { exit: { preset: 'stagger-words', startMs: 4000, durationMs: 1000 } } },
      { animation: { exit: { preset: 'none', startMs: 4000, durationMs: 1000 } } },
    ])
  })

  it("an exit with no length yet ends at the layer's end", async () => {
    const layer = { ...TITLE, animation: { ...TITLE.animation, exit: TITLE.animation.entrance } }
    const { patches } = await open(layer)
    await userEvent.setup().selectOptions(select('Exit'), 'Fade')
    expect(patches()).toEqual([
      { animation: { exit: { preset: 'fade', startMs: 4500, durationMs: 500 } } },
    ])
  })

  it('a length in seconds is sent in whole milliseconds; an exit keeps its end', async () => {
    const { patches } = await open(TITLE)
    const user = userEvent.setup()
    await user.clear(length('Exit length'))
    await user.type(length('Exit length'), '0.4{Enter}')
    expect(patches()).toEqual([
      { animation: { exit: { preset: 'slide', startMs: 4600, durationMs: 400 } } },
    ])
  })

  it('is not shown on an image ad', async () => {
    await open(TITLE, IMAGE)
    expect(screen.queryByRole('combobox', { name: 'Entrance' })).toBeNull()
  })

  it('is not shown for a picture layer on a video ad', async () => {
    await open(LOGO)
    expect(screen.queryByRole('combobox', { name: 'Entrance' })).toBeNull()
  })
})
