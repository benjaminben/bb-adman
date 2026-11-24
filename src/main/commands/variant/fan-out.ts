// variant.fanOut (spec/links-and-sync.md, "Fan-out"; spec/make-variants.md, "Making variants
// from a variant"): makes the missing variants of a direction from its master, or from the
// variant sourceVariantId names, with planNewVariant. Agent policy deny. Combinations that
// exist are skipped. A fill size is placed as scale and named in the reply; no fill job starts
// here (A-129). Step 6 (P6-15): new texts in another language, the brief's copy, and one
// translation job per language, named in the reply. Step 7 (P7-23): a new video variant copies
// a video source's clips, else gets its first clip from the background picture. The inverse is
// variant.remove with the new variants, on the campaign's list.
import { addFirstClip } from '@/main/clips/write-clip'
import { copyClips } from '@/main/links/copy-clips'
import { defineCommand, type HandlerResult, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  factsOf,
  hasVariantAt,
  planInputOf,
  readFanOutSource,
  refuseLanguage,
  sameSize,
  sizeOf,
  writeVariant,
  type FanOutSource,
  type VariantFormat,
} from '@/main/links/fan-out-write'
import { startFanOutTranslations, type NewVariant } from '@/main/translation/fan-out'
import type { PlannedLayer } from '@/shared/links/fan-out-plan'
import { planNewVariant } from '@/shared/links/new-variant-plan'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import {
  variantFanOutInput,
  type VariantFanOutInput,
  type VariantFanOutReply,
} from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

const MAX_NEW_VARIANTS = 200
const FITS = 'Choose how the background fits for each new size.'

type Cell = { size: CampaignSize; language: string; format: VariantFormat }

const FORMATS: VariantFormat[] = ['image', 'video']

// The grid in campaign order: sizes, then the source's language first so a new language can
// copy its size's plan (R-02), then image before video. The source's size and language are
// always in it.
function gridOf(source: FanOutSource, input: VariantFanOutInput): Cell[] {
  const { campaign, from } = source
  for (const language of input.languages) refuseLanguage(source, language)
  const listed = new Set(input.sizes.map((label) => sizeOf(source, label).label))
  listed.add(from.sizeLabel)
  const sizes = campaign.sizes.filter((s) => listed.has(s.label))
  if (!sizes.some((s) => s.label === from.sizeLabel)) sizes.unshift(sizeOf(source, from.sizeLabel))
  const languages = [
    from.language,
    ...campaign.languages.filter((l) => l !== from.language && input.languages.includes(l)),
  ]
  const formats = FORMATS.filter((f) => input.formats.includes(f))
  return sizes.flatMap((size) =>
    languages.flatMap((language) => formats.map((format) => ({ size, language, format }))),
  )
}

// Step 7: a video source's clips, else the first clip through addFirstClip, which checks the
// asset and the row as every clip command does. A row that fails those checks (a project file
// made elsewhere can hold anything) is left out: the variant is still made, with no clip and
// first_clip_made 0.
function clipsFor(
  ctx: ProjectContext,
  source: FanOutSource,
  cell: Cell,
  variantId: string,
  now: string,
): void {
  const { from } = source
  if (from.format === 'video' && copyClips(ctx, from.id, variantId, sameSize(cell.size, from), now))
    return
  try {
    addFirstClip(ctx, variantId, now)
  } catch (error) {
    if (!(error instanceof AppError)) throw error
  }
}

// fits names exactly the listed sizes whose pixel size differs from the source's (A-147).
function refuseFits(source: FanOutSource, input: VariantFanOutInput): void {
  const need = new Set(input.sizes.filter((label) => !sameSize(sizeOf(source, label), source.from)))
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
      const source = readFanOutSource(db, input.directionId, input.sourceVariantId)
      const grid = gridOf(source, input)
      refuseFits(source, input)
      const todo = grid.filter(
        (c) => !hasVariantAt(db, input.directionId, c.size.label, c.language, c.format),
      )
      if (todo.length > MAX_NEW_VARIANTS) {
        throw new AppError('RULE_VIOLATION', 'You can make at most 200 variants at a time.', {
          reason: 'too_many_variants',
        })
      }
      const now = deps.now().toISOString()
      const { from } = source
      const plans = new Map<string, PlannedLayer[]>()
      const variantIds: string[] = []
      const fill: VariantFanOutReply['fill'] = []
      const made: NewVariant[] = []
      for (const cell of todo) {
        const { size, language, format } = cell
        const fit = input.fits[size.label]
        const sameSizePlan = plans.get(size.label) ?? null
        const layers = planNewVariant(
          planInputOf(source, factsOf(size, language), fit, sameSizePlan),
        )
        const variantId = writeVariant(ctx, source, { size, language, layers, format }, now)
        if (format === 'video') clipsFor(ctx, source, cell, variantId, now)
        variantIds.push(variantId)
        made.push({ variantId, language })
        if (language !== from.language || plans.has(size.label)) continue
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
