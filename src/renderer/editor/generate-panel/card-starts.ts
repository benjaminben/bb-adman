// P7-22: the starts, lengths and picture count the "Make a video" card offers. A provider with
// an offer in video-offers.ts (A-175) gets its starts, with "The post's background" new, its
// length bounds and its reference count. ComfyUI has no offer and keeps its built rules
// (video-start.ts): its starts and each start's most from comfy.getInfo, one picture.
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { videoOffer, type VideoStartKind } from '@/shared/config/video-offers'
import { STARTS, maxMsFor, offeredStarts } from '@/renderer/screens/campaign/video-start'
import { START_SECONDS } from './video-length'

// A card start is named by its start kind.
export type CardStartId = VideoStartKind
type CardStart = { id: CardStartId; label: string }

const BACKGROUND: CardStart = { id: 'background', label: "The post's background" }
// The background comes second, after "A prompt".
const CARD_STARTS: readonly CardStart[] = [...STARTS.slice(0, 1), BACKGROUND, ...STARTS.slice(1)]

const offerOf = (providerId: string | undefined) =>
  providerId === undefined ? null : videoOffer(providerId)

export function cardStarts(info: ComfyInfo | null, providerId: string | undefined): CardStart[] {
  const offer = offerOf(providerId)
  if (offer) return CARD_STARTS.filter((s) => offer.starts.includes(s.id))
  return offeredStarts(info, providerId)
}

// The start shown: the user's choice while offered, else the background when it has a picture
// and is offered, else the prompt.
export function shownStart(
  offered: readonly CardStart[],
  chosen: CardStartId | null,
  backgroundPicture: boolean,
): CardStartId {
  const has = (id: CardStartId) => offered.some((s) => s.id === id)
  if (chosen !== null && has(chosen)) return chosen
  return backgroundPicture && has('background') ? 'background' : 'prompt'
}

export type Lengths = { min: number; max: number | null; step: number; start: number }

// Whole seconds. An offer gives its bounds and the default max(2 s, its least); ComfyUI the
// least 1 and the most of the start's workflow once comfy.getInfo has answered.
export function lengthsFor(
  info: ComfyInfo | null,
  providerId: string | undefined,
  startId: CardStartId,
): Lengths {
  const offer = offerOf(providerId)
  if (offer) {
    const min = offer.minMs / 1000
    const step = offer.stepMs / 1000
    return { min, max: offer.maxMs / 1000, step, start: Math.max(START_SECONDS, min) }
  }
  const maxMs =
    providerId === 'comfyui' && startId !== 'background' ? maxMsFor(info, startId) : null
  return {
    min: 1,
    max: maxMs === null ? null : Math.floor(maxMs / 1000),
    step: 1,
    start: START_SECONDS,
  }
}

// How many pictures the start takes: none for the prompt and the background, one first frame,
// and up to the offer's reference count (one for ComfyUI, as built).
export function picturesFor(providerId: string | undefined, startId: CardStartId): number {
  if (startId === 'prompt' || startId === 'background') return 0
  if (startId === 'first_frame') return 1
  return offerOf(providerId)?.maxReferences ?? 1
}

// The start fields of generation.startVideo for a start and its chosen pictures, as many as
// the start takes (a choice is kept, not sent, under a start that takes fewer).
export function cardStartFields(id: CardStartId, pictures: readonly string[], most: number) {
  return {
    start: id === 'first_frame' || id === 'background' ? id : ('none' as const),
    useReferences: id === 'reference',
    referenceAssetIds: pictures.slice(0, most),
  }
}
