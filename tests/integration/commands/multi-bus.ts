// Test harness: a bus over several real project files, with a test-only command whose
// replay can be told to refuse or to throw. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { createProjectRegistry } from '@/main/db/project-registry'
import { createCommandBus, type BusEvent, type PermissionRequest } from '@/main/commands/bus'
import { defineCommand, type CommandHandler } from '@/main/commands/types'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { AppError } from '@/shared/schemas/result'

export type Control = { refuse: boolean; throwUnknown: boolean }

export const TEST_SCOPE = 'variant:v1'

export function readValue(db: Database.Database): string | null {
  const row = db.prepare("SELECT value FROM project_meta WHERE key = 'test_value'").get() as
    { value: string } | undefined
  return row?.value ?? null
}

const setInput = z.object({ projectId: z.string(), value: z.string() })

// Writes project_meta.test_value; undo scope variant:v1. Named layer.update so agents may run it.
export function refusableSet(ctl: Control, name = 'layer.update'): CommandHandler {
  return defineCommand({
    name,
    input: setInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const before = readValue(db)
      db.prepare(
        "INSERT INTO project_meta (key, value) VALUES ('test_value', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).run(input.value)
      ctx.changes.touch('project_meta', { key: 'test_value' })
      if (ctl.refuse) throw new AppError('RULE_VIOLATION', 'Refused by the test.')
      if (ctl.throwUnknown) throw new Error('boom at /Users/someone/secret/path.adman')
      return {
        data: { value: input.value },
        inverse: {
          scope: TEST_SCOPE,
          call: { name, input: { projectId: input.projectId, value: before ?? '' } },
        },
      }
    },
  })
}

export function makeMultiBus(opts: {
  count: number
  handlers: (ctl: Control) => CommandHandler[]
  askPermission?: (req: PermissionRequest) => Promise<boolean>
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-multi-'))
  const logDir = path.join(dir, 'logs')
  const registry = createProjectRegistry()
  const handles = Array.from({ length: opts.count }, (_, i) =>
    createProjectFile({
      filePath: path.join(dir, `P${i}.adman`),
      name: `P${i}`,
      appVersion: '0.1.0',
      now: 'x',
    }),
  )
  for (const h of handles) registry.add(h)
  const ctl: Control = { refuse: false, throwUnknown: false }
  const events: BusEvent[] = []
  const undo = createUndoLists()
  const log = createActivityLog({
    dir: logDir,
    minLevel: 'debug',
    now: () => new Date('2026-11-20T10:00:00Z'),
  })
  const bus = createCommandBus({
    handlers: opts.handlers(ctl),
    projects: registry,
    undo,
    log,
    emit: (e) => events.push(e),
    askPermission: opts.askPermission ?? (async () => false),
  })
  return {
    bus,
    ctl,
    events,
    undo,
    registry,
    projects: handles.map((h) => ({
      projectId: h.projectId,
      db: h.db,
      value: () => readValue(h.db),
    })),
    logLines: (): Array<Record<string, unknown>> => {
      const file = path.join(logDir, 'activity-2026-11-20.jsonl')
      if (!fs.existsSync(file)) return []
      return fs
        .readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    },
    cleanup: () => {
      for (const h of handles) closeProjectFile(h)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
