import { describe, it, expect } from 'vitest'
import { greyPng } from '../../../../src/main/providers/fake/png'
import { pictureType } from '../../../../src/main/providers/picture-type'
import { pictureSize } from '../../../../src/main/providers/picture-size'

describe("the fake provider's picture is a real PNG [SPEC 14 1.20 L6]", () => {
  it('reads as image/png with its size from the shared picture functions', () => {
    const png = greyPng(12, 7)
    expect(pictureType(png)).toBe('image/png')
    expect(pictureSize(png, 'image/png')).toEqual({ width: 12, height: 7 })
  })
})
