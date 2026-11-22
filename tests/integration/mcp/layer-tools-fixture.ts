// P10-4: a project with one campaign (en and de, two sizes), two planted assets, MCP on and one
// tool session over the real HTTP door. Not a test file.
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { makeMcpFixture, type McpFixture } from './mcp-fixture'
import { replyJson, toolSession, type ToolReply, type ToolSession } from './tool-client'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type LayerSetUp = {
  fx: McpFixture
  s: ToolSession
  projectId: string
  // The master variant (en) and a de variant whose text layers are translations.
  variantId: string
  deVariantId: string
  layers(variantId: string): LayerRow[]
  variant(variantId: string): VariantRow
  setTranslation(layerId: string, status: 'missing' | 'proposed' | 'approved'): void
}

// The planted assets: a picture in the asset library and one in the reference library. Both
// have a made-up path on disk that must never reach an agent.
export const PICTURE = 'a-picture'
export const REFERENCE = 'a-reference'
export const PLANTED_PATH = '/Users/made-up/layer-tools-picture.png'

function plantAsset(db: ReturnType<McpFixture['core']['projects']['requireOpen']>['db']) {
  const insert = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES (?, ?, 'image', 'imported', 'linked', NULL, 'Picture', ?, 'layer-tools-picture.png',
      'image/png', 1, 1, 'made-up-hash', '2026-01-01T00:00:00.000Z')`,
  )
  insert.run(PICTURE, 'asset', PLANTED_PATH)
  insert.run(REFERENCE, 'reference', PLANTED_PATH)
}

export async function makeProject(fx: McpFixture, name: string) {
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name, location: fx.projectsDir }),
  )
  const made = data<{ variantId: string }>(
    await fx.user('campaign.create', { projectId, ...createInput() }),
  )
  return { projectId, variantId: made.variantId }
}

export async function layerSetUp(): Promise<LayerSetUp> {
  const fx = await makeMcpFixture()
  const { projectId, variantId } = await makeProject(fx, 'Layers')
  const db = () => fx.core.projects.requireOpen(projectId).db
  plantAsset(db())
  const master = db().prepare('SELECT direction_id FROM variant WHERE id = ?').get(variantId) as {
    direction_id: string
  }
  const add = { projectId, directionId: master.direction_id, sizeLabel: '1x1', language: 'de' }
  const de = {
    id: data<{ variantId: string }>(await fx.user('variant.add', { ...add, format: 'image' }))
      .variantId,
  }
  // The template gives a background and a headline; the user adds a picture layer on top.
  const picture = { type: 'image', values: { name: 'Bottle', source: { assetId: PICTURE } } }
  data(await fx.user('layer.create', { projectId, variantId, ...picture }))
  data(await fx.user('mcp.setEnabled', { enabled: true }))
  const s = await toolSession(fx.port, await fx.token())
  return {
    fx,
    s,
    projectId,
    variantId,
    deVariantId: de.id,
    layers: (id) =>
      (readWireRows(db(), 'layer') as LayerRow[])
        .filter((l) => l.variantId === id)
        .sort((a, b) => a.z - b.z || a.id.localeCompare(b.id)),
    variant: (id) => readWireRow(db(), 'variant', { id }) as VariantRow,
    setTranslation: (layerId, status) => {
      db()
        .prepare(
          `UPDATE layer SET translation_status = ?, translation_source = 'user' WHERE id = ?`,
        )
        .run(status, layerId)
    },
  }
}

export const layerOf = (r: LayerSetUp, variantId: string, type: LayerRow['type']) => {
  const layer = r.layers(variantId).find((l) => l.type === type)
  if (!layer) throw new Error(`no ${type} layer`)
  return layer
}

export type Refusal = { code: string; message: string; details?: Record<string, unknown> }

export const refusalOf = (reply: ToolReply) => replyJson<Refusal>(reply)

// The same rule as tests/integration/mcp/reply-keys.test.ts (which cannot be imported without
// running its tests): an object key named like a path, an address or a secret.
const RISKY = /path|dir|file|url|address|host|token|secret|key/i

export function riskyKeys(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => riskyKeys(v, `${at}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => {
    const here = at ? `${at}.${k}` : k
    return [...(RISKY.test(k) ? [here] : []), ...riskyKeys(v, here)]
  })
}
