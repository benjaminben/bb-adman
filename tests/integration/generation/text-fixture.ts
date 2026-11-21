// Test harness for P4-8, the copy_options and brief_extraction jobs: one real project file, the
// real runner, bus and activity log, and a stand-in text adapter handed to both kinds (the fake
// provider's text part is P4-3's). The stand-in is not local, so its calls are counted. Each
// test sets what each call answers. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createProjectFile, closeProjectFile } from '@/main/db/project-file'
import { createProjectRegistry } from '@/main/db/project-registry'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { createUndoLists } from '@/main/history/undo-lists'
import { createActivityLog } from '@/main/log/activity-log'
import { listProviders } from '@/main/providers/registry'
import { createJobRunner } from '@/main/jobs/runner'
import { generationCopyOptions } from '@/main/commands/generation/copy-options'
import { briefExtract } from '@/main/commands/brief/extract'
import { copyOptionsKind } from '@/main/jobs/kinds/copy-options'
import { briefExtractionKind } from '@/main/jobs/kinds/brief-extraction'
import type { TextProvider } from '@/main/providers/types'
import type { CoreDeps } from '@/main/core-deps'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { seed, TEXT_LAYER } from './generation-fixture'

export const TEXT: ProviderInfo = {
  id: 'paid-text',
  label: 'Paid Text',
  jobs: ['text'],
  available: true,
  secrets: [],
  defaultModels: { text: 'text-model-1' },
  local: false,
  cancel: 'none',
  serverText: false,
}
export const PICTURES_ONLY: ProviderInfo = { ...TEXT, id: 'pictures-only', jobs: ['image'] }
export const NOT_AVAILABLE: ProviderInfo = { ...TEXT, id: 'not-available', available: false }
export const KEYED: ProviderInfo = { ...TEXT, id: 'keyed', label: 'Keyed', secrets: ['KEYED_KEY'] }

export const CTA_LAYER = 'l-cta'
export const BODY_LAYER = 'l-body'

type CopyInput = Parameters<TextProvider['copyOptions']>[0]
type Answer<I, T> = T | ((input: I) => Promise<T>)

function copyTextLayer(project: { db: { exec(sql: string): unknown } }, id: string, slot: string) {
  const slotValue = slot === '' ? 'NULL' : `'${slot}'`
  project.db.exec(`
    INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
    SELECT '${id}', variant_id, '${id}', type, ${slotValue}, name, z, copy, style, geometry,
      source, timing, animation, revs, synced_revs FROM layer WHERE id = '${TEXT_LAYER}'
  `)
}

export function makeTextFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-text-'))
  const projects = createProjectRegistry()
  const project = createProjectFile({
    filePath: path.join(dir, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects.add(project)
  seed(project.db)
  copyTextLayer(project, CTA_LAYER, 'call-to-action')
  copyTextLayer(project, BODY_LAYER, '')
  const events: BusEvent[] = []
  const logDir = path.join(dir, 'logs')
  const log = createActivityLog({ dir: logDir, minLevel: 'debug', now: () => new Date() })
  const t = {
    copy: ['Shop now'] as Answer<CopyInput, string[]>,
    draft: {} as Answer<{ text: string }, unknown>,
    copyCalls: [] as CopyInput[],
    briefCalls: [] as Array<{ text: string }>,
    adapterFor: [] as string[],
  }
  const provider: TextProvider = {
    async copyOptions(input) {
      t.copyCalls.push(input)
      return typeof t.copy === 'function' ? t.copy(input) : t.copy
    },
    async extractBrief(input) {
      t.briefCalls.push(input)
      const answer = typeof t.draft === 'function' ? await t.draft(input) : t.draft
      return answer as Awaited<ReturnType<TextProvider['extractBrief']>>
    },
    translate: () => Promise.reject(new Error('not used')),
  }
  const textFor = (_deps: CoreDeps, providerId: string) => {
    t.adapterFor.push(providerId)
    return provider
  }
  const settings = {
    current: { agentRuns: {} as Record<string, { allowed: boolean }>, agentRunLimit: 4 },
    get: () => settings.current,
  }
  const providers = [
    ...listProviders({ ADMAN_FAKE_PROVIDERS: '1' }),
    TEXT,
    PICTURES_ONLY,
    NOT_AVAILABLE,
    KEYED,
  ]
  const deps = {
    projects,
    providers,
    settings,
    log,
    undo: createUndoLists(),
    secrets: { get: (): string | undefined => undefined },
    appVersion: '0.1.0',
    now: () => new Date('2026-11-20T14:30:00.000Z'),
  } as unknown as CoreDeps
  const jobs = createJobRunner({
    deps: () => deps,
    bus: () => bus,
    emit: (e) => events.push(e),
    handlers: [copyOptionsKind(textFor), briefExtractionKind(textFor)],
    cancelWaitMs: () => 2_000,
    closeWaitMs: 50,
  })
  deps.jobs = jobs
  const bus = createCommandBus({
    handlers: [generationCopyOptions(deps), briefExtract(deps)],
    projects,
    undo: deps.undo,
    log,
    emit: (e) => events.push(e),
    askPermission: async () => false,
    agentRuns: { providers, settings },
  })
  const send = (actor: 'user' | 'agent') => (name: string, input: Record<string, unknown>) =>
    bus.execute(name, { projectId: project.projectId, ...input }, { actor })

  return {
    t,
    events,
    project,
    db: project.db,
    root: dir,
    user: send('user'),
    agent: send('agent'),
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    jobs: () => readWireRows(project.db, 'job') as JobRow[],
    errorDetail: (id: string) =>
      (
        project.db.prepare('SELECT error_detail FROM job WHERE id = ?').get(id) as {
          error_detail: string | null
        }
      ).error_detail,
    // Every line the activity log holds, as written to disk.
    logText: () =>
      fs.existsSync(logDir)
        ? fs
            .readdirSync(logDir)
            .map((name) => fs.readFileSync(path.join(logDir, name), 'utf8'))
            .join('')
        : '',
    cleanup() {
      if (projects.remove(project.projectId)) closeProjectFile(project)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type TextFixture = ReturnType<typeof makeTextFixture>
