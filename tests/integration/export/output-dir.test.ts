// P8-2 (spec/phases/phase-08.md "The output folder (security)"): the folder the user picked is
// checked before anything is written. It must be absolute, at most 4,096 characters, hold no
// NUL, and its real path must be a folder outside the app data folder and the project's assets
// folder. The real path is the root from then on. No path goes into an error or a log line.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checkOutputDir } from '@/main/commands/export/output-dir'
import { assetsDirOf } from '@/main/assets/service'
import { AppError } from '@/shared/schemas/result'
import type { ProjectHandle } from '@/main/db/project-file'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function open(): Promise<{ fx: Fixture; project: ProjectHandle }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  const project = fx.core.projects.get(data<{ projectId: string }>(made).projectId)
  if (!project) throw new Error('the project did not open')
  fs.mkdirSync(path.join(assetsDirOf(project), 'inner'), { recursive: true })
  fs.mkdirSync(path.join(fx.userData, 'thumbnails'), { recursive: true })
  return { fx, project }
}

function canMakeLinks(): boolean {
  const fx = makeFixture()
  try {
    fs.symlinkSync(fx.documents, path.join(fx.root, 'probe'), 'dir')
    return true
  } catch {
    return false
  } finally {
    fx.cleanup()
  }
}
const links = canMakeLinks()

const REFUSED = {
  code: 'RULE_VIOLATION',
  message: 'Choose another folder: this one cannot be used for an export.',
  details: { reason: 'output_dir_refused' },
}
const MISSING = {
  code: 'RULE_VIOLATION',
  message: 'The chosen folder is not there any more. Choose it again.',
  details: { reason: 'output_dir_missing' },
}

type Row = {
  name: string
  typed: (fx: Fixture, project: ProjectHandle) => string
  answer: typeof REFUSED
  link?: true
}
const ROWS: Row[] = [
  { name: 'a relative path', typed: () => 'Exports', answer: REFUSED },
  { name: 'an empty path', typed: () => '', answer: REFUSED },
  {
    name: 'a path over 4,096 characters',
    typed: (fx) => path.join(fx.documents, 'a'.repeat(4097)),
    answer: REFUSED,
  },
  { name: 'a path with a NUL', typed: (fx) => `${fx.documents}\u0000x`, answer: REFUSED },
  {
    name: 'a file, not a folder',
    typed: (fx) => {
      const file = path.join(fx.documents, 'notes.txt')
      fs.writeFileSync(file, 'x')
      return file
    },
    answer: REFUSED,
  },
  { name: 'a missing folder', typed: (fx) => path.join(fx.documents, 'gone'), answer: MISSING },
  { name: 'the app data folder', typed: (fx) => fx.userData, answer: REFUSED },
  {
    name: 'a folder inside the app data folder',
    typed: (fx) => path.join(fx.userData, 'thumbnails'),
    answer: REFUSED,
  },
  {
    name: 'the app data folder, typed with ..',
    typed: (fx) => `${fx.userData}${path.sep}thumbnails${path.sep}..`,
    answer: REFUSED,
  },
  { name: "the project's assets folder", typed: (_fx, p) => assetsDirOf(p), answer: REFUSED },
  {
    name: "a folder inside the project's assets folder",
    typed: (_fx, p) => path.join(assetsDirOf(p), 'inner'),
    answer: REFUSED,
  },
  {
    name: 'a link to the app data folder',
    typed: (fx) => {
      const link = path.join(fx.documents, 'to-app-data')
      fs.symlinkSync(fx.userData, link, 'dir')
      return link
    },
    answer: REFUSED,
    link: true,
  },
  {
    name: 'a link to the assets folder',
    typed: (fx, p) => {
      const link = path.join(fx.documents, 'to-assets')
      fs.symlinkSync(assetsDirOf(p), link, 'dir')
      return link
    },
    answer: REFUSED,
    link: true,
  },
  {
    name: 'a link that points nowhere',
    typed: (fx) => {
      const link = path.join(fx.documents, 'to-nowhere')
      fs.symlinkSync(path.join(fx.root, 'not-there'), link, 'dir')
      return link
    },
    answer: MISSING,
    link: true,
  },
]

describe('checkOutputDir refuses a folder it must not write in [P8-2]', () => {
  it.each(ROWS)('$name', async (row) => {
    if (row.link && !links) return
    const { fx, project } = await open()
    const typed = row.typed(fx, project)
    const error = await checkOutputDir(fx.core.deps, project, typed).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).toBody()).toEqual(row.answer)
    // No path in the error, its stack aside, nor in any log line.
    const text = JSON.stringify({ ...(error as AppError), message: (error as Error).message })
    expect(text).not.toContain(fx.root)
    expect(fx.readLogs()).not.toContain(fx.root)
  })
})

describe('checkOutputDir gives the real path of a good folder [P8-2]', () => {
  it('gives the real path of a folder outside the app data and assets folders', async () => {
    const { fx, project } = await open()
    const folder = path.join(fx.documents, 'Exports')
    fs.mkdirSync(folder)
    expect(await checkOutputDir(fx.core.deps, project, folder)).toBe(fs.realpathSync(folder))
  })

  it.skipIf(!links)('gives the real path behind a link, not the typed one', async () => {
    const { fx, project } = await open()
    const folder = path.join(fx.documents, 'Exports')
    fs.mkdirSync(folder)
    const link = path.join(fx.root, 'exports-link')
    fs.symlinkSync(folder, link, 'dir')
    expect(await checkOutputDir(fx.core.deps, project, link)).toBe(fs.realpathSync(folder))
  })

  it('accepts the project folder itself, which holds the assets folder', async () => {
    const { fx, project } = await open()
    const folder = path.dirname(project.filePath)
    expect(await checkOutputDir(fx.core.deps, project, folder)).toBe(fs.realpathSync(folder))
  })
})
