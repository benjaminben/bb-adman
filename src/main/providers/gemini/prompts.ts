// spec/providers-adapters.md "Layout and text": the fixed instruction texts. Values from the
// project are written as JSON so each one is plainly quoted. Nothing else about the project
// is sent (spec/ai-jobs.md "Security notes").
import { chineseScript } from '@/shared/translation/script'
import type { Brief } from '@/shared/schemas/brief'
import type { CopyRole } from '@/main/providers/types'
import type { TypeStyleOffer } from '@/shared/config/type-styles'

export type LayoutPromptInput = {
  width: number
  height: number
  items: Array<{ slot: string; text: string }>
  palette: string[]
  fonts: string[]
  typeStyles?: TypeStyleOffer[]
}

// R2E-3 (spec/phases/round-2-editor.md D3): only for a project with no font of its own.
function typeStyleLines(typeStyles: TypeStyleOffer[] | undefined): string[] {
  if (!typeStyles) return []
  return [
    `This ad has no brand fonts. For each box also give typeStyle, one of: ${JSON.stringify(typeStyles)}.`,
    'Choose a heavier style for the headline and a plainer one for small text.',
  ]
}

export function layoutInstruction(input: LayoutPromptInput): string {
  return [
    'You place the text of an ad on its background picture, which follows this instruction.',
    `The canvas is ${input.width} pixels wide and ${input.height} pixels high.`,
    `The text items, each with its slot: ${JSON.stringify(input.items)}`,
    `The palette: ${JSON.stringify(input.palette)}`,
    `The fonts: ${JSON.stringify(input.fonts)}`,
    'Give one box per item, in the canvas pixels: slot, x, y, width, height, fontSize,',
    'color (#RRGGBB, from the palette when there is one) and align (left, center or right).',
    'Keep the text clear of faces and products, inside the canvas, and large enough to read.',
    'Do not draw the text: give only the boxes.',
    ...typeStyleLines(input.typeStyles),
  ].join('\n')
}

export const BRIEF_INSTRUCTION = [
  'You read an advertising campaign brief, which follows the line "Brief:".',
  'Fill only the listed fields, and only from what the brief says.',
  'Do not translate: keep every value in the language the brief uses.',
  'Leave a field out when the brief does not give it.',
].join('\n')

export const BRIEF_LINE = 'Brief:'

const ROLE_NAMES: Record<CopyRole, string> = {
  call_to_action: 'a call to action',
  text: 'a line of ad copy',
}

export type CopyPromptInput = {
  role: CopyRole
  brief: Brief
  language: string
  count: number
  maxChars: number
}

// Only the six brief fields the spec names; the rest of the brief stays on the machine.
export function copyInstruction(input: CopyPromptInput): string {
  const { brief } = input
  const context = {
    message: brief.message,
    audience: brief.audience,
    region: brief.region,
    tone: brief.tone,
    offer: brief.offer,
    callToAction: brief.callToAction,
  }
  return [
    `Write ${input.count} different options for ${ROLE_NAMES[input.role]} in an ad.`,
    `Write them in the language ${JSON.stringify(input.language)}.`,
    `Each option has at most ${input.maxChars} characters.`,
    `The campaign: ${JSON.stringify(context)}`,
  ].join('\n')
}

export const TEXTS_LINE = 'Texts:'

export type TranslatePromptInput = { from: string; to: string; region: string; audience: string }

// A tag by its English name and the tag itself, as `Japanese ("ja")`. A tag Intl cannot read
// is named by the tag alone.
function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames('en', { type: 'language' }).of(tag)
    return `${name ?? tag} (${JSON.stringify(tag)})`
  } catch {
    return JSON.stringify(tag)
  }
}

// A-158: the script by region, from the one shared rule.
function scriptLine(region: string): string {
  const script =
    chineseScript(region) === 'traditional' ? 'Traditional Chinese' : 'Simplified Chinese'
  return `Write the Chinese in ${script}.`
}

// spec/phases/phase-06.md section 3 [FR-101]: the region and audience go as quoted context.
export function translateInstruction(input: TranslatePromptInput): string {
  return [
    `You translate the texts of an ad, which follow the line "${TEXTS_LINE}" as a JSON list.`,
    `Translate from ${languageName(input.from)} to ${languageName(input.to)}.`,
    `The ad runs in the region ${JSON.stringify(input.region)}.`,
    `The audience: ${JSON.stringify(input.audience)}`,
    ...(input.to === 'zh' ? [scriptLine(input.region)] : []),
    'Write ad copy for that audience that keeps the meaning and tone of each text.',
    'Keep the line breaks. Keep brand names, product names, numbers and prices as written.',
    'Add nothing. Give every key once, with its translated text.',
  ].join('\n')
}
