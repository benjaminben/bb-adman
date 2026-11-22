import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// P9-14: the hand-test tools are gone. No file under src/ or tests/ names their constants, the
// local folder under the app data, the command or the screen folder. This file is left out.
const ROOT = join(__dirname, '..', '..', '..')
const SELF = relative(ROOT, __filename)
const NAMES = ['HAND_TEST_', 'hand-test-local', 'dev.storage', 'renderer/dev/']

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

describe('no hand-test tools [P9-14, Q-P9-5]', () => {
  it.each(['src', 'tests'])('no file under %s/ names them', (folder) => {
    const files = filesUnder(join(ROOT, folder)).map((file) => relative(ROOT, file))
    expect(files.length).toBeGreaterThan(100)
    const naming = files
      .filter((file) => file !== SELF)
      .flatMap((file) => {
        const text = readFileSync(join(ROOT, file), 'utf8')
        return NAMES.filter((name) => text.includes(name)).map((name) => `${file}: ${name}`)
      })
    expect(naming).toEqual([])
  })

  it('has no folder for the hand-test screen', () => {
    const files = filesUnder(join(ROOT, 'src', 'renderer')).map((file) => relative(ROOT, file))
    expect(files.filter((file) => file.startsWith(join('src', 'renderer', 'dev', '')))).toEqual([])
  })
})
