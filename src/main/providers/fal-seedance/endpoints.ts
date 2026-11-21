// phase-07 "Endpoints by start" (A-172) and "Pictures as data addresses" (A-171): which fal
// endpoint a start goes to and the exact JSON body. Pictures go only in this body.
import { ProviderFailure, type ImageFile, type VideoProvider } from '@/main/providers/types'

export const FAL_APP = 'bytedance/seedance-2.0'

export const ENDPOINTS = {
  prompt: `${FAL_APP}/text-to-video`,
  image: `${FAL_APP}/image-to-video`,
  reference: `${FAL_APP}/reference-to-video`,
} as const

export const MAX_REFERENCES = 9
const MIN_SECONDS = 4
const MAX_SECONDS = 15
const PICTURE_TYPES = new Set(['image/png', 'image/jpeg'])

const RATIOS = [
  ['21:9', 21 / 9],
  ['16:9', 16 / 9],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['9:16', 9 / 16],
] as const

export type FalRatio = (typeof RATIOS)[number][0]

const refuse = (detail: string): never => {
  throw new ProviderFailure({ kind: 'other', detail })
}

// The listed ratio closest to width:height on a log scale. The list runs wide to narrow, so
// on a tie the first (the wider) is kept.
export function nearestRatio(width: number, height: number): FalRatio {
  const target = Math.log(width / height)
  let best: FalRatio = '1:1'
  let bestDistance = Infinity
  for (const [ratio, value] of RATIOS) {
    const distance = Math.abs(Math.log(value) - target)
    if (distance < bestDistance - 1e-9) {
      best = ratio
      bestDistance = distance
    }
  }
  return best
}

// Whole seconds, 4 to 15, as a string. The offer table keeps starts to these; anything else
// is refused before anything is sent.
export function durationText(durationMs: number): string {
  const seconds = durationMs / 1000
  if (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    refuse(`fal.ai takes ${MIN_SECONDS} to ${MAX_SECONDS} whole seconds`)
  }
  return String(seconds)
}

// The app's <Picture n> names, as fal's reference endpoint names them.
export function falPrompt(prompt: string): string {
  return prompt.replace(/<Picture (\d+)>/g, '@Image$1')
}

function dataAddress(file: ImageFile): string {
  if (!PICTURE_TYPES.has(file.mime)) refuse('fal.ai is sent PNG or JPEG pictures only')
  return `data:${file.mime};base64,${Buffer.from(file.bytes).toString('base64')}`
}

export type StartInput = Parameters<VideoProvider['start']>[0]

export function submitFor(input: StartInput): { endpoint: string; body: Record<string, unknown> } {
  const { image, references } = input
  if (image && references.length > 0) refuse('fal.ai takes a first frame or references, not both')
  if (references.length > MAX_REFERENCES) refuse(`fal.ai takes at most ${MAX_REFERENCES} pictures`)
  const common = {
    resolution: '720p',
    duration: durationText(input.durationMs),
    aspect_ratio: nearestRatio(input.width, input.height),
    generate_audio: true,
  }
  if (image) {
    const body = { prompt: input.prompt, ...common, image_url: dataAddress(image) }
    return { endpoint: ENDPOINTS.image, body }
  }
  if (references.length > 0) {
    const image_urls = references.map(dataAddress)
    const body = { prompt: falPrompt(input.prompt), ...common, image_urls }
    return { endpoint: ENDPOINTS.reference, body }
  }
  return { endpoint: ENDPOINTS.prompt, body: { prompt: input.prompt, ...common } }
}
