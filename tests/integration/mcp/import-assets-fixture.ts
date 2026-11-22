// R2P-5: the ask set-up of ask-fixture.ts with a folder of made-up files outside the project
// (its real path, so no link is on the way), and helpers to read what an import left behind.
// Not a test file.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { askSetUp, type AskSetUp } from './ask-fixture'
import { greyPng } from '@/main/providers/fake/png'
import { nameTable, sfnt, win } from '../../unit/main/assets/font-bytes'

export type ImportSetUp = AskSetUp & {
  // The folder the made-up files live in, by its real path.
  dir: string
  put: (rel: string, bytes: Uint8Array | string) => string
  // The files in the project's folder, the project file and its assets folder included.
  projectFiles: () => string[]
  assetRows: () => Array<Record<string, unknown>>
}

export const pngBytes = (n: number) => greyPng(n + 2, 3)
export const mp4Bytes = () => fs.readFileSync(path.join(__dirname, '../../fixtures/video/tiny.mp4'))
export const ttfBytes = () =>
  sfnt('ttf', [{ tag: 'name', data: nameTable([win(1, 'Made Up Sans')]) }])

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? filesUnder(full) : [full]
  })
}

export async function importSetUp(): Promise<ImportSetUp> {
  const x = await askSetUp()
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-agent-files-')))
  const projectDir = path.dirname(x.core.projects.requireOpen(x.projectId).filePath)
  return {
    ...x,
    dir,
    put(rel, bytes) {
      const p = path.join(dir, rel)
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, bytes)
      return p
    },
    projectFiles: () =>
      filesUnder(projectDir)
        .filter((f) => !/-(wal|shm|journal)$/.test(f))
        .sort(),
    assetRows: () =>
      x.core.projects
        .requireOpen(x.projectId)
        .db.prepare('SELECT * FROM asset ORDER BY rowid')
        .all() as Array<Record<string, unknown>>,
    async close() {
      await x.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
