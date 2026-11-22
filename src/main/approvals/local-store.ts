// The approvals side tables (spec/approvals.md "Local tables", security class): the only code
// that reads or writes approval_link, approval_variant and approval_signoff. They are not wire
// rows, so no project.changed carries them. The project file is not trusted: every row read is
// checked with the contract's rules (slug, IDs, email, numbers, times), and a row that fails is
// skipped and logged with the table and the campaign ID only, never its values.
import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CLIP_MAX_BYTES,
  CLIP_MAX_MS,
  Email,
  SignoffId,
  Slug,
  Time,
  VariantKey,
  Version,
} from '@/shared/approvals/contract'
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

// The clip numbers are both in the contract's ranges or both null; a reason only without them.
const VariantRecord = z
  .object({
    variantId: VariantKey,
    publishedRev: Version,
    expiresAt: Time,
    clipMs: z.number().int().min(1).max(CLIP_MAX_MS).nullable(),
    clipBytes: z.number().int().min(1).max(CLIP_MAX_BYTES).nullable(),
    clipMissing: z.enum(['no_tool', 'too_long', 'too_large']).nullable(),
  })
  .refine((r) => (r.clipMs === null) === (r.clipBytes === null))
  .refine((r) => r.clipMissing === null || r.clipMs === null)
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
      `SELECT variant_id AS variantId, published_rev AS publishedRev, expires_at AS expiresAt,
        clip_ms AS clipMs, clip_bytes AS clipBytes, clip_missing AS clipMissing
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

// approvals.publish step 7: the gallery rows replaced with what was just published, and
// published_at set. Call inside the command's transaction.
export function publishLocalGallery(
  db: Database.Database,
  campaignId: string,
  rows: VariantRecord[],
  now: string,
): void {
  clearGallery(db, campaignId)
  const insert = db.prepare(
    `INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at, clip_ms,
       clip_bytes, clip_missing)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const r of rows) {
    const row = VariantRecord.parse(r)
    const clip = [row.clipMs, row.clipBytes, row.clipMissing]
    insert.run(campaignId, row.variantId, row.publishedRev, row.expiresAt, ...clip)
  }
  db.prepare('UPDATE approval_link SET published_at = ? WHERE campaign_id = ?').run(now, campaignId)
}

export type Renewed = { variantId: string; version: number; expiresAt: string }

// The stored sign-offs as they are, for comparison only; nothing read here is shown or sent.
function storedSignoffs(db: Database.Database, campaignId: string): unknown[] {
  return db
    .prepare(
      `SELECT id, variant_id AS variantId, version, email, signed_at AS signedAt
       FROM approval_signoff WHERE campaign_id = ? ORDER BY id`,
    )
    .all(campaignId)
}

const byIdText = (list: unknown[]) =>
  JSON.stringify(list.map((s) => SignoffRecord.safeParse(s).data ?? null))

// approvals.refresh step 4: the sign-offs replaced with the service's list (each checked again),
// the expiry of each renewed row of that version updated, checked_at set. True when the
// sign-off list or an expiry changed. Call inside the command's transaction.
export function refreshLocalLink(
  db: Database.Database,
  campaignId: string,
  signoffs: SignoffRecord[],
  renewed: Renewed[],
  now: string,
): boolean {
  const checked = signoffs.map((s) => SignoffRecord.parse(s))
  const sorted = [...checked].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let changed = byIdText(storedSignoffs(db, campaignId)) !== byIdText(sorted)
  replaceSignoffs(db, campaignId, checked)
  const update = db.prepare(
    `UPDATE approval_variant SET expires_at = ?
     WHERE campaign_id = ? AND variant_id = ? AND published_rev = ? AND expires_at != ?`,
  )
  for (const r of renewed) {
    const expiresAt = Time.parse(r.expiresAt)
    const done = update.run(expiresAt, campaignId, r.variantId, Version.parse(r.version), expiresAt)
    if (done.changes > 0) changed = true
  }
  db.prepare('UPDATE approval_link SET checked_at = ? WHERE campaign_id = ?').run(now, campaignId)
  return changed
}
