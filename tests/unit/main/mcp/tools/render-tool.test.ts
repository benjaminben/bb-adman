// P10-3 (A-234): the render_variant row replies one PNG and its picker names one field.
import { describe, it, expect } from 'vitest'
import { pngOnly, RENDER_TOOLS } from '@/main/mcp/tools/render-tool'

const PNG = new Uint8Array([137, 80, 78, 71])

describe('the render_variant row [P10-3, A-234]', () => {
  it('is a png row over variant.render, with the pngOnly picker', () => {
    const row = RENDER_TOOLS.find((t) => t.name === 'render_variant')
    expect(row).toMatchObject({ kind: 'query', target: 'variant.render', content: 'png' })
    expect(row?.notBuilt).toBeUndefined()
    expect(row?.reply).toBe(pngOnly)
  })

  it('pngOnly keeps the png and nothing else', () => {
    const reply = { png: PNG, width: 4, height: 2, rev: 3, path: '/Users/made-up/a.png' }
    expect(pngOnly(reply, { providers: [] })).toEqual({ png: PNG })
  })
})
