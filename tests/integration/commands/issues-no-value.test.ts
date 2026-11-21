import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

describe('details.issues names fields and never repeats a value [SPEC 4.1, S2-05]', () => {
  it('a path of the wrong type and an unknown key give field names, not the path text', async () => {
    f = makeFixture()
    const pathText = '/Users/someone/Private Folder'
    const result = await f.user('settings.update', {
      defaultProjectDir: [pathText],
      colour: 'blue',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_INPUT')
    const issues = result.error.details?.issues
    expect(Array.isArray(issues)).toBe(true)
    const text = (issues as string[]).join('\n')
    expect(text).toContain('defaultProjectDir')
    expect(text).toContain('colour')
    expect(text).not.toContain(pathText)
    expect(text).not.toContain('blue')
    expect(JSON.stringify(result)).not.toContain('Private Folder')
  })
})
