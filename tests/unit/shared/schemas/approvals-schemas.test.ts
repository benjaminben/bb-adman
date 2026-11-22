// AP-5 (spec/approvals.md "Commands", "Queries and the event"): the approvals command and query
// inputs. One table: for each schema a good value, then each field changed to a value it must
// refuse.
import { describe, it, expect, expectTypeOf } from 'vitest'
import type { z } from 'zod'
import {
  approvalsCampaignInput,
  approvalsCheckInput,
  approvalsCreateLinkInput,
  approvalsSetPasswordInput,
  approvalsSetServiceInput,
} from '@/shared/schemas/commands/approvals'
import {
  approvalsForCampaignInput,
  approvalsGetPasswordInput,
} from '@/shared/schemas/queries/approvals'
import { EVENT_NAMES, type EventMap } from '@/shared/schemas/events'
import { SECRET_NAMES, USER_SECRET_NAMES } from '@/shared/schemas/secrets'
import { APPROVALS_PASSWORD_MESSAGE } from '@/shared/approvals/messages'

const projectId = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const campaignId = 'spring-sale-abc234'
const ids = { projectId, campaignId }
const password = 'correct-horse-12'

const badIds: Array<[string, Record<string, unknown>]> = [
  ['a missing projectId', { campaignId }],
  ['a projectId that is not a ULID', { projectId: 'p1', campaignId }],
  ['a lower-case projectId', { projectId: projectId.toLowerCase(), campaignId }],
  ['a missing campaignId', { projectId }],
  ['a campaignId with a slash', { projectId, campaignId: 'spring/../sale-abc234' }],
  ['a campaignId without its letters', { projectId, campaignId: 'spring-sale' }],
  ['a campaignId with capitals', { projectId, campaignId: 'Spring-sale-abc234' }],
  ['an unknown key', { ...ids, extra: 1 }],
]

const cases: Array<[string, z.ZodType, unknown, Array<[string, unknown]>]> = [
  [
    'approvals.setService',
    approvalsSetServiceInput,
    { address: 'https://approvals.example.com' },
    [
      ['a missing address', {}],
      ['a number', { address: 7 }],
      ['an unknown key', { address: null, extra: 1 }],
    ],
  ],
  ['approvals.check', approvalsCheckInput, {}, [['an unknown key', { extra: 1 }]]],
  ['approvals.publish (and refresh, endLink)', approvalsCampaignInput, ids, badIds],
  ['approvals.forCampaign', approvalsForCampaignInput, ids, badIds],
  ['approvals.getPassword', approvalsGetPasswordInput, ids, badIds],
  ...[approvalsCreateLinkInput, approvalsSetPasswordInput].map(
    (schema, i): [string, z.ZodType, unknown, Array<[string, unknown]>] => [
      i === 0 ? 'approvals.createLink' : 'approvals.setPassword',
      schema,
      { ...ids, password },
      [
        ...badIds.map(([n, v]): [string, unknown] => [n, { ...v, password }]),
        ['a password of 11 characters', { ...ids, password: 'a'.repeat(11) }],
        ['a password of 129 characters', { ...ids, password: 'a'.repeat(129) }],
        ['a password with a line break', { ...ids, password: 'correct-horse\n12' }],
        ['a password with a tab', { ...ids, password: 'correct-horse\t12' }],
        ['a password with a NUL', { ...ids, password: 'correct-horse\u000012' }],
        ['a null password', { ...ids, password: null }],
      ],
    ],
  ),
]

describe('approvals input schemas [spec/approvals.md "Commands", "Queries and the event"]', () => {
  describe.each(cases)('%s', (_name, schema, good, refused) => {
    it('accepts a good value', () => {
      expect(schema.safeParse(good).success).toBe(true)
    })

    it.each(refused)('refuses %s', (_field, value) => {
      expect(schema.safeParse(value).success).toBe(false)
    })
  })

  it.each([approvalsCreateLinkInput, approvalsSetPasswordInput])(
    'takes no password (one is made) and passwords of 12 and 128 characters',
    (schema) => {
      expect(schema.safeParse(ids).success).toBe(true)
      expect(schema.safeParse({ ...ids, password: 'a'.repeat(12) }).success).toBe(true)
      expect(schema.safeParse({ ...ids, password: 'ä'.repeat(128) }).success).toBe(true)
    },
  )

  it('gives the password rule its sentence', () => {
    const result = approvalsCreateLinkInput.safeParse({ ...ids, password: 'short' })
    expect(result.error?.issues.map((i) => i.message)).toEqual([APPROVALS_PASSWORD_MESSAGE])
  })
})

describe('the approvals event and secret name [spec/approvals.md "Settings", "Queries and the event"]', () => {
  it('lists approvals.changed, carrying only the two IDs', () => {
    expect(EVENT_NAMES).toContain('approvals.changed')
    expectTypeOf<EventMap['approvals.changed']>().toEqualTypeOf<{
      projectId: string
      campaignId: string
    }>()
  })

  it('lists approvals.apiKey as a user key', () => {
    expect(SECRET_NAMES).toContain('approvals.apiKey')
    expect(USER_SECRET_NAMES).toContain('approvals.apiKey')
  })
})

describe('approvals.progress [R2V-7, SV-12]', () => {
  it('lists approvals.progress, carrying the two IDs, the step and two counts only', () => {
    expect(EVENT_NAMES).toContain('approvals.progress')
    expectTypeOf<EventMap['approvals.progress']>().toEqualTypeOf<{
      projectId: string
      campaignId: string
      step: 'making' | 'sending'
      done: number
      total: number
    }>()
  })
})
