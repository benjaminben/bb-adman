// The import dialog's sentences (spec/screens-campaign.md, "The import dialog"). The renderer
// draws no path: a name is the text after the last `/` or `\`.

// The reply of asset.import (spec/assets.md, "Import").
export type ImportReply = { assetIds: string[]; reusedAssetIds: string[]; skippedCount: number }

const MAX_NAMES = 10

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part !== '')
  return parts[parts.length - 1] ?? ''
}

export function importTitle(paths: string[], folder: boolean): string {
  return folder ? 'Import a folder' : `Import ${paths.length} file(s)`
}

// At most ten base names, and how many more there are.
export function shownNames(paths: string[]): { names: string[]; more: number } {
  return {
    names: paths.slice(0, MAX_NAMES).map(baseName),
    more: Math.max(0, paths.length - MAX_NAMES),
  }
}

// One line per count that is not 0; one sentence when all three are 0.
export function resultLines(reply: ImportReply): string[] {
  const reused = new Set(reply.reusedAssetIds)
  const added = new Set(reply.assetIds.filter((id) => !reused.has(id))).size
  const kept = reply.reusedAssetIds.length
  const lines: string[] = []
  if (added > 0) lines.push(`${added} file(s) added.`)
  if (kept > 0) {
    lines.push(`${kept} file(s) were already in the project and were kept as they were.`)
  }
  if (reply.skippedCount > 0) {
    lines.push(
      `${reply.skippedCount} item(s) in the folder were skipped: links, hidden files, and files Adman cannot use.`,
    )
  }
  if (lines.length > 0) return lines
  return ['Nothing was imported. The folder holds no file Adman can use.']
}
