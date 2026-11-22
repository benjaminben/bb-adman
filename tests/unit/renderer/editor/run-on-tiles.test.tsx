// Design wave ED-4b (spec/phases/design-wave-screens-a.md, "ED-4b"): the run state is drawn on
// the option tiles, the progress and done sentences are a hidden status, failures stay visible,
// and "Earlier options" is a folded Section of thin run rows. Retry keeps its paid rule (C-15).
import fs from 'node:fs'
import path from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClipPreview } from '@/renderer/editor/clip-preview'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { RunStatus } from '@/renderer/editor/generate-fields/run-status'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { draftKey, generateDrafts } from '@/renderer/stores/generate-drafts'
import iconStyles from '@/renderer/ui/icon/icon.module.css'
import { writeFold } from '@/renderer/ui/section/fold-memory'
import { plainMessage } from '@/shared/providers/messages'
import type { EarlierOptions as Reply } from '@/shared/schemas/queries/earlier-options'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { campaignApi, LOCAL, sent } from '../screens/campaign/campaign-fixture'
import { CLIP, videoRow } from '../screens/campaign/video-fixture'
import { costLine } from '../cost-line'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, LOGO, P } from './editor-fixture'

const LAYER: LayerRow = { ...LOGO, source: { assetId: 'A5' } }
const LATE = '2026-11-21T14:40:00.000Z'
const pad = (n: number) => String(n).padStart(2, '0')
const at = (iso: string) => `${pad(new Date(iso).getHours())}:${pad(new Date(iso).getMinutes())}`
const asset = (assetId: string, missing = false) => ({ assetId, width: 800, height: 600, missing })
const REQUEST = { prompt: 'A can', referenceAssetIds: [], count: 3, width: 800, height: 600 }

const job = (id: string, over: Partial<JobRow>) =>
  jobRow(id, { layerId: LAYER.id, slot: null, request: REQUEST, createdAt: LATE, ...over })

beforeEach(() => {
  generateDrafts.setState({ drafts: {}, wanted: {} })
  writeFold('props.earlier', false)
})

async function panel(row: JobRow, assets: Reply[number]['assets'] = []) {
  const draft = { prompt: 'A can', referenceAssetIds: [], run: { jobId: row.id, count: 3 } }
  generateDrafts.setState({ drafts: { [draftKey(P, LAYER.id)]: draft }, wanted: {} })
  const fake = campaignApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
  fake.onQuery('job.list', () => ({ ok: true, data: [row] }))
  fake.onQuery('job.earlierOptions', () => ({ ok: true, data: [{ job: row, assets }] }))
  await renderApp(
    <main>
      <GeneratePanel projectId={P} campaignId="C1" layer={LAYER} format="image" />
    </main>,
    fake,
  )
  return fake
}

async function earlier(reply: Reply, local = false) {
  const providers = [...baseState().providers, ...(local ? [LOCAL] : [])]
  const fake = campaignApi({ state: { providers } })
  fake.onQuery('job.earlierOptions', () => ({ ok: true, data: reply }))
  fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J9' } }))
  await renderApp(
    <main>
      <EarlierOptions projectId={P} layer={LAYER} />
    </main>,
    fake,
  )
  return fake
}

const fold = () => screen.findByRole('button', { name: 'Earlier options' })

describe('Run state on the tiles [ED-4b]', () => {
  it('a running run of three pictures draws three spinner tiles and a hidden status', async () => {
    await panel(job('J3', { status: 'running' }))
    const fresh = await screen.findByRole('region', { name: 'New pictures' })
    await waitFor(() => expect(fresh.querySelectorAll('[data-pending]')).toHaveLength(3))
    for (const tile of fresh.querySelectorAll('[data-pending]')) {
      expect(tile.querySelector(`svg.${iconStyles.spin}`)).not.toBeNull()
    }
    const status = await screen.findByText('Making 3 pictures…')
    expect(status).toHaveAttribute('role', 'status')
  })

  it('once done, the layer’s tile is "In use" and the others "New result"', async () => {
    await panel(job('J3', { status: 'succeeded' }), [asset('A5'), asset('A6'), asset('A7')])
    const fresh = await screen.findByRole('region', { name: 'New pictures' })
    const tiles = await within(fresh).findAllByRole('button', { name: /^Use option/ })
    expect(tiles).toHaveLength(3)
    expect(fresh.querySelectorAll('[data-pending]')).toHaveLength(0)
    expect(within(tiles[0]!).getByTitle('In use')).toBeInTheDocument()
    expect(within(tiles[1]!).getByTitle('New result')).toBeInTheDocument()
    expect(within(tiles[2]!).getByTitle('New result')).toBeInTheDocument()
  })

  it('a failed run shows its sentence visibly, outside the hidden status, with Retry', async () => {
    const row = job('J3', { status: 'failed', errorKind: 'quota' })
    await panel(row)
    const sentences = await screen.findAllByText(plainMessage('quota', 'Google Gemini'))
    for (const s of sentences) expect(s.closest('[role="status"]')).toBeNull()
    const region = screen.getByRole('region', { name: 'Earlier options' })
    expect(await fold()).toHaveAttribute('aria-expanded', 'true')
    expect(within(region).getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it.each([
    ['cancelled', { status: 'cancelled' as const }, 'Cancelled.'],
    [
      'empty',
      { status: 'succeeded' as const, result: { assetIds: [] } },
      'The run ended with no pictures.',
    ],
  ])('a %s run’s line stays visible words', async (_name, over, words) => {
    const fake = makeFakeApi()
    await renderApp(
      <RunStatus projectId={P} layerId={LAYER.id} run={{ jobId: 'J1', count: 2 }} />,
      fake,
    )
    act(() => fake.emit('job.updated', job('J1', over)))
    const line = await screen.findByText(words)
    expect(line.closest('[role="status"]')).toBeNull()
  })

  it('a video on the timeline shows the "On timeline" mark, and none when it could not be put there', async () => {
    const done = (clipId: string | null) =>
      videoRow({ layerId: BACKGROUND.id, status: 'succeeded', result: { ...CLIP, clipId } })
    const { unmount } = await renderApp(
      <ClipPreview projectId={P} row={done('C9')} />,
      makeFakeApi(),
    )
    expect(screen.getByTitle('On timeline')).toBeInTheDocument()
    unmount()
    await renderApp(<ClipPreview projectId={P} row={done(null)} />, makeFakeApi())
    expect(screen.queryByTitle('On timeline')).toBeNull()
  })

  it('a video run shows a progress bar while it goes, and its words in the hidden status', async () => {
    const fake = makeFakeApi()
    const run = { jobId: 'J1', count: 1, kind: 'video' as const }
    await renderApp(<RunStatus projectId={P} layerId={BACKGROUND.id} run={run} />, fake)
    act(() => fake.emit('job.updated', videoRow({ status: 'queued' })))
    expect(await screen.findByRole('progressbar', { name: 'Making the video' })).toBeVisible()
    expect(screen.getByText('Making the video. Waiting.')).toHaveAttribute('role', 'status')
  })
})

describe('Earlier options as a folded Section [ED-4b]', () => {
  const two: Reply = [
    {
      job: job('J2', { status: 'succeeded', seenAt: LATE, startedBy: 'agent' }),
      assets: [asset('A5')],
    },
    {
      job: job('J1', { status: 'succeeded', seenAt: LATE, kind: 'cutout' }),
      assets: [asset('A1')],
    },
  ]

  it('starts folded with "2 runs"', async () => {
    await earlier(two)
    expect(await fold()).toHaveAttribute('aria-expanded', 'false')
    const region = screen.getByRole('region', { name: 'Earlier options' })
    expect(await within(region).findByText('2 runs')).toBeVisible()
  })

  it.each([
    [[] as Reply, 'No runs'],
    [[two[0]!], '1 run'],
  ])('sums up %#', async (reply, words) => {
    await earlier(reply)
    expect(await screen.findByText(words)).toBeVisible()
  })

  it('a run row shows the time, the kind icon’s hidden name, the agent mark and the provider in its title', async () => {
    await earlier(two)
    await userEvent.click(await fold())
    const rows = screen.getAllByRole('listitem').filter((li) => li.dataset.run !== undefined)
    expect(rows[0]).toHaveAttribute('title', `${at(LATE)} · Google Gemini · Pictures`)
    expect(within(rows[0]!).getByText(at(LATE))).toBeVisible()
    expect(within(rows[0]!).getByText('Pictures')).toBeInTheDocument()
    expect(within(rows[0]!).getByTitle('Started by an agent')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Cut-out')).toBeInTheDocument()
    expect(within(rows[1]!).queryByTitle('Started by an agent')).toBeNull()
    expect(within(rows[0]!).getByTitle('In use')).toBeInTheDocument()
  })

  it('says "No earlier options yet" when the layer has no runs', async () => {
    await earlier([])
    await userEvent.click(await fold())
    expect(screen.getByText('No earlier options yet')).toBeVisible()
  })

  it('has no axe violations, open', async () => {
    const failed = job('J3', { status: 'failed', errorKind: 'quota', createdAt: LATE })
    await earlier([{ job: failed, assets: [] }, ...two])
    await screen.findByText(plainMessage('quota', 'Google Gemini'))
    expect(await axeViolations()).toEqual([])
  })
})

describe('Retry keeps its paid rule [ED-4b, C-15]', () => {
  const failed = (provider: string) =>
    job('J1', { status: 'failed', provider, errorKind: 'quota', result: { assetIds: ['A1'] } })

  it('a picture run of a paid provider opens the run dialog, which alone sends', async () => {
    const fake = await earlier([{ job: failed('gemini'), assets: [] }])
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
    expect(dialog.getByText(costLine('Paid: 2 pictures → Google Gemini'))).toBeVisible()
    expect(sent(fake, 'job.retry')).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(sent(fake, 'job.retry')).toHaveLength(1))
  })

  it('a local provider retries at once with one job.retry', async () => {
    const fake = await earlier([{ job: failed('fake'), assets: [] }], true)
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })
})

describe('Spinners and reduce motion [ED-4b]', () => {
  it('the tiles add no motion of their own: the spinner icon pulses in place of turning', () => {
    for (const file of [
      'run-block.module.css',
      'option-tile.module.css',
      'earlier-options.module.css',
    ]) {
      const css = fs.readFileSync(path.resolve('src/renderer/editor/earlier-options', file), 'utf8')
      expect(css).not.toMatch(/animation/)
    }
  })
})
