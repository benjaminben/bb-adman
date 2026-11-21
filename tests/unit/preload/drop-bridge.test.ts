// spec/security.md "The drop bridge" (S2-3): window.drop.pathOf returns Electron's answer
// for a File and '' for anything else, and never throws to the page.
import { beforeAll, describe, expect, it, vi } from 'vitest'

const exposed: Record<string, unknown> = {}
const getPathForFile = vi.fn((file: File): string => (file.name === 'a.png' ? '/photos/a.png' : ''))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      exposed[key] = value
    },
  },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: { getPathForFile: (file: File) => getPathForFile(file) },
}))

type Drop = { pathOf(value: unknown): unknown }
let drop: Drop

beforeAll(async () => {
  await import('@/preload/index')
  drop = exposed.drop as Drop
})

describe('drop bridge in the preload [S2-3]', () => {
  it('exposes window.drop with pathOf and nothing else', () => {
    expect(Object.keys(drop)).toEqual(['pathOf'])
  })

  it('gives the path Electron gives for a file', () => {
    expect(drop.pathOf(new File(['x'], 'a.png'))).toBe('/photos/a.png')
  })

  it('gives an empty string when Electron gives one', () => {
    expect(drop.pathOf(new File(['x'], 'made.png'))).toBe('')
  })

  it('never asks Electron about a value that is not a File', () => {
    getPathForFile.mockClear()
    for (const value of ['/etc/hosts', { name: 'a.png' }, undefined, null, 3, new Blob(['x'])]) {
      expect(drop.pathOf(value)).toBe('')
    }
    expect(getPathForFile).not.toHaveBeenCalled()
  })

  it('gives an empty string instead of throwing when Electron throws', () => {
    getPathForFile.mockImplementationOnce(() => {
      throw new Error('not a file')
    })
    expect(drop.pathOf(new File(['x'], 'a.png'))).toBe('')
  })

  it('gives an empty string when Electron gives something other than a string', () => {
    getPathForFile.mockImplementationOnce(() => undefined as unknown as string)
    expect(drop.pathOf(new File(['x'], 'a.png'))).toBe('')
  })
})
