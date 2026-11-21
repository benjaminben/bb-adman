import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import {
  createProjectFile,
  closeProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { readWireRow, readWireRows } from '../../../src/main/db/rows'
import { defineCommand } from '../../../src/main/commands/types'
import type { LogInput } from '../../../src/main/log/activity-log'
import { makeMultiBus } from '../commands/multi-bus'

let dir: string | undefined
let project: ProjectHandle | undefined
let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => {
  if (project) closeProjectFile(project)
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  fixture?.cleanup()
  project = undefined
  dir = undefined
  fixture = undefined
})

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-rows-check-'))
  project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  return project.db
}

// A blob keeps its type in a TEXT column, so the row really fails SubjectRow.
const BAD_NAME = Buffer.from('bad-name-bytes')

describe('the per-table Zod check in rows.ts [SPEC 4.4]', () => {
  it('throws when a row read by key fails its table schema', () => {
    const db = setup()
    db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', ?, 'x')").run(BAD_NAME)
    expect(() => readWireRow(db, 'subject', { id: 's1' })).toThrow()
  })

  it('leaves a bad row out of a full read and logs its table and key, no values', () => {
    const db = setup()
    db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', ?, 'x')").run(BAD_NAME)
    db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s2', 'Shoe', 'x')").run()
    const lines: LogInput[] = []
    const log = { write: (e: LogInput) => lines.push(e), prune: () => undefined }
    expect(readWireRows(db, 'subject', log)).toEqual([
      { id: 's2', name: 'Shoe', description: '', createdAt: 'x' },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'error',
      ok: false,
      context: { table: 'subject', key: 's1' },
    })
    expect(JSON.stringify(lines)).not.toContain('bad-name-bytes')
    expect(Object.keys(lines[0]?.context ?? {}).sort()).toEqual(['key', 'table'])
  })

  it('a command that writes a row its schema refuses returns INTERNAL and saves nothing', async () => {
    const input = z.object({ projectId: z.string() })
    fixture = makeMultiBus({
      count: 1,
      handlers: () => [
        defineCommand({
          name: 'subject.create',
          input,
          projectId: (i) => i.projectId,
          run(ctx) {
            ctx.project.db
              .prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', ?, 'x')")
              .run(BAD_NAME)
            ctx.changes.touch('subject', { id: 's1' })
            return { data: null }
          },
        }),
      ],
    })
    const [p] = fixture.projects
    if (!p) throw new Error('project expected')
    const result = await fixture.bus.execute(
      'subject.create',
      { projectId: p.projectId },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(p.db.prepare('SELECT COUNT(*) AS n FROM subject').get()).toEqual({ n: 0 })
    expect(fixture.events).toEqual([])
  })
})
