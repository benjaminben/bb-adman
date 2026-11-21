import { describe, it, expect } from 'vitest'
import { pictureName } from '@/shared/brief/picture-name'

// Characters written by number, so no invisible mark sits in this file.
const ch = (...points: number[]) => String.fromCodePoint(...points)

// spec/subject-photos.md "Shown names": a note shows the file name only, cleaned.
describe('pictureName: the name a photo note shows [D-098]', () => {
  it.each([
    ['photos/a.png', 'a.png'],
    ['C:\\x\\b.jpg', 'b.jpg'],
    ['photos\\deep/c.webp', 'c.webp'],
    ['plain.png', 'plain.png'],
  ])('gives the part after the last separator of %j', (text, name) => {
    expect(pictureName(text)).toBe(name)
  })

  it('removes a right-to-left mark and turns a tab into a space', () => {
    expect(pictureName(`photos/a${ch(0x202e)}gnp.exe`)).toBe('agnp.exe')
    expect(pictureName('photos/a\tb.png')).toBe('a b.png')
  })

  it('cuts a name of 200 letters to 120 with "…"', () => {
    expect(pictureName(`photos/${'a'.repeat(200)}`)).toBe(`${'a'.repeat(120)}…`)
  })

  it.each(['', 'photos/', 'photos\\', ch(0x200f)])('gives (no name) for %j', (text) => {
    expect(pictureName(text)).toBe('(no name)')
  })
})
