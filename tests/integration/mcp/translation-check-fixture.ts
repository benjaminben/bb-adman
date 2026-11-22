// P10-12: reads over the layer-tools project (layer-tools-fixture.ts) and the run-tools project
// for the set_translation, run_checks and get_check_results tests. Not a test file.
import type Database from 'better-sqlite3'
import { data } from '../core-fixture'
import { readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'
import type { LayerSetUp } from './layer-tools-fixture'

export const dbOf = (x: LayerSetUp) => x.fx.core.projects.requireOpen(x.projectId).db

export const variantsOf = (x: LayerSetUp) => readWireRows(dbOf(x), 'variant') as VariantRow[]

export const allLayers = (x: LayerSetUp) =>
  (readWireRows(dbOf(x), 'layer') as LayerRow[]).sort((a, b) => a.id.localeCompare(b.id))

export const checkRows = (x: LayerSetUp) =>
  (readWireRows(dbOf(x), 'variant_check') as VariantCheckRow[]).sort((a, b) =>
    a.variantId.localeCompare(b.variantId),
  )

export const jobCount = (x: LayerSetUp) =>
  (dbOf(x).prepare('SELECT COUNT(*) AS n FROM job').get() as { n: number }).n

// The text layers of every de variant of the direction that share the named layer's key.
export function deTwins(x: LayerSetUp, named: LayerRow): LayerRow[] {
  const variants = variantsOf(x)
  const direction = variants.find((v) => v.id === named.variantId)?.directionId
  const de = new Set(
    variants.filter((v) => v.directionId === direction && v.language === 'de').map((v) => v.id),
  )
  return allLayers(x).filter((l) => de.has(l.variantId) && l.key === named.key && l.id !== named.id)
}

// A second de variant (9x16) in the master's direction, so the de text has a same-language twin.
export async function addDeTwin(x: LayerSetUp): Promise<string> {
  const directionId = variantsOf(x).find((v) => v.id === x.variantId)?.directionId
  const add = { projectId: x.projectId, directionId, sizeLabel: '9x16', language: 'de' }
  return data<{ variantId: string }>(await x.fx.user('variant.add', { ...add, format: 'image' }))
    .variantId
}

// For the word test's set_translation row: a de variant in direction d1 of the run-tools
// project, with a proposed translation of text layer l-text. Gives the new layer's ID.
export function seedTranslation(db: Database.Database): string {
  db.exec(`
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('v-de', 'd1', 'De', 1080, 1080, '1:1', 'de', 'image', 0, 'user', 'x');
    INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs, translation_status, translation_source)
      SELECT 'l-de-text', 'v-de', key, type, slot, name, z, 'Hallo', style, geometry, source,
      timing, animation, revs, synced_revs, 'proposed', 'user' FROM layer WHERE id = 'l-text';
  `)
  return 'l-de-text'
}
