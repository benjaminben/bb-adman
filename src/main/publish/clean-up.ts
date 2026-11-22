// Clean-up after a publish (spec/phases/phase-09.md "Publishing", A-219): deletes each file
// under {campaignId}/ that the new manifest does not list, comparing with letter case folded,
// and never manifest.json. Nothing outside {campaignId}/ is listed or deleted, even when the
// storage lists a path outside it.
import type { StorageProvider } from '@/main/providers/types'
import { MANIFEST_NAME } from '@/shared/publish/manifest'
import { campaignPrefix } from './manifest'

const fold = (text: string) => text.toLowerCase()

// `keep` holds the new manifest's paths, relative to {campaignId}/. Gives the number removed.
export async function removeStale(
  storage: StorageProvider,
  campaignId: string,
  keep: string[],
): Promise<number> {
  const prefix = campaignPrefix(campaignId)
  const kept = new Set([...keep, MANIFEST_NAME].map(fold))
  const listed = await storage.list(prefix)
  const stale = listed.filter(
    (file) => file.startsWith(prefix) && !kept.has(fold(file.slice(prefix.length))),
  )
  if (stale.length > 0) await storage.remove(stale)
  return stale.length
}
