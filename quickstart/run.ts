// The quickstart's steps, in the order a person takes them in the app: make the picture on the
// first size, build the master from the brief's layout and brand (and, with --ai_layout, move
// its text with one call), make one variant per language and size, translate what the brief
// gave no words for, and extend the picture to each other size. Every call goes through
// the app's own provider adapters and every answer through the app's own checks.
import { pictureSize } from '@/main/providers/picture-size'
import type { ImageFile, ImageResult } from '@/main/providers/types'
import { cleanAnswer } from '@/main/translation/clean-answer'
import { FILL_PROMPT, prefilledPrompt, promptToSend } from '@/shared/generation/prompt'
import type { SceneVariant } from '@/shared/scene/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { Brand } from './brief-files'
import {
  BODY_FONT_ASSET,
  HEADING_FONT_ASSET,
  LOGO_ASSET,
  MASTER_ASSET,
  fillAsset,
  fillPlacement,
  masterLayers,
  missingItems,
  planVariants,
  withFill,
  withTranslations,
  type Variant,
} from './layers'
import { layoutOffer, placeText } from './place-text'
import type { Plan } from './plan'
import type { Providers } from './providers'
import type { Picture, Studio } from './studio'

// Tells the person what is happening: a step starts, then ends; a note is a warning.
export type Report = { start(label: string): void; end(): void; note(text: string): void }

export type RunInput = {
  plan: Plan
  providers: Providers
  studio: Studio
  references: ImageFile[]
  brand: Brand
  prompt: string | null
  aiLayout: boolean
  report: Report
}

export type RunResult = { variants: Variant[]; prompt: string }

export const sceneVariant = (size: CampaignSize, language: string): SceneVariant => ({
  width: size.width,
  height: size.height,
  language,
  format: 'image',
  durationMs: 0,
})

export function stepCount(plan: Plan, aiLayout: boolean): number {
  return 1 + (aiLayout ? 1 : 0) + plan.translate.length + plan.fills.length
}

// The prompt the app pre-fills for a picture whose words are added as layers.
export function picturePrompt(plan: Plan): string {
  const { brief } = plan
  return prefilledPrompt({
    subjects: plan.subjects.map(({ name, description }) => ({ name, description })),
    audience: brief.audience,
    region: brief.region,
    message: brief.message,
    wordsOnLayers: true,
    kind: 'picture',
    artDirection: plan.look.artDirection,
  })
}

function pictureOf(result: ImageResult): Picture {
  const { width, height } = pictureSize(result.bytes, result.mime)
  return { bytes: result.bytes, mime: result.mime, width, height }
}

async function step<T>(report: Report, label: string, work: () => Promise<T>): Promise<T> {
  report.start(label)
  const result = await work()
  report.end()
  return result
}

// The logo and the fonts the brief gave, handed to the drawing page from memory.
function addBrand(studio: Studio, brand: Brand): void {
  if (brand.logo) studio.addPicture(LOGO_ASSET, brand.logo)
  if (brand.heading) studio.addFont(HEADING_FONT_ASSET, brand.heading)
  if (brand.body) studio.addFont(BODY_FONT_ASSET, brand.body)
}

const hasFont = (brand: Brand) => brand.heading !== null || brand.body !== null
const familiesOf = (brand: Brand) =>
  [brand.heading?.family, brand.body?.family].filter((name): name is string => Boolean(name))

async function translate(input: RunInput, variants: Variant[], to: string): Promise<Variant[]> {
  const { plan, providers, report } = input
  const items = missingItems(variants, to)
  const answer = await providers.text.translate({
    items,
    from: plan.languages[0] ?? '',
    to,
    region: plan.brief.region,
    audience: plan.brief.audience,
  })
  const cleaned = cleanAnswer(
    answer,
    items.map((item) => item.key),
  )
  if (cleaned.length < items.length) {
    report.note(`Some "${to}" texts were not translated; they keep the first language's words.`)
  }
  return variants.map((variant) => withTranslations(variant, to, cleaned))
}

async function extend(
  input: RunInput,
  variants: Variant[],
  size: CampaignSize,
  source: Picture,
): Promise<Variant[]> {
  const sample = variants.find((variant) => variant.size.label === size.label)
  const box = sample && fillPlacement(sample)
  if (!box) return variants
  const result = await input.providers.image.extend({
    image: { bytes: source.bytes, mime: source.mime },
    placement: { ...box, rotation: 0, crop: null },
    width: size.width,
    height: size.height,
    prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
  })
  input.studio.addPicture(fillAsset(size.label), pictureOf(result))
  return variants.map((variant) =>
    variant.size.label === size.label ? withFill(variant) : variant,
  )
}

export async function runQuickstart(input: RunInput): Promise<RunResult> {
  const { plan, providers, studio, references, report } = input
  const first = plan.sizes[0] as CampaignSize
  const prompt = input.prompt ?? picturePrompt(plan)
  const picture = await step(report, `Making the picture (${first.label})`, async () => {
    const [result] = await providers.image.generate({
      prompt: promptToSend(prompt, { pictures: references.length }),
      references,
      width: first.width,
      height: first.height,
      count: 1,
    })
    if (!result) throw new Error('The provider gave no picture.')
    return pictureOf(result)
  })
  studio.addPicture(MASTER_ASSET, picture)
  const { brand } = input
  addBrand(studio, brand)
  let master = masterLayers(plan, {
    logo: brand.logo !== null,
    headingFont: brand.heading !== null,
    bodyFont: brand.body !== null,
  })
  if (input.aiLayout) {
    const layers = master
    master = await step(report, 'Placing the text on the picture', () =>
      placeText({
        layout: providers.layout,
        studio,
        size: first,
        variant: sceneVariant(first, plan.languages[0] ?? ''),
        master: layers,
        offer: layoutOffer(plan.look.colours, familiesOf(brand), hasFont(brand)),
        onNoBoxes: () => report.note('The answer held no usable boxes, so the layout is kept.'),
      }),
    )
  }
  let variants = planVariants(plan, master, picture)
  for (const language of plan.translate) {
    variants = await step(report, `Translating to ${language}`, () =>
      translate(input, variants, language),
    )
  }
  for (const size of plan.fills) {
    variants = await step(report, `Extending the picture to ${size.label}`, () =>
      extend(input, variants, size, picture),
    )
  }
  return { variants, prompt }
}
