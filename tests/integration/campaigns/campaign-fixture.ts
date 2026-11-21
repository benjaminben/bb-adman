// Test helper for slice C campaign commands: a bus over one project with the campaign and
// subject handlers, a valid campaign.create input, and readers for the rows it writes.
// Not a test file itself.
import { makeAssetBus } from '../assets/asset-bus'
import { campaignCommands } from '@/main/commands/campaign'
import { subjectCommands } from '@/main/commands/subject'
import { ruleSetCommands } from '@/main/commands/rule-set'
import { readWireRows } from '@/main/db/rows'
import type { TableName } from '@/shared/schemas/rows/keys'
import { testDeps } from './campaign-deps'

export type CampaignBus = ReturnType<typeof makeCampaignBus>

export function makeCampaignBus() {
  const deps = testDeps()
  const bus = makeAssetBus([
    ...campaignCommands(deps),
    ...subjectCommands(deps),
    ...ruleSetCommands(deps),
  ])
  return {
    ...bus,
    rows: (table: TableName) => readWireRows(bus.db, table),
    create: (over: Record<string, unknown> = {}) =>
      bus.user('campaign.create', { ...createInput(), ...over }),
  }
}

export const SQUARE = { label: '1x1', width: 1080, height: 1080 }
export const TALL = { label: '9x16', width: 1080, height: 1920 }

export function createInput() {
  return {
    brief: {
      campaignName: 'Summer Splash!',
      region: 'US',
      audience: 'Families',
      message: '  Cool down this summer  ',
      subjects: [{ name: 'Can', description: 'A red can' }, { name: 'Bottle' }],
      requiredWords: ['fresh'],
      prohibitedWords: { en: ['cheap'], de: ['billig'] },
    },
    subjectMap: [
      { subjectId: 'can', create: true },
      { subjectId: 'bottle', create: true },
    ],
    languages: ['en', 'de'],
    sizes: [SQUARE, TALL],
    templateId: 'starter',
  }
}

export function insertImage(
  bus: CampaignBus,
  row: { id: string; subjectId?: string; library?: string; kind?: string; createdAt?: string },
): void {
  bus.db
    .prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
        rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
       VALUES (?, ?, ?, 'imported', 'linked', ?, 'x.png', '/x.png', 'x.png', 'image/png', 1, 1,
        'h', ?)`,
    )
    .run(
      row.id,
      row.library ?? 'asset',
      row.kind ?? 'image',
      row.subjectId ?? null,
      row.createdAt ?? '2026-01-01T00:00:00.000Z',
    )
}
