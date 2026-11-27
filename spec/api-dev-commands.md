# Hand-test commands (`dev.*`)

The `dev` command group. The rest of the command list is in `spec/api-commands.md`.

The group holds no command: `src/main/commands/dev/index.ts` returns `[]`, and `src/main/core.ts` spreads it in with the other domains. The `devTools` flag stays for other dev-only switches. Not product features; no requirement is traced to them.

## `dev.storage`

Dropped, with the hand-test screen and its `{userData}/hand-test-local` folder. It has no policy row. `requireS3Settings` stays (`spec/storage-and-publish.md`). The storage confinement tests are campaign folder isolation and the publish work folder (Q-P9-5; `spec/security.md`, named tests).

## `dev.comfyExtend`

Dropped: `generation.runFill` does its work, and CU-8 is dropped under OI-64's assumption. Only its agent policy row (`deny`) exists. Kept for the record: input `{ projectId, assetId, width, height, prompt }`, project scope. It would have enqueued an `image_generation` job with `mode: 'extend'`, the picture centred on the new canvas (`spec/comfyui.md`).
