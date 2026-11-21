// P5-3: the override paths of a patch and which of them follow for a variant
// (spec/links-and-sync.md, "Overrides"; A-135).
import { describe, it, expect } from 'vitest'
import { addPaths, inheritedPaths, pathsOfPatch } from '@/shared/links/override-paths'

const block = { preset: 'fade', durationMs: 300 }

describe('pathsOfPatch [spec/links-and-sync.md "Overrides"]', () => {
  it.each([
    ['a copy', { copy: 'Hi' }, ['copy']],
    ['a source', { source: { assetId: 'a' } }, ['source']],
    ['a cleared source', { source: null }, ['source']],
    ['a whole geometry', { geometry: { x: 1, width: 4 } }, ['geometry']],
    [
      'two style fields',
      { style: { color: '#000000', fontSize: 9 } },
      ['style.color', 'style.fontSize'],
    ],
    ['one animation block', { animation: { exit: block } }, ['animation.exit']],
    ['a timing', { timing: { startMs: 0, endMs: 10 } }, ['timing']],
    ['a name-only patch', { name: 'A' }, []],
    ['visible and locked', { visible: false, locked: true }, []],
  ])('%s', (_label, patch, paths) => {
    expect(pathsOfPatch(patch)).toEqual(paths)
  })
})

describe('inheritedPaths [A-135]', () => {
  const master = { width: 1080, height: 1080, language: 'en' }
  const paths = ['copy', 'geometry', 'style.color', 'source', 'animation.entrance']

  it('keeps every path on a variant of the same size and language', () => {
    expect(inheritedPaths(paths, master, { ...master })).toEqual(paths)
  })

  it('drops geometry at another size', () => {
    const variant = { ...master, height: 1920 }
    expect(inheritedPaths(paths, master, variant)).toEqual(paths.filter((p) => p !== 'geometry'))
  })

  it('drops copy in another language', () => {
    const variant = { ...master, language: 'de' }
    expect(inheritedPaths(paths, master, variant)).toEqual(paths.filter((p) => p !== 'copy'))
  })
})

describe('addPaths', () => {
  it('adds each path once and keeps first-added order', () => {
    expect(addPaths(['style.color', 'copy'], ['copy', 'geometry', 'style.color'])).toEqual([
      'style.color',
      'copy',
      'geometry',
    ])
  })
})
