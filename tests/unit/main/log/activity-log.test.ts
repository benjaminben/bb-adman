import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createActivityLog } from '@/main/log/activity-log'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-log-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const at = (iso: string) => () => new Date(iso)

function lines(file: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(path.join(dir, file), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>)
}

describe('activity log [SPEC 9.1, FR-153]', () => {
  it('writes one JSON object per line to activity-{YYYY-MM-DD}.jsonl', () => {
    const log = createActivityLog({ dir, minLevel: 'info', now: at('2026-11-20T10:00:00.000Z') })
    log.write({
      level: 'info',
      event: 'command',
      name: 'project.create',
      actor: 'user',
      ok: true,
      message: 'a',
    })
    log.write({
      level: 'error',
      event: 'app',
      name: 'start',
      actor: 'system',
      ok: false,
      message: 'b',
    })
    expect(lines('activity-2026-11-20.jsonl')).toHaveLength(2)
  })

  it('writes every required field, with null where nothing applies', () => {
    const log = createActivityLog({ dir, minLevel: 'info', now: at('2026-11-20T10:00:00.000Z') })
    log.write({
      level: 'info',
      event: 'command',
      name: 'project.open',
      actor: 'user',
      ok: true,
      message: 'm',
      projectId: 'P1',
      context: { commandId: 'C1' },
    })
    expect(lines('activity-2026-11-20.jsonl')[0]).toEqual({
      timestamp: '2026-11-20T10:00:00.000Z',
      level: 'info',
      event: 'command',
      name: 'project.open',
      actor: 'user',
      agentClient: null,
      projectId: 'P1',
      campaignId: null,
      variantId: null,
      jobId: null,
      ok: true,
      errorKind: null,
      message: 'm',
      context: { commandId: 'C1' },
    })
  })

  it('starts a new file each day', () => {
    let now = new Date('2026-11-20T23:59:59.000Z')
    const log = createActivityLog({ dir, minLevel: 'info', now: () => now })
    log.write({ level: 'info', event: 'app', name: 'a', actor: 'system', ok: true, message: '' })
    now = new Date('2026-11-21T00:00:01.000Z')
    log.write({ level: 'info', event: 'app', name: 'b', actor: 'system', ok: true, message: '' })
    expect(fs.readdirSync(dir).sort()).toEqual([
      'activity-2026-11-20.jsonl',
      'activity-2026-11-21.jsonl',
    ])
  })

  it('skips entries below the lowest level set by ADMAN_LOG_LEVEL', () => {
    const log = createActivityLog({ dir, minLevel: 'warn', now: at('2026-11-20T10:00:00.000Z') })
    log.write({ level: 'debug', event: 'app', name: 'a', actor: 'system', ok: true, message: '' })
    log.write({ level: 'info', event: 'app', name: 'b', actor: 'system', ok: true, message: '' })
    log.write({ level: 'warn', event: 'app', name: 'c', actor: 'system', ok: true, message: '' })
    expect(lines('activity-2026-11-20.jsonl').map((l) => l.name)).toEqual(['c'])
  })

  it('deletes log files older than 30 days and keeps other files', () => {
    for (const name of [
      'activity-2026-10-20.jsonl',
      'activity-2026-10-21.jsonl',
      'activity-2026-11-19.jsonl',
      'notes.txt',
    ]) {
      fs.writeFileSync(path.join(dir, name), '')
    }
    const log = createActivityLog({ dir, minLevel: 'info', now: at('2026-11-20T10:00:00.000Z') })
    log.prune()
    expect(fs.readdirSync(dir).sort()).toEqual([
      'activity-2026-10-21.jsonl',
      'activity-2026-11-19.jsonl',
      'notes.txt',
    ])
  })
})
