// Asset rows for the Assets panel tests (R2C-5): every field filled, with a planted path,
// hash and mime that must never reach the panel.
import type { AssetList } from '@/shared/schemas/queries/asset'

export type ListedAsset = AssetList[number]

export const PLANTED_ABS = '/Users/linnea/Secret Folder/'
export const PLANTED_REL = '../Secret Folder/'

export function asset(id: string, over: Partial<ListedAsset> = {}): ListedAsset {
  return {
    id,
    library: 'asset',
    kind: 'image',
    origin: 'imported',
    storage: 'managed',
    subjectId: null,
    displayName: `${id}.png`,
    absPath: `${PLANTED_ABS}${id}.png`,
    relPath: `${PLANTED_REL}${id}.png`,
    mime: 'image/png',
    byteSize: 1000,
    mtimeMs: 1,
    contentHash: `hash-${id}-0123456789abcdef`,
    width: 1200,
    height: 800,
    durationMs: null,
    fontFamily: null,
    fontPublishAllowed: false,
    genRunId: null,
    genProvider: null,
    genModel: null,
    genPrompt: null,
    createdAt: '2026-11-20T00:00:00.000Z',
    missing: false,
    ...over,
  }
}
