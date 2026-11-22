# Provider adapters: Gemini, fal.ai Seedance, Adobe Firefly

The adapters for the outside services other than ComfyUI and storage. Read with `spec/providers.md` (the registry, the interfaces, error kinds and plain messages, the rules every adapter follows, size limits), `spec/jobs.md` (how a job calls an adapter) and `spec/cancel.md` (cancel for every provider). ComfyUI is in `spec/comfyui.md`; storage adapters are in `spec/storage-and-publish.md`.

## Gemini (image, layout, text)

Built: picture generation with reference pictures (`ImageProvider.generate`), layout, extract brief, copy options, `extend` (P5-6; its one live run is P5-19's) and translate (P6-5; its one live run is P6-17's). Files: `src/main/providers/gemini/` (`index.ts`, `image.ts`, `layout.ts`, `text.ts`, `json-call.ts`, `prompts.ts`, `failure.ts`, `pinned-origin.ts`, `aspect-ratio.ts`).

**Direction:** outbound. **Protocol:** HTTPS through `@google/genai` (exact version 3.6.1). **Authentication:** API key, secret `gemini.apiKey`. [REQ: FR-060–FR-069, FR-022, FR-045, FR-101, IR-002]

**Trigger:** user actions [REQ: FR-065]. Agent runs on Gemini follow the agent tick (`spec/agent-runs.md`).

| Job | Call | Model (as `registry.ts` has it) | Built |
|-----|------|------|------|
| Image generate | `generateContent` with the prompt and reference pictures, picture output | `gemini-nano-banana-2.1` | Yes |
| Image extend | Same call, with the picture as it is, the target's nearest aspect ratio and an instruction to extend the scene outward ("Picture extend", below) | the image model | No (Phase 5, P5-6) |
| Layout | `generateContent` with the background picture and a JSON response schema matching `LayoutBox[]` | `gemini-3.5-flash-lite` | Yes |
| Extract brief, copy options, translate | `generateContent` with a JSON response schema | `gemini-3.5-flash-lite` | Yes (translate Phase 6) |

- The image model ID and API version `v1` are proven: live runs succeeded with them, one from a prompt and one with a product photo as reference (a 1024 × 1024 JPEG came back). The path through the app's screens is not yet proven by a live run.
- The layout and text model ID `gemini-3.5-flash-lite` is proven: layout, extract brief and copy options each passed one live run with it.
- `gemini/index.ts` exports `image`, `layout` and `text`. Gemini never does video: `adapterFor(deps, 'gemini', 'video')` throws `INVALID_INPUT` with `details = { provider: 'gemini', job: 'video' }`.

### The pinned client (built)

- `new GoogleGenAI` is given `apiKey`, `vertexai: false`, `apiVersion: 'v1'` and `httpOptions = { baseUrl: 'https://generativelanguage.googleapis.com', fetch: pinnedFetch(...) }`. The allowed origin is `GEMINI_ORIGIN` in `pinned-origin.ts`, that address and no other. The API version is a constant beside it (`GEMINI_API_VERSION` in `image.ts`), pinned because `GOOGLE_GENAI_API_VERSION` would otherwise change the request path. A change to the version is made by a ruling, not on the spot.
- `pinnedFetch(inner, limit = MAX_PROVIDER_ANSWER_BYTES)` refuses any other origin with detail "Request refused: {origin} is not the Gemini host", wraps the test transport too, applies the answer size limit, and marks network errors (`NetworkError`, `isNetworkError`). Only the network call and the body read are marked.
- **No redirect is followed.** `pinnedFetch` sends every request with `redirect: 'manual'`, whatever the caller passed. Any 3xx answer (304 included) ends as `ProviderFailure` of kind `other` with the fixed detail "Request refused: the Gemini host answered with a redirect" (`REDIRECT_REFUSED`); nothing is sent a second time. Reason: on a redirect to another origin Node's `fetch` keeps custom headers such as `x-goog-api-key`. Test: `pinned-origin-redirect.test.ts`.
- `ctx.secret`, `ctx.model` and `new GoogleGenAI` run inside the `try`, so an error from them leaves as a `ProviderFailure` of kind `other`, and the detail holds no key. Every detail goes through `redactSecret`.
- What `@google/genai` 3.6.1 does with the environment: explicit `vertexai: false` stops both `GOOGLE_GENAI_USE_*` variables being read; explicit `baseUrl` wins over `GOOGLE_GEMINI_BASE_URL` and `GOOGLE_VERTEX_BASE_URL`; explicit `apiKey` wins over `GOOGLE_API_KEY` and `GEMINI_API_KEY` (with a console warning that holds no key). `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` are always read and cannot be switched off, but are not used when Vertex is off. Check this list again when the library is updated.
- The environment test (`environment.test.ts`) sets all nine variables named here to other values and shows the request goes to the pinned origin, on the Gemini API path, with the key the adapter was given.
- No automatic retry: the library retries only when `retryOptions` is set, and it is never set.

### Picture generation (built)

- **Request.** `parts` = the prompt text first, then each reference picture in order as an `inlineData` part with the file's own type and bytes (base64). `config.responseModalities = ['IMAGE']`, `config.imageConfig.aspectRatio` = the nearest ratio.
- **Size: the adapter asks for a shape, and nobody resizes pixels.** Gemini takes an aspect ratio, not a pixel size. `width` and `height` state the shape wanted. `nearestAspectRatio(width, height)` (`aspect-ratio.ts`) picks the closest of `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, compared on a log scale. The picture is returned as it came and need not be `width` × `height`. This holds for every `ImageProvider`. The job writes the file as returned, and `asset.addGenerated` reads the real pixel size from the stored file. The fit happens when a picture is put into a layer, with the `crop` fit (fill the box, centred, the rest hidden) worked out from the asset's real size; the file is never changed (`spec/data-rules.md`). That is Phase 4 work, in the handler that places a chosen option.
- **One picture per call.** One call asks for one picture, and the adapter takes the first picture part; others are ignored. The picture part is picked by its claimed `image/` type; a missing or wrong claimed type fails as "No picture in the answer (finish: {reason})", kind `other`.
- **Answer type.** PNG and JPEG are accepted, read by `pictureType` from the bytes. Anything else fails with detail "Picture is not a PNG or JPEG (type: {claimed})", kind `other`. Gemini returns JPEG today; the app turns it into PNG with `toPng` (`spec/providers.md`). No `imageConfig` field asks for a file type; Google documents only `aspectRatio` and `imageSize`. No field name is guessed; if Google documents one later, it goes to the architect.
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
- Unit: `tests/unit/main/providers/gemini/` (`image`, `errors`, `environment`, `pinned-origin`, `pinned-origin-limit`, `aspect-ratio` tests; recorded answers in `recorded.ts`). `pinned-origin-limit.test.ts` covers the three size cases of the answer limit (`spec/providers.md`).
- Reference pictures, pinned in existing tests: a job run with two reference assets hands the provider stand-in two pictures in ID order with the files' own bytes; the adapter with a recorded transport sends `parts` = prompt text, then two `inlineData` parts with the right type and bytes; the command refuses an ID the project does not hold, and a WebP asset, before any job row.
- Fixtures are hand-made. The live tests prove the real answer's shape; a wrong fixture is corrected by hand from the printed facts. No answer is recorded to disk.
- Live: `tests/live/gemini-image.live.test.ts` and `tests/live/gemini-reference.live.test.ts`. On success they print the file path, the file type, the pixel size (from the PNG or JPEG header), the size in bytes and the model ID, and write the file with the extension of its real type. On failure they print the error kind and the redacted `detail`. They print no request, no header and no key. A test that skips prints one line naming the missing variable, names only.
- No agent makes a paid call [D-049]. Live runs are the stakeholder's.

### Picture extend

Built (P5-6), tested on recorded answers; the live test `tests/live/gemini-extend.live.test.ts` was run once and passed (a 512 × 512 PNG came back as a 768 × 1376 JPEG with the picture kept in the centre); it is not repeated. Used by the `generative_fill` job (`spec/links-and-sync.md`, "Generative fill"). [REQ: FR-076]

- **No canvas** (A-128). The app draws no canvas and moves no pixels. `extend({ image, placement, width, height, prompt })` sends one `generateContent` call through the pinned client: `parts` = the prompt text, then the picture as one `inlineData` PNG part; `config.responseModalities = ['IMAGE']`; `config.imageConfig.aspectRatio = nearestAspectRatio(width, height)`. `placement` is not sent: the fill dialog always places the picture centred (`scale`), and the prompt asks for the scene to continue outward.
- The prompt is the job's stored prompt (`FILL_PROMPT` with the "keep printing" ending, since one picture is sent).
- One picture per call; the answer, type, `toPng`, size and error rules are those of picture generation above, with `IMAGE_TIMEOUT_MS`. The result is placed over the whole variant with `crop` null; a ratio that is not exact is cut by the Scene's fit, as for any picture.
- Tests: `tests/unit/main/providers/gemini/extend.test.ts` (recorded transport). Live: `tests/live/gemini-extend.live.test.ts`, one run at the smallest size (D-085), in P5-19.

### Prompt and text rules

Built for pictures; the rest not built (Phases 4 to 6). The two-ending rule below is built (SP-9) and passed one live run.
- **Every picture and video prompt ends with exactly one of two fixed endings** [REQ: FR-061; D-098, R-21; A-127]:
  - The run sends no picture: `NO_TEXT_ENDING`, "Do not include any text, letters, numbers, logos or watermarks in the image." (unchanged).
  - The run sends at least one picture: `KEEP_PRINTING_ENDING`, "Keep any printing on the things in the given pictures exactly as it appears in them. Add no other text, letters, numbers, logos or watermarks anywhere in the image."
- **Why two.** A real Gemini run with two labelled product photos as references showed the "no text" ending wipes every label off the products. The "keep printing" ending kept the large printing (brand name, product name, mark). A product without its label is not usable in an ad. The wording says "things", not "product", so it also fits a person's photo, which has no label; there it just forbids added text.
- **"Sends a picture"** means the stored request's `referenceAssetIds` is not empty. That covers picture runs with reference pictures, a video "with a reference picture", and a video "from a first-frame picture" (the first frame's printing must also stay). The count is the only input; the provider plays no part in the choice.
- **One owner, pure:** `src/shared/generation/prompt.ts`. `promptEnding(pictures: number): string` picks the ending. `promptToSend(prompt: string, sent: { pictures: number }): string` trims the prompt, then removes any app ending at its end, again and again until none is left (either ending, in any order, with the spaces between), then adds the chosen ending once. A prompt that was only endings becomes the chosen ending alone. So the result always holds one ending, the right one, whether the user pasted either ending, a retry passes a stored prompt, or the count changed. `sent` is required, so no caller can forget the count.
- **Where it is called**, always with `{ pictures: referenceAssetIds.length }` of the request being built or run: `generation.runImages` (`run-images.ts`) and `generation.startVideo` (`start-video.ts`) when they build the request; the picture and video job kinds (`kinds/image-generation.ts`, `kinds/video-generation.ts`) before the provider call; `job.retry` (`job/retry.ts`) for picture and video rows, so a retried row made before this rule stores the ending it is sent with. A retry keeps the old row's pictures (the window cannot change them), so its ending only changes for such an old row. Removing every reference means a new run, which gets the "no text" ending. A row queued before the update and run after it is the one case where the sent ending can differ from the stored one; accepted.
- **Providers.** The same rule for Gemini, ComfyUI and the fake provider. Gemini gets the prompt as its text part before the pictures. ComfyUI puts it in the workflow's prompt slot, for picture and video workflows alike. A cut-out has no prompt and no ending.
- **The window shows no ending.** The prompt field holds only the user's text, as today. Agents reach the same commands, so they get the same rule.
- **Small print.** Large printing on a product comes out right, but small print on packaging can come out garbled. The user should check it in every picture; placing a real product photo in the ad is the exact route.
- The pre-filled prompt is built from subject name and description, audience, region and message. The user can edit it [REQ: FR-062].
- Results are saved as PNG with generation details embedded (`spec/export-and-checks.md`, 'Embedded generation details').

### Layout and text (built)

Built (Phase 4, slice P4-4); each of layout, extract brief and copy options passed one live run. Translate is built (P6-5) and not yet run live. Interfaces in `spec/ai-jobs.md`, "Provider interfaces"; every adapter rule holds. Files: `gemini/layout.ts`, `gemini/text.ts`, `gemini/json-call.ts` (one `generateContent` call with a JSON answer, shared by both), `gemini/prompts.ts` (the fixed instruction texts). `gemini/index.ts` exports `layout` and `text`.

- **One JSON call.** Through the same pinned client. `config.responseMimeType = 'application/json'` and `config.responseSchema` for the answer's shape. `TEXT_TIMEOUT_MS = 60_000` per call, raced by the adapter's own abort timer, and the run's `signal` aborts it too (`ProviderCancelled`). The first text part of the first candidate is parsed with `JSON.parse` and checked with the answer's Zod schema; anything else is `other`, "Answer is not the asked JSON". Error mapping as in the table above, with `timeout` at 60 s.
- **Layout** (`propose`). `parts` = the instruction text, then the background as one `inlineData` PNG part. The instruction states the canvas size in pixels, lists each item as `{ slot, text }` and the palette and fonts, and asks for one box per item in the canvas's pixels: `slot`, `x`, `y`, `width`, `height`, `fontSize`, `color` (`#RRGGBB`), `align`; text kept clear of faces and products, inside the canvas, large enough to read. Answer schema `{ boxes: LayoutBox[] }`. The adapter returns the boxes as parsed; the job clamps them (`spec/ai-jobs.md`). Text is always drawn by the app, never by the provider [REQ: FR-061].
- **Extract brief** (`extractBrief`). `parts` = the instruction, then the brief text after a fixed line "Brief:". The instruction asks to fill only the listed fields, only from what the brief says, without translating, and to leave a field out when the brief does not give it. Answer schema: the `BriefDraft` fields, every one optional. The adapter returns `briefDraftFrom(parsed)`'s draft.
- **Copy options** (`copyOptions`). The instruction names the role ("a call to action" or "a line of ad copy"), the language, `count`, `maxChars`, and the brief's message, audience, region, tone, offer and call to action. Answer schema `{ options: string[] }`.
- **Translate** (built, P6-5): one `jsonCall` with `translateInstruction` from `prompts.ts`; the prompt includes the region and audience as context [REQ: FR-101]. The details are in `spec/phases/phase-06-slices.md`, "P6-5".
- **Extend:** see "Picture extend" above (Phase 5).
- **Tests.** Recorded answers, as for pictures: `layout.test.ts` (parts and order, the PNG part, the JSON config, a good answer, a non-JSON answer, a JSON answer of the wrong shape), `text.test.ts` (extract brief, copy options, the same three answers), `text-errors.test.ts` (401, 400 `API_KEY_INVALID`, 429, a safety block, no answer in 60 s, a marked network error), and `environment.test.ts` extended to a text call. Live, one each: `tests/live/gemini-layout.live.test.ts`, `gemini-brief.live.test.ts`, `gemini-copy.live.test.ts`; under D-085 the developer runs each once with the smallest input and reports the model ID, time and answer size, never the answer text.
- **Model IDs** (OI-10). `defaultModels.layout` and `defaultModels.text` in `registry.ts` are `gemini-3.5-flash-lite`, a current model that takes a picture and gives JSON. The live runs proved it.
- `generation.proposeLayout` and `generation.copyOptions` are `tick` for an agent under the Gemini tick (`spec/ai-jobs.md`).

## fal.ai Seedance (image-to-video)

Built (P7-14, `src/main/providers/fal-seedance/`) and switched on (P7-15, `available: true`). Tested on recorded answers; its one paid run was made in P7-24 and is never repeated. Status, result and download calls are not paid calls; a started run left running on close or quit is collected at the next open (`spec/cancel.md`, "fal rows"). It uses no client package (A-170): direct HTTPS calls through one pinned fetch. The calls, the two origins, the endpoints by start, the body and the status and cancel tables are in `spec/phases/phase-07.md`, "fal.ai Seedance".

**Direction:** outbound. **Protocol:** HTTPS queue API, direct calls (no client package). **Authentication:** API key, secret `fal.apiKey`. [REQ: FR-123, FR-124, OI-04]

**Trigger:** the user starts it for one variant [REQ: FR-123], or an agent under the tick (below).

**Registry row** (in place): `id 'fal-seedance'`, label "fal.ai Seedance", `jobs: ['video']`, `secrets: ['fal.apiKey']`, `defaultModels: { video: 'bytedance/seedance-2.0/image-to-video' }`, `local: false`, `cancel: 'may_finish'`, `serverText: false`.

**What the one live run showed** (OI-04): the endpoint `bytedance/seedance-2.0/image-to-video` took a start picture sent as an inline data address (A-171 holds). Asked for 4 s at 480p, square, it returned a clip 4,064 ms long, 640 × 640, with a sound track (fal adds sound by default), about 0.7 MB, in about 95 s. The price is not visible through the adapter.

**Rule: the file decides a clip's facts.** A returned clip's length is not exactly what was asked. The app reads the real length, width, height and sound from the file (`checkMp4`, stored by `asset.addGenerated`) and never uses the asked-for length as the clip's length.

### The adapter

- Implements `VideoProvider` in full: `start` (one submit with the prompt, pictures as data addresses, duration and aspect ratio; returns the request ID, which the job kind saves with `jc.setRemoteJobId`; a signal fired before submit gives `ProviderCancelled` and sends nothing), `check` (the status call), `fetchResult` (downloads the MP4 from a media host and returns the bytes, read under `MAX_VIDEO_BYTES`; it must pass `checkMp4` before it is stored), `cancel` (the queue cancel; `stopped`, `finished` or `unknown`, `spec/cancel.md`).
- Follows every adapter rule in `spec/providers.md`.
- Error mapping (`failure.ts`): 401/403 `bad_key`, 429 `quota`, content rules `refused`, a marked network error `offline`, the rest `other`; no result within 15 minutes is `timeout` (`FAL_RUN_MS`). The key is removed from every detail. **Circuit breaker:** no.
- **Sound** is stored as returned, after `checkMp4`.

### Start kinds

- All four starts (prompt, the post's background, a first-frame picture, reference pictures) and lengths 4 to 15 s in whole seconds, up to 9 references, from `src/shared/config/video-offers.ts`. Only the image-to-video start has been shown to work live; the others rest on recorded answers.
- A start the offer lacks is refused by `generation.startVideo` before any call (`video_start_not_offered`). `job.retry` runs the start pair and picture checks for every provider.

### Cancel and charges

- `cancel: 'may_finish'`: a paid run charged either way is left to finish. Queued with nothing sent: cancelled at once. Still in fal's queue: the queue cancel. Started by fal (`result.stage` is `working`): `job.cancel` is refused `RULE_VIOLATION`, reason `cancel_would_still_charge`, "{Provider} has started this and will charge for it. The app lets it finish and keeps the result." (`cancelRefusal`, `spec/cancel.md`).
- Open (U-25): whether fal charges for a started request that is cancelled. Until shown otherwise it is treated as charged.
- Closing a project or quitting leaves a started fal run running; the next open collects it (A-174, `spec/cancel.md`).

### Left-over runs after a restart

- A left-over video run is only checked and fetched, never started again: a row with a `remote_job_id` never calls `start`; it calls `check`, fetches the result if there is one, and stores it. A remote ID fal does not know ends the job `failed` with nothing kept (`spec/jobs.md`).
- Status, result and download calls are treated as free (A-173) and do not count in `paid_calls`. Open: whether fal charges for status calls is for the stakeholder to read on his fal usage page.
- Agent tick: `agentRunsOffered` (`src/shared/config/agent-runs.ts`) gives null for fal, so the user can tick it (`spec/agent-runs.md`).

### Into the ad

- The first frame of a background start is the variant's background drawn by the Scene at job time (P7-16). The MP4 gets its generation details (`spec/export-and-checks.md`, "MP4"). The clip lands at the first free position on the track.
- On failure the job is set to failed. The track is untouched and the activity panel and variant tile offer retry [REQ: FR-124].
- A clip shorter than the variant leaves the rest of the track black until the user fills it [REQ: FR-122].

## Adobe Firefly (stub)

Built as a stub that is not offered (P4-6): the registry row has `available: false`. Files: `src/main/providers/firefly/` (`index.ts`, `image.ts`, `token.ts`, `failure.ts`, `pinned-origin.ts`); `index.ts` exports `image`; its line is in `adapters.ts`.

**Direction:** outbound. [REQ: FR-067, IR-002, OI-03]

No route was found to the Firefly API without an enterprise plan.

- `ImageProvider.generate`, written from Adobe's public documentation: an OAuth server-to-server token from client ID and secret (secrets `firefly.clientId`, `firefly.clientSecret`); then the asynchronous generate call; then a status check every 2 s (`POLL_MS`) until the job has succeeded, failed or been cancelled; then each picture is fetched. The whole run has a 120 s limit (`IMAGE_TIMEOUT_MS`).
- Three pinned hosts: the sign-in host, the API host and the picture host (constants in `firefly/pinned-origin.ts`). Each request goes only to the host its step needs. The picture download sends no credentials. No redirect is followed; answers stop at the size limit, as for Gemini.
- Reference pictures are refused (`other`, "Reference pictures are not built for Firefly"). At most 4 variations per job (`MAX_VARIATIONS`); a larger `count` sends more jobs. `extend` throws `other`. No automatic retry.
- It stays `available: false`. `adapterFor` refuses any provider whose `available` is false with `INVALID_INPUT` "That provider cannot do this yet.", so the stub is never reached at run time. It is listed in Settings and the run dialog as "Adobe Firefly — not yet available" [REQ: C-02]. `agentRunsOffered` gives `agent_runs_not_offered`.
- Unit tests against recorded example responses from the public docs. It is never called at run time.
- It follows every adapter rule in `spec/providers.md`.
