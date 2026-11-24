// The brand of a brief an agent sends (spec/brief-brand.md "Agents", A-401; security class).
// Stricter than the form: a bad colour, layout or adsPer refuses the brief, the first one by
// field; a logo or font given as a path, full or relative, is refused with no disk read; an
// asset ID must be a picture (logo) or a font of the asset library. No message holds the text
// the agent sent. Reads asset rows by ID only; writes nothing.
import type Database from 'better-sqlite3'
import { briefLook, brandFileTexts, type BriefLook } from '@/shared/brief/brand'
import { pictureRef } from '@/shared/brief/picture-refs'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { BrandRole } from '@/shared/schemas/commands/brief'
import { AppError } from '@/shared/schemas/result'

export type BrandPlan = { look: BriefLook; brand: CampaignCreateInput['brand'] }

const FIELD: Record<BrandRole, string> = {
  logo: 'brand.logo',
  headingFont: 'brand.fonts.heading',
  bodyFont: 'brand.fonts.body',
}

const INPUT_KEY = {
  logo: 'logoAssetId',
  headingFont: 'headingFontAssetId',
  bodyFont: 'bodyFontAssetId',
} as const satisfies Record<BrandRole, keyof NonNullable<CampaignCreateInput['brand']>>

const VALUE_MESSAGE = {
  colours: () => 'brand.colours holds a value that is not a hex colour such as #0B3D2E.',
  layout: () =>
    `layout is not a starter layout ID. Use one of: ${STARTER_LAYOUTS.map((l) => l.id).join(', ')}.`,
  adsPer: () => 'adsPer must be "campaign" or "subject".',
}

function refuseBadValue(look: BriefLook): void {
  const first = look.notes[0]
  if (first === undefined) return
  throw new AppError('INVALID_INPUT', VALUE_MESSAGE[first.field](), { reason: 'brief_value' })
}

function isLibraryAsset(db: Database.Database, id: string, kind: 'image' | 'font'): boolean {
  const row = db.prepare('SELECT kind, library FROM asset WHERE id = ?').get(id) as
    { kind: string; library: string } | undefined
  return row?.kind === kind && row.library === 'asset'
}

// Every brand file text is read first, so a path in any role is refused before any row read.
function assetIdsOf(draft: BriefDraft, platform: NodeJS.Platform) {
  return brandFileTexts(draft).map(({ role, text }) => {
    const ref = pictureRef(text, platform)
    if (ref.kind !== 'asset') {
      throw new AppError(
        'RULE_VIOLATION',
        `${FIELD[role]} names a file. Import it with import_assets first, then give its asset ID.`,
        { reason: 'brand_file_path' },
      )
    }
    return { role, assetId: ref.assetId }
  })
}

export function checkBriefBrand(
  db: Database.Database,
  draft: BriefDraft,
  platform: NodeJS.Platform,
): BrandPlan {
  const look = briefLook(draft)
  refuseBadValue(look)
  const ids = assetIdsOf(draft, platform)
  const brand: NonNullable<CampaignCreateInput['brand']> = {}
  for (const { role, assetId } of ids) {
    const kind = role === 'logo' ? 'image' : 'font'
    if (!isLibraryAsset(db, assetId, kind)) {
      const what = kind === 'image' ? 'picture' : 'font'
      throw new AppError(
        'NOT_FOUND',
        `${FIELD[role]}: no ${what} with that asset ID is in this project's asset library.`,
        { reason: 'unknown_asset' },
      )
    }
    brand[INPUT_KEY[role]] = assetId
  }
  return { look, brand: ids.length > 0 ? brand : undefined }
}

// The confirmed brief's brand fields, from briefLook's cleaned values only, never the raw draft.
export function cleanBrandFields(look: BriefLook) {
  return {
    ...(look.layoutId !== null ? { layout: look.layoutId } : {}),
    ...(look.artDirection !== null ? { artDirection: look.artDirection } : {}),
    adsPer: look.adsPer,
    ...(look.colours.length > 0 ? { brand: { colours: look.colours } } : {}),
  }
}
