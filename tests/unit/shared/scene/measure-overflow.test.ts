import { describe, expect, it } from 'vitest'
import { measureOverflow } from '@/shared/scene/measure-overflow'

const box = (scrollWidth: number, scrollHeight: number) =>
  ({ clientWidth: 300, clientHeight: 100, scrollWidth, scrollHeight }) as HTMLElement

describe('measureOverflow [FR-098]', () => {
  it.each([
    { name: 'text that fits', width: 300, height: 100, want: false },
    { name: 'one pixel over, from rounding', width: 301, height: 101, want: false },
    { name: 'too tall', width: 300, height: 102, want: true },
    { name: 'too wide', width: 302, height: 100, want: true },
  ])('$name overflows: $want', ({ width, height, want }) => {
    expect(measureOverflow(box(width, height))).toBe(want)
  })
})
