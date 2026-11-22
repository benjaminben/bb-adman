// R2E-3 (spec/phases/round-2-editor.md D3): the clamp keeps a type style only when it is one of
// the ids the job offered, the job result's schema takes it, and the patches put its three
// fields on the layer, never a font file.
import { describe, it, expect } from 'vitest'
import { clampLayout, type RawLayoutBox } from '@/shared/generation/layout-clamp'
import { layoutPatches } from '@/shared/generation/layout-patches'
import { layoutBox, type LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'
import { TYPE_STYLE_IDS } from '@/shared/config/type-styles'

const raw = (typeStyle?: unknown): RawLayoutBox => ({
  slot: 'headline',
  x: 10,
  y: 20,
  width: 300,
  height: 100,
  fontSize: 40,
  color: '#112233',
  align: 'left',
  ...(typeStyle !== undefined && { typeStyle }),
})

const limits = { width: 1000, height: 500, palette: [] as string[], keys: ['headline'] }
const clamped = (typeStyle: unknown, typeStyles?: string[]) =>
  clampLayout([raw(typeStyle)], { ...limits, ...(typeStyles && { typeStyles }) })[0]

describe('clampLayout with type styles [R2E-3, D3]', () => {
  it('keeps a known style the job offered', () => {
    expect(clamped('black-caps', TYPE_STYLE_IDS)?.typeStyle).toBe('black-caps')
  })

  it.each([['heavy'], ['BOLD'], [''], [7], [null], [{ id: 'bold' }]])(
    'turns %j into null when styles were offered',
    (bad) => {
      expect(clamped(bad, TYPE_STYLE_IDS)?.typeStyle).toBeNull()
    },
  )

  it('turns a missing style into null when styles were offered', () => {
    expect(clamped(undefined, TYPE_STYLE_IDS)?.typeStyle).toBeNull()
  })

  it('turns a known id the job did not offer into null', () => {
    expect(clamped('bold', ['regular'])?.typeStyle).toBeNull()
  })

  it('gives no style when none was offered, even if the answer names one', () => {
    expect(clamped('bold')?.typeStyle ?? null).toBeNull()
    expect(clamped('bold')).not.toHaveProperty('typeStyle')
  })

  it('keeps no other new field of the answer', () => {
    const extra = { ...raw('bold'), fontAssetId: 'a-1', path: '/Users/someone/x.woff2' }
    const [box] = clampLayout([extra], { ...limits, typeStyles: TYPE_STYLE_IDS })
    expect(Object.keys(box ?? {}).sort()).toEqual(
      ['align', 'color', 'fontSize', 'height', 'slot', 'typeStyle', 'width', 'x', 'y'].sort(),
    )
  })
})

const box = (over: Partial<LayoutJobBox>): LayoutJobBox => ({
  slot: 'headline',
  x: 1,
  y: 2,
  width: 30,
  height: 40,
  fontSize: 12,
  color: null,
  align: 'left',
  ...over,
})

describe('layoutBox schema with typeStyle [R2E-3]', () => {
  it('takes one of the five ids, null or none, and refuses any other text', () => {
    expect(layoutBox.safeParse(box({ typeStyle: 'light' })).success).toBe(true)
    expect(layoutBox.safeParse(box({ typeStyle: null })).success).toBe(true)
    expect(layoutBox.safeParse(box({})).success).toBe(true)
    expect(layoutBox.safeParse({ ...box({}), typeStyle: 'heavy' }).success).toBe(false)
  })
})

describe('layoutPatches with a type style [R2E-3]', () => {
  const layers = [{ id: 'l-head', key: 'headline', type: 'text' }]

  it('adds the three fields of the style and never fontAssetId', () => {
    const [patch] = layoutPatches([box({ typeStyle: 'spaced-caps' })], layers)
    expect(patch?.patch.style).toEqual({
      fontSize: 12,
      align: 'left',
      fontWeight: 500,
      allCaps: true,
      letterSpacing: 0.12,
    })
    expect(patch?.patch.style).not.toHaveProperty('fontAssetId')
  })

  it('leaves the style patch as before for a null or missing style', () => {
    const [none, empty] = layoutPatches([box({ typeStyle: null }), box({})], [...layers, ...layers])
    expect(none?.patch.style).toEqual({ fontSize: 12, align: 'left' })
    expect(empty?.patch.style).toEqual({ fontSize: 12, align: 'left' })
  })
})
