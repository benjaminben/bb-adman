// spec/editor-commands.md, "thumbnail.get" and "Event thumbnail.changed"; spec/scene.md,
// "The render service" (failure) and "Thumbnails". A stand-in draw, a real project file.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

describe('thumbnail.get [spec/editor-commands.md, thumbnail.get; FR-074]', () => {
  it('answers pending, sends thumbnail.changed, then answers ready with the file', async () => {
    r = await makeRenderFixture()
    r.setRev(V1, 4)
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'pending', rev: 4 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(r.changed(V1)[0]).toEqual({
      name: 'thumbnail.changed',
      payload: { projectId: r.projectId, variantId: V1 },
    })
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({
      state: 'ready',
      rev: 4,
      png: PNG,
    })
    expect(fs.readdirSync(r.dir)).toEqual([`${V1}-4.png`])
    expect(r.draw).toHaveBeenCalledTimes(1)
  })

  it('draws the variant at thumbnail size with its layers and the assets they name', async () => {
    r = await makeRenderFixture()
    await r.query('thumbnail.get', { variantId: V1 })
    await r.query('thumbnail.get', { variantId: V2 })
    await vi.waitFor(() => expect(r.draw).toHaveBeenCalledTimes(2))
    const [input, size] = r.drawCall(0)
    expect(size).toEqual({ width: 410, height: 512 })
    expect(r.drawCall(1)[1]).toEqual({ width: 512, height: 512 })
    expect(input).toMatchObject({
      projectId: r.projectId,
      variant: { width: 1080, height: 1350, language: 'en', format: 'image', durationMs: 0 },
      timeMs: 0,
      mode: 'full',
    })
    expect(input.layers.map((l) => l.id)).toEqual(['p1', 't1'])
    expect(input.assets).toEqual({
      img1: { kind: 'image', missing: true, width: 640, height: 480 },
    })
    expect(r.drawCall(1)[0].assets).toEqual({
      font1: { kind: 'font', missing: true, width: null, height: null },
    })
    expect(JSON.stringify(r.draw.mock.calls)).not.toContain('nowhere')
  })

  it('a failed draw answers failed for that rev and logs one warn line with no path', async () => {
    r = await makeRenderFixture({
      draw: async () => {
        throw new Error(`could not read ${'/Users/someone/secret folder/a.png'}`)
      },
    })
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'pending', rev: 0 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'failed', rev: 0 })
    expect(r.draw).toHaveBeenCalledTimes(1)
    const lines = r.f
      .readLogs()
      .split('\n')
      .filter((l) => l.includes('render.draw'))
      .map((l) => JSON.parse(l) as Record<string, unknown>)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'warn',
      event: 'app',
      name: 'render.draw',
      projectId: r.projectId,
      variantId: V1,
      message: 'A picture of a variant could not be drawn.',
      context: { reason: 'error' },
    })
    const text = r.f.readLogs()
    expect(text).not.toContain('secret folder')
    expect(text).not.toContain(r.f.userData)
    expect(fs.existsSync(r.dir) ? fs.readdirSync(r.dir) : []).toEqual([])
    r.setRev(V1, 1)
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'pending', rev: 1 })
  })

  it.each([
    ['timeout', 'timeout'],
    ['crashed', 'crashed'],
    ['something else', 'error'],
  ])('logs the reason %s as %s', async (given, logged) => {
    r = await makeRenderFixture({
      draw: async () => {
        throw Object.assign(new Error('x'), { reason: given })
      },
    })
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(r.f.readLogs()).toContain(`"reason":"${logged}"`)
  })

  it('refuses an unknown variant with NOT_FOUND and draws nothing', async () => {
    r = await makeRenderFixture()
    await expect(r.query('thumbnail.get', { variantId: 'zzzzzz' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(r.draw).not.toHaveBeenCalled()
  })

  it('answers failed, and touches no file, for a variant ID not fit for a file name', async () => {
    r = await makeRenderFixture()
    r.project.db.pragma('foreign_keys = OFF')
    r.project.db.exec(`UPDATE variant SET id = '../../x' WHERE id = '${V2}'`)
    expect(await r.query('thumbnail.get', { variantId: '../../x' })).toEqual({
      state: 'failed',
      rev: 0,
    })
    expect(r.draw).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(r.f.userData, 'thumbnails'))).toBe(false)
  })
})
