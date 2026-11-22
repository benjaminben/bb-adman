// spec/phases/round-2-editor.md, D1 [R2E-1]: the default prompt leaves out the brief's message
// when the ad already holds words on its text layers.
import { describe, expect, it } from 'vitest'
import { hasWordsOnLayers, prefilledPrompt } from '@/shared/generation/prompt'

const facts = {
  subjects: [{ name: 'Bottle', description: 'A green glass bottle' }],
  audience: 'Hikers',
  region: 'US',
  message: 'Stay cool on the trail',
}
const bare = { ...facts, subjects: [] }
const SPACE = "Leave clear space for the advertisement's words, which are added separately."

describe('prefilledPrompt with words on layers [R2E-1, D1]', () => {
  it.each([
    [
      'a picture with subjects',
      { ...facts, wordsOnLayers: true },
      `A picture of Bottle (A green glass bottle) for an advertisement aimed at Hikers in US. ${SPACE}`,
    ],
    [
      'a picture without subjects',
      { ...bare, wordsOnLayers: true },
      `A picture for an advertisement aimed at Hikers in US. ${SPACE}`,
    ],
    [
      'a video with subjects',
      { ...facts, wordsOnLayers: true, kind: 'video' as const },
      `A video of Bottle (A green glass bottle) for an advertisement aimed at Hikers in US. ${SPACE}`,
    ],
    [
      'a video without subjects',
      { ...bare, wordsOnLayers: true, kind: 'video' as const },
      `A video for an advertisement aimed at Hikers in US. ${SPACE}`,
    ],
    [
      'a video without words keeps the message',
      { ...facts, kind: 'video' as const },
      'A video of Bottle (A green glass bottle) for an advertisement aimed at Hikers in US. ' +
        "The advertisement's message: Stay cool on the trail",
    ],
    [
      'no words on layers keeps the message',
      { ...facts, wordsOnLayers: false },
      'A picture of Bottle (A green glass bottle) for an advertisement aimed at Hikers in US. ' +
        "The advertisement's message: Stay cool on the trail",
    ],
  ])('%s', (_name, input, expected) => {
    expect(prefilledPrompt(input)).toBe(expected)
  })

  it('never names the message when the words are on layers', () => {
    expect(prefilledPrompt({ ...facts, wordsOnLayers: true })).not.toContain('Stay cool')
  })

  it('gives the old text word for word when the new fields are absent', () => {
    expect(prefilledPrompt(facts)).toBe(
      'A picture of Bottle (A green glass bottle) for an advertisement aimed at Hikers in US. ' +
        "The advertisement's message: Stay cool on the trail",
    )
  })
})

describe('hasWordsOnLayers [R2E-1, D1]', () => {
  const text = (over: { visible?: boolean; copy?: string | null } = {}) => ({
    type: 'text' as const,
    visible: over.visible ?? true,
    copy: over.copy === undefined ? 'Stay cool' : over.copy,
  })
  const image = { type: 'image' as const, visible: true, copy: null }

  it.each([
    ['no layers', [], false],
    ['a visible text layer with words', [text()], true],
    ['a hidden text layer', [text({ visible: false })], false],
    ['a blank text layer', [text({ copy: '   \n' })], false],
    ['a text layer with no copy', [text({ copy: null })], false],
    ['an image layer only', [image], false],
    ['an image and a filled text layer', [image, text()], true],
  ])('%s: %s', (_name, layers, expected) => {
    expect(hasWordsOnLayers(layers)).toBe(expected)
  })
})
