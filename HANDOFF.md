# AP-10b handoff

## Done
- `requireS3Settings` moved to `src/main/commands/storage/require-s3-settings.ts`; `dev/storage.ts` imports it.
- `checkS3Access` / `runS3Check` in `src/main/providers/s3/check-access.ts`; tests in `tests/unit/main/providers/s3/check-access.test.ts` (stand-in: `check-stand-in.ts`).
- `storage.checkS3` in `src/main/commands/storage/check-s3.ts`, returned by `storage/index.ts`; `deny` row; tests in `tests/integration/commands/storage-check-s3.test.ts`.

- Screen part `src/renderer/screens/settings/s3-check/`, mounted in `s3-section.tsx`; test `tests/unit/renderer/screens/settings/s3-check.test.tsx`; shot 90 retaken.
- Full run green.

## Left
- Nothing in AP-10b.

## Decisions
- The list call uses the prefix `{folder}/adman-connection-check/` (the brief: every listed key under it), not the whole folder.
- `RequestTimeout` (S3's own timeout answer) is `s3_cannot_reach`.
- Check-first: `IllegalLocationConstraintException` (400) and `TemporaryRedirect` (307) give `s3_wrong_region` (ruled by the coordinator).

## Verify
npx vitest run tests/unit/main/providers/s3/check-access.test.ts tests/integration/commands/storage-check-s3.test.ts tests/unit/main/commands/storage
