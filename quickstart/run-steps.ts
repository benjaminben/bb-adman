// Two steps of an ad set's run, each one AI call through the app's own adapters: translate the
// texts the brief gave no words for, and extend the first picture to another size.
import { pictureSize } from '@/main/providers/picture-size'
import type { ImageResult } from '@/main/providers/types'
import { cleanAnswer } from '@/main/translation/clean-answer'
import { FILL_PROMPT, promptToSend } from '@/shared/generation/prompt'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import {
  fillAsset,
  fillPlacement,
  missingItems,
  withFill,
  withTranslations,
  type Variant,
} from './layers'
import type { Plan } from './plan'
import type { Providers } from './providers'
import type { CallKind, CallRecord } from './report'
import type { Picture, Studio } from './studio'

// Tells the person what is happening: a step starts, then ends; a note is a warning.
export type Progress = { start(label: string): void; end(): void; note(text: string): void }

export function pictureOf(result: ImageResult): Picture {
  const { width, height } = pictureSize(result.bytes, result.mime)
  return { bytes: result.bytes, mime: result.mime, width, height }
}

// One AI call, shown as a step and timed for the report.
export async function call<T>(
  progress: Progress,
  calls: CallRecord[],
  kind: CallKind,
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  progress.start(label)
  const began = Date.now()
  const result = await work()
  calls.push({ kind, ms: Date.now() - began })
  progress.end()
  return result
}

export async function translate(
  plan: Plan,
  providers: Providers,
  progress: Progress,
  variants: Variant[],
  to: string,
): Promise<Variant[]> {
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
    progress.note(`Some "${to}" texts were not translated; they keep the first language's words.`)
  }
  return variants.map((variant) => withTranslations(variant, to, cleaned))
}

// The extended picture is handed to the drawing page and returned, so it can be saved as made.
export async function extend(
  providers: Providers,
  studio: Studio,
  variants: Variant[],
  size: CampaignSize,
  source: Picture,
): Promise<{ variants: Variant[]; picture: Picture | null }> {
  const sample = variants.find((variant) => variant.size.label === size.label)
  const box = sample && fillPlacement(sample)
  if (!box) return { variants, picture: null }
  const result = await providers.image.extend({
    image: { bytes: source.bytes, mime: source.mime },
    placement: { ...box, rotation: 0, crop: null },
    width: size.width,
    height: size.height,
    prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
  })
  const picture = pictureOf(result)
  studio.addPicture(fillAsset(size.label), picture)
  const filled = variants.map((variant) =>
    variant.size.label === size.label ? withFill(variant) : variant,
  )
  return { variants: filled, picture }
}
