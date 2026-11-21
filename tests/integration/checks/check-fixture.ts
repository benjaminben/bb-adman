// Test helper for P6-3: an open project with one campaign made from the starter template (its
// master and a German variant), and readers for its variants and check rows. Not a test file.
import { data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

export type CheckProject = Awaited<ReturnType<typeof openCheckProject>>

export async function openCheckProject(fx: Fixture, name = 'A') {
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name, location: fx.projectsDir }),
  )
  const { campaignId } = data<{ campaignId: string }>(
    await fx.user('campaign.create', { projectId, ...createInput() }),
  )
  const db = () => fx.core.deps.projects.requireOpen(projectId).db
  // A second variant beside the master: the German one in the same size.
  const master = readWireRows(db(), 'variant')[0] as VariantRow
  data(
    await fx.user('variant.add', {
      projectId,
      directionId: master.directionId,
      sizeLabel: master.sizeLabel,
      language: 'de',
      format: 'image',
    }),
  )
  const campaign = async () =>
    data<CampaignGet>(await fx.core.query('campaign.get', { projectId, campaignId }, USER))
  const variantIds = (): string[] =>
    (readWireRows(db(), 'variant') as VariantRow[]).map((v) => v.id).sort()
  return {
    projectId,
    campaignId,
    db,
    campaign,
    variantIds,
    variant: (id: string) => readWireRow(db(), 'variant', { id }) as VariantRow,
    checkRow: (variantId: string) =>
      readWireRow(db(), 'variant_check', { variantId }) as VariantCheckRow | null,
    layers: async (variantId: string) =>
      data<VariantGet>(await fx.core.query('variant.get', { projectId, variantId }, USER)).layers,
  }
}

const USER = { actor: 'user' as const }
