# Providers

The outside services the app calls: the provider registry, the provider interfaces, error kinds and plain messages, the rules every adapter follows, and the Gemini, fal.ai Seedance and Adobe Firefly adapters. Read with `spec/jobs.md` (how a job calls an adapter), `spec/cancel.md` (cancel for every provider) and, for ComfyUI, `spec/comfyui.md`. Storage adapters are in `spec/storage-and-publish.md`.

## Provider registry (was 6)

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
| `gemini` | Google Gemini | image, layout, text | Yes | `gemini.apiKey` | image `gemini-nano-banana-2.1`, layout `gemini-2.5-flash`, text `gemini-2.5-flash` | | 'Gemini' below |
| `fal-seedance` | fal.ai Seedance | video | No, until its adapter is built | `fal.apiKey` | video `bytedance/seedance-2.0/image-to-video` | `cancel: 'may_finish'` | 'fal.ai Seedance' below |
| `comfyui` | ComfyUI | image, video | Yes | none | none | `local: true`, `cancel: 'stops'`, `serverText: true` | `spec/comfyui.md` |
| `firefly` | Adobe Firefly | image | No | `firefly.clientId`, `firefly.clientSecret` | none | | 'Adobe Firefly (stub)' below |
| `s3` | Amazon S3 | storage | Yes | `s3.accessKeyId`, `s3.secretAccessKey` | none | | `spec/storage-and-publish.md` |
| `dropbox` | Dropbox | storage | Yes | `dropbox.refreshToken` | none | | `spec/storage-and-publish.md` |
| `azure-blob` | Azure Blob Storage | storage | No | none | none | | `spec/storage-and-publish.md` |
| `jev` | Jev | verification | No | none | none | | `spec/export-and-checks.md` |
| `fake` | Fake provider | all six | Only when `ADMAN_FAKE_PROVIDERS=1` | none | none | `local: true`, `cancel: 'stops'` | `spec/jobs.md` |

- The code lists them in the table's order; `listProviders(env)` adds `fake` at the end only when `ADMAN_FAKE_PROVIDERS=1`.
- `available` is a build fact: true only when the build has an adapter for a listed job. ComfyUI is offered for a job only when a shipped workflow for it is offered (`spec/comfyui.md`).
- `DEFAULT_PROVIDERS = { image: 'gemini', layout: 'gemini', text: 'gemini', video: 'comfyui' }`. ComfyUI is the default video provider because it is the only video provider with an adapter. A saved `settings.json` that names `fal-seedance` as the video default is not rewritten; the window shows it selected and disabled (`spec/screens.md`).
- The model IDs live only in `defaultModels` in `registry.ts`. An adapter gets its model from `ctx.model(job)` and holds no model ID of its own. No other file under `src/` names a model ID; tests use made-up IDs.

## Error kinds and plain messages (was 6)

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

## Provider interfaces (was 6)

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
## How an adapter is reached (was 6)

Built. `src/main/providers/adapters.ts`.

- Each provider has one folder under `src/main/providers/` whose `index.ts` exports `adapters: ProviderAdapters`. Folders today: `gemini/`, `fal-seedance/`, `comfyui/`, `fake/`, `local-storage/`, `s3/`, `dropbox/`, `azure-blob/`. A provider with no built adapter exports `{}`. `firefly/` and `jev/` are added when built and stay out of `adapters.ts` until then.
- `adapters.ts` joins the folders by provider ID and exports `adapterFor(deps, providerId, job)`. It returns the built interface for that job, or throws `AppError('INVALID_INPUT', 'That provider cannot do this yet.', { provider, job })` when the provider is not in `deps.providers`, does not list the job, or has no adapter for it. `adapterFrom(table, deps, providerId, job)` does the same over a given table, for tests.
- Every provider, `fake` included, must be in `deps.providers` and list the job. So `fake` is reachable only when `ADMAN_FAKE_PROVIDERS=1`.
- A code path that uses a provider calls `adapterFor` and imports no adapter folder.
- `ctx.secret` throws when the secret is not saved; `ctx.model` throws when the registry has no default model for that job.

## Rules for every adapter (was 6)

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

## Gemini (image, layout, text) (was 6.2)

Built: picture generation with reference pictures (`ImageProvider.generate`). Not built: layout and extract brief / copy options (Phase 4), `extend` (Phase 5), translate (Phase 6). Files: `src/main/providers/gemini/` (`index.ts`, `image.ts`, `failure.ts`, `pinned-origin.ts`, `aspect-ratio.ts`).

**Direction:** outbound. **Protocol:** HTTPS through `@google/genai` (exact version 3.6.1). **Authentication:** API key, secret `gemini.apiKey`. [REQ: FR-060–FR-069, FR-022, FR-045, FR-101, IR-002]

**Trigger:** user actions [REQ: FR-065]. Agent runs on Gemini follow the agent tick (`spec/mcp-and-agents.md`); not built.

| Job | Call | Model (as `registry.ts` has it) | Built |
|-----|------|------|------|
| Image generate | `generateContent` with the prompt and reference pictures, picture output | `gemini-nano-banana-2.1` | Yes |
| Image extend | Same, with the placed picture on a canvas of the target size and an instruction to extend the scene to the edges | the image model | No (Phase 5) |
| Layout | `generateContent` with the background picture and a JSON response schema matching `LayoutBox[]` | `gemini-2.5-flash` | No (Phase 4) |
| Extract brief, copy options, translate | `generateContent` with a JSON response schema | `gemini-2.5-flash` | No (Phase 4; translate Phase 6) |

- The image model ID and API version `v1` are proven: live runs succeeded with them, one from a prompt and one with a product photo as reference (a 1024 × 1024 JPEG came back). The path through the app's screens is not yet proven by a live run.
- **To check:** the layout and text model IDs (`gemini-2.5-flash`) are the ones the architect knew and are unproven. Check Google's current model list at the start of Phase 4 and update `registry.ts`. The proof that an ID is right is a live test passing with a real key.
- `gemini/index.ts` exports `image` only. The unbuilt `extend` throws `ProviderFailure` `{ kind: 'other', detail: 'Image extend is not built yet' }`. `adapterFor(deps, 'gemini', 'layout' | 'text')` throws `INVALID_INPUT` until Phase 4 adds them. Gemini never does video: `adapterFor(deps, 'gemini', 'video')` throws `INVALID_INPUT` with `details = { provider: 'gemini', job: 'video' }`.

### The pinned client (built)

- `new GoogleGenAI` is given `apiKey`, `vertexai: false`, `apiVersion: 'v1'` and `httpOptions = { baseUrl: 'https://generativelanguage.googleapis.com', fetch: pinnedFetch(...) }`. The allowed origin is `GEMINI_ORIGIN` in `pinned-origin.ts`, that address and no other. The API version is a constant beside it (`GEMINI_API_VERSION` in `image.ts`), pinned because `GOOGLE_GENAI_API_VERSION` would otherwise change the request path. A change to the version is made by a ruling, not on the spot.
- `pinnedFetch(inner, limit = MAX_PROVIDER_ANSWER_BYTES)` refuses any other origin with detail "Request refused: {origin} is not the Gemini host", wraps the test transport too, applies the answer size limit, and marks network errors (`NetworkError`, `isNetworkError`). Only the network call and the body read are marked.
- `ctx.secret`, `ctx.model` and `new GoogleGenAI` run inside the `try`, so an error from them leaves as a `ProviderFailure` of kind `other`, and the detail holds no key. Every detail goes through `redactSecret`.
- What `@google/genai` 3.6.1 does with the environment: explicit `vertexai: false` stops both `GOOGLE_GENAI_USE_*` variables being read; explicit `baseUrl` wins over `GOOGLE_GEMINI_BASE_URL` and `GOOGLE_VERTEX_BASE_URL`; explicit `apiKey` wins over `GOOGLE_API_KEY` and `GEMINI_API_KEY` (with a console warning that holds no key). `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` are always read and cannot be switched off, but are not used when Vertex is off. Check this list again when the library is updated.
- The environment test (`environment.test.ts`) sets all nine variables named here to other values and shows the request goes to the pinned origin, on the Gemini API path, with the key the adapter was given.
- No automatic retry: the library retries only when `retryOptions` is set, and it is never set.

### Picture generation (built)

- **Request.** `parts` = the prompt text first, then each reference picture in order as an `inlineData` part with the file's own type and bytes (base64). `config.responseModalities = ['IMAGE']`, `config.imageConfig.aspectRatio` = the nearest ratio.
- **Size: the adapter asks for a shape, and nobody resizes pixels.** Gemini takes an aspect ratio, not a pixel size. `width` and `height` state the shape wanted. `nearestAspectRatio(width, height)` (`aspect-ratio.ts`) picks the closest of `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, compared on a log scale. The picture is returned as it came and need not be `width` × `height`. This holds for every `ImageProvider`. The job writes the file as returned, and `asset.addGenerated` reads the real pixel size from the stored file. The fit happens when a picture is put into a layer, with the `crop` fit (fill the box, centred, the rest hidden) worked out from the asset's real size; the file is never changed (`spec/data-rules.md`). That is Phase 4 work, in the handler that places a chosen option.
- **One picture per call.** One call asks for one picture, and the adapter takes the first picture part; others are ignored. The picture part is picked by its claimed `image/` type; a missing or wrong claimed type fails as "No picture in the answer (finish: {reason})", kind `other`.
- **Answer type.** PNG and JPEG are accepted, read by `pictureType` from the bytes. Anything else fails with detail "Picture is not a PNG or JPEG (type: {claimed})", kind `other`. Gemini returns JPEG today; the app turns it into PNG with `toPng` (above). No `imageConfig` field asks for a file type; Google documents only `aspectRatio` and `imageSize`. No field name is guessed; if Google documents one later, it goes to the architect.
- **`count`.** `generate` makes `count` calls, at most two at a time. After a failure no new call starts, and the first failure is thrown once the calls already sent have ended; pictures already made in that call are dropped. So no code in the app calls `generate` with `count` above 1: the picture job passes 1 and loops itself, which keeps every paid picture (`spec/jobs.md`). The run dialog shows "This will use {count} generations with {provider}." [REQ: FR-063, FR-064]
- **Timeout.** `IMAGE_TIMEOUT_MS = 120_000` per call, raced by the adapter's own abort timer.

**Error mapping** (`failure.ts`). One recorded-response test per kind (`tests/unit/main/providers/gemini/errors.test.ts`).

| What came back | Kind |
|----------------|------|
| HTTP 401 or 403 | `bad_key` |
| HTTP 400 with an error detail whose reason is `API_KEY_INVALID` (Gemini's answer to a wrong key) | `bad_key` |
| Any other HTTP 400 | `other` |
| HTTP 429 | `quota` |
| `promptFeedback.blockReason` set, or a finish reason of `SAFETY`, `IMAGE_SAFETY`, `PROHIBITED_CONTENT`, `IMAGE_PROHIBITED_CONTENT`, `BLOCKLIST`, `SPII` or `RECITATION` | `refused` |
| No answer within 120 s (picture) | `timeout` |
| A marked network error from `pinnedFetch` | `offline` |
| Answer over `MAX_PROVIDER_ANSWER_BYTES` | `other`, "Answer too large" |
| Anything else | `other` |

**Circuit breaker:** no.

**Tests and live runs.**
- Unit: `tests/unit/main/providers/gemini/` (`image`, `errors`, `environment`, `pinned-origin`, `pinned-origin-limit`, `aspect-ratio` tests; recorded answers in `recorded.ts`). `pinned-origin-limit.test.ts` covers the three size cases of the answer limit above.
- Reference pictures, pinned in existing tests: a job run with two reference assets hands the provider stand-in two pictures in ID order with the files' own bytes; the adapter with a recorded transport sends `parts` = prompt text, then two `inlineData` parts with the right type and bytes; the command refuses an ID the project does not hold, and a WebP asset, before any job row.
- Fixtures are hand-made. The live tests prove the real answer's shape; a wrong fixture is corrected by hand from the printed facts. No answer is recorded to disk.
- Live: `tests/live/gemini-image.live.test.ts` and `tests/live/gemini-reference.live.test.ts`. On success they print the file path, the file type, the pixel size (from the PNG or JPEG header), the size in bytes and the model ID, and write the file with the extension of its real type. On failure they print the error kind and the redacted `detail`. They print no request, no header and no key. A test that skips prints one line naming the missing variable, names only.
- No agent makes a paid call [D-049]. Live runs are the stakeholder's.

### Prompt and text rules

Built for pictures; the rest not built (Phases 4 to 6).
- Every picture prompt ends with the fixed instruction "Do not include any text, letters, numbers, logos or watermarks in the image." [REQ: FR-061] Whether it fits products with lettering is open (OI-29 sub-question 4); the ending stays until answered.
- The pre-filled prompt is built from subject name and description, audience, region and message. The user can edit it [REQ: FR-062].
- Results are saved as PNG with generation details embedded (`spec/export-and-checks.md`, 'Embedded generation details').

### Layout, text and extend (not built)

Not built (layout, extract brief, copy options: Phase 4; extend: Phase 5; translate: Phase 6). Built to the interfaces above and to every adapter rule; `gemini/index.ts` gains `layout` and `text`, and `image.extend` replaces its stub.
- Layout: `LayoutProvider.propose` sends the background picture with a JSON response schema matching `LayoutBox[]`. Layout boxes are clamped to the canvas, and colours are snapped to the nearest palette colour when the palette is not empty. The app then creates or updates text layers. Text is always drawn by the app, never by the provider [REQ: FR-061].
- Extract brief, copy options, translate: `generateContent` with a JSON response schema. The translation prompt includes the region and audience as context [REQ: FR-101].
- Extend: the placed picture on a canvas of the target size, with an instruction to extend the scene to the edges; same answer rules as picture generation.
- Timeout: 60 s for a text or layout call; no answer in time is `timeout`. Error mapping as in the table above.
- `generation.proposeLayout` and `generation.copyOptions` are open to an agent under the Gemini tick when built (`spec/mcp-and-agents.md`).

## fal.ai Seedance (image-to-video) (was 6.3)

Not built. `src/main/providers/fal-seedance/index.ts` exports `{}`; the registry row is `available: false`; `@fal-ai/client` is not in `package.json`. It is built only if OI-30 (whether the fal adapter is built before Phase 7) is answered yes; otherwise in Phase 7.

**Direction:** outbound. **Protocol:** HTTPS queue API through `@fal-ai/client`. **Authentication:** API key, secret `fal.apiKey`. [REQ: FR-123, FR-124, OI-04]

**Trigger:** the user starts it for one variant [REQ: FR-123], or an agent under the tick (below).

**Registry row** (in place): `id 'fal-seedance'`, label "fal.ai Seedance", `jobs: ['video']`, `secrets: ['fal.apiKey']`, `defaultModels: { video: 'bytedance/seedance-2.0/image-to-video' }`, `local: false`, `cancel: 'may_finish'`, `serverText: false`.

**OI-04, to be answered by testing with a real key:** the model ID, its accepted durations and sizes, its price, and which start kinds it supports. The panel offers only the durations and sizes the model accepts.

### The adapter

The `video_generation` job kind and `generation.startVideo` exist and are tested with ComfyUI and the fake provider (`spec/jobs.md`), so this work is the adapter and its paid proof.

- Implements `VideoProvider` in full:
  - `start`: upload each picture with the fal storage upload call, then `fal.queue.submit` to the registry model with the prompt, picture URL(s), duration and aspect ratio. Returns the request ID; the job kind saves it with `jc.setRemoteJobId`. A signal that fires before submission stops `start` with `ProviderCancelled`, with no more pictures uploaded.
  - `check`: `fal.queue.status`. The job kind polls every 5 seconds and updates `job.progress`.
  - `fetchResult`: downloads the MP4 and returns the bytes, so no caller is handed a video address. The download is read under `MAX_VIDEO_BYTES` and must pass `checkMp4` before it is stored.
  - `cancel`: fal's queue cancel; outcome `stopped`, `finished` or `unknown` (`spec/cancel.md`).
- Follows every adapter rule above. Its host-pattern constant covers the API host and the host the file is downloaded from.
- Error mapping as for Gemini (401/403 `bad_key`, 429 `quota`, content rules `refused`, marked network error `offline`, rest `other`), with a 15-minute timeout on the whole job. One recorded-response test per kind. **Circuit breaker:** no.
- **Sound.** Stored as returned, after `checkMp4`, sound included. To check: whether fal needs a setting to make sound.
- `@fal-ai/client` is added at an exact version, its licence checked against the licence rules in `spec/security.md`, any install script given a `false` entry.
- **Done when:** recorded-response tests for start, check, fetch, cancel and each error kind; `tests/live/seedance.live.test.ts` turns one still into one MP4 in a temporary folder, printing the same kind of facts as the Gemini live tests. OI-04 is answered by it.

### Start kinds

- Offer only the start kinds fal's model is proven to have. The analyst's reading is that it has all three (from a prompt, from a first-frame picture, from reference pictures); that is not verified (with OI-04).
- A kind fal lacks is refused by `generation.startVideo` before any call, with the same refusal ComfyUI gives for a start pair with no workflow.
- Adding a `VideoProvider` member that states a provider's start kinds goes to the architect first.
- `checkVideoRetry` must run checks 2 and 4 of the `generation.startVideo` checks (start pair, picture) for every provider, with one test (U-1).
- A picture start on a provider that is not ComfyUI needs a provider-neutral sentence with its own refusal, in place of today's "ComfyUI cannot make this kind of video yet." (U-3).

### Cancel and charges

- `cancel: 'may_finish'`: a paid run charged either way is left to finish. Queued with nothing sent: cancelled at once. Still in fal's queue: the queue cancel. Started by fal (`result.stage` is `working`): `job.cancel` is refused `RULE_VIOLATION`, reason `cancel_would_still_charge`, "{Provider} has started this and will charge for it. The app lets it finish and keeps the result." (`cancelRefusal`, `spec/cancel.md`). This applies to fal as soon as it is built.
- To check (U-25): whether fal charges for a started request that is cancelled. Until shown otherwise it is treated as charged.
- What closing a project does with such a job is ruled when the adapter is designed in detail (OI-60, OI-51).

### Left-over runs after a restart

- A left-over video run is only checked and fetched, never started again: when the video job kind gets a row that has a `remote_job_id`, it never calls `start`; it calls `check`, fetches the result if there is one, and stores it. A remote ID the provider does not know ends the job `failed` with nothing kept (`spec/jobs.md`).
- For fal, check whether a status call or a download is charged. If it is, or that cannot be shown, fal rows are not picked up again after a restart and end as interrupted. Say whether a picked-up status call counts in `paid_calls`.

### What else changes when it is built

- `fal-seedance` is set back to `available: true`, and the row in `app-state.test.ts` becomes `['fal-seedance', true]`.
- Agent tick: `agentRunsOffered` (`src/shared/config/agent-runs.ts`) decides, as for every provider. While `available` is false it gives `agent_runs_not_offered`; once available, it gives `agent_runs_not_ready` (not local) until the runner's untick check is built, then null (`spec/mcp-and-agents.md`).
### What stays in Phase 7

| Part | Needs | When |
|------|-------|------|
| Rendering the variant's background to a PNG as the first frame (until then the chosen picture asset is the first frame) | The Scene and the render service | Phase 3 render, swapped in Phase 7 |
| Embedding generation details in the MP4 | FFmpeg in the app (the fetch script, OI-09, due at the start of Phase 7) | Phase 7 |
| Adding the clip at the first free position on the track | The `background_clip` commands and the Scene's video support | Phase 7 |

- On failure the job is set to failed. The track is untouched and the activity panel and variant tile offer retry [REQ: FR-124].
- A clip shorter than the variant leaves the rest of the track black until the user fills it [REQ: FR-122].

## Adobe Firefly (stub) (was 6.4)

Not built (Phase 4). Stub by design: `available: false`; the `firefly` registry row exists, the `firefly/` folder does not.

**Direction:** outbound. [REQ: FR-067, IR-002, OI-03]

No route was found to the Firefly API without an enterprise plan.

- Deliver `src/main/providers/firefly/` implementing `ImageProvider` against Adobe's public documentation: an OAuth server-to-server token from client ID and secret (secrets `firefly.clientId`, `firefly.clientSecret`), then the picture generate call. Add its line to `adapters.ts`.
- It stays `available: false`. It is listed in Settings and the run dialog as "Adobe Firefly — not yet available" [REQ: C-02]. `agentRunsOffered` gives `agent_runs_not_offered`.
- Unit tests against recorded example responses from the public docs. It is never called at run time.
- It follows every adapter rule above.
