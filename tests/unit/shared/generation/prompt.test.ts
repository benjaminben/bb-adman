import { describe, it, expect } from 'vitest'
import {
  NO_TEXT_ENDING,
  prefilledPrompt,
  promptToSend,
} from '../../../../src/shared/generation/prompt'

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
    expect(promptToSend('A bottle on a rock')).toBe(`A bottle on a rock ${NO_TEXT_ENDING}`)
  })

  it('trims the prompt before the ending is added', () => {
    expect(promptToSend('  A bottle on a rock \n')).toBe(`A bottle on a rock ${NO_TEXT_ENDING}`)
  })

  it('adds the ending once when the prompt already ends with it, so a retry does not repeat it', () => {
    const once = promptToSend('A bottle')
    expect(promptToSend(once)).toBe(once)
  })

  it('still adds the ending when the user removed part of it', () => {
    const cut = 'A bottle. Do not include any text'
    expect(promptToSend(cut)).toBe(`${cut} ${NO_TEXT_ENDING}`)
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
