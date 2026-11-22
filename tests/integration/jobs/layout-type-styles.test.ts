// R2E-3 (spec/phases/round-2-editor.md D3): a project with no font of its own offers the five
// built-in type styles to the layout call, and the fake provider's answer gives the headline
// `bold` and every other text `regular`. A project with one font offers none. Through the real
// core with the fake provider only: no network call.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createCore, type Core } from '@/main/core'
import { readWireRow } from '@/main/db/rows'
import type Database from 'better-sqlite3'
import { fakeLayout } from '@/main/providers/fake/layout'
import { typeStylePrompt } from '@/shared/config/type-styles'
import type { JobRow } from '@/shared/schemas/rows/job'
import { fakeCrypto, data } from '../core-fixture'
import { seed, TEXT_LAYER, VARIANT, waitFor } from '../generation/generation-fixture'

const PICTURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])

let root = ''
let core: Core | null = null

afterEach(() => {
  core?.closeAll()
  fs.rmSync(root, { recursive: true, force: true })
})

function addFont(db: Database.Database) {
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES ('a-font', 'asset', 'font', 'imported', 'linked', 'Grotesk.woff2', '/x.woff2',
      'x.woff2', 'font/woff2', 1, 1, 'h', '2026-01-01T00:00:00.000Z')`,
  ).run()
}

async function runLayout(withFont: boolean) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-type-styles-'))
  core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: () => undefined,
    askPermission: async () => false,
    drawScene: async () => ({ png: PICTURE, overflow: {} }),
  })
  const c = core
  const created = await c.bus.execute(
    'project.create',
    { name: 'P', location: root },
    {
      actor: 'user',
    },
  )
  const projectId = data<{ projectId: string }>(created).projectId
  const project = c.projects.requireOpen(projectId)
  seed(project.db)
  project.db.prepare(`UPDATE layer SET key = 'headline' WHERE id = ?`).run(TEXT_LAYER)
  project.db.exec(`
    INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
    SELECT 'l-cta', variant_id, 'cta', type, 'cta', 'CTA', z + 1, 'Book a table', style,
      geometry, source, timing, animation, revs, synced_revs FROM layer WHERE id = '${TEXT_LAYER}';
  `)
  if (withFont) addFont(project.db)
  const started = await c.bus.execute(
    'generation.proposeLayout',
    { projectId, variantId: VARIANT, provider: 'fake' },
    { actor: 'user' },
  )
  const jobId = data<{ jobId: string }>(started).jobId
  const job = () => readWireRow(project.db, 'job', { id: jobId }) as JobRow
  await waitFor(() => job().status === 'succeeded' || job().status === 'failed')
  return job()
}

const boxesOf = (job: JobRow) => (job.result as { boxes: Array<Record<string, unknown>> }).boxes

describe('layout_proposal offers type styles when the project has no font [R2E-3, D3]', () => {
  it('offers the styles, and keeps the fake answer: bold headline, regular for the rest', async () => {
    const job = await runLayout(false)
    expect(job.status).toBe('succeeded')
    const styles = boxesOf(job).map((b) => [b.slot, b.typeStyle])
    expect(styles).toEqual([
      ['headline', 'bold'],
      ['cta', 'regular'],
    ])
  })

  it('offers no styles to a project that has a font of its own, and keeps none', async () => {
    const job = await runLayout(true)
    expect(job.status).toBe('succeeded')
    for (const box of boxesOf(job)) expect(box).not.toHaveProperty('typeStyle')
  })

  it('never puts a font asset ID in a box', async () => {
    const job = await runLayout(false)
    for (const box of boxesOf(job)) expect(box).not.toHaveProperty('fontAssetId')
  })
})

describe('the fake layout with type styles [R2E-3, D3]', () => {
  const input = {
    background: { bytes: PICTURE, mime: 'image/png' },
    width: 1080,
    height: 1350,
    items: [
      { slot: 'headline', text: 'Autumn market' },
      { slot: 'cta', text: 'Book a table' },
    ],
    palette: [],
    fonts: ['Inter'],
  }

  it('gives bold to the headline and regular to the rest only when styles are offered', async () => {
    const styled = await fakeLayout().propose({ ...input, typeStyles: typeStylePrompt() })
    expect(styled.map((b) => b.typeStyle)).toEqual(['bold', 'regular'])
    const plain = await fakeLayout().propose(input)
    for (const box of plain) expect(box).not.toHaveProperty('typeStyle')
  })
})
