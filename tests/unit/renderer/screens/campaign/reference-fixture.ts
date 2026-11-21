// Reference picture rows for the picker tests (SPEC 14 1.46 TP-5), shaped as asset.list
// returns them (an AssetRow with missing).
import type { AssetList } from '@/shared/schemas/queries/asset'
import { campaignApi } from './campaign-fixture'

type Ref = AssetList[number]

export function ref(id: string, over: Partial<Ref> = {}): Ref {
  return {
    id,
    library: 'reference',
    kind: 'image',
    origin: 'imported',
    storage: 'linked',
    subjectId: null,
    displayName: `${id}.png`,
    absPath: `/Users/me/Pictures/${id}.png`,
    relPath: `../Pictures/${id}.png`,
    mime: 'image/png',
    byteSize: 1000,
    mtimeMs: 0,
    contentHash: `hash-${id}`,
    width: 800,
    height: 800,
    durationMs: null,
    fontFamily: null,
    fontPublishAllowed: false,
    genRunId: null,
    genProvider: null,
    genModel: null,
    genPrompt: null,
    createdAt: '2026-11-21T00:00:00.000Z',
    missing: false,
    ...over,
  }
}

// A campaign page whose asset.list answers with `rows`, which a test may change later.
export function referenceApi(rows: Ref[], opts: Parameters<typeof campaignApi>[0] = {}) {
  const fake = campaignApi(opts)
  const list = { rows }
  fake.onQuery('asset.list', () => ({ ok: true, data: list.rows }))
  return { fake, list }
}
