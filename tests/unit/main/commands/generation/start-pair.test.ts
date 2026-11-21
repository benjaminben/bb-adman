// CU-6b-M N-4 step 2: each start of generation.startVideo gives its start pair, and every
// other shape of the start fields is refused (SPEC 14 1.60).
import { describe, it, expect } from 'vitest'
import { startPair } from '../../../../../src/main/commands/generation/start-pair'

const refusal = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    const { code, message, details } = e as {
      code?: string
      message: string
      details?: { reason?: string }
    }
    return { code, message, reason: details?.reason }
  }
  return 'accepted'
}

const none = { start: 'none', useReferences: false, referenceAssetIds: [] } as const

describe('startPair [SPEC 14 1.60 CU-6b N-4]', () => {
  it.each([
    ['a prompt', none, { firstFrame: false, references: false }],
    [
      'a first-frame picture',
      { start: 'first_frame', useReferences: false, referenceAssetIds: ['a1'] },
      { firstFrame: true, references: false },
    ],
    [
      'a reference picture',
      { start: 'none', useReferences: true, referenceAssetIds: ['a1'] },
      { firstFrame: false, references: true },
    ],
  ] as const)('the start from %s gives its pair', (_, fields, pair) => {
    expect(startPair(fields)).toEqual(pair)
  })

  it('more than one reference still gives the reference pair (the count is checked later)', () => {
    const fields = { start: 'none', useReferences: true, referenceAssetIds: ['a1', 'a2'] } as const
    expect(startPair(fields)).toEqual({ firstFrame: false, references: true })
  })

  it.each([
    ['first_frame with no ID', { start: 'first_frame', referenceAssetIds: [] }],
    ['useReferences with no ID', { useReferences: true, referenceAssetIds: [] }],
    ['IDs with none and useReferences false', { referenceAssetIds: ['a1'] }],
    ['two IDs on first_frame', { start: 'first_frame', referenceAssetIds: ['a1', 'a2'] }],
  ] as const)('refuses %s: INVALID_INPUT "Choose one picture for this video."', (_, change) => {
    expect(refusal(() => startPair({ ...none, ...change }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'Choose one picture for this video.',
      reason: undefined,
    })
  })

  it('refuses a first frame with references: comfy_job_not_offered (no workflow does both)', () => {
    const fields = { start: 'first_frame', useReferences: true, referenceAssetIds: ['a1'] } as const
    expect(refusal(() => startPair(fields))).toMatchObject({
      code: 'RULE_VIOLATION',
      reason: 'comfy_job_not_offered',
    })
  })
})
