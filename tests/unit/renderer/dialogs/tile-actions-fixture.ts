// A campaign with two directions for the tile action tests (P5-15): "Beach day" holds the
// master V1 and V2; "City night" holds its master V3. Campaign order: V1, V2, V3.
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { campaignGet, variant } from '../screens/campaign/campaign-fixture'

const direction = (id: string, name: string, masterVariantId: string, sort: number) =>
  ({ id, campaignId: 'C1', name, masterVariantId, sort }) satisfies DirectionRow

export const BEACH_MASTER = variant('V1', { title: 'Master post', isMaster: true })
export const GERMAN = variant('V2', { title: 'German post', language: 'de' })
export const NIGHT_MASTER = variant('V3', {
  title: 'Night master',
  directionId: 'D2',
  isMaster: true,
  width: 1080,
  height: 1920,
  sizeLabel: '9:16',
})

export function twoDirections(variants: VariantSummary[] = [GERMAN, BEACH_MASTER, NIGHT_MASTER]) {
  const base: CampaignGet = campaignGet(variants)
  return {
    ...base,
    directions: [direction('D1', 'Beach day', 'V1', 0), direction('D2', 'City night', 'V3', 1)],
  }
}
