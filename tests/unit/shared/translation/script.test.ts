// P6-6 (spec/phases/phase-06.md, design addition 2, "Chinese script"; A-158): the one rule for
// the Chinese script, by the campaign's region, shared by the translate instruction.
import { describe, it, expect } from 'vitest'
import { chineseScript } from '@/shared/translation/script'

describe('chineseScript [A-158]', () => {
  it.each([
    ['TW', 'traditional'],
    ['Taiwan', 'traditional'],
    ['hong kong', 'traditional'],
    ['HK', 'traditional'],
    ['MO', 'traditional'],
    ['Macau', 'traditional'],
    ['  tw  ', 'traditional'],
    ['CN', 'simplified'],
    ['China', 'simplified'],
    ['SG', 'simplified'],
    ['Somewhere else', 'simplified'],
    ['', 'simplified'],
  ] as const)('region %j gives %s', (region, script) => {
    expect(chineseScript(region)).toBe(script)
  })
})
