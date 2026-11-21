// SPEC 6 provider interfaces and the adapter contract. Frozen contract (Phase 2 step 0).
import type { Brief } from '../../shared/schemas/brief'
import type { Geometry } from '../../shared/schemas/layer'
import type { Settings } from '../../shared/schemas/settings'
import type { ProviderError } from '../../shared/schemas/queries/app'

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
export type ImageResult = { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; model: string }

export interface ImageProvider {
  generate(input: {
    prompt: string
    references: ImageFile[]
    width: number
    height: number
    count: number
  }): Promise<ImageResult[]>
  extend(input: {
    image: ImageFile
    placement: Geometry
    width: number
    height: number
    prompt: string
  }): Promise<ImageResult>
}

export interface LayoutProvider {
  propose(input: {
    background: ImageFile
    width: number
    height: number
    items: Array<{ slot: string; text: string }>
    palette: string[]
    fonts: string[]
  }): Promise<LayoutBox[]>
}

export interface TextProvider {
  extractBrief(input: { text: string }): Promise<Brief>
  copyOptions(input: {
    slot: string
    brief: Brief
    language: string
    count: number
  }): Promise<string[]>
  translate(input: {
    items: Array<{ key: string; text: string }>
    from: string
    to: string
    region: string
    audience: string
  }): Promise<Array<{ key: string; text: string }>>
}

export interface VideoProvider {
  start(input: {
    image: ImageFile
    prompt: string
    durationMs: number
    width: number
    height: number
  }): Promise<{ remoteJobId: string }>
  check(remoteJobId: string): Promise<{
    status: 'running' | 'succeeded' | 'failed'
    progress?: number
    videoUrl?: string
    error?: ProviderError
  }>
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
