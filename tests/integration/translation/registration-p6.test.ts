// P6-1 (spec/phases/phase-06-slices.md, "P6-1 — Contracts"): every Phase 6 command, query and
// the translation job kind is registered against a stub. The agent rows are final now: the
// system commands and translation.propose are denied (A-169), translation.set, check.run and
// layer.setFonts reach their stubs. A stub refuses before it does anything.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { translationCommands } from '@/main/commands/translation'
import { checkCommands } from '@/main/commands/check'
import { translationQueries } from '@/main/queries/translation'
import { checkQueries } from '@/main/queries/check'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { translationKind } from '@/main/jobs/kinds/translation'
import { ProviderFailure } from '@/main/providers/types'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

// A good input for each command, without projectId.
const INPUTS: Record<string, object> = {
  'translation.propose': { provider: 'fake', variantIds: ['V1'] },
  'translation.set': { layerId: 'L1', text: 'Hallo', applyToSameLanguage: false },
  'translation.approve': { layerIds: ['L1'] },
  'translation.write': { jobId: 'J1', items: [{ key: 'headline', text: 'Hallo' }] },
  'translation.restore': {
    items: [
      {
        layerId: 'L1',
        copy: 'Hallo',
        translationStatus: 'approved',
        translationSource: 'user',
        syncedCopyRev: 0,
      },
    ],
  },
}
const NAMES = Object.keys(INPUTS)
const SYSTEM = ['translation.write', 'translation.restore']
const POLICY: Record<string, string> = {
  'translation.propose': 'deny',
  'translation.set': 'allow',
  'translation.approve': 'deny',
  'translation.write': 'deny',
  'translation.restore': 'deny',
}
const AGENT_REACHES = NAMES.filter((n) => POLICY[n] === 'allow')
const AGENT_DENIED = NAMES.filter((n) => POLICY[n] === 'deny')

const notBuilt = (name: string) => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: `${name} is not built yet.`,
    details: { reason: 'not_built' },
  },
})

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

describe('Phase 6 registration [P6-1]', () => {
  it('registers the translation, check and language-font domains', async () => {
    const { fx } = await open()
    const deps = fx.core.deps
    expect(translationCommands(deps).map((h) => h.name)).toEqual([
      'translation.propose',
      'translation.set',
      'translation.approve',
      'translation.exportSheet',
      'translation.write',
      'translation.restore',
    ])
    expect(checkCommands(deps).map((h) => h.name)).toEqual(['check.run'])
    expect(Object.keys(translationQueries(deps))).toEqual(['translation.forCampaign'])
    expect(Object.keys(checkQueries(deps))).toEqual(['check.results'])
    expect(fx.core.commandNames).toEqual(expect.arrayContaining(NAMES))
    expect(fx.core.queryNames).toEqual(
      expect.arrayContaining(['translation.forCampaign', 'check.results']),
    )
  })

  it.each(NAMES)('%s has its own policy row', (name) => {
    expect(AGENT_POLICY[name]?.policy).toBe(POLICY[name])
  })

  it('has one handler for the translation job kind', () => {
    expect(jobKindHandlers.filter((h) => h.kind === 'translation')).toHaveLength(1)
  })
})

describe('the Phase 6 command stubs [P6-1]', () => {
  it.each(NAMES)('%s as the user refuses not_built and writes nothing', async (name) => {
    const { fx, projectId } = await open()
    const before = fx.events.length
    expect(await fx.user(name, { projectId, ...INPUTS[name] })).toEqual(notBuilt(name))
    expect(fx.events.slice(before)).toEqual([])
  })

  it.each(AGENT_REACHES)('%s as the agent reaches its stub', async (name) => {
    const { fx, projectId } = await open()
    expect(await fx.agent(name, { projectId, ...INPUTS[name] })).toEqual(notBuilt(name))
  })

  it.each(AGENT_DENIED)('%s as the agent is AGENT_DENIED', async (name) => {
    const { fx, projectId } = await open()
    expect(await fx.agent(name, { projectId, ...INPUTS[name] })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(name) },
    })
  })

  it('checks the input before the stub answers', async () => {
    const { fx, projectId } = await open()
    const bad = { projectId, layerId: 'L1', text: 'a'.repeat(5001), applyToSameLanguage: false }
    expect(await fx.user('translation.set', bad)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('marks exactly the two system commands internal', async () => {
    const { fx } = await open()
    for (const name of NAMES) expect(fx.core.isInternal(name), name).toBe(SYSTEM.includes(name))
  })

  it('answers a window that sends a system command as unknown, and runs nothing', async () => {
    const { fx, projectId } = await open()
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    const handlers = new Map<string, Handler>()
    const sent: string[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: (name, input, opts) => {
          sent.push(name)
          return fx.core.bus.execute(name, input, opts)
        },
        query: async () => ok(null),
        isInternal: (name) => fx.core.isInternal(name),
        mayCall: () => true,
      },
    )
    const command = handlers.get(IPC.command)
    for (const name of SYSTEM) {
      expect(await command?.({}, name, { projectId, ...INPUTS[name] })).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: `Unknown command: ${name}` },
      })
    }
    expect(sent).toEqual([])
  })
})

describe('the Phase 6 query stubs [P6-1]', () => {
  async function withCampaign() {
    const { fx, projectId } = await open()
    const made = await fx.user('campaign.create', { projectId, ...createInput() })
    return { fx, projectId, campaignId: data<{ campaignId: string }>(made).campaignId }
  }

  it.each(['user', 'agent'] as const)(
    'check.results answers no variants to the %s',
    async (actor) => {
      const { fx, projectId, campaignId } = await withCampaign()
      const input = { projectId, campaignId }
      expect(await fx.core.query('check.results', input, { actor })).toEqual(ok({ variants: [] }))
    },
  )

  it('check the input first', async () => {
    const { fx, projectId } = await open()
    const both = { projectId, campaignId: 'C1', variantIds: ['V1'] }
    expect(await fx.core.query('check.results', both, { actor: 'user' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('the translation job kind stub [P6-1]', () => {
  it('fails its job as other, with no provider call', async () => {
    const run = translationKind().run({} as never, {} as never)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    await expect(run).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Translate is not built yet' },
    })
  })
})
