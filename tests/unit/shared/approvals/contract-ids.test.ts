// The contract's ID rules repeat the app's formats (spec/approvals-service.md "The shared
// contract"): IDs made by the app's own generators must all pass them.
import Database from 'better-sqlite3'
import { ulid } from 'ulid'
import { afterAll, describe, expect, it } from 'vitest'
import { newCampaignId, newVariantId } from '@/main/commands/campaign/ids'
import { CampaignId, ProjectId, VariantKey } from '@/shared/approvals/contract'

const db = new Database(':memory:')
db.exec('CREATE TABLE campaign (id TEXT PRIMARY KEY); CREATE TABLE variant (id TEXT PRIMARY KEY)')
afterAll(() => db.close())

const names = ['Spring Sale', '', '!!!', 'É café 2026', 'x'.repeat(80), '  -a-b-  ']

describe('the contract accepts the IDs the app makes [AP-1]', () => {
  it('accepts 200 project IDs from ulid', () => {
    for (let i = 0; i < 200; i++) expect(ProjectId.safeParse(ulid()).success).toBe(true)
  })

  it('accepts 200 campaign IDs from newCampaignId', () => {
    for (let i = 0; i < 200; i++) {
      const id = newCampaignId(db, names[i % names.length] ?? '')
      expect(CampaignId.safeParse(id).success, id).toBe(true)
    }
  })

  it('accepts 200 variant IDs from newVariantId', () => {
    for (let i = 0; i < 200; i++) {
      const id = newVariantId(db)
      expect(VariantKey.safeParse(id).success, id).toBe(true)
    }
  })
})
