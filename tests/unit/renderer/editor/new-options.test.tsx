// spec/phases/round-2-editor.md D6, "New pictures first" (R2E-5): the run the Generate panel
// started is drawn first under "New pictures", in its own region; the other runs follow under
// "Earlier options". Same option buttons and "In use" mark; a run not yet looked at is marked
// seen once.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { draftKey, generateDrafts } from '@/renderer/stores/generate-drafts'
import type { EarlierOptions as Reply } from '@/shared/schemas/queries/earlier-options'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import { assetRow, LOGO, P } from './editor-fixture'

const SEEN = '2026-11-21T09:05:00.000Z'
const LAYER: LayerRow = { ...LOGO, source: { assetId: 'A3' } }
const LAYER_A5: LayerRow = { ...LOGO, source: { assetId: 'A5' } }
const asset = (assetId: string) => ({ assetId, width: 800, height: 600, missing: false })
const run = (id: string, over: Partial<JobRow>, ids: string[]) => ({
  job: jobRow(id, { layerId: LAYER.id, slot: null, status: 'succeeded', ...over }),
  assets: ids.map(asset),
})

const REPLY: Reply = [
  run('J3', { seenAt: null }, ['A5', 'A6']),
  run('J2', { seenAt: SEEN }, ['A3']),
  run('J1', { seenAt: null }, ['A1']),
]

async function open(newJobId?: string, reply: Reply = REPLY) {
  const fake = campaignApi()
  fake.onQuery('job.earlierOptions', () => ({ ok: true, data: reply }))
  await renderApp(
    <main>
      <EarlierOptions
        projectId={P}
        layer={LAYER}
        {...(newJobId === undefined ? {} : { newJobId })}
      />
    </main>,
    fake,
  )
  return fake
}

const runsIn = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map((li) => li.dataset.run)
    .filter((id) => id !== undefined)

describe('EarlierOptions: new pictures first [spec/phases/round-2-editor.md D6]', () => {
  it('draws the new run first under "New pictures", the rest under "Earlier options"', async () => {
    await open('J3')
    const fresh = await screen.findByRole('region', { name: 'New pictures' })
    const earlier = screen.getByRole('region', { name: 'Earlier options' })
    expect(runsIn(fresh)).toEqual(['J3'])
    // The new run's region sits first inside the earlier options', above their title.
    expect(runsIn(earlier)).toEqual(['J3', 'J2', 'J1'])
    const titles = within(earlier).getAllByText(/^(New pictures|Earlier options)$/)
    expect(titles.map((t) => t.textContent)).toEqual(['New pictures', 'Earlier options'])
  })

  it('the new run’s options are the same buttons, and Use sends one layer.update', async () => {
    const fake = await open('J3')
    const fresh = await screen.findByRole('region', { name: 'New pictures' })
    const options = within(fresh).getAllByRole('button', { name: /^Use option/ })
    expect(options).toHaveLength(2)
    await userEvent.click(options[1]!)
    expect(sent(fake, 'layer.update').map((c) => c.input)).toEqual([
      {
        projectId: P,
        layerId: LAYER.id,
        patch: { source: { assetId: 'A6' }, geometry: { crop: null } },
      },
    ])
    const used = within(screen.getByRole('region', { name: 'Earlier options' })).getByRole(
      'button',
      { pressed: true },
    )
    expect(within(used).getByText('In use')).toBeVisible()
  })

  it('marks each run not yet looked at seen once, the new run among them', async () => {
    const fake = await open('J3')
    await waitFor(() => expect(sent(fake, 'job.markSeen')).toHaveLength(1))
    expect(sent(fake, 'job.markSeen')[0]?.input).toEqual({ projectId: P, jobIds: ['J3', 'J1'] })
    act(() => fake.emit('job.updated', REPLY[0]!.job))
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'job.earlierOptions')).toHaveLength(2),
    )
    expect(sent(fake, 'job.markSeen')).toHaveLength(1)
  })

  it.each([
    ['no new run is named', undefined],
    ['the new run is not in the reply yet', 'J9'],
    ['a newer run, such as a cut-out, came after it', 'J2'],
  ])('has no "New pictures" when %s', async (_name, newJobId) => {
    await open(newJobId)
    const earlier = await screen.findByRole('region', { name: 'Earlier options' })
    await within(earlier).findAllByRole('button', { name: /^Use option/ })
    expect(screen.queryByRole('region', { name: 'New pictures' })).toBeNull()
    expect(runsIn(earlier)).toEqual(['J3', 'J2', 'J1'])
  })

  it('says nothing under "Earlier options" when the new run is the only one', async () => {
    await open('J3', [REPLY[0]!])
    await screen.findByRole('region', { name: 'New pictures' })
    expect(screen.queryByText('No earlier options for this layer.')).toBeNull()
  })

  it('has no axe violations', async () => {
    await open('J3')
    await screen.findByRole('region', { name: 'New pictures' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('GeneratePanel names its last picture run as new [D6]', () => {
  it.each([
    ['a picture run', 'image' as const, true],
    ['a video run', 'video' as const, false],
  ])('%s', async (_name, kind, shown) => {
    const run = { jobId: 'J3', count: 2, kind }
    const draft = { prompt: 'A can on ice', referenceAssetIds: [], run }
    generateDrafts.setState({ drafts: { [draftKey(P, LAYER.id)]: draft }, wanted: {} })
    const fake = campaignApi()
    fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
    fake.onQuery('job.earlierOptions', () => ({ ok: true, data: REPLY }))
    await renderApp(
      <main>
        <GeneratePanel projectId={P} campaignId="C1" layer={LAYER} format="image" />
      </main>,
      fake,
    )
    const earlier = await screen.findByRole('region', { name: 'Earlier options' })
    await within(earlier).findAllByRole('button', { name: /^Use option/ })
    expect(screen.queryAllByRole('region', { name: 'New pictures' })).toHaveLength(shown ? 1 : 0)
  })
})

// The panel on the logo layer, and a button that puts picture A5 on it, as a finished run does.
function Placing() {
  const [layer, setLayer] = useState<LayerRow>(LOGO)
  return (
    <main>
      <button type="button" onClick={() => setLayer(LAYER_A5)}>
        Place
      </button>
      <GeneratePanel projectId={P} campaignId="C1" layer={layer} format="image" />
    </main>
  )
}

describe('GeneratePanel after a new picture is put on the layer [D6]', () => {
  it('reads the images again, so "Start from" knows the layer has a picture', async () => {
    generateDrafts.setState({ drafts: {}, wanted: {} })
    const fake = campaignApi()
    let rows: unknown[] = []
    fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
    fake.onQuery('job.earlierOptions', () => ({ ok: true, data: [] }))
    await renderApp(<Placing />, fake)
    expect(await screen.findByText('This layer has no picture yet.')).toBeVisible()
    rows = [assetRow('A5')]
    await userEvent.click(screen.getByRole('button', { name: 'Place' }))
    await waitFor(() => expect(screen.queryByText('This layer has no picture yet.')).toBeNull())
    expect(screen.getByRole('radio', { name: "This layer's picture" })).toBeEnabled()
  })
})
