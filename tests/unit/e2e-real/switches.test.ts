import { describe, it, expect } from 'vitest'
import { realSwitches, picturePaths, PICTURE_LIST_REFUSAL } from '../../e2e-real/switches'

describe('the real run switches are each off unless set to 1 [SPEC 14 1.56 E2E-R]', () => {
  it('with nothing set, every switch is off', () => {
    expect(realSwitches({})).toEqual({ flux: false, moss: false, cancel: false, gemini: false })
  })

  it('reads ADMAN_E2E_FLUX, ADMAN_E2E_MOSS, ADMAN_E2E_CANCEL and ADMAN_E2E_GEMINI', () => {
    expect(
      realSwitches({
        ADMAN_E2E_FLUX: '1',
        ADMAN_E2E_MOSS: '1',
        ADMAN_E2E_CANCEL: '1',
        ADMAN_E2E_GEMINI: '1',
      }),
    ).toEqual({ flux: true, moss: true, cancel: true, gemini: true })
  })

  it('a value other than 1 leaves the switch off', () => {
    expect(realSwitches({ ADMAN_E2E_GEMINI: 'yes', ADMAN_E2E_FLUX: 'true' })).toMatchObject({
      gemini: false,
      flux: false,
    })
  })
})

describe('ADMAN_E2E_PICTURES: up to three absolute paths, never printed [SPEC 14 1.56, 1.54 P-1]', () => {
  it('unset or empty gives no paths', () => {
    expect(picturePaths(undefined)).toEqual([])
    expect(picturePaths(' , ')).toEqual([])
  })

  it('takes paths separated by commas, in order', () => {
    expect(picturePaths('/a/one.png, /b/two.jpg')).toEqual(['/a/one.png', '/b/two.jpg'])
  })

  it('refuses more than three paths with the fixed line, naming no path', () => {
    const value = '/p/secret-a.png,/p/secret-b.png,/p/secret-c.png,/p/secret-d.png'
    expect(() => picturePaths(value)).toThrow(PICTURE_LIST_REFUSAL)
    try {
      picturePaths(value)
    } catch (error) {
      expect(String((error as Error).message)).not.toContain('secret')
      expect((error as Error).cause).toBeUndefined()
    }
  })

  it('refuses a path that is not absolute with the fixed line, naming no path', () => {
    try {
      picturePaths('relative/secret-name.png')
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).toBe(PICTURE_LIST_REFUSAL)
    }
  })
})
