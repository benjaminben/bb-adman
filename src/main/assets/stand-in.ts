// Stand-in for the AssetService until slice A builds it (SPEC 14, Phase 2 step 0).
// Slice A replaces this body; the type in types.ts stays.
import type { AssetService } from './types'

const notBuilt = (name: string) => new Error(`AssetService.${name} is not built yet`)

export function createAssetServiceStandIn(): AssetService {
  return {
    missingAssetIds: async () => [],
    resolve: async () => {
      throw notBuilt('resolve')
    },
    assetsDir: () => {
      throw notBuilt('assetsDir')
    },
    writeManaged: async () => {
      throw notBuilt('writeManaged')
    },
    read: async () => {
      throw notBuilt('read')
    },
  }
}
