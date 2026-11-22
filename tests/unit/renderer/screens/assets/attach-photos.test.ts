// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The attach step"): what an
// import with a subject still needs. A file already in the project keeps its library and
// subject on import, so a reused photo with no subject is attached, and one of another subject
// is left there with a note.
import { describe, expect, it } from 'vitest'
import { addedCount, attachPlan, noteLines } from '@/renderer/screens/assets/attach-photos'
import { assetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { asset } from './assets-fixture'

const ASSETS = [
  assetView(asset('free', { displayName: 'cup.png' })),
  assetView(asset('other', { displayName: 'beans.png', subjectId: 's-shop' })),
  assetView(asset('mine', { displayName: 'mug.png', subjectId: 's-blend' })),
]

const reply = (assetIds: string[], reusedAssetIds: string[] = []) => ({
  assetIds,
  reusedAssetIds,
  skippedCount: 0,
  animatedAssetIds: [],
})

describe('attachPlan [R2C-6]', () => {
  it.each([
    ['new IDs need nothing', reply(['n1', 'n2']), [], []],
    ['a reused unattached ID is attached', reply(['n1', 'free'], ['free']), ['free'], []],
    [
      'a reused ID of another subject gets a note',
      reply(['other'], ['other']),
      [],
      [{ assetId: 'other', otherSubjectId: 's-shop' }],
    ],
    ['a reused ID already of this subject needs nothing', reply(['mine'], ['mine']), [], []],
  ])('%s', (_, given, updates, notes) => {
    expect(attachPlan(given, ASSETS, 's-blend')).toEqual({ updates, notes })
  })

  it('takes each reused ID once', () => {
    expect(attachPlan(reply(['free', 'free'], ['free', 'free']), ASSETS, 's-blend')).toEqual({
      updates: ['free'],
      notes: [],
    })
  })
})

describe('addedCount and noteLines [R2C-6]', () => {
  it('counts the new photos and the attached ones, not the ones left or already there', () => {
    const given = reply(['n1', 'free', 'other', 'mine'], ['free', 'other', 'mine'])
    expect(addedCount(given, attachPlan(given, ASSETS, 's-blend'))).toBe(2)
  })

  it('names the photo and its other subject', () => {
    const subjects = [{ id: 's-shop', name: 'Linnea Park' }]
    const notes = [{ assetId: 'other', otherSubjectId: 's-shop' }]
    expect(noteLines(notes, ASSETS, subjects)).toEqual([
      'beans.png is already a photo of Linnea Park. It was left there.',
    ])
  })
})
