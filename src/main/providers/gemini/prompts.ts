// spec/providers-adapters.md "Layout and text": the fixed instruction texts. Values from the
// project are written as JSON so each one is plainly quoted. Nothing else about the project
// is sent (spec/ai-jobs.md "Security notes").
import type { Brief } from '@/shared/schemas/brief'
import type { CopyRole } from '@/main/providers/types'

export type LayoutPromptInput = {
  width: number
  height: number
  items: Array<{ slot: string; text: string }>
  palette: string[]
  fonts: string[]
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
