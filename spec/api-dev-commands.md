# Hand-test commands (`dev.*`)

The commands behind the hand-test tools. The rest of the command list is in `spec/api-commands.md`.

Registered only when `createCore` gets `devTools: true` (`src/main/commands/dev/index.ts`); never in a packaged app. Not product features; no requirement is traced to them. Denied to agents.

## `dev.storage`

Built. `src/main/commands/dev/storage.ts`, `local-root.ts`, `hand-test-storage.ts`. Removed in Phase 9 with the hand-test screen, once the publish dialog and storage settings screen exist.

- Calls the key guard (for `s3` and `dropbox`; `local` is not in the provider list and skips it), then the chosen `StorageProvider`. It can only touch the one folder named in `src/shared/config/dev-tools.ts`: `adman-hand-test/`, under the S3 prefix or the Dropbox root folder; for `local`, under `{userData}/hand-test-local` (`HAND_TEST_LOCAL_ROOT`), so files land in `{userData}/hand-test-local/adman-hand-test/`.
- `write` uploads the picked file there and returns its name and size. `list` returns the names in that folder. `remove` deletes everything in that folder. No `read` action.
- **Local root (security class).** Before every `local` action the command checks the root and the hand-test folder inside it with `lstat`: if either is there and is a link, or is there and is not a folder, the action is refused with `storage_folder_unsafe` and nothing is listed, written or removed. A "Storage path refused" from an adapter gets the same refusal. The narrow root means the adapter's own real-path check refuses anything that leads out of it; the link check covers the root itself. The gap between check and use is accepted. An `lstat` error other than `ENOENT` is a `ProviderFailure` of kind `other` whose detail is the error code only: code to the log, `PROVIDER_ERROR` to the window, never `INTERNAL`.
- **No settings.** After the key guard and before the adapter, `s3` with no S3 settings or an empty bucket or region is `storage_not_set_up`, `details = { reason, provider }`. `dropbox` with no root folder gets the same refusal when slice G is built. For `write` a file error is reported first.
- **`write` reads the path it is sent.** Accepted for this tool: it is dev-only, denied to agents, and the window's policy blocks outside pages (`spec/security.md`). A file over `HAND_TEST_MAX_UPLOAD_BYTES` (100 MiB, in `dev-tools.ts`) is refused with `INVALID_INPUT` "Choose a file smaller than 100 MB.", from its `stat` size, before it is read. A file that cannot be read is `file_not_readable` "That file could not be read."; the error code goes to a `warn` log line, no path to the reply. No foreseeable file error ends as `INTERNAL`.
- **Wording:** "Choose a file by its full path.", "That file was not found.", "Choose a file, not a folder.", "That file name cannot be used in storage.", "Choose a file to upload." (schema), the key guard purpose "use the hand-test tools", the label "Local storage". A file name the name check refuses is `INVALID_INPUT`.
- **Known and accepted:** a file put into the folder by other means under a name the path rules refuse is neither listed nor removed.

## `dev.comfyExtend`

Not built, and not to be built: Phase 5's `generation.runFill` replaces it, and CU-8 is dropped under OI-64's assumption. Its policy row stays until Phase 9 removes the `dev` commands. Kept for the record: input `{ projectId, assetId, width, height, prompt }`, project scope. Enqueues an `image_generation` job with `mode: 'extend'`, the picture centred on the new canvas (`spec/comfyui.md`).
