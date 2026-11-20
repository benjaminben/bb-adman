import { describe, it, expect } from 'vitest'
import {
  pickFolderInput,
  pickProjectFileInput,
} from '../../../../../src/shared/schemas/queries/dialog'

describe('picker inputs [SPEC 4.3, correction 20]', () => {
  it('dialog.pickFolder takes an optional title and defaultPath', () => {
    expect(pickFolderInput.parse({})).toEqual({})
    expect(pickFolderInput.parse({ title: 'Pick', defaultPath: '/w' })).toEqual({
      title: 'Pick',
      defaultPath: '/w',
    })
  })

  it('dialog.pickProjectFile takes an optional defaultPath only', () => {
    expect(pickProjectFileInput.parse({ defaultPath: '/w' })).toEqual({ defaultPath: '/w' })
    expect(pickProjectFileInput.safeParse({ title: 'Pick' }).success).toBe(false)
  })

  it.each([null, 'x', { defaultPath: 3 }, { title: 1 }, { other: true }])('refuses %j', (input) => {
    expect(pickFolderInput.safeParse(input).success).toBe(false)
  })
})
