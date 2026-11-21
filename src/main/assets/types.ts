// SPEC 14 "Contract between the slices": the AssetService on CoreDeps.assets.
// Frozen contract (Phase 2 step 0). Slice A builds it; core.ts holds a stand-in until then.
import type { ProjectHandle } from '../db/project-file'
import type { ImageFile } from '../providers/types'

export type AssetService = {
  // IDs of assets whose file cannot be found.
  missingAssetIds(project: ProjectHandle): Promise<string[]>
  // The file's path, or 'missing'.
  resolve(project: ProjectHandle, assetId: string): Promise<string | 'missing'>
  // The assets folder path.
  assetsDir(project: ProjectHandle): string
  // Writes {assetsDir}/{assetId}.{ext}, creating the assets folder on first use.
  writeManaged(
    project: ProjectHandle,
    file: { assetId: string; ext: string; bytes: Uint8Array },
  ): Promise<void>
  // The file's contents, or throws MISSING_FILE.
  read(project: ProjectHandle, assetId: string): Promise<ImageFile>
}
