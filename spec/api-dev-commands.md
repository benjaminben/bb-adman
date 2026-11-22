# Hand-test commands (`dev.*`)

The `dev` command group. The rest of the command list is in `spec/api-commands.md`.

Since P9-14 the group is empty: `src/main/commands/dev/index.ts` returns `[]` (it still runs only when `createCore` gets `devTools: true`; `core.ts` is unchanged). The `devTools` flag stays for other dev-only switches. Not product features; no requirement is traced to them.

## `dev.storage` (removed)

Removed in P9-14 with the hand-test screen and its `{userData}/hand-test-local` folder. Its policy row is gone. `requireS3Settings` stays (`spec/storage-and-publish.md`). Its named confinement test is replaced by campaign folder isolation and the publish work-folder test (Q-P9-5; `spec/security.md`, named tests).

## `dev.comfyExtend`

Not built, and not to be built: Phase 5's `generation.runFill` replaces it, and CU-8 is dropped under OI-64's assumption. Its agent policy row (`deny`) stays. Kept for the record: input `{ projectId, assetId, width, height, prompt }`, project scope. Enqueues an `image_generation` job with `mode: 'extend'`, the picture centred on the new canvas (`spec/comfyui.md`).
