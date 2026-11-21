// Asset rows and fake replies for the relink dialog and the missing-file line (S2-11).
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { makeFakeApi } from '../fake-api'

export type ListedAsset = AssetRow & { missing: boolean }

export function asset(
  id: string,
  displayName: string,
  more: Partial<ListedAsset> = {},
): ListedAsset {
  return {
    id,
    library: 'asset',
    kind: 'image',
    origin: 'imported',
    storage: 'linked',
    subjectId: null,
    displayName,
    absPath: `/Users/me/Shoots/${displayName}`,
    relPath: `../Shoots/${displayName}`,
    mime: 'image/png',
    byteSize: 1000,
    mtimeMs: 0,
    contentHash: `hash-${id}`,
    width: 100,
    height: 100,
    durationMs: null,
    fontFamily: null,
    fontPublishAllowed: false,
    genRunId: null,
    genProvider: null,
    genModel: null,
    genPrompt: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    missing: true,
    ...more,
  }
}

// asset.list answers with the current rows; a successful relink marks the asset and its
// siblings found, as the main process would.
export function serveAssets(fake: ReturnType<typeof makeFakeApi>, rows: ListedAsset[]) {
  let current = rows
  fake.onQuery('asset.list', () => ({ ok: true, data: current }))
  return {
    found(ids: string[]) {
      current = current.map((row) => (ids.includes(row.id) ? { ...row, missing: false } : row))
    },
  }
}
