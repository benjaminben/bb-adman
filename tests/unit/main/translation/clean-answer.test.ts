// P6-6 (spec/phases/phase-06.md, section 3, "Cleaning"; A-168): the translate answer is
// untrusted. An item is kept only when its key was asked and not seen before, its text is a
// string, trimmed non-empty and at most 5000 code points.
import { describe, it, expect } from 'vitest'
import { cleanAnswer } from '@/main/translation/clean-answer'

const ASKED = ['headline', 'cta']
const LONG = 'é'.repeat(5000)
// 5000 code points, 10000 UTF-16 units.
const WIDE = '😀'.repeat(5000)

describe('cleanAnswer [A-168]', () => {
  it.each([
    [
      'keeps asked keys, trimmed',
      [{ key: 'cta', text: '  Jetzt  ' }],
      [{ key: 'cta', text: 'Jetzt' }],
    ],
    ['drops an unasked key', [{ key: 'other', text: 'x' }], []],
    [
      'drops __proto__ and constructor',
      [
        { key: '__proto__', text: 'x' },
        { key: 'constructor', text: 'y' },
      ],
      [],
    ],
    [
      'keeps the first of a repeated key',
      [
        { key: 'headline', text: 'A' },
        { key: 'headline', text: 'B' },
      ],
      [{ key: 'headline', text: 'A' }],
    ],
    [
      'drops a later item for a key already seen, even when the first was unusable',
      [
        { key: 'headline', text: '' },
        { key: 'headline', text: 'B' },
      ],
      [],
    ],
    ['drops a blank text', [{ key: 'headline', text: ' \n ' }], []],
    ['drops a text that is not a string', [{ key: 'headline', text: 7 }], []],
    ['drops an item that is not an object', ['headline', null, 3], []],
    [
      'keeps 5000 code points',
      [{ key: 'headline', text: LONG }],
      [{ key: 'headline', text: LONG }],
    ],
    [
      'counts code points, not UTF-16 units',
      [{ key: 'headline', text: WIDE }],
      [{ key: 'headline', text: WIDE }],
    ],
    ['drops 5001 code points', [{ key: 'headline', text: `${LONG}é` }], []],
  ])('%s', (_name, answer, expected) => {
    expect(cleanAnswer(answer, ASKED)).toEqual(expected)
  })

  it.each([[null], [{ items: [] }], ['text'], [undefined]])('gives nothing for %j', (answer) => {
    expect(cleanAnswer(answer, ASKED)).toEqual([])
  })

  it('answers the key as it was asked, a fresh string, with no other field', () => {
    const [item] = cleanAnswer([{ key: 'cta', text: 'Jetzt', html: '<b>x</b>' }], ASKED)
    expect(Object.keys(item ?? {})).toEqual(['key', 'text'])
  })
})
