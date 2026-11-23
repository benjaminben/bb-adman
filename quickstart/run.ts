// The quickstart's steps, in the order a person takes them in the app: make the picture on the
// first size, place the text on it, make one variant per language and size, translate what the
// brief gave no words for, and extend the picture to each other size. Every call goes through
// the app's own provider adapters and every answer through the app's own checks.
import { pictureSize } from '@/main/providers/picture-size'
import type { ImageFile, ImageResult } from '@/main/providers/types'
import { cleanAnswer } from '@/main/translation/clean-answer'
import { TYPE_STYLE_IDS, typeStylePrompt } from '@/shared/config/type-styles'
import { clampLayout } from '@/shared/generation/layout-clamp'
import { LAYOUT_PICTURE_SIDE, layoutItems } from '@/shared/generation/layout-items'
import { keepReadable } from '@/shared/generation/layout-readable'
import { FILL_PROMPT, prefilledPrompt, promptToSend } from '@/shared/generation/prompt'
import type { SceneVariant } from '@/shared/scene/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import {
  MASTER_ASSET,
  fillAsset,
  fillPlacement,
  masterLayers,
  missingItems,
  planVariants,
  withFill,
  withLayout,
  withTranslations,
  type Variant,
} from './layers'
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
  prompt: string | null
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

export function stepCount(plan: Plan): number {
  return 2 + plan.translate.length + plan.fills.length
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

// One layout call on the first size, checked as the app's layout job checks it: the boxes are
// clamped to the canvas, then each text colour is tested against the picture under it.
async function placeText(input: RunInput, master: LayerRow[]): Promise<LayerRow[]> {
  const { plan, providers, studio, report } = input
  const size = plan.sizes[0] as CampaignSize
  const { width, height } = size
  const scale = Math.min(1, LAYOUT_PICTURE_SIDE / Math.max(width, height))
  const variant = sceneVariant(size, plan.languages[0] ?? '')
  const noText = master.filter((layer) => layer.type !== 'text')
  const picture = await studio.draw(variant, noText, 'full', scale)
  const items = layoutItems(master)
  const answer = await providers.layout.propose({
    background: { bytes: picture.png, mime: 'image/png' },
    width,
    height,
    items,
    palette: [],
    fonts: ['Inter'],
    typeStyles: typeStylePrompt(),
  })
  const keys = items.map((item) => item.slot)
  const boxes = clampLayout(answer, {
    width,
    height,
    palette: [],
    keys,
    typeStyles: TYPE_STYLE_IDS,
  })
  if (boxes.length === 0) {
    report.note('The answer held no usable boxes, so the starter layout is kept.')
    return master
  }
  const pixels = await studio.pixels(picture.png)
  const readable = keepReadable(boxes, {
    pixels,
    scale: pixels.width / width,
    palette: [],
    layers: master,
  })
  return withLayout(master, readable)
}

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
  const master = await step(report, 'Placing the text on the picture', () =>
    placeText(input, masterLayers(plan)),
  )
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
