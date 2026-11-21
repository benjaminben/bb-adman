import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import liveConfig from '../../../vitest.live.config'
import mainConfig from '../../../vitest.config'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}

describe('live tests are hand-run only [SPEC 10.2, 13, step 0 item 5]', () => {
  it('has a test:live script on its own config, apart from npm test', () => {
    expect(pkg.scripts['test:live']).toBe('vitest run --config vitest.live.config.ts')
    expect(pkg.scripts.test).toBe('vitest run')
  })

  it('the live config reads tests/live only, and the main config never does', () => {
    expect(liveConfig.test?.include).toEqual(['tests/live/**/*.test.ts'])
    const mainIncludes = JSON.stringify(mainConfig.test)
    expect(mainIncludes).not.toContain('tests/live')
  })
})
