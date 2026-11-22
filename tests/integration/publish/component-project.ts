// P9-7 test helper: a temporary project with one campaign, its variants, layers, clips and asset
// files, written by plain SQL as a hostile project file could hold them. Not a test file itself.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { insertCampaign } from '../row-fixtures'

export const CAMPAIGN = 'summer-sale-ab23cd'

export const BYTES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  mp4: Buffer.from([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), 0, 0, 0, 0]),
  ttf: Buffer.from([0, 1, 0, 0, 0, 0, 0, 0]),
  text: Buffer.from('Just some notes.\n'),
}

const REVS = JSON.stringify({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
const GEOMETRY = JSON.stringify({ x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null })
const BLOCK = { preset: 'none', startMs: 0, durationMs: 0 }
const ANIMATION = JSON.stringify({ entrance: BLOCK, exit: BLOCK })
const TIMING = JSON.stringify({ startMs: 0, endMs: null })
const TEXT_STYLE = {
  fontSize: 40,
  fontWeight: 400,
  color: '#000000',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
}

export type TestAsset = {
  id: string
  file: string | null
  bytes?: Buffer
  kind?: 'image' | 'video' | 'font' | 'text'
  library?: 'asset' | 'reference'
  subjectId?: string
  displayName?: string
  fontPublishAllowed?: boolean
  genRunId?: string
}

export function makeComponentProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-components-'))
  const handle = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  const db = handle.db
  insertCampaign(db, CAMPAIGN)
  insertCampaign(db, 'other-camp-zz2345')
  db.exec(`
    INSERT INTO rule_set (campaign_id, required_asset_ids) VALUES ('${CAMPAIGN}', '[]');
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
      VALUES ('d1', '${CAMPAIGN}', 'D', 'vaaaaa', 0), ('d2', 'other-camp-zz2345', 'D', 'vzzzzz', 0);
  `)
  const variant = db.prepare(
    `INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at) VALUES (?, ?, 'T', 1080, 1080, ?, 'en', 'image', 0,
      'user', 'x')`,
  )
  variant.run('vaaaaa', 'd1', '1080x1080')
  variant.run('vbbbbb', 'd1', '1080x1920')
  variant.run('vccccc', 'd1', '1920x1080')
  variant.run('vzzzzz', 'd2', '1080x1080')

  let layers = 0
  return {
    dir,
    handle,
    db,
    asset(a: TestAsset): string {
      const abs = a.file ? path.join(dir, 'files', a.file) : path.join(dir, 'gone', 'gone.png')
      if (a.file) {
        fs.mkdirSync(path.dirname(abs), { recursive: true })
        fs.writeFileSync(abs, a.bytes ?? BYTES.png)
      }
      db.prepare(
        `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
          rel_path, mime, byte_size, mtime_ms, content_hash, font_publish_allowed, gen_run_id,
          created_at)
         VALUES (?, ?, ?, ?, 'linked', ?, ?, ?, ?, 'image/png', 1, 1, 'h', ?, ?, 'x')`,
      ).run(
        a.id,
        a.library ?? 'asset',
        a.kind ?? 'image',
        a.genRunId ? 'generated' : 'imported',
        a.subjectId ?? null,
        a.displayName ?? `Name ${a.id}`,
        abs,
        path.relative(dir, abs),
        a.fontPublishAllowed ? 1 : 0,
        a.genRunId ?? null,
      )
      return abs
    },
    subject(id: string) {
      db.prepare("INSERT INTO subject (id, name, created_at) VALUES (?, 'S', 'x')").run(id)
    },
    layer(variantId: string, use: { background?: string; image?: string; font?: string }) {
      const id = `layer${++layers}`
      const type = use.background ? 'background' : use.image ? 'image' : 'text'
      const assetId = use.background ?? use.image
      const style =
        type === 'text' ? { ...TEXT_STYLE, fontAssetId: use.font ?? null } : { opacity: 1 }
      db.prepare(
        `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
          timing, animation, revs, synced_revs)
         VALUES (?, ?, ?, ?, NULL, 'L', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        variantId,
        id,
        type,
        layers,
        type === 'text' ? 'Hello' : null,
        JSON.stringify(style),
        GEOMETRY,
        assetId ? JSON.stringify({ assetId }) : null,
        TIMING,
        ANIMATION,
        REVS,
        REVS,
      )
    },
    clip(variantId: string, assetId: string) {
      db.prepare(
        `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms)
         VALUES (?, ?, ?, 0, 0, 1000)`,
      ).run(`clip${++layers}`, variantId, assetId)
    },
    required(ids: string[]) {
      db.prepare('UPDATE rule_set SET required_asset_ids = ? WHERE campaign_id = ?').run(
        JSON.stringify(ids),
        CAMPAIGN,
      )
    },
    cleanup() {
      closeProjectFile(handle)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
