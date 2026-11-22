import { describe, it, expect } from 'vitest'
import { parseMarkdownBrief } from '@/shared/brief/markdown'
import { BRIEF_UNREADABLE } from '@/shared/brief/draft'

const md = (...lines: string[]): string => lines.join('\n')
const read = (...lines: string[]): unknown => parseMarkdownBrief(md(...lines))
const draft = (data: object): object => ({ ok: true, data })
const unreadable = { ok: false, error: BRIEF_UNREADABLE }

// Round 2 plan D2, the example (made-up names).
const EXAMPLE = md(
  '# Spring Glow launch',
  '',
  'Region: Canada',
  'Audience: Adults 25 to 40 who buy skin care online',
  'Call to action: Shop the serum',
  'Tone: Warm and plain',
  '',
  '## Message',
  'Glow that lasts from morning to night.',
  '',
  '## Languages',
  '- en',
  '- fr',
  '',
  '## Sizes',
  '- 1:1',
  '- 9:16',
  '',
  '## Required words (en)',
  '- serum',
  '',
  '## Subjects',
  '',
  '### Citrus Glow serum',
  'ID: citrus-glow',
  'Description: A 30 ml glass dropper bottle with an orange label',
  'Pictures:',
  '- 01JD3K7Q2M8V5X9T4R6Y1B0C2N',
  '- /Users/sam/Pictures/citrus-glow-front.png',
  '',
  '## Copy (fr)',
  'Headline: Un éclat qui dure',
  'Call to action: Découvrir le sérum',
)

describe('parseMarkdownBrief: the D2 example [A-342]', () => {
  it('gives the stated draft exactly', () => {
    expect(parseMarkdownBrief(EXAMPLE)).toEqual(
      draft({
        campaignName: 'Spring Glow launch',
        region: 'Canada',
        audience: 'Adults 25 to 40 who buy skin care online',
        callToAction: 'Shop the serum',
        tone: 'Warm and plain',
        message: 'Glow that lasts from morning to night.',
        languages: ['en', 'fr'],
        sizes: ['1:1', '9:16'],
        requiredWords: { en: ['serum'] },
        subjects: [
          {
            id: 'citrus-glow',
            name: 'Citrus Glow serum',
            description: 'A 30 ml glass dropper bottle with an orange label',
            pictures: ['01JD3K7Q2M8V5X9T4R6Y1B0C2N', '/Users/sam/Pictures/citrus-glow-front.png'],
          },
        ],
        copy: { fr: { headline: 'Un éclat qui dure', callToAction: 'Découvrir le sérum' } },
      }),
    )
  })

  it('reads the same with a byte-order mark and CRLF line ends', () => {
    const mark = String.fromCharCode(0xfeff)
    expect(parseMarkdownBrief(mark + EXAMPLE.replaceAll('\n', '\r\n'))).toEqual(
      parseMarkdownBrief(EXAMPLE),
    )
  })
})

describe('parseMarkdownBrief: labels [D2]', () => {
  it.each([
    ['any letter case and runs of spaces', ['CALL   to Action: Buy'], { callToAction: 'Buy' }],
    ['**Label:** value', ['**Region:** Canada'], { region: 'Canada' }],
    ['**Label**: value', ['**Region**: Canada'], { region: 'Canada' }],
    ['__Label:__ value', ['__Offer:__ Two for one'], { offer: 'Two for one' }],
    ['Campaign as a label', ['Campaign: Spring'], { campaignName: 'Spring' }],
    ['a heading label with a trailing colon', ['## Message:', 'Hello'], { message: 'Hello' }],
    ['a bold heading label', ['## **Tone**', 'Warm'], { tone: 'Warm' }],
    ['a level-1 heading that is a label', ['# Audience', 'Adults'], { audience: 'Adults' }],
  ])('%s', (_name, lines, expected) => {
    expect(read(...lines)).toEqual(draft(expected))
  })

  it('does not read a label from the object prototype', () => {
    expect(read('constructor: x', '__proto__: y', 'toString: z')).toEqual(unreadable)
  })
})

describe('parseMarkdownBrief: the walk, rule by rule [D2]', () => {
  it('1. skips lines inside a fenced block, ``` or ~~~', () => {
    expect(
      read('```', 'Region: Fenced', '```', '~~~yaml', 'Tone: Fenced', '~~~', 'Region: Canada'),
    ).toEqual(draft({ region: 'Canada' }))
  })

  it('1. an open fence runs to the end', () => {
    expect(read('Tone: Warm', '```', 'Region: Fenced')).toEqual(draft({ tone: 'Warm' }))
  })

  it('2. the first level-1 heading names the campaign; later ones are ignored', () => {
    expect(read('# First', '# Second', 'Region: Canada')).toEqual(
      draft({ campaignName: 'First', region: 'Canada' }),
    )
  })

  it('2. an unknown level-2 heading is ignored up to the next level-1 or level-2 heading', () => {
    expect(
      read(
        '## Notes',
        'Region: Hidden',
        '- item',
        '### Deeper',
        'Tone: Hidden',
        '## Offer',
        'Free',
      ),
    ).toEqual(draft({ offer: 'Free' }))
  })

  it('2. a level-1 heading ends an ignored section', () => {
    expect(read('## Notes', 'Region: Hidden', '# Spring', 'Region: Canada')).toEqual(
      draft({ campaignName: 'Spring', region: 'Canada' }),
    )
  })

  it('2. a heading needs a space after its marks', () => {
    expect(read('##Message', 'Region: Canada')).toEqual(draft({ region: 'Canada' }))
  })

  it('2. a level-3 heading under Subjects starts a subject', () => {
    expect(read('## Subjects', '### Bottle', 'ID: b1', '### Jar', 'Name: Other')).toEqual(
      draft({ subjects: [{ id: 'b1', name: 'Bottle' }, { name: 'Jar' }] }),
    )
  })

  it('3. a list field set on one line is split on commas, trimmed, empty parts dropped', () => {
    expect(read('Languages: en, fr,, de ', 'Sizes: 1:1,9:16')).toEqual(
      draft({ languages: ['en', 'fr', 'de'], sizes: ['1:1', '9:16'] }),
    )
  })

  it('3. an empty-valued text label sets nothing', () => {
    expect(read('Region:', 'Tone: Warm')).toEqual(draft({ tone: 'Warm' }))
  })

  it('3. an empty-valued list label reads the items that follow', () => {
    expect(
      read('Languages:', '- en', '', '* fr', '+ de', '1. es', '12. it', 'Tone: Warm', '- x'),
    ).toEqual(draft({ languages: ['en', 'fr', 'de', 'es', 'it'], tone: 'Warm' }))
  })

  it('3. inside a subject or a Copy section only its own labels are read', () => {
    expect(
      read(
        '## Subjects',
        '### Bottle',
        'Region: Hidden',
        'Picture: a.png, b.png',
        '## Copy (en)',
        'Tone: Hidden',
        'Headline: Hi',
      ),
    ).toEqual(
      draft({
        subjects: [{ name: 'Bottle', pictures: ['a.png', 'b.png'] }],
        copy: { en: { headline: 'Hi' } },
      }),
    )
  })

  it('4. items directly under Subjects make subjects by name', () => {
    expect(read('## Subjects', '- Bottle', '- Jar', 'ID: hidden')).toEqual(
      draft({ subjects: [{ name: 'Bottle' }, { name: 'Jar' }] }),
    )
  })

  it('4. a list heading reads its items, and nothing else', () => {
    expect(read('## Sizes', 'Some words', '- 1:1', '  - 4:5', '-no space')).toEqual(
      draft({ sizes: ['1:1', '4:5'] }),
    )
  })

  it('5. a text section joins lines with a space and paragraphs with a blank line', () => {
    expect(read('## Message', '', ' Glow that ', 'lasts.', '', '', 'All day.', '')).toEqual(
      draft({ message: 'Glow that lasts.\n\nAll day.' }),
    )
  })

  it('5. a known label line inside a text section sets its own field', () => {
    expect(read('## Message', 'Hello', 'Tone: Warm', 'there', 'Note: kept')).toEqual(
      draft({ message: 'Hello there Note: kept', tone: 'Warm' }),
    )
  })

  it('6. a field given twice keeps the first', () => {
    expect(
      read(
        'Region: Canada',
        'Region: France',
        '## Region',
        'Spain',
        '## Languages',
        '- en',
        'Languages: fr',
        '## Subjects',
        '- A',
        '## Subjects',
        '- B',
      ),
    ).toEqual(draft({ region: 'Canada', languages: ['en'], subjects: [{ name: 'A' }] }))
  })

  it('6. a subject field given twice keeps the first, so the heading name stays', () => {
    expect(read('## Subjects', '### Bottle', 'Name: Jar', 'ID: a', 'ID: b')).toEqual(
      draft({ subjects: [{ name: 'Bottle', id: 'a' }] }),
    )
  })

  it('7. tables, images and links stay plain text or are ignored', () => {
    expect(
      read(
        '| a | b |',
        '![x](y.png)',
        '[link](https://example.com)',
        '## Message',
        '[Shop](https://example.com) | now',
      ),
    ).toEqual(draft({ message: '[Shop](https://example.com) | now' }))
  })

  it('8. a walk that set no field is brief_unreadable', () => {
    expect(read('Just some words.', '', '- a list', '## Notes', 'More')).toEqual(unreadable)
    expect(read('')).toEqual(unreadable)
    expect(read('## Languages', '## Copy (fr)', '## Subjects')).toEqual(unreadable)
  })

  it('8. the result goes through BriefDraft', () => {
    expect(read('Region: Canada', 'Extra: dropped')).toEqual(draft({ region: 'Canada' }))
  })
})

describe('parseMarkdownBrief: word lists and copy [D2]', () => {
  it('reads per-language word lists, first per language wins', () => {
    expect(
      read(
        '## Required words (en)',
        '- serum',
        '## Required words (fr)',
        '- sérum',
        'Required words (en): x',
        'Prohibited words (de): billig, gratis',
        'Required words: plain',
      ),
    ).toEqual(
      draft({
        requiredWords: { en: ['serum'], fr: ['sérum'] },
        prohibitedWords: { de: ['billig', 'gratis'] },
      }),
    )
  })

  it('reads a plain word list, and then refuses per-language ones', () => {
    expect(read('Prohibited words: cheap', '## Prohibited words (fr)', '- x')).toEqual(
      draft({ prohibitedWords: ['cheap'] }),
    )
  })

  it('does not set the prototype from a language name', () => {
    const result = read('Required words (__proto__): x', '## Copy (__proto__)', 'Headline: Hi')
    const plain: Record<string, unknown> = {}
    expect(plain.headline).toBeUndefined()
    expect(result).toMatchObject({ ok: true })
  })

  it('a Copy heading with no language is ignored', () => {
    expect(read('## Copy', 'Headline: Hi', '## Copy ()', 'Headline: Hi')).toEqual(unreadable)
  })
})
