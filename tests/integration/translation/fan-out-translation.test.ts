// P6-15 (spec/phases/phase-06.md, section 7, "Fan-out, step 6"; A-163): variant.fanOut through
// the real core with the fake provider. New text layers in another language start `missing`,
// the brief's copy fills what it gives (source `brief`), one translation job per language runs
// for the rest, and the reply names the jobs. No key or a failed job leaves the master's text
// marked missing. An agent cannot fan out, so it starts no translation.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createCore, type Core } from '@/main/core'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { fakeCrypto, data } from '../core-fixture'
import { createInput, SQUARE, TALL } from '../campaigns/campaign-fixture'
import { waitFor } from './propose-fixture'

type Setup = { copy?: Record<string, { headline?: string; callToAction?: string }> }

let root = ''
let core: Core | undefined
afterEach(() => {
  resetFakeBehaviour()
  core?.closeAll()
  core = undefined
  fs.rmSync(root, { recursive: true, force: true })
})

async function setUp(setup: Setup = {}, textProvider: string | null = 'fake') {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-fanout-tr-'))
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
  const exec = (actor: 'user' | 'agent') => (name: string, input: Record<string, unknown>) =>
    made.bus.execute(name, { projectId, ...input }, { actor })
  const base = createInput()
  const brief = { ...base.brief, callToAction: 'Shop the range', copy: setup.copy }
  data(await exec('user')('campaign.create', { ...base, brief, languages: ['en', 'de', 'fr'] }))
  if (textProvider === 'keyed') {
    const fake = made.deps.providers.find((p) => p.id === 'fake')
    if (!fake) throw new Error('no fake provider row')
    made.deps.providers.push({ ...fake, id: 'keyed', label: 'Keyed', secrets: ['gemini.apiKey'] })
  }
  if (textProvider) {
    const set = await made.bus.execute(
      'settings.update',
      { defaultProviders: { text: textProvider } },
      { actor: 'user' },
    )
    data(set)
  }
  const db = made.projects.requireOpen(projectId).db
  const direction = db.prepare('SELECT id, master_variant_id AS masterId FROM direction').get() as {
    id: string
    masterId: string
  }
  const variants = () => readWireRows(db, 'variant') as VariantRow[]
  const textOf = (variantId: string) =>
    (readWireRows(db, 'layer') as LayerRow[])
      .filter((l) => l.variantId === variantId && l.type === 'text')
      .sort((a, b) => a.z - b.z)
  const job = (id: string) => readWireRow(db, 'job', { id }) as JobRow
  const fanOut = (actor: 'user' | 'agent' = 'user') =>
    exec(actor)('variant.fanOut', {
      directionId: direction.id,
      sizes: [SQUARE.label, TALL.label],
      languages: ['en', 'de', 'fr'],
      formats: ['image'],
      fits: { [TALL.label]: 'scale' },
    })
  const inLanguage = (language: string) =>
    variants().filter((v) => v.language === language && v.id !== direction.masterId)
  const masterText = () => textOf(direction.masterId)
  const jobs = () => readWireRows(db, 'job') as JobRow[]
  const ended = (id: string) => ['succeeded', 'failed', 'cancelled'].includes(job(id).status)
  return { fanOut, inLanguage, textOf, masterText, job, jobs, ended }
}
type Bus = Awaited<ReturnType<typeof setUp>>

const replyOf = (r: unknown) => data<{ variantIds: string[]; translationJobIds?: string[] }>(r)
const states = (bus: Bus, language: string) =>
  bus
    .inLanguage(language)
    .flatMap((v) => bus.textOf(v.id))
    .map((l) => ({
      key: l.key,
      copy: l.copy,
      status: l.translationStatus,
      source: l.translationSource,
    }))
const masterCopy = (bus: Bus, key: string) => bus.masterText().find((l) => l.key === key)?.copy

async function finished(bus: Bus, ids: string[]) {
  await waitFor(() => ids.every((id) => bus.ended(id)))
}

describe('translation at fan-out [P6-15]', () => {
  it('runs one job per language and writes the fake text as proposed, source ai', async () => {
    const bus = await setUp()
    const reply = replyOf(await bus.fanOut())
    expect(reply.translationJobIds).toHaveLength(2)
    const ids = reply.translationJobIds ?? []
    const requests = ids.map((id) => bus.job(id).request as TranslationJobRequest)
    expect(requests.map((r) => r.to).sort()).toEqual(['de', 'fr'])
    for (const id of ids) {
      expect(bus.job(id)).toMatchObject({
        kind: 'translation',
        startedBy: 'user',
        provider: 'fake',
      })
    }
    await finished(bus, ids)
    for (const language of ['de', 'fr']) {
      const got = states(bus, language)
      expect(got.length).toBeGreaterThan(0)
      for (const s of got) {
        expect(s).toMatchObject({ status: 'proposed', source: 'ai' })
        expect(s.copy).toBe(`[${language}] ${masterCopy(bus, s.key)}`)
      }
    }
    for (const s of states(bus, 'en')) expect(s).toMatchObject({ status: null, source: null })
  })

  it('fills the headline from the brief with source brief, and the job covers the rest', async () => {
    const bus = await setUp({ copy: { de: { headline: '  Sommer im Glas  ' } } })
    const ids = replyOf(await bus.fanOut()).translationJobIds ?? []
    const de = ids
      .map((id) => bus.job(id).request as TranslationJobRequest)
      .find((r) => r.to === 'de')
    expect(de?.items.map((i) => i.key)).not.toContain('headline')
    expect(de?.targets.map((t) => t.key)).not.toContain('headline')
    expect(de?.targets.length).toBeGreaterThan(0)
    await finished(bus, ids)
    for (const s of states(bus, 'de')) {
      if (s.key === 'headline') {
        expect(s).toEqual({
          key: s.key,
          copy: 'Sommer im Glas',
          status: 'proposed',
          source: 'brief',
        })
      } else expect(s).toMatchObject({ status: 'proposed', source: 'ai' })
    }
  })

  it('runs no job for a language whose brief gives every text', async () => {
    const copy = {
      de: { headline: 'Sommer im Glas', callToAction: 'Jetzt kaufen' },
      fr: { headline: "L'été en bouteille", callToAction: 'Acheter' },
    }
    const bus = await setUp({ copy })
    const reply = replyOf(await bus.fanOut())
    expect(reply.translationJobIds).toBeUndefined()
    expect(bus.jobs()).toEqual([])
    for (const s of states(bus, 'de'))
      expect(s).toMatchObject({ status: 'proposed', source: 'brief' })
  })

  it('starts no job and leaves the master text missing when the provider has no key', async () => {
    const bus = await setUp({}, 'keyed')
    const reply = replyOf(await bus.fanOut())
    expect(reply.translationJobIds).toBeUndefined()
    expect(bus.jobs()).toEqual([])
    for (const s of states(bus, 'de')) {
      expect(s).toMatchObject({ status: 'missing', source: null, copy: masterCopy(bus, s.key) })
    }
  })

  it('leaves the master text missing when the job fails', async () => {
    const bus = await setUp()
    setFakeBehaviour({ fail: 'other' })
    const ids = replyOf(await bus.fanOut()).translationJobIds ?? []
    expect(ids).toHaveLength(2)
    await finished(bus, ids)
    for (const id of ids) expect(bus.job(id).status).toBe('failed')
    for (const s of states(bus, 'fr')) {
      expect(s).toMatchObject({ status: 'missing', source: null, copy: masterCopy(bus, s.key) })
    }
  })

  it('refuses an agent fan-out, so an agent starts no translation', async () => {
    const bus = await setUp()
    const r = (await bus.fanOut('agent')) as { ok: boolean }
    expect(r.ok).toBe(false)
    expect(bus.jobs()).toEqual([])
    expect(bus.inLanguage('de')).toEqual([])
  })
})
