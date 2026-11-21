// P5-1 (spec/phases/phase-05-slices.md, A-149): until its slice fills it, each Phase 5 command
// refuses with not_built and writes nothing. The agent rows are final now:
// deny and system rows are AGENT_DENIED, variant.add reaches its stub, variant.delete asks,
// and generation.runFill is refused by the gate until P5-8 opens it.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { generativeFillKind } from '@/main/jobs/kinds/generative-fill'
import { ProviderFailure } from '@/main/providers/types'
import {
  DIRECTION as direction,
  LAYER as layer,
  SNAPSHOT as snapshot,
} from '../../unit/shared/schemas/phase5-rows'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const NOT_BUILT = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'This is not built yet.',
    details: { reason: 'not_built' },
  },
}

// A good input for each stub command, without projectId.
const INPUTS: Record<string, object> = {
  'direction.createFromMaster': { masterVariantId: 'V1', name: 'Bold' },
  'direction.rename': { directionId: 'D1', name: 'Bold' },
  'direction.delete': { directionId: 'D1' },
  'direction.restore': { direction, variants: [snapshot] },
  'variant.fanOut': {
    directionId: 'D1',
    sizes: ['9x16'],
    languages: ['en'],
    formats: ['image'],
    fits: { '9x16': 'scale' },
  },
  'variant.add': { directionId: 'D1', sizeLabel: '9x16', language: 'en', format: 'image' },
  'variant.delete': { variantId: 'V1' },
  'variant.remove': { variantIds: ['V1'] },
  'variant.restore': { snapshots: [snapshot] },
  'variant.restoreLayers': { variants: [{ variantId: 'V1', layers: [layer] }] },
  'layer.clearOverride': { layerId: 'L1', paths: ['style.color'] },
  'layer.revert': { variantId: 'V1', layers: [{ layerId: 'L1', patch: {}, overrides: [] }] },
  'sync.apply': { directionId: 'D1', masterRev: 0, decisions: [] },
  'generation.runFill': { variantId: 'V1', provider: 'fake' },
  'generation.applyFill': { jobId: 'J1' },
}
const NAMES = Object.keys(INPUTS)
const SYSTEM = [
  'direction.restore',
  'variant.remove',
  'variant.restore',
  'variant.restoreLayers',
  'layer.revert',
]
const DENIED = NAMES.filter((n) => AGENT_POLICY[n]?.policy === 'deny')

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

describe('the Phase 5 stubs [P5-1, A-149]', () => {
  it.each(NAMES)('%s as the user refuses not_built and writes nothing', async (name) => {
    const { fx, projectId } = await open()
    const before = fx.events.length
    expect(await fx.user(name, { projectId, ...INPUTS[name] })).toEqual(NOT_BUILT)
    expect(fx.events.slice(before)).toEqual([])
  })

  it('checks the input before the stub answers', async () => {
    const { fx, projectId } = await open()
    const bad = { projectId, directionId: 'D1', name: '' }
    expect(await fx.user('direction.rename', bad)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('sync.preview checks the input, then answers for either actor', async () => {
    const { fx, projectId } = await open()
    const input = { projectId, directionId: 'D1' }
    const notFound = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That direction was not found.' },
    }
    expect(await fx.core.query('sync.preview', input, { actor: 'user' })).toEqual(notFound)
    expect(await fx.core.query('sync.preview', input, { actor: 'agent' })).toEqual(notFound)
    expect(
      await fx.core.query('sync.preview', { ...input, extra: 1 }, { actor: 'user' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('marks exactly the five system commands internal', async () => {
    const { fx } = await open()
    for (const name of NAMES) expect(fx.core.isInternal(name), name).toBe(SYSTEM.includes(name))
  })
})

describe('the Phase 5 agent rows [P5-1, spec/mcp-and-agents.md]', () => {
  it('denies every system command and generation.applyFill', () => {
    for (const name of [...SYSTEM, 'generation.applyFill']) {
      expect(AGENT_POLICY[name]?.policy, name).toBe('deny')
    }
  })

  it.each(DENIED)('%s as the agent is AGENT_DENIED', async (name) => {
    const { fx, projectId } = await open()
    expect(await fx.agent(name, { projectId, ...INPUTS[name] })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(name) },
    })
  })

  it('lets the agent reach the variant.add stub', async () => {
    const { fx, projectId } = await open()
    expect(await fx.agent('variant.add', { projectId, ...INPUTS['variant.add'] })).toEqual(
      NOT_BUILT,
    )
  })

  it('asks before the agent runs variant.delete', async () => {
    const { fx, projectId } = await open()
    expect(await fx.agent('variant.delete', { projectId, variantId: 'V1' })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_REFUSED' },
    })
  })

  it('refuses generation.runFill from the agent at the gate', async () => {
    const { fx, projectId } = await open()
    expect(
      await fx.agent('generation.runFill', { projectId, ...INPUTS['generation.runFill'] }),
    ).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('generation.runFill') },
    })
  })
})

describe('the generative_fill job kind stub [P5-1]', () => {
  it('fails its job as other, with no provider call', async () => {
    const run = generativeFillKind().run({} as never, {} as never)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    await expect(run).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Generative fill is not built yet' },
    })
  })
})
