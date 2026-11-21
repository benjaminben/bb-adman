# SP-9 handoff

## Done
- `src/shared/generation/prompt.ts`: `KEEP_PRINTING_ENDING`, `promptEnding(pictures)`, `promptToSend(prompt, { pictures })` (removes any app ending at the end, repeatedly, then adds the chosen one once).
- Callers pass `{ pictures: referenceAssetIds.length }`: `run-images.ts`, `start-video.ts`, `kinds/image-generation.ts`, `kinds/video-generation.ts`.
- `job/retry.ts` `retryRequest`: picture and video rows get their prompt through `promptToSend`; no other field changes.
- Tests: `prompt.test.ts` additions, integration additions in the approved files, new `tests/integration/commands/job-retry-prompt.test.ts`, approved edits in `job-retry-kept.test.ts`, live test edited (not run).

## In progress
- Nothing.

## Left
- Nothing in the slice.

## Decisions
- `retryRequest` reads only `prompt` and `referenceAssetIds` (safeParse). A row whose request does not parse is retried as before, unchanged, so the retry adds no new refusal.
- Video kind test enqueues straight on the runner, since `generation.startVideo` does not offer the fake a first frame; it sets `deps.fitPicture` because the fixture has none.

## Open questions
- None.

## Verify
```
npx vitest run tests/unit/shared/generation tests/integration/generation/run-images.test.ts tests/integration/generation/image-kind.test.ts tests/integration/generation/start-video.test.ts tests/integration/generation/comfy-run.test.ts tests/integration/jobs/video-generation.test.ts tests/integration/commands/job-retry*.test.ts
npm run lint && npm run typecheck && npm test
```
