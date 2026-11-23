import { describe, it, expect } from 'vitest'
import {
  FILL_PROMPT,
  KEEP_PRINTING_ENDING,
  NO_TEXT_ENDING,
  prefilledPrompt,
  promptEnding,
  promptToSend,
} from '@/shared/generation/prompt'

// The runs in this block send no picture.
const none = { pictures: 0 }

const facts = {
  subjects: [{ name: 'Bottle', description: 'A green glass bottle' }],
  audience: 'Hikers',
  region: 'US',
  message: 'Stay cool on the trail',
}

describe('the fixed "no text" ending [SPEC 6.2; FR-061]', () => {
  it('is the sentence the spec gives, word for word', () => {
    expect(NO_TEXT_ENDING).toBe(
      'Do not include any text, letters, numbers, logos or watermarks in the image.',
    )
  })

  it('ends every prompt sent, after the prompt the user wrote', () => {
    expect(promptToSend('A bottle on a rock', none)).toBe(`A bottle on a rock ${NO_TEXT_ENDING}`)
  })

  it('trims the prompt before the ending is added', () => {
    expect(promptToSend('  A bottle on a rock \n', none)).toBe(
      `A bottle on a rock ${NO_TEXT_ENDING}`,
    )
  })

  it('adds the ending once when the prompt already ends with it, so a retry does not repeat it', () => {
    const once = promptToSend('A bottle', none)
    expect(promptToSend(once, none)).toBe(once)
  })

  it('still adds the ending when the user removed part of it', () => {
    const cut = 'A bottle. Do not include any text'
    expect(promptToSend(cut, none)).toBe(`${cut} ${NO_TEXT_ENDING}`)
  })
})

describe('the pre-filled prompt [SPEC 6.2; FR-062]', () => {
  it('names the subject and its description, the audience, the region and the message', () => {
    const text = prefilledPrompt(facts)
    for (const part of [
      'Bottle',
      'A green glass bottle',
      'Hikers',
      'US',
      'Stay cool on the trail',
    ]) {
      expect(text).toContain(part)
    }
  })

  it('does not hold the fixed ending, which is added when the prompt is sent', () => {
    expect(prefilledPrompt(facts)).not.toContain(NO_TEXT_ENDING)
  })

  it('leaves out an empty description', () => {
    const text = prefilledPrompt({ ...facts, subjects: [{ name: 'Bottle', description: ' ' }] })
    expect(text).not.toContain('()')
    expect(text).not.toContain(', .')
    expect(text).toContain('Bottle')
  })

  it('names every subject when there are several', () => {
    const text = prefilledPrompt({
      ...facts,
      subjects: [
        { name: 'Bottle', description: '' },
        { name: 'Cap', description: 'A red cap' },
      ],
    })
    expect(text).toContain('Bottle')
    expect(text).toContain('Cap')
    expect(text).toContain('A red cap')
  })

  it('still reads as a prompt with no subject', () => {
    const text = prefilledPrompt({ ...facts, subjects: [] })
    expect(text).toContain('Hikers')
    expect(text.trim().length).toBeGreaterThan(0)
  })
})

const KEEP =
  'Keep any printing on the things in the given pictures exactly as it appears in them. ' +
  'Add no other text, letters, numbers, logos or watermarks anywhere in the image.'
const NO_TEXT = 'Do not include any text, letters, numbers, logos or watermarks in the image.'

const endingFor = [
  { pictures: 0, ending: NO_TEXT },
  { pictures: 2, ending: KEEP },
]

describe('the two prompt endings [SP-9; A-127; FR-061]', () => {
  it('"keep printing" is the sentence the spec gives, word for word', () => {
    expect(KEEP_PRINTING_ENDING).toBe(KEEP)
  })

  it('"no text" is unchanged', () => {
    expect(NO_TEXT_ENDING).toBe(NO_TEXT)
  })

  it.each([
    { pictures: 0, ending: NO_TEXT },
    { pictures: 1, ending: KEEP },
    { pictures: 8, ending: KEEP },
  ])('promptEnding($pictures) picks the right ending', ({ pictures, ending }) => {
    expect(promptEnding(pictures)).toBe(ending)
  })

  it.each([NO_TEXT, KEEP])('does not say "product": %s', (ending) => {
    expect(ending.toLowerCase()).not.toContain('product')
  })

  it('the pre-filled prompt holds neither ending', () => {
    const text = prefilledPrompt({
      subjects: [{ name: 'Bottle', description: 'A green glass bottle' }],
      audience: 'Hikers',
      region: 'US',
      message: 'Stay cool on the trail',
    })
    expect(text).not.toContain(NO_TEXT)
    expect(text).not.toContain(KEEP)
  })
})

describe('promptToSend picks the ending from the pictures sent [SP-9]', () => {
  it.each(endingFor)('with $pictures pictures adds the right ending after one space', (c) => {
    expect(promptToSend('A bottle', { pictures: c.pictures })).toBe(`A bottle ${c.ending}`)
  })

  it.each(endingFor)('with $pictures pictures trims the prompt first', (c) => {
    expect(promptToSend('  A bottle \n', { pictures: c.pictures })).toBe(`A bottle ${c.ending}`)
  })

  it.each(endingFor)('with $pictures pictures gives the same text when called twice', (c) => {
    const once = promptToSend('A bottle', { pictures: c.pictures })
    expect(promptToSend(once, { pictures: c.pictures })).toBe(once)
  })

  it.each([
    { from: NO_TEXT, pictures: 1, ending: KEEP },
    { from: KEEP, pictures: 0, ending: NO_TEXT },
  ])('swaps an old ending for the one $pictures pictures needs', ({ from, pictures, ending }) => {
    const text = promptToSend(`A bottle ${from}`, { pictures })
    expect(text).toBe(`A bottle ${ending}`)
  })

  it.each([
    { pasted: `${NO_TEXT} ${KEEP}`, pictures: 1 },
    { pasted: `${KEEP}\n\n${NO_TEXT}`, pictures: 1 },
    { pasted: `${NO_TEXT}  \n ${KEEP}   ${NO_TEXT}`, pictures: 0 },
    { pasted: `${KEEP}\n${NO_TEXT}\n`, pictures: 0 },
  ])('leaves one ending when both are pasted (%#)', ({ pasted, pictures }) => {
    const text = promptToSend(`A bottle. ${pasted}`, { pictures })
    expect(text).toBe(`A bottle. ${promptEnding(pictures)}`)
  })

  it.each([
    { prompt: NO_TEXT, pictures: 1 },
    { prompt: KEEP, pictures: 0 },
    { prompt: ` ${KEEP} ${NO_TEXT} `, pictures: 3 },
  ])('turns a prompt that is only endings into the chosen ending alone (%#)', (c) => {
    expect(promptToSend(c.prompt, { pictures: c.pictures })).toBe(promptEnding(c.pictures))
  })

  it.each(endingFor)('with $pictures pictures leaves an ending in the middle alone', (c) => {
    const prompt = `A bottle. ${NO_TEXT} ${KEEP} On a rock.`
    expect(promptToSend(prompt, { pictures: c.pictures })).toBe(`${prompt} ${c.ending}`)
  })

  it.each(endingFor)('with $pictures pictures still adds the full ending to a cut one', (c) => {
    const cut = 'A bottle. Keep any printing on the things'
    expect(promptToSend(cut, { pictures: c.pictures })).toBe(`${cut} ${c.ending}`)
  })
})

// P5-8 [A-146] (spec/links-and-sync.md "Generative fill"): the one fixed fill sentence.
describe('FILL_PROMPT [A-146]', () => {
  it('is the fixed sentence and is sent with the "keep printing" ending once', () => {
    expect(FILL_PROMPT).toBe(
      'Extend this picture outward so it fills the whole frame. Keep everything already in ' +
        'the picture as it is, and continue the scene naturally at the edges.',
    )
    const sent = promptToSend(FILL_PROMPT, { pictures: 1 })
    expect(sent).toBe(`${FILL_PROMPT} ${KEEP_PRINTING_ENDING}`)
    expect(promptToSend(sent, { pictures: 1 })).toBe(sent)
  })
})

// spec/brief-brand.md "The art direction sentence" [A-403].
describe('the art direction sentence [spec/brief-brand.md; A-403]', () => {
  const base = {
    subjects: [{ name: 'Citrus can', description: null }],
    audience: 'young adults',
    region: 'Canada',
    message: 'Fresh all day',
    wordsOnLayers: true,
  }

  it('goes between the first sentence and the last, as the spec example', () => {
    const text = prefilledPrompt({
      ...base,
      artDirection: 'Products on the right, soft morning light',
    })
    expect(text).toBe(
      'A picture of Citrus can for an advertisement aimed at young adults in Canada. ' +
        'Art direction: Products on the right, soft morning light. ' +
        "Leave clear space for the advertisement's words, which are added separately.",
    )
  })

  it('folds each run of white space into one space and trims', () => {
    const text = prefilledPrompt({ ...base, artDirection: '  Soft\n\n light \t here ' })
    expect(text).toContain(' Art direction: Soft light here. Leave')
  })

  it.each(['Soft light.', 'Soft light!', 'Soft light?'])('adds no second stop to %j', (art) => {
    expect(prefilledPrompt({ ...base, artDirection: art })).toContain(`Art direction: ${art} Leave`)
  })

  it.each([null, undefined, '', ' \n '])('with %j gives the prompt as before', (art) => {
    for (const facts of [base, { ...base, wordsOnLayers: false }]) {
      const plain = prefilledPrompt(facts)
      expect(prefilledPrompt({ ...facts, artDirection: art })).toBe(plain)
      expect(plain).not.toContain('Art direction')
    }
  })

  it('goes before the message sentence when the layers hold no words', () => {
    const text = prefilledPrompt({ ...base, wordsOnLayers: false, artDirection: 'Soft light' })
    expect(text).toContain("Art direction: Soft light. The advertisement's message: Fresh all day")
  })

  it('goes into a video prompt too', () => {
    const text = prefilledPrompt({ ...base, kind: 'video', artDirection: 'Slow pan' })
    expect(text).toBe(
      'A video of Citrus can for an advertisement aimed at young adults in Canada. ' +
        'Art direction: Slow pan. ' +
        "Leave clear space for the advertisement's words, which are added separately.",
    )
  })
})
