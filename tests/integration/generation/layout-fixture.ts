// Test harness for the layout_proposal job kind (P4-7): a real core whose render service draws
// through a stand-in, and beside it a runner and bus that know only generation.proposeLayout,
// job.cancel and the layout kind over a stand-in layout adapter. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { vi } from 'vitest'
import { createCore } from '@/main/core'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { generationProposeLayout } from '@/main/commands/generation/propose-layout'
import { jobCancel } from '@/main/commands/job/cancel'
import { readWireRow } from '@/main/db/rows'
import { createJobRunner } from '@/main/jobs/runner'
import { layoutProposalKind } from '@/main/jobs/kinds/layout-proposal'
import type { CoreDeps } from '@/main/core-deps'
import type { DrawScene } from '@/main/thumbnails/types'
import type { LayoutBox, LayoutProvider, RunOptions } from '@/main/providers/types'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { fakeCrypto, data } from '../core-fixture'
import { seed, VARIANT, TEXT_LAYER } from './generation-fixture'

export const PICTURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7])

export const LAYOUT_TEST: ProviderInfo = {
  id: 'layout-test',
  label: 'Layout Test',
  jobs: ['layout'],
  available: true,
  secrets: [],
  defaultModels: { layout: 'layout-model-1' },
  local: false,
  cancel: 'stops',
  serverText: false,
}

export type ProposeInput = Parameters<LayoutProvider['propose']>[0]
export type Propose = (input: ProposeInput, opts?: RunOptions) => Promise<LayoutBox[]>

// A second text layer above the first, a font on the first, and the campaign's palette.
function seedLayout(f: { db: import('better-sqlite3').Database }): void {
  f.db.exec(`
    INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, font_family, created_at)
      VALUES ('font1', 'asset', 'font', 'imported', 'linked', 'b.ttf', '/nowhere/b.ttf', 'b.ttf',
      'font/ttf', 10, 1, 'h', 'Brand Sans', 'x');
    INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
      SELECT 'l-cta', variant_id, 'cta', 'text', 'call_to_action', 'CTA', 5, 'Buy now', style,
      geometry, NULL, timing, animation, revs, synced_revs FROM layer WHERE id = '${TEXT_LAYER}';
    INSERT INTO rule_set (campaign_id, palette) VALUES ('c1', '["#FF0000","#0000FF"]');
  `)
  const style = f.db.prepare('SELECT style FROM layer WHERE id = ?').get(TEXT_LAYER) as {
    style: string
  }
  const withFont = { ...(JSON.parse(style.style) as object), fontAssetId: 'font1' }
  f.db.prepare('UPDATE layer SET style = ? WHERE id = ?').run(JSON.stringify(withFont), TEXT_LAYER)
}

export async function makeLayoutFixture(opts: { draw?: DrawScene; jobsAtOnce?: number } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-layout-'))
  const events: BusEvent[] = []
  const draw = vi.fn<DrawScene>(opts.draw ?? (async () => ({ png: PICTURE, overflow: {} })))
  const core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: () => undefined,
    askPermission: async () => false,
    drawScene: draw,
  })
  const created = await core.bus.execute(
    'project.create',
    { name: 'P', location: root },
    { actor: 'user' },
  )
  const projectId = data<{ projectId: string }>(created).projectId
  const project = core.projects.requireOpen(projectId)
  seed(project.db)
  seedLayout(project)

  const t = { propose: (async () => []) as Propose }
  const calls: Array<{ input: ProposeInput; opts?: RunOptions }> = []
  const provider: LayoutProvider = {
    propose: (input, runOpts) => {
      calls.push({ input, opts: runOpts })
      return t.propose(input, runOpts)
    },
  }
  const deps: CoreDeps = { ...core.deps, providers: [...core.deps.providers, LAYOUT_TEST] }
  deps.jobs = createJobRunner({
    deps: () => deps,
    bus: () => bus,
    emit: (e) => events.push(e),
    handlers: [layoutProposalKind(() => provider)],
    cancelWaitMs: () => 2_000,
    closeWaitMs: 50,
    jobsAtOnce: opts.jobsAtOnce ?? 3,
  })
  const bus = createCommandBus({
    handlers: [generationProposeLayout(deps), jobCancel(deps)],
    projects: deps.projects,
    undo: deps.undo,
    log: deps.log,
    emit: (e) => events.push(e),
    askPermission: async () => false,
  })
  const user = (name: string, input: Record<string, unknown>) =>
    bus.execute(name, { projectId, ...input }, { actor: 'user' })

  return {
    t,
    calls,
    draw,
    project,
    db: project.db,
    projectId,
    user,
    async start(): Promise<string> {
      const r = await user('generation.proposeLayout', {
        variantId: VARIANT,
        provider: LAYOUT_TEST.id,
      })
      return data<{ jobId: string }>(r).jobId
    },
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow,
    async cleanup() {
      await deps.jobs.cancelAll(projectId)
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

export type LayoutFixture = Awaited<ReturnType<typeof makeLayoutFixture>>
