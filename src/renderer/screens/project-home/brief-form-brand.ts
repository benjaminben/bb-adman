// The brand part of the brief form (spec/brief-brand.md, "The brief form", the model). Pure,
// no React. brandFromDraft fills it from a parsed brief and its imported brand files;
// brandPlan gives what it adds to campaign.create; removedBrandAssets gives the assets to
// remove again when roles leave the form. The brand adds no problem line.
import { briefLook } from '@/shared/brief/brand'
import { DEFAULT_STARTER_LAYOUT_ID } from '@/shared/config/starter-layouts'
import type { Brief, BriefDraft } from '@/shared/schemas/brief'
import type { BrandRole } from '@/shared/schemas/commands/brief'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { BriefFormValues, FormPhoto } from './brief-form-model'
import { brandValueNoteLine } from './brand-notes'

export type FormAsset = FormPhoto

export type BrandChoice = {
  logo: FormAsset | null
  headingFont: FormAsset | null
  bodyFont: FormAsset | null
  colours: string[] // cleaned
  layoutId: string // a starter layout ID; the default when the brief gave none
  artDirection: string // as typed
  notes: string[]
}

// The brief's brand files, made by brief-load/ from brief.parse's brandFiles.
export type BriefBrand = {
  logo: FormAsset | null
  headingFont: FormAsset | null
  bodyFont: FormAsset | null
  notes: string[]
}

export type BrandPlan = {
  brief: Pick<Brief, 'layout' | 'artDirection' | 'brand'>
  campaign: CampaignCreateInput['brand']
}

const ROLES: BrandRole[] = ['logo', 'headingFont', 'bodyFont']

// The files from imported; colours, layout and art direction through briefLook. The import
// notes come first, then one line per value that could not be used.
export function brandFromDraft(draft: BriefDraft, imported?: BriefBrand): BrandChoice {
  const look = briefLook(draft)
  return {
    logo: imported?.logo ?? null,
    headingFont: imported?.headingFont ?? null,
    bodyFont: imported?.bodyFont ?? null,
    colours: look.colours,
    layoutId: look.layoutId ?? DEFAULT_STARTER_LAYOUT_ID,
    artDirection: look.artDirection ?? '',
    notes: [...(imported?.notes ?? []), ...look.notes.map(brandValueNoteLine)],
  }
}

// The default layout is left out, as campaign.create reads a missing layout as the default:
// a form with no brand choices then sends what it sent before the brand fields existed.
export function brandPlan(brand: BrandChoice): BrandPlan {
  const brief: BrandPlan['brief'] = {}
  if (brand.layoutId !== DEFAULT_STARTER_LAYOUT_ID) brief.layout = brand.layoutId
  const artDirection = brand.artDirection.trim()
  if (artDirection !== '') brief.artDirection = artDirection
  if (brand.colours.length > 0) brief.brand = { colours: brand.colours }
  const campaign: NonNullable<BrandPlan['campaign']> = {}
  if (brand.logo !== null) campaign.logoAssetId = brand.logo.assetId
  if (brand.headingFont !== null) campaign.headingFontAssetId = brand.headingFont.assetId
  if (brand.bodyFont !== null) campaign.bodyFontAssetId = brand.bodyFont.assetId
  return { brief, campaign: Object.keys(campaign).length === 0 ? undefined : campaign }
}

// The added assets of the leaving roles that no other brand role and no subject photo of the
// form still holds, each once.
export function removedBrandAssets(values: BriefFormValues, roles: BrandRole[]): string[] {
  const { brand } = values
  const kept = new Set([
    ...ROLES.filter((r) => !roles.includes(r)).flatMap((r) => brand[r]?.assetId ?? []),
    ...values.subjects.flatMap((s) => s.photos.map((p) => p.assetId)),
  ])
  const ids = roles.flatMap((r) => {
    const asset = brand[r]
    return asset !== null && asset.added && !kept.has(asset.assetId) ? [asset.assetId] : []
  })
  return [...new Set(ids)]
}
