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

describe('wire rows for the 1.8 fields [SPEC 3.3, 4.4]', () => {
  it('reads agentChangedAt on a variant and the four new job fields', () => {
    const db = setup()
    db.exec(`
      INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes, template_id, brief, created_by, created_at)
        VALUES ('c1', 'C', 'US', 'all', 'Hello', 'en-US', '["en-US"]', '[]', 'starter', '{}', 'user', 'x');
      INSERT INTO direction (id, campaign_id, name, master_variant_id, sort) VALUES ('d1', 'c1', 'A', 'v1', 0);
      INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format, duration_ms, created_by, created_at, agent_changed_at)
        VALUES ('v1', 'd1', 'Shoe', 1080, 1080, '1x1', 'en-US', 'image', 6000, 'user', 'x', 't');
      INSERT INTO job (id, kind, status, variant_id, layer_id, slot, request, paid_calls, seen_at, created_at, updated_at)
        VALUES ('j1', 'image_generation', 'succeeded', 'v1', 'l1', 'background', '{"count":1}', 2, 's', 'x', 'y');
    `)
    expect(readWireRow(db, 'variant', { id: 'v1' })).toMatchObject({
      durationOverridden: false,
      agentChangedAt: 't',
    })
    expect(readWireRow(db, 'job', { id: 'j1' })).toMatchObject({
      layerId: 'l1',
      slot: 'background',
      paidCalls: 2,
      seenAt: 's',
      request: { count: 1 },
      result: null,
    })
  })

  it('refuses a job row with a kind outside the nine', () => {
    const db = setup()
    db.pragma('ignore_check_constraints = ON')
    db.prepare(
      "INSERT INTO job (id, kind, status, request, created_at, updated_at) VALUES ('j1', 'cooking', 'queued', '{}', 'x', 'y')",
    ).run()
    expect(() => readWireRow(db, 'job', { id: 'j1' })).toThrow()
  })
})
