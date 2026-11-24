// One ad set's steps, in the order a person takes them in the app: make the picture on the
// first size, build the master from the brief's layout and brand (and, with --ai_layout, move
// its text with one call), make one variant per language and size by the app's rule, translate
// what the brief gave no words for and fit the new words, and extend the picture to each other
// size. Every call goes through the app's own provider adapters and every answer through the
// app's own checks.
import type { ImageFile } from '@/main/providers/types'
import { prefilledPrompt, promptToSend } from '@/shared/generation/prompt'
import type { SceneVariant } from '@/shared/scene/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { Brand } from './brief-files'
import {
  BODY_FONT_ASSET,
  HEADING_FONT_ASSET,
  LOGO_ASSET,
  MASTER_ASSET,
  masterLayers,
  planVariants,
  type Variant,
} from './layers'
import { layoutOffer, placeText } from './place-text'
import type { Plan } from './plan'
import type { Providers } from './providers'
import type { CallRecord } from './report'
import { call, extend, pictureOf, translate, type Progress } from './run-steps'
import type { Picture, Studio } from './studio'

export type { Progress }

export type RunInput = {
  // The ad set's plan: its subjects only.
  plan: Plan
  providers: Providers
  studio: Studio
  // The ad set's subject photos.
  references: ImageFile[]
  brand: Brand
  prompt: string | null
  aiLayout: boolean
  progress: Progress
}

export type RunResult = {
  variants: Variant[]
  prompt: string
  // The pictures as the provider returned them: the first one, and one per extended size.
  picture: Picture
  fills: Map<string, Picture>
  calls: CallRecord[]
}

export const sceneVariant = (size: CampaignSize, language: string): SceneVariant => ({
  width: size.width,
  height: size.height,
  language,
  format: 'image',
  durationMs: 0,
})

// The steps one ad set shows: its AI calls, then drawing its ads.
export function stepCount(plan: Plan, aiLayout: boolean): number {
  return 1 + (aiLayout ? 1 : 0) + plan.translate.length + plan.fills.length + 1
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

// The logo and the fonts the brief gave, handed to the drawing page from memory.
function addBrand(studio: Studio, brand: Brand): void {
  if (brand.logo) studio.addPicture(LOGO_ASSET, brand.logo)
  if (brand.heading) studio.addFont(HEADING_FONT_ASSET, brand.heading)
  if (brand.body) studio.addFont(BODY_FONT_ASSET, brand.body)
}

const hasFont = (brand: Brand) => brand.heading !== null || brand.body !== null
const familiesOf = (brand: Brand) =>
  [brand.heading?.family, brand.body?.family].filter((name): name is string => Boolean(name))

export async function runAdSet(input: RunInput): Promise<RunResult> {
  const { plan, providers, studio, references, progress, brand } = input
  const calls: CallRecord[] = []
  const first = plan.sizes[0] as CampaignSize
  const prompt = input.prompt ?? picturePrompt(plan)
  const picture = await call(
    progress,
    calls,
    'picture',
    `Making the picture (${first.label})`,
    async () => {
      const [result] = await providers.image.generate({
        prompt: promptToSend(prompt, { pictures: references.length }),
        references,
        width: first.width,
        height: first.height,
        count: 1,
      })
      if (!result) throw new Error('The provider gave no picture.')
      return pictureOf(result)
    },
  )
  studio.addPicture(MASTER_ASSET, picture)
  addBrand(studio, brand)
  let master = masterLayers(plan, {
    logo: brand.logo !== null,
    headingFont: brand.heading !== null,
    bodyFont: brand.body !== null,
  })
  if (input.aiLayout) {
    const layers = master
    master = await call(progress, calls, 'text placement', 'Placing the text on the picture', () =>
      placeText({
        layout: providers.layout,
        studio,
        size: first,
        variant: sceneVariant(first, plan.languages[0] ?? ''),
        master: layers,
        offer: layoutOffer(plan.look.colours, familiesOf(brand), hasFont(brand)),
        onNoBoxes: () => progress.note('The answer held no usable boxes, so the layout is kept.'),
      }),
    )
  }
  let variants = planVariants(plan, master, picture)
  for (const language of plan.translate) {
    variants = await call(progress, calls, 'translation', `Translating to ${language}`, () =>
      translate(plan, providers, progress, variants, language, master),
    )
  }
  const fills = new Map<string, Picture>()
  for (const size of plan.fills) {
    const label = `Extending the picture to ${size.label}`
    const done = await call(progress, calls, 'extend', label, () =>
      extend(providers, studio, variants, size, picture),
    )
    variants = done.variants
    if (done.picture) fills.set(size.label, done.picture)
  }
  return { variants, prompt, picture, fills, calls }
}
