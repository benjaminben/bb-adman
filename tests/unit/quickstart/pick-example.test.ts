import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { aboutExample, offered, pickedExample, pickerLines } from '../../../quickstart/pick-example'

const briefOf = (name: string) =>
  readFile(new URL(`../../../quickstart/examples/${name}/brief.yaml`, import.meta.url), 'utf8')

describe('offered', () => {
  it('puts the default example first and the rest in name order', () => {
    expect(offered(['zebra', 'apple', 'simple-routine'])).toEqual([
      'simple-routine',
      'apple',
      'zebra',
    ])
  })

  it('keeps name order when the default example is missing', () => {
    expect(offered(['b-two', 'a-one'])).toEqual(['a-one', 'b-two'])
  })
})

describe('aboutExample', () => {
  it('says what the first example makes', async () => {
    expect(aboutExample(await briefOf('simple-routine'))).toBe(
      '2 subjects in one picture, 3 languages, 3 sizes: 9 ads',
    )
  })

  it('says what an example with one set of ads per subject makes', async () => {
    expect(aboutExample(await briefOf('summer-splash'))).toBe(
      'one set of ads for each of 2 subjects, 2 languages, 3 sizes: 12 ads',
    )
  })

  it('uses the singular for one of a thing', () => {
    const brief = [
      'campaignName: One',
      'region: France',
      'audience: People who like tea',
      'message: Drink up',
      'callToAction: Start today',
      'subjects:',
      '  - name: Cup',
    ].join('\n')
    expect(aboutExample(brief)).toBe('1 subject, 1 language, 1 size: 1 ad')
  })

  it('says so when the brief cannot be read', () => {
    expect(aboutExample('')).toBe('its brief cannot be read')
    expect(aboutExample(': : :')).toBe('its brief cannot be read')
  })
})

describe('pickerLines', () => {
  it('numbers the examples, lines up what each makes and says how to skip the question', () => {
    const lines = pickerLines([
      { name: 'simple-routine', about: 'nine ads' },
      { name: 'short', about: 'two ads' },
    ])
    expect(lines).toEqual([
      'Which example do you want to run?',
      '',
      '  1. simple-routine   nine ads',
      '  2. short            two ads',
      '',
      'To skip this question next time, add --example=<name>.',
    ])
  })
})

describe('pickedExample', () => {
  const names = ['simple-routine', 'summer-splash']

  it('takes the first example when nothing is typed', () => {
    expect(pickedExample('', names)).toBe('simple-routine')
    expect(pickedExample('   ', names)).toBe('simple-routine')
  })

  it('takes an example by its number', () => {
    expect(pickedExample('1', names)).toBe('simple-routine')
    expect(pickedExample(' 2 ', names)).toBe('summer-splash')
  })

  it('takes an example by its name, in any case', () => {
    expect(pickedExample('Summer-Splash', names)).toBe('summer-splash')
  })

  it('refuses a number or a name that is not in the list', () => {
    for (const answer of ['0', '3', '-1', '1.5', 'two', '../etc']) {
      expect(pickedExample(answer, names)).toBeNull()
    }
  })

  it('refuses everything when there are no examples', () => {
    expect(pickedExample('', [])).toBeNull()
  })
})
