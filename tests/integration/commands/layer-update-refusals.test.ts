import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { insertTestAsset, type TestAsset } from '../assets/asset-rows'
import { makeLayerBus, type LayerBus } from './layer-fixture'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
  const assets: TestAsset[] = [
    { id: 'pic', relPath: 'p.png', absPath: '/p.png' },
    { id: 'ref-pic', relPath: 'r.png', absPath: '/r.png', library: 'reference' },
    { id: 'font', relPath: 'f.ttf', absPath: '/f.ttf', kind: 'font' },
    { id: 'ref-font', relPath: 'g.ttf', absPath: '/g.ttf', kind: 'font', library: 'reference' },
    { id: 'clip', relPath: 'c.mp4', absPath: '/c.mp4', kind: 'video' },
  ]
  for (const asset of assets) insertTestAsset(bus.db, asset)
})
afterEach(() => bus.cleanup())

const FADE = { preset: 'fade', startMs: 0, durationMs: 500 }
const NOT_IN_PROJECT = 'That file is not in this project.'
const REFERENCE =
  'This file is in the reference library. Move it to the asset library to use it on a post.'
const NOT_FIT = 'Those style values do not fit this layer.'
const NO_ANIMATION = 'Only text layers can have an entrance or exit animation.'

type Case = [
  string,
  keyof LayerBus['ids'] | 'missing',
  Record<string, unknown>,
  string,
  string | undefined,
  string | undefined,
]

describe('layer.update refusals [spec/editor-commands.md]', () => {
  it.each<Case>([
    [
      'an unknown layer',
      'missing',
      { name: 'A' },
      'NOT_FOUND',
      'That layer was not found.',
      undefined,
    ],
    [
      'copy on a picture',
      'image',
      { copy: 'A' },
      'INVALID_INPUT',
      'Only a text layer has text.',
      undefined,
    ],
    [
      'copy on the background',
      'background',
      { copy: 'A' },
      'INVALID_INPUT',
      'Only a text layer has text.',
      undefined,
    ],
    [
      'a picture on text',
      'text',
      { source: { assetId: 'pic' } },
      'INVALID_INPUT',
      'A text layer has no picture.',
      undefined,
    ],
    [
      'no picture on text',
      'text',
      { source: null },
      'INVALID_INPUT',
      'A text layer has no picture.',
      undefined,
    ],
    ['opacity on text', 'text', { style: { opacity: 0.5 } }, 'INVALID_INPUT', NOT_FIT, undefined],
    [
      'font size on a picture',
      'image',
      { style: { fontSize: 10 } },
      'INVALID_INPUT',
      NOT_FIT,
      undefined,
    ],
    [
      'a preset on a picture',
      'image',
      { animation: { entrance: FADE } },
      'INVALID_INPUT',
      NO_ANIMATION,
      undefined,
    ],
    [
      'a preset on the background',
      'background',
      { animation: { exit: FADE } },
      'INVALID_INPUT',
      NO_ANIMATION,
      undefined,
    ],
    [
      'an unknown picture',
      'image',
      { source: { assetId: 'gone' } },
      'NOT_FOUND',
      NOT_IN_PROJECT,
      undefined,
    ],
    [
      'a font as a picture',
      'image',
      { source: { assetId: 'font' } },
      'INVALID_INPUT',
      'Choose a picture for a picture layer.',
      undefined,
    ],
    [
      'a video as a picture',
      'background',
      { source: { assetId: 'clip' } },
      'INVALID_INPUT',
      'Choose a picture for a picture layer.',
      undefined,
    ],
    [
      'a reference picture',
      'image',
      { source: { assetId: 'ref-pic' } },
      'RULE_VIOLATION',
      REFERENCE,
      'reference_library',
    ],
    [
      'an unknown font',
      'text',
      { style: { fontAssetId: 'gone' } },
      'NOT_FOUND',
      NOT_IN_PROJECT,
      undefined,
    ],
    [
      'a picture as a font',
      'text',
      { style: { fontAssetId: 'pic' } },
      'INVALID_INPUT',
      'Choose a font file.',
      undefined,
    ],
    [
      'a reference font',
      'text',
      { style: { fontAssetId: 'ref-font' } },
      'RULE_VIOLATION',
      REFERENCE,
      'reference_library',
    ],
  ])('refuses %s', async (_, which, patch, code, message, reason) => {
    const id = which === 'missing' ? 'no-such-layer' : bus.ids[which]
    const error = await expectRefused(bus, () => bus.update(id, patch), code, reason)
    expect(error.message).toBe(message)
    if (!reason) expect(error.details?.reason).toBeUndefined()
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it.each<Record<string, unknown>>([
    {},
    { size: 3 },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { copy: 'x'.repeat(5001) },
    { style: { fontSize: 10, opacity: 1 } },
    { style: { letterSpacing: 2 } },
    { geometry: { width: 0 } },
    { geometry: { height: 0.5 } },
    { geometry: { crop: { x: 0, y: 0, width: 0.5, height: 10 } } },
    { geometry: { left: 1 } },
    { source: { assetId: '' } },
    { timing: { startMs: 0 } },
    { animation: { entrance: { preset: 'spin', startMs: 0, durationMs: 1 } } },
  ])('refuses the patch %j with INVALID_INPUT', async (patch) => {
    await expectRefused(bus, () => bus.update(bus.ids.text, patch), 'INVALID_INPUT')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('accepts a picture whose file is missing; the badge shows it', async () => {
    insertTestAsset(bus.db, { id: 'lost', relPath: 'lost.png', absPath: '/nowhere/lost.png' })
    const result = await bus.update(bus.ids.image, { source: { assetId: 'lost' } })
    expect(result).toMatchObject({ ok: true })
  })
})
