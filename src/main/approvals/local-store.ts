// The approvals side tables (spec/approvals.md "Local tables", security class): the only code
// that reads or writes approval_link, approval_variant and approval_signoff. They are not wire
// rows, so no project.changed carries them. The project file is not trusted: every row read is
// checked with the contract's rules (slug, IDs, email, numbers, times), and a row that fails is
// skipped and logged with the table and the campaign ID only, never its values.
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { Email, SignoffId, Slug, Time, VariantKey, Version } from '@/shared/approvals/contract'
import type { ActivityLog } from '@/main/log/activity-log'

const LinkRecord = z.object({
  slug: Slug,
  state: z.enum(['live', 'ended']),
  createdAt: Time,
  publishedAt: Time.nullable(),
  checkedAt: Time.nullable(),
  endedAt: Time.nullable(),
})
export type LinkRecord = z.infer<typeof LinkRecord>

const VariantRecord = z.object({ variantId: VariantKey, publishedRev: Version, expiresAt: Time })
export type VariantRecord = z.infer<typeof VariantRecord>

const SignoffRecord = z.object({
  id: SignoffId,
  variantId: VariantKey,
  version: Version,
  email: Email,
  signedAt: Time,
})
export type SignoffRecord = z.infer<typeof SignoffRecord>

type Table = 'approval_link' | 'approval_variant' | 'approval_signoff'

function skipped(log: ActivityLog, table: Table, campaignId: string): void {
  log.write({
    level: 'warn',
    event: 'query',
    name: 'approvals.rows',
    actor: 'system',
    ok: false,
    campaignId,
    message: 'A stored approvals row could not be read and was left out.',
    context: { table },
  })
}

function checkedRows<T>(
  schema: z.ZodType<T>,
  rows: unknown[],
  log: ActivityLog,
  table: Table,
  campaignId: string,
): T[] {
  const good: T[] = []
  for (const row of rows) {
    const parsed = schema.safeParse(row)
    if (parsed.success) good.push(parsed.data)
    else skipped(log, table, campaignId)
  }
  return good
}

// The campaign's link, or null when it has none or its row fails the checks.
export function readLink(
  db: Database.Database,
  campaignId: string,
  log: ActivityLog,
): LinkRecord | null {
  const row = db
    .prepare(
      `SELECT slug, state, created_at AS createdAt, published_at AS publishedAt,
        checked_at AS checkedAt, ended_at AS endedAt
       FROM approval_link WHERE campaign_id = ?`,
    )
    .get(campaignId)
  if (row === undefined) return null
  return checkedRows(LinkRecord, [row], log, 'approval_link', campaignId)[0] ?? null
}

export function linkIsLive(db: Database.Database, campaignId: string, log: ActivityLog): boolean {
  return readLink(db, campaignId, log)?.state === 'live'
}

// What the gallery shows now, by variant ID.
export function readVariants(
  db: Database.Database,
  campaignId: string,
  log: ActivityLog,
): VariantRecord[] {
  const rows = db
    .prepare(
      `SELECT variant_id AS variantId, published_rev AS publishedRev, expires_at AS expiresAt
       FROM approval_variant WHERE campaign_id = ? ORDER BY variant_id`,
    )
    .all(campaignId)
  return checkedRows(VariantRecord, rows, log, 'approval_variant', campaignId)
}

// The last sign-offs read from the service, oldest first.
export function readSignoffs(
  db: Database.Database,
  campaignId: string,
  log: ActivityLog,
): SignoffRecord[] {
  const rows = db
    .prepare(
      `SELECT id, variant_id AS variantId, version, email, signed_at AS signedAt
       FROM approval_signoff WHERE campaign_id = ? ORDER BY signed_at, id`,
    )
    .all(campaignId)
  return checkedRows(SignoffRecord, rows, log, 'approval_signoff', campaignId)
}

function clearGallery(db: Database.Database, campaignId: string): void {
  db.prepare('DELETE FROM approval_variant WHERE campaign_id = ?').run(campaignId)
}

function replaceSignoffs(db: Database.Database, campaignId: string, list: SignoffRecord[]) {
  db.prepare('DELETE FROM approval_signoff WHERE campaign_id = ?').run(campaignId)
  const insert = db.prepare(
    `INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const s of list) {
    const row = SignoffRecord.parse(s)
    insert.run(row.id, campaignId, row.variantId, row.version, row.email, row.signedAt)
  }
}

// approvals.createLink step 3: a live link with this slug, in place of any earlier row; the
// earlier link's gallery rows and kept sign-offs go with it (A-94). Call inside the command's
// transaction.
export function startLocalLink(
  db: Database.Database,
  campaignId: string,
  slug: string,
  now: string,
): void {
  const checked = Slug.parse(slug)
  clearGallery(db, campaignId)
  replaceSignoffs(db, campaignId, [])
  db.prepare(
    `INSERT INTO approval_link (campaign_id, slug, state, created_at, published_at, checked_at,
       ended_at)
     VALUES (?, ?, 'live', ?, NULL, NULL, NULL)
     ON CONFLICT (campaign_id) DO UPDATE SET slug = excluded.slug, state = 'live',
       created_at = excluded.created_at, published_at = NULL, checked_at = NULL, ended_at = NULL`,
  ).run(campaignId, checked, now)
}

// approvals.endLink step 4 (and a gone link): state ended, the gallery rows deleted, the
// sign-offs replaced with the last read, or kept as they are when there is none.
export function endLocalLink(
  db: Database.Database,
  campaignId: string,
  now: string,
  lastRead: SignoffRecord[] | null,
): void {
  db.prepare("UPDATE approval_link SET state = 'ended', ended_at = ? WHERE campaign_id = ?").run(
    now,
    campaignId,
  )
  clearGallery(db, campaignId)
  if (lastRead !== null) replaceSignoffs(db, campaignId, lastRead)
}
