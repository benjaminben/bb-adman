import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import mainConfig from '../../../vitest.config'
import { LIVE_INCLUDE } from '../../live/env-file'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}
// Read as text: no test may import the live config (SPEC 13 [1.10]).
const liveConfigText = fs.readFileSync('vitest.live.config.ts', 'utf8')

describe('live tests are hand-run only [SPEC 10.2, 13, step 0 item 5]', () => {
  it('has a test:live script on its own config, apart from npm test', () => {
    expect(pkg.scripts['test:live']).toBe('vitest run --config vitest.live.config.ts')
    expect(pkg.scripts.test).toBe('vitest run')
  })

  it('the live config reads tests/live only, and the main config never does', () => {
    expect(LIVE_INCLUDE).toEqual(['tests/live/**/*.test.ts'])
    expect(liveConfigText).toContain('include: LIVE_INCLUDE')
    const mainIncludes = JSON.stringify(mainConfig.test)
    expect(mainIncludes).not.toContain('tests/live')
  })
})

const THIS_FILE = path.normalize('tests/unit/config/live-config.test.ts')

function filesUnder(folder: string, keep: (file: string) => boolean): string[] {
  if (!fs.existsSync(folder)) return []
  return fs
    .readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map((name) => path.join(folder, name))
    .filter((file) => fs.statSync(file).isFile() && keep(file))
}

describe('nothing imports the live config, and the app never names .env.local [SPEC 13, F1]', () => {
  it('no test or app source holds vitest.live.config, and no src file holds .env.local', () => {
    const isSource = (file: string) => /\.tsx?$/.test(file) && file !== THIS_FILE
    const sources = ['tests/unit', 'tests/integration', 'tests/e2e', 'src'].flatMap((folder) =>
      filesUnder(folder, isSource),
    )
    expect(sources.length).toBeGreaterThan(0)
    const importers = sources.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('vitest.live.config'),
    )
    expect(importers).toEqual([])
    const namers = filesUnder('src', () => true).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('.env.local'),
    )
    expect(namers).toEqual([])
  })
})
