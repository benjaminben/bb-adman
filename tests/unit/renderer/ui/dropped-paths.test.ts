// spec/screens-campaign.md "Importing by dropping files" (S2-3): the renderer reads
// window.drop only through droppedPaths, which leaves out empty answers.
import { afterEach, describe, expect, it } from 'vitest'
import { droppedPaths } from '@/renderer/ui/dropped-paths'
import type { DropApi } from '@/shared/schemas/drop-api'

const paths = new Map<string, string>()
const standIn: DropApi = { pathOf: (file) => paths.get(file.name) ?? '' }

// jsdom has no DataTransfer, so a FileList is stood in by an array with item().
function list(names: string[]): FileList {
  const files = names.map((name) => new File(['x'], name))
  return Object.assign(files, { item: (i: number) => files[i] ?? null }) as unknown as FileList
}

afterEach(() => {
  paths.clear()
  Reflect.deleteProperty(window, 'drop')
})

describe('droppedPaths [S2-3, FR-246]', () => {
  it('gives the paths in the order the files were dropped', () => {
    paths.set('b.png', '/photos/b.png')
    paths.set('a.png', '/photos/a.png')
    paths.set('c.mp4', '/clips/c.mp4')
    window.drop = standIn
    expect(droppedPaths(list(['b.png', 'a.png', 'c.mp4']))).toEqual([
      '/photos/b.png',
      '/photos/a.png',
      '/clips/c.mp4',
    ])
  })

  it('leaves out the files the bridge gives no path for', () => {
    paths.set('a.png', '/photos/a.png')
    window.drop = standIn
    expect(droppedPaths(list(['made.png', 'a.png', 'other.png']))).toEqual(['/photos/a.png'])
  })

  it('gives an empty list when there is no window.drop', () => {
    expect(droppedPaths(list(['a.png']))).toEqual([])
  })

  it('gives an empty list for no files', () => {
    window.drop = standIn
    expect(droppedPaths(list([]))).toEqual([])
  })
})
