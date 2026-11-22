// R2E-4 (spec/phases/round-2-editor.md D4, the picture parts): the "Generate" fieldset, its
// "Start from" choices, the same-shape list, what a picture run sends and the video-post lines.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { assetRow, BACKGROUND, LOGO, P } from './editor-fixture'

type Row = AssetList[number]

// The logo box is 200 by 120; the background box and its picture A1 are 1080 by 1350.
const wide = (id: string, over: Partial<Row> = {}) =>
  assetRow(id, { width: 1000, height: 600, ...over })
const can = (id: string) => ref(id, { subjectId: 'citrus-can' })
const wideCan = (id: string) => ref(id, { subjectId: 'citrus-can', width: 1000, height: 600 })
const A1 = assetRow('A1')

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

async function open(opts: { rows?: Row[]; layer?: LayerRow; format?: 'image' | 'video' } = {}) {
  const fake = campaignApi()
  const list = { rows: opts.rows ?? [A1, can('R1')] }
  fake.onQuery('asset.list', () => ({ ok: true, data: list.rows }))
  fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J1' } }))
  await renderApp(
    <main>
      <GeneratePanel
        projectId={P}
        campaignId="C1"
        layer={opts.layer ?? LOGO}
        format={opts.format ?? 'image'}
      />
    </main>,
    fake,
  )
  // ED-4a: the reference strip shows once the layer's first draft is made.
  await screen.findByRole('list', { name: 'Reference pictures' })
  return { fake, list, panel: within(screen.getByRole('region', { name: 'Generate' })) }
}

const starts = () => within(screen.getByRole('group', { name: 'Start from' }))

async function generate() {
  await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Make pictures' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Generate' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

const references = (fake: Awaited<ReturnType<typeof open>>['fake']) =>
  sent(fake, 'generation.runImages').map(
    (c) => (c.input as { referenceAssetIds: string[] }).referenceAssetIds,
  )

async function chooseShape() {
  await userEvent.click(
    starts().getByRole('button', { name: 'Another picture of the same shape…' }),
  )
  return within(await screen.findByRole('region', { name: 'Pictures of the same shape' }))
}

const LAYER_PICTURE = "This layer's picture"
const ON_TIMELINE = 'On a video post, the clips on the timeline show over this picture.'

describe('GeneratePanel [R2E-4, D4]', () => {
  it('is a fieldset named Generate with three ways to start, a prompt only first', async () => {
    await open()
    const radios = starts().getAllByRole('button')
    expect(radios.map((r) => r.textContent)).toEqual([
      'A prompt only',
      LAYER_PICTURE,
      'Another picture of the same shape…',
    ])
    expect(starts().getByRole('button', { name: 'A prompt only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it.each([
    ['a layer with no picture', LOGO, [A1]],
    ['a layer whose picture is missing', BACKGROUND, [assetRow('A1', { missing: true })]],
  ])(`offers "${LAYER_PICTURE}" disabled for %s`, async (_name, layer, rows) => {
    await open({ layer, rows })
    const radio = starts().getByRole('button', { name: LAYER_PICTURE })
    expect(radio).toBeDisabled()
    expect(radio).toHaveAccessibleDescription('This layer has no picture yet.')
  })

  it('disables every choice on a locked layer', async () => {
    await open({ layer: { ...BACKGROUND, locked: true } })
    starts()
      .getAllByRole('button')
      .forEach((r) => expect(r).toBeDisabled())
  })

  it(`sends the layer's own picture first for "${LAYER_PICTURE}"`, async () => {
    const { fake } = await open({ layer: BACKGROUND })
    await userEvent.click(starts().getByRole('button', { name: LAYER_PICTURE }))
    await generate()
    expect(references(fake)).toEqual([['A1', 'R1']])
  })

  it('lists the pictures of the same shape, and sends the one picked first', async () => {
    const rows = [A1, can('R1'), wide('S1'), wide('S2', { missing: true }), ref('Q1')]
    const { fake } = await open({ rows })
    const list = await chooseShape()
    expect(list.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      'S1.png',
    ])
    expect(screen.getByRole('button', { name: 'Generate…' })).toBeDisabled()
    await userEvent.click(list.getByRole('radio', { name: 'S1.png' }))
    await generate()
    expect(references(fake)).toEqual([['S1', 'R1']])
  })

  it("leaves the layer's own picture out of the list, and says when it is empty", async () => {
    const own = { ...LOGO, source: { assetId: 'S1' } }
    await open({ layer: own, rows: [wide('S1'), ref('Q1')] })
    const list = await chooseShape()
    expect(list.queryAllByRole('radio')).toEqual([])
    expect(
      list.getByText("No other picture in this project has this layer's shape (200 × 120)."),
    ).toBeVisible()
  })

  it('adds pictures: one of this shape is picked, one of another shape is named', async () => {
    const { fake, list } = await open({ rows: [A1] })
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      list.rows = [A1, wide('N1'), ref('N2', { displayName: 'Square.png' })]
      return { ok: true, data: { assetIds: ['N1', 'N2'] } }
    })
    const region = await chooseShape()
    await userEvent.click(region.getByRole('button', { name: 'Add pictures…' }))
    expect(await region.findByRole('radio', { name: 'N1.png' })).toBeChecked()
    expect(region.getByText('Square.png has another shape, so it is not listed.')).toBeVisible()
    expect(sent(fake, 'asset.import')).toHaveLength(1)
  })

  // Ten subject photos, so eight are chosen as references (R0 to R7). R0 also has the logo's
  // shape, so it can be the start too.
  const cans = [wideCan('R0'), ...Array.from({ length: 9 }, (_, i) => can(`R${i + 1}`))]
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `R${i}`)
  it.each([
    ['cuts the rest off after the start', 'S1', ['S1', ...ids(7)]],
    ['sends a start that is also a reference once', 'R0', ids(8)],
  ])('sends at most 8 pictures, the start first: %s', async (_name, start, wanted) => {
    const { fake } = await open({ rows: [...cans, wide('S1')] })
    await userEvent.click((await chooseShape()).getByRole('radio', { name: `${start}.png` }))
    await generate()
    expect(references(fake)).toEqual([wanted])
  })

  it.each([
    [
      'background',
      'image',
      BACKGROUND,
      'To make a video, set Format to Video in the top bar first.',
    ],
    ['picture', 'video', LOGO, 'Videos are made on the background layer.'],
    [
      'background',
      'video',
      BACKGROUND,
      'On a video post, the clips on the timeline show over this picture.',
    ],
  ] as const)('shows a line for the %s layer of a %s post', async (_name, format, layer, line) => {
    const { panel } = await open({ layer, format })
    // ED-4a: the line is the disabled "Video" segment's title, or the InfoTip's words.
    if (line === ON_TIMELINE) {
      expect(panel.getByRole('button', { name: 'About pictures on a video post' })).toBeVisible()
      expect(panel.getByText(line)).toBeInTheDocument()
    } else {
      expect(panel.getByRole('button', { name: 'Video' })).toHaveAttribute('title', line)
    }
  })

  it('shows no video line for a picture layer of an image post', async () => {
    const { panel } = await open({ layer: LOGO, format: 'image' })
    // ED-4a: no line is printed; the reason is the disabled "Video" segment's title.
    expect(panel.queryByText(/video/i, { selector: 'p' })).toBeNull()
  })
})
