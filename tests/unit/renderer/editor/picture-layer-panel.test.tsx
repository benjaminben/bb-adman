// ED-3 (spec/phases/design-wave-screens-a.md, "ED-3 — Picture and background layer"): the
// picture at full width with an icon bar on its lower edge, "Empty picture" with its one action,
// the cut-out ring and hidden status, Opacity as a SliderField, and Shade as a folded Section
// with six icon segments. Every control keeps its old name and sends what it sent before.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PictureFields, type PictureAsset } from '@/renderer/editor/picture-fields'
import { ShadeFields } from '@/renderer/editor/shade-fields'
import { writeFold } from '@/renderer/ui/section/fold-memory'
import { NEW_SHADE } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, LOGO, P } from './editor-fixture'

const FAKE: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'cutout'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}
const ASSET: PictureAsset = {
  displayName: 'harbour-dawn.jpg',
  kind: 'image',
  missing: false,
  width: 2000,
  height: 1000,
  version: 0,
}
const WITH_PICTURE: LayerRow = { ...LOGO, source: { assetId: 'A1' } }
const CROPPED: LayerRow = {
  ...WITH_PICTURE,
  geometry: { ...WITH_PICTURE.geometry, crop: { x: 1, y: 2, width: 30, height: 40 } },
}

async function picture(layer: LayerRow, asset: PictureAsset | null = ASSET) {
  const state = baseState()
  const fake = makeFakeApi(baseState({ providers: [...state.providers, FAKE] }))
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: [], leavesOnServer: [] },
  }))
  fake.onCommand('generation.cutOut', () => ({ ok: true, data: { jobId: 'J1' } }))
  const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
  await renderApp(
    <main>
      <PictureFields
        projectId={P}
        layer={layer}
        asset={asset}
        canvas={{ width: 1080, height: 1350 }}
        onUpdate={onUpdate}
        onCrop={() => {}}
      />
    </main>,
    fake,
  )
  await act(async () => {})
  return { fake, onUpdate }
}

const block = () => screen.getByRole('group', { name: 'Picture' })
const barNames = () =>
  [
    ...block().querySelectorAll('[data-picture-bar] button, [data-picture-bar] [role=separator]'),
  ].map((e) => e.getAttribute('aria-label') ?? '|')

describe('ED-3: the picture block', () => {
  it('draws the icon bar in order, each button named and titled by its old words', async () => {
    await picture(WITH_PICTURE)
    expect(barNames()).toEqual([
      'Choose picture…',
      'Crop…',
      'Cut out the subject…',
      'Remove picture',
    ])
    for (const button of within(block()).getAllByRole('button')) {
      expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
    }
    expect(block().querySelector('[title="harbour-dawn.jpg"] img')).not.toBeNull()
    expect(screen.queryByText('harbour-dawn.jpg')).toBeNull()
  })

  it('shows Reset crop only when cropped, after Crop…', async () => {
    await picture(CROPPED)
    expect(barNames().slice(0, 3)).toEqual(['Choose picture…', 'Crop…', 'Reset crop'])
  })

  it('the background adds Fill and Fit after a divider, sending the same geometry', async () => {
    const { onUpdate } = await picture(BACKGROUND)
    expect(barNames().slice(-3)).toEqual(['|', 'Fill the canvas', 'Fit inside'])
    await userEvent.click(screen.getByRole('button', { name: 'Fit inside' }))
    expect(onUpdate.mock.calls).toEqual([
      [{ geometry: { x: 0, y: 405, width: 1080, height: 540, rotation: 0, crop: null } }],
    ])
  })

  it('no picture shows "Empty picture" whose "Choose picture…" opens the chooser', async () => {
    await picture(LOGO, null)
    expect(screen.getByText('Empty picture')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Remove picture' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Choose picture…' }))
    expect(await screen.findByRole('dialog', { name: 'Choose a picture for Logo' })).toBeVisible()
  })

  it.each([
    ['a locked layer', { ...WITH_PICTURE, locked: true }, ASSET, 'Choose picture…', 'Lock is on'],
    ['a missing file', WITH_PICTURE, { ...ASSET, missing: true }, 'Crop…', 'The file is missing'],
    [
      'an empty background',
      { ...BACKGROUND, source: null },
      null,
      'Fit inside',
      'Choose a picture first',
    ],
  ])('a disabled button says why in its title: %s', async (_c, layer, asset, name, why) => {
    await picture(layer, asset)
    const button = screen.getByRole('button', { name })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', why)
  })

  it('keeps "file not found" on the page', async () => {
    await picture(WITH_PICTURE, { ...ASSET, missing: true })
    expect(within(block()).getByText('file not found')).toBeVisible()
  })

  it('turns a ring over the picture while the cut-out runs; its words are a hidden status', async () => {
    const { fake } = await picture(WITH_PICTURE)
    await userEvent.click(screen.getByRole('button', { name: 'Cut out the subject…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cut out the subject' })
    await act(async () => {})
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cut out' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(block()).getByRole('status')).toHaveTextContent('Cutting out…')
    expect(block().querySelector('[data-cut-out-ring]')).not.toBeNull()
    const row = { kind: 'cutout' as const, provider: 'fake', layerId: WITH_PICTURE.id }
    act(() => fake.emit('job.updated', jobRow('J1', { ...row, status: 'succeeded' })))
    expect(within(block()).getByRole('status')).toHaveTextContent(
      'Done. The cut-out is under Earlier options.',
    )
    expect(block().querySelector('[data-cut-out-ring]')).toBeNull()
  })

  it('Opacity is a range plus "Opacity value" that saves once on release', async () => {
    const { onUpdate } = await picture(WITH_PICTURE)
    const range = screen.getByRole('slider', { name: 'Opacity' })
    fireEvent.input(range, { target: { value: '40' } })
    expect(screen.getByRole('spinbutton', { name: 'Opacity value' })).toHaveValue('40')
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.pointerUp(range)
    fireEvent.change(range, { target: { value: '40' } })
    expect(onUpdate.mock.calls).toEqual([[{ style: { opacity: 0.4 } }]])
  })

  it('has no axe violations for a background', async () => {
    await picture(BACKGROUND)
    expect(await axeViolations()).toEqual([])
  })
})

describe('ED-3: Shade', () => {
  beforeEach(() => writeFold('props.shade', false))

  async function shade(layer: LayerRow) {
    const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
    await renderApp(
      <main>
        <ShadeFields layer={layer} palette={['#E85D2A']} onUpdate={onUpdate} />
      </main>,
    )
    return { onUpdate }
  }
  const shaded = { ...BACKGROUND, style: { opacity: 1, shade: NEW_SHADE } }

  it('starts folded with its summary', async () => {
    await shade(shaded)
    const head = screen.getByRole('button', { name: 'Shade' })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('region', { name: 'Shade' })).toHaveTextContent('Bottom · 70 %')
  })

  it('a layer with no shade sums up as None', async () => {
    await shade(LOGO)
    expect(screen.getByRole('region', { name: 'Shade' })).toHaveTextContent('None')
  })

  it('the six side segments send the whole shade', async () => {
    const { onUpdate } = await shade(shaded)
    await userEvent.click(screen.getByRole('button', { name: 'Shade' }))
    const sides = within(screen.getByRole('group', { name: 'Shade' })).getAllByRole('button')
    expect(sides.map((b) => b.getAttribute('aria-label'))).toEqual([
      'None',
      'From the bottom',
      'From the top',
      'From the left',
      'From the right',
      'Whole picture',
    ])
    expect(sides[1]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(sides[3] as HTMLElement)
    await userEvent.click(sides[0] as HTMLElement)
    expect(onUpdate.mock.calls).toEqual([
      [{ style: { shade: { ...NEW_SHADE, from: 'left' } } }],
      [{ style: { shade: null } }],
    ])
  })

  it('Reach is disabled with its reason for the whole picture', async () => {
    await shade({ ...BACKGROUND, style: { opacity: 1, shade: { ...NEW_SHADE, from: 'all' } } })
    await userEvent.click(screen.getByRole('button', { name: 'Shade' }))
    const reach = screen.getByRole('slider', { name: 'Reach' })
    expect(reach).toBeDisabled()
    expect(reach.closest('[title]')).toHaveAttribute('title', 'Not used for the whole picture')
    expect(screen.getByRole('slider', { name: 'Strength' })).toBeEnabled()
  })

  it('has no axe violations open', async () => {
    await shade(shaded)
    await userEvent.click(screen.getByRole('button', { name: 'Shade' }))
    expect(await axeViolations()).toEqual([])
  })
})
