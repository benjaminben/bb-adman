// R2E-4 (spec/phases/round-2-editor.md D4, "Draft"): the draft's new fields, and wantKind,
// which is kept until the layer's first draft is made and then gives that draft its kind.
import { describe, it, expect, beforeEach } from 'vitest'
import { draftKey, draftOf, generateDrafts } from '@/renderer/stores/generate-drafts'

const KEY = draftKey('P1', 'L1')
const OLD = { prompt: 'A can on a beach', referenceAssetIds: ['A1'], run: null }

describe('the draft kind and start [R2E-4, D4 "Draft"]', () => {
  beforeEach(() => {
    generateDrafts.getState().follow(null)
    generateDrafts.getState().follow('P1')
  })

  it('reads a draft without the new fields as a picture from a prompt only', () => {
    expect(draftOf(OLD)).toEqual({
      ...OLD,
      kind: 'image',
      start: 'prompt',
      startAssetId: null,
      videoPictureIds: [],
      seconds: '2',
      promptTyped: false,
    })
  })

  it('keeps the new fields as changed', () => {
    generateDrafts.getState().start(KEY, OLD)
    generateDrafts.getState().change(KEY, { start: 'shape', startAssetId: 'A9', promptTyped: true })
    expect(draftOf(generateDrafts.getState().drafts[KEY])).toMatchObject({
      start: 'shape',
      startAssetId: 'A9',
      promptTyped: true,
    })
  })

  it('starts the first draft with the wanted kind, once', () => {
    generateDrafts.getState().wantKind(KEY, 'video')
    generateDrafts.getState().start(KEY, OLD)
    expect(generateDrafts.getState().drafts[KEY]?.kind).toBe('video')
    expect(generateDrafts.getState().wanted).toEqual({})
  })

  it('leaves a draft that is already made as it is', () => {
    generateDrafts.getState().start(KEY, OLD)
    generateDrafts.getState().wantKind(KEY, 'video')
    expect(generateDrafts.getState().drafts[KEY]?.kind).toBeUndefined()
    expect(generateDrafts.getState().wanted).toEqual({})
  })

  it('drops a wanted kind when another project is shown', () => {
    generateDrafts.getState().wantKind(KEY, 'video')
    generateDrafts.getState().follow('P2')
    expect(generateDrafts.getState().wanted).toEqual({})
  })
})
