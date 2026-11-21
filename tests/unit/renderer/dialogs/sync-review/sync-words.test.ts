// spec/screens-variants.md, "Sync review": the words for each group of a change, and the words
// for a blocked override path (the group word, and for style.* and animation.* the field after
// a colon).
import { describe, expect, it } from 'vitest'
import { groupWords, pathWords } from '@/renderer/dialogs/sync-review/sync-words'

describe('sync words', () => {
  it.each([
    ['copy', 'text'],
    ['style', 'style'],
    ['geometry', 'position and size'],
    ['source', 'picture'],
    ['timing', 'timing'],
    ['animation', 'animation'],
  ] as const)('the group %s reads "%s"', (group, words) => {
    expect(groupWords([group])).toBe(words)
  })

  it('joins several groups with commas, in the order given', () => {
    expect(groupWords(['copy', 'style', 'geometry'])).toBe('text, style, position and size')
  })

  it.each([
    ['copy', 'text'],
    ['geometry', 'position and size'],
    ['source', 'picture'],
    ['timing', 'timing'],
    ['style.color', 'style: colour'],
    ['style.fontSize', 'style: font size'],
    ['style.boxOutlineColor', 'style: outline colour'],
    ['style.opacity', 'style: opacity'],
    ['animation.entrance', 'animation: entrance'],
    ['animation.exit', 'animation: exit'],
    ['style.someNewField', 'style: some new field'],
  ])('the path %s reads "%s"', (path, words) => {
    expect(pathWords(path)).toBe(words)
  })
})
