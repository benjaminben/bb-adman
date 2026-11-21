// spec/screens-ai.md, "Earlier options" [FR-248, FR-216, FR-218; workflow 5.8 step 5]: every
// earlier run of the layer with its options; Use sets the layer's picture with one layer.update
// and no provider call; a succeeded run not yet looked at is marked seen once when shown.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { plainMessage } from '@/shared/providers/messages'
import type { EarlierOptions as Reply } from '@/shared/schemas/queries/earlier-options'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { campaignApi, LOCAL, sent } from '../screens/campaign/campaign-fixture'
import { baseState } from '../fake-api'
import { jobRow } from '../stores/job-fixture'
import { LOGO, P } from './editor-fixture'

const pad = (n: number) => String(n).padStart(2, '0')
const at = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EARLY = '2026-11-21T09:05:00.000Z'
const LATE = '2026-11-21T14:40:00.000Z'
const LAYER: LayerRow = { ...LOGO, source: { assetId: 'A2' } }
const asset = (assetId: string, missing = false) => ({ assetId, width: 800, height: 600, missing })

function run(id: string, over: Partial<JobRow>, assets: Reply[number]['assets'] = []) {
  const job = jobRow(id, { layerId: LAYER.id, slot: null, ...over })
  return { job, assets }
}

const TWO_RUNS: Reply = [
  run('J2', { status: 'succeeded', createdAt: LATE, seenAt: LATE }, [asset('A3'), asset('A4')]),
  run('J1', { status: 'succeeded', createdAt: EARLY, seenAt: EARLY }, [asset('A1'), asset('A2')]),
]

async function open(opts: { reply?: Reply; layer?: LayerRow; local?: boolean } = {}) {
  const providers = [...baseState().providers, ...(opts.local ? [LOCAL] : [])]
  const fake = campaignApi({ state: { providers } })
  let reply = opts.reply ?? TWO_RUNS
  fake.onQuery('job.earlierOptions', () => ({ ok: true, data: reply }))
  fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J9' } }))
  await renderApp(
    <main>
      <EarlierOptions projectId={P} layer={opts.layer ?? LAYER} />
    </main>,
    fake,
  )
  return {
    fake,
    setReply: (next: Reply) => {
      reply = next
    },
    reads: () => fake.queries.filter((q) => q.name === 'job.earlierOptions').length,
  }
}

const blocks = () => screen.getAllByRole('listitem').filter((li) => li.dataset.run !== undefined)

describe('EarlierOptions [spec/screens-ai.md "Earlier options"; FR-248, FR-216]', () => {
  it('reads job.earlierOptions for the layer and lists the runs newest first', async () => {
    const { fake } = await open()
    expect(await screen.findByText(`${at(LATE)} · Google Gemini · Pictures`)).toBeVisible()
    expect(fake.queries.find((q) => q.name === 'job.earlierOptions')?.input).toEqual({
      projectId: P,
      layerId: LAYER.id,
    })
    expect(blocks().map((b) => b.dataset.run)).toEqual(['J2', 'J1'])
    expect(screen.getByRole('region', { name: 'Earlier options' })).toBeVisible()
  })

  it.each([
    ['queued', {}, 'Waiting'],
    ['running', { progress: 0.4 }, 'Working 40%'],
    ['cancelled', {}, 'Cancelled'],
    ['failed', { errorKind: 'quota' as const }, 'Failed'],
  ] as const)('shows the status of a %s run', async (status, over, text) => {
    await open({ reply: [run('J1', { status, ...over })] })
    expect(await screen.findByText(text)).toBeVisible()
  })

  it('says a cut-out run is a cut-out, and an agent run is an agent’s', async () => {
    const cut = run('J1', {
      kind: 'cutout',
      status: 'succeeded',
      startedBy: 'agent',
      createdAt: LATE,
    })
    await open({ reply: [cut] })
    expect(await screen.findByText(`${at(LATE)} · Google Gemini · Cut-out`)).toBeVisible()
    expect(screen.getByText('Started by an agent')).toBeVisible()
  })

  it('marks the layer’s own picture "In use"', async () => {
    await open()
    const used = await screen.findByRole('button', { name: `Use option 2 from ${at(EARLY)}` })
    expect(used).toHaveAttribute('aria-pressed', 'true')
    expect(within(used).getByText('In use')).toBeVisible()
    const other = screen.getByRole('button', { name: `Use option 1 from ${at(LATE)}` })
    expect(other).toHaveAttribute('aria-pressed', 'false')
  })

  it('Use sends one layer.update with the source and no crop, and no generation command', async () => {
    const { fake } = await open()
    await userEvent.click(
      await screen.findByRole('button', { name: `Use option 1 from ${at(LATE)}` }),
    )
    expect(sent(fake, 'layer.update').map((c) => c.input)).toEqual([
      {
        projectId: P,
        layerId: LAYER.id,
        patch: { source: { assetId: 'A3' }, geometry: { crop: null } },
      },
    ])
    expect(fake.commands.filter((c) => c.name.startsWith('generation.'))).toEqual([])
  })

  it('disables a missing file with "file not found"', async () => {
    await open({
      reply: [run('J1', { status: 'succeeded', createdAt: LATE }, [asset('A9', true)])],
    })
    const button = await screen.findByRole('button', { name: `Use option 1 from ${at(LATE)}` })
    expect(button).toBeDisabled()
    expect(within(button).getByText('file not found')).toBeVisible()
  })

  it('disables Use on a locked layer', async () => {
    await open({ layer: { ...LAYER, locked: true } })
    expect(
      await screen.findByRole('button', { name: `Use option 1 from ${at(LATE)}` }),
    ).toBeDisabled()
  })

  it('says so when the layer has no earlier runs', async () => {
    await open({ reply: [] })
    expect(await screen.findByText('No earlier options for this layer.')).toBeVisible()
  })
})

describe('EarlierOptions: looked at and read again [FR-218]', () => {
  it('sends job.markSeen once for each succeeded run not yet looked at', async () => {
    const reply = [
      run('J3', { status: 'succeeded', createdAt: LATE }, [asset('A5')]),
      run('J2', { status: 'failed', createdAt: LATE }),
      run('J1', { status: 'succeeded', createdAt: EARLY, seenAt: EARLY }, [asset('A1')]),
    ]
    const { fake } = await open({ reply })
    await waitFor(() => expect(sent(fake, 'job.markSeen')).toHaveLength(1))
    expect(sent(fake, 'job.markSeen')[0]?.input).toEqual({ projectId: P, jobIds: ['J3'] })
    act(() => fake.emit('job.updated', reply[1]!.job))
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'job.earlierOptions')).toHaveLength(2),
    )
    expect(sent(fake, 'job.markSeen')).toHaveLength(1)
  })

  it.each([
    ['one of its jobs', jobRow('J1', { layerId: null, slot: null, status: 'failed' }), 2],
    ['a job naming this layer', jobRow('J7', { layerId: LAYER.id, slot: null }), 2],
    ['a job of another layer', jobRow('J8', { layerId: 'L9', slot: null }), 1],
  ])('reads again on a job.updated for %s', async (_name, row, count) => {
    const { fake, reads } = await open()
    await screen.findByText(`${at(LATE)} · Google Gemini · Pictures`)
    act(() => fake.emit('job.updated', row))
    await waitFor(() => expect(reads()).toBe(count))
    await new Promise((r) => setTimeout(r, 20))
    expect(reads()).toBe(count)
  })

  it('reads again on a project.changed naming an asset it shows', async () => {
    const { fake, reads } = await open()
    await screen.findByText(`${at(LATE)} · Google Gemini · Pictures`)
    act(() =>
      fake.emit('project.changed', {
        projectId: P,
        changed: { asset: [{ id: 'Z' }] },
        removed: {},
        actor: 'user',
      }),
    )
    act(() =>
      fake.emit('project.changed', {
        projectId: P,
        changed: {},
        removed: { asset: ['A3'] },
        actor: 'user',
      }),
    )
    await waitFor(() => expect(reads()).toBe(2))
  })

  it('shows ten runs, then the rest under "Show more"', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      run(`J${i}`, { status: 'cancelled', createdAt: LATE }),
    )
    await open({ reply: many })
    await screen.findAllByText('Cancelled')
    expect(blocks()).toHaveLength(10)
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(blocks()).toHaveLength(12)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })
})

describe('EarlierOptions: a failed run [FR-069]', () => {
  const failed = (provider: string) =>
    run('J1', {
      status: 'failed',
      provider,
      errorKind: 'quota',
      createdAt: LATE,
      request: { prompt: 'A can', referenceAssetIds: ['R1'], count: 4, width: 200, height: 120 },
      result: { assetIds: ['A1'] },
    })

  it('shows the sentence, and Retry for a paid provider goes through the run dialog', async () => {
    const { fake } = await open({ reply: [failed('gemini')] })
    expect(await screen.findByText(plainMessage('quota', 'Google Gemini'))).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const dialog = await screen.findByRole('dialog', { name: 'Retry the run' })
    expect(within(dialog).getByText('Pictures: 3')).toBeVisible()
    expect(sent(fake, 'job.retry')).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it('retries a local provider at once', async () => {
    const { fake } = await open({ reply: [failed('fake')], local: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it('has no axe violations', async () => {
    await open({
      reply: [
        failed('gemini'),
        ...TWO_RUNS,
        run('J5', { status: 'succeeded' }, [asset('A9', true)]),
      ],
    })
    await screen.findByText(plainMessage('quota', 'Google Gemini'))
    expect(await axeViolations()).toEqual([])
  })
})
