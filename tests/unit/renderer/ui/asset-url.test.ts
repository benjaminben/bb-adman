// SPEC 14 1.41 TP-2: the one owner of an asset's address in the window.
import { describe, expect, it } from 'vitest'
import { assetUrl } from '../../../../src/renderer/ui/asset-url'

const P = '01JD0000000000000000000001'
const A = '01JD0000000000000000000002'

describe('assetUrl [SPEC 3.6 "Asset files"]', () => {
  it('gives adman-asset://{projectId}/{assetId}', () => {
    expect(assetUrl(P, A)).toBe(`adman-asset://${P}/${A}`)
  })

  it('escapes a value that is not an ID, so it cannot add a path part', () => {
    expect(assetUrl(P, '../x?y')).toBe(`adman-asset://${P}/..%2Fx%3Fy`)
  })
})
