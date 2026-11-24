// MV-9 (spec/phases/make-variants.md; spec/make-variants.md, "Where a box goes in a new size",
// "Text that fits", "Making variants from a variant"): "Make variants" end to end in the built
// app with ADMAN_FAKE_PROVIDERS=1. A campaign from a brief with the photo-bottom-left layout and
// German copy; "Make variants…" to 16:9 and de; the 16:9 logo, headline and button share one
// left edge; the de 1:1 headline is no larger than the master's; "Make variants from this one…"
// on the de 1:1 tile to 9:16 copies the de words and starts no translation run; Undo removes
// it. Layers are read with variant.get through the window's own API. No paid call. Made-up
// names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { appWindow } from './publish-steps'
import { chooseFakeText, DIRECTION, TALL, WIDE } from './localize-steps'
import { query } from './render-helpers'
import { placeOf } from './workflow-5-1-steps'
import * as v from './variants-steps'

const BRIEF = path.resolve('tests/fixtures/briefs/make-variants-brief.yaml')
const CAMPAIGN = 'Shoreline Fizz'
const DE_HEADLINE = 'Mit jedem einzelnen Schluck angenehm abkühlen, den ganzen langen Sommer lang'

type Layer = {
  key: string
  copy: string | null
  geometry: { x: number; y: number; width: number; height: number }
  style: { fontSize?: number }
  translationStatus: string | null
}
type Job = { kind: string; status: string }
type Place = { projectId: string; campaignId: string }

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await appWindow(app)
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// The brief through its form, as the user loads it, then "Create campaign".
async function createFromBrief(): Promise<void> {
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const form = page.getByRole('region', { name: 'New campaign' })
  await screens.expectPhoto(form, 1, screens.E2E_PHOTO)
  await form.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
}

async function layers(place: Place, variantId: string): Promise<Map<string, Layer>> {
  const input = { projectId: place.projectId, variantId }
  const read = (await query(page, 'variant.get', input)) as unknown as { layers: Layer[] }
  return new Map(read.layers.map((l) => [l.key, l]))
}

async function variantId(place: Place, sizeLabel: string, language: string) {
  const { variants } = await v.campaignRead(page, place)
  return variants.find((r) => r.sizeLabel === sizeLabel && r.language === language)?.id
}

async function translationJobs(place: Place): Promise<Job[]> {
  const jobs = (await query(page, 'job.list', { projectId: place.projectId })) as unknown as Job[]
  return jobs.filter((j) => j.kind === 'translation')
}

// The values read, kept in the test's report.
const note = (type: string, description: string) =>
  test.info().annotations.push({ type, description })

// Waits until no translation job is queued or running; gives how many there are.
async function settledTranslations(place: Place): Promise<number> {
  const busy = async () =>
    (await translationJobs(place)).filter((j) => j.status === 'queued' || j.status === 'running')
  await expect.poll(async () => (await busy()).length, { timeout: 60_000 }).toBe(0)
  return (await translationJobs(place)).length
}

test('Make variants: layout edges at a new size, fitted text, variants from a variant, Undo', async () => {
  test.setTimeout(180_000)
  await chooseFakeText(page)
  await screens.createProject(page, 'Seaside')
  await createFromBrief()
  const place = await placeOf(page, CAMPAIGN)

  // "Make variants…" to 16:9 and de: 2 sizes by 2 languages.
  await v.fanOut(page, DIRECTION, { sizes: [WIDE], languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(4)
  const runsBefore = await settledTranslations(place)
  note('translation jobs after the first Make variants', String(runsBefore))

  // At 16:9 the logo, headline and button share the layout's left margin.
  const wide = await layers(place, (await variantId(place, '16x9', 'en'))!)
  const edges = ['logo', 'headline', 'call-to-action'].map((k) => wide.get(k)?.geometry.x)
  note('16:9 left edges (logo, headline, button)', edges.join(', '))
  expect(edges.every((x) => typeof x === 'number')).toBe(true)
  expect(new Set(edges).size).toBe(1)

  // The de 1:1 headline holds the brief's German words, no larger than the master's.
  const master = await layers(place, (await variantId(place, '1x1', 'en'))!)
  const squareDeId = (await variantId(place, '1x1', 'de'))!
  const squareDe = await layers(place, squareDeId)
  const masterSize = master.get('headline')!.style.fontSize!
  const deSize = squareDe.get('headline')!.style.fontSize!
  note('1:1 headline font size (master, de)', `${masterSize}, ${deSize}`)
  expect(squareDe.get('headline')!.copy).toBe(DE_HEADLINE)
  expect(deSize).toBeLessThanOrEqual(masterSize)

  // "Make variants from this one…" on the de 1:1 tile to 9:16.
  await v.makeVariantsFrom(page, v.tile(page, DIRECTION, '1080×1080 · de'), { sizes: [TALL] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(5)
  await expect(v.tile(page, DIRECTION, '1080×1920 · de')).toHaveCount(1)
  const tallDeId = (await variantId(place, '9x16', 'de'))!
  expect(await variantId(place, '9x16', 'en')).toBeUndefined()
  const tallDe = await layers(place, tallDeId)
  for (const key of ['headline', 'call-to-action']) {
    expect(tallDe.get(key)!.copy).toBe(squareDe.get(key)!.copy)
  }
  expect(await settledTranslations(place)).toBe(runsBefore)

  // The campaign's Undo removes it.
  await page
    .getByRole('group', { name: 'Campaign changes' })
    .getByRole('button', { name: 'Undo' })
    .click()
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(4)
  await expect(v.tile(page, DIRECTION, '1080×1920 · de')).toHaveCount(0)
  expect(await variantId(place, '9x16', 'de')).toBeUndefined()
})
