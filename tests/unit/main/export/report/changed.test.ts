// P8-7 [FR-238, A-199]: each ad against the previous export's stored rev.
import { describe, expect, it } from 'vitest'
import { changedSince } from '@/main/export/report/changed'
import type { Report } from '@/shared/schemas/report'

const previous = { variants: [{ variantId: 'v1', rev: 4 }] } as unknown as Report

describe('changedSince [FR-238]', () => {
  it.each([
    ['a first export', null, 'v1', 4, null],
    ['a changed rev', previous, 'v1', 5, 'changed'],
    ['the same rev', previous, 'v1', 4, 'unchanged'],
    ['an ad the previous export did not hold', previous, 'v2', 0, 'not_in_previous'],
  ] as const)('marks %s', (_, prev, variantId, rev, expected) => {
    expect(changedSince(prev, variantId, rev)).toBe(expected)
  })
})
