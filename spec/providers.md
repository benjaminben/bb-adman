# Providers

The outside services the app calls: the provider registry, the provider interfaces, error kinds and plain messages, the rules every adapter follows. The Gemini, fal.ai Seedance and Adobe Firefly adapters are in `spec/providers-adapters.md`. Read with `spec/jobs.md` (how a job calls an adapter), `spec/cancel.md` (cancel for every provider) and, for ComfyUI, `spec/comfyui.md`. Storage adapters are in `spec/storage-and-publish.md`.

## Provider registry

Built. `src/main/providers/registry.ts` (the list), `src/shared/schemas/queries/app.ts` (the types).

`registry.ts` is the one owner of provider IDs and default model IDs. `ProviderInfo` and `ProviderError` live in `src/shared/schemas/queries/app.ts`, because the window reads the provider list and `JobRow.errorKind` uses the kinds.

```ts
// src/shared/schemas/queries/app.ts
export type ProviderJob = 'image' | 'layout' | 'text' | 'video' | 'storage' | 'verification'
export type ProviderInfo = {
  id: string                       // e.g. "gemini"
  label: string                    // e.g. "Google Gemini"
  jobs: ProviderJob[]
  available: boolean               // false shows "Not yet available" and disables the choice
  secrets: SecretName[]            // secret names it needs
  defaultModels: Record<string, string>
  local: boolean                   // local runs are never counted in paid_calls
  cancel: ProviderCancel           // how a started run can be stopped (spec/cancel.md)
  serverText: boolean              // the server's own words may be shown on request (ComfyUI only)
}
export type ProviderCancel = 'stops' | 'may_finish' | 'none'

export const PROVIDER_ERROR_KINDS = ['bad_key', 'quota', 'refused', 'timeout', 'offline', 'other'] as const
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number]

export const PROVIDER_ERROR_REASONS = [
  'address_needed', 'no_answer', 'not_comfyui', 'sign_in_needed', 'redirect_refused',
  'certificate', 'address_refused', 'missing_items', 'server_refused', 'out_of_memory',
  'run_failed', 'server_stopped', 'lost_contact', 'too_long', 'address_changed',
  'bad_result', 'clip_has_sound',
] as const
export type ProviderErrorReason = (typeof PROVIDER_ERROR_REASONS)[number]

export type MissingItem = { what: 'model' | 'node' | 'version' | 'add_on'; name: string; folder?: string }

export type ProviderError = {
  kind: ProviderErrorKind
  reason?: ProviderErrorReason     // set by ComfyUI (spec/comfyui.md); the window picks the sentence by reason first
  detail: string                   // raw text for the log, never shown in the window
  missing?: MissingItem[]
}
```

`PROVIDER_ERROR_KINDS` is the one list of error kinds in the code. `JobRow`, `ProviderFailure` and the plain-message table all read it.

**Registered providers** [REQ: FR-067, IR-002]. Every row not marked otherwise has `local: false`, `cancel: 'none'`, `serverText: false`.

| ID | Label | Jobs | Available | Secrets | Default models | Other fields | Where |
|----|-------|------|-----------|---------|----------------|--------------|-------|
| `gemini` | Google Gemini | image, layout, text | Yes | `gemini.apiKey` | image `gemini-nano-banana-2.1`, layout `gemini-2.5-flash`, text `gemini-2.5-flash` | | `spec/providers-adapters.md` |
| `fal-seedance` | fal.ai Seedance | video | No, until its adapter is built | `fal.apiKey` | video `bytedance/seedance-2.0/image-to-video` | `cancel: 'may_finish'` | `spec/providers-adapters.md` |
| `comfyui` | ComfyUI | image, video | Yes | none | none | `local: true`, `cancel: 'stops'`, `serverText: true` | `spec/comfyui.md` |
| `firefly` | Adobe Firefly | image | No | `firefly.clientId`, `firefly.clientSecret` | none | | `spec/providers-adapters.md` |
| `s3` | Amazon S3 | storage | Yes | `s3.accessKeyId`, `s3.secretAccessKey` | none | | `spec/storage-and-publish.md` |
| `dropbox` | Dropbox | storage | Yes | `dropbox.refreshToken` | none | | `spec/storage-and-publish.md` |
| `azure-blob` | Azure Blob Storage | storage | No | none | none | | `spec/storage-and-publish.md` |
| `jev` | Jev | verification | No | none | none | | `spec/export-and-checks.md` |
| `fake` | Fake provider | all six | Only when `ADMAN_FAKE_PROVIDERS=1` | none | none | `local: true`, `cancel: 'stops'` | `spec/jobs.md` |

- The code lists them in the table's order; `listProviders(env)` adds `fake` at the end only when `ADMAN_FAKE_PROVIDERS=1`.
- `available` is a build fact: true only when the build has an adapter for a listed job. ComfyUI is offered for a job only when a shipped workflow for it is offered (`spec/comfyui.md`).
- `DEFAULT_PROVIDERS = { image: 'gemini', layout: 'gemini', text: 'gemini', video: 'comfyui' }`. ComfyUI is the default video provider because it is the only video provider with an adapter. A saved `settings.json` that names `fal-seedance` as the video default is not rewritten; the window shows it selected and disabled (`spec/screens.md`).
- The model IDs live only in `defaultModels` in `registry.ts`. An adapter gets its model from `ctx.model(job)` and holds no model ID of its own. No other file under `src/` names a model ID; tests use made-up IDs.

## Error kinds and plain messages

Built. `src/shared/providers/messages.ts` (re-exported by `src/main/providers/messages.ts`).

**Plain messages** [REQ: FR-069]. One sentence per error kind, naming the provider by its registry label, shown with a Retry button. This file is the one copy of the table in the code. The raw provider text never reaches the window.

| Kind | Message |
|------|---------|
| `bad_key` | "{Provider} did not accept your key. Check it in Settings and try again." |
| `quota` | "Your {Provider} account has reached its limit. Check your plan with {Provider}, then try again." |
| `refused` | "{Provider} declined this request because of its content rules. Change the prompt or the images and try again." |
| `timeout` | "{Provider} took too long to answer. Try again." |
| `offline` | "The app could not reach {Provider}. Check your internet connection and try again." |
| `other` | "{Provider} could not finish this request. Try again." |

- `plainMessage(kind, providerLabel)` gives the kind sentence. When a `ProviderError` has a `reason`, the window shows `reasonMessage(reason)` instead; those sentences are ComfyUI's (`spec/comfyui.md`).
- **A missing key.** Before any provider call, `requireProviderKeys(deps, providerId, purpose)` (`src/main/providers/require-keys.ts`) checks every secret in the provider's `secrets`. A missing one gives `NEEDS_KEY` with the message "Add your {label} key to {purpose}." and `details = { provider }`, for example "Add your Google Gemini key…". No other code decides that a key is missing [REQ: FR-171].

**Retry rule.** A provider call is never repeated automatically after it was sent, because a repeat may be charged twice. Retry is always the user's action. The one exception is checking on a video run that has already started (polling).

## Provider interfaces

Built as a contract file: `src/main/providers/types.ts`. Which methods each adapter has built is under each provider below.

[REQ: FR-066, IR-001]

```ts
// src/main/providers/types.ts
import type { Brief } from '../../shared/schemas/brief'
import type { Geometry } from '../../shared/schemas/layer'
import type { Settings } from '../../shared/schemas/settings'
import type { ProviderError } from '../../shared/schemas/queries/app'

// File contents, never a path.
export type ImageFile = { bytes: Uint8Array; mime: string }

export type LayoutBox = {
  slot: string; x: number; y: number; width: number; height: number
  fontSize: number; color: string; align: 'left' | 'center' | 'right'
}

// PNG or JPEG, as the provider sent it; the app turns every picture into a PNG before storing it.
export type ImageResult = {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
  model: string
  details?: ImageDetails           // more embedded details, from the app's own data (ComfyUI's workflow file)
}
export type ImageDetails = { models: string[]; workflow: { id: string; version: number } }

// How far along a run is, and the options every run takes (spec/cancel.md).
export type RunProgress = { stage: 'waiting' | 'working'; queuePosition?: number; fraction?: number }
export type RunOptions = { signal?: AbortSignal; onProgress?: (p: RunProgress) => void }
export type CancelOutcome = 'stopped' | 'finished' | 'unknown'

// Thrown by generate or extend: the signal fired and the provider stopped or never started the work.
export class ProviderCancelled extends Error { /* message 'The run was cancelled.' */ }

export interface ImageProvider {
  generate(
    input: { prompt: string; references: ImageFile[]; width: number; height: number; count: number },
    opts?: RunOptions,
  ): Promise<ImageResult[]>
  extend(
    input: { image: ImageFile; placement: Geometry; width: number; height: number; prompt: string },
    opts?: RunOptions,
  ): Promise<ImageResult>
}

export interface LayoutProvider {
  propose(input: {
    background: ImageFile; width: number; height: number
    items: Array<{ slot: string; text: string }>; palette: string[]; fonts: string[]
  }): Promise<LayoutBox[]>
}

export interface TextProvider {
  extractBrief(input: { text: string }): Promise<Brief>
  copyOptions(input: { slot: string; brief: Brief; language: string; count: number }): Promise<string[]>
  translate(input: {
    items: Array<{ key: string; text: string }>; from: string; to: string; region: string; audience: string
  }): Promise<Array<{ key: string; text: string }>>
}

// The caller never fetches an address a provider returned: fetchResult hands back the bytes.
export type VideoResult = { bytes: Uint8Array; mime: 'video/mp4'; model: string }

// The two facts a video run is picked by (spec/comfyui.md).
export type VideoStart = { firstFrame: boolean; references: boolean }

export interface VideoProvider {
  // The size the run is made at, which a first frame is fitted to before start.
  // A provider without it makes the run at the variant's own size.
  runSize?(width: number, height: number, videoStart: VideoStart): { width: number; height: number }
  // `image` is the first frame or null. A signal that fires before submission stops start
  // with ProviderCancelled, with no more pictures uploaded.
  start(
    input: {
      image: ImageFile | null; references: ImageFile[]; prompt: string
      durationMs: number; width: number; height: number
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

// Paths are relative, use '/', never start with '/' and never hold '..'.
export interface StorageProvider {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<Uint8Array>
  write(path: string, data: ReadableStream | Uint8Array, contentType: string): Promise<void>
  list(prefix: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}

export interface VerificationProvider {
  checkImageColours(input: { image: ImageFile; palette: string[] }): Promise<{ pass: boolean; note: string }>
}

export type AdapterContext = {
  secret(name: string): string     // a saved secret; the key guard has already passed
  settings(): Settings             // read at call time, e.g. the S3 bucket
  model(job: string): string       // the default model ID from the registry
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

// The only thing an adapter throws for a provider failure. Message: `Provider failure: ${kind}`.
export class ProviderFailure extends Error { readonly error: ProviderError }
```

- `StorageProvider` paths: each adapter joins them to its own root (the S3 prefix, the Dropbox root folder, a local folder) and refuses a path that would leave the root. `list(prefix)` returns relative paths of files, every level below the prefix. Local storage implements the same interface and is reached with `localStorageAt(root)`, not through `adapterFor`, so export and publish share the path code [REQ: 9.1 preference] (`spec/storage-and-publish.md`).
## How an adapter is reached

Built. `src/main/providers/adapters.ts`.

- Each provider has one folder under `src/main/providers/` whose `index.ts` exports `adapters: ProviderAdapters`. Folders today: `gemini/`, `fal-seedance/`, `comfyui/`, `fake/`, `local-storage/`, `s3/`, `dropbox/`, `azure-blob/`. A provider with no built adapter exports `{}`. `firefly/` and `jev/` are added when built and stay out of `adapters.ts` until then.
- `adapters.ts` joins the folders by provider ID and exports `adapterFor(deps, providerId, job)`. It returns the built interface for that job, or throws `AppError('INVALID_INPUT', 'That provider cannot do this yet.', { provider, job })` when the provider is not in `deps.providers`, does not list the job, or has no adapter for it. `adapterFrom(table, deps, providerId, job)` does the same over a given table, for tests.
- Every provider, `fake` included, must be in `deps.providers` and list the job. So `fake` is reachable only when `ADMAN_FAKE_PROVIDERS=1`.
- A code path that uses a provider calls `adapterFor` and imports no adapter folder.
- `ctx.secret` throws when the secret is not saved; `ctx.model` throws when the registry has no default model for that job.

## Rules for every adapter

Built for Gemini, ComfyUI and S3. Each later adapter follows them, and its review checks them. Security class.

**Keys.** An adapter gets its keys only through `ctx.secret`. It never logs a key, never puts one in an error, and never returns one. It reads no file and builds no path: the caller hands it bytes and gets bytes back.

**Nothing from the environment.** A provider library takes nothing from the environment.
- The adapter hands the library every setting it needs: the key, the address, the mode, the region, the API version. It leaves none to the library's defaults where the library would fill one from an environment variable or from a file in the user's home folder.
- Each adapter names the one host (or host pattern) its requests may go to, as a constant in its own folder, and sends every request through a `fetch` wrapper that refuses any other origin before anything is sent. A refused request is a `ProviderFailure` of kind `other`. Where a library cannot take a `fetch`, the adapter pins the address through the library's own option and says so in a comment.
- Each adapter has one test that sets the library's known environment variables to other values and shows the request still goes to the pinned host, in the pinned mode.
- One exception: ComfyUI. Its host is typed by the user, not fixed in the code [D-050]. Every other part of this rule holds for it (one origin per run, every request confined to it, nothing from the environment, one test). What takes the place of the fixed constant is in `spec/comfyui.md`. No other adapter may take its host from a setting.

**Failures.**
- Every error an adapter lets out is a `ProviderFailure`, including one from reading the secret, reading the model ID or building the library's client. Those are kind `other`.
- `offline` means the request could not be sent or the connection broke. The `fetch` wrapper marks an error thrown by the network call itself or by reading the answer body, and only a marked error is `offline`. A `TypeError` from anywhere else, or an error while the finished answer is built, is `other`.
- The wrapper reads the whole answer body inside its marked step and hands the library a finished answer, so a break during the read is marked like a break during the send. This holds for every adapter whose library lets the adapter see the read. These calls do not stream.
- One function removes a secret from text: `redactSecret(text, secret)` in `src/main/providers/redact.ts`. It replaces the secret as given, its `encodeURIComponent` form and its base64 form with `[key removed]`, and returns the text unchanged for an empty secret. Every adapter passes every `detail` through it for each secret it read. No adapter has its own version.
- An adapter does not repeat a call (the retry rule) and does not write the `job` table. It maps every failure to one `ProviderFailure` with an error kind.

**An answer read whole has a size limit.** This holds for every adapter that asks a provider to make something.
- The `fetch` wrapper stops reading at `MAX_PROVIDER_ANSWER_BYTES` and fails with a `ProviderFailure` of kind `other`, detail "Answer too large". It is never `offline`: the network did not fail.
- It refuses at once, reading nothing, when the `content-length` header is over the limit. With no header, or a smaller one, it counts the bytes as it reads and cancels the read once the count passes the limit. The count is of the bytes handed to the app, so a compressed answer cannot get past it. An answer exactly at the limit comes through.
- The wrapper takes the limit as a default parameter, so a test can hand in a small one.
- An answer object with no `body` stream (a test stand-in that has only `arrayBuffer()`) is read whole and its size checked after. A real answer always has a stream or no body at all, so the counted read is what runs in the app.
- Not covered: storage `read`, which returns a whole file on purpose (`spec/storage-and-publish.md`). A video file has its own limits (next section).

### Size limits and what a returned picture or clip goes through

Built. `src/main/providers/picture-limits.ts` is the one owner of the values; they change only by a ruling.

| Constant | Value | Checked by |
|----------|-------|------------|
| `MAX_PROVIDER_ANSWER_BYTES` | 48 MiB (50,331,648) | the adapter's `fetch` wrapper |
| `MAX_PICTURE_BYTES` | 32 MiB (33,554,432) | `toPng`, before decoding |
| `MAX_PICTURE_SIDE` | 8,192 pixels, each of width and height | `toPng`, before decoding |
| `MAX_PICTURE_PIXELS` | 24,000,000 (width × height) | `toPng`, before decoding |
| `MAX_VIDEO_BYTES` | 128 MiB | the video download, then `checkMp4` (ComfyUI and fal) |
| `MAX_VIDEO_SIDE` | 4,096 pixels | `checkMp4` |
| `MAX_VIDEO_MS` | 120,000 ms | `checkMp4` |

- Why these values: 24 million pixels decode to 96 MB, which the app can hold twice (pictures run two at a time). A 32 MiB picture is about 43 MiB as base64, so it fits in a 48 MiB answer.
- **Picture type.** Read from the bytes, not the provider's claim, by one shared function `pictureType(bytes)` (`src/main/providers/picture-type.ts`): PNG signature `image/png`, JPEG signature (`FF D8 FF`) `image/jpeg`. Anything else is a `ProviderFailure` of kind `other` naming the claimed type.
- **Pixel size from the header.** `pictureSize(bytes, mime)` in `src/main/providers/picture-size.ts` gives `{ width, height }` from the PNG header or the JPEG frame header, and throws a plain `Error` ("The picture is not a PNG", "The picture is not a JPEG"). `src/main/providers/png-size.ts` is the PNG-only reader. There is one such function in `src/`.
- **Every picture becomes a PNG before it is stored.** Every generated picture in a project is a PNG file, so the embedded details (`spec/export-and-checks.md`, 'Embedded generation details'), the asset code, export and reports have one path. The adapter returns the picture as it came; it imports no Electron. `createCore` takes the option `toPng(bytes: Uint8Array): Uint8Array` (`CoreDeps.toPng`). The logic is in `src/main/png-converter.ts` (`pngConverter(decode)`, no Electron, unit tested); `src/main/index.ts` passes it `nativeImage.createFromBuffer`. The default when the option is left out throws. Tests hand in a stand-in.
- **What `toPng` does**, in order. Each refusal is a plain `Error` with a fixed message that holds no bytes, no size and no path.
  1. More than `MAX_PICTURE_BYTES`: refused.
  2. `pictureType(bytes)` is not PNG or JPEG: refused. The decoder is never given another type.
  3. `pictureSize(bytes, mime)` with the type from step 2, inside a `try`: a throw, a side of 0 or over `MAX_PICTURE_SIDE`, or width × height over `MAX_PICTURE_PIXELS` is refused with the converter's own fixed message.
  4. Decode. An empty image is refused.
  5. Encode as PNG. A result of zero bytes is refused.
- The job kind calls `deps.toPng` for every picture, a PNG too, and stores what comes back. A `toPng` refusal or throw counts as a failed call of kind `other` for that picture, and the paid call is still counted. The job's log detail is the fixed message.
- Cost of re-encoding a PNG: ordinary 8-bit pixels come out the same; a 16-bit PNG becomes 8-bit, a colour profile is dropped, and partly see-through pixels can change by a rounding step. If a cut-out service is added (OI-29, OI-55), this point returns to the architect with it.
- The fake provider's picture must be a real PNG that decodes.
- **Accepted, not fixed.** The decode and encode block the main process (up to a second or two at the limit), and a fault in Electron's decoder would stop the app. Accepted for pictures from a pinned HTTPS host; a less trusted host sends this back to the architect.
- **A video file** is read under `MAX_VIDEO_BYTES` and must pass `checkMp4` (`src/main/providers/video-check.ts`) before it is stored. It is stored as the provider returned it, sound included; `checkMp4` reports `hasSound`, and a sound track is not a fault. The full video file rules are in `spec/comfyui.md`.

### Open: cut-outs (OI-29)

Nothing above is closed against a cut-out service (Q-032, OI-29: open sub-questions on the "no text" prompt ending and a per-direction style note). It would be one more interface and one more key in `ProviderAdapters`, a new value in `ProviderInfo.jobs` and a new job kind (one migration). `ImageResult` can carry a PNG with transparency. `ImageProvider` would not change.

## The adapters

Gemini, fal.ai Seedance and the Adobe Firefly stub are in `spec/providers-adapters.md`. ComfyUI is in `spec/comfyui.md`.

