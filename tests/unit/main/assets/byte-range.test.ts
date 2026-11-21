import { describe, it, expect } from 'vitest'
import { parseRange } from '@/main/assets/byte-range'

const SIZE = 1000

describe('parseRange [P7-6]', () => {
  it.each([
    ['no header', null, SIZE, 'whole'],
    ['an empty header', '', SIZE, 'whole'],
    ['a closed range', 'bytes=100-199', SIZE, { start: 100, end: 199 }],
    ['the first byte', 'bytes=0-0', SIZE, { start: 0, end: 0 }],
    ['the last byte', 'bytes=999-999', SIZE, { start: 999, end: 999 }],
    ['an open range', 'bytes=900-', SIZE, { start: 900, end: 999 }],
    ['a suffix', 'bytes=-100', SIZE, { start: 900, end: 999 }],
    ['a suffix longer than the file', 'bytes=-5000', SIZE, { start: 0, end: 999 }],
    ['an end past the file', 'bytes=500-5000', SIZE, { start: 500, end: 999 }],
    ['a start at the size', 'bytes=1000-1001', SIZE, 'unsatisfiable'],
    ['a start past the size', 'bytes=5000-', SIZE, 'unsatisfiable'],
    ['a zero suffix', 'bytes=-0', SIZE, 'unsatisfiable'],
    ['any range of an empty file', 'bytes=0-', 0, 'unsatisfiable'],
    ['a suffix of an empty file', 'bytes=-10', 0, 'unsatisfiable'],
    ['a reversed range', 'bytes=100-50', SIZE, 'whole'],
    ['letters', 'bytes=a-b', SIZE, 'whole'],
    ['a hex number', 'bytes=0x10-20', SIZE, 'whole'],
    ['a minus sign', 'bytes=-1-5', SIZE, 'whole'],
    ['17 digits', 'bytes=00000000000000001-', SIZE, 'whole'],
    ['16 digits', 'bytes=0000000000000001-', SIZE, { start: 1, end: 999 }],
    ['a 16 digit end, cut to the file', 'bytes=0-9999999999999999', SIZE, { start: 0, end: 999 }],
    ['a 17 digit suffix', 'bytes=-10000000000000000', SIZE, 'whole'],
    ['two ranges', 'bytes=0-1,5-6', SIZE, 'whole'],
    ['a trailing comma', 'bytes=0-1,', SIZE, 'whole'],
    ['a space', 'bytes= 0-1', SIZE, 'whole'],
    ['a trailing space', 'bytes=0-1 ', SIZE, 'whole'],
    ['another unit', 'items=0-1', SIZE, 'whole'],
    ['an upper-case unit', 'BYTES=0-1', SIZE, 'whole'],
    ['no numbers', 'bytes=-', SIZE, 'whole'],
    ['no dash', 'bytes=5', SIZE, 'whole'],
    ['a line break', 'bytes=0-1\n', SIZE, 'whole'],
  ] as const)('%s', (_name, header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected)
  })
})
