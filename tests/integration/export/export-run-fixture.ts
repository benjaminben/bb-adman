// Test helper for the P8-5 export.run tests: an open project with one campaign and two ads, a
// good output folder, a good input, and readers for what must not hold the path. Not a test.
import fs from 'node:fs'
import path from 'node:path'
import { expect, vi } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from '../checks/check-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { readWireRows } from '@/main/db/rows'
import type { ReportCheck } from '@/shared/schemas/report'
export const FOLDER = 'Exports-Qx7Lm'
export const NOW = new Date('2026-11-20T10:30:00.000Z')

let f: Fixture | undefined
// For afterEach: closes the project and removes its folders.
export function cleanupExportRun(): void {
  f?.cleanup()
  f = undefined
  vi.restoreAllMocks()
}

export type Setup = { fx: Fixture; p: CheckProject; folder: string; input: Record<string, unknown> }

export async function setup(): Promise<Setup> {
  const fx = makeFixture()
  f = fx
  const p = await openCheckProject(fx)
  const folder = path.join(fx.documents, FOLDER)
  fs.mkdirSync(folder)
  vi.spyOn(fx.core.deps, 'now').mockReturnValue(NOW)
  const input = {
    projectId: p.projectId,
    campaignId: p.campaignId,
    variantIds: p.variantIds(),
    outputDir: folder,
    imageFormat: 'jpg',
    jpgQuality: 85,
    fps: 30,
    proceedDespiteWarnings: false,
  }
  return { fx, p, folder, input }
}

export const exportRows = (p: CheckProject) =>
  readWireRows(p.db(), 'job').filter((j) => (j as { kind: string }).kind === 'export')

// A second campaign over the same subjects; gives its ID.
export async function secondCampaign(fx: Fixture, p: CheckProject): Promise<string> {
  const subjectMap = createInput().subjectMap.map((s) => ({ ...s, create: false }))
  const made = await fx.user('campaign.create', {
    projectId: p.projectId,
    ...createInput(),
    subjectMap,
  })
  return data<{ campaignId: string }>(made).campaignId
}

// Nothing the path names shows in the project file, an event, a log line or the reply.
export function expectNoPath(fx: Fixture, p: CheckProject, reply: unknown): void {
  const file = fs.readFileSync(fx.core.deps.projects.requireOpen(p.projectId).filePath)
  expect(file.includes(FOLDER)).toBe(false)
  expect(JSON.stringify(fx.events)).not.toContain(FOLDER)
  expect(fx.readLogs()).not.toContain(FOLDER)
  expect(JSON.stringify(reply)).not.toContain(FOLDER)
}

// A test ExportChecks.run: the first variant warns with two findings, the rest pass.
export function warnOnFirst(fx: Fixture, variantIds: string[]) {
  const first: ReportCheck[] = [
    {
      checkId: 'prohibited-words',
      group: 'brand-legal',
      status: 'warn',
      findings: [{ layerId: 'L1', message: 'Uses a word the brief forbids.' }, { message: 'Two.' }],
    },
    { checkId: 'text-colours', group: 'readiness', status: 'pass', findings: [] },
  ]
  const results = new Map(variantIds.map((id, i) => [id, i === 0 ? first : []]))
  return vi.spyOn(fx.core.deps.export.checks, 'run').mockResolvedValue(results)
}
