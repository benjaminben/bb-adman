// P10-3 (A-234): a core with a stand-in drawScene and MCP on, over one project whose variant
// draws three pictures and a font: one linked from a folder outside the project's folder, one
// linked inside it, one managed in the assets folder. Rows are written straight to the file,
// so no change event starts a thumbnail draw. Not a test file.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'
import { createCore, type Core } from '@/main/core'
import type { BusEvent } from '@/main/commands/bus'
import type { DrawScene } from '@/main/thumbnails/types'
import { greyPng } from '@/main/providers/fake/png'
import { fakeCrypto, data } from '../core-fixture'
import { insertCampaign } from '../row-fixtures'
import { freePort } from './http-client'

export const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
export const VARIANT = '01JD0000000000000000000V01'
export const OUTSIDE = '01JD0000000000000000000A01'
export const INSIDE = '01JD0000000000000000000A02'
export const MANAGED = '01JD0000000000000000000A03'
export const FONT = '01JD0000000000000000000A04'
// Made-up names and hashes no reply, error or log line may hold.
export const HIDDEN_WORDS = ['far-away-made-up', 'made-up-hash', 'near-made-up', 'brand-made-up']
const FONT_FILE = path.resolve('src/shared/scene/fonts/InterVariable.woff2')

const REVS = JSON.stringify({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
const GEOMETRY = JSON.stringify({ x: 0, y: 0, width: 100, height: 100, rotation: 0, crop: null })
const BLOCK = { preset: 'none', startMs: 0, durationMs: 0 }
const ANIMATION = JSON.stringify({ entrance: BLOCK, exit: BLOCK })
const TIMING = JSON.stringify({ startMs: 0, endMs: null })
const TEXT = JSON.stringify({
  fontAssetId: FONT,
  fontSize: 40,
  fontWeight: 400,
  color: '#000000',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
})

export type RenderSetUp = {
  core: Core
  root: string
  userData: string
  tmp: string
  projectDir: string
  assetsDir: string
  outsideDir: string
  outsideFile: string
  projectId: string
  port: number
  events: BusEvent[]
  draw: ReturnType<typeof vi.fn<DrawScene>>
  readLogs: () => string
  cleanup: () => void
}

type Picture = { id: string; storage: string; name: string; file: string; projectFile: string }

function insertPicture(set: RenderSetUp, p: Picture, kind = 'image', mime = 'image/png'): void {
  const db = set.core.projects.requireOpen(set.projectId).db
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, width, height, created_at)
     VALUES (?, 'asset', ?, 'imported', ?, ?, ?, ?, ?, 10, 1, ?, ?, ?, 'x')`,
  ).run(
    p.id,
    kind,
    p.storage,
    p.name,
    p.file,
    path.relative(path.dirname(p.projectFile), p.file),
    mime,
    `made-up-hash-${p.id}`,
    kind === 'image' ? 8 : null,
    kind === 'image' ? 8 : null,
  )
}

function insertLayer(set: RenderSetUp, id: string, type: string, z: number, assetId?: string) {
  const db = set.core.projects.requireOpen(set.projectId).db
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs, overflow)
     VALUES (?, ?, ?, ?, NULL, 'L', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    VARIANT,
    id,
    type,
    z,
    type === 'text' ? 'Hello' : null,
    type === 'text' ? TEXT : '{"opacity":1}',
    GEOMETRY,
    assetId ? JSON.stringify({ assetId }) : null,
    TIMING,
    ANIMATION,
    REVS,
    REVS,
  )
}

function seed(set: RenderSetUp): void {
  const project = set.core.projects.requireOpen(set.projectId)
  const db = project.db
  insertCampaign(db, 'c1')
  db.exec(`
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
      VALUES ('d1', 'c1', 'D', '${VARIANT}', 0);
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('${VARIANT}', 'd1', 'Master', 1080, 1350, '4:5', 'en', 'image', 0, 'user', 'x');
  `)
  const grey = greyPng(8, 8)
  const near = path.join(set.projectDir, 'near-made-up.png')
  const managed = path.join(set.assetsDir, `${MANAGED}.png`)
  const font = path.join(set.projectDir, 'brand-made-up.woff2')
  fs.writeFileSync(set.outsideFile, grey)
  fs.writeFileSync(near, grey)
  fs.writeFileSync(managed, grey)
  fs.copyFileSync(FONT_FILE, font)
  const projectFile = project.filePath
  const pictures: Picture[] = [
    { id: OUTSIDE, storage: 'linked', name: 'far-away-made-up.png', file: set.outsideFile },
    { id: INSIDE, storage: 'linked', name: 'near-made-up.png', file: near },
    { id: MANAGED, storage: 'managed', name: 'managed.png', file: managed },
  ].map((p) => ({ ...p, projectFile }))
  for (const p of pictures) insertPicture(set, p)
  const fontRow = { id: FONT, storage: 'linked', name: 'brand-made-up.woff2', file: font }
  insertPicture(set, { ...fontRow, projectFile }, 'font', 'font/woff2')
  insertLayer(set, 'p-out', 'image', 1, OUTSIDE)
  insertLayer(set, 'p-in', 'image', 2, INSIDE)
  insertLayer(set, 'p-man', 'image', 3, MANAGED)
  insertLayer(set, 't1', 'text', 4)
}

// opts.draw stands in for the render window; the default gives PNG with no overflow.
export async function renderSetUp(opts: { draw?: DrawScene } = {}): Promise<RenderSetUp> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-render-agent-')))
  const userData = path.join(root, 'userData')
  const documents = path.join(root, 'Documents')
  const work = path.join(root, 'work')
  const tmp = path.join(root, 'tmp')
  const outsideDir = path.join(root, 'elsewhere')
  for (const dir of [documents, work, tmp, outsideDir]) fs.mkdirSync(dir, { recursive: true })
  const events: BusEvent[] = []
  const draw = vi.fn<DrawScene>(opts.draw ?? (async () => ({ png: PNG, overflow: {} })))
  const core = createCore({
    userDataDir: userData,
    documentsDir: documents,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    emit: (e) => events.push(e),
    askPermission: async () => false,
    drawScene: draw,
  })
  const user = (name: string, input: unknown) => core.bus.execute(name, input, { actor: 'user' })
  const port = await freePort()
  data(await user('settings.update', { mcp: { port } }))
  const { projectId } = data<{ projectId: string }>(
    await user('project.create', { name: 'Agent picture', location: work }),
  )
  const project = core.projects.requireOpen(projectId)
  const assetsDir = core.deps.assets.assetsDir(project)
  fs.mkdirSync(assetsDir, { recursive: true })
  const set: RenderSetUp = {
    core,
    root,
    userData,
    tmp,
    projectDir: path.dirname(project.filePath),
    assetsDir,
    outsideDir,
    outsideFile: path.join(outsideDir, 'far-away-made-up.png'),
    projectId,
    port,
    events,
    draw,
    readLogs: () => {
      const dir = path.join(userData, 'logs')
      if (!fs.existsSync(dir)) return ''
      return fs
        .readdirSync(dir)
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
        .join('')
    },
    cleanup: () => {
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
  seed(set)
  return set
}
