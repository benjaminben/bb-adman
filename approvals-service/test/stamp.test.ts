import { describe, it, expect } from 'vitest'
import { galleryStamp, signableSet } from '../src/visitor/stamp'

// spec/phases/round-2-approvals.md "Sign off all: one request for all", steps 1 and 2 (R2A-3).

const A = { variantKey: 'aaa234', version: 1 }
const B = { variantKey: 'bbb234', version: 2 }

describe('galleryStamp [R2A-3]', () => {
  it('gives the SHA-256 of the lines {variantKey}.{version}\\n as 64 lower-case hex letters', async () => {
    // printf 'aaa234.1\nbbb234.2\n' | shasum -a 256
    expect(await galleryStamp([A, B])).toBe(
      '04adfdca03be2feb4ecdf1c6ebc0f3d29ab6cc587584a8e8e30555a06d5a3cad',
    )
  })

  it.each([
    ['the other order', [B, A], 'ef3fabd63452d0ab01b91f23cd35a7016788c5b615e9fda2a31261dd961d60c6'],
    ['one variant', [A], 'a892a15060bcc8bcb11ee4265b8c6ed33c3a5539e5490658cec162e0bbcaea79'],
    ['no variant', [], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ])('gives a different, fixed stamp for %s', async (_, set, hex) => {
    expect(await galleryStamp(set)).toBe(hex)
  })

  it('changes when a version changes', async () => {
    const before = await galleryStamp([A, B])
    expect(await galleryStamp([A, { ...B, version: 3 }])).not.toBe(before)
  })
})

describe('signableSet [R2A-3]', () => {
  const NOW = 1000
  const row = (variantKey: string, version: number, pictureExpiresAt: number) => ({
    variantKey,
    position: 0,
    title: 'T',
    sizeLine: 'S',
    version,
    pictureUrl: 'https://h.example/p.png',
    pictureExpiresAt,
  })

  it('keeps the rows whose picture has not expired at now, in the order given, as key and version', () => {
    const rows = [row('ccc234', 4, NOW + 1), row('aaa234', 1, NOW), row('bbb234', 2, NOW + 9)]
    expect(signableSet(rows, NOW)).toEqual([
      { variantKey: 'ccc234', version: 4 },
      { variantKey: 'bbb234', version: 2 },
    ])
  })

  it('so an expired picture changes the stamp', async () => {
    const rows = [row('aaa234', 1, NOW + 1), row('bbb234', 2, NOW + 1)]
    const live = await galleryStamp(signableSet(rows, NOW))
    expect(await galleryStamp(signableSet(rows, NOW + 1))).not.toBe(live)
    expect(live).toBe(await galleryStamp([A, B]))
  })
})
