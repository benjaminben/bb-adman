// SPEC 14 "Contract between the slices": the AssetService on CoreDeps.assets.
// Frozen contract (Phase 2 step 0), built by slice A.
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
  // The picture's bytes and the type they show (PNG or JPEG), not the row's mime. Throws
  // MISSING_FILE when the file cannot be found; RULE_VIOLATION asset_too_large when the file
  // is over MAX_PICTURE_BYTES; RULE_VIOLATION asset_not_a_picture when the row is not an
  // image or the bytes are not a picture.
  read(project: ProjectHandle, assetId: string): Promise<ImageFile>
}
