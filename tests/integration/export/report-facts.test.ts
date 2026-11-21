// P8-7: reportFacts reads what the report needs from a seeded campaign, and nothing the report
// must not hold (A-196): no ComfyUI address, no asset path.
import { afterEach, describe, expect, it } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from '../checks/check-fixture'
import { reportFacts } from '@/main/export/report/facts'
import { buildReport } from '@/main/export/report/build'

const COMFY = 'http://192.168.7.21:8188'
const PICTURES = '/Users/someone/Pictures/private-shoot'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function setup(): Promise<{ fx: Fixture; p: CheckProject }> {
  const fx = makeFixture()
  f = fx
  return { fx, p: await openCheckProject(fx) }
}

function insertAsset(p: CheckProject, id: string, generated: boolean): void {
  p.db()
    .prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
        mime, byte_size, mtime_ms, content_hash, gen_provider, gen_model, gen_prompt, created_at)
       VALUES (?, 'asset', 'image', ?, 'managed', ?, ?, ?, 'image/png', 10, 1, 'h', ?, ?, ?, 'x')`,
    )
    .run(
      id,
      generated ? 'generated' : 'imported',
      `${id}.png`,
      `${PICTURES}/${id}.png`,
      `assets/${id}.png`,
      generated ? 'comfyui' : null,
      generated ? 'sdxl-base' : null,
      generated ? 'A red can on a beach at noon' : null,
    )
}

function useAsBackground(p: CheckProject, variantId: string, assetId: string): void {
  p.db()
    .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
    .run(JSON.stringify({ assetId }), variantId)
}

function insertReport(p: CheckProject, id: string, createdAt: string, exportNumber: number): void {
  const fx = f as Fixture
  const facts = reportFacts(
    fx.core.deps,
    fx.core.deps.projects.requireOpen(p.projectId),
    p.campaignId,
  )
  const outcomes = facts.variants.map((v) => ({
    variantId: v.id,
    rev: v.rev,
    file: null,
    failure: 'The ad could not be drawn.',
    picture: null,
  }))
  const body = {
    ...buildReport(facts, outcomes, {
      createdAt,
      root: '/Exports/Earlier',
      checksRun: false,
      checks: new Map(),
      warningsSeen: [],
      proceeded: null,
    }),
    exportNumber,
  }
  p.db()
    .prepare(
      "INSERT INTO report (id, campaign_id, created_at, output_dir, body) VALUES (?, ?, ?, '/Exports/Earlier', ?)",
    )
    .run(id, p.campaignId, createdAt, JSON.stringify(body))
}

describe('reportFacts [P8-7]', () => {
  it('numbers the export after two earlier rows and takes the newest as the previous one', async () => {
    const { fx, p } = await setup()
    insertReport(p, '01JA00000000000000000000B', '2026-11-20T09:00:00.000Z', 2)
    insertReport(p, '01JA00000000000000000000A', '2026-11-19T09:00:00.000Z', 1)
    const facts = reportFacts(
      fx.core.deps,
      fx.core.deps.projects.requireOpen(p.projectId),
      p.campaignId,
    )
    expect(facts.reportCount).toBe(2)
    expect(facts.previous?.exportNumber).toBe(2)
    expect(facts.previous?.createdAt).toBe('2026-11-20T09:00:00.000Z')
    const report = buildReport(facts, [], {
      createdAt: '2026-11-21T09:00:00.000Z',
      root: '/Exports/Now',
      checksRun: false,
      checks: new Map(),
      warningsSeen: [],
      proceeded: null,
    })
    expect(report.exportNumber).toBe(3)
  })

  it('gives a generated asset its provider, model and prompt, and an imported one none', async () => {
    const { fx, p } = await setup()
    const [first = '', second = ''] = p.variantIds()
    insertAsset(p, 'gen1', true)
    insertAsset(p, 'imp1', false)
    useAsBackground(p, first, 'gen1')
    useAsBackground(p, second, 'imp1')
    const facts = reportFacts(
      fx.core.deps,
      fx.core.deps.projects.requireOpen(p.projectId),
      p.campaignId,
    )
    const assetsOf = (id: string) => facts.variants.find((v) => v.id === id)?.assets
    expect(assetsOf(first)).toEqual([
      {
        assetId: 'gen1',
        displayName: 'gen1.png',
        role: 'background',
        origin: 'generated',
        provider: 'comfyui',
        model: 'sdxl-base',
        prompt: 'A red can on a beach at noon',
      },
    ])
    expect(assetsOf(second)).toEqual([
      { assetId: 'imp1', displayName: 'imp1.png', role: 'background', origin: 'imported' },
    ])
  })

  it('reads the campaign, its ads, their text layers and the exporter name', async () => {
    const { fx, p } = await setup()
    fx.core.deps.settings.update({ reports: { exporterName: 'Sam Example' } })
    const facts = reportFacts(
      fx.core.deps,
      fx.core.deps.projects.requireOpen(p.projectId),
      p.campaignId,
    )
    expect(facts.campaign).toMatchObject({ id: p.campaignId, name: 'Summer Splash!', region: 'US' })
    expect(facts.variants.map((v) => v.id).sort()).toEqual(p.variantIds())
    expect(facts.variants.every((v) => v.textLayers.length > 0)).toBe(true)
    expect(facts.subjects.length).toBeGreaterThan(0)
    expect(facts.exporterName).toBe('Sam Example')
    expect(facts.appVersion).toBe('0.1.0')
    expect(facts.paidCount).toEqual({ pictures: 0, videos: 0, text: 0 })
  })

  it('holds no ComfyUI address and no asset path [A-196]', async () => {
    const { fx, p } = await setup()
    fx.core.deps.settings.setComfyAddress(COMFY)
    insertAsset(p, 'gen1', true)
    useAsBackground(p, p.variantIds()[0] ?? '', 'gen1')
    const project = fx.core.deps.projects.requireOpen(p.projectId)
    const json = JSON.stringify(reportFacts(fx.core.deps, project, p.campaignId))
    expect(json).toContain('gen1')
    expect(json).not.toContain('192.168.7.21')
    expect(json).not.toContain(PICTURES)
    expect(json).not.toContain('assets/gen1.png')
    expect(json).not.toContain(project.filePath)
  })
})
