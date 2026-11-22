// P10-3 (spec/phases/phase-10.md, A-234, stakeholder ruling): variant.render for the agent
// draws the complete ad, a linked picture outside the project's folder included, and changes
// nothing: no overflow report, no row, no event, no file. The reply holds no path, name or hash.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  FONT,
  HIDDEN_WORDS,
  INSIDE,
  MANAGED,
  OUTSIDE,
  PNG,
  VARIANT,
  renderSetUp,
  type RenderSetUp,
} from '../mcp/render-variant-fixture'
import type { SceneInput } from '@/shared/scene/types'

let r: RenderSetUp | undefined
afterEach(() => {
  r?.cleanup()
  r = undefined
})

const agentRender = (set: RenderSetUp, input: Record<string, unknown> = {}) =>
  set.core.query(
    'variant.render',
    { projectId: set.projectId, variantId: VARIANT, ...input },
    { actor: 'agent' },
  )

function drawnInput(set: RenderSetUp): SceneInput {
  const call = set.draw.mock.calls[0]
  if (!call) throw new Error('nothing was drawn')
  return call[0]
}

function noHiddenWord(set: RenderSetUp, text: string): void {
  for (const word of [...HIDDEN_WORDS, set.outsideDir, set.projectDir, 'adman-asset:']) {
    expect(text.includes(word), word).toBe(false)
  }
}

describe('variant.render for the agent [P10-3, A-234]', () => {
  it('draws the complete variant: outside, inside and managed pictures and the font', async () => {
    r = await renderSetUp()
    const reply = await agentRender(r, { maxDimension: 512 })
    expect(reply).toEqual({ ok: true, data: { png: PNG, width: 410, height: 512, rev: 0 } })
    const input = drawnInput(r)
    expect(r.draw.mock.calls[0]?.[1]).toEqual({ width: 410, height: 512 })
    expect(input.layers.map((l) => l.id)).toEqual(['p-out', 'p-in', 'p-man', 't1'])
    for (const id of [OUTSIDE, INSIDE, MANAGED]) {
      expect(input.assets[id], id).toEqual({ kind: 'image', missing: false, width: 8, height: 8 })
    }
    expect(input.assets[FONT]).toEqual({ kind: 'font', missing: false, width: null, height: null })
    expect(input.mode).toBe('full')
  })

  it('gives the scene no path, name, hash or address of any source', async () => {
    r = await renderSetUp()
    await agentRender(r)
    noHiddenWord(r, JSON.stringify(drawnInput(r)))
  })

  it('reports no overflow, sends no event and writes no thumbnail', async () => {
    r = await renderSetUp({ draw: async () => ({ png: PNG, overflow: { t1: true } }) })
    const before = r.core.projects.requireOpen(r.projectId).db.prepare('SELECT * FROM layer').all()
    r.events.length = 0
    const reply = await agentRender(r)
    expect(reply.ok).toBe(true)
    const after = r.core.projects.requireOpen(r.projectId).db.prepare('SELECT * FROM layer').all()
    expect(after).toEqual(before)
    expect(r.events).toEqual([])
    expect(fs.existsSync(path.join(r.userData, 'thumbnails'))).toBe(false)
  })

  it('leaves the user draw as it was: it still reports overflow', async () => {
    r = await renderSetUp({ draw: async () => ({ png: PNG, overflow: { t1: true } }) })
    const reply = await r.core.query(
      'variant.render',
      { projectId: r.projectId, variantId: VARIANT },
      { actor: 'user' },
    )
    expect(reply.ok).toBe(true)
    const row = r.core.projects
      .requireOpen(r.projectId)
      .db.prepare("SELECT overflow FROM layer WHERE id = 't1'")
      .get() as { overflow: number }
    expect(row.overflow).toBe(1)
  })

  it('draws the outside picture as missing once its file is gone, as the user sees it', async () => {
    r = await renderSetUp()
    fs.rmSync(r.outsideFile)
    await agentRender(r)
    expect(drawnInput(r).assets[OUTSIDE]?.missing).toBe(true)
    expect(drawnInput(r).assets[INSIDE]?.missing).toBe(false)
  })

  it.each([
    ['an unknown variant', { variantId: 'made-up-variant' }, 'NOT_FOUND'],
    ['a size over the cap', { maxDimension: 4096 }, 'INVALID_INPUT'],
    ['a project that is not open', { projectId: 'made-up-project' }, 'NOT_FOUND'],
  ])('refuses %s with %s and no path', async (_case, input, code) => {
    r = await renderSetUp()
    const reply = await agentRender(r, input)
    expect(reply).toMatchObject({ ok: false, error: { code } })
    noHiddenWord(r, JSON.stringify(reply))
  })

  it('answers render_failed when the draw fails, and logs no path', async () => {
    r = await renderSetUp({
      draw: async () => {
        throw new Error(`could not read ${path.join('/Users', 'far-away-made-up.png')}`)
      },
    })
    const reply = await agentRender(r)
    expect(reply).toMatchObject({ ok: false, error: { details: { reason: 'render_failed' } } })
    noHiddenWord(r, JSON.stringify(reply))
    noHiddenWord(r, r.readLogs())
  })
})
