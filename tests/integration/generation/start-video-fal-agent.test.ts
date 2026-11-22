// P7-15 (security class full): fal.ai Seedance for agents, the key guard, and the key kept out
// of everything the app writes. An agent starts a fal run only when the user ticked fal for
// agents and within the limit, through the existing gate. With no key, a start and a retry ask
// for it and start nothing. Nothing leaves the machine: fal's fetch is a stand-in.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { waitFor, ended, VARIANT } from './generation-fixture'
import { data } from '../core-fixture'
import { agentRunLimitMessage } from '@/main/commands/agent-run-gate'
import { COMPLETED, FAL_KEY, ask, calls, falWorld, startFal, type FalWorld } from './fal-fixture'
import { json } from '../../unit/main/providers/fal-seedance/stand-in'

let w: FalWorld
afterEach(() => {
  w.f.cleanup()
  vi.restoreAllMocks()
})

const RUN_MS = 15_000
const asUser = (name: string, input: Record<string, unknown>) =>
  w.f.core.bus.execute(name, input, { actor: 'user' })
const tick = (allowed: boolean) =>
  asUser('agentRuns.setAllowed', { provider: 'fal-seedance', allowed })

const NOT_TICKED_PREFIX = 'Agents cannot start runs with fal.ai Seedance'

describe('agents and fal.ai Seedance [P7-15, spec/agent-runs.md]', () => {
  it('offers the tick for fal now that it is available', async () => {
    w = await falWorld()
    expect(await tick(true)).toEqual({
      ok: true,
      data: { provider: 'fal-seedance', allowed: true },
    })
  })

  it('refuses an agent start with no tick: AGENT_DENIED, no job, nothing sent', async () => {
    w = await falWorld()
    const r = await startFal(w, {}, 'agent')
    expect(r).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(r)).not.toContain(NOT_TICKED_PREFIX)
    expect(w.f.jobs()).toEqual([])
    expect(w.seen).toEqual([])
  })

  it('starts an agent run once ticked, and refuses the next one over the limit', async () => {
    w = await falWorld()
    data(await tick(true))
    data(await asUser('agentRuns.setLimit', { limit: 1 }))
    const { jobId } = data<{ jobId: string }>(await startFal(w, {}, 'agent'))
    expect(w.f.job(jobId)).toMatchObject({ provider: 'fal-seedance', startedBy: 'agent' })
    expect(await startFal(w, {}, 'agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: agentRunLimitMessage('fal.ai Seedance') },
    })
    expect(w.f.jobs()).toHaveLength(1)
    w.status.now = COMPLETED
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
  }, 30_000)
})

describe('the fal key [P7-15, FR-171]', () => {
  it('a user start with no key asks for it, with no job and nothing sent', async () => {
    w = await falWorld({ key: false })
    expect(await startFal(w)).toEqual({
      ok: false,
      error: {
        code: 'NEEDS_KEY',
        message: 'Add your fal.ai Seedance key to make videos.',
        details: { provider: 'fal-seedance' },
      },
    })
    expect(w.f.jobs()).toEqual([])
    expect(w.seen).toEqual([])
  })

  it('a retry of a fal row, fal available and the key missing, asks for it and starts nothing', async () => {
    w = await falWorld({ key: false })
    w.f.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
           created_at, updated_at)
         VALUES ('j-old', 'video_generation', 'failed', 'fal-seedance', '', ?, 'c1', ?,
           '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(JSON.stringify({ ...ask, width: 1080, height: 1350 }), VARIANT)
    expect(await w.f.user('job.retry', { jobId: 'j-old' })).toMatchObject({
      ok: false,
      error: { code: 'NEEDS_KEY', details: { provider: 'fal-seedance' } },
    })
    expect(w.f.jobs().map((j) => j.id)).toEqual(['j-old'])
    expect(w.seen).toEqual([])
  })

  it('never lands in a row, an event, a log line or a reply, even when fal echoes it', async () => {
    w = await falWorld()
    w.override.now = (s) =>
      json({ detail: `bad key ${s.headers.get('authorization')} ${FAL_KEY}` }, 401)
    const reply = await startFal(w)
    const { jobId } = data<{ jobId: string }>(reply)
    await waitFor(ended(w.f, jobId), RUN_MS)
    expect(w.f.job(jobId)?.status).toBe('failed')
    expect(calls(w, 'POST')).toHaveLength(1)
    const dir = path.join(w.f.root, 'userData')
    const logs = fs
      .readdirSync(dir, { recursive: true })
      .map((p) => path.join(dir, String(p)))
      .filter((p) => fs.statSync(p).isFile())
      .map((p) => fs.readFileSync(p, 'utf8'))
      .join('')
    const text = JSON.stringify([reply, w.f.jobs(), w.f.events]) + logs
    expect(text).not.toContain(FAL_KEY)
  }, 30_000)
})
