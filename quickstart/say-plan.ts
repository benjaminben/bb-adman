// The plan as the quickstart prints it before the run: what is made, in which ad sets, with
// which brand and layout, and which AI calls the run will make. Files are named by their last
// part only.
import { pictureName } from '@/shared/brief/picture-name'
import type { AdSet } from './ad-sets'
import type { Args } from './args'
import type { Brand } from './brief-files'
import type { Plan } from './plan'
import type { Providers } from './providers'

const fontLine = (role: string, text: string | undefined, kept: boolean) =>
  text === undefined ? [] : [`${role} ${pictureName(text)}${kept ? '' : ' (left out)'}`]

function brandLines(plan: Plan, brand: Brand): string[] {
  const textOf = (role: string) => plan.brandFiles.find((f) => f.role === role)?.text
  const fonts = [
    ...fontLine('headline', textOf('headingFont'), brand.heading !== null),
    ...fontLine('text', textOf('bodyFont'), brand.body !== null),
  ]
  const { colours, artDirection } = plan.look
  return [
    `Layout     ${plan.layout.id} (${plan.layout.name})`,
    `Colours    ${colours.length > 0 ? colours.join(', ') : "the layout's own"}`,
    `Fonts      ${fonts.length > 0 ? fonts.join(', ') : 'the default font'}`,
    `Logo       ${brand.logo ? pictureName(textOf('logo') ?? '') : 'none'}`,
    `Art        ${artDirection ?? 'none'}`,
  ]
}

const counted = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

// photos: the number of photos each set sends, in set order.
export function adSetLines(sets: AdSet[], photos: number[]): string[] {
  const [only] = sets
  if (sets.length === 1 && only) {
    const names = only.plan.subjects.map((s) => s.name).join(', ')
    return [`Ad sets    1, for the campaign: ${names} (${counted(photos[0] ?? 0, 'photo')})`]
  }
  const width = Math.max(...sets.map((set) => (set.name ?? '').length))
  return [
    `Ad sets    ${sets.length}, one per subject:`,
    ...sets.map((set, at) => {
      const count = photos[at] ?? 0
      const what =
        count > 0 ? counted(count, 'photo') : 'no photo: the picture is made from words alone'
      return `  ${(set.name ?? '').padEnd(width + 3)}${what}`
    }),
  ]
}

// sets: the number of ad sets; each makes its own calls.
export function callsLine(plan: Plan, sets: number, aiLayout: boolean): string {
  const fills = plan.fills.length * sets
  const translations = plan.translate.length * sets
  const calls = [
    counted(sets, 'picture'),
    ...(aiLayout ? [counted(sets, 'text placement')] : []),
    ...(fills > 0 ? [counted(fills, 'picture extend')] : []),
    ...(translations > 0
      ? [`${counted(translations, 'translation')} (${plan.translate.join(', ')})`]
      : []),
  ]
  return `AI calls: ${calls.join(', ')}`
}

export function planLines(
  plan: Plan,
  sets: AdSet[],
  args: Args,
  providers: Providers,
  brand: Brand,
  photos: number[],
): string[] {
  const { brief, languages, sizes } = plan
  const { image, text } = providers.models
  const perSet = languages.length * sizes.length
  return [
    `Campaign   ${brief.campaignName} (${brief.region})`,
    ...adSetLines(sets, photos),
    `Provider   ${args.provider}: pictures ${image}, text ${text}`,
    `Languages  ${languages.join(', ')}`,
    `Sizes      ${sizes.map((s) => `${s.label} (${s.width}x${s.height})`).join(', ')}`,
    ...brandLines(plan, brand),
    '',
    `${perSet * sets.length} ads to make${sets.length > 1 ? `, ${perSet} per set` : ''}:`,
    ...languages.map(
      (language) => `  ${language.padEnd(8)}${sizes.map((s) => s.label).join('  ')}`,
    ),
    '',
    callsLine(plan, sets.length, args.aiLayout),
    args.aiLayout
      ? 'Text placement: one AI call per set moves the text to suit the picture.'
      : "Text placement: the layout's own boxes for each size and its words (add --ai_layout for an AI call).",
    '',
  ]
}
