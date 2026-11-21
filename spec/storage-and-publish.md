# Cloud storage and publishing

The storage interface and its implementations (local folder, Amazon S3, Dropbox, Azure stub), their path and error rules, the hand-test storage command, and the publish flow that copies a campaign to cloud storage. Read with `spec/providers.md` (the registry, error kinds, `redactSecret`), `spec/export-and-checks.md` (publish runs a fresh export) and `spec/security.md`.

[REQ: FR-160 to FR-164, R-15]

## Storage interface (was 6.5)

Built. `src/main/providers/types.ts`.

```ts
// Paths are relative, use '/', never start with '/' and never hold '..'.
export interface StorageProvider {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<Uint8Array>
  write(path: string, data: ReadableStream | Uint8Array, contentType: string): Promise<void>
  list(prefix: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}
```

A provider folder exports `storage?: (ctx: AdapterContext) => StorageProvider` in its `adapters` object. Storage providers: `local-storage`, `s3`, `dropbox`, `azure-blob`. The `fake` provider has no storage part.

### Rules for every implementation

- **`list(prefix)`** returns paths relative to the adapter's root. Each can be handed straight to `read` and `remove`. The prefix names a folder: `a` and `a/` list the same files, and `a` never lists `ab.txt`. An empty prefix lists everything under the root. Only files are returned; folder-marker keys (ending in `/`) are left out. `list('a.txt')` on a file gives an empty list.
- **`exists`** answers false whenever the file is not there: a missing bucket and a path through a file included (`exists('a.txt/b')` is false).
- **`read`** returns the whole file in memory, and for a moment holds about three times the file's size. It is for small files (a report, a list). Uploads go through `write`, which streams. No size limit is set. If publishing needs to read large files back, that goes to the architect first.
- **Errors.** An error from the provider or from the disk is a `ProviderFailure`, passed through `redactSecret` (`src/main/providers/redact.ts`). No message an adapter makes holds a path. An error detail may hold a host name; it goes to the local log and `job.error_detail`, never to a window or an agent. When the call is part of a job, the detail goes to `job.error_detail` only and the log line names the job.
- **A refused path** is the caller's mistake, not a provider's answer. It is a plain `Error` with exactly the message "Storage path refused" (`REFUSED_PATH`), holding no path, thrown before anything is sent or written. Conformance cases expect that exact text.

### Path rules

Built. `src/main/providers/storage-paths.ts` (`storageFilePath`, `storageListPrefix`, `refusePath`). One owner for every implementation on every platform, so one export gives the same paths everywhere. Local, S3 and Dropbox import it; no provider folder imports another.

Refused:

- `..`, a leading `/`, or a path that would leave the root;
- `\` or NUL anywhere;
- a path part that ends in a dot or a space;
- a part holding `:`, `<`, `>`, `"`, `|`, `?`, `*`, or a character with code 1 to 31;
- a part that is a reserved device name (`isReserved`, imported from `src/shared/config/reserved-names.ts`, not copied).

Reserved names (`WINDOWS_RESERVED`): `CON`, `PRN`, `AUX`, `NUL`, `COM0` to `COM9`, `COM¹`, `COM²`, `COM³`, `LPT0` to `LPT9`, `LPT¹`, `LPT²`, `LPT³`, `CONIN$`, `CONOUT$`. Matched on the part before the first dot, spaces dropped from its end, any letter case. Allowed: `COM10`, `CONIN`, `CON$`. The same list applies to project names.

The path rules are a last check, not a name cleaner. Code that builds a storage path from text a user typed (a post title, a display name, in the published layout below) makes the name safe first. That is Phase 8 and 9 work.

### Conformance test

Built. `tests/integration/providers/storage-conformance.ts` is one set of cases written against `StorageProvider`: write then `exists`; write then `read` gives the same bytes; `list` shows what was written and nothing outside the prefix; `remove` removes only the named paths; a path with `..` is refused; plus the `list` rules above. In CI it runs against the local implementation on a temporary folder, and nowhere else. There is no fake storage. `npm run test:live` runs the same cases against a real S3 bucket. A live run prints a failure only when it was not expected: a case that expects a refusal prints nothing for it.

`src/main/providers/**` counts toward the `src/main/**` coverage threshold (`spec/testing.md`).

## Local storage

Built. `src/main/providers/local-storage/` (`localStorageAt(root)`).

- **Reached directly, not through `adapterFor`.** Its root differs for each use and is not a setting. A caller imports `localStorageAt(root)` from `src/main/providers/local-storage`. That folder is the one exception to "a slice that uses a provider imports no adapter folder". `adapterFor(deps, 'local-storage', 'storage')` throws `INVALID_INPUT`.
- **Who may set the root** (security class). Only main-process code, from one of two sources: a folder the user picked in a system dialog (export, Phase 8), or a fixed folder under the app data folder (the hand-test command, and tests with a temporary folder). No command input an agent may send, and no settings value, names or changes a local storage root.
- **Write.** `write` may make the root and any missing parent of it first; the root is trusted. Below the root, before it makes any folder, it finds the deepest existing folder of the target, takes its real path, and refuses unless it is inside the root's real path. Then it makes the folders and checks the file's folder again (security class).
- **Links.** On the way down a path, any part that is a link (`lstat`) whose target does not exist is refused with "Storage path refused", for `write`, `read`, `exists`, `list` and `remove`. Nothing is made at the target. A link that cannot be checked for another reason (`ELOOP`, `EACCES`) gives a `ProviderFailure` of kind `other` with the code as detail.
- **Errors.** A file-system error is a `ProviderFailure` of kind `other`; its detail is the error code only (`ENOSPC`, `EACCES`), never a path. A missing file is `{ kind: 'other', detail: 'ENOENT' }`. An error with no code uses the error's name as detail, never its message. `exists` is false for `ENOENT` and `ENOTDIR`.
- **Accepted, not fixed.** The gap between the real-path check and the write: to swap a link in, someone must already be able to write inside the root. No `O_NOFOLLOW` (it does not exist on Windows). Also accepted: with a link inside the root that points to an existing folder outside it, `exists('link/sub/x')` tells whether `sub` exists outside the root. Nothing is read or written, and it needs someone who can already write in the root.

## Amazon S3

Built. `src/main/providers/s3/` (`s3-storage.ts`, `client.ts`, `pinned-host.ts`, `failure.ts`).

- Libraries: `@aws-sdk/client-s3` and `@aws-sdk/lib-storage`. Calls: `HeadObject` (exists), `GetObject` (read), lib-storage `Upload` (write, multipart when large), `ListObjectsV2` (list), `DeleteObjects` (remove).
- Settings: `storage.s3 = { bucket, region, prefix }` (prefix may be empty). Secrets: `s3.accessKeyId`, `s3.secretAccessKey`. Every `ProviderFailure` the adapter lets out goes through `redactSecret` for both secrets.
- The keys need `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on the bucket. Without `s3:ListBucket`, S3 answers 403 for a missing file, so `exists` fails with `bad_key`. The storage settings screen and the README say so.

### Allowed hosts (security class)

Only `amazonaws.com` hosts for the bucket's region [REQ: FR-308]. `s3Hosts(bucket, region)` gives `{bucket}.s3.{region}.amazonaws.com` and the regional path-style host `s3.{region}.amazonaws.com`, used for a bucket name with a dot. `pinnedHandler` refuses any other host. `ignoreConfiguredEndpointUrls` is set; the host pin is what holds. `@smithy/node-http-handler` is declared in `package.json` at exactly `4.14.2`, the version `@aws-sdk/client-s3` installs, because the adapter imports it to pin the host. When `@aws-sdk/client-s3` is updated this version moves with it, and `npm ls @smithy/node-http-handler` must show one copy.

China regions (`amazonaws.com.cn`) and S3-compatible services are not supported. The settings have no endpoint field. `regionRefusal(region)`, called by `settings.update` for `storage.s3`:

| Region | Result |
|--------|--------|
| starts with `cn-` | `INVALID_INPUT`, reason `storage_not_supported`, "Amazon S3 regions in China are not supported in this build." |
| not accepted by `isRegionName` (host names, addresses, spaces) | `INVALID_INPUT`, reason `storage_not_supported`, "That is not an Amazon S3 region. Storage services that copy S3 are not supported in this build." |
| exactly `''` | saved; treated as "not set up" when used |

`client.ts` still refuses any region `isRegionName` rejects, as a second guard. A later build may add hosts to `s3Hosts` and lift the `cn-` check.

### Error kinds

| S3 answer | Kind |
|-----------|------|
| `InvalidAccessKeyId`, `SignatureDoesNotMatch`, `AccessDenied`, `ExpiredToken`, `InvalidToken`, any 401 or 403 | `bad_key` |
| `SlowDown`, `TooManyRequests`, 429 | `quota` |
| `RequestTimeout`, a marked network timeout | `timeout` |
| any other marked network error | `offline` |
| everything else, `NoSuchBucket` and `NoSuchKey` included | `other` |

`exists` answers false on 404, also when the bucket is missing (the next `write` then fails `other`). Only the network call and the reading of the body are inside the marked network step; an error while building the finished answer is `other`.

### Live tests

`tests/live/s3.live.test.ts`, under `npm run test:live`. A literal secret is never logged or printed. `LIVE_REDACTED_NAMES` in `tests/live/env-file.ts` (its one owner) is `GEMINI_API_KEY`, `FAL_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Bucket, region and prefix are not sensitive and are not removed from output.

## Dropbox

Not built (Phase 2, postponed). `src/main/providers/dropbox/index.ts` exports an empty `adapters` object; `src/main/commands/storage/index.ts` returns no commands. Built: `DROPBOX_SIGN_IN_PORT = 47822` in `src/main/providers/dropbox/sign-in-port.ts`, its one owner; `src/main/providers/comfyui/own-ports.ts` imports it and no other file under `src/` writes 47822.

- **Library:** the `dropbox` SDK.
- **Sign-in:** OAuth 2 with PKCE in the user's browser, opened through `openExternal` (`https:` only), redirecting to `http://127.0.0.1:47822/oauth/dropbox`. The listener runs on `127.0.0.1:47822` only while a sign-in waits, and checks the `state` value. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`. Access type: app folder [D-090]. The app can read and write only inside its own folder in the user's Dropbox (`Apps/<app name>/`), and every path the API takes is relative to that folder. The user cannot pick a folder outside it; sharing a published folder with others is done in Dropbox itself.
- **App key:** `sxcjvdik8esx6mx` [D-007]. A public identifier, not a secret. It lives only in `src/shared/config/public-ids.ts`. The Dropbox app is registered as an app-folder app [D-090]. It also needs the redirect address above and the three scopes switched on in the Dropbox console (OI-18: not yet confirmed). The sign-in uses PKCE and no app secret: an app secret is never read, stored or shipped by the app.
- **Secret:** `dropbox.refreshToken`. **Settings:** `storage.dropbox = { accountName, rootPath }`. `rootPath` is a path inside the app folder; empty means the app folder itself.
- **Live test:** `DROPBOX_ACCESS_TOKEN` in `.env.local` is a short-lived token made in the Dropbox console. One live test may use it to upload, list and remove one file, under the paid-call rule in `spec/test-harnesses.md` (Dropbox itself costs nothing). It skips when the token is missing or expired. The token is test-only: the app never reads it. Its value joins `LIVE_REDACTED_NAMES`, with `DROPBOX_APP_SECRET`.
- **A refresh token is never typed.** A missing token leads the user to the sign-in, not the key dialog. No dialog or settings row offers a field for `dropbox.refreshToken`. How the window tells "missing token" from "missing key" is ruled when the Dropbox work is briefed.
- **Tokens.** Access tokens are short-lived. The adapter gets one from the refresh token when it starts work and again after a 401. Neither token is logged or returned.
- **Commands:** `storage.dropboxSignIn` returns `{ accountName }` (the hand-test button already reads it); `storage.dropboxSignOut`. Both `deny` for an agent (rows already in `agent-policy.ts`). See `spec/api-commands.md`.
- **Rules:** the shared path rules, the exact "Storage path refused", `redactSecret` on every failure, the `list` rules, and the conformance cases.
- **Tests:** recorded responses and a local stand-in for the token address. The work may be built and tested before OI-18 is done. Hand proof after OI-18: one file uploaded to, listed in and removed from real Dropbox, and the sign-in opens the browser and the app then shows the account name.
- **When built:** set `HAND_TEST_DROPBOX = true` in `src/shared/config/dev-tools.ts`, and the screen test "while `HAND_TEST_DROPBOX` is false, the screen has no 'Sign in to Dropbox' button and no Dropbox storage choice" becomes "both are shown".

## Azure Blob

Built (stub). `src/main/providers/azure-blob/index.ts`. Registered with `available: false`. Every `StorageProvider` call rejects with a `ProviderFailure` of kind `other`, detail "Azure Blob storage is not available". The user never reaches it, because the registry lists Azure as not available.

## Hand-test storage command

Built. `dev.storage` in `src/main/commands/dev/` (`storage.ts`, `hand-test-storage.ts`, `local-root.ts`, `storage-error.ts`). Not a product feature; `deny` for an agent. Inputs and messages: `spec/api-commands.md`.

- Targets `local`, `s3`, `dropbox`. Actions `write`, `list`, `remove`; there is no `read` action. Everything stays inside the folder `adman-hand-test/` (`HAND_TEST_FOLDER`).
- Order: key guard (skipped for `local`), then the S3 settings check, then the `StorageProvider`.
- `requireS3Settings`: null settings, an empty bucket or an empty region give `RULE_VIOLATION`, `details: { reason: 'storage_not_set_up', provider: 's3' }`, "Amazon S3 is not set up yet. Enter a bucket and a region, then try again."
- A provider failure is `PROVIDER_ERROR`, with the detail in the log and not in the reply, and no key in either.
- `local` opens `localStorageAt({userData}/hand-test-local)` (`HAND_TEST_LOCAL_ROOT = 'hand-test-local'`). Before any `local` action the root and `{root}/adman-hand-test` are checked with `lstat`: a link or a non-folder is `RULE_VIOLATION`, `details: { reason: 'storage_folder_unsafe' }`, no path. Any other `lstat` error is a `ProviderFailure` of kind `other` with the code as detail (`PROVIDER_ERROR`), and nothing is made.
- "Storage path refused" from the adapter becomes `RULE_VIOLATION` `storage_folder_unsafe`. Bad names (a backslash, ending in a dot, a reserved name, a path ending in `..`) stay `INVALID_INPUT`.
- The file to upload: over `HAND_TEST_MAX_UPLOAD_BYTES` (100 MiB) is `INVALID_INPUT` before it is read. A `stat` or read error other than `ENOENT`/`ENOTDIR` is `RULE_VIOLATION` `file_not_readable`, with a `warn` log line holding the error code.
- `HAND_TEST_DROPBOX = false` (`src/shared/config/dev-tools.ts`): while false the screen shows no Dropbox choice and no "Sign in to Dropbox" button.
- Not built: the path text field "File to upload (full path)" in `src/renderer/dev/storage-actions.tsx` becomes a "Choose a file" button calling `dialog.pickFiles`; `dev.storage` does not change.
- **Removed in Phase 9**, once the publish dialog and the storage settings screen exist: the hand-test screen and `dev` commands, the `{userData}/hand-test-local` handling, and the constants `HAND_TEST_LOCAL_ROOT`, `HAND_TEST_MAX_UPLOAD_BYTES`, `HAND_TEST_DROPBOX`, `HAND_TEST_FOLDER`.

## Storage settings screen

Not built (Phase 9). The cloud storage section of Settings: S3 bucket, region and prefix, with the key permissions above stated; the Dropbox sign-in and sign-out, account name and root folder. An empty S3 region is saved and shown as "not set up". A region `regionRefusal` refuses is shown with its sentence when the settings are saved. The settings values themselves are built (`src/shared/schemas/settings.ts`).

## Publishing

Not built (Phase 9). Needs Phase 8 export.

**Trigger:** `publish.run`, manual, one campaign at a time [REQ: FR-161]. `deny` for an agent. Job kind `publish` (class `background`).

### Published layout

[REQ: FR-163, FR-164]

```
{prefix or root}/{campaignId}/
  exports/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
  components/backgrounds/{displayName}-{assetId8}.{ext}
  components/logos/...
  components/subjects/{subjectId}/...
  components/images/...
  components/fonts/...            only fonts with font_publish_allowed
  translations.csv
  report.html
  report.json
  manifest.json
```

`{prefix or root}` is the S3 prefix or the Dropbox root folder. `assetId8` is the first 8 characters of the asset ID. `postTitle`, `displayName` and the other parts typed by a user are made safe before they reach the adapter (see "Path rules"). `font_publish_allowed` is a column of `asset` (built, default 0); the font sharing checkbox that sets it is Phase 9 UI.

### Flow

1. `publish.inspect` lists `{campaignId}/`. If files exist, the dialog warns "This will replace the files published for this campaign." and needs confirmation [REQ: FR-164]. The warning also says that someone may be reviewing the files being replaced [REQ: FR-241]. The same query returns the component files of step 4 with their full local paths; the dialog lists them before the user starts [REQ: R-06, 8.4].
2. The dialog also says "Generated images and videos carry the prompt that made them. Anyone with these files can read it." [REQ: 6.3]
3. The app runs a fresh export of the whole campaign into a temporary folder, with checks and report (`spec/export-and-checks.md`, "Export"). Check warnings are shown as in any export.
4. It collects the components: every asset used by a layer or clip of an exported variant, sorted into the folders above. Assets in the rule set's required list go to `logos`. Assets attached to a subject go to `subjects/{subjectId}`. Generation attempts that no variant uses are not uploaded [REQ: FR-162].
5. It uploads every file, then writes `manifest.json`: the file list with sizes and hashes, the app version, the time, and the publish number.
6. It deletes any object under `{campaignId}/` that is not in the new manifest. Nothing outside `{campaignId}/` is ever listed, written or deleted [REQ: FR-164].

**Publish header** [REQ: FR-241]: each publish writes its date and time, and which publish of the campaign it is, at the top of the published report. The count comes from the manifest it replaces (1 when there is none).

Components are uploaded as they are on disk, so generated ones keep their embedded generation details [REQ: C-21]. Exports are written fresh and carry none [REQ: FR-068].

**Errors:** each file upload is retried up to 3 times, with 1, 4 and 10 second waits. Uploads are free to repeat. A failed publish leaves the old manifest in place and can be run again. No circuit breaker.

**Named test:** campaign folder isolation. A publish lists, writes and deletes nothing outside `{campaignId}/`. It runs against the local implementation on a temporary folder (there is no fake storage).

**Hand proof (Phase 9):** a hand-run publish to a real S3 bucket and a real Dropbox folder shows the layout above, the manifest, the replace warning and the clean-up of old files. Dropbox waits for OI-18.
