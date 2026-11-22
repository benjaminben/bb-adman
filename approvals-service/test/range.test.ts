import { describe, it, expect } from 'vitest'
import { CLIP_PIECE, parseRange } from '../src/visitor/range'

// spec/phases/round-2-approvals-video.md "The clip route (service)", step 3, and SV-2: one pure
// function reads the Range header to two whole numbers; every other form is refused.

const MIB = 1024 * 1024
const TOTAL = 10 * MIB

describe('parseRange [SV-2]', () => {
  it('holds a piece of exactly 4 MiB', () => {
    expect(CLIP_PIECE).toBe(4 * MIB)
  })

  it.each([
    ['the first two bytes', 'bytes=0-1', 100, { start: 0, end: 1 }],
    ['one byte', 'bytes=5-5', 100, { start: 5, end: 5 }],
    ['an open end, cut at the last byte', 'bytes=10-', 100, { start: 10, end: 99 }],
    ['an end past the clip, cut at the last byte', 'bytes=10-500', 100, { start: 10, end: 99 }],
    ['the last byte', 'bytes=99-', 100, { start: 99, end: 99 }],
    ['an open end on a long clip, cut at 4 MiB', 'bytes=0-', TOTAL, { start: 0, end: 4 * MIB - 1 }],
    [
      'a range longer than 4 MiB, cut at 4 MiB',
      `bytes=${MIB}-${9 * MIB}`,
      TOTAL,
      { start: MIB, end: 5 * MIB - 1 },
    ],
    ['exactly 4 MiB', `bytes=0-${4 * MIB - 1}`, TOTAL, { start: 0, end: 4 * MIB - 1 }],
    ['15 digits', 'bytes=000000000000001-', 100, { start: 1, end: 99 }],
  ])('reads %s', (_, text, total, expected) => {
    expect(parseRange(text, total)).toEqual({ kind: 'piece', ...expected })
  })

  it.each([
    ['no header', null],
    ['an empty header', ''],
    ['several ranges', 'bytes=0-1, 5-9'],
    ['several ranges without a space', 'bytes=0-1,5-9'],
    ['a suffix', 'bytes=-500'],
    ['a space after the equals sign', 'bytes= 0-1'],
    ['a space before the dash', 'bytes=0 -1'],
    ['a space at the end', 'bytes=0-1 '],
    ['a space at the start', ' bytes=0-1'],
    ['16 digits', 'bytes=0000000000000001-'],
    ['an end of 16 digits', 'bytes=0-1000000000000000'],
    ['another unit', 'items=0-1'],
    ['a capital unit', 'Bytes=0-1'],
    ['no dash', 'bytes=0'],
    ['a sign', 'bytes=+0-1'],
    ['a fraction', 'bytes=0.5-1'],
    ['digits that are not ASCII', 'bytes=٠-١'],
    ['a new line', 'bytes=0-1\n'],
    ['41 characters', `bytes=0-${'1'.repeat(15)}${' '.repeat(18)}`],
  ])('refuses %s', (_, text) => {
    expect(parseRange(text, 100)).toEqual({ kind: 'bad' })
  })

  it('reads the longest form the pattern takes, 37 characters', () => {
    const text = `bytes=${'0'.repeat(15)}-${'0'.repeat(15)}`
    expect(text.length).toBe(37)
    expect(parseRange(text, 100)).toEqual({ kind: 'piece', start: 0, end: 0 })
  })

  it.each([
    ['a start at the total', 'bytes=100-', 100],
    ['a start past the total', 'bytes=150-200', 100],
    ['an end before the start', 'bytes=9-5', 100],
    ['any range of an empty clip', 'bytes=0-', 0],
  ])('answers %s as unsatisfiable', (_, text, total) => {
    expect(parseRange(text, total)).toEqual({ kind: 'unsatisfiable' })
  })
})
