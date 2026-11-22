// P10-4 (security class full): create_layer, update_layer, update_layers, delete_layer and
// reorder_layers over the real HTTP door and the real core (spec/phases/phase-10-slices.md,
// P10-4; A-233). Each runs its layer command as the agent; the user can undo each.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { stopAndClean } from './mcp-fixture'
import { replyJson } from './tool-client'
import {
  layerOf,
  layerSetUp,
  makeProject,
  PICTURE,
  PLANTED_PATH,
  REFERENCE,
  refusalOf,
  riskyKeys,
  type LayerSetUp,
} from './layer-tools-fixture'
import { camel, cases, plainAll } from './layer-tools-cases'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { LAYER_TOOLS } from '@/main/mcp/tools/layer-tools'
import { LEAVE_THE_CHOICE } from '@/main/mcp/tools/tool-words'

let r: LayerSetUp | undefined
afterEach(async () => {
  await stopAndClean(r?.fx)
  r = undefined
})

// Every recorded reply, success and refusal, for the key and word tests.
const recorded: string[] = []

// A refusal the SDK gives for a bad input is plain text, not JSON.
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function call(x: LayerSetUp, tool: string, args: Record<string, unknown>) {
  const reply = await x.s.call(tool, args)
  recorded.push(JSON.stringify(reply))
  return reply
}

describe('the layer tools [P10-4; A-233; FR-239]', () => {
  it('reach only the five layer commands, each with its allow row, and the source tools carry the tool words', () => {
    expect(
      LAYER_TOOLS.map((t) => [t.name, t.kind, t.target, AGENT_POLICY[t.target]?.policy]),
    ).toEqual([
      ['create_layer', 'command', 'layer.create', 'allow'],
      ['update_layer', 'command', 'layer.update', 'allow'],
      ['update_layers', 'command', 'layer.updateMany', 'allow'],
      ['delete_layer', 'command', 'layer.delete', 'allow'],
      ['reorder_layers', 'command', 'layer.reorder', 'allow'],
    ])
    const words = LAYER_TOOLS.filter((t) => t.description.includes(LEAVE_THE_CHOICE))
    expect(words.map((t) => t.name)).toEqual(['create_layer', 'update_layer', 'update_layers'])
  })

  it.each(['create_layer', 'update_layer', 'update_layers', 'delete_layer', 'reorder_layers'])(
    '%s: runs its command as the agent, stamps the variant, and the user can undo it',
    async (tool) => {
      r = await layerSetUp()
      const x = r
      const c = cases(x).find((k) => k.tool === tool)
      if (!c) throw new Error(tool)
      const before = plainAll(x.layers(c.variantId))
      expect(x.variant(c.variantId).agentChangedAt).toBeNull()
      const sent = x.fx.events.length
      const reply = await call(x, c.tool, c.args)
      expect(reply.isError).toBeFalsy()
      const agentReply = replyJson<Record<string, unknown>>(reply)
      const byAgent = plainAll(x.layers(c.variantId))
      expect(byAgent).not.toEqual(before)
      expect(x.variant(c.variantId).agentChangedAt).not.toBeNull()
      const changed = x.fx.events.slice(sent).filter((e) => e.name === 'project.changed')
      expect(changed.length).toBeGreaterThan(0)
      for (const e of changed) expect(e.payload).toMatchObject({ actor: 'agent' })
      // The edit is on the user's undo list for the variant.
      const scope = `variant:${c.variantId}`
      data(await x.fx.user('history.undo', { projectId: x.projectId, scope }))
      expect(plainAll(x.layers(c.variantId))).toEqual(before)
      // The same command sent by the user does the same, apart from the actor.
      const byUser = data<Record<string, unknown>>(await x.fx.user(c.command, camel(c.args)))
      expect(plainAll(x.layers(c.variantId))).toEqual(byAgent)
      expect(Object.keys(agentReply)).toEqual(Object.keys(byUser))
      if (tool !== 'create_layer') expect(agentReply).toEqual(byUser)
    },
  )

  it('gives each refusal as the command gives it to the agent, and writes nothing', async () => {
    r = await layerSetUp()
    const x = r
    const p = x.projectId
    const v = x.variantId
    const text = layerOf(x, v, 'text')
    const image = { project_id: p, variant_id: v, type: 'image' }
    const table: Array<[string, string, Record<string, unknown>]> = [
      ['update_layer', 'layer.update', { project_id: p, layer_id: 'x', patch: { copy: 'A' } }],
      ['create_layer', 'layer.create', { ...image, values: { source: { assetId: PLANTED_PATH } } }],
      ['create_layer', 'layer.create', { ...image, values: { source: { assetId: REFERENCE } } }],
      ['create_layer', 'layer.create', { ...image, variant_id: 'x' }],
      [
        'update_layers',
        'layer.updateMany',
        { project_id: p, variant_id: v, updates: [{ layerId: 'x', patch: { copy: 'A' } }] },
      ],
      ['delete_layer', 'layer.delete', { project_id: p, layer_id: layerOf(x, v, 'background').id }],
      ['reorder_layers', 'layer.reorder', { project_id: p, variant_id: v, layer_ids: [text.id] }],
    ]
    const before = x.layers(v)
    for (const [tool, command, args] of table) {
      const reply = await call(x, tool, args)
      expect(reply.isError, `${tool} ${JSON.stringify(args)}`).toBe(true)
      const own = await x.fx.agent(command, camel(args))
      expect(own.ok).toBe(false)
      expect(refusalOf(reply)).toEqual(own.error)
    }
    expect(x.layers(v)).toEqual(before)
    expect(x.variant(v).agentChangedAt).toBeNull()
  })

  it('takes a source only as an asset ID: a path or any other key is refused', async () => {
    r = await layerSetUp()
    const x = r
    const p = x.projectId
    const v = x.variantId
    const text = layerOf(x, v, 'text')
    const bad: Array<[string, Record<string, unknown>]> = [
      [
        'update_layer',
        { project_id: p, layer_id: text.id, patch: { source: { path: PLANTED_PATH } } },
      ],
      [
        'update_layer',
        { project_id: p, layer_id: text.id, patch: { source: { assetId: PICTURE, path: '/x' } } },
      ],
      ['create_layer', { project_id: p, variant_id: v, type: 'image', values: { absPath: '/x' } }],
    ]
    const before = x.layers(v)
    for (const [tool, args] of bad) {
      expect((await call(x, tool, args)).isError, JSON.stringify(args)).toBe(true)
    }
    expect(x.layers(v)).toEqual(before)
  })

  it('refuses a layer in a closed project or in another project with NOT_FOUND', async () => {
    r = await layerSetUp()
    const x = r
    const other = await makeProject(x.fx, 'Other')
    const otherText = layerOf(x, x.variantId, 'text')
    const theirs = x.fx.core.projects
      .requireOpen(other.projectId)
      .db.prepare(`SELECT id FROM layer WHERE type = 'text' LIMIT 1`)
      .get() as { id: string }
    const across = await call(x, 'update_layer', {
      project_id: x.projectId,
      layer_id: theirs.id,
      patch: { copy: 'Not yours' },
    })
    expect(refusalOf(across).code).toBe('NOT_FOUND')
    data(await x.fx.user('project.close', { projectId: x.projectId }))
    const closed = await call(x, 'update_layer', {
      project_id: x.projectId,
      layer_id: otherText.id,
      patch: { copy: 'Closed' },
    })
    expect(refusalOf(closed).code).toBe('NOT_FOUND')
    const left = x.fx.core.projects
      .requireOpen(other.projectId)
      .db.prepare('SELECT copy FROM layer WHERE id = ?')
      .get(theirs.id) as { copy: string }
    expect(left.copy).not.toBe('Not yours')
  })

  it('never leaves a translation approved: a copy edit makes it proposed, and the status is not a field', async () => {
    r = await layerSetUp()
    const x = r
    const p = x.projectId
    const de = layerOf(x, x.deVariantId, 'text')
    expect(de.translationStatus).not.toBeNull()
    const statusOf = () => x.layers(x.deVariantId).find((l) => l.id === de.id)
    x.setTranslation(de.id, 'approved')
    const one = await call(x, 'update_layer', {
      project_id: p,
      layer_id: de.id,
      patch: { copy: 'Kühl' },
    })
    expect(one.isError).toBeFalsy()
    expect(statusOf()).toMatchObject({ translationStatus: 'proposed', translationSource: 'agent' })
    x.setTranslation(de.id, 'approved')
    const many = await call(x, 'update_layers', {
      project_id: p,
      variant_id: x.deVariantId,
      updates: [{ layerId: de.id, patch: { copy: 'Frisch' } }],
    })
    expect(many.isError).toBeFalsy()
    expect(statusOf()).toMatchObject({ translationStatus: 'proposed', translationSource: 'agent' })
    x.setTranslation(de.id, 'missing')
    const tries: Array<[string, Record<string, unknown>]> = [
      [
        'update_layer',
        { project_id: p, layer_id: de.id, patch: { translationStatus: 'approved' } },
      ],
      [
        'update_layers',
        {
          project_id: p,
          variant_id: x.deVariantId,
          updates: [{ layerId: de.id, patch: { translationStatus: 'approved' } }],
        },
      ],
      [
        'create_layer',
        {
          project_id: p,
          variant_id: x.deVariantId,
          type: 'text',
          values: { translationStatus: 'approved' },
        },
      ],
      ['update_layer', { project_id: p, layer_id: de.id, translation_status: 'approved' }],
    ]
    for (const [tool, args] of tries) {
      expect((await call(x, tool, args)).isError, JSON.stringify(args)).toBe(true)
    }
    expect(statusOf()?.translationStatus).toBe('missing')
    expect(x.layers(x.deVariantId).some((l) => l.translationStatus === 'approved')).toBe(false)
  })

  it('no recorded reply holds a risky key, a path, a hash or a provider word', () => {
    expect(recorded.length).toBeGreaterThan(15)
    const text = recorded.join('\n')
    for (const reply of recorded) {
      const content = (JSON.parse(reply) as { content?: Array<{ text?: string }> }).content ?? []
      for (const item of content) {
        expect(riskyKeys(jsonOf(item.text ?? 'null'))).toEqual([])
      }
    }
    for (const word of [
      PLANTED_PATH,
      'layer-tools-picture',
      'made-up-hash',
      'comfyui',
      'baseUrl',
      'agentRuns',
      '/Users/',
      'adman-asset://',
    ]) {
      expect(text.includes(word), `${word} found in a reply`).toBe(false)
    }
  })
})
