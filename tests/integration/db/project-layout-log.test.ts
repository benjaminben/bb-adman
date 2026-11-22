import fs from 'node:fs'
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

// LP-11: a refused layout names nothing from the file in the reply, an event or a log line.
const MARKER = 'trg_marker_zq'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

describe('project.open refuses a hostile layout with a fixed sentence [LP-11]', () => {
  it('keeps the marker out of the reply, the events and the log', async () => {
    f = makeFixture()
    const made = data<{ projectId: string; filePath: string }>(
      await f.user('project.create', { name: 'A', location: f.projectsDir }),
    )
    data(await f.user('project.close', { projectId: made.projectId }))
    const raw = new Database(made.filePath)
    raw.exec(`CREATE TRIGGER ${MARKER} AFTER UPDATE ON project_meta BEGIN SELECT 1; END`)
    raw.close()
    const before = fs.readFileSync(made.filePath)

    const reply = await f.user('project.open', { filePath: made.filePath })
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'This file is not an Adman project, or it is damaged.',
        details: { reason: 'not_a_project' },
      },
    })
    expect(f.core.projects.all()).toEqual([])
    expect(fs.readFileSync(made.filePath).equals(before)).toBe(true)
    expect(JSON.stringify(f.events)).not.toContain(MARKER)
    expect(f.readLogs()).not.toContain(MARKER)
  })
})
