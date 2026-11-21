// SPEC 3.6 "Asset files", SPEC 14 1.41 TP-2: the one owner of an asset's address in the
// window. Each part is escaped, so a value from a project file can never add a path part.
export function assetUrl(projectId: string, assetId: string): string {
  return `adman-asset://${encodeURIComponent(projectId)}/${encodeURIComponent(assetId)}`
}
