// R2P-5b: the copy an agent's import makes holds exactly the bytes of the regular file at the
// path the user saw. Each test swaps something on disk at one moment of the checks (through a
// spy on the open or the copy) and expects a refusal and no copy.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkFile, prepareFileImport } from '@/main/assets/import-files'
import { closeProjectFile, createProjectFile, type ProjectHandle } from '@/main/db/project-file'
import { greyPng } from '@/main/providers/fake/png'
import { AppError } from '@/shared/schemas/result'

const roots: string[] = []
const projects: ProjectHandle[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const p of projects.splice(0)) closeProjectFile(p)
  for (const r of roots.splice(0)) {
    fs.chmodSync(r, 0o755)
    fs.rmSync(r, { recursive: true, force: true })
  }
})

const root = () => {
  const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-swap-')))
  roots.push(made)
  return made
}

const put = (file: string, bytes: Uint8Array) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
  return file
}

function project(): { handle: ProjectHandle; assetsDir: string } {
  const dir = root()
  const handle = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.push(handle)
  return { handle, assetsDir: path.join(dir, 'P Assets') }
}

const filesIn = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])

async function refusalOf(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (e) {
    if (e instanceof AppError) return e.toBody()
    throw e
  }
  throw new Error('no refusal')
}

// Runs `swap` once, just before the first open of `shown`, then opens as asked.
function swapBeforeOpen(shown: string, swap: () => void) {
  const realOpen = fs.promises.open
  let done = false
  vi.spyOn(fs.promises, 'open').mockImplementation((...args: Parameters<typeof realOpen>) => {
    if (!done && args[0] === shown) {
      done = true
      swap()
    }
    return realOpen(...args)
  })
}

const isLink = {
  code: 'RULE_VIOLATION',
  message: "File 1 is reached through a link. Give the file's own full path.",
  details: { reason: 'file_is_link' },
}

const changed = {
  code: 'RULE_VIOLATION',
  message: 'A file changed while it was read. Try again.',
  details: { reason: 'file_not_readable' },
}

describe('the bytes copied are the bytes checked [R2P-5b]', () => {
  it('gives one copy per distinct file, holding its bytes, and one hash per path', async () => {
    const dir = root()
    const a = put(path.join(dir, 'a.png'), greyPng(4, 4))
    const same = put(path.join(dir, 'b', 'same.png'), greyPng(4, 4))
    const other = put(path.join(dir, 'other.png'), greyPng(6, 3))
    const { handle, assetsDir } = project()
    const prepared = await prepareFileImport(handle, [a, same, other, a])
    expect(prepared.hashes).toHaveLength(4)
    expect(new Set(prepared.hashes).size).toBe(2)
    expect(prepared.hashes[0]).toBe(prepared.hashes[1])
    expect(prepared.hashes[3]).toBe(prepared.hashes[0])
    expect(prepared.newAssets).toHaveLength(2)
    expect(filesIn(assetsDir)).toHaveLength(2)
    expect(fs.readFileSync(prepared.newAssets[0].absPath)).toEqual(fs.readFileSync(a))
    expect(fs.readFileSync(prepared.newAssets[1].absPath)).toEqual(fs.readFileSync(other))
  })

  it.runIf(process.platform !== 'win32')(
    'refuses and leaves no copy when a link to another picture takes the path before the copy',
    async () => {
      const dir = root()
      const first = put(path.join(dir, 'first.png'), greyPng(3, 3))
      const shown = put(path.join(dir, 'hero.png'), greyPng(4, 4))
      const unseen = put(path.join(dir, 'elsewhere', 'unseen.png'), greyPng(5, 5))
      const { handle, assetsDir } = project()
      const realCopy = fs.promises.copyFile
      let swapped = false
      vi.spyOn(fs.promises, 'copyFile').mockImplementation(
        (...args: Parameters<typeof realCopy>) => {
          if (!swapped && args[0] === shown) {
            swapped = true
            fs.rmSync(shown)
            fs.symlinkSync(unseen, shown)
          }
          return realCopy(...args)
        },
      )
      expect(await refusalOf(() => prepareFileImport(handle, [first, shown]))).toEqual(changed)
      expect(swapped).toBe(true)
      expect(filesIn(assetsDir)).toEqual([])
    },
  )
})

describe('the open of the shown path [R2P-5b]', () => {
  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'refuses a path that is a link when it is opened, and does not open its target',
    async () => {
      const dir = root()
      const shown = put(path.join(dir, 'hero.png'), greyPng(4, 4))
      // A target that cannot be opened: had the open followed the link, it would fail as
      // file_not_readable, not as a link.
      const target = put(path.join(dir, 'secret.png'), greyPng(5, 5))
      fs.chmodSync(target, 0)
      swapBeforeOpen(shown, () => {
        fs.rmSync(shown)
        fs.symlinkSync(target, shown)
      })
      try {
        expect(await refusalOf(() => checkFile(shown, 1))).toEqual(isLink)
      } finally {
        fs.chmodSync(target, 0o644)
      }
    },
  )

  it.runIf(process.platform !== 'win32')(
    'refuses a path whose folder became a link before the open',
    async () => {
      const dir = root()
      const shown = put(path.join(dir, 'shoot', 'hero.png'), greyPng(4, 4))
      put(path.join(dir, 'unseen', 'hero.png'), greyPng(5, 5))
      swapBeforeOpen(shown, () => {
        fs.renameSync(path.join(dir, 'shoot'), path.join(dir, 'shoot-was'))
        fs.symlinkSync(path.join(dir, 'unseen'), path.join(dir, 'shoot'))
      })
      expect(await refusalOf(() => checkFile(shown, 1))).toEqual(isLink)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'refuses a path whose folder was a link only while it was opened',
    async () => {
      const dir = root()
      const shown = put(path.join(dir, 'shoot', 'hero.png'), greyPng(4, 4))
      put(path.join(dir, 'unseen', 'hero.png'), greyPng(5, 5))
      const realOpen = fs.promises.open
      vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
        if (args[0] !== shown) return realOpen(...args)
        fs.renameSync(path.join(dir, 'shoot'), path.join(dir, 'shoot-was'))
        fs.symlinkSync(path.join(dir, 'unseen'), path.join(dir, 'shoot'))
        const opened = await realOpen(...args)
        fs.rmSync(path.join(dir, 'shoot'))
        fs.renameSync(path.join(dir, 'shoot-was'), path.join(dir, 'shoot'))
        return opened
      })
      expect(await refusalOf(() => checkFile(shown, 1))).toEqual(isLink)
    },
  )
})
