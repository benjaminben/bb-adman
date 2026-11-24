// spec/brief-brand.md "campaign.create", step 2 (A-405, R-12): each brand asset ID from the
// window must name an asset of the right kind in the asset library, so no layer gets a font
// as a picture, a picture as a font, or a reference-library file. Reads rows by ID only.
import type Database from 'better-sqlite3'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import { AppError } from '@/shared/schemas/result'

type AssetKind = 'image' | 'font'

function isLibraryAsset(db: Database.Database, id: string, kind: AssetKind): boolean {
  const row = db.prepare('SELECT kind, library FROM asset WHERE id = ?').get(id) as
    { kind: string; library: string } | undefined
  return row?.kind === kind && row.library === 'asset'
}

// Throws NOT_FOUND for the first brand ID that fails; writes nothing.
export function checkBrandAssets(db: Database.Database, brand: CampaignCreateInput['brand']): void {
  if (!brand) return
  const { logoAssetId, headingFontAssetId, bodyFontAssetId } = brand
  if (logoAssetId !== undefined && !isLibraryAsset(db, logoAssetId, 'image')) {
    throw new AppError(
      'NOT_FOUND',
      "The brand logo is not a picture in this project's asset library.",
    )
  }
  for (const id of [headingFontAssetId, bodyFontAssetId]) {
    if (id !== undefined && !isLibraryAsset(db, id, 'font')) {
      throw new AppError('NOT_FOUND', "A brand font is not a font in this project's asset library.")
    }
  }
}
