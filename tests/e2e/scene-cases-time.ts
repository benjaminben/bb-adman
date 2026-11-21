// P7-7, phase-07.md "Presets" [A-187]: the time cases of the scene reference pictures. Imported
// by scene-reference.spec.ts, so they run in that file; this file adds its own app. Each case is
// a 400 by 400 video variant of 4 s, drawn with variant.render at its timeMs and compared with
// its stored picture (ADMAN_UPDATE_REFERENCES=1 writes them). No command can make a variant a
// video yet (variant.setFormat is P7-10), so the closed project file is changed directly.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, query, renderPng } from './render-helpers'
import { checkReference, decodePng, type Bitmap } from './reference-compare'

const SIDE = 400
const DURATION_MS = 4000
const BLUE = '#2850DC'
const PRESETS = ['fade', 'fade-up', 'slide', 'stagger-words'] as const
type Block = { preset: string; startMs: number; durationMs: number }
const NONE: Block = { preset: 'none', startMs: 0, durationMs: 0 }

type TextSpec = { copy: string; y: number; startMs?: number; entrance?: Block; exit?: Block }
type TimeCase = { name: string; timeMs: number; texts: TextSpec[]; blank?: boolean }

const HEADLINE = 'Big summer sale today'

const entranceCases: TimeCase[] = PRESETS.flatMap((preset) =>
  [0, 25, 50, 75, 100].map((percent) => ({
    name: `preset-${preset}-${percent}`,
    timeMs: 1000 + percent * 10,
    texts: [{ copy: HEADLINE, y: 140, entrance: { preset, startMs: 1000, durationMs: 1000 } }],
    blank: percent === 0,
  })),
)

const exitCases: TimeCase[] = PRESETS.map((preset) => ({
  name: `exit-${preset}-50`,
  timeMs: 2500,
  texts: [{ copy: HEADLINE, y: 140, exit: { preset, startMs: 2000, durationMs: 1000 } }],
}))

export const TIME_CASES: TimeCase[] = [
  ...entranceCases,
  ...exitCases,
  {
    // "Later" starts at 2 s, so at 1 s only "Now" is drawn.
    name: 'timing-before-start',
    timeMs: 1000,
    texts: [
      { copy: 'Now', y: 60 },
      { copy: 'Later', y: 240, startMs: 2000 },
    ],
  },
]

const TEXT_STYLE = {
  fontAssetId: null,
  fontSize: 44,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
}

let box: Sandbox
let app: ElectronApplication
let page: Page
let projectId: string
const variantIds = new Map<string, string>()

async function setUp(c: TimeCase): Promise<string> {
  const { variantId } = await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: c.name,
      region: 'US',
      audience: 'All',
      message: 'Hello',
      subjects: [{ name: c.name }],
    },
    subjectMap: [{ subjectId: c.name, create: true }],
    languages: ['en'],
    sizes: [{ label: `${SIDE}x${SIDE}`, width: SIDE, height: SIDE }],
    templateId: 'starter',
  })
  const { layers } = await query(page, 'variant.get', { projectId, variantId })
  for (const layer of layers as { id: string; type: string }[]) {
    if (layer.type === 'background') {
      const patch = { style: { shade: null, fillColor: BLUE } }
      await command(page, 'layer.update', { projectId, layerId: layer.id, patch })
    } else {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
    }
  }
  for (const t of c.texts) {
    const geometry = { x: 20, y: t.y, width: 360, height: 120, rotation: 0, crop: null }
    const values = { copy: t.copy, geometry, style: TEXT_STYLE }
    const { layerId } = await command(page, 'layer.create', {
      projectId,
      variantId: variantId as string,
      type: 'text',
      values,
    })
    const patch = {
      timing: { startMs: t.startMs ?? 0, endMs: null },
      animation: { entrance: t.entrance ?? NONE, exit: t.exit ?? NONE },
    }
    await command(page, 'layer.update', { projectId, layerId, patch })
  }
  return variantId as string
}

// The closed file's variants become 4 s videos; then the project is opened again.
async function makeVideos(filePath: string): Promise<void> {
  await command(page, 'project.close', { projectId })
  const db = new Database(filePath)
  try {
    db.prepare("UPDATE variant SET format = 'video', duration_ms = ?").run(DURATION_MS)
  } finally {
    db.close()
  }
  projectId = (await command(page, 'project.open', { filePath })).projectId as string
}

// Pixels that differ from the top-left corner, which only the background reaches.
function notBackground(b: Bitmap): number {
  let count = 0
  for (let i = 0; i < b.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      if (Math.abs(b.pixels[i + c]! - b.pixels[c]!) > 8) {
        count++
        break
      }
    }
  }
  return count
}

test.describe('Phase 7 time cases, one app for all', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000)
    box = makeSandbox()
    app = await launch(box)
    page = await app.firstWindow()
    const created = await command(page, 'project.create', {
      name: 'Reference time',
      location: box.projects,
    })
    projectId = created.projectId as string
    for (const c of TIME_CASES) variantIds.set(c.name, await setUp(c))
    await makeVideos(created.filePath as string)
  })

  test.afterAll(async () => {
    await app?.close()
    fs.rmSync(box.root, { recursive: true, force: true })
  })

  for (const c of TIME_CASES) {
    test(`${c.name}: drawn at ${c.timeMs} ms`, async () => {
      const variantId = variantIds.get(c.name)
      const input = { projectId, variantId, maxDimension: SIDE, timeMs: c.timeMs }
      const png = await renderPng(page, input)
      const drawn = await decodePng(app, png)
      expect([drawn.width, drawn.height]).toEqual([SIDE, SIDE])
      if (c.blank) expect(notBackground(drawn), 'pixels drawn at the start of an entrance').toBe(0)
      else expect(notBackground(drawn), 'pixels of text').toBeGreaterThan(0)
      await checkReference(app, c.name, png)
    })
  }
})
