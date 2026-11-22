// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "No path is drawn"): the picker
// keeps only the fields the panel draws.
import { describe, expect, it } from 'vitest'
import { assetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { asset } from './assets-fixture'

const KEPT = [
  'id',
  'kind',
  'library',
  'origin',
  'storage',
  'subjectId',
  'displayName',
  'width',
  'height',
  'durationMs',
  'fontFamily',
  'missing',
] as const

describe('assetView [R2C-5]', () => {
  it('keeps only the named keys of a row with every field filled', () => {
    const row = asset('a1', {
      subjectId: 's1',
      durationMs: 4000,
      fontFamily: 'Harbour Sans',
      genRunId: 'r1',
      genProvider: 'fake',
      genModel: 'm',
      genPrompt: 'a prompt',
    })
    const view = assetView(row)
    expect(Object.keys(view).sort()).toEqual([...KEPT].sort())
    for (const key of KEPT) expect(view[key]).toEqual(row[key])
  })

  it('drops absPath, relPath, contentHash and mime', () => {
    const view = assetView(asset('a1')) as Record<string, unknown>
    for (const key of ['absPath', 'relPath', 'contentHash', 'mime']) expect(key in view).toBe(false)
    expect(JSON.stringify(view)).not.toMatch(/Secret Folder|hash-a1|image\/png/)
  })
})
