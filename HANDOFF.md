# SP-1 handoff — Brief photo paths in `brief.parse`

Status: done. All of SP-1's scope is built and the full run passes.

## Done

- `BriefDraft` subjects read `pictures` (a text or a list of texts). `Brief` drops them.
- `src/shared/brief/picture-name.ts`: `pictureName`. `bad-line.ts` exports `cleanLineText`, and `badLineAt` uses it.
- `src/shared/schemas/commands/brief.ts`: `PictureNoteReason`, `PictureNote`, `SubjectPictures`, and `BriefParsed.subjectPictures?`.
- `src/main/assets/brief-pictures.ts`: `checkBriefPictures` (the six rules) and `picturesWithoutFolder` (typed brief, `no_folder`).
- `brief.parse` always replies with `subjectPictures`.
- `brief-extraction.ts` removes `pictures` from every subject.
- Review fixes:
  - `wide_folder`: `isWideFolder(realDir, realHome, platform)` is pure. `checkBriefPictures` takes an optional `{ home, platform }` (default: the host's).
  - `cleanLineText` removes the marks from review Note 4.
  - Tests pin the cases from Note 5: a sibling-prefix folder, a FIFO, a folder with no real path, a hard link, and `pictures` dropped by `campaign.create` and `create_campaign`.

## In progress

Nothing.

## Left

Nothing in SP-1. SP-4 uses the reply.

## Decisions

- The extension check (rule 5) uses the real path's file name, not the text's, so the check matches what `asset.import` will later see for that real path.
- A symlink loop gives `not_readable` (ELOOP), as rule 3 says.
- If the brief's own folder has no real path, every picture gets `not_readable`.
- A text starting with `~` counts as outside the folder, even `~x.png` (rule 1 says "starts with `~`").
- `/Volumes` itself also counts as wide on macOS (stricter than the spec's "direct child").
- Letter case is ignored when comparing folders on macOS and Windows, but not on Linux.
- "Spy on the logger": `checkBriefPictures` has no logger, so the test spies on `console.*` and on `process.stdout` / `process.stderr` writes. `brief-parse.test.ts` checks the bus's activity log.

## Open questions

None that block.

## Verify

```
npx vitest run tests/unit/shared/brief/ tests/unit/main/assets/path-resolver.test.ts tests/integration/assets/brief-pictures.test.ts tests/integration/assets/brief-pictures-place.test.ts tests/integration/campaigns/campaign-create.test.ts tests/integration/mcp/tools.test.ts tests/integration/campaigns/brief-parse.test.ts tests/integration/campaigns/brief-extract.test.ts
npm run lint && npm run typecheck && npm test && npm run build && npm run test:build
```
