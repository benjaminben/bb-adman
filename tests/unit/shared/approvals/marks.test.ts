// AP-12 (spec/approvals.md "Versions and marks"): one table over every row of the marks table,
// plus the cases the table leaves to its neighbours (ended link, nothing signed in the gallery).
import { describe, expect, it } from 'vitest'
import { approvalMarks, type ApprovalLinkState } from '@/shared/approvals/marks'
import type { ApprovalsSignoff, ApprovalsVariant } from '@/shared/schemas/queries/approvals'

const signoff = (id: string, current: boolean): ApprovalsSignoff => ({
  id,
  email: `${id}@example.com`,
  signedAt: '2026-11-19T10:00:00.000Z',
  version: current ? 4 : 3,
})

const entry = (
  currentRev: number,
  publishedRev: number | null,
  signoffs: ApprovalsSignoff[] = [],
): ApprovalsVariant => ({ variantId: 'V1', currentRev, publishedRev, signoffs })

const CUR = signoff('ana', true)
const CUR2 = signoff('ben', true)
const OLD = signoff('cy', false)

type Row = [string, ApprovalsVariant | undefined, ApprovalLinkState, string[]]

const ROWS: Row[] = [
  ['no link', entry(4, 4, [CUR]), null, []],
  ['no row in the reply', undefined, 'live', []],
  ['ended link, not in the gallery, no sign-off', entry(4, null), 'ended', []],
  ['in the gallery, unchanged, one current', entry(4, 4, [CUR]), 'live', ['Signed off by 1']],
  [
    'in the gallery, unchanged, two current',
    entry(4, 4, [CUR, CUR2, OLD]),
    'live',
    ['Signed off by 2'],
  ],
  ['ended link keeps the sign-off mark', entry(4, 4, [CUR]), 'ended', ['Signed off by 1']],
  ['changed, no sign-off', entry(5, 4), 'live', ['Changed since published']],
  [
    'published rev differs, a sign-off of the current rev',
    entry(4, 3, [CUR]),
    'live',
    ['Signed off by 1'],
  ],
  ['live link, not in the gallery', entry(4, null), 'live', ['Not in the gallery']],
  [
    'ended link, not in the gallery, a sign-off of the current rev',
    entry(4, null, [CUR]),
    'ended',
    ['Signed off by 1'],
  ],
  ['an older sign-off in the reply is not counted', entry(5, 5, [OLD]), 'live', []],
  [
    'changed, an older sign-off in the reply',
    entry(6, 5, [OLD]),
    'live',
    ['Changed since published'],
  ],
  ['in the gallery, unchanged, nothing signed', entry(4, 4), 'live', []],
]

describe('approvalMarks [spec/approvals.md "Versions and marks"]', () => {
  it.each(ROWS)('%s', (_name, given, linkState, marks) => {
    expect(approvalMarks(given, linkState)).toEqual(marks)
  })
})
