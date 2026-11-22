// P10-2 (spec/phases/phase-10.md, A-235, A-249; security class full): list_subjects and
// get_variant over the real HTTP door, on a project where every asset column is filled and one
// linked asset lives outside the project folder. No reply holds a path, a file name, a hash, a
// MIME type, a prompt or approvals data; no key is named like a path or secret; and the word
// test holds over a success and a refusal of each tool.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { stopAndClean, type McpFixture } from './mcp-fixture'
import { replyJson } from './tool-client'
import { readSetUp, type ReadSetUp } from './read-tools-fixture'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

// The key check of reply-keys.test.ts. `key` is a layer's own template key, not a secret.
const RISKY = /path|dir|file|url|address|host|token|secret|key/i
const HARMLESS = new Set(['directionId', 'missingFile', 'key'])
function riskyKeys(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => riskyKeys(v, `${at}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => {
    const here = at ? `${at}.${k}` : k
    const own = RISKY.test(k) && !HARMLESS.has(k) ? [here] : []
    return [...own, ...riskyKeys(v, here)]
  })
}

const SLUG = 'made-up-gallery-slug'
const REVIEWER = 'made-up-reviewer@example.com'
const PROMPT = 'made-up prompt words'

type Planted = { outside: string; inside: string; font: string; hidden: string[] }

// Three assets with every column filled: a linked picture outside the project folder, a
// managed picture inside it and a font; a subject they belong to; the variant's layers naming
// them; and an approvals link with a reviewer's sign-off.
function plant(r: ReadSetUp): Planted {
  const db = r.fx.core.projects.requireOpen(r.projectId).db
  const outside = path.join(r.fx.root, 'made-up-outside-folder', 'made-up-outside-picture.png')
  fs.mkdirSync(path.dirname(outside), { recursive: true })
  fs.writeFileSync(outside, 'made-up bytes')
  const inside = path.join(r.fx.projectsDir, 'made-up-inside-picture.png')
  const font = path.join(r.fx.projectsDir, 'made-up-font-file.ttf')
  db.prepare(
    `INSERT INTO subject (id, name, description, created_at)
     VALUES ('s-made-up', 'Made-up can', 'A red can', '2026-01-01T00:00:00Z')`,
  ).run()
  const insert = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, width, height, duration_ms,
      font_family, font_publish_allowed, gen_run_id, gen_provider, gen_model, gen_prompt,
      created_at)
     VALUES (?, 'asset', ?, 'generated', ?, 's-made-up', ?, ?, ?, ?, 1234, 99, ?, 640, 480, 7,
      'Made-up Sans', 1, 'made-up-run', 'made-up-provider', 'made-up-model', ?,
      '2026-01-01T00:00:00Z')`,
  )
  insert.run(
    'a-out',
    'image',
    'linked',
    'Outside',
    outside,
    '../made-up-outside-folder/x.png',
    'image/png',
    'made-up-hash-outside',
    PROMPT,
  )
  insert.run(
    'a-in',
    'image',
    'managed',
    'Inside',
    inside,
    'assets/made-up-inside-picture.png',
    'image/webp',
    'made-up-hash-inside',
    PROMPT,
  )
  insert.run(
    'a-font',
    'font',
    'managed',
    'Font',
    font,
    'assets/made-up-font-file.ttf',
    'font/ttf',
    'made-up-hash-font',
    PROMPT,
  )
  const sourceSql = `UPDATE layer SET source = json_object('assetId', ?)
    WHERE variant_id = ? AND type IN ('background', 'image') AND key = ?`
  const pictures = db
    .prepare(
      `SELECT key FROM layer WHERE variant_id = ? AND type IN ('background', 'image') ORDER BY z`,
    )
    .all(r.variantId) as Array<{ key: string }>
  expect(pictures.length).toBeGreaterThan(0)
  pictures.forEach((p, i) =>
    db.prepare(sourceSql).run(i % 2 === 0 ? 'a-out' : 'a-in', r.variantId, p.key),
  )
  db.prepare(
    `UPDATE layer SET style = json_set(style, '$.fontAssetId', 'a-font')
     WHERE variant_id = ? AND type = 'text'`,
  ).run(r.variantId)
  db.prepare(
    `INSERT INTO approval_link (campaign_id, slug, state, created_at, published_at)
     VALUES (?, ?, 'live', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(r.campaignId, SLUG)
  db.prepare(
    `INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
     VALUES ('so1', ?, ?, 1, ?, '2026-01-02T00:00:00Z')`,
  ).run(r.campaignId, r.variantId, REVIEWER)
  const hidden = [
    outside,
    inside,
    font,
    'made-up-outside-folder',
    'made-up-outside-picture.png',
    'made-up-inside-picture.png',
    'made-up-font-file.ttf',
    'made-up-hash',
    'image/png',
    'image/webp',
    'font/ttf',
    PROMPT,
    'made-up-provider',
    'made-up-model',
    'made-up-run',
    SLUG,
    REVIEWER,
    r.fx.root,
    r.fx.projectsDir,
  ]
  return { outside, inside, font, hidden }
}

async function setUp() {
  const r = await readSetUp()
  f = r.fx
  return { r, planted: plant(r) }
}

type VariantReply = {
  variant: { id: string }
  campaignId: string
  layers: Array<{ source: { assetId: string } | null }>
  assets: Array<{ id: string }>
}
type SubjectsReply = Array<{ id: string; assetIds: string[] }>

describe('list_subjects and get_variant over the MCP door [P10-2, A-235, A-249]', () => {
  it('get_variant gives the variant, its layers and assets, with no path, hash or MIME type', async () => {
    const { r, planted } = await setUp()
    const reply = await r.s.call('get_variant', {
      project_id: r.projectId,
      variant_id: r.variantId,
    })
    expect(reply.isError).toBeFalsy()
    const json = replyJson<VariantReply>(reply)
    expect(json.variant.id).toBe(r.variantId)
    expect(json.campaignId).toBe(r.campaignId)
    expect(json.assets.map((a) => a.id)).toEqual(expect.arrayContaining(['a-out', 'a-font']))
    expect(json.layers.some((l) => l.source?.assetId === 'a-out')).toBe(true)
    expect(riskyKeys(json)).toEqual([])
    const text = JSON.stringify(reply)
    for (const word of planted.hidden) expect(text.includes(word), word).toBe(false)
  })

  it('list_subjects gives each subject with its asset IDs, and no path or hash', async () => {
    const { r, planted } = await setUp()
    const reply = await r.s.call('list_subjects', { project_id: r.projectId })
    expect(reply.isError).toBeFalsy()
    const json = replyJson<SubjectsReply>(reply)
    expect(json.find((s) => s.id === 's-made-up')?.assetIds).toEqual(['a-font', 'a-in', 'a-out'])
    expect(riskyKeys(json)).toEqual([])
    const text = JSON.stringify(reply)
    for (const word of planted.hidden) expect(text.includes(word), word).toBe(false)
  })

  it('answers an unknown variant with NOT_FOUND as a tool error', async () => {
    const { r } = await setUp()
    const reply = await r.s.call('get_variant', {
      project_id: r.projectId,
      variant_id: 'made-up-variant',
    })
    expect(reply.isError).toBe(true)
    expect(replyJson<{ code: string }>(reply).code).toBe('NOT_FOUND')
  })

  it('holds the word test and the hidden values over a success and a refusal of each', async () => {
    const { r, planted } = await setUp()
    const p = r.projectId
    const calls: Array<[string, unknown, boolean]> = [
      ['list_subjects', { project_id: p }, true],
      ['list_subjects', { project_id: 'made-up-project' }, false],
      ['list_subjects', { project_id: 7 }, false],
      ['get_variant', { project_id: p, variant_id: r.variantId }, true],
      ['get_variant', { project_id: p, variant_id: 'made-up-variant' }, false],
      ['get_variant', { project_id: 'made-up-project', variant_id: r.variantId }, false],
    ]
    const seen: string[] = []
    for (const [tool, args, ok] of calls) {
      const reply = await r.s.call(tool, args)
      expect(Boolean(reply.isError), `${tool} ${JSON.stringify(args)}`).toBe(!ok)
      if (!reply.isError) expect(riskyKeys(replyJson(reply)), tool).toEqual([])
      seen.push(JSON.stringify(reply))
    }
    const listed = (await r.s.list()).filter((t) =>
      ['list_subjects', 'get_variant'].includes(t.name),
    )
    expect(listed.length).toBe(2)
    seen.push(JSON.stringify(listed))
    const text = seen.join('\n')
    for (const word of ['comfyui', 'baseUrl', 'agentRuns', ...planted.hidden]) {
      expect(text.includes(word), `${word} found in a reply`).toBe(false)
    }
    const logs = r.fx.readLogs()
    for (const word of [planted.outside, SLUG, REVIEWER]) {
      expect(logs.includes(word), `${word} found in the log`).toBe(false)
    }
  })
})
