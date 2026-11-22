// variant.fanOut (spec/links-and-sync.md, "Fan-out"): makes the missing variants of a direction
// from its master with planVariant. Agent policy deny. Combinations that exist are skipped. A
// fill size is placed as scale and named in the reply; no fill job starts here (A-129). Step 6
// (P6-15): new texts in another language, the brief's copy, and one translation job per
// language, named in the reply. The inverse is variant.remove with the new variants, on the
// campaign's list.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  factsOf,
  hasVariantAt,
  readFanOutSource,
  refuseLanguage,
  sameSize,
  sizeOf,
  writeVariant,
  type FanOutSource,
} from '@/main/links/fan-out-write'
import {
  startFanOutTranslations,
  translatedLayers,
  type NewVariant,
} from '@/main/translation/fan-out'
import { planVariant, type PlannedLayer } from '@/shared/links/fan-out-plan'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import {
  variantFanOutInput,
  type VariantFanOutInput,
  type VariantFanOutReply,
} from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

const MAX_NEW_VARIANTS = 200
const FITS = 'Choose how the background fits for each new size.'

type Cell = { size: CampaignSize; language: string }

// The grid in campaign order: sizes, then the master's language first so a new language can
// copy its size's plan (R-02). The master's size and language are always in it.
function gridOf(source: FanOutSource, input: VariantFanOutInput): Cell[] {
  const { campaign, master } = source
  for (const language of input.languages) refuseLanguage(source, language)
  const listed = new Set(input.sizes.map((label) => sizeOf(source, label).label))
  listed.add(master.sizeLabel)
  const sizes = campaign.sizes.filter((s) => listed.has(s.label))
  if (!sizes.some((s) => s.label === master.sizeLabel))
    sizes.unshift(sizeOf(source, master.sizeLabel))
  const languages = [
    master.language,
    ...campaign.languages.filter((l) => l !== master.language && input.languages.includes(l)),
  ]
  return sizes.flatMap((size) => languages.map((language) => ({ size, language })))
}

// fits names exactly the listed sizes whose pixel size differs from the master's (A-147).
function refuseFits(source: FanOutSource, input: VariantFanOutInput): void {
  const need = new Set(
    input.sizes.filter((label) => !sameSize(sizeOf(source, label), source.master)),
  )
  const given = Object.keys(input.fits)
  if (given.length !== need.size || given.some((label) => !need.has(label))) {
    throw new AppError('INVALID_INPUT', FITS)
  }
}

export function variantFanOut(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.fanOut',
    input: variantFanOutInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantFanOutReply> {
      const db = ctx.project.db
      const source = readFanOutSource(db, input.directionId)
      const grid = gridOf(source, input)
      refuseFits(source, input)
      const todo = grid.filter(
        (c) => !hasVariantAt(db, input.directionId, c.size.label, c.language),
      )
      if (todo.length > MAX_NEW_VARIANTS) {
        throw new AppError('RULE_VIOLATION', 'Fan-out can make at most 200 variants at a time.', {
          reason: 'too_many_variants',
        })
      }
      const now = deps.now().toISOString()
      const { master } = source
      const plans = new Map<string, PlannedLayer[]>()
      const variantIds: string[] = []
      const fill: VariantFanOutReply['fill'] = []
      const made: NewVariant[] = []
      for (const { size, language } of todo) {
        const fit = input.fits[size.label]
        const planned = planVariant({
          master: factsOf(master, master.language),
          masterLayers: source.masterLayers,
          target: factsOf(size, language),
          fit,
          pictureSize: source.pictureSize,
          sameSizePlan: plans.get(size.label) ?? null,
        })
        const layers = translatedLayers(source.campaign, language, planned)
        const variantId = writeVariant(ctx, source, { size, language, layers }, now)
        variantIds.push(variantId)
        made.push({ variantId, language })
        if (language !== master.language) continue
        plans.set(size.label, layers)
        if (fit === 'fill') fill.push({ sizeLabel: size.label, variantId })
      }
      const campaignId = source.campaign.id
      const translationJobIds = startFanOutTranslations(deps, ctx, source, made)
      const data: VariantFanOutReply = { variantIds, fill }
      if (translationJobIds.length > 0) data.translationJobIds = translationJobIds
      if (variantIds.length === 0) return { data, log: { campaignId } }
      const call = { name: 'variant.remove', input: { projectId: input.projectId, variantIds } }
      return { data, log: { campaignId }, inverse: { scope: `campaign:${campaignId}`, call } }
    },
  })
}
