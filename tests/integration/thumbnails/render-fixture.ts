// Test helper for slice P3-7: a real core and project file, with the render service built over
// a stand-in draw and a stand-in bus. Not a test file itself.
import path from 'node:path'
import { vi } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { insertCampaign } from '../row-fixtures'
import { createRenderService } from '@/main/thumbnails/service'
import { renderQueries } from '@/main/queries/render'
import type { BusEvent, CommandBus } from '@/main/commands/bus'
import type { DrawScene } from '@/main/thumbnails/types'
import type { ProjectHandle } from '@/main/db/project-file'
import type { Actor } from '@/shared/schemas/events'

export const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
export const V1 = 'v23456' // 1080 x 1350: text layer t1, picture layer p1 (asset img1)
export const V2 = 'w23456' // 1080 x 1080: text layer t2 with font asset font1

const REVS = JSON.stringify({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
const GEOMETRY = JSON.stringify({ x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null })
const BLOCK = { preset: 'none', startMs: 0, durationMs: 0 }
const ANIMATION = JSON.stringify({ entrance: BLOCK, exit: BLOCK })
const TIMING = JSON.stringify({ startMs: 0, endMs: null })
const TEXT = (font: string | null) =>
  JSON.stringify({
    fontAssetId: font,
    fontSize: 40,
    fontWeight: 400,
    color: '#000000',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  })

function seed(project: ProjectHandle): void {
  const db = project.db
  insertCampaign(db, 'c1')
  db.exec(`
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
      VALUES ('d1', 'c1', 'D', '${V1}', 0);
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('${V1}', 'd1', 'Master', 1080, 1350, '4:5', 'en', 'image', 0, 'user', 'x'),
             ('${V2}', 'd1', 'Other', 1080, 1080, '1:1', 'en', 'image', 0, 'user', 'x');
  `)
  const asset = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, width, height, created_at)
     VALUES (?, 'asset', ?, 'imported', 'linked', ?, '/nowhere/x', 'x', ?, 10, 1, 'h', ?, ?, 'x')`,
  )
  asset.run('img1', 'image', 'img1.png', 'image/png', 640, 480)
  asset.run('font1', 'font', 'font1.ttf', 'font/ttf', null, null)
  const layer = db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs, overflow)
     VALUES (?, ?, ?, ?, NULL, 'L', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const rest = [GEOMETRY]
  layer.run(
    't1',
    V1,
    't1',
    'text',
    2,
    'Hello',
    TEXT(null),
    ...rest,
    null,
    TIMING,
    ANIMATION,
    REVS,
    REVS,
    0,
  )
  layer.run(
    'p1',
    V1,
    'p1',
    'image',
    1,
    null,
    '{"opacity":1}',
    ...rest,
    '{"assetId":"img1"}',
    TIMING,
    ANIMATION,
    REVS,
    REVS,
    0,
  )
  layer.run(
    't2',
    V2,
    't2',
    'text',
    1,
    'Hi',
    TEXT('font1'),
    ...rest,
    null,
    TIMING,
    ANIMATION,
    REVS,
    REVS,
    1,
  )
}

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected a value.')
  return value
}

export type RenderFixture = Awaited<ReturnType<typeof makeRenderFixture>>

export async function makeRenderFixture(opts: { draw?: DrawScene } = {}) {
  const f: Fixture = makeFixture()
  const { projectId } = data<{ projectId: string }>(
    await f.user('project.create', { name: 'A', location: f.projectsDir }),
  )
  const project = f.core.projects.requireOpen(projectId)
  seed(project)
  const events: BusEvent[] = []
  const draw = vi.fn<DrawScene>(opts.draw ?? (async () => ({ png: PNG, overflow: {} })))
  const execute = vi.fn<CommandBus['execute']>(async () => ({ ok: true, data: { applied: true } }))
  const service = createRenderService({
    deps: () => f.core.deps,
    bus: () => ({ execute }),
    emit: (e) => events.push(e),
    draw,
  })
  const queries = renderQueries({ ...f.core.deps, render: service })
  return {
    f,
    projectId,
    project,
    events,
    draw,
    execute,
    service,
    dir: path.join(f.userData, 'thumbnails', projectId),
    query: (name: string, input: Record<string, unknown>, actor: Actor = 'user') =>
      Promise.resolve(present(queries[name])({ projectId, ...input }, { actor })),
    drawCall: (i: number) => present(draw.mock.calls[i]),
    setRev: (variantId: string, rev: number) =>
      project.db.prepare('UPDATE variant SET rev = ? WHERE id = ?').run(rev, variantId),
    changed: (variantId: string): BusEvent[] =>
      events.filter((e) => e.name === 'thumbnail.changed' && e.payload.variantId === variantId),
  }
}
