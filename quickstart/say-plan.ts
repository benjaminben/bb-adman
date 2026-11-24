// The plan as the quickstart prints it before the run: what is made, with which brand and
// layout, and which AI calls the run will make. Files are named by their last part only.
import { pictureName } from '@/shared/brief/picture-name'
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

function callsLine(plan: Plan, aiLayout: boolean): string {
  const calls = [
    '1 picture',
    ...(aiLayout ? ['1 text placement'] : []),
    ...(plan.fills.length > 0 ? [`${plan.fills.length} picture extends`] : []),
    ...(plan.translate.length > 0 ? [`translation to ${plan.translate.join(', ')}`] : []),
  ]
  return `AI calls: ${calls.join(', ')}`
}

export function planLines(
  plan: Plan,
  args: Args,
  providers: Providers,
  brand: Brand,
  photos: number,
): string[] {
  const { brief, languages, sizes } = plan
  const { image, text } = providers.models
  return [
    `Campaign   ${brief.campaignName} (${brief.region})`,
    `Subjects   ${plan.subjects.map((s) => s.name).join(', ')} (${photos} photos)`,
    `Provider   ${args.provider}: pictures ${image}, text ${text}`,
    `Languages  ${languages.join(', ')}`,
    `Sizes      ${sizes.map((s) => `${s.label} (${s.width}x${s.height})`).join(', ')}`,
    ...brandLines(plan, brand),
    '',
    `${languages.length * sizes.length} ads to make:`,
    ...languages.map(
      (language) => `  ${language.padEnd(8)}${sizes.map((s) => s.label).join('  ')}`,
    ),
    '',
    callsLine(plan, args.aiLayout),
    args.aiLayout
      ? 'Text placement: one AI call moves the text to suit the picture.'
      : "Text placement: the layout's own boxes, with no AI call (add --ai_layout for one).",
    '',
  ]
}
