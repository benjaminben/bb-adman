import { describe, it, expect } from 'vitest'
import { embedGenerationDetails } from '@/main/jobs/png-details'
import { greyPng } from '@/main/providers/fake/png'
import { pictureSize } from '@/main/providers/picture-size'
import { generationDetailsOf, itxtOf, pngChunks } from '../../../fixtures/png-chunks'

const details = {
  app: 'Adman' as const,
  appVersion: '1.0.0',
  provider: 'fake',
  model: 'test-model-1',
  prompt: 'A bottle on a rock, café ☀︎',
  kind: 'image_generation' as const,
  createdAt: '2026-11-20T14:30:00.000Z',
}

describe('embedding the generation details in a PNG [SPEC 6.6; FR-068]', () => {
  it('writes one iTXt chunk with keyword generation holding the details as JSON', () => {
    const out = embedGenerationDetails(greyPng(4, 3), details)
    expect(generationDetailsOf(out)).toEqual(details)
  })

  it('keeps the text as UTF-8, uncompressed, with empty language and translated keyword', () => {
    const out = embedGenerationDetails(greyPng(4, 3), details)
    const chunk = pngChunks(out).find((c) => c.type === 'iTXt')
    if (!chunk) throw new Error('no iTXt')
    const keywordEnd = chunk.data.indexOf(0)
    expect([...chunk.data.subarray(keywordEnd, keywordEnd + 5)]).toEqual([0, 0, 0, 0, 0])
    expect(itxtOf(chunk).text).toBe(JSON.stringify(details))
  })

  it('gives a valid PNG: every CRC is right, IEND is last and the picture is unchanged', () => {
    const png = greyPng(4, 3)
    const out = embedGenerationDetails(png, details)
    const chunks = pngChunks(out)
    expect(chunks.every((c) => c.crcOk)).toBe(true)
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'iTXt', 'IEND'])
    const before = pngChunks(png).filter((c) => c.type !== 'iTXt')
    expect(chunks.filter((c) => c.type !== 'iTXt')).toEqual(before)
    expect(pictureSize(out, 'image/png')).toEqual({ width: 4, height: 3 })
  })

  it('does not change the bytes it was given', () => {
    const png = greyPng(2, 2)
    const copy = new Uint8Array(png)
    embedGenerationDetails(png, details)
    expect(png).toEqual(copy)
  })

  it('refuses bytes that are not a PNG', () => {
    expect(() => embedGenerationDetails(new Uint8Array([0xff, 0xd8, 0xff, 0]), details)).toThrow()
  })

  it('refuses a PNG that has no IEND chunk', () => {
    const png = greyPng(2, 2)
    expect(() => embedGenerationDetails(png.subarray(0, png.length - 12), details)).toThrow()
  })
})
