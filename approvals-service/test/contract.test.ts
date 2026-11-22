import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import * as c from '../src/contract'

const RLO = '‮'
const ZWSP = '​'
const ok = 'x'.repeat(12)
const id24 = 'A'.repeat(24)
// A local part of n letters gives an address of n + 192 characters: 62 is 254, the limit.
const longEmail = (n: number) =>
  `${'a'.repeat(n)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}`

type Row = [name: string, schema: z.ZodType, good: unknown[], bad: unknown[]]

const rows: Row[] = [
  [
    'ProjectId',
    c.ProjectId,
    ['01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    ['01ARZ3NDEKTSV4RRFFQ69G5FA', '01ARZ3NDEKTSV4RRFFQ69G5FAI', '01arz3ndektsv4rrffq69g5fav'],
  ],
  [
    'CampaignId',
    c.CampaignId,
    ['spring-sale-abc234', `${'a'.repeat(40)}-zzzzzz`],
    [`${'a'.repeat(41)}-zzzzzz`, 'spring-sale-abc23l', 'Spring-abc234', '-abc234'],
  ],
  ['VariantKey', c.VariantKey, ['abc234', 'zzzzzz'], ['abc23', 'abc2345', 'abc231', 'ABC234']],
  ['Slug', c.Slug, ['aZ09aZ09aZ09'], ['aZ09aZ09aZ0', 'aZ09aZ09aZ09a', 'aZ09aZ09aZ0-']],
  ['SignoffId', c.SignoffId, [id24], [id24.slice(1), `${id24}A`, `${id24.slice(1)}_`]],
  [
    'CampaignName',
    c.CampaignName,
    ['A', 'x'.repeat(200), '  padded  '],
    ['', '   ', 'x'.repeat(201), 'a\u0007b', `a${RLO}b`, `a${ZWSP}b`, 'a\nb'],
  ],
  ['SizeLine', c.SizeLine, ['1080 × 1920', 'x'.repeat(100)], ['x'.repeat(101), `1080${RLO}`]],
  [
    'Password',
    c.Password,
    [ok, 'x'.repeat(128), 'pässwörd 12 ✓'],
    ['x'.repeat(11), 'x'.repeat(129), `${ok}\u0000`, `${ok}\n`],
  ],
  [
    'Email',
    c.Email,
    ['a@b.co', ' Ann@Example.COM ', `${'a'.repeat(64)}@b.co`, longEmail(62)],
    [
      'a@b',
      '@b.co',
      'a@b..co',
      `${'a'.repeat(65)}@b.co`,
      'ännа@b.co',
      'a@bé.co',
      'a`b@c.co',
      'a|b@c.co',
      `a${RLO}@b.co`,
      longEmail(63),
    ],
  ],
  [
    'Version',
    c.Version,
    [0, 7, Number.MAX_SAFE_INTEGER],
    [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'],
  ],
  [
    'PictureUrl',
    c.PictureUrl,
    ['https://b.s3.amazonaws.com/a.png?x=1', `https://h.example/${'p'.repeat(2000)}`],
    ['not a url', `https://h.example/${'p'.repeat(2048)}`],
  ],
  [
    'Time',
    c.Time,
    ['2026-11-21T10:00:00.000Z'],
    [
      '2026-11-21T10:00:00Z',
      '2026-11-21T10:00:00.000+01:00',
      '2026-11-21T10:00:00.0000Z',
      '2026-11-21',
    ],
  ],
]

describe('contract rules [approvals-service.md "The shared contract"]', () => {
  it.each(rows)(
    '%s accepts its good values and refuses its bad ones',
    (_name, schema, good, bad) => {
      for (const value of good) expect(schema.safeParse(value).success, String(value)).toBe(true)
      for (const value of bad) expect(schema.safeParse(value).success, String(value)).toBe(false)
    },
  )

  it('trims shown text and trims and lower-cases emails', () => {
    expect(c.CampaignName.parse('  Spring  ')).toBe('Spring')
    expect(c.Email.parse(' Ann@Example.COM ')).toBe('ann@example.com')
  })

  it('is version 2', () => {
    expect(c.CONTRACT_VERSION).toBe(2)
  })
})

const variant = (variantKey: string) => ({
  variantKey,
  title: 'Hero',
  sizeLine: '1080 × 1080',
  version: 3,
  pictureUrl: 'https://b.s3.amazonaws.com/a.png',
  pictureExpiresAt: '2026-11-21T10:00:00.000Z',
})

describe('request bodies', () => {
  it('takes a gallery of 0 to 500 variants, each key once', () => {
    const abc = '23456789abcdefghjkmnpqrstuvwxyz'
    const key = (i: number) => `aaaa${abc[Math.floor(i / 31)]}${abc[i % 31]}`
    const many = (n: number) => Array.from({ length: n }, (_, i) => variant(key(i)))
    const gallery = (variants: unknown[]) => c.Gallery.safeParse({ campaignName: 'S', variants })
    expect(gallery([]).success).toBe(true)
    expect(gallery(many(500)).success).toBe(true)
    expect(gallery(many(501)).success).toBe(false)
    expect(gallery([variant('abc234'), variant('abc234')]).success).toBe(false)
  })

  it('takes 1 to 500 picture renewals', () => {
    const one = {
      variantKey: 'abc234',
      version: 1,
      pictureUrl: 'https://h.example/a',
      pictureExpiresAt: '2026-11-21T10:00:00.000Z',
    }
    expect(c.PictureRenewals.safeParse({ pictures: [] }).success).toBe(false)
    expect(c.PictureRenewals.safeParse({ pictures: [one] }).success).toBe(true)
    expect(c.PictureRenewals.safeParse({ pictures: Array(501).fill(one) }).success).toBe(false)
  })

  it('refuses unknown keys in a request body', () => {
    const body = {
      projectId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      campaignId: 'spring-abc234',
      campaignName: 'S',
      password: ok,
    }
    expect(c.CreateLink.safeParse(body).success).toBe(true)
    expect(c.CreateLink.safeParse({ ...body, admin: true }).success).toBe(false)
  })
})
