import { faces, fontSet } from './fake-fonts'
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  DEFAULT_FONT_FAMILY,
  fontFamilyOf,
  registerDefaultFont,
  useSceneFonts,
} from '@/shared/scene/font-faces'

const font = (assetId: string, version: number) => ({
  assetId,
  url: `adman-asset://p1/${assetId}`,
  version,
})
const named = (family: string) => faces.filter((face) => face.family === family)

describe('font family names [FR-056]', () => {
  it.each([
    { id: null, want: '"adman-default"' },
    { id: 'F1', want: '"adman-font-F1", "adman-default"' },
  ])('fontFamilyOf($id) is $want', ({ id, want }) => {
    expect(fontFamilyOf(id)).toBe(want)
  })

  it('calls the bundled font adman-default', () => {
    expect(DEFAULT_FONT_FAMILY).toBe('adman-default')
  })
})

describe('registerDefaultFont', () => {
  it('registers the bundled Inter once, for weights 100 to 900', () => {
    registerDefaultFont()
    registerDefaultFont()
    const inter = named('adman-default')
    expect(inter).toHaveLength(1)
    expect(inter[0]?.source).toMatch(/^url\(".*InterVariable.*\.woff2"\)$/)
    expect(inter[0]?.descriptors).toEqual({ weight: '100 900', style: 'normal' })
    expect(fontSet.has(inter[0]!)).toBe(true)
  })
})

describe('useSceneFonts [FR-093]', () => {
  it('adds one FontFace per asset and version, for every weight', async () => {
    const { result, rerender } = renderHook((fonts) => useSceneFonts(fonts), {
      initialProps: [font('A', 1), font('A', 1)],
    })
    rerender([font('A', 1)])
    await result.current
    const faceA = named('adman-font-A')
    expect(faceA).toHaveLength(1)
    expect(faceA[0]?.source).toBe('url("adman-asset://p1/A")')
    expect(faceA[0]?.descriptors).toEqual({ weight: '1 1000', style: 'normal' })
    expect(fontSet.has(faceA[0]!)).toBe(true)
  })

  it('registers a changed file again and drops the older face', () => {
    const { rerender } = renderHook((fonts) => useSceneFonts(fonts), {
      initialProps: [font('B', 1)],
    })
    rerender([font('B', 2)])
    const faceB = named('adman-font-B')
    expect(faceB).toHaveLength(2)
    expect(fontSet.has(faceB[0]!)).toBe(false)
    expect(fontSet.has(faceB[1]!)).toBe(true)
  })

  it('settles when a font fails to load', async () => {
    const real = globalThis.FontFace.prototype.load
    globalThis.FontFace.prototype.load = () => Promise.reject(new Error('not a font'))
    const { result } = renderHook(() => useSceneFonts([font('C', 1)]))
    await expect(result.current).resolves.toBeUndefined()
    globalThis.FontFace.prototype.load = real
  })
})
