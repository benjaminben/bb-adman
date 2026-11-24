import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { adSetsOf, setFolder, setPhotos } from '../../../quickstart/ad-sets'
import { readPlan } from '../../../quickstart/plan'
import { picturePrompt } from '../../../quickstart/run'

const BRIEF = `
campaignName: Garden Party
region: France
audience: People who like gardens
message: Grow something
subjects:
  - name: Watering can
    description: A green can
    pictures: can.png
  - name: Trowel
    description: A steel trowel
`

function planOf(text: string) {
  const result = readPlan(text, 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

const photo = (n: number) => ({ bytes: new Uint8Array([n]), mime: 'image/png' })

describe('quickstart ad sets', () => {
  it('makes one set of all subjects for the campaign', () => {
    const sets = adSetsOf(planOf(BRIEF))
    expect(sets).toHaveLength(1)
    expect(sets[0]?.name).toBeNull()
    expect(sets[0]?.folder).toBeNull()
    expect(sets[0]?.subjects).toEqual([0, 1])
    expect(sets[0]?.plan.subjects.map((s) => s.name)).toEqual(['Watering can', 'Trowel'])
  })

  it('makes one set per subject, in brief order, with adsPer: subject', () => {
    const sets = adSetsOf(planOf(`${BRIEF}adsPer: subject\n`))
    expect(sets.map((s) => [s.name, s.folder, s.subjects])).toEqual([
      ['Watering can', 'watering-can', [0]],
      ['Trowel', 'trowel', [1]],
    ])
    expect(sets[1]?.plan.subjects.map((s) => s.name)).toEqual(['Trowel'])
  })

  it('makes one set when adsPer is subject but there is one subject', () => {
    const one = `campaignName: A\nregion: B\naudience: C\nmessage: D\nadsPer: subject\nsubjects:\n  - name: E\n`
    const sets = adSetsOf(planOf(one))
    expect(sets.map((s) => [s.name, s.folder])).toEqual([[null, null]])
  })

  it('puts only its own subject in the picture prompt of a set', () => {
    const [can, trowel] = adSetsOf(planOf(`${BRIEF}adsPer: subject\n`))
    if (!can || !trowel) throw new Error('two sets expected')
    expect(picturePrompt(can.plan)).toContain('Watering can')
    expect(picturePrompt(can.plan)).not.toContain('Trowel')
    expect(picturePrompt(trowel.plan)).toContain('Trowel')
    expect(picturePrompt(trowel.plan)).not.toContain('Watering can')
  })

  it('never lets two subjects share a folder or leave the campaign folder', () => {
    const text = `campaignName: A\nregion: B\naudience: C\nmessage: D\nadsPer: subject\nsubjects:\n  - name: "../Can!"\n  - name: can\n  - name: "..."\n`
    const sets = adSetsOf(planOf(text))
    expect(sets.map((s) => s.folder)).toEqual(['can', 'can-2', 'subject'])
    const [first] = sets
    if (!first) throw new Error('a set expected')
    expect(setFolder('campaign', first)).toBe(join('campaign', 'can'))
    expect(setFolder('campaign', { ...first, folder: null })).toBe('campaign')
  })

  it("hands each set its own subjects' photos only", () => {
    const sets = adSetsOf(planOf(`${BRIEF}adsPer: subject\n`))
    const bySubject = [[photo(1)], []]
    expect(sets.map((set) => setPhotos(set, bySubject).length)).toEqual([1, 0])
    const [all] = adSetsOf(planOf(BRIEF))
    if (!all) throw new Error('a set expected')
    expect(setPhotos(all, [[photo(1)], [photo(2), photo(3)]])).toHaveLength(3)
  })
})
