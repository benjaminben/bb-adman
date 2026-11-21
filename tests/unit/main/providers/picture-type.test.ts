import { describe, it, expect } from 'vitest'
import { pictureType } from '../../../../src/main/providers/picture-type'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('pictureType reads the type from the file signature [SPEC 6.2 1.18, K2]', () => {
  it('gives image/png for bytes that start with the PNG signature', () => {
    expect(pictureType(new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 13]))).toBe('image/png')
  })

  it('gives image/jpeg for bytes that start with FF D8 FF', () => {
    expect(pictureType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]))).toBe('image/jpeg')
  })

  it('gives nothing for a GIF or any other signature', () => {
    expect(pictureType(new TextEncoder().encode('GIF89a\u0001\u0000'))).toBeUndefined()
    expect(pictureType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBeUndefined()
  })

  it('gives nothing for bytes too short to hold a whole signature', () => {
    expect(pictureType(new Uint8Array(PNG_SIGNATURE.slice(0, 7)))).toBeUndefined()
    expect(pictureType(new Uint8Array([0xff, 0xd8]))).toBeUndefined()
    expect(pictureType(new Uint8Array())).toBeUndefined()
  })
})
