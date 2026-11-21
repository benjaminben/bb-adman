# SP-8 handoff

Status: done.

- Done: the picture chooser's second list "Subject photos in the reference library" (hint, "Photo of {subject id}"), asset.update { library: 'asset' } before onChoose, refusal shown, list not drawn when empty.
- In progress: nothing. Left: nothing.
- Decisions: filter `library === 'reference' && subjectId !== null` lives in `use-pictures.ts`; "Import pictures…" re-reads only the asset list; the lists are not re-read after a successful move whose placing is then refused.
- Verify: `npx vitest run tests/unit/renderer/dialogs/picture-chooser.test.tsx`, `npm run lint`, `npm run typecheck`, `npm test`.
