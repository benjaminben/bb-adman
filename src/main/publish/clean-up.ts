// Clean-up after a publish (spec/phases/phase-09.md "Publishing", A-219): deletes each file
// under {campaignId}/ that the new manifest does not list, comparing with letter case folded
// after Unicode NFC (Dropbox ignores case and keeps the old spelling on overwrite, P9-10), and
// never manifest.json. Nothing outside {campaignId}/ is listed or deleted, even when the
// storage lists a path outside it.
import type { StorageProvider } from '@/main/providers/types'
import { MANIFEST_NAME } from '@/shared/publish/manifest'
import { campaignPrefix } from './manifest'

export const foldPath = (text: string) => text.normalize('NFC').toLowerCase()

// The listed paths under `prefix`, relative to it, the prefix compared with letter case folded:
// Dropbox lists a folder in its display spelling, so CAMPAIGN-abc/ is this campaign's folder.
export function insidePrefix(listed: string[], prefix: string): string[] {
  const folded = foldPath(prefix)
  return listed.flatMap((file) =>
    foldPath(file.slice(0, prefix.length)) === folded ? [file.slice(prefix.length)] : [],
  )
}

// `keep` holds the new manifest's paths, relative to {campaignId}/. Gives the number removed.
export async function removeStale(
  storage: StorageProvider,
  campaignId: string,
  keep: string[],
): Promise<number> {
  const prefix = campaignPrefix(campaignId)
  const kept = new Set([...keep, MANIFEST_NAME].map(foldPath))
  const listed = insidePrefix(await storage.list(prefix), prefix)
  // Removed by the campaign ID's own spelling, so every path removed starts with {campaignId}/.
  const stale = listed.filter((rel) => !kept.has(foldPath(rel))).map((rel) => `${prefix}${rel}`)
  if (stale.length > 0) await storage.remove(stale)
  return stale.length
}
