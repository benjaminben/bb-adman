// P10-12 (security class full): set_translation, run_checks and get_check_results over the real
// HTTP door and the real core (spec/phases/phase-10-slices.md, P10-12; A-236). An agent writes
// a translation's text, always proposed and from 'agent'; approving stays the user's act. An
// agent runs the checks, which write the check rows only, and reads them through a picker.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { stopAndClean } from './mcp-fixture'
import { replyJson } from './tool-client'
import {
  layerOf,
  layerSetUp,
  PLANTED_PATH,
  refusalOf,
  riskyKeys,
  type LayerSetUp,
} from './layer-tools-fixture'
import {
  addDeTwin,
  allLayers,
  checkRows,
  deTwins,
  jobCount,
  variantsOf,
} from './translation-check-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { ALL_TOOLS } from '@/main/mcp/tools/table'
import { TRANSLATION_CHECK_TOOLS } from '@/main/mcp/tools/translation-check-tools'

let r: LayerSetUp | undefined
afterEach(async () => {
  await stopAndClean(r?.fx)
  r = undefined
})

// Every recorded reply, success and refusal, for the key and word tests.
const recorded: Array<{ tool: string; text: string }> = []
const MINE = new Set(TRANSLATION_CHECK_TOOLS.map((t) => t.name))

async function call(x: LayerSetUp, tool: string, args: Record<string, unknown>) {
  const reply = await x.s.call(tool, args)
  if (MINE.has(tool)) recorded.push({ tool, text: JSON.stringify(reply) })
  return reply
}

// Every spelling of a status or a source an agent might try, at the top and nested.
const SNEAKED = {
  translation_status: 'approved',
  translationStatus: 'approved',
  status: 'approved',
  translation_source: 'user',
  translationSource: 'user',
  source: 'user',
  approved: true,
  patch: { translationStatus: 'approved', translationSource: 'user' },
  values: { translation_status: 'approved' },
}

const approveAll = (x: LayerSetUp, layers: Array<{ id: string }>) => {
  for (const l of layers) x.setTranslation(l.id, 'approved')
}

const statusOf = (x: LayerSetUp, id: string) => {
  const l = allLayers(x).find((row) => row.id === id)
  return { copy: l?.copy, translationStatus: l?.translationStatus, source: l?.translationSource }
}

describe('set_translation [P10-12; FR-200]', () => {
  it('reaches only translation.set, check.run and check.results, each with its allow row', () => {
    expect(
      TRANSLATION_CHECK_TOOLS.map((t) => [t.name, t.kind, t.target, t.notBuilt ?? false]),
    ).toEqual([
      ['set_translation', 'command', 'translation.set', false],
      ['run_checks', 'command', 'check.run', false],
      ['get_check_results', 'query', 'check.results', false],
    ])
    expect(AGENT_POLICY['translation.set']?.policy).toBe('allow')
    expect(AGENT_POLICY['check.run']?.policy).toBe('allow')
    const kept = ['translation.approve', 'translation.restore', 'translation.propose']
    for (const name of [...kept, 'translation.write']) {
      expect(AGENT_POLICY[name]?.policy, name).toBe('deny')
      expect(
        ALL_TOOLS.filter((t) => t.target === name),
        name,
      ).toEqual([])
    }
  })

  it.each([true, false])(
    'An agent `set_translation` never yields `approved` (apply_to_same_language %s)',
    async (apply) => {
      r = await layerSetUp()
      const x = r
      await addDeTwin(x)
      const named = layerOf(x, x.deVariantId, 'text')
      const twins = deTwins(x, named)
      expect(twins).toHaveLength(1)
      approveAll(x, [named, ...twins])
      const before = twins.map((t) => statusOf(x, t.id))
      const listed = (await x.s.list()).find((t) => t.name === 'set_translation')
      expect(JSON.stringify(listed?.inputSchema)).not.toMatch(/status|source|approv/i)
      const reply = await call(x, 'set_translation', {
        project_id: x.projectId,
        layer_id: named.id,
        text: 'Kühl bleiben',
        apply_to_same_language: apply,
        ...SNEAKED,
      })
      expect(reply.isError).toBeFalsy()
      const written = replyJson<{ layerIds: string[] }>(reply)
      expect(Object.keys(written)).toEqual(['layerIds'])
      expect(written.layerIds[0]).toBe(named.id)
      const proposed = { copy: 'Kühl bleiben', translationStatus: 'proposed', source: 'agent' }
      expect(statusOf(x, named.id)).toEqual(proposed)
      const after = twins.map((t) => statusOf(x, t.id))
      expect(after).toEqual(apply ? twins.map(() => proposed) : before)
      expect(written.layerIds).toHaveLength(apply ? twins.length + 1 : 1)
      const byAgent = allLayers(x).filter((l) => l.translationSource === 'agent')
      expect(byAgent.every((l) => l.translationStatus === 'proposed')).toBe(true)
      // On the variant's undo list, counted by the agent undo guard; the user can undo it.
      const scope = `variant:${x.deVariantId}`
      expect(x.fx.core.undo.agentRun(x.projectId, scope)).toBe(1)
      expect(x.variant(x.deVariantId).agentChangedAt).not.toBeNull()
      data(await x.fx.user('history.undo', { projectId: x.projectId, scope }))
      expect(statusOf(x, named.id)).toMatchObject({ translationStatus: 'approved', source: 'user' })
    },
  )

  it('drops the approval when the agent sends the same text, or edits the copy with update_layer', async () => {
    r = await layerSetUp()
    const x = r
    const named = layerOf(x, x.deVariantId, 'text')
    approveAll(x, [named])
    const same = { project_id: x.projectId, layer_id: named.id, apply_to_same_language: false }
    expect((await call(x, 'set_translation', { ...same, text: named.copy })).isError).toBeFalsy()
    expect(statusOf(x, named.id)).toMatchObject({ translationStatus: 'proposed', source: 'agent' })
    approveAll(x, [named])
    const patch = { copy: 'Frisch', translationStatus: 'approved' }
    const edit = await call(x, 'update_layer', {
      project_id: x.projectId,
      layer_id: named.id,
      patch,
    })
    expect(edit.isError).toBeTruthy()
    const plain = await call(x, 'update_layer', {
      project_id: x.projectId,
      layer_id: named.id,
      patch: { copy: 'Frisch' },
    })
    expect(plain.isError).toBeFalsy()
    expect(statusOf(x, named.id)).toEqual({
      copy: 'Frisch',
      translationStatus: 'proposed',
      source: 'agent',
    })
  })

  it('refuses a layer that is not a translation, an unknown layer and a text that is not a string, writing nothing', async () => {
    r = await layerSetUp()
    const x = r
    const master = layerOf(x, x.variantId, 'text')
    const before = allLayers(x)
    const base = { project_id: x.projectId, text: 'Hallo', apply_to_same_language: false }
    const notOne = refusalOf(await call(x, 'set_translation', { ...base, layer_id: master.id }))
    expect(notOne.code).toBe('RULE_VIOLATION')
    const unknown = refusalOf(await call(x, 'set_translation', { ...base, layer_id: 'x' }))
    expect(unknown.code).toBe('NOT_FOUND')
    const de = layerOf(x, x.deVariantId, 'text')
    const nested = await call(x, 'set_translation', {
      ...base,
      layer_id: de.id,
      text: { copy: 'Hallo', translationStatus: 'approved' },
    })
    expect(nested.isError).toBe(true)
    expect(allLayers(x)).toEqual(before)
  })
})

describe('run_checks and get_check_results [P10-12; A-236]', () => {
  it('runs the checks as the agent, writing only the check rows: no layer, variant, job or undo entry', async () => {
    r = await layerSetUp()
    const x = r
    const campaignId = campaignOf(x)
    const layers = allLayers(x)
    const variants = variantsOf(x)
    const jobs = jobCount(x)
    const undo = variants.map((v) => x.fx.core.undo.state(x.projectId, `variant:${v.id}`))
    const reply = await call(x, 'run_checks', { project_id: x.projectId, campaign_id: campaignId })
    expect(reply.isError).toBeFalsy()
    const ran = replyJson<{ variants: Array<{ variantId: string; checkedRev: number }> }>(reply)
    expect(ran.variants.map((v) => v.variantId).sort()).toEqual(variants.map((v) => v.id).sort())
    expect(checkRows(x).map((row) => row.ranBy)).toEqual(variants.map(() => 'agent'))
    expect(allLayers(x)).toEqual(layers)
    expect(variantsOf(x)).toEqual(variants)
    expect(jobCount(x)).toBe(jobs)
    const scopes = variants.map((v) => `variant:${v.id}` as const)
    expect(scopes.map((s) => x.fx.core.undo.state(x.projectId, s))).toEqual(undo)
    expect(scopes.map((s) => x.fx.core.undo.agentRun(x.projectId, s))).toEqual(scopes.map(() => 0))
    // The top undo entry of the master is still the user's picture layer, not a check.
    const scope = `variant:${x.variantId}`
    data(await x.fx.user('history.undo', { projectId: x.projectId, scope }))
    expect(allLayers(x).some((l) => l.name === 'Bottle')).toBe(false)
    expect(checkRows(x)).toHaveLength(variants.length)
  })

  it('refuses both targets at once, none, and an unknown campaign, writing no check row', async () => {
    r = await layerSetUp()
    const x = r
    const p = x.projectId
    const both = { project_id: p, campaign_id: campaignOf(x), variant_ids: [x.variantId] }
    for (const tool of ['run_checks', 'get_check_results']) {
      expect(refusalOf(await call(x, tool, both)).code, tool).toBe('INVALID_INPUT')
      expect(refusalOf(await call(x, tool, { project_id: p })).code, tool).toBe('INVALID_INPUT')
      const unknown = await call(x, tool, { project_id: p, campaign_id: 'x' })
      expect(refusalOf(unknown).code, tool).toBe('NOT_FOUND')
    }
    expect(checkRows(x)).toEqual([])
  })

  it('gives each variant its latest check and marks a variant changed since as stale', async () => {
    r = await layerSetUp()
    const x = r
    const p = x.projectId
    const campaignId = campaignOf(x)
    const named = layerOf(x, x.deVariantId, 'text')
    // The campaign's own prohibited word for de, in the agent's copy.
    const text = { project_id: p, layer_id: named.id, apply_to_same_language: false }
    expect(
      (await call(x, 'set_translation', { ...text, text: 'Billig und kühl' })).isError,
    ).toBeFalsy()
    const run = await call(x, 'run_checks', { project_id: p, campaign_id: campaignId })
    expect(run.isError).toBeFalsy()
    const edit = { project_id: p, layer_id: layerOf(x, x.variantId, 'text').id }
    expect(
      (await call(x, 'update_layer', { ...edit, patch: { visible: false } })).isError,
    ).toBeFalsy()
    const reply = await call(x, 'get_check_results', { project_id: p, campaign_id: campaignId })
    expect(reply.isError).toBeFalsy()
    type View = {
      variantId: string
      stale: boolean
      ranBy: string
      results: Array<{ checkId: string; status: string; findings: Array<{ message: string }> }>
    }
    const views = replyJson<{ variants: View[] }>(reply).variants
    expect(views.find((v) => v.variantId === x.variantId)?.stale).toBe(true)
    const de = views.find((v) => v.variantId === x.deVariantId)
    expect(de).toMatchObject({ stale: false, ranBy: 'agent' })
    const words = de?.results.find((c) => c.checkId === 'prohibited-words')
    expect(words?.status).toBe('warn')
    expect(words?.findings.map((f) => f.message)).toEqual([`${named.name} contains “billig”.`])
    // get_variant shows the latest check as its badges.
    const got = await call(x, 'get_variant', { project_id: p, variant_id: x.variantId })
    expect(replyJson<{ variant: { badges: unknown } }>(got).variant.badges).toMatchObject({
      checkStale: true,
    })
  })

  it('every recorded reply is free of risky keys, paths, hashes and the project folder', () => {
    expect(recorded.length).toBeGreaterThan(10)
    for (const { text } of recorded) {
      const reply = JSON.parse(text) as { content?: Array<{ text?: string }> }
      const inner = reply.content?.map((c) => jsonOf(c.text ?? '')) ?? []
      expect(riskyKeys(inner), text).toEqual([])
      for (const word of [
        PLANTED_PATH,
        'made-up-hash',
        'layer-tools-picture',
        '/Users/',
        'adman-asset',
      ]) {
        expect(text.includes(word), `${word} in ${text}`).toBe(false)
      }
    }
  })
})

function campaignOf(x: LayerSetUp): string {
  const row = x.fx.core.projects
    .requireOpen(x.projectId)
    .db.prepare('SELECT campaign_id FROM direction LIMIT 1')
    .get() as { campaign_id: string }
  return row.campaign_id
}

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
