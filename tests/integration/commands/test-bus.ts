// Test harness: a bus over one real project file, with test-only handlers that
// stand in for later-phase commands. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'
import { createProjectFile, closeProjectFile } from '../../../src/main/db/project-file'
import { createProjectRegistry } from '../../../src/main/db/project-registry'
import {
  createCommandBus,
  type BusEvent,
  type PermissionRequest,
} from '../../../src/main/commands/bus'
import { defineCommand, type CommandHandler } from '../../../src/main/commands/types'
import { createUndoLists } from '../../../src/main/history/undo-lists'
import { createActivityLog } from '../../../src/main/log/activity-log'
import { AppError } from '../../../src/shared/schemas/result'

const setInput = z.object({
  projectId: z.string(),
  value: z.string(),
  failAfterWrite: z.boolean().optional(),
})

function readValue(db: import('better-sqlite3').Database): string | null {
  const row = db.prepare("SELECT value FROM project_meta WHERE key = 'test_value'").get() as
    { value: string } | undefined
  return row?.value ?? null
}

// Writes project_meta.test_value; undo scope campaign:c1. Registered as layer.update so the
// agent policy for it is 'allow'.
export function setValueHandler(name = 'layer.update'): CommandHandler {
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
      if (input.failAfterWrite) throw new AppError('RULE_VIOLATION', 'Stopped after writing.')
      return {
        data: { value: input.value },
        inverse: {
          scope: 'campaign:c1',
          call: { name, input: { projectId: input.projectId, value: before ?? '' } },
        },
      }
    },
  })
}

export function makeBusFixture(
  handlers: CommandHandler[],
  askPermission: (req: PermissionRequest) => Promise<boolean> = async () => false,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-bus-'))
  const logDir = path.join(dir, 'logs')
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  const events: BusEvent[] = []
  const undo = createUndoLists()
  const log = createActivityLog({
    dir: logDir,
    minLevel: 'debug',
    now: () => new Date('2026-11-20T10:00:00Z'),
  })
  const bus = createCommandBus({
    handlers,
    projects,
    undo,
    log,
    emit: (e) => events.push(e),
    askPermission,
  })
  return {
    bus,
    events,
    undo,
    projects,
    projectId: project.meta.projectId,
    value: () => readValue(project.db),
    logLines: (): Array<Record<string, unknown>> => {
      const file = path.join(logDir, 'activity-2026-11-20.jsonl')
      if (!fs.existsSync(file)) return []
      return fs
        .readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    },
    logText: () =>
      fs.existsSync(logDir)
        ? fs
            .readdirSync(logDir)
            .map((f) => fs.readFileSync(path.join(logDir, f), 'utf8'))
            .join('')
        : '',
    cleanup: () => {
      closeProjectFile(project)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
