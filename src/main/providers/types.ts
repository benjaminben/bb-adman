// SPEC 6 provider interfaces and the adapter contract. Frozen contract (Phase 2 step 0).
import type { Brief, BriefDraft } from '@/shared/schemas/brief'
import type { Geometry } from '@/shared/schemas/layer'
import type { Settings } from '@/shared/schemas/settings'
import type { ProviderError } from '@/shared/schemas/queries/app'

export type { ProviderError }

// File contents, never a path.
export type ImageFile = { bytes: Uint8Array; mime: string }

export type LayoutBox = {
  slot: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
}

// PNG or JPEG, as the provider sent it; the app turns a JPEG into a PNG (SPEC 6.2 [1.18]).
export type ImageResult = {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
  model: string
  // [1.53] G-1: more SPEC 6.6 details, from the app's own data (ComfyUI's workflow file).
  details?: ImageDetails
}
export type ImageDetails = { models: string[]; workflow: { id: string; version: number } }

// [1.24] SPEC 6.11.1: how far along a run is, and the options every run takes.
export type RunProgress = {
  stage: 'waiting' | 'working'
  queuePosition?: number
  fraction?: number
}
export type RunOptions = { signal?: AbortSignal; onProgress?: (p: RunProgress) => void }
export type CancelOutcome = 'stopped' | 'finished' | 'unknown'

// Thrown by generate or extend: the signal fired and the provider stopped or never started
// the work.
export class ProviderCancelled extends Error {
  constructor(message = 'The run was cancelled.') {
    super(message)
    this.name = 'ProviderCancelled'
  }
}

export interface ImageProvider {
  generate(
    input: {
      prompt: string
      references: ImageFile[]
      width: number
      height: number
      count: number
    },
    opts?: RunOptions,
  ): Promise<ImageResult[]>
  extend(
    input: {
      image: ImageFile
      placement: Geometry
      width: number
      height: number
      prompt: string
    },
    opts?: RunOptions,
  ): Promise<ImageResult>
}

// spec/ai-jobs.md "Provider interfaces" (P4-1). The boxes come back in the variant's pixels.
export interface LayoutProvider {
  propose(
    input: {
      background: ImageFile
      width: number
      height: number
      items: Array<{ slot: string; text: string }>
      palette: string[]
      fonts: string[]
    },
    opts?: RunOptions,
  ): Promise<LayoutBox[]>
}

export type CopyRole = 'call_to_action' | 'text'

// extractBrief gives a BriefDraft: the user confirms the form before anything is a brief
// [REQ: FR-023].
export interface TextProvider {
  extractBrief(input: { text: string }, opts?: RunOptions): Promise<BriefDraft>
  copyOptions(
    input: { role: CopyRole; brief: Brief; language: string; count: number; maxChars: number },
    opts?: RunOptions,
  ): Promise<string[]>
  translate(
    input: {
      items: Array<{ key: string; text: string }>
      from: string
      to: string
      region: string
      audience: string
    },
    opts?: RunOptions,
  ): Promise<Array<{ key: string; text: string }>>
}

// A picture in, the same picture with a see-through background out (PNG with alpha).
export interface CutoutProvider {
  cutOut(input: { image: ImageFile }, opts?: RunOptions): Promise<ImageResult>
}

// [1.24] SPEC 6.11.1. `image` is the first frame or null. fetchResult replaces videoUrl: the
// caller never fetches an address a provider returned.
export type VideoResult = { bytes: Uint8Array; mime: 'video/mp4'; model: string }

// SPEC 6.10.7: the two facts a video run's workflow is picked by.
export type VideoStart = { firstFrame: boolean; references: boolean }

export interface VideoProvider {
  // [1.60] N-6: the size the run is made at, which a first frame is fitted to before start.
  // A provider without it makes the run at the variant's own size.
  runSize?(width: number, height: number, videoStart: VideoStart): { width: number; height: number }
  // [1.60] N-7: a signal that fires before submission stops start with ProviderCancelled,
  // with no more pictures uploaded.
  start(
    input: {
      image: ImageFile | null
      references: ImageFile[]
      prompt: string
      durationMs: number
      width: number
      height: number
    },
    opts?: Pick<RunOptions, 'signal'>,
  ): Promise<{ remoteJobId: string }>
  check(remoteJobId: string): Promise<{
    status: 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled'
    queuePosition?: number
    progress?: number
    error?: ProviderError
  }>
  fetchResult(remoteJobId: string): Promise<VideoResult>
  cancel(remoteJobId: string): Promise<CancelOutcome>
}

// Paths are relative, use '/', never start with '/' and never hold '..' (SPEC 6).
export interface StorageProvider {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<Uint8Array>
  write(path: string, data: ReadableStream | Uint8Array, contentType: string): Promise<void>
  list(prefix: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}

export interface VerificationProvider {
  checkImageColours(input: {
    image: ImageFile
    palette: string[]
  }): Promise<{ pass: boolean; note: string }>
}

export type AdapterContext = {
  secret(name: string): string // a saved secret; the key guard has already passed
  settings(): Settings // read at call time
  model(job: string): string // the default model ID from the registry
}

// What one provider folder exports from its index.ts.
export type ProviderAdapters = {
  image?: (ctx: AdapterContext) => ImageProvider
  layout?: (ctx: AdapterContext) => LayoutProvider
  text?: (ctx: AdapterContext) => TextProvider
  video?: (ctx: AdapterContext) => VideoProvider
  cutout?: (ctx: AdapterContext) => CutoutProvider
  storage?: (ctx: AdapterContext) => StorageProvider
  verification?: (ctx: AdapterContext) => VerificationProvider
}

export type AdapterJob = keyof ProviderAdapters

// The only thing an adapter throws for a provider failure.
export class ProviderFailure extends Error {
  readonly error: ProviderError

  constructor(error: ProviderError) {
    super(`Provider failure: ${error.kind}`)
    this.name = 'ProviderFailure'
    this.error = error
  }
}
