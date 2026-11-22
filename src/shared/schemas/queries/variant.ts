// spec/editor-commands.md, "variant.get": one variant with its layers, its clips (P7-9) and the
// assets they name.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantSummary } from './campaign'

export const variantGetInput = projectScoped.extend({ variantId: z.string().min(1) })
export type VariantGetInput = z.infer<typeof variantGetInput>

export type VariantGet = {
  variant: VariantSummary // as in campaign.get: the row, isMaster, subjectIds, badges
  campaignId: string
  layers: LayerRow[] // z ascending, then ID
  // startMs ascending, then ID. Always sent; optional in the type only until the editor's test
  // fixture (tests/unit/renderer/editor/editor-fixture.ts) gives it.
  clips?: BackgroundClipRow[]
  assets: Array<AssetRow & { missing: boolean }> // each asset a layer or clip names, once, by ID
}
