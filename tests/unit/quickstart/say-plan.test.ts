import { describe, expect, it } from 'vitest'
import { adSetsOf } from '../../../quickstart/ad-sets'
import { readPlan } from '../../../quickstart/plan'
import { adSetLines, callsLine } from '../../../quickstart/say-plan'

const BRIEF = `
campaignName: Garden Party
region: France
audience: People who like gardens
message: Grow something
subjects:
  - name: Watering can
    pictures: can.png
  - name: Trowel
languages: [en, de]
sizes: ['1:1', '9:16']
`

function planOf(text: string) {
  const result = readPlan(text, 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

describe('quickstart plan printout', () => {
  it('shows one set for the campaign with all its subjects', () => {
    const plan = planOf(BRIEF)
    expect(adSetLines(adSetsOf(plan), [1])).toEqual([
      'Ad sets    1, for the campaign: Watering can, Trowel (1 photo)',
    ])
  })

  it('shows one set per subject, and says a set with no photo is made from words', () => {
    const plan = planOf(`${BRIEF}adsPer: subject\n`)
    expect(adSetLines(adSetsOf(plan), [1, 0])).toEqual([
      'Ad sets    2, one per subject:',
      '  Watering can   1 photo',
      '  Trowel         no photo: the picture is made from words alone',
    ])
  })

  it('counts the AI calls of every set', () => {
    const plan = planOf(`${BRIEF}adsPer: subject\n`)
    expect(callsLine(plan, 2, false)).toBe(
      'AI calls: 2 pictures, 2 picture extends, 2 translations (de)',
    )
    expect(callsLine(planOf(BRIEF), 1, true)).toBe(
      'AI calls: 1 picture, 1 text placement, 1 picture extend, 1 translation (de)',
    )
  })
})
