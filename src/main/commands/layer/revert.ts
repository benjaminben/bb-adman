// layer.revert (spec/links-and-sync.md, "Overrides"; A-136): system command, the inverse of an
// edit that changed an override list. Internal and agent policy deny. Writes each patch with
// layer.update's checks and counters, sets each override list exactly, bumps variant.rev
// once. Its inverse is layer.revert with the values and lists before it ran. A call that
// changes nothing writes nothing and adds no entry.
import { isDeepStrictEqual } from 'node:util'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { layerRevertInput } from '@/shared/schemas/commands/layer'
import type { PatchKey } from './merge-patch'
import { namedOnce, planLayer } from './update-many'
import { revertInverse, writeLayer } from './write-layer'

export function layerRevert(deps: CoreDeps) {
  return defineCommand({
    name: 'layer.revert',
    internal: true,
    input: layerRevertInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      namedOnce(input.layers.map((layer) => layer.layerId))
      const planned = input.layers.map(({ layerId, patch, overrides }) => ({
        ...planLayer(ctx.project.db, input.variantId, layerId, patch),
        overrides,
      }))
      const changed = planned.filter(
        (item) =>
          Object.keys(item.inverse).length > 0 ||
          !isDeepStrictEqual(item.overrides, item.row.overrides),
      )
      const result = {
        data: { layerIds: changed.map((item) => item.row.id) },
        log: { variantId: input.variantId },
      }
      if (changed.length === 0) return result
      for (const { row, merged, inverse, overrides } of changed) {
        writeLayer(ctx, row, merged, Object.keys(inverse) as PatchKey[], overrides)
      }
      // planLayer has read every row and refused one in any other variant.
      const variantId = input.variantId
      bumpVariantRev(ctx, variantId, deps.now().toISOString())
      const layers = changed.map(({ row, inverse }) => ({
        layerId: row.id,
        patch: inverse,
        overrides: row.overrides,
      }))
      return { ...result, inverse: revertInverse(input.projectId, variantId, layers) }
    },
  })
}
