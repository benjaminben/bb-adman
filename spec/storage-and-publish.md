# Cloud storage and publishing

The storage interface and its implementations (local folder, Amazon S3, Dropbox, Azure stub), their path and error rules, and the publish flow that copies a campaign to cloud storage. Read with `spec/providers.md` (the registry, error kinds, `redactSecret`), `spec/export-and-checks.md` (publish runs a fresh export) and `spec/security.md`.

[REQ: FR-160 to FR-164, R-15]

## Storage interface

Built. `src/main/providers/types.ts`.

```ts
// Paths are relative, use '/', never start with '/' and never hold '..'.
export interface StorageProvider {
  exists(path: string): Promise<boolean>
  read(path: string, maxBytes?: number): Promise<Uint8Array>
  write(path: string, data: ReadableStream | Uint8Array, contentType: string): Promise<void>
  list(prefix: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
  signedReadUrl?(path: string, seconds: number): Promise<string>  // S3 only (`spec/approvals.md`)
}
```

A provider folder exports `storage?: (ctx: AdapterContext) => StorageProvider` in its `adapters` object. Storage providers: `local-storage`, `s3`, `dropbox`, `azure-blob`. The `fake` provider has no storage part.

### Rules for every implementation

- **`list(prefix)`** returns paths relative to the adapter's root. Each can be handed straight to `read` and `remove`. The prefix names a folder: `a` and `a/` list the same files, and `a` never lists `ab.txt`. An empty prefix lists everything under the root. Only files are returned; folder-marker keys (ending in `/`) are left out. `list('a.txt')` on a file gives an empty list.
- **`exists`** answers false whenever the file is not there: a missing bucket and a path through a file included (`exists('a.txt/b')` is false).
- **`read`** returns the whole file in memory, and for a moment holds about three times the file's size. It is for small files (a report, a list). Uploads go through `write`, which streams. **Byte limit:** `maxBytes`, default `STORAGE_READ_MAX_BYTES` = 256 MiB (A-301); the publish manifest is read under `MANIFEST_MAX_BYTES` (8 MiB, `src/main/publish/manifest.ts`). A file over the limit is a `ProviderFailure` of kind `other`, detail "Answer too large". Local reads stop reading at the limit. If publishing needs to read large files back, that goes to the architect first.
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

The path rules are a last check, not a name cleaner. Code that builds a storage path from text a user typed (a post title, a display name, in the published layout below) makes the name safe first: for publish, `src/shared/publish/paths.ts` (`spec/phases/phase-09.md`, "Project-file values that reach a path").

### Conformance test

Built. `tests/integration/providers/storage-conformance.ts` is one set of cases written against `StorageProvider`: write then `exists`; write then `read` gives the same bytes; `list` shows what was written and nothing outside the prefix; `remove` removes only the named paths; a path with `..` is refused; plus the `list` rules above. In CI it runs against the local implementation on a temporary folder, and nowhere else. `npm run test:live` runs the same cases against a real S3 bucket. A live run prints a failure only when it was not expected: a case that expects a refusal prints nothing for it.

`src/main/providers/**` counts toward the `src/main/**` coverage threshold (`spec/testing.md`).

## Local storage

Built. `src/main/providers/local-storage/` (`localStorageAt(root)`).

- **Reached directly, not through `adapterFor`.** Its root differs for each use and is not a setting. A caller imports `localStorageAt(root)` from `src/main/providers/local-storage`. That folder is the one exception to "a slice that uses a provider imports no adapter folder". `adapterFor(deps, 'local-storage', 'storage')` throws `INVALID_INPUT`.
- **Who may set the root** (security class). Only main-process code, from one of two sources: a folder the user picked in a system dialog (export), or a fixed folder under the app data folder (the publish work folder, the fake storage, and tests with a temporary folder). No command input an agent may send, and no settings value, names or changes a local storage root.
- **Write.** `write` may make the root and any missing parent of it first; the root is trusted. Below the root, before it makes any folder, it finds the deepest existing folder of the target, takes its real path, and refuses unless it is inside the root's real path. Then it makes the folders and checks the file's folder again (security class).
- **Partial write** (A-194, `local-storage/partial-write.ts`). Every `write` goes to `{name}.partial` and is then renamed to `{name}`, so a reader never sees half a file. A link at `{name}` is refused. Before writing, a left-over `{name}.partial` that is a regular file is removed; one that is a link is refused, so nothing is written through it; anything else stays, and the open (`wx`, which fails when the file exists) fails. A failed write removes the `.partial` it made and leaves any older file of the name whole. An existing regular file at `{name}` is replaced by the rename. `list` skips names that end in `.partial`.
- **Links.** On the way down a path, any part that is a link (`lstat`) whose target does not exist is refused with "Storage path refused", for `write`, `read`, `exists`, `list` and `remove`. Nothing is made at the target. A link that cannot be checked for another reason (`ELOOP`, `EACCES`) gives a `ProviderFailure` of kind `other` with the code as detail.
- **Errors.** A file-system error is a `ProviderFailure` of kind `other`; its detail is the error code only (`ENOSPC`, `EACCES`), never a path. A missing file is `{ kind: 'other', detail: 'ENOENT' }`. An error with no code uses the error's name as detail, never its message. `exists` is false for `ENOENT` and `ENOTDIR`.
- **Accepted, not fixed.** The gap between the real-path check and the write: to swap a link in, someone must already be able to write inside the root. No `O_NOFOLLOW` (it does not exist on Windows). Also accepted: with a link inside the root that points to an existing folder outside it, `exists('link/sub/x')` tells whether `sub` exists outside the root. Nothing is read or written, and it needs someone who can already write in the root.

## Amazon S3

Built. `src/main/providers/s3/` (`s3-storage.ts`, `client.ts`, `pinned-host.ts`, `failure.ts`, `check-access.ts`, `signed-url.ts`).

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

`tests/live/s3.live.test.ts`, under `npm run test:live`. A literal secret is never logged or printed. `LIVE_REDACTED_NAMES` in `tests/live/env-file.ts` (its one owner) holds six names: `GEMINI_API_KEY`, `FAL_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DROPBOX_ACCESS_TOKEN`, `DROPBOX_APP_SECRET`. Bucket, region and prefix are not sensitive and are not removed from output.

## Dropbox

Built: the client core, the storage adapter, the sign-in listener, the commands and the Settings part (`src/main/providers/dropbox/`, `src/main/commands/storage/`; design in `spec/phases/phase-09.md`). The live test and the hand proof are the stakeholder's to run. `DROPBOX_SIGN_IN_PORT = 47822` in `src/main/providers/dropbox/sign-in-port.ts`, its one owner; `src/main/providers/comfyui/own-ports.ts` imports it and no other file under `src/` writes 47822.

- **Library:** none. The app makes plain HTTPS calls to the Dropbox HTTP API through its own pinned fetch (`src/main/providers/dropbox/pinned-fetch.ts`), not through the Dropbox SDK (A-217).
- **Sign-in:** OAuth 2 with PKCE in the user's browser, opened through `openExternal` (`https:` only), redirecting to `http://127.0.0.1:47822/oauth/dropbox`. The listener runs on `127.0.0.1:47822` only while a sign-in waits, and checks the `state` value. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`. Access type: app folder [D-090]. The app can read and write only inside its own folder in the user's Dropbox (`Apps/<app name>/`), and every path the API takes is relative to that folder. The user cannot pick a folder outside it; sharing a published folder with others is done in Dropbox itself.
- **App key:** `sxcjvdik8esx6mx` [D-007]. A public identifier, not a secret. It lives only in `src/shared/config/public-ids.ts`. The Dropbox app is registered as an app-folder app [D-090]. It also needs the redirect address above and the three scopes switched on in the Dropbox console (OI-18: not yet confirmed). The sign-in uses PKCE and no app secret: an app secret is never read, stored or shipped by the app.
- **Secret:** `dropbox.refreshToken`. **Settings:** `storage.dropbox = { accountName, rootPath }`. `rootPath` is a path inside the app folder; empty means the app folder itself.
- **Live test:** `DROPBOX_ACCESS_TOKEN` in `.env.local` is a short-lived token made in the Dropbox console. One live test may use it to upload, list and remove one file, under the paid-call rule in `spec/test-harnesses.md` (Dropbox itself costs nothing). It skips when the token is missing or expired. The token is test-only: the app never reads it. Its value is in `LIVE_REDACTED_NAMES`, with `DROPBOX_APP_SECRET`. The live test is `tests/live/dropbox.live.test.ts`.
- **A refresh token is never typed.** A missing token leads the user to the sign-in, not the key dialog. No dialog or settings row offers a field for `dropbox.refreshToken`. It is a sign-in secret (`SIGN_IN_SECRET_NAMES` in `src/shared/schemas/secrets.ts`), which `secret.set` and `secret.delete` refuse; only the two Dropbox commands write and delete it (`spec/phases/phase-09.md`, A-211).
- **Tokens.** Access tokens are short-lived. The adapter gets one from the refresh token when it starts work and again after a 401. Neither token is logged or returned.
- **Commands:** `storage.dropboxSignIn` returns `{ accountName }`; `storage.dropboxSignOut`. Both `deny` for an agent (rows already in `agent-policy.ts`). See `spec/api-commands.md`.
- **Rules:** the shared path rules, the exact "Storage path refused", `redactSecret` on every failure, the `list` rules, and the conformance cases.
- **Tests:** recorded responses and a local stand-in for the token address. Hand proof after OI-18: one file uploaded to, listed in and removed from real Dropbox, and the sign-in opens the browser and the app then shows the account name.

## Azure Blob

Built (stub). `src/main/providers/azure-blob/index.ts`. Registered with `available: false`. Every `StorageProvider` call rejects with a `ProviderFailure` of kind `other`, detail "Azure Blob storage is not available". The user never reaches it, because the registry lists Azure as not available.

## S3 settings check

There is no hand-test storage command. `requireS3Settings` (`storage.checkS3` and publish use it): null settings, an empty bucket or an empty region give `RULE_VIOLATION`, `details: { reason: 'storage_not_set_up', provider: 's3' }`, "Amazon S3 is not set up yet. Enter a bucket and a region, then try again."

## Storage settings screen

Built. The S3 half is `src/renderer/screens/settings/s3-section/`, mounted in `settings-screen.tsx`. The Dropbox half is `src/renderer/screens/settings/dropbox-section/`: sign-in and sign-out, account name and root folder, in the same section (words in `spec/phases/phase-09.md`, "Screens").

**S3:**

- Title "Cloud storage", with "Amazon S3" under it, and the line "Adman keeps pictures in your own Amazon S3 bucket. Enter the bucket and the keys from your Amazon Web Services account."
- "Saved bucket": the bucket, or "Not set up.". "Saved region" (shown once S3 settings exist): the region, or "not set up" when empty.
- Three fields, Bucket, Region (hint "Where the bucket is kept, for example eu-west-1.") and "Folder in the bucket" (hint "Leave empty to use the whole bucket."), saved together in one `settings.update { storage: { s3 } }`. Outer spaces are trimmed before saving. A refused save shows the main process's sentence (the `regionRefusal` ones included) and keeps what was typed.
- The line "The keys need permission to list the bucket and to read, write and delete files in it."
- The two keys `s3.accessKeyId` and `s3.secretAccessKey` through the existing key row: set, replace, delete, a saved key shown by its last four characters only.
- **No "Remove" button.** Saving empty fields means "not set up".
- **Every credential is entered in Settings** [D-096]. The app reads no key from the environment and is never given an environment file. (Only `npm run test:live` reads one, for tests.)

### Test connection (S3)

Built. The user's own bucket and keys are proved in Settings at once, not later as a failed upload.

- **Command `storage.checkS3`.** Input `{}`; app-scope; writes nothing to settings or the project; `deny` for an agent ("test the cloud storage connection"). Order: the S3 settings check (`requireS3Settings`, in `src/main/commands/storage/require-s3-settings.ts`, its one owner; publish imports it); then `requireProviderKeys(deps, 's3', 'test the connection')`, the one `NEEDS_KEY` guard; then `checkS3Access`. Reply `{ ok: true }`, or a refusal with one fixed sentence. The command's secret reader gives only the two S3 keys.
- **`checkS3Access(ctx)`** (`src/main/providers/s3/check-access.ts`) uses the saved settings and keys through `buildS3Client`: the same client, host pin, socket limits and single attempt as the adapter. No new outbound path. It does not go through `s3Storage`, because that folds a wrong key and a missing permission into one kind (`bad_key`); it needs the S3 error name. Four calls, in order, all inside the configured folder:
  1. **list:** `ListObjectsV2`, prefix `{folder}/adman-connection-check/` (`adman-connection-check/` when the folder is empty), `MaxKeys: 1`.
  2. **write:** `PutObject` of the 39-byte text "Adman connection check. Safe to delete." (`text/plain`) at `adman-connection-check/{a new ULID}.txt` under the folder, the key made as `s3-storage.ts` makes it, through `storageFilePath`. The app writes nothing else under that name, and the ULID is new each time, so it cannot meet a real file.
  3. **read:** `GetObject` of that key; the bytes must equal what was written.
  4. **delete:** `DeleteObjects` (the adapter's own call) of that key only. It runs whenever step 2 was tried, even when step 2 or step 3 failed. A key in the reply's `Errors` counts as a failure, like a thrown one. A failed delete after a failed write does not change the reported reason and adds no left-file line. In a bucket with versioning on, the test file stays as an old version.
- **Failure kinds.** The first failing step decides. The provider's message and detail go to the local log through `redactSecret` for both keys, with the step's name; never to the window or a reply. No sentence holds a key, an address or a path.

| Kind (`reason`) | When | Sentence |
|------|------|----------|
| `storage_not_set_up` | No bucket or region saved | "Amazon S3 is not set up yet. Enter a bucket and a region, then try again." |
| `NEEDS_KEY` | A key not saved | "Add your Amazon S3 key to test the connection." |
| `s3_wrong_keys` | `InvalidAccessKeyId`, `SignatureDoesNotMatch`, `ExpiredToken`, `InvalidToken` | "Amazon S3 did not accept these keys. Check the access key ID and the secret access key." |
| `s3_bucket_not_found` | `NoSuchBucket` | "Amazon S3 has no bucket with that name. Check the bucket name." |
| `s3_wrong_region` | `PermanentRedirect`, `AuthorizationHeaderMalformed`, `IllegalLocationConstraintException`, `TemporaryRedirect`, or a 301 | "That bucket is in a different region. Check the region." |
| `s3_permission_missing` | `AccessDenied` or another 403 at a step; `details.permission` is `list`, `write`, `read` or `delete` | "These keys may not {list files in / write files to / read files from / delete files from} the bucket. Give them the {s3:ListBucket / s3:PutObject / s3:GetObject / s3:DeleteObject} permission." |
| `s3_cannot_reach` | A marked network error or timeout, `RequestTimeout` included (a region that does not exist lands here) | "Adman could not reach Amazon S3. Check the internet connection and the region, then try again." |
| `s3_check_failed` | Anything else, a read that gave other bytes included | "Amazon S3 refused the test. Try again, or check the bucket's settings in Amazon Web Services." |

  The S3 refusals are `PROVIDER_ERROR`, `details: { reason, permission? }`. When step 2 succeeded and step 4 failed, the sentence adds "A small test file was left in the folder adman-connection-check. You may delete it."
- **The button.** "Test connection", in the Cloud storage section under the key rows, with the hint "Tests the saved bucket, region and keys." Not set up (no saved bucket or region): disabled. Working: disabled, label "Testing…". Then a result line (`role="status"`): "Connected. Adman can list, write, read and delete files in this folder." or the refusal's sentence. The line is cleared when the saved S3 settings or keys change.
- **Tests** use a stand-in request handler under the real host pin; no real bucket in any automatic test. Hand check (the stakeholder, with his own bucket), three cases: "Connected." with good keys; a wrong region gives the wrong-region sentence; keys without delete permission give the delete sentence and the left-file line.

## Publishing

Built. `src/main/publish/`; the full design is in `spec/phases/phase-09.md`, "Publishing" and "The export interface". The hand proofs are the stakeholder's.

- **All or nothing about its ads** (ruled): if any ad fails to export, the publish ends `export_failed` before any upload. Otherwise clean-up would delete the failed ad's earlier published copy.
- **No `report` row** (ruled): a publish stores no local path and is not counted as a local export.

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
  components/fonts/...            only fonts the user allowed on this computer (A-260)
  translations.csv
  report.html
  report.json
  manifest.json
```

`{prefix or root}` is the S3 prefix or the Dropbox root folder. `assetId8` is the last 8 characters of the asset ID (the random part). `postTitle`, `displayName` and the other parts typed by a user are made safe before they reach the adapter (see "Path rules"). `font_publish_allowed` is a column of `asset` (built, default 0), but it is only a hint: a project file can come from someone else, so a font is uploaded only with consent given on this computer, kept in app data (`spec/phases/phase-09.md`, "Font sharing consent is local", A-260).

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

**Named test:** campaign folder isolation. A publish lists, writes and deletes nothing outside `{campaignId}/`. It runs against the local implementation on a temporary folder.

**Fake storage** (built, `src/main/publish/storage-for.ts`): local storage in `{userData}/fake-storage` (`FAKE_STORAGE_FOLDER`), offered as the publish target "Fake provider" only when the fake provider is listed (`ADMAN_FAKE_PROVIDERS=1`); otherwise it is refused as any provider the app cannot use. `tests/e2e/publish.spec.ts` publishes to it.

**Hand proof:** a hand-run publish to a real S3 bucket and a real Dropbox folder shows the layout above, the manifest, the replace warning and the clean-up of old files. Dropbox waits for OI-18.
