// AR-1 (security class): which providers an agent run may be ticked for, the agentRunLimit
// settings value, and the two commands that write the tick and the limit (SPEC agent-runs.md
// "The tick", "Commands for the tick and the limit").
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { listProviders } from '@/main/providers/registry'
import {
  AGENT_MAX_ACTIVE_RUNS,
  AGENT_RUN_LIMIT_MAX,
  AGENT_RUN_LIMIT_MIN,
  agentRunsOffered,
} from '@/shared/config/agent-runs'
import type { AppState } from '@/shared/schemas/queries/app'

let f: Fixture
const made: Fixture[] = []
afterEach(() => {
  while (made.length) made.pop()?.cleanup()
})
const fixture = (): Fixture => {
  const next = makeFixture()
  made.push(next)
  return next
}

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
const row = (id: string) => {
  const info = listProviders({ ADMAN_FAKE_PROVIDERS: '1' }).find((p) => p.id === id)
  if (!info) throw new Error(`no provider ${id}`)
  return info
}

async function writeSettings(extra: Record<string, unknown>): Promise<string> {
  const written = { ...(await state()).settings, generation: { optionsPerRun: 2 }, ...extra }
  fs.mkdirSync(f.userData, { recursive: true })
  const file = path.join(f.userData, 'settings.json')
  fs.writeFileSync(file, JSON.stringify(written))
  f.restart()
  return file
}

describe('agentRunsOffered, the one "tick offered" rule [SPEC agent-runs.md, AR-1]', () => {
  it('gives null for Gemini as registered: paid, offered once the untick check is built (AR-2)', () => {
    expect(agentRunsOffered(row('gemini'))).toBeNull()
  })

  it('gives null for ComfyUI and the fake provider', () => {
    expect(agentRunsOffered(row('comfyui'))).toBeNull()
    expect(agentRunsOffered(row('fake'))).toBeNull()
  })

  it('gives agent_runs_not_offered for S3 and Firefly', () => {
    for (const id of ['s3', 'firefly']) {
      expect(agentRunsOffered(row(id)), id).toBe('agent_runs_not_offered')
    }
  })

  it('gives agent_runs_not_offered for an available provider with no picture or video job', () => {
    expect(agentRunsOffered({ ...row('fake'), jobs: ['text', 'storage'] })).toBe(
      'agent_runs_not_offered',
    )
  })
})

describe('the agentRunLimit settings value [SPEC agent-runs.md, AR-1]', () => {
  it('is a whole number 1 to 16 with default 4', async () => {
    expect([AGENT_RUN_LIMIT_MIN, AGENT_RUN_LIMIT_MAX, AGENT_MAX_ACTIVE_RUNS]).toEqual([1, 16, 4])
    f = fixture()
    expect((await state()).settings.agentRunLimit).toBe(4)
  })

  it.each([99, 0, 2.5, '3'])(
    'loads "agentRunLimit": %s as 4, the other keys as written',
    async (v) => {
      f = fixture()
      await writeSettings({ agentRunLimit: v })
      const s = (await state()).settings
      expect(s.agentRunLimit).toBe(4)
      expect(s.generation.optionsPerRun).toBe(2)
    },
  )

  it('loads a value in range as written', async () => {
    f = fixture()
    await writeSettings({ agentRunLimit: 16 })
    expect((await state()).settings.agentRunLimit).toBe(16)
  })

  it('is refused by settings.update, which changes nothing', async () => {
    f = fixture()
    const before = (await state()).settings
    expect(await f.user('settings.update', { agentRunLimit: 2 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect((await state()).settings).toEqual(before)
  })
})

describe('a hand-edited tick for a provider agentRunsOffered refuses [SPEC agent-runs.md]', () => {
  it('loads with both entries and the other keys kept as written', async () => {
    f = fixture()
    const agentRuns = { 'fal-seedance': { allowed: true }, gemini: { allowed: true } }
    await writeSettings({ agentRuns })
    const s = (await state()).settings
    expect(s.agentRuns).toEqual(agentRuns)
    expect(s.generation.optionsPerRun).toBe(2)
  })
})

describe('agentRuns.setAllowed [SPEC api-commands.md, AR-1]', () => {
  it('sets and clears the tick for ComfyUI, kept after a restart', async () => {
    f = fixture()
    const input = { provider: 'comfyui', allowed: true }
    expect(await f.user('agentRuns.setAllowed', input)).toEqual({ ok: true, data: input })
    expect(f.events.some((e) => e.name === 'app.stateChanged')).toBe(true)
    f.restart()
    expect((await state()).settings.agentRuns).toEqual({ comfyui: { allowed: true } })
    await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: false })
    expect((await state()).settings.agentRuns).toEqual({ comfyui: { allowed: false } })
  })

  it('refuses an unknown provider with INVALID_INPUT and writes nothing', async () => {
    f = fixture()
    for (const provider of ['nope', '__proto__']) {
      expect(await f.user('agentRuns.setAllowed', { provider, allowed: true })).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
    expect((await state()).settings.agentRuns).toEqual({})
  })

  it('refuses a provider agentRunsOffered refuses: RULE_VIOLATION with its reason', async () => {
    f = fixture()
    expect(
      await f.user('agentRuns.setAllowed', { provider: 'firefly', allowed: true }),
    ).toMatchObject({
      ok: false,
      error: {
        message: 'Agents cannot start runs with Adobe Firefly.',
        details: { reason: 'agent_runs_not_offered' },
      },
    })
    expect((await state()).settings.agentRuns).toEqual({})
  })

  it('ticks Gemini, the paid provider (AR-2)', async () => {
    f = fixture()
    const input = { provider: 'gemini', allowed: true }
    expect(await f.user('agentRuns.setAllowed', input)).toEqual({ ok: true, data: input })
    expect((await state()).settings.agentRuns).toEqual({ gemini: { allowed: true } })
  })

  it('always accepts allowed: false, for a refused provider too', async () => {
    f = fixture()
    const input = { provider: 'gemini', allowed: false }
    expect(await f.user('agentRuns.setAllowed', input)).toEqual({ ok: true, data: input })
  })
})

describe('agentRuns.setLimit [SPEC api-commands.md, AR-1]', () => {
  it('sets the limit, kept after a restart', async () => {
    f = fixture()
    expect(await f.user('agentRuns.setLimit', { limit: 2 })).toEqual({
      ok: true,
      data: { limit: 2 },
    })
    expect(f.events.some((e) => e.name === 'app.stateChanged')).toBe(true)
    f.restart()
    expect((await state()).settings.agentRunLimit).toBe(2)
  })

  it.each([0, 17, 2.5])('refuses %s from the user with INVALID_INPUT', async (limit) => {
    f = fixture()
    expect(await f.user('agentRuns.setLimit', { limit })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect((await state()).settings.agentRunLimit).toBe(4)
  })
})

describe('an agent cannot change a tick or the limit [SPEC agent-runs.md "Stays shut"]', () => {
  it.each([
    ['agentRuns.setAllowed', { provider: 'comfyui', allowed: true }],
    ['agentRuns.setLimit', { limit: 16 }],
  ])('%s from the agent is AGENT_DENIED and changes nothing', async (name, input) => {
    f = fixture()
    const before = (await state()).settings
    expect(await f.agent(name, input)).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED', message: expect.stringMatching(/^Agents cannot/) },
    })
    expect((await state()).settings).toEqual(before)
  })
})
