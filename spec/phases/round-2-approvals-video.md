# Round 2 addition: video variants play in the approvals gallery

The stakeholder overruled open question Q-1 of `spec/phases/round-2-approvals.md`: "The app does upload video files to S3 right? Why can't they be included in the approvals site? They 100% should be, a video variant can't be approved without watching the video". Read with `spec/phases/round-2-approvals.md` (this file fits around it and does not rewrite it), `spec/approvals-service-visitor.md` ("Pictures"), `spec/approvals-service-data.md`, `spec/approvals-commands.md` ("`approvals.publish`", "`approvals.refresh`"), `spec/approvals-client.md`, `spec/export-and-checks.md` ("Video variant") and `spec/phases/DEV-RULES.md`. Where this file differs from those, this file rules until a later pass folds it into the topic files.

## Goal

A reviewer opens a video variant in the gallery and watches the real MP4, with sound, using the browser's own player, then signs off beside it. On "Update gallery" (and the first publish of a new link) the app exports each changed video variant to MP4 with the existing video export code and uploads it next to its still picture, which stays as the poster. The clip reaches the reviewer only through the service, after the password, the same way pictures do.

## Status

Built and merged on `main`: R2V-1 to R2V-8. The rules now live in the approvals topic files; this file keeps the design for reference. `npm run test:approvals-local` runs a video from the app to the gallery on this machine and plays it. Under `next start` the server may drop the clip reply's `Content-Length`; playback works without it. Left for the stakeholder: the deploy steps in `approvals-service/README.md` and the hand check in Safari and Chrome.

## Design additions

### What changes in "What stays exactly as built" (round-2-approvals.md)

Two items there change; every other item stays word for word:

- **The page policy** gains exactly one directive, `media-src 'self'`, placed after `img-src 'self'; `. Nothing else in `pagePolicy` changes: no outside host, no `blob:`, no `data:`, no web font.
- **The lightbox** shows the clip for a video variant with a clip, in place of the still. "Video variants show their still picture" (The lightbox) and A-374 are replaced by this file.

The Origin check, the form checks, the session cookie and row, the password hash, the try limit, the reviewer cookie, the no-store rule for pictures, the secrets rules, "no analytics, no outside host" and the log rules are unchanged.

### How a clip reaches the browser: streamed through the service

**Decision.** Clips are served exactly the way pictures are today: the service holds the signed S3 address in its database, fetches the bytes itself, and passes them on only to a reviewer with a valid session. The browser only ever sees `/l/{slug}/c/{variantKey}/{version}` on the service's own origin. So `media-src 'self'` is the whole policy change.

**Rejected: giving the browser a signed bucket address** (in the page or by a redirect from the service).

- The address would be in the page or a `Location` header, readable by every reviewer and usable for up to 7 days by anyone it is passed to, without the password. That breaks "the bucket address never reaches a visitor" (`spec/approvals.md`, Threats) and "signed addresses never shown".
- `media-src` would have to name the user's own bucket host. The host differs per user and per region, so the policy would be built per link from stored data, and the page would load from an outside host.
- The reply headers (`no-store`, `nosniff`, `Cross-Origin-Resource-Policy`, the sandbox policy) would be whatever S3 sends, not ours.

**What streaming costs on Vercel** (facts from Vercel's own pages, read 2026-11-21: "Vercel Functions Limits" at https://vercel.com/docs/functions/limitations, "Vercel Hobby Plan" at https://vercel.com/docs/plans/hobby, "CDN pricing and usage" at https://vercel.com/docs/manage-cdn-usage):

| Limit | What Vercel says | What this design does |
|---|---|---|
| Reply size | 4.5 MB, "except for streamed responses" | Every clip reply is at most 4 MiB (one piece, below), sent as a stream. No reply is near the limit |
| Function time | Hobby: 300 s, "including streamed responses"; Pro: 300 s default, up to 800 s | A reply is one 4 MiB piece. On a 1 Mbit/s link that takes about 34 s. A link slower than about 110 kbit/s cannot finish one piece in 300 s; such a link cannot play video anyway |
| Transfer | Hobby includes 100 GB Fast Data Transfer (CDN to browser) and 10 GB Fast Origin Transfer (function to CDN) a month; past an included amount a Hobby feature waits until 30 days have passed. Pro bills usage | Every byte a reviewer watches passes through a function, so it counts against both. **Fast Origin Transfer is the real limit** |
| Memory time | Hobby: 360 GB-hours | One piece holds 4 MiB for a few seconds; far from the limit |

How much that is: the export writes 12 Mbit/s video and 192 kbit/s sound (`spec/export-and-checks.md`), about 1.5 MB per second of video. A 30-second ad is about 46 MB. 10 GB of Fast Origin Transfer is about 6,600 seconds of watched video a month: roughly 220 full plays of a 30-second ad. With `no-store`, every play after a reload or a reopened page counts again. On top, AWS may charge the bucket owner for data sent out of S3 for every piece, depending on the bucket's region.

**Recommendation** (Q-V1): stream through the service as designed; it is the only way that keeps the bucket address and the password rule. The stakeholder looks at Usage, Fast Origin Transfer, after the first real video review. If video review becomes routine, move the project to Pro, which bills transfer instead of pausing. A smaller review copy would cut transfer by about three times, but reviewers would then approve a file that is not the one that ships (Q-V2).

### The clip route (service)

`GET /l/{slug}/c/{variantKey}/{version}`, a new `VISITOR_ROUTES` row named `clip`, handled by `src/visitor/clip-route.ts`. In this order, every check before the first byte:

1. The session check (`readSession`), as the picture route.
2. The row `gallery_variant` for (this link, `variantKey`); `version` equal to the row's as text; `kind` is `video`; `clip_url`, `clip_bytes` not null; `picture_expires_at` after now.
3. The `Range` header, read by `parseRange(text, total)` in `src/visitor/range.ts` (pure):
   - Exactly `^bytes=(\d{1,15})-(\d{0,15})$`, one range only. Anything else (no header, several ranges, a suffix `bytes=-500`, spaces, more than 40 characters) is refused.
   - `start` below `total` (`clip_bytes`); `end`, when given, at least `start`. Then `end = min(end ?? total - 1, total - 1, start + CLIP_PIECE - 1)`, with `CLIP_PIECE = 4 * 1024 * 1024`. A server may answer fewer bytes than asked; every browser then asks for the next piece.
4. `ClipSource.getPiece({ url }, { start, end, total })` (below).

Replies:

| Case | Reply |
|---|---|
| Any failure of steps 1, 2 or 4; no `Range` header; a malformed one | `404`, empty body, the plain text headers (the same as a picture failure, so a guesser learns nothing) |
| Steps 1 and 2 pass, the range is well formed but `start ≥ total` or `end < start` | `416`, empty body, the plain text headers plus `Content-Range: bytes */{total}` |
| Success | `206`, the piece as a stream (the picture route's 1 MiB `streamOf`, moved to `src/visitor/stream-of.ts` and used by both routes), with the clip header set below |

The clip header set (`clipHeaders(start, end, total)` in `headers.ts`), compared whole in `test/headers.test.ts`:

```
Content-Type: video/mp4
Content-Range: bytes {start}-{end}/{total}
Content-Length: {end - start + 1}
Accept-Ranges: bytes
X-Content-Type-Options: nosniff
Cache-Control: no-store
Content-Security-Policy: default-src 'none'; sandbox
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
```

- **`no-store` stays.** Playback works with it in current Chrome, Edge, Firefox and Safari: the player keeps what it has buffered while the page is open, and a reload fetches the current clip. The cost is transfer: every reload, every reopened page and some seeks back fetch pieces again (above). The stakeholder's rule is kept.
- **No compression.** Next.js compresses only types it counts as compressible; `video/mp4` is not one. `e2e/clips.spec.ts` checks a `206` has no `Content-Encoding`. If it ever has one, the developer stops and reports (a compressed piece breaks `Content-Range`).
- **`HEAD`** on the clip path matches no row and gets the plain `404`; players do not send it.

**`ClipSource`** (`src/pictures/clip-source.ts`, the interface; `src/pictures/s3-clip-source.ts`, today's only one; both `import 'server-only'`):

```ts
export interface ClipSource {
  // The bytes start..end of the clip, or null for every failure, whatever its cause.
  getPiece(ref: { url: string }, range: { start: number; end: number; total: number }): Promise<Uint8Array | null>
}
```

- The stored text is parsed once; `checkPictureUrl` runs on that object right before the fetch (the same check as pictures: `https:` S3 hosts only, or the exact test origin); that same object is fetched with `fetch(url, { redirect: 'manual', headers: { Range: `bytes=${start}-${end}` } })`. `Range` is the only header added, built from two whole numbers the route computed; no header, cookie or text of the visitor's request is passed on.
- The reply must be `206`, with `Content-Range` exactly `bytes {start}-{end}/{total}` and `Content-Length` exactly `end - start + 1` (when present). The body is read with a cap of `end - start + 1` bytes and must be exactly that long. Anything else is a failure (a `200` with the whole file included: it is cancelled unread).
- When `start` is 0 and the piece is at least 8 bytes, bytes 4 to 7 must be `ftyp` (an MP4 starts with that box). A piece not starting at 0 cannot be sniffed; it is trusted because its total matches the size the app sent through the keyed API, and the reply is `nosniff` with a sandbox policy.
- The stored address and the S3 reply's headers never reach a reply, a log line or an error. A thrown error is swallowed into null, as `s3-source.ts` does.
- `Parts` in `src/app.ts` gains `clips?: ClipSource`; `src/server/serve.ts` puts `s3ClipSource(env)` in `liveParts`. With no `clips` part the route answers the empty `404`.

### Contract and data changes

**The shared contract** (`src/shared/approvals/contract.ts`, copied byte for byte to `approvals-service/src/contract.ts` in the same commit):

```ts
export const CONTRACT_VERSION = 2
export const CLIP_MAX_MS = 180_000                 // 3 minutes
export const CLIP_MAX_BYTES = 384 * 1024 * 1024    // 384 MiB
export const VariantKind = z.enum(['image', 'video'])

export const GalleryClip = z.strictObject({
  clipUrl: PictureUrl,
  type: z.literal('video/mp4'),
  durationMs: z.number().int().min(1).max(CLIP_MAX_MS),
  bytes: z.number().int().min(1).max(CLIP_MAX_BYTES),
})

// GalleryVariant gains two keys; the defaults keep every existing body valid.
//   kind: VariantKind.default('image'),
//   clip: GalleryClip.nullable().default(null),
// and the refinement: kind 'video' or clip null ("Only a video variant may have a clip.").

// PictureRenewal gains one key:
//   clipUrl: PictureUrl.nullable().default(null),
```

- `CONTRACT_VERSION` becomes 2, because an old service refuses the new keys (strict objects). The app's existing health check then says "The approvals service is a different version from this app." `approvals.publish` now asks `GET /api/v1/health` first (R2V-5), so a stakeholder who updated the app before redeploying the service gets that sentence, not a generic refusal.
- `LinkState` is unchanged: it carries no address and no clip data.
- **The API body cap** (`BODY_LIMIT` in `approvals-service/src/api/body.ts`) goes from 2 MiB to 4 MiB: 500 variants with two addresses of up to 2,048 characters each come to about 2.4 MB. 4 MiB (4,194,304 bytes) is still under Vercel's 4.5 MB request limit.
- **Every `clipUrl` passes `checkPictureUrl`** in the route checks of `PUT .../gallery` and `PUT .../pictures` (`checkGalleryPictures`, `checkRenewalPictures` include clip addresses); one bad address refuses the request; only the cleaned form is stored.

**The service database**, `approvals-service/migrations/0002_clips.sql` (four plain statements; the migrate script's splitter is safe for them):

```sql
ALTER TABLE gallery_variant ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';
ALTER TABLE gallery_variant ADD COLUMN clip_url TEXT;
ALTER TABLE gallery_variant ADD COLUMN clip_ms INTEGER;
ALTER TABLE gallery_variant ADD COLUMN clip_bytes INTEGER;
```

- `putVariant` writes the four columns (all three clip columns null, or all three set). Rows from before the migration read as images until the next "Update gallery".
- `renewPicture` becomes:

```sql
UPDATE gallery_variant SET picture_url = ?1, picture_expires_at = ?2, clip_url = ?3
WHERE link_id = ?4 AND variant_key = ?5 AND version = ?6 AND (clip_url IS NULL) = (?3 IS NULL)
```

  So a renewal that leaves out the clip of a row that has one (or sends one for a row without) renews nothing and is not counted; the app then treats the renewal as failed, as today, and no expiry is recorded later than the clip's.
- One expiry, `picture_expires_at`, covers both files: the app signs both at the same moment for the same 7 days and sends the earlier of the two times.
- The stakeholder applies the migration with `npm run db:migrate -- --hosted` and redeploys, by hand (README, R2V-8). No agent does either.

**The gallery view** (`GalleryView.variants[]`, built field by field in `openGallery`) gains one field:

```ts
// null: an image. { clip: null }: a video sent as its still only. { clip: { durationMs } }: a video with a clip.
video: null | { clip: null | { durationMs: number } }
```

It holds no clip address and no byte count. The stamp of "Sign off all" is unchanged (`{variantKey}.{version}` lines).

**The app's project file**: migration `src/main/db/migrations/0006_approval_clips.sql`, made with `npm run db:generate` from the schema change in `src/main/db/schema/approvals.ts`:

```sql
ALTER TABLE `approval_variant` ADD `clip_ms` integer;
ALTER TABLE `approval_variant` ADD `clip_bytes` integer;
ALTER TABLE `approval_variant` ADD `clip_missing` text;
```

- `VariantRecord` in `local-store.ts` gains `clipMs`, `clipBytes` (both whole numbers in the contract's ranges, or both null) and `clipMissing` (`'no_tool' | 'too_long' | 'too_large' | null`, set only when both clip numbers are null). A row that fails these checks is skipped and logged as today, so its variant is drawn and its clip made again.
- These values reach a request (the contract's `durationMs` and `bytes`), so they join the "Project-file values that reach a request or a path" table: checked by Zod on read, and by the contract before sending.

### The app: making and sending clips

**Paths** (`src/shared/approvals/picture-paths.ts`, the one owner): `clipPath(projectId, campaignId, variantId, rev)` gives `{folder}{variantId}-{rev}.mp4`, with the same part checks as `picturePath`. `pictureFolderOf` accepts exactly the two names `picturePath` and `clipPath` build (`.png` and `.mp4`, nothing else), so `picturesIn`, `removalFolder`, the end-of-publish clean-up and "Turn off link" cover clips with no other change.

**Stores** (`PictureStore` in `src/main/approvals/types.ts`) gain `putClip(path: string, data: ReadableStream<Uint8Array>): Promise<void>`: the S3 store writes through the same `StorageProvider.write` with content type `video/mp4` (lib-storage sends a large file in parts); the test store writes under its folder. Both check the path with `pictureFolderOf` first. `signedUrl` already accepts any path the folder rules accept.

**When a clip is made.** For each variant, in `campaign.get` order, with its local row `r`:

| Variant | Local row | What happens |
|---|---|---|
| Any | None, or `r.publishedRev` ≠ `v.rev` | The still is drawn and uploaded as today. A video variant then gets a clip (below) |
| Image | Same rev | Nothing drawn or uploaded (today's rule) |
| Video | Same rev, clip numbers set | Nothing made or uploaded; the still and the clip are signed again |
| Video | Same rev, `clipMissing` is `too_long` or `too_large` | Nothing made; still only again, with the same reason (these cannot change without a rev change) |
| Video | Same rev, `clipMissing` is `no_tool`, or all three clip columns null (a row from before this change) | The still is reused. If the video tool is there now, a clip is made; otherwise still only, `no_tool` |

**Making one clip** (`src/main/approvals/clip-step.ts`):

1. Still only, `no_tool`, when `deps.media.available()` is false or the platform is not macOS or Windows. Nothing is run.
2. Still only, `too_long`, when the variant's `durationMs` is over `CLIP_MAX_MS`. Nothing is run.
3. A work folder from `makeWorkDir(deps.userDataDir, ulid())` (`export-work/{ULID}`), removed on every path (`finally`).
4. `deps.export.video.exportVariant(jc, scene.input, plan, exportTarget(work.path), file)`, the unchanged Phase 8 code and its one FFmpeg runner, where `scene` is `sceneInput(deps, project, v.id)`, `file` is the `adPath(...)` name with `ext: 'mp4'` as `run-export.ts` builds it, `plan` is an `ExportPlan` with that root, the campaign and `settings.export.fps`, and `jc` is a context made like `publishContext` in `src/main/publish/export-adapter.ts`: the run's `signal`, `cancelled()` reading it, `call` and `system` refusing, the rest no-ops. Nothing in `src/main/export/` or `src/main/media/` changes. The runner runs one FFmpeg at a time, so a running export makes the update wait.
5. `scene.rev` must equal the rev the still was drawn at; else the update fails with `variant_changed`.
6. Missing files in the scene, or an export failure: the update fails with `clip_failed` (all or nothing, A-90).
7. The written file is opened without following a link (`O_NOFOLLOW` where the system has it, as `video-ad.ts` `writeOut` does) and checked to be a regular file. Over `CLIP_MAX_BYTES`: still only, `too_large`, nothing uploaded.
8. `store.putClip(clipPath(...), stream)`; a storage failure is today's `PROVIDER_ERROR`.

The clip's `durationMs` is the variant's `durationMs`; `bytes` is the file's size.

**The rest of `approvals.publish`** keeps its steps and its all-or-nothing rule:

- Step 0 (new): `client.health()` before any draw.
- Step 3 signs `{variantId}-{rev}.mp4` too for every video variant with a clip; the expiry sent is the earlier of the two.
- Step 4 sends `kind: 'video'` for a variant whose `format` is `video`, and `clip: { clipUrl, type: 'video/mp4', durationMs, bytes }` or `null`.
- Step 5: the files of this run are removed on any failure or stop, clips included.
- Step 6 keeps every current `.png` and `.mp4` and removes the rest.
- Step 7 writes the clip columns. Step 8 replies `{ variants, drawn, clips }` (`clips`: clips made in this run).
- Sentences (`src/shared/approvals/messages.ts`), each `RULE_VIOLATION` with `details.variantId` where named:
  - `clip_failed`: "The video of {title} could not be made, so the gallery was not changed."
  - `variant_changed`: "{title} changed while the gallery was updating, so the gallery was not changed. Press Update gallery again."
  - `publish_cancelled`: "The gallery update was stopped. The gallery was not changed."
  - `update_running`: "This gallery is already being updated."
- Log lines: `logPictureStep` with steps `clipMake` and `clipUpload`, IDs and the error kind only.

**Renewal** (`approvals.refresh` step 3, `renew.ts`): a due row with clip numbers has `{variantId}-{rev}.mp4` signed again too and sent as `clipUrl`; a row without sends `clipUrl: null`.

**Progress and Stop.** "Update gallery" stays a command (A-90); the dialog waits, as now.

- `ApprovalsDeps` gains `progress(projectId, campaignId, step, done, total)`, which sends the new event `approvals.progress { projectId, campaignId, step: 'making' | 'sending', done, total }` to the app window only. It carries IDs and counts only. It is sent before each clip is made and before each clip upload (`total` is the number of clips this run will make, known after the table above is applied).
- `src/main/approvals/runs.ts`: an in-memory map from `{projectId}/{campaignId}` to the run's `AbortController` and a flag `sent`. `approvals.publish` adds its entry in `prepare` (an entry already there: `update_running`) and removes it in a `finally`.
- **New command `approvals.cancelUpdate`** `{ projectId, campaignId }`, app scope (no project transaction), agent deny, reply `{ stopped: boolean }`. It aborts the run's controller unless `sent` is set; `stopped: false` when there is no run or the gallery request has gone.
- What a stop does: FFmpeg is killed at once (the export's own signal rule); a still draw or a clip upload already under way finishes first, then the run checks the signal and stops; once `PUT .../gallery` is sent (`sent` set), a stop has no effect and the update completes. A stopped run removes this run's uploads (step 5) and fails with `publish_cancelled`.

**The dialog** (`src/renderer/dialogs/approval-dialog/`): while `approvals.publish` runs, the waiting line follows the latest `approvals.progress` for this campaign: "Making video {done + 1} of {total}…", "Sending video {done + 1} of {total}…", and "Updating the gallery…" otherwise. Beside it a quiet button "Stop" (`approvals.cancelUpdate`); once pressed it is disabled and the line reads "Stopping…". The frame still cannot be closed while the command runs. A stop or a failure shows its sentence in the dialog's alert as every refusal does today.

**The still-only note.** `approvals.forCampaign` gives each variant `stillOnly: null | 'no_tool' | 'too_long' | 'too_large'` (from `clip_missing`, for a variant in the gallery). Under "Gallery" in the live-link part, one line per such variant, by title:

| Reason | Words |
|---|---|
| `no_tool` | "{title}: sent as a still picture. This copy of Adman cannot make videos, because FFmpeg is missing." |
| `too_long` | "{title}: sent as a still picture. Videos longer than 3 minutes are not sent." |
| `too_large` | "{title}: sent as a still picture. Its video is larger than 384 MB." |

### The gallery

**The card** (`variant-card`), a video variant only:

- A mark on the picture's top-left corner, inside the picture button, `video-mark` (`src/ui/video-mark/`): a small play triangle (inline SVG, `aria-hidden`) and the text "Video {length}", or "Video, still only" when there is no clip. Ground `--color-bg`, text `--color-text`, `--radius`, `--shadow-1`, height `--chip-height`, padding `0 var(--space-2)`, `--font-size-small`. The picture stays the poster.
- `{length}` is `clipLength(ms)` (`src/ui/clip-length.ts`): whole seconds rounded up, shown as `m:ss` ("0:01", "0:30", "1:05", "3:00").
- The picture button's name: "Open video: {title}, {length}" with a clip; "View larger: {title}. Video, still picture only." without.
- The card states, the tick, "Signed off by {n}" and the sign-off button are as R2A draws them.

**The lightbox** (`lightbox-media`, the one file R2A-6 set aside for this), a video variant with a clip:

```html
<video controls preload="none" playsinline controlslist="nodownload"
       poster="/l/{slug}/p/{variantKey}/{version}" width="{w}" height="{h}">
  <source src="/l/{slug}/c/{variantKey}/{version}" type="video/mp4">
  This browser cannot play the video.
</video>
```

- `controls`: the browser's own player (play, pause, seek, volume, full screen). No `autoplay` and no `muted`: nothing plays until the reviewer presses play, and sound then plays at the browser's volume. Sound never starts by itself.
- `preload="none"`: every card's dialog is in the page, so nothing is fetched until play; a gallery of hundreds sends no clip request on load.
- `width` and `height` from `pictureSize(sizeLine)`; the same sizing as the picture (`max-width: 100%; max-height: calc(100dvh - 14rem)`, the whole width on a phone). `controlslist="nodownload"` because a download sends no `Range` and would fail (Q-V5).
- Under the video, muted `--font-size-small`: "Video, {length}. Sound plays when you press play."
- A notice, `hidden` in the markup, `data-clip-error`, error look, `role="alert"`: "The video could not be loaded. Reload the page to try again. If it still fails, ask the person who sent the link to update the gallery." R2V-6's script shows it on the video's `error` event. With script off, the browser's own broken-player look shows.
- The sign-off part, Previous and Next are R2A's, unchanged, under the media.

A video variant without a clip: the still, as now, and above the sign-off part an info notice: "This variant is a video, but only its still picture was sent. Ask the person who sent the link to update the gallery."

**What a reviewer on a slow link sees.** The card and the poster load as pictures do now. Pressing play fetches the first 4 MiB piece (about 2.7 s of video); on a 5 Mbit/s link playback starts after about 7 s, with the browser's own loading sign. On a slower link the player stops to load and goes on by itself. Signing off never waits for the clip.

**"Sign off all"** (`signoff-all`): when the shown set holds v ≥ 1 video variants with a clip, the confirmation text gains a second sentence: "It includes {v} videos. Watch each one before you sign off." (`videos` prop, passed by `gallery-screen`.)

**The script** (R2A-8's `gallery-script`, one new module `pause-videos.ts`): on each lightbox's `close` event, every `<video>` inside it is paused (`HTMLMediaElement.pause()`), so a closed or stepped-past lightbox goes quiet; on a video's `error` event the dialog's `[data-clip-error]` notice is shown (`hidden = false`). `arrow-keys.ts` also ignores arrow keys while focus is on a `<video>` (the player uses them to seek). The S-12 list of banned calls is unchanged. With script off, a lightbox closed while its video plays keeps playing until the reviewer reopens it and pauses (Q-V6).

### Security rules and the test that proves each

| # | Rule | Test |
|---|---|---|
| SV-1 | The clip route checks the session, then link, variant, version, kind and expiry before reading `Range`; every failure is the empty `404`; a `416` only after those checks | `test/clip-route.test.ts` (R2V-2): no cookie, another link's cookie, another link's variant, wrong version, `03` for 3, image row, expired row, no `clips` part: each the empty `404` with the plain text headers |
| SV-2 | `Range` is parsed to two whole numbers by one pure function; every other form is refused; the piece is at most 4 MiB | `test/range.test.ts`: a table of good and bad headers (several ranges, suffix, spaces, 16 digits, `start ≥ total`, `end < start`, 41 characters) |
| SV-3 | The fetch adds only a `Range` built from those numbers; no visitor header, cookie or text is passed on; no redirect is followed | `test/clip-source.test.ts`: a stand-in `fetch` records the request; a request carrying a visitor's `Cookie`, `Authorization` and `Range: bytes=0-1, 5-9` sends only `Range: bytes=0-1`; a `302` is a failure |
| SV-4 | The bytes must be exactly what was asked: `206`, exact `Content-Range` and total, exact length, read with a cap; `ftyp` on a piece from 0 | `test/clip-source.test.ts`: a `200`, a wrong total, a short body, a long body, no `ftyp`: each null |
| SV-5 | The clip address is checked by `checkPictureUrl` when stored, renewed and before every fetch, and never appears in a reply, a log line or an error | `test/api-links.test.ts` (R2V-1): an `http:` or non-S3 `clipUrl` refuses the whole `PUT`; `test/clip-route.test.ts`: a throwing source logs nothing holding the address (a spy on `console.error`) |
| SV-6 | The clip reply's header set is exact, `no-store` included, with no `Content-Encoding` | `test/headers.test.ts` (whole set); `e2e/clips.spec.ts` reads a real `206` under `next start` |
| SV-7 | The page policy differs from before only by `media-src 'self'` | `test/headers.test.ts`: the whole policy string; `e2e/clips.spec.ts`: no policy refusal while the video plays or fails |
| SV-8 | The view holds no clip address or byte count | `test/view.test.ts` (R2V-4): the variant's key list; a planted address text is not in the drawn page |
| SV-9 | A renewal never extends the expiry of a row whose clip it did not renew | `test/api-links.test.ts` (R2V-1): a renewal with `clipUrl: null` for a row with a clip counts 0 and changes nothing |
| SV-10 | The app's clip files stay inside the campaign's folder; `.mp4` only by `clipPath`'s exact form | `tests/integration/approvals/picture-paths.test.ts` (R2V-3): `.mp4` with a bad ID, `.mov`, `x-1.mp4.png`, a path in another campaign: refused before any call |
| SV-11 | A signed address (picture or clip) is never in a log line, an event, an error, a command reply, a job row or anything an agent can read | `tests/integration/approvals/publish-refresh-secrets.test.ts` (R2V-5): with clip addresses planted in the store stand-in, the log, `approvals.changed`, `approvals.progress`, every reply and failure, and the `job` table (no row added) hold none |
| SV-12 | `approvals.cancelUpdate` is deny for agents and sends nothing; `approvals.progress` goes to the app window only and holds IDs and counts | `tests/integration/approvals/agent-denied.test.ts` (R2V-7) gains it; `tests/unit/shared/schemas/events.test.ts` or the events test that lists `EVENT_NAMES` gains the event with its exact keys |
| SV-13 | FFmpeg runs only through the one runner, in a work folder that is removed on success, failure and stop | `tests/integration/approvals/clip-step.test.ts` (R2V-5): after each path the `export-work` folder holds nothing of the run; `test:build`'s spawn check (one spawn file) still passes |

Noted, not fixed (nuisance): a reviewer can make the service fetch pieces in a loop and use up the month's transfer; a closed lightbox keeps playing with script off; a reviewer can sign off a video without pressing play (Q-V7).

## Slices

Service slices run the service checks of `round-2-approvals.md` "Slices" (`cd approvals-service && npm run typecheck && npm test && npm run test:e2e`, then root `npm run lint`); every address `http://localhost:{port}`, `NEXT_TELEMETRY_DISABLED=1`, nothing contacts Vercel, a hosted database or a bucket; no `vercel` command. App slices run the `DEV-RULES.md` list, with `npm run test:e2e` when the renderer changes. Test clips are made from drawn frames only.

### R2V-1 — Contract 2 and the service's clip data

- **Exists when done:** the contract of "Contract and data changes" in both copies; `CONTRACT_VERSION = 2`; `0002_clips.sql`; `putVariant`, `listVariants`, `findVariant` carry `kind`, `clipUrl`, `clipMs`, `clipBytes`; `renewPicture` as above; `PUT .../gallery` and `PUT .../pictures` store and check clip addresses; `BODY_LIMIT` 4 MiB. Nothing visible changes; the app still sends no clip (the defaults).
- **New files:** `approvals-service/migrations/0002_clips.sql`.
- **May touch:** `src/shared/approvals/contract.ts`, `approvals-service/src/contract.ts`, `approvals-service/src/db/variants.ts`, `src/api/gallery.ts`, `src/api/body.ts`; `tests/helpers/approvals-stand-in.ts` (answers `CONTRACT_VERSION`).
- **Tests first:** `test/api-links.test.ts`: a gallery with one video variant and a clip stores the four columns; `kind: 'image'` with a clip is `400`; a bad `clipUrl` refuses the whole body; SV-9's renewal cases; a body of 3 MiB passes and one of 4 MiB plus one byte gets `413`. `test/migrate.test.ts`: both files apply in order on an empty database and on one holding `0001` with rows (old rows read `kind = 'image'`, clip columns null).
- **Approved edits to existing tests:**
  - `approvals-service/test/contract.test.ts`, `test/entry.test.ts`, `test/api-auth.test.ts`, `e2e/api.spec.ts`: an expected `contract: 1` becomes 2.
  - `test/migrate.test.ts` and `test/db-client.test.ts`: the list of applied names gains `0002_clips.sql`.
  - `test/db.test.ts` and any test reading `VariantRow` whole: the row gains `kind: 'image', clipUrl: null, clipMs: null, clipBytes: null`.
  - `test/api-auth.test.ts`: the case that expects a 2 MiB-plus-one body to get `413` moves to the 4 MiB limit.
  - `tests/integration/approvals/client.test.ts`: a stand-in health reply of `contract: 1` becomes `CONTRACT_VERSION`; the "different version" case uses 1.
- **Exit check:** the service checks; root `npm test -- tests/unit/config tests/integration/approvals` and `npm run typecheck`.
- **Security class:** full. **Depends on:** R2A-3 done (no shared file, but the waves are full until then); runs beside R2A-7.

### R2V-2 — Service: the clip route

- **Exists when done:** `GET /l/{slug}/c/{variantKey}/{version}` as "The clip route"; `parseRange`; `ClipSource` and `s3ClipSource`; `clipHeaders`; `media-src 'self'` in `pagePolicy`; `streamOf` shared; the test picture server answers `Range` for a test clip; a test clip `e2e/pictures/d.mp4`.
- **New files:** `src/visitor/clip-route.ts`, `src/visitor/range.ts`, `src/visitor/stream-of.ts`, `src/pictures/clip-source.ts`, `src/pictures/s3-clip-source.ts`; `e2e/pictures/d.mp4` (2 s, 320 × 180, H.264, silent, `+faststart`, under 200 KB, made once with the fetched FFmpeg from solid-colour frames like `solidPng` in `tests/integration/export/video-export-fixture.ts`; how it was made goes in the commit message); `test/range.test.ts`, `test/clip-source.test.ts`, `test/clip-route.test.ts`, `e2e/clips.spec.ts`.
- **May touch:** `src/visitor/routes.ts` (the row), `src/visitor/picture-route.ts` (uses `stream-of.ts`), `src/visitor/headers.ts`, `src/app.ts` (`Parts.clips`), `src/server/serve.ts`, `e2e/pictures/serve.ts` (`d.mp4` by its fixed name; a `Range` of the form `bytes=a-b` or `bytes=a-` answered with `206` and exact `Content-Range`; anything else the whole file).
- **Check first:** whether Playwright's Chromium can play H.264 (`document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"')`). Builds without the codec are common. If it cannot, `e2e/clips.spec.ts` checks the requests, replies and policy only, and playback is left to R2V-8's hand check. Say which in the report.
- **Tests first:** SV-1 to SV-7 as named. `e2e/clips.spec.ts`: with a seeded video variant whose clip is `d.mp4`: `Range: bytes=0-1` gives `206` with 2 bytes and `Content-Range: bytes 0-1/{size}`; `bytes=0-` gives the whole small file as `206`; `bytes={size}-` gives `416` with `bytes */{size}`; no `Range` gives the empty `404`; without a session the empty `404`; every `/c/` reply is `no-store` with no `Content-Encoding`. The page is reached through the API (`PUT .../gallery`), as `e2e/gallery.spec.ts` does.
- **Approved edits to existing tests:**
  - `test/headers.test.ts`: the expected page policy string gains `media-src 'self'; ` after `img-src 'self'; ` (every other header set stays byte-equal); a new whole-set case for `clipHeaders`.
  - `test/routes.test.ts`: any count or list of `VISITOR_ROUTES` grows by the one `clip` row.
  - `test/picture-route.test.ts`: none (the stream helper moves without a behaviour change).
  - `e2e/gallery.spec.ts`: the `POLICY` pattern gains `media-src 'self'; ` after `img-src 'self'; `.
- **Exit check:** the service checks.
- **Security class:** full. **Depends on:** R2V-1, R2A-2 (`headers.ts`, `routes.ts` and their tests); runs beside R2A-8.

### R2V-3 — App: clip paths, stores, the local columns, renewal

- **Exists when done:** `clipPath` and the folder rules; `putClip` in both stores; migration `0006_approval_clips.sql`; `VariantRecord` with the clip fields read and written by `local-store.ts`; renewal signs and sends clips. Publish does not make clips yet.
- **New files:** `src/main/db/migrations/0006_approval_clips.sql` and its drizzle meta files (generated); `tests/integration/db/migration-0006.test.ts`.
- **May touch:** `src/shared/approvals/picture-paths.ts`, `src/main/approvals/types.ts`, `s3-picture-store.ts`, `test-picture-store.ts`, `local-store.ts`, `renew.ts`, `src/main/db/schema/approvals.ts`; `src/main/approvals/publish.ts` only to give each row it returns `clipMs: null, clipBytes: null, clipMissing: null` (R2V-5 fills them).
- **Tests first:** `tests/integration/approvals/picture-paths.test.ts` new rows (SV-10); `tests/integration/approvals/test-picture-store.test.ts`: `putClip` writes the bytes under the folder and refuses a `.png` name handed to it and a path outside; an S3 store case through its `storage` stand-in: `putClip` writes with `video/mp4`; `migration-0006.test.ts`: an existing project file gains the three columns, old rows read null; `refresh.test.ts`: a due row with a clip sends both addresses and the earlier expiry, a row without sends `clipUrl: null`; a row whose clip numbers are out of range is skipped and logged without values.
- **Approved edits to existing tests:**
  - `tests/integration/approvals/refresh.test.ts`: expected renewal bodies gain `clipUrl: null`.
  - `tests/integration/approvals/publish.test.ts`: expected `approval_variant` rows gain `clipMs: null, clipBytes: null, clipMissing: null`.
  - `tests/integration/approvals/picture-paths.test.ts` and `test-picture-store.test.ts`: a row that expects a `.mp4` name to be refused or left out of a listing now expects it accepted when it is exactly `clipPath`'s form.
  - `tests/integration/db/migration-0005.test.ts` and any test listing the migrations: the list gains `0006_approval_clips`.
- **Exit check:** the `DEV-RULES.md` list.
- **Security class:** full. **Depends on:** R2V-1 (the renewal contract); runs beside R2A-9.

### R2V-4 — Service: the gallery shows and plays video

- **Exists when done:** `video` in the view; the card's `video-mark` and button names; `lightbox-media` with the `<video>`, its line and the hidden error notice, or the still-only notice; `clipLength`; the "Sign off all" sentence for videos; shots.
- **New files:** `src/ui/video-mark/` (component and CSS module), `src/ui/clip-length.ts`; `test/ui-video.test.tsx`; `e2e/shots-r2v.spec.ts` (`99-r2v-card-video` wide and phone, `99-r2v-lightbox-video`, `99-r2v-still-only`; made-up campaign "Spring juice launch", titles such as "Morning run, 9:16").
- **May touch:** `src/visitor/actions.ts` (`video` in the view), `src/ui/lightbox-media/`, `src/ui/variant-card/`, `src/ui/signoff-all/` (the `videos` prop), `src/ui/gallery-screen/` (passes `videos`), `e2e/clips.spec.ts` (made by R2V-2).
- **Tests first:** `test/ui-video.test.tsx`: the exact `<video>` attributes (`controls`, `preload="none"`, `playsinline`, `controlslist`, `poster`, no `autoplay`, no `muted`), the `<source>` `src` and `type`, the fallback text, the line, the hidden notice, the still-only notice, the mark's words and the button names, `clipLength` table (1 ms, 999, 1000, 30000, 65000, 180000), the "Sign off all" sentence with v = 0 and v = 2, hostile title escaped (S-13). `test/view.test.ts`: SV-8. `e2e/clips.spec.ts`: open the lightbox from a video card; the video's attributes; when Chromium can play H.264, `play()` reaches `readyState ≥ 2` and the page reports no policy refusal; when it cannot, only that no `/c/` request was sent before play and none was refused by the policy.
- **Approved edits to existing tests:**
  - `test/view.test.ts`: each expected variant gains `video: null` (or the seeded video's value).
  - `test/ui.test.tsx` and `test/ui-lightbox.test.tsx`: the `view()` and props helpers gain `video: null`; their assertions stay.
  - `test/ui-sidebar.test.tsx`: the confirmation's words with `videos: 0` stay as they are; the helper gains `videos: 0`.
- **Exit check:** the service checks; look at each shot.
- **Security class:** short. **Depends on:** R2V-2, R2A-7 (the card and page), R2A-6 (`lightbox-media`), R2A-5 (`signoff-all`); runs beside R2V-5.

### R2V-5 — App: "Update gallery" makes and sends clips

- **Exists when done:** "Making one clip" and "The rest of `approvals.publish`" as designed: health first, the reuse table, clips exported with the Phase 8 code and uploaded, both files signed, `kind` and `clip` sent, clip columns written, `clips` in the reply, the new sentences; `publishGallery` takes a `signal` and an `onStep(step, done, total)` callback (the command passes a fresh controller and a no-op until R2V-7).
- **New files:** `src/main/approvals/clip-step.ts`, `src/main/approvals/gallery-files.ts` (the per-variant table and uploads, so `publish.ts` stays under 200 lines); `tests/integration/approvals/clip-step.test.ts`, `tests/integration/approvals/publish-video.test.ts`.
- **May touch:** `src/main/approvals/publish.ts`, `src/main/commands/approvals/publish.ts`, `src/shared/schemas/commands/approvals.ts` (`ApprovalsPublishReply` gains `clips`), `src/shared/approvals/messages.ts` (`clip_failed`, `variant_changed`), `tests/integration/approvals/publish-refresh-secrets.test.ts` (SV-11 additions).
- **Keep set (from R2V-3's review):** the end-of-publish clean-up keeps this run's clip paths as well as its still paths; a test proves a clip sent in a run is still in the folder after that run and after the next run with no edit.
- **Tests first:** `publish-video.test.ts`, with a stand-in `deps.export.video.exportVariant` that writes a fixed small file through the target: each row of the reuse table; a video over 3 minutes and one over the byte limit (a stand-in file of `CLIP_MAX_BYTES + 1` made sparse with `truncate`) go still only with their reason and nothing uploaded; no tool: still only, `no_tool`, nothing run; a failing export fails the update with `clip_failed`, removes this run's uploads and leaves the gallery as it was; a rev change between draw and export gives `variant_changed`; an aborted signal before the second clip stops with this run's uploads removed; the health check comes before any draw. `clip-step.test.ts`: SV-13; with the fetched FFmpeg (`ffmpegFetched()`, else skipped with "FFmpeg is not fetched."), a 2 s drawn variant gives an MP4 starting with `ftyp` and the right size. `publish-refresh-secrets.test.ts`: SV-11.
- **Approved edits to existing tests:**
  - `tests/integration/approvals/publish.test.ts`: the stand-in's recorded calls start with the health `GET`; the expected reply gains `clips: 0` (the expected gallery bodies already hold `kind: 'image', clip: null` since R2V-1).
  - `tests/helpers/approvals-stand-in.ts`: its renewal copies the service's clip rule (a renewal counts only when it has a clip exactly when the row has one).
  - `tests/integration/approvals/publish-refresh-secrets.test.ts`: gains the clip cases; existing cases stay.
  - `tests/e2e/approvals.spec.ts`: none expected; if its stand-in service is not `tests/helpers/approvals-stand-in.ts` and lacks health, the stand-in answers health (no assertion changes).
- **Exit check:** the `DEV-RULES.md` list.
- **Security class:** full. **Depends on:** R2V-3; runs beside R2V-4.

### R2V-6 — Service: the script pauses and reports a failed video

- **Exists when done:** `pause-videos.ts` wired by `gallery-script.tsx`; arrow keys ignored on a focused `<video>`.
- **New files:** `src/ui/gallery-script/pause-videos.ts`.
- **May touch:** `src/ui/gallery-script/gallery-script.tsx`, `src/ui/gallery-script/arrow-keys.ts`, `test/gallery-script.test.ts`, `e2e/lightbox.spec.ts` (both made by R2A-8).
- **Tests first:** `e2e/lightbox.spec.ts`: a playing video (or, when Chromium cannot play H.264, a video whose `play()` is called) is paused after Escape and after Right arrow moves to the next card; Left and Right with focus on the video do not move to another card; a clip route that fails (a seeded clip whose test file is missing) shows "The video could not be loaded…"; no policy refusal. `test/gallery-script.test.ts`: the pure part that finds a dialog's videos.
- **Approved edits to existing tests:** `test/config.test.ts`: the count of files in the script folder becomes 5 (the banned-words row already covers the folder; `pause-videos.ts` must pass it).
- **Exit check:** the service checks.
- **Security class:** short. **Depends on:** R2V-4, R2A-8; runs beside R2V-7.

### R2V-7 — App: progress, Stop and the still-only note

- **From R2V-5's review (must be built here):** the clean-up after a failed or stopped run removes only files this run added to the folder. `publishGallery` lists the link's folder once before its first upload; after a failure it removes the paths it uploaded that were **not** in that first listing. So a run that writes again to a path the live gallery already shows (a lost reply from an earlier run, or two runs of one campaign) and then fails never deletes that file. Tests first in `publish-video.test.ts`: a still and a clip already in the folder at this run's paths (local rows out of date) survive a failing run; a path that was not there is removed. The `update_running` lock of this slice closes the two-runs case.
- **Exists when done:** `approvals.progress`, `runs.ts`, `approvals.cancelUpdate`, `update_running` and `publish_cancelled`, `stillOnly` in `approvals.forCampaign`; the dialog's progress line, "Stop", "Stopping…" and the still-only lines; shots.
- **New files:** `src/main/approvals/runs.ts`, `src/main/commands/approvals/cancel-update.ts`, `src/renderer/dialogs/approval-dialog/update-progress.tsx`, `use-update-progress.ts`, `still-only-notes.tsx`; `tests/integration/approvals/cancel-update.test.ts`, `tests/unit/renderer/dialogs/approval-dialog/update-progress.test.tsx`; `tests/shots/r2v-7.shots.ts` (`92-r2v-making-video`, `92-r2v-stopping`, `92-r2v-still-only`).
- **May touch:** `src/main/approvals/types.ts`, `deps.ts`, `publish.ts` (the run entry and `onStep`), `src/main/commands/approvals/index.ts`, `publish.ts`, `src/main/commands/agent-policy.ts`, `src/main/queries/approvals.ts`, `src/shared/schemas/queries/approvals.ts`, `src/shared/schemas/commands/approvals.ts`, `src/shared/schemas/events.ts`, the preload's event list if it names events, `src/shared/approvals/messages.ts`, `src/renderer/dialogs/approval-dialog/approval-dialog.tsx`, `live-link.tsx`, its CSS module.
- **Tests first:** `cancel-update.test.ts`: a stop during the first clip ends the update with `publish_cancelled` and this run's uploads removed; a stop after the gallery request is sent gives `stopped: false` and the update completes; a second publish while one runs gives `update_running`; no run gives `stopped: false`. `agent-denied.test.ts` (SV-12). `update-progress.test.tsx`: the three waiting lines from events of this campaign only, "Stop" then "Stopping…", events of another campaign ignored. `for-campaign.test.ts`: `stillOnly` from the rows.
- **Approved edits to existing tests:**
  - `tests/integration/approvals/agent-denied.test.ts`: the command list gains `approvals.cancelUpdate`.
  - The events test that lists `EVENT_NAMES` (and any count of them): gains `approvals.progress`.
  - `tests/integration/approvals/for-campaign.test.ts` and `tests/unit/renderer/stores/approvals-fixture.ts`: each variant gains `stillOnly: null`.
  - Renderer tests of the approval dialog: the waiting line "Updating the gallery…" still shows with no progress event; their other assertions stay.
- **Exit check:** the `DEV-RULES.md` list and `npm run test:e2e`; look at each shot.
- **Security class:** short. **Depends on:** R2V-5, R2A-1 (`queries/approvals.ts`, the query schema); runs beside R2V-6.

### R2V-8 — Both sides on this machine, and the deploy steps

- **Exists when done:** `tests/approvals-local/approvals-local.spec.ts` gains a video case that passes with `npm run test:approvals-local`; the service README's deploy steps say what the stakeholder does for this change.
- **New files:** none.
- **May touch:** `tests/approvals-local/approvals-local.spec.ts`, `tests/approvals-local/app-steps.ts`, `tests/approvals-local/picture-server.ts` (answers `Range` as R2V-2's server does, for files of its own folder only), `approvals-service/README.md`.
- **Tests first:** the video case (skipped with "FFmpeg is not fetched." when it is not): a 2 s drawn video variant; "Update gallery" shows "Making video 1 of 1…"; the gallery card shows "Video 0:02"; the lightbox's `<source>` answers `206`; after an edit and "Update gallery" the clip is made again, and with no edit it is not (the reply's `clips` is 0).
- **Approved edits to existing tests:** none beyond adding the case.
- **README additions:** before using an app with contract 2, run `npm run db:migrate -- --hosted` and redeploy; then a hand check on the deployed link in Safari on a Mac and an iPhone, and in Chrome: a video plays with sound after pressing play, seeking works, reload plays the current clip, closing the lightbox stops sound, no policy error in the console; then look at Usage, Fast Origin Transfer.
- **Exit check:** `npm run test:approvals-local`, then the full `DEV-RULES.md` list and the service checks once, as the round's full check (this replaces R2A-9's place as the last full check; R2A-9 still runs its own).
- **Security class:** none. **Depends on:** R2V-6, R2V-7, R2A-9.

## Wave table

At most two developers at once. Waves 1 to 3 are R2A's as written. Slices in one wave own disjoint files.

| Wave | Slices | Why together |
|---|---|---|
| 1 | R2A-1, R2A-2 | As in round-2-approvals.md |
| 2 | R2A-3, R2A-4 | As in round-2-approvals.md |
| 3 | R2A-5, R2A-6 | As in round-2-approvals.md |
| 4 | R2A-7, R2V-1 | The page and components against the contract, `src/api/`, `src/db/variants.ts` and the migration |
| 5 | R2A-8, R2V-2 | The page script against the clip route, `headers.ts`, `routes.ts` and the test picture server |
| 6 | R2A-9, R2V-3 | `tests/approvals-local/` against the app's paths, stores and project migration |
| 7 | R2V-4, R2V-5 | Service components and view against the app's publish code |
| 8 | R2V-6, R2V-7 | The service script against the app's command, event and dialog |
| 9 | R2V-8 | Both sides done; the round's full check |

## Assumptions (A-380 to A-394)

- **A-380.** Clips are streamed through the service, like pictures; the browser never gets a bucket address; the page policy gains only `media-src 'self'`.
- **A-381.** A clip reply is one piece of at most 4 MiB, so no reply nears Vercel's size or time limits; browsers ask for the next piece themselves.
- **A-382.** The clip route answers one plain byte range only; no `Range`, several ranges or a suffix range get the empty `404`.
- **A-383.** `Cache-Control: no-store` is kept for clips; the cost is transfer on every replay after a reload.
- **A-384.** The clip is the Phase 8 export's own MP4 (12 Mbit/s, the settings' frame rate), so reviewers watch the file that ships.
- **A-385.** The still stays as the poster; one expiry time covers the still and the clip.
- **A-386.** A clip is made again only when the variant's rev changed, or when the last one was sent as a still because the video tool was missing.
- **A-387.** Clips longer than 3 minutes or larger than 384 MiB are not sent; the variant goes as its still with a note in the app and in the gallery.
- **A-388.** With FFmpeg missing, or on a system the video export does not support, video variants go as stills with a note; the update does not fail.
- **A-389.** A clip that fails to export fails the whole update, as a failed draw does (A-90).
- **A-390.** "Update gallery" stays a command; progress comes by a new event and "Stop" by a new command; a stop waits for an upload in progress and has no effect once the gallery request is sent.
- **A-391.** The contract becomes version 2; the new keys have defaults; `approvals.publish` checks the service's version first.
- **A-392.** The keyed API's body cap rises from 2 MiB to 4 MiB, still under Vercel's 4.5 MB.
- **A-393.** The player is the browser's own: `controls`, `preload="none"`, no autoplay, no mute, `playsinline`, no download.
- **A-394.** Only a piece starting at byte 0 is sniffed for `ftyp`; every piece must match the size the app sent.

## Open questions

- **Q-V1. Hosting cost of video on Vercel Hobby.** Every watched second passes through a function: about 220 full plays of a 30-second ad use Hobby's 10 GB of Fast Origin Transfer, after which Hobby waits out the 30 days. **Recommendation:** stream through the service anyway (the only way that keeps the password and the bucket address rules); watch Usage after the first real review; move to Pro if video review is routine. Planned that way.
- **Q-V2. A smaller review copy.** A second encode at about 4 Mbit/s would cut transfer and wait times by about three times. **Recommendation:** no; reviewers approve the exact file that ships, and the export code stays one path. Planned that way.
- **Q-V3. The limits.** 3 minutes and 384 MiB per clip. **Recommendation:** keep them; an ad is rarely longer, and 3 minutes at 12 Mbit/s is about 270 MB. Planned that way.
- **Q-V4. A clip that fails to export.** Fail the whole update (as a failed draw does), or send that variant as a still? **Recommendation:** fail, with the sentence naming the variant; a reviewer must not be shown a still in place of a video by accident. Planned that way.
- **Q-V5. Downloading a clip.** The player's download item is hidden, because a download sends no `Range` and the route refuses it. **Recommendation:** no download in the gallery; the export is the way to get files. Planned that way.
- **Q-V6. Sound after closing, with script off.** A closed lightbox keeps playing until reopened. **Recommendation:** accept; with script on (nearly every reviewer) it pauses. Planned that way.
- **Q-V7. Signing off a video without watching it.** The stakeholder says a video "can't be approved without watching". Blocking the button until the video has played needs script and is easy to get round. **Recommendation:** do not block; the lightbox line and the "Sign off all" sentence ask reviewers to watch first. Planned that way; a block would be a small later script change.
