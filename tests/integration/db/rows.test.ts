import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  createProjectFile,
  closeProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { readJobErrorDetail, readWireRow, readWireRows } from '../../../src/main/db/rows'
import { insertAsset, insertCampaign, VALID_BRIEF } from '../row-fixtures'

let dir: string
let project: ProjectHandle
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(dir, { recursive: true, force: true })
})

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-rows-'))
  project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  return project.db
}

describe('stored row to wire row [SPEC 4.4]', () => {
  it('names fields in camelCase, gives flags as booleans and empty columns as null', () => {
    const db = setup()
    insertAsset(db, { id: 'a1', fontPublishAllowed: 1 })
    const row = readWireRow(db, 'asset', { id: 'a1' })
    expect(row).toMatchObject({
      id: 'a1',
      subjectId: null,
      displayName: 'a1.png',
      byteSize: 10,
      fontPublishAllowed: true,
      width: null,
    })
    expect(Object.keys(row ?? {}).some((k) => k.includes('_'))).toBe(false)
  })

  it('parses JSON columns into values', () => {
    const db = setup()
    insertCampaign(db, 'c1')
    expect(readWireRow(db, 'campaign', { id: 'c1' })).toMatchObject({
      languages: ['en-US'],
      sizes: [],
      brief: VALID_BRIEF,
    })
  })

  it('keeps project_meta rows as key and value text', () => {
    const db = setup()
    expect(readWireRow(db, 'project_meta', { key: 'name' })).toEqual({ key: 'name', value: 'P' })
  })

  it('reads a row by a key of two fields, and returns null for a row that is not there', () => {
    const db = setup()
    insertCampaign(db, 'c1')
    db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', 'Shoe', 'x')").run()
    db.prepare("INSERT INTO campaign_subject (campaign_id, subject_id) VALUES ('c1', 's1')").run()
    expect(readWireRow(db, 'campaign_subject', { campaignId: 'c1', subjectId: 's1' })).toEqual({
      campaignId: 'c1',
      subjectId: 's1',
    })
    expect(readWireRow(db, 'campaign_subject', { campaignId: 'c1', subjectId: 's2' })).toBeNull()
  })

  it('throws when a JSON column holds text that is not JSON', () => {
    const db = setup()
    insertCampaign(db, 'c1', { languages: 'not json' })
    expect(() => readWireRow(db, 'campaign', { id: 'c1' })).toThrow()
  })

  it('refuses a campaign row whose brief is not a Brief [SPEC 6.1, 14 step 0 R3]', () => {
    const db = setup()
    insertCampaign(db, 'c1')
    insertCampaign(db, 'c2')
    db.prepare("UPDATE campaign SET brief = '{}' WHERE id = 'c2'").run()
    expect(readWireRows(db, 'campaign').map((r) => r.id)).toEqual(['c1'])
    expect(() => readWireRow(db, 'campaign', { id: 'c2' })).toThrow(/campaign row/)
  })

  it('leaves the main-only job.error_detail out of the wire row [SPEC 4.4]', () => {
    const db = setup()
    db.prepare(
      `INSERT INTO job (id, kind, status, request, error_kind, error_detail, created_at, updated_at)
       VALUES ('j1', 'image_generation', 'failed', '{}', 'quota', 'raw provider text', 'x', 'y')`,
    ).run()
    const row = readWireRow(db, 'job', { id: 'j1' })
    expect(row).toMatchObject({ id: 'j1', errorKind: 'quota' })
    expect(row).not.toHaveProperty('errorDetail')
    expect(readWireRows(db, 'job')[0]).not.toHaveProperty('errorDetail')
    expect(JSON.stringify(row)).not.toContain('raw provider text')
  })

  it('reads job.error_detail only through readJobErrorDetail [SPEC 4.4]', () => {
    const db = setup()
    db.prepare(
      `INSERT INTO job (id, kind, status, request, error_detail, created_at, updated_at)
       VALUES ('j1', 'image_generation', 'failed', '{}', 'raw provider text', 'x', 'y'),
              ('j2', 'image_generation', 'queued', '{}', NULL, 'x', 'y')`,
    ).run()
    expect(readJobErrorDetail(db, 'j1')).toBe('raw provider text')
    expect(readJobErrorDetail(db, 'j2')).toBeNull()
    expect(readJobErrorDetail(db, 'missing')).toBeNull()
  })

  it('reads every row of a table in wire form', () => {
    const db = setup()
    db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', 'Shoe', 'x')").run()
    expect(readWireRows(db, 'subject')).toEqual([
      { id: 's1', name: 'Shoe', description: '', createdAt: 'x' },
    ])
  })
})
