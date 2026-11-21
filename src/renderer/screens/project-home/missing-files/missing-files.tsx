// The missing-file line and "Find missing files…" (spec/screens-campaign.md, "Finding missing
// files: the relink dialog"). Mounted in the "Files" section by S2-2; S2-11 fills it.
// `missingCount` is project.get's missingAssetCount.

export type MissingFilesProps = { projectId: string; missingCount: number }

export function MissingFiles(_props: MissingFilesProps) {
  return null
}
