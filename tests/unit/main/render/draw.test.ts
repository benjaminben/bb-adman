// P8-3 (phase-08.md "Drawing at full size"; spec/security.md "Rules: the render window"): what
// createDraw sends to the render page. view reaches the page as its two numbers only, and a
// request that fails the schema, with or without view, is never sent.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SceneInput } from '@/shared/scene/types'

const sent: unknown[] = []
let onDone: (event: unknown, message: unknown) => void = () => undefined

vi.mock('electron', () => ({
  ipcMain: { on: (_channel: string, listener: typeof onDone) => (onDone = listener) },
}))
vi.mock('@/main/render/done-message', () => ({ acceptDone: () => ({}) }))
vi.mock('@/main/render/render-window', () => ({
  endRenderWindow: () => undefined,
  renderWindow: () => ({
    loaded: Promise.resolve(),
    win: {
      setContentSize: () => undefined,
      once: () => undefined,
      removeListener: () => undefined,
      isDestroyed: () => false,
      webContents: {
        send: (_channel: string, request: { requestId: string }) => {
          sent.push(request)
          onDone({}, { requestId: request.requestId, overflow: {} })
        },
        capturePage: async () => ({
          getSize: () => ({ width: 1, height: 1 }),
          resize: function () {
            return this
          },
          toPNG: () => Buffer.from([1]),
        }),
      },
    },
  }),
}))

const { createDraw } = await import('@/main/render/draw')

const input: SceneInput = {
  projectId: 'p1',
  variant: { width: 3000, height: 1000, language: 'en', format: 'image', durationMs: 0 },
  layers: [],
  assets: {},
  timeMs: 0,
  mode: 'full',
}

beforeEach(() => {
  sent.length = 0
})

describe('createDraw and view [P8-3]', () => {
  it('sends a tile request with view as two numbers and nothing more', async () => {
    const draw = createDraw()
    await draw(input, { width: 952, height: 1000 }, { x: 2048, y: 0 })
    expect(sent).toHaveLength(1)
    const request = sent[0] as Record<string, unknown>
    expect(Object.keys(request).sort()).toEqual(['height', 'input', 'requestId', 'view', 'width'])
    expect(request.view).toEqual({ x: 2048, y: 0 })
  })

  it('sends a request without view exactly as before', async () => {
    const draw = createDraw()
    await draw(input, { width: 512, height: 171 })
    const request = sent[0] as Record<string, unknown>
    expect(Object.keys(request).sort()).toEqual(['height', 'input', 'requestId', 'width'])
  })

  it.each([
    ['a view with a third key', { x: 0, y: 0, path: '/a' }, { width: 2048, height: 1000 }, input],
    ['a negative x', { x: -1, y: 0 }, { width: 2048, height: 1000 }, input],
    ['a fractional y', { x: 0, y: 0.5 }, { width: 2048, height: 1000 }, input],
    ['an x of 8,192', { x: 8192, y: 0 }, { width: 2048, height: 1000 }, input],
    ['a tile past 2,048', { x: 0, y: 0 }, { width: 2049, height: 1000 }, input],
    [
      'a variant past 8,192',
      { x: 0, y: 0 },
      { width: 2048, height: 1000 },
      { ...input, variant: { ...input.variant, width: 8193 } },
    ],
  ])('refuses %s and sends nothing', async (_case, view, size, scene) => {
    const draw = createDraw()
    await expect(draw(scene, size, view)).rejects.toThrow('could not be drawn')
    expect(sent).toHaveLength(0)
  })
})
