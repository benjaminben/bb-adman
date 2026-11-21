import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  createProjectFile,
  closeProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { readWireRow, storedJson } from '../../../src/main/db/rows'

let dir: string | undefined
let project: ProjectHandle | undefined
afterEach(() => {
  if (project) closeProjectFile(project)
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  project = undefined
  dir = undefined
})

function setup(): ProjectHandle {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-stored-json-'))
  project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  return project
}

// True when fn throws a plain Error (a programming error), not a TypeError or another kind.
function plainError(fn: () => unknown): boolean {
  try {
    fn()
  } catch (e) {
    return Object.getPrototypeOf(e) === Error.prototype
  }
  return false
}

describe('storedJson, the text of a JSON column [SPEC 4.4 1.38, 14 1.38 Y1]', () => {
  it('gives the JSON text of an object', () => {
    expect(storedJson('job', 'request', { prompt: 'a cat', count: 2 })).toBe(
      '{"prompt":"a cat","count":2}',
    )
  })

  it('gives the JSON text of a list', () => {
    expect(storedJson('campaign', 'languages', ['en', 'de'])).toBe('["en","de"]')
  })

  it('gives null for null and for undefined', () => {
    expect(storedJson('job', 'result', null)).toBeNull()
    expect(storedJson('job', 'result', undefined)).toBeNull()
  })

  it('throws for a field that is not a JSON column of that table', () => {
    expect(plainError(() => storedJson('job', 'status', 'queued'))).toBe(true)
    expect(plainError(() => storedJson('asset', 'request', {}))).toBe(true)
  })

  it('throws when the value has no JSON text', () => {
    expect(plainError(() => storedJson('job', 'result', () => 1))).toBe(true)
  })

  it('gives text that reads back through readWireRow as the same value', () => {
    const h = setup()
    const request = { prompt: 'a cat', count: 1, references: [] }
    const result = { assetIds: ['a1', 'a2'], stage: 'waiting' }
    h.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, result, created_at, updated_at)
         VALUES ('j1', 'image_generation', 'succeeded', 'fake', 'm1', ?, ?, 'x', 'x')`,
      )
      .run(storedJson('job', 'request', request), storedJson('job', 'result', result))
    expect(readWireRow(h.db, 'job', { id: 'j1' })).toMatchObject({ request, result })
  })
})
