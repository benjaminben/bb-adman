// Made-up approvals.forCampaign replies for the store, bar and dialog tests. No real brand or
// person; every email is at example.com.
import type {
  ApprovalsForCampaign,
  ApprovalsLink,
  ApprovalsVariant,
} from '@/shared/schemas/queries/approvals'

export const P = 'p1'
export const C = 'c1'
export const ADDRESS = 'https://approvals.example.com/l/Zq8sLm3kTn4pWx7v'

export function liveLink(overrides: Partial<ApprovalsLink> = {}): ApprovalsLink {
  return {
    state: 'live',
    address: ADDRESS,
    createdAt: '2026-11-18T09:00:00.000Z',
    publishedAt: '2026-11-18T09:01:00.000Z',
    checkedAt: '2026-11-20T14:30:00.000Z',
    endedAt: null,
    passwordKept: true,
    ...overrides,
  }
}

export function endedLink(): ApprovalsLink {
  return liveLink({ state: 'ended', endedAt: '2026-11-19T16:00:00.000Z', publishedAt: null })
}

export const VARIANTS: ApprovalsVariant[] = [
  {
    variantId: 'v1',
    currentRev: 4,
    publishedRev: 4,
    stillOnly: null,
    signoffs: [
      {
        id: 's1',
        email: 'ana@example.com',
        signedAt: '2026-11-19T10:00:00.000Z',
        version: 4,
      },
    ],
  },
  { variantId: 'v2', currentRev: 6, publishedRev: 5, stillOnly: null, signoffs: [] },
  { variantId: 'v3', currentRev: 1, publishedRev: null, stillOnly: null, signoffs: [] },
]

export const TITLES: Record<string, string> = {
  v1: 'Square post',
  v2: 'Story',
  v3: 'Wide banner',
}

export function forCampaign(overrides: Partial<ApprovalsForCampaign> = {}): ApprovalsForCampaign {
  return { ready: 'ready', link: liveLink(), variants: VARIANTS, ...overrides }
}
