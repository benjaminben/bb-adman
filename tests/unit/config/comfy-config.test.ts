import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import mainConfig from '../../../vitest.config'
import { COMFY_INCLUDE } from '../../comfy/env-file'
import { LIVE_ENV_NAMES, LIVE_INCLUDE } from '../../live/env-file'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}
// Read as text: no test may import the comfy config (SPEC 13 [1.24], the 1.10 rules).
const comfyConfigText = fs.readFileSync('vitest.comfy.config.ts', 'utf8')

describe('test:comfy is its own run, apart from npm test and test:live [SPEC 6.10.12, 13]', () => {
  it('has the test:comfy script on its own config', () => {
    expect(pkg.scripts['test:comfy']).toBe('vitest run --config vitest.comfy.config.ts')
  })

  it('no other script names the comfy config or tests/comfy', () => {
    const others = Object.entries(pkg.scripts).filter(([name]) => name !== 'test:comfy')
    for (const [, line] of others) {
      expect(line).not.toContain('vitest.comfy.config')
      expect(line).not.toContain('tests/comfy')
    }
  })

  it('the comfy config reads tests/comfy only, and the main and live configs never do', () => {
    expect(COMFY_INCLUDE).toEqual(['tests/comfy/**/*.test.ts'])
    expect(comfyConfigText).toContain('include: COMFY_INCLUDE')
    expect(JSON.stringify(mainConfig.test)).not.toContain('tests/comfy')
    expect(LIVE_INCLUDE.join(' ')).not.toContain('tests/comfy')
  })

  it('the two runs share no variable name: COMFY_BASE_URL is not a live name', () => {
    expect(LIVE_ENV_NAMES as readonly string[]).not.toContain('COMFY_BASE_URL')
    expect(comfyConfigText).not.toContain('LIVE_ENV_NAMES')
    expect(comfyConfigText).not.toContain('liveEnvFrom')
  })
})

describe('the comfy config follows the three 1.10 rules [SPEC 13 1.24]', () => {
  it('exports a function and reads .env.local only inside it', () => {
    expect(comfyConfigText).toContain('export default defineConfig(() => (')
    const top = comfyConfigText.slice(0, comfyConfigText.indexOf('export default'))
    // Above the export only imports, comments and the reader function's own body.
    const outside = top.replace(/function readEnvLocal\(\)[\s\S]*?\n}\n/, '')
    expect(outside).not.toMatch(/readFileSync|process\.env/)
    expect(comfyConfigText).toContain("from './tests/comfy/env-file.js'")
  })

  it('takes its files one at a time, so two cases never run at once on the server', () => {
    expect(comfyConfigText).toContain('fileParallelism: false')
  })
})

const THIS_FILE = path.normalize('tests/unit/config/comfy-config.test.ts')

function filesUnder(folder: string, keep: (file: string) => boolean): string[] {
  if (!fs.existsSync(folder)) return []
  return fs
    .readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map((name) => path.join(folder, name))
    .filter((file) => fs.statSync(file).isFile() && keep(file))
}

describe('nothing imports the comfy config, and the app never names COMFY_BASE_URL [SPEC 13]', () => {
  it('no file under src, tests/unit, tests/integration or tests/e2e holds vitest.comfy.config', () => {
    const isSource = (file: string) => /\.tsx?$/.test(file) && file !== THIS_FILE
    const sources = ['tests/unit', 'tests/integration', 'tests/e2e', 'src'].flatMap((folder) =>
      filesUnder(folder, isSource),
    )
    expect(sources.length).toBeGreaterThan(0)
    const importers = sources.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('vitest.comfy.config'),
    )
    expect(importers).toEqual([])
  })

  it('no file under src reads a COMFY_ variable (SPEC 6.10.1)', () => {
    const readers = filesUnder('src', () => true).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('COMFY_BASE_URL'),
    )
    expect(readers).toEqual([])
  })
})
