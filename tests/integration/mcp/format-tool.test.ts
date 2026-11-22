// P10-13 (security class full): set_variant_format over the real HTTP door and the real core
// (spec/phases/phase-10-slices.md, P10-13; D-025). The agent changes a variant's format both
// ways with no dialog; image to video makes the first clip once, video to image keeps the
// clips; a taken cell is the command's own refusal; the user can undo the change. An agent can
// never remove a clip: the undo-only fields are not part of the tool. get_variant gives the
// clips by IDs, times and placement, never a path.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { stopAndClean } from './mcp-fixture'
import { replyJson } from './tool-client'
import {
  layerOf,
  layerSetUp,
  PICTURE,
  PLANTED_PATH,
  refusalOf,
  riskyKeys,
  type LayerSetUp,
} from './layer-tools-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { FORMAT_TOOLS } from '@/main/mcp/tools/format-tool'
import { readWireRows } from '@/main/db/rows'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'

let r: LayerSetUp | undefined
afterEach(async () => {
  await stopAndClean(r?.fx)
  r = undefined
})

// Every recorded reply, success and refusal, for the key and word tests.
const recorded: string[] = []

// As read-more-tools.test.ts: a direction ID, a badge and a layer's template key are not risky.
const HARMLESS = new Set(['directionId', 'missingFile', 'key'])
const risky = (value: unknown) =>
  riskyKeys(value).filter((at) => !HARMLESS.has(at.split('.').pop() ?? ''))

const CLIP_KEYS = ['id', 'variantId', 'assetId', 'startMs', 'inMs', 'outMs', 'placement', 'soundOn']

// The master variant with the planted picture as its background's source.
async function setUp(): Promise<LayerSetUp> {
  r = await layerSetUp()
  const x = r
  const bg = layerOf(x, x.variantId, 'background')
  data(
    await x.fx.user('layer.update', {
      projectId: x.projectId,
      layerId: bg.id,
      patch: { source: { assetId: PICTURE } },
    }),
  )
  return x
}

const clipsOf = (x: LayerSetUp, variantId: string) =>
  (
    readWireRows(
      x.fx.core.projects.requireOpen(x.projectId).db,
      'background_clip',
    ) as BackgroundClipRow[]
  )
    .filter((c) => c.variantId === variantId)
    .sort((a, b) => a.id.localeCompare(b.id))

async function setFormat(
  x: LayerSetUp,
  format: string,
  extra: Record<string, unknown> = {},
  variantId = x.variantId,
) {
  const reply = await x.s.call('set_variant_format', {
    project_id: x.projectId,
    variant_id: variantId,
    format,
    ...extra,
  })
  recorded.push(JSON.stringify(reply))
  return reply
}

const asked = (x: LayerSetUp, from: number) =>
  x.fx.events.slice(from).filter((e) => e.name === 'agent.permissionRequested')

describe('set_variant_format [P10-13; D-025]', () => {
  it('runs variant.setFormat, whose agent policy is allow', () => {
    expect(
      FORMAT_TOOLS.map((t) => [t.name, t.kind, t.target, AGENT_POLICY[t.target]?.policy]),
    ).toEqual([['set_variant_format', 'command', 'variant.setFormat', 'allow']])
    expect(FORMAT_TOOLS[0]?.notBuilt).toBeUndefined()
  })

  it('changes image to video and back with no dialog; the first clip is made once and kept', async () => {
    const x = await setUp()
    const sent = x.fx.events.length
    const toVideo = await setFormat(x, 'video')
    expect(toVideo.isError).toBeFalsy()
    expect(replyJson(toVideo)).toEqual({ variantId: x.variantId })
    expect(x.variant(x.variantId)).toMatchObject({ format: 'video', firstClipMade: true })
    expect(x.variant(x.variantId).agentChangedAt).not.toBeNull()
    const clips = clipsOf(x, x.variantId)
    expect(clips.map((c) => c.assetId)).toEqual([PICTURE])
    const changed = x.fx.events.slice(sent).filter((e) => e.name === 'project.changed')
    expect(changed.length).toBeGreaterThan(0)
    for (const e of changed) expect(e.payload).toMatchObject({ actor: 'agent' })

    const toImage = await setFormat(x, 'image')
    expect(toImage.isError).toBeFalsy()
    expect(x.variant(x.variantId).format).toBe('image')
    expect(clipsOf(x, x.variantId)).toEqual(clips)
    const again = await setFormat(x, 'video')
    expect(again.isError).toBeFalsy()
    expect(x.variant(x.variantId).format).toBe('video')
    expect(clipsOf(x, x.variantId)).toEqual(clips)
    expect(asked(x, sent)).toEqual([])
  })

  it('refuses a change to a taken cell, both ways, with the command own RULE_VIOLATION', async () => {
    const x = await setUp()
    const de = x.deVariantId
    expect((await setFormat(x, 'video', {}, de)).isError).toBeFalsy()
    const v = x.variant(de)
    const cell = { directionId: v.directionId, sizeLabel: v.sizeLabel, language: v.language }
    const added = await x.fx.user('variant.add', {
      projectId: x.projectId,
      ...cell,
      format: 'image',
    })
    const image = data<{ variantId: string }>(added).variantId
    const table: Array<[string, string, string]> = [
      [image, 'video', 'video_post_exists'],
      [de, 'image', 'image_post_exists'],
    ]
    for (const [variantId, format, reason] of table) {
      const before = x.variant(variantId)
      const sent = x.fx.events.length
      const reply = await setFormat(x, format, {}, variantId)
      expect(reply.isError).toBe(true)
      const input = { projectId: x.projectId, variantId, format }
      const own = await x.fx.agent('variant.setFormat', input)
      if (own.ok) throw new Error('variant.setFormat ran for the agent')
      expect(refusalOf(reply)).toEqual(own.error)
      expect(refusalOf(reply)).toMatchObject({ code: 'RULE_VIOLATION', details: { reason } })
      expect(x.variant(variantId)).toEqual(before)
      expect(x.fx.events.slice(sent).filter((e) => e.name === 'project.changed')).toEqual([])
    }
  })

  it('puts the change on the variant undo list; the user undo brings back image and no clip', async () => {
    const x = await setUp()
    const before = x.variant(x.variantId)
    expect((await setFormat(x, 'video')).isError).toBeFalsy()
    expect(clipsOf(x, x.variantId)).toHaveLength(1)
    const scope = `variant:${x.variantId}`
    data(await x.fx.user('history.undo', { projectId: x.projectId, scope }))
    expect(x.variant(x.variantId)).toMatchObject({ format: 'image', firstClipMade: false })
    expect(clipsOf(x, x.variantId)).toEqual([])
    expect(x.variant(x.variantId).rev).toBeGreaterThan(before.rev)
  })

  it('takes no undo-only field: sending one removes no clip and makes none', async () => {
    const x = await setUp()
    expect((await setFormat(x, 'video')).isError).toBeFalsy()
    const clips = clipsOf(x, x.variantId)
    const clipId = clips[0]?.id
    if (!clipId) throw new Error('no first clip')
    const listed = (await x.s.list()).find((t) => t.name === 'set_variant_format')
    const props = Object.keys((listed?.inputSchema as { properties: object }).properties)
    expect(props.sort()).toEqual(['format', 'project_id', 'variant_id'])
    for (const key of ['undo_clip_id', 'undoClipId']) {
      expect((await setFormat(x, 'image', { [key]: clipId })).isError).toBeFalsy()
      expect(x.variant(x.variantId).format).toBe('image')
      expect(clipsOf(x, x.variantId)).toEqual(clips)
      expect((await setFormat(x, 'video')).isError).toBeFalsy()
    }
    for (const key of ['redo_clip_id', 'redoClipId']) {
      expect((await setFormat(x, 'image')).isError).toBeFalsy()
      expect((await setFormat(x, 'video', { [key]: 'made-up-clip' })).isError).toBeFalsy()
      expect(x.variant(x.variantId).format).toBe('video')
      expect(clipsOf(x, x.variantId)).toEqual(clips)
    }
  })

  it('get_variant gives each clip by its IDs, times and placement, and its asset by ID', async () => {
    const x = await setUp()
    expect((await setFormat(x, 'video')).isError).toBeFalsy()
    // A placed clip, so the placement is checked as well as the null of the first clip.
    const placement = { x: 1, y: 2, width: 3, height: 4, rotation: 5, crop: null }
    x.fx.core.projects
      .requireOpen(x.projectId)
      .db.prepare('UPDATE background_clip SET placement = ? WHERE variant_id = ?')
      .run(JSON.stringify(placement), x.variantId)
    const reply = await x.s.call('get_variant', {
      project_id: x.projectId,
      variant_id: x.variantId,
    })
    recorded.push(JSON.stringify(reply))
    const json = replyJson<{
      clips: Array<Record<string, unknown>>
      assets: Array<{ id: string }>
    }>(reply)
    const [stored] = clipsOf(x, x.variantId)
    expect(json.clips).toHaveLength(1)
    expect(Object.keys(json.clips[0] ?? {})).toEqual(CLIP_KEYS)
    expect(json.clips[0]).toEqual(stored)
    expect(json.clips[0]?.placement).toEqual(placement)
    expect(json.assets.map((a) => a.id)).toContain(PICTURE)
  })

  it('no recorded reply holds a risky key, a path, a hash or a MIME type', () => {
    expect(recorded.length).toBeGreaterThan(10)
    const text = recorded.join('\n')
    for (const reply of recorded) {
      const content = (JSON.parse(reply) as { content?: Array<{ text?: string }> }).content ?? []
      for (const item of content) expect(risky(JSON.parse(item.text ?? 'null'))).toEqual([])
    }
    for (const word of [
      PLANTED_PATH,
      'layer-tools-picture',
      'made-up-hash',
      'image/png',
      '/Users/',
      'adman-asset://',
    ]) {
      expect(text.includes(word), `${word} found in a reply`).toBe(false)
    }
  })
})
