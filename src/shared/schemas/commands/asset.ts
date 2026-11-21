import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 asset commands. Slice A adds its own schemas to this file around this one.

// asset.addGenerated [1.8]: a system command sent only by the job runner. It holds asset
// IDs and file extensions; no path and no file contents.
export const assetAddGeneratedInput = projectScoped.extend({
  jobId: z.string().min(1),
  files: z
    .array(z.object({ assetId: z.string().min(1), ext: z.string().regex(/^[a-z0-9]{1,10}$/) }))
    .min(1),
})
export type AssetAddGeneratedInput = z.infer<typeof assetAddGeneratedInput>

// asset.checkChanged (SPEC 14, Slice A rulings point 2b): a system command sent by the app
// after a project opens and when a window gains focus.
export const assetCheckChangedInput = projectScoped
export type AssetCheckChangedInput = z.infer<typeof assetCheckChangedInput>

const library = z.enum(['reference', 'asset'])
const assetId = z.string().min(1)

// asset.update (FR-054, R-12). subjectId null detaches the asset from its subject.
export const assetUpdateInput = projectScoped.extend({
  assetId,
  library: library.optional(),
  subjectId: z.string().min(1).nullable().optional(),
  displayName: z.string().trim().min(1, 'Enter a name.').max(200).optional(),
  fontPublishAllowed: z.boolean().optional(),
})
export type AssetUpdateInput = z.infer<typeof assetUpdateInput>

// asset.remove (FR-197): refused while a layer, clip or rule set uses the asset.
export const assetRemoveInput = projectScoped.extend({ assetId })
export type AssetRemoveInput = z.infer<typeof assetRemoveInput>

// asset.import (FR-050 to FR-054, R-08). Each path comes from the system picker or the user;
// the agent policy is deny. copy: true saves a copy in the assets folder.
export const assetImportInput = projectScoped.extend({
  paths: z.array(z.string().min(1)).min(1),
  library,
  subjectId: z.string().min(1).optional(),
  copy: z.boolean(),
})
export type AssetImportInput = z.infer<typeof assetImportInput>

// asset.relink (FR-009; SPEC 14, Slice A rulings point 3). newPath comes from the system
// picker; relinkSiblings also looks for the other missing files of the same old folder.
export const assetRelinkInput = projectScoped.extend({
  assetId,
  newPath: z.string().min(1),
  relinkSiblings: z.boolean(),
})
export type AssetRelinkInput = z.infer<typeof assetRelinkInput>

// project.package (SPEC 3.9; FR-008, R-09). Kept in slice A's schema file, beside the other
// asset-folder commands, because commands/project.ts belongs to Phase 1.
export const projectPackageInput = projectScoped.extend({
  targetDir: z.string().min(1),
  skipMissing: z.boolean().default(false),
})
export type ProjectPackageInput = z.infer<typeof projectPackageInput>

// project.setAssetsDir (FR-007, R-07; SPEC 14, Slice A rulings point 4). dir comes from the
// folder picker; the command moves no file and makes no folder.
export const projectSetAssetsDirInput = projectScoped.extend({ dir: z.string().min(1) })
export type ProjectSetAssetsDirInput = z.infer<typeof projectSetAssetsDirInput>

export type PackageResult = {
  packagePath: string
  fileCount: number
  totalBytes: number
  skippedAssetIds: string[]
}
