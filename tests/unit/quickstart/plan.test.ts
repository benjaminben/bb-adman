import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { copySlots, readPlan } from '../../../quickstart/plan'

const BRIEF = `
campaignName: Garden Party
region: France
audience: People who like gardens
message: Grow something
callToAction: Start today
subjects:
  - name: Watering can
    description: A green can
    pictures: can.png
  - name: Trowel
    pictures: [trowel-1.png, trowel-2.png]
languages: [fr, en, de, fr]
sizes: ['1:1', '4:5', '1080x1080']
copy:
  en:
    headline: Grow something
    callToAction: Start today
  de:
    headline: Lass etwas wachsen
`

function planOf(text: string, syntax: 'yaml' | 'json' = 'yaml') {
  const result = readPlan(text, syntax)
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

describe('quickstart readPlan', () => {
  it('lists each language and size once, the first language and size first', () => {
    const plan = planOf(BRIEF)
    expect(plan.languages).toEqual(['fr', 'en', 'de'])
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1', '4x5'])
  })

  it("gives each subject's photo names, and no photo path in the brief itself", () => {
    const plan = planOf(BRIEF)
    expect(plan.subjects).toEqual([
      { name: 'Watering can', description: 'A green can', pictures: ['can.png'] },
      { name: 'Trowel', description: null, pictures: ['trowel-1.png', 'trowel-2.png'] },
    ])
    expect(JSON.stringify(plan.brief)).not.toContain('.png')
  })

  it('translates only a language the brief gives no full copy for', () => {
    expect(planOf(BRIEF).translate).toEqual(['de'])
  })

  it('extends the picture only to a size of other pixels than the first', () => {
    expect(planOf(BRIEF).fills.map((s) => s.label)).toEqual(['4x5'])
  })

  it('falls back to one 1x1 size and the language of the region', () => {
    const plan = planOf(
      'campaignName: A\nregion: Germany\naudience: B\nmessage: C\nsubjects:\n  - name: D\n',
    )
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1'])
    expect(plan.languages).toEqual(['de'])
    expect(plan.translate).toEqual([])
    expect(plan.fills).toEqual([])
  })

  it('reads a JSON brief', () => {
    const json = JSON.stringify({
      campaignName: 'A',
      region: 'US',
      audience: 'B',
      message: 'C',
      subjects: [{ name: 'D' }],
      languages: ['en'],
    })
    expect(planOf(json, 'json').brief.campaignName).toBe('A')
  })

  it('refuses a brief with a missing field, a bad size or broken text', () => {
    const missing = readPlan('campaignName: A\nregion: US\n', 'yaml')
    expect(missing.ok).toBe(false)
    expect(!missing.ok && missing.message).toContain('campaignName, region, audience, message')
    const badSize = readPlan(`${BRIEF}`.replace("'4:5'", "'wide'"), 'yaml')
    expect(!badSize.ok && badSize.message).toContain('"wide"')
    expect(readPlan('{ not yaml', 'yaml').ok).toBe(false)
  })

  it('counts the call to action as a copy slot only when the brief has one', () => {
    expect(copySlots(planOf(BRIEF).brief)).toEqual(['headline', 'call-to-action'])
    const none = planOf(BRIEF.replace('callToAction: Start today\nsubjects', 'subjects'))
    expect(copySlots(none.brief)).toEqual(['headline'])
  })

  it('reads the brief the quickstart ships with', () => {
    const text = readFileSync(new URL('../../../quickstart/brief.yaml', import.meta.url), 'utf8')
    const plan = planOf(text)
    expect(plan.languages).toEqual(['en', 'fr', 'es'])
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1', '4x5', '9x16'])
    expect(plan.subjects.map((s) => s.pictures)).toEqual([['subject-a.png'], ['subject-b.png']])
    expect(plan.translate).toEqual(['es'])
  })
})
