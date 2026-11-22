// The starts and clip lengths each video provider offers (phase-07.md "fal.ai Seedance",
// A-175). One table, read by the "Make a video" card and by generation.startVideo and
// job.retry, which refuse a run outside it. ComfyUI has no row: its workflows decide.
export const VIDEO_START_KINDS = ['prompt', 'first_frame', 'reference', 'background'] as const
export type VideoStartKind = (typeof VIDEO_START_KINDS)[number]

export type VideoOffer = {
  starts: readonly VideoStartKind[]
  minMs: number
  maxMs: number
  stepMs: number
  maxReferences: number
}

const OFFERS = new Map<string, VideoOffer>([
  [
    'fal-seedance',
    { starts: VIDEO_START_KINDS, minMs: 4_000, maxMs: 15_000, stepMs: 1_000, maxReferences: 9 },
  ],
  [
    'fake',
    { starts: VIDEO_START_KINDS, minMs: 1_000, maxMs: 120_000, stepMs: 1_000, maxReferences: 4 },
  ],
])

export function videoOffer(providerId: string): VideoOffer | null {
  return OFFERS.get(providerId) ?? null
}

type StartFields = { start: 'none' | 'first_frame' | 'background'; useReferences: boolean }

// The start kind of generation.startVideo's start fields; null for a picture start that also
// asks for references, which no provider offers.
export function startKindOf(fields: StartFields): VideoStartKind | null {
  if (fields.start === 'none') return fields.useReferences ? 'reference' : 'prompt'
  return fields.useReferences ? null : fields.start
}
