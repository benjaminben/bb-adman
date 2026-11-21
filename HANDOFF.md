# SP-7 handoff: subject photos in the reference lists and pre-choices

Status: done.

## Done
- `src/renderer/ui/reference-picker/reference-rows.ts` (new, pure): `isReferenceRow`, `subjectPhotoIds`, `photoOfLine` ("Photo of {subject id}"), and `whyNot` (moved here; `reference-list.ts` re-exports it).
- `use-picture-list.ts`: the reference list reads `asset.list { projectId, kind: 'image' }` and keeps `isReferenceRow`; "Made in this project" drops rows with a subject. Adds `ReferenceRowsContext`, which hears each read of the reference list.
- `reference-list.ts` (`useReferences`): same unfiltered read plus `isReferenceRow`.
- `reference-picker.tsx` and `video-picture-choice.tsx`: "Photo of {subject id}" after an asset-library subject photo's name.
- `campaign-view.tsx`: `usePreTick` gives the ticks the chosen variant's `subjectPhotoIds` on open, and on a variant change while nothing is ticked (A-120). It hears rows through `ReferenceRowsContext` around `GeneratePanel`.
- `use-first-draft.ts`: `subjectPhotoIds` from the unfiltered list.
- `video-picture-choice.tsx`: at the first read, with nothing chosen, picks the first of `subjectPhotoIds([subjectId])`.

## Decisions
- The campaign page gets its rows from the picker's own read through a React context instead of making its own `asset.list` call. Its own call would have changed the number of `asset.list` calls that `reference-picker.test.tsx` asserts, which is outside the approved test edits. `GeneratePanel` is not in the slice's file list, so passing a prop through it was not an option.
- The pre-tick runs once for each variant shown. A later read (after "Add pictures") and a late read from a variant that is no longer shown change nothing.
- `subjectPhotoIds` sorts by ID itself (ULIDs, so oldest first) instead of relying on the list order.

## Tests
- New: `tests/unit/renderer/ui/reference-rows.test.ts`, `tests/unit/renderer/screens/campaign/reference-pre-tick.test.tsx`, `tests/unit/renderer/screens/campaign/video-picture-pre-choice.test.tsx`.
- Added to: `reference-dialog.test.tsx` (subject photo shown once), `generate-fields.test.tsx` (asset-library subject photo chosen first time).
- Approved edits: the `asset.list` input/stub without a library filter in `reference-picker.test.tsx`, `video-picture.test.tsx`, `reference-dialog.test.tsx`.

## Open questions
- none blocking.

## Verify
npm run lint && npm run typecheck && npm test
