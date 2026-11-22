import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createQueries, createQueryRunner } from '@/main/queries/queries'
import { createProjectRegistry } from '@/main/db/project-registry'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { createAssetService } from '@/main/assets/service'
import type { JobService } from '@/main/jobs/types'
import type { RenderService } from '@/main/thumbnails/types'
import type { SettingsStore } from '@/main/settings/settings-store'
import type { SecretStore } from '@/main/secrets/secret-store'
import type { ApprovalsDeps } from '@/main/approvals/types'
import type { ExportDeps, ExportPictures } from '@/main/export/types'
import { noMediaTool } from '@/main/media/no-media'

let dir: string | undefined
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

function readLog(logDir: string): Array<Record<string, unknown>> {
  return fs
    .readdirSync(logDir)
    .flatMap((n) => fs.readFileSync(path.join(logDir, n), 'utf8').trim().split('\n'))
    .map((l) => JSON.parse(l) as Record<string, unknown>)
}

describe('query runner: INTERNAL [SPEC 4.1, 4.3]', () => {
  it('turns an unknown error into INTERNAL with the fixed message and logs it, without rejecting', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-query-'))
    const logDir = path.join(dir, 'logs')
    const throwing = {
      get: () => {
        throw new Error('disk failed at /Users/someone/settings.json')
      },
    } as unknown as SettingsStore
    const query = createQueries({
      projects: createProjectRegistry(),
      settings: throwing,
      secrets: { summaries: () => [] } as unknown as SecretStore,
      undo: createUndoLists(),
      providers: [],
      log: createActivityLog({ dir: logDir, minLevel: 'debug', now: () => new Date() }),
      assets: createAssetService(),
      jobs: {} as unknown as JobService,
      render: {} as unknown as RenderService,
      openExternal: async () => {
        throw new Error('openExternal is not available')
      },
      devTools: false,
      toPng: () => {
        throw new Error('toPng is not available')
      },
      fitPicture: () => {
        throw new Error('fitPicture is not available')
      },
      webpToPng: async () => {
        throw new Error('webpToPng is not available')
      },
      approvals: {} as unknown as ApprovalsDeps,
      export: {} as unknown as ExportDeps,
      exportPictures: {} as unknown as ExportPictures,
      media: noMediaTool,
      appVersion: '0.1.0',
      now: () => new Date(),
      userDataDir: dir,
    })

    const result = await query('app.getState', {}, { actor: 'user' })

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong. The details are in the activity log.',
        details: { commandId: expect.stringMatching(/^[0-9A-Z]{26}$/) },
      },
    })
    expect(JSON.stringify(result)).not.toContain('/Users/someone')
    const line = readLog(logDir).at(-1)
    expect(line).toMatchObject({ level: 'error', errorKind: 'INTERNAL', name: 'app.getState' })
    expect((line?.context as { error: { message: string } }).error.message).toContain('disk failed')
  })

  it("logs a failed query with event 'query' and the reply's ULID as context.commandId [SPEC 9.1, 1.7]", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-query-'))
    const logDir = path.join(dir, 'logs')
    const log = createActivityLog({ dir: logDir, minLevel: 'debug', now: () => new Date() })
    const query = createQueryRunner(
      {
        'test.broken': () => {
          throw new Error('broken')
        },
      },
      log,
    )
    const result = await query('test.broken', {}, { actor: 'user' })
    const commandId = result.ok ? undefined : result.error.details?.commandId
    expect(commandId).toEqual(expect.stringMatching(/^[0-9A-Z]{26}$/))
    expect(readLog(logDir).at(-1)).toMatchObject({
      event: 'query',
      name: 'test.broken',
      errorKind: 'INTERNAL',
      context: { commandId },
    })
  })
})
