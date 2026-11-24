// Lows C: the fan-out dialog's count lines against variant.fanOut through the real core with
// the fake provider. For image and video the dialog's variant count equals what the command
// makes, and its paid counts (fills, translations) are never below the jobs the command asks
// for: a video format adds no paid request of its own.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCore, type Core } from '@/main/core'
import { readWireRows } from '@/main/db/rows'
import * as model from '@/renderer/dialogs/fan-out/fan-out-model'
import type { VariantFanOutReply } from '@/shared/schemas/commands/variant'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { createInput, SQUARE, TALL } from '../campaigns/campaign-fixture'
import { data, fakeCrypto } from '../core-fixture'
import { waitFor } from '../translation/propose-fixture'

const LANGUAGES = ['en', 'fr']
let root = ''
let core: Core | undefined
afterEach(() => {
  core?.closeAll()
  core = undefined
  fs.rmSync(root, { recursive: true, force: true })
})

async function setUp() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-fanout-count-'))
  const made = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: () => undefined,
    askPermission: async () => false,
  })
  core = made
  const opened = await made.bus.execute(
    'project.create',
    { name: 'P', location: root },
    { actor: 'user' },
  )
  const projectId = data<{ projectId: string }>(opened).projectId
  const run = (name: string, input: Record<string, unknown>) =>
    made.bus.execute(name, { projectId, ...input }, { actor: 'user' })
  data(await run('campaign.create', { ...createInput(), languages: LANGUAGES }))
  const set = { defaultProviders: { text: 'fake' } }
  data(await made.bus.execute('settings.update', set, { actor: 'user' }))
  const db = made.projects.requireOpen(projectId).db
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, created_at, width, height)
     VALUES ('A1', 'asset', 'image', 'imported', 'linked', 'a.png', '/x/a.png', 'a.png',
      'image/png', 1, 1, 'h', 'x', 1000, 1000)`,
  ).run()
  db.prepare(`UPDATE layer SET source = '{"assetId":"A1"}' WHERE type = 'background'`).run()
  const direction = db.prepare('SELECT id, master_variant_id AS masterId FROM direction').get() as {
    id: string
    masterId: string
  }
  const variants = () => readWireRows(db, 'variant') as VariantRow[]
  const jobs = () => readWireRows(db, 'job') as JobRow[]
  const fanOut = async (input: Record<string, unknown>) =>
    data<VariantFanOutReply>(await run('variant.fanOut', { directionId: direction.id, ...input }))
  const basis = (): model.FanOutBasis => {
    const master = variants().find((v) => v.id === direction.masterId)
    if (!master) throw new Error('no master')
    const lists = { sizes: [SQUARE, TALL], languages: LANGUAGES, primaryLanguage: 'en' }
    return { ...lists, master, existing: variants() }
  }
  const ended = () => jobs().every((j) => ['succeeded', 'failed', 'cancelled'].includes(j.status))
  return { fanOut, basis, jobs, ended }
}

describe('fan-out dialog counts against variant.fanOut [lows C]', () => {
  it('for image and video counts the variants exactly and never fewer paid requests', async () => {
    const bus = await setUp()
    const first = { sizes: [SQUARE.label, TALL.label], languages: ['en', 'fr'] }
    await bus.fanOut({ ...first, formats: ['image'], fits: { [TALL.label]: 'scale' } })
    await waitFor(bus.ended)
    const before = bus.jobs().length

    // Every image exists now: fr gets only videos, and still one translation.
    const ticks = { sizes: [TALL.label], languages: ['fr'] }
    const formats = model.formatsToSend(['video', 'image'])
    const basis = bus.basis()
    const fits = model.fitsToSend(basis, ticks, { [TALL.label]: 'fill' }, true)
    const count = model.newCells(basis, ticks, formats).length
    const fills = model.fillCount(fits)
    const translations = model.translationCount(basis, ticks, formats)

    const reply = await bus.fanOut({ ...model.fanOutLists(basis, ticks), formats, fits })
    const translationJobs = reply.translationJobIds ?? []
    expect(reply.variantIds).toHaveLength(count)
    expect(count).toBe(4)
    expect(reply.fill.length).toBeGreaterThan(0)
    expect(fills).toBeGreaterThanOrEqual(reply.fill.length)
    // DLG-4b: the fill line counts exactly the fills the command asks for.
    expect(model.fillsSent(basis, ticks, fits, formats)).toBe(reply.fill.length)
    expect(translationJobs.length).toBeGreaterThan(0)
    expect(translations).toBeGreaterThanOrEqual(translationJobs.length)
    expect(bus.jobs().length - before).toBe(translationJobs.length)
    await waitFor(bus.ended)
  })
})
