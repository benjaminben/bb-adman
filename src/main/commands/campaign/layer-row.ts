// Writes one layer row from its wire values (SPEC 3.3 layer, 4.4): flags as 0 or 1 and the
// JSON columns through storedJson, so the row reads back as it went in.
import type { ProjectContext } from '../types'
import * as schema from '../../db/schema'
import { storedJson } from '../../db/rows'
import type { LayerRow } from '../../../shared/schemas/rows/layer'

const json = (field: string, value: unknown): string => storedJson('layer', field, value) ?? ''

export function insertLayerRow(ctx: ProjectContext, row: LayerRow): void {
  ctx.project.orm
    .insert(schema.layer)
    .values({
      id: row.id,
      variantId: row.variantId,
      key: row.key,
      type: row.type,
      slot: row.slot,
      name: row.name,
      z: row.z,
      visible: row.visible ? 1 : 0,
      locked: row.locked ? 1 : 0,
      linked: row.linked ? 1 : 0,
      overrides: json('overrides', row.overrides),
      copy: row.copy,
      style: json('style', row.style),
      geometry: json('geometry', row.geometry),
      source: storedJson('layer', 'source', row.source),
      timing: json('timing', row.timing),
      animation: json('animation', row.animation),
      revs: json('revs', row.revs),
      syncedRevs: json('syncedRevs', row.syncedRevs),
      translationStatus: row.translationStatus,
      translationSource: row.translationSource,
      overflow: row.overflow ? 1 : 0,
    })
    .run()
  ctx.changes.touch('layer', { id: row.id })
}
