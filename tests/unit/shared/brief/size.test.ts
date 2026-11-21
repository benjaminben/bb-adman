import { describe, it, expect } from 'vitest'
import { parseSize } from '../../../../src/shared/brief/size'

describe('parseSize: ready-made sizes rule [SPEC 3.3 1.8, 14 slice B]', () => {
  it.each(['4:5', '4x5', '1080x1350'])('gives the ready-made 4x5 size for %s', (text) => {
    expect(parseSize(text)).toEqual({ label: '4x5', width: 1080, height: 1350 })
  })

  it.each([
    ['1:1', '1x1', 1080, 1080],
    ['1080x1080', '1x1', 1080, 1080],
    ['9:16', '9x16', 1080, 1920],
    ['1080x1920', '9x16', 1080, 1920],
    ['16:9', '16x9', 1920, 1080],
    ['16x9', '16x9', 1920, 1080],
    ['1920x1080', '16x9', 1920, 1080],
  ])('gives %s the ready-made label %s', (text, label, width, height) => {
    expect(parseSize(text)).toEqual({ label, width, height })
  })

  it('keeps {width}x{height} for a pixel size that is not ready-made', () => {
    expect(parseSize('1200x628')).toEqual({ label: '1200x628', width: 1200, height: 628 })
  })
})

describe('parseSize: custom ratios [SPEC 3.3, FR-032]', () => {
  it('makes the shorter side 1080 for a wide ratio', () => {
    expect(parseSize('3:2')).toEqual({ label: '1620x1080', width: 1620, height: 1080 })
  })

  it('makes the shorter side 1080 for a tall ratio', () => {
    expect(parseSize('2:3')).toEqual({ label: '1080x1620', width: 1080, height: 1620 })
  })

  it('rounds the longer side to whole pixels', () => {
    expect(parseSize('7:3')).toEqual({ label: '2520x1080', width: 2520, height: 1080 })
    expect(parseSize('3:7')).toEqual({ label: '1080x2520', width: 1080, height: 2520 })
    expect(parseSize('11:7')).toEqual({ label: '1697x1080', width: 1697, height: 1080 })
  })
})

describe('parseSize: what is accepted around the numbers', () => {
  it('ignores spaces at both ends and around the separator', () => {
    expect(parseSize('  4 : 5 ')).toEqual({ label: '4x5', width: 1080, height: 1350 })
    expect(parseSize(' 1200 x 628 ')).toEqual({ label: '1200x628', width: 1200, height: 628 })
  })

  it('accepts X and × as the pixel separator', () => {
    expect(parseSize('1200X628')).toEqual({ label: '1200x628', width: 1200, height: 628 })
    expect(parseSize('1080×1350')).toEqual({ label: '4x5', width: 1080, height: 1350 })
  })

  it('drops leading zeros so the label stays file-safe', () => {
    expect(parseSize('01200x0628')).toEqual({ label: '1200x628', width: 1200, height: 628 })
  })
})

describe('parseSize: text that is not a size gives null', () => {
  it.each([
    '',
    '   ',
    'square',
    '1:',
    ':1',
    'x1080',
    '1080x',
    '0:1',
    '1:0',
    '0x1080',
    '1080x0',
    '-4:5',
    '1080.5x1350',
    '1:1:1',
    '1080x1080x1',
    '1e3x1080',
    '99999999999999999999x1080',
    '1:99999999999999999999',
    '9007199254740991:1',
    '1:9007199254740991',
  ])('refuses %j', (text) => {
    expect(parseSize(text)).toBeNull()
  })
})

describe('parseSize: decimal ratios [SPEC 3.3 1.23, 14 N4]', () => {
  it.each([
    ['1.91:1', '2063x1080', 2063, 1080],
    ['1:1.91', '1080x2063', 1080, 2063],
    ['4.5:1', '4860x1080', 4860, 1080],
    ['4:5.0', '4x5', 1080, 1350],
    ['1.0:1', '1x1', 1080, 1080],
  ])('gives %s the size %s', (text, label, width, height) => {
    expect(parseSize(text)).toEqual({ label, width, height })
  })

  it.each(['1,91:1', '.5:1', '1.:1', '0.0:1', '1.5x2', '1.9.1:1', '1.5e1:1', '+1.5:1'])(
    'refuses %j',
    (text) => {
      expect(parseSize(text)).toBeNull()
    },
  )
})

describe('parseSize: two numbers below 100 with x are a ratio [SPEC 3.3 1.23, 14 N4]', () => {
  it('reads 2x3 as the ratio 2:3', () => {
    expect(parseSize('2x3')).toEqual({ label: '1080x1620', width: 1080, height: 1620 })
  })

  it('reads 99x99 as the ready-made 1x1', () => {
    expect(parseSize('99x99')).toEqual({ label: '1x1', width: 1080, height: 1080 })
  })

  it('keeps a pixel size when either number is 100 or more', () => {
    expect(parseSize('50x1080')).toEqual({ label: '50x1080', width: 50, height: 1080 })
    expect(parseSize('100x100')).toEqual({ label: '100x100', width: 100, height: 100 })
  })
})

describe('parseSize: each side from 50 to 8,192 pixels [SPEC 3.3 1.26, 14 P5]', () => {
  it.each([
    ['8192x8192', { label: '8192x8192', width: 8192, height: 8192 }],
    ['300x50', { label: '300x50', width: 300, height: 50 }],
    ['7.5:1', { label: '8100x1080', width: 8100, height: 1080 }],
  ])('accepts %s', (text, expected) => {
    expect(parseSize(text)).toEqual(expected)
  })

  it.each(['8193x1080', '1080x8193', '49x1080', '100x49', '1000x10', '1:8'])(
    'refuses %s',
    (text) => {
      expect(parseSize(text)).toBeNull()
    },
  )
})
