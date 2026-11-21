import { describe, it, expect, beforeEach } from 'vitest'
import { draftKey, generateDrafts } from '@/renderer/stores/generate-drafts'

const DRAFT = { prompt: 'A can on a beach', referenceAssetIds: ['A1'], run: null }
const KEY = draftKey('P1', 'L1')

describe('generate drafts follow the shown project [A-70]', () => {
  beforeEach(() => {
    generateDrafts.getState().follow(null)
    generateDrafts.getState().follow('P1')
    generateDrafts.getState().start(KEY, DRAFT)
  })

  it('keeps the drafts while the same project is shown', () => {
    generateDrafts.getState().follow('P1')
    expect(generateDrafts.getState().drafts[KEY]).toEqual(DRAFT)
  })

  it('clears every draft when the shown project closes', () => {
    generateDrafts.getState().follow(null)
    expect(generateDrafts.getState().drafts).toEqual({})
  })

  it('clears every draft when another project is shown', () => {
    generateDrafts.getState().follow('P2')
    expect(generateDrafts.getState().drafts).toEqual({})
  })
})
