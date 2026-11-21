import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { managedPath } from '../../../../src/main/assets/path-resolver'

const ID = '01JD0000000000000000000001'
const BAD = ['a/b', 'a\\b', '..', 'a.b']

describe('managedPath checks what it joins [SPEC 14 1.30 U3]', () => {
  it('joins a ULID and a plain lower-case extension', () => {
    expect(managedPath('/a/P Assets', ID, 'png')).toBe(path.join('/a/P Assets', `${ID}.png`))
  })

  for (const bad of BAD) {
    it(`throws for an asset ID holding ${JSON.stringify(bad)}`, () => {
      const id = `${ID.slice(0, ID.length - bad.length)}${bad}`
      expect(id).toHaveLength(26)
      expect(() => managedPath('/a', id, 'png')).toThrow(Error)
    })

    it(`throws for an extension holding ${JSON.stringify(bad)}`, () => {
      expect(() => managedPath('/a', ID, `png${bad}`)).toThrow(Error)
    })
  }

  it('throws for an empty or over-long extension, or one in upper case', () => {
    for (const ext of ['', 'abcdefghijk', 'PNG']) {
      expect(() => managedPath('/a', ID, ext)).toThrow(Error)
    }
  })
})
