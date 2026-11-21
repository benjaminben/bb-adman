// The variant query domain (spec/editor-commands.md, "variant.get"): one variant with its
// layers and the assets they name. Both actors may call it.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { badgesOf, openFor } from './campaign-reads'
import { assetsOf, layersOf, requireVariant, subjectIdsOf } from './variant-reads'
import { variantGetInput, type VariantGet } from '@/shared/schemas/queries/variant'

export function variantGet(deps: Pick<CoreDeps, 'projects' | 'assets' | 'log'>): QueryFn {
  return async (raw): Promise<VariantGet> => {
    const { input, project } = openFor(deps, variantGetInput, raw)
    const db = project.db
    const { variant, direction } = requireVariant(db, input.variantId)
    const layers = layersOf(db, variant.id, deps.log)
    const missing = new Set(await deps.assets.missingAssetIds(project))
    return {
      variant: {
        ...variant,
        isMaster: direction.masterVariantId === variant.id,
        subjectIds: subjectIdsOf(db, variant.id, deps.log),
        badges: badgesOf(db, variant.id, layers, missing),
      },
      campaignId: direction.campaignId,
      layers,
      assets: assetsOf(db, layers, missing),
    }
  }
}

export function variantQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'variant.get': variantGet(deps) }
}
