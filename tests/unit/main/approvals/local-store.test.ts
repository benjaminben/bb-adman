// The approvals side tables (spec/approvals.md "Local tables"): local-store.ts is their one
// reader and writer, and every row it reads is checked; a failing row is skipped and logged
// with the table and campaign ID only.
import type Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  endLocalLink,
  linkIsLive,
  publishLocalGallery,
  readLink,
  refreshLocalLink,
  readSignoffs,
  readVariants,
  startLocalLink,
  type SignoffRecord,
} from '@/main/approvals/local-store'
import { makeFixture, data, type Fixture } from '../../../integration/core-fixture'
import { campaignIn } from '../../../integration/approvals/link-fixture'

const SLUG = 'Ab3dEf6hJk9m'
const NEW_SLUG = 'Zz9yXx8wVv7u'
const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-02T10:00:00.000Z'
const EMAIL = 'pat@client.example.com'

let f: Fixture
let db: Database.Database
let c1 = ''
let c2 = ''
let v1 = ''

beforeEach(async () => {
  f = makeFixture()
  const projectId = data<{ projectId: string }>(
    await f.user('project.create', { name: 'Local', location: f.projectsDir }),
  ).projectId
  c1 = await campaignIn(f, projectId, 'Spring', true)
  c2 = await campaignIn(f, projectId, 'Autumn', false)
  db = f.core.projects.requireOpen(projectId).db
  v1 = (db.prepare('SELECT id FROM variant LIMIT 1').get() as { id: string }).id
})
afterEach(() => f.cleanup())

const log = () => f.core.deps.log

function signoff(over: Partial<SignoffRecord> = {}): SignoffRecord {
  return {
    id: 'A'.repeat(24),
    variantId: v1,
    version: 3,
    email: EMAIL,
    signedAt: T0,
    ...over,
  }
}

function plantVariant(campaignId: string, variantId = v1) {
  db.prepare(
    'INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at) VALUES (?, ?, 2, ?)',
  ).run(campaignId, variantId, T1)
}

function plantSignoff(campaignId: string, s: SignoffRecord) {
  db.prepare(
    `INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(s.id, campaignId, s.variantId, s.version, s.email, s.signedAt)
}

const count = (table: string, campaignId: string) =>
  (
    db.prepare(`SELECT count(*) AS n FROM ${table} WHERE campaign_id = ?`).get(campaignId) as {
      n: number
    }
  ).n

describe('the approvals local store [spec/approvals.md "Local tables"]', () => {
  it('has no link for a campaign that never made one', () => {
    expect(readLink(db, c1, log())).toBeNull()
    expect(linkIsLive(db, c1, log())).toBe(false)
    expect(readVariants(db, c1, log())).toEqual([])
    expect(readSignoffs(db, c1, log())).toEqual([])
  })

  it('starts a live link with its slug and time', () => {
    startLocalLink(db, c1, SLUG, T0)
    expect(readLink(db, c1, log())).toEqual({
      slug: SLUG,
      state: 'live',
      createdAt: T0,
      publishedAt: null,
      checkedAt: null,
      endedAt: null,
    })
    expect(linkIsLive(db, c1, log())).toBe(true)
    expect(linkIsLive(db, c2, log())).toBe(false)
  })

  it('ends a link: state, time, gallery rows gone, sign-offs replaced with the last read', () => {
    startLocalLink(db, c1, SLUG, T0)
    plantVariant(c1)
    plantSignoff(c1, signoff())
    const last = [signoff({ id: 'B'.repeat(24), version: 4 })]
    endLocalLink(db, c1, T1, last)
    expect(readLink(db, c1, log())).toMatchObject({ state: 'ended', endedAt: T1, slug: SLUG })
    expect(linkIsLive(db, c1, log())).toBe(false)
    expect(readVariants(db, c1, log())).toEqual([])
    expect(readSignoffs(db, c1, log())).toEqual(last)
  })

  it('ends a link with no last read and keeps the sign-offs it has', () => {
    startLocalLink(db, c1, SLUG, T0)
    plantSignoff(c1, signoff())
    endLocalLink(db, c1, T1, null)
    expect(readSignoffs(db, c1, log())).toEqual([signoff()])
  })

  it('replaces an ended link and clears its gallery rows and sign-offs, and no other campaign', () => {
    startLocalLink(db, c1, SLUG, T0)
    startLocalLink(db, c2, SLUG, T0)
    for (const c of [c1, c2]) {
      plantVariant(c)
      plantSignoff(c, signoff({ id: (c === c1 ? 'C' : 'D').repeat(24) }))
    }
    endLocalLink(db, c1, T1, null)
    startLocalLink(db, c1, NEW_SLUG, T1)
    expect(readLink(db, c1, log())).toEqual({
      slug: NEW_SLUG,
      state: 'live',
      createdAt: T1,
      publishedAt: null,
      checkedAt: null,
      endedAt: null,
    })
    expect([count('approval_variant', c1), count('approval_signoff', c1)]).toEqual([0, 0])
    expect([count('approval_variant', c2), count('approval_signoff', c2)]).toEqual([1, 1])
  })

  it('reads the gallery rows of the campaign', () => {
    startLocalLink(db, c1, SLUG, T0)
    plantVariant(c1)
    expect(readVariants(db, c1, log())).toEqual([
      {
        variantId: v1,
        publishedRev: 2,
        expiresAt: T1,
        clipMs: null,
        clipBytes: null,
        clipMissing: null,
      },
    ])
  })

  it.each([
    ['a slug that is not 12 letters', "javascript:alert('x')"],
    ['a slug with a path in it', '../../evil/x'],
  ])('skips a link row with %s and logs it without its value', (_n, slug) => {
    startLocalLink(db, c1, SLUG, T0)
    db.prepare('UPDATE approval_link SET slug = ? WHERE campaign_id = ?').run(slug, c1)
    expect(readLink(db, c1, log())).toBeNull()
    expect(linkIsLive(db, c1, log())).toBe(false)
    const logs = f.readLogs()
    expect(logs).toContain('approval_link')
    expect(logs).toContain(c1)
    expect(logs).not.toContain(slug)
  })

  it.each([
    ['an email with a script in it', { email: '<script>x</script>@a.example.com' }],
    ['a non-ASCII email', { email: 'pаt@client.example.com' }],
    ['a bad sign-off ID', { id: 'short' }],
    ['a bad time', { signedAt: 'yesterday' }],
    ['a broken version', { version: -1 }],
  ])('skips a sign-off row with %s and logs it without its value', (_n, over) => {
    startLocalLink(db, c1, SLUG, T0)
    const good = signoff({ id: 'E'.repeat(24) })
    const bad = signoff({ id: 'F'.repeat(24), ...over })
    plantSignoff(c1, good)
    plantSignoff(c1, bad)
    expect(readSignoffs(db, c1, log())).toEqual([good])
    const logs = f.readLogs()
    expect(logs).toContain('approval_signoff')
    for (const value of Object.values(over)) {
      if (typeof value === 'string') expect(logs).not.toContain(value)
    }
  })

  it('skips a gallery row with a broken expiry', () => {
    startLocalLink(db, c1, SLUG, T0)
    db.prepare(
      "INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at) VALUES (?, ?, 1, 'soon')",
    ).run(c1, v1)
    expect(readVariants(db, c1, log())).toEqual([])
    expect(f.readLogs()).toContain('approval_variant')
  })

  it('replaces the gallery rows with what was published and sets published_at', () => {
    startLocalLink(db, c1, SLUG, T0)
    startLocalLink(db, c2, SLUG, T0)
    plantVariant(c1)
    plantVariant(c2)
    const rows = [
      {
        variantId: v1,
        publishedRev: 5,
        expiresAt: T1,
        clipMs: null,
        clipBytes: null,
        clipMissing: null,
      },
    ]
    publishLocalGallery(db, c1, rows, T1)
    expect(readVariants(db, c1, log())).toEqual(rows)
    expect(readLink(db, c1, log())).toMatchObject({ publishedAt: T1, state: 'live' })
    expect(readVariants(db, c2, log())).toEqual([
      {
        variantId: v1,
        publishedRev: 2,
        expiresAt: T1,
        clipMs: null,
        clipBytes: null,
        clipMissing: null,
      },
    ])
    expect(readLink(db, c2, log())?.publishedAt).toBeNull()
  })

  it.each([
    ['nothing new', [signoff()], [], false],
    ['a new sign-off', [signoff(), signoff({ id: 'G'.repeat(24) })], [], true],
    ['a sign-off taken back', [], [], true],
    ['a renewed expiry', [signoff()], [{ variantId: v1, version: 2, expiresAt: T0 }], true],
    [
      'a renewal for another version',
      [signoff()],
      [{ variantId: v1, version: 9, expiresAt: T0 }],
      false,
    ],
  ] as Array<
    [
      string,
      SignoffRecord[],
      Array<{ variantId: string; version: number; expiresAt: string }>,
      boolean,
    ]
  >)(
    'refreshes with %s: sign-offs replaced, checked_at set, and says whether it changed',
    (_n, table, renewed, changed) => {
      startLocalLink(db, c1, SLUG, T0)
      plantVariant(c1)
      plantSignoff(c1, signoff())
      // v1 is read when the table runs, after beforeEach.
      const list = table.map((s) => ({ ...s, variantId: v1 }))
      const fixed = renewed.map((r) => ({ ...r, variantId: v1 }))
      expect(refreshLocalLink(db, c1, list, fixed, T1)).toBe(changed)
      expect(readSignoffs(db, c1, log())).toEqual(list)
      expect(readLink(db, c1, log())).toMatchObject({ checkedAt: T1 })
      const expiry = fixed.some((r) => r.version === 2) ? T0 : T1
      expect(readVariants(db, c1, log())).toEqual([
        {
          variantId: v1,
          publishedRev: 2,
          expiresAt: expiry,
          clipMs: null,
          clipBytes: null,
          clipMissing: null,
        },
      ])
    },
  )
})
