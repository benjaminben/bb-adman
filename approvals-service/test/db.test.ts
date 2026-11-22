import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import * as links from '../src/db/links'
import * as variants from '../src/db/variants'
import * as signoffs from '../src/db/signoffs'
import * as sessions from '../src/db/sessions'

const password = { hash: 'aGFzaA==', salt: 'c2FsdA==', iterations: 1000 }

function link(n: number): links.LinkRow {
  return {
    id: `link${n}`.padEnd(24, 'x'),
    slug: `slug${n}`.padEnd(12, 'x'),
    projectId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    campaignId: `campaign-${n}-abc234`,
    campaignName: `Campaign ${n}`,
    password,
    createdAt: 1000 + n,
  }
}

function variant(variantKey: string, position: number, version = 1): variants.VariantRow {
  return {
    variantKey,
    position,
    title: `Title ${variantKey}`,
    sizeLine: '1080 × 1080',
    version,
    pictureUrl: `https://h.example/${variantKey}.png`,
    pictureExpiresAt: 5000,
    kind: 'image',
    clipUrl: null,
    clipMs: null,
    clipBytes: null,
  }
}

async function count(table: string, linkId: string): Promise<number> {
  const column = table === 'link' ? 'id' : 'link_id'
  const sql = `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`
  return (await db.prepare(sql).bind(linkId).first<number>('n')) ?? 0
}

// Two links with a variant, a sign-off and a session each.
async function seed() {
  const [a, b] = [link(1), link(2)]
  for (const l of [a, b]) {
    await links.insertLink(db, l).run()
    await variants.putVariant(db, l.id, variant('abc234', 0)).run()
    const row = { id: `${l.id.slice(0, 20)}sign`, variantKey: 'abc234', version: 1 }
    await signoffs.addSignoff(db, l.id, { ...row, email: 'a@b.co', createdAt: 1 }).run()
    await sessions.addSession(db, { tokenHash: `t-${l.id}`, linkId: l.id, expiresAt: 9000 }).run()
  }
  return { a, b }
}

beforeEach(async () => {
  await db.batch(
    ['session', 'signoff', 'gallery_variant', 'link'].map((t) => db.prepare(`DELETE FROM ${t}`)),
  )
})

describe('db/links', () => {
  it('finds an inserted link by its pair and by its slug', async () => {
    const { a } = await seed()
    expect(await links.findLinkByPair(db, a.projectId, a.campaignId)).toEqual(a)
    expect(await links.findLinkBySlug(db, a.slug)).toEqual(a)
    expect(await links.findLinkBySlug(db, 'missingslug0')).toBeNull()
  })

  it('refuses a second link for the same pair or slug', async () => {
    const { a } = await seed()
    await expect(
      links.insertLink(db, { ...a, id: 'other'.padEnd(24, 'y') }).run(),
    ).rejects.toThrow()
  })

  it('sets the campaign name and a new password, starting the tries again', async () => {
    const { a } = await seed()
    await db.prepare('UPDATE link SET tries = 5, tries_since = 7 WHERE id = ?').bind(a.id).run()
    const next = { hash: 'bmV3', salt: 'bmV3c2FsdA==', iterations: 2000 }
    await links.setLinkPassword(db, a.id, next).run()
    await links.setCampaignName(db, a.id, 'Renamed').run()
    expect(await links.findLinkBySlug(db, a.slug)).toEqual({
      ...a,
      campaignName: 'Renamed',
      password: next,
    })
    const tries = await db.prepare('SELECT tries, tries_since FROM link WHERE id = ?').bind(a.id)
    expect(await tries.first()).toEqual({ tries: 0, tries_since: null })
  })

  it('deletes a link with its sessions, sign-offs and gallery rows, and no other link', async () => {
    const { a, b } = await seed()
    await links.deleteLink(db, a.id)
    for (const table of ['link', 'gallery_variant', 'signoff', 'session']) {
      expect(await count(table, a.id), table).toBe(0)
      expect(await count(table, b.id), table).toBe(1)
    }
  })
})

describe('db/variants', () => {
  it('writes, lists in gallery order, replaces, renews and deletes', async () => {
    const { a, b } = await seed()
    await variants.putVariant(db, a.id, variant('abc234', 1, 2)).run()
    await variants.putVariant(db, a.id, variant('zzz234', 0)).run()
    const listed = await variants.listVariants(db, a.id)
    expect(listed.map((v) => [v.variantKey, v.version])).toEqual([
      ['zzz234', 1],
      ['abc234', 2],
    ])
    expect(await variants.findVariant(db, a.id, 'zzz234')).toEqual(variant('zzz234', 0))
    expect(await variants.findVariant(db, a.id, 'qqq234')).toBeNull()

    const renewal = { pictureUrl: 'https://h.example/new', pictureExpiresAt: 6000 }
    const stale = await variants
      .renewPicture(db, a.id, { variantKey: 'abc234', version: 1, ...renewal })
      .run()
    const fresh = await variants
      .renewPicture(db, a.id, { variantKey: 'abc234', version: 2, ...renewal })
      .run()
    expect([stale.meta.changes, fresh.meta.changes]).toEqual([0, 1])
    expect(await variants.findVariant(db, a.id, 'abc234')).toEqual({
      ...variant('abc234', 1, 2),
      ...renewal,
    })

    await db.batch(variants.deleteVariant(db, a.id, 'abc234'))
    expect(await variants.findVariant(db, a.id, 'abc234')).toBeNull()
    expect(await count('signoff', a.id)).toBe(0)
    expect(await variants.findVariant(db, b.id, 'abc234')).not.toBeNull()
    expect(await count('signoff', b.id)).toBe(1)
  })
})

describe('db/signoffs', () => {
  it('adds once per email, variant and version, lists oldest first, and removes by link', async () => {
    const { a, b } = await seed()
    const row = { variantKey: 'abc234', version: 1, email: 'c@d.co' }
    await signoffs.addSignoff(db, a.id, { id: 'B'.repeat(24), ...row, createdAt: 3 }).run()
    await signoffs.addSignoff(db, a.id, { id: 'C'.repeat(24), ...row, createdAt: 4 }).run()
    await signoffs
      .addSignoff(db, a.id, { id: 'D'.repeat(24), ...row, version: 2, createdAt: 0 })
      .run()
    const listed = await signoffs.listSignoffs(db, a.id)
    expect(listed.map((s) => [s.email, s.version, s.createdAt])).toEqual([
      ['c@d.co', 2, 0],
      ['a@b.co', 1, 1],
      ['c@d.co', 1, 3],
    ])
    const otherLinks = (await signoffs.listSignoffs(db, b.id))[0]?.id ?? ''
    await signoffs.removeSignoff(db, a.id, otherLinks).run()
    expect(await count('signoff', b.id)).toBe(1)
    await signoffs.removeSignoff(db, a.id, 'B'.repeat(24)).run()
    expect(await count('signoff', a.id)).toBe(2)
  })
})

describe('db/sessions', () => {
  it('counts a session only for its own link and before its end time', async () => {
    const { a, b } = await seed()
    expect(await sessions.hasSession(db, `t-${a.id}`, a.id, 8999)).toBe(true)
    expect(await sessions.hasSession(db, `t-${a.id}`, a.id, 9000)).toBe(false)
    expect(await sessions.hasSession(db, `t-${a.id}`, b.id, 1)).toBe(false)
  })

  it('deletes one session, expired sessions, or every session of one link', async () => {
    const { a, b } = await seed()
    await sessions.deleteSession(db, `t-${a.id}`, b.id).run()
    expect(await count('session', a.id)).toBe(1)
    await sessions.deleteSession(db, `t-${a.id}`, a.id).run()
    expect(await count('session', a.id)).toBe(0)

    await sessions.addSession(db, { tokenHash: 'old', linkId: a.id, expiresAt: 10 }).run()
    await sessions.addSession(db, { tokenHash: 'new', linkId: a.id, expiresAt: 20 }).run()
    await sessions.deleteExpiredSessions(db, a.id, 10).run()
    expect(await sessions.hasSession(db, 'new', a.id, 15)).toBe(true)
    expect(await count('session', a.id)).toBe(1)

    await sessions.deleteLinkSessions(db, a.id).run()
    expect(await count('session', a.id)).toBe(0)
    expect(await count('session', b.id)).toBe(1)
  })
})
