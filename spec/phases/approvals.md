# Approvals by link

**Goal:** A user can make a password-protected link for a campaign, reviewers can sign off on its variants from a browser with an email address, and the sign-offs show in the app [D-095]. Built beside Phase 4 and the look pack without holding either back (the stakeholder's words: "This feature should be built in parallel to not block the phases ahead").

**Where the slices are.** This file: exit criteria, rules, order. The service slices (AP-1, AP-2, AP-3, AP-14, AP-15, AP-4, AP-16): `spec/phases/approvals-service-slices.md`. The desktop slices (AP-5 to AP-13, with AP-10b): `spec/phases/approvals-desktop-slices.md`.

**Exit criteria**

- The service's own checks pass on this machine: in `approvals-service/`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`; at the root, `npm run lint`.
- The app's checks pass: lint, typecheck, `npm test` (with `migration-0004.test.ts` and the contract test), build, `test:build`, `npm run test:e2e` (with `tests/e2e/approvals.spec.ts` against the stand-in service).
- `npm run test:approvals-local` passes once (AP-13): the real service under `next start` (listening on `127.0.0.1`, opened by the visitor's browser at `localhost`) with a local database file, the built app beside it, and a real browser as the visitor. The flow: set up the service in Settings, make a link, update the gallery, open the link, a wrong password, the right one, sign off; the app shows "Signed off by 1"; edit the variant; the app shows "Changed since sign-off"; update the gallery; the sign-off shows "for an earlier version" in the gallery and in the app; turn the link off; the link shows the password page and nothing else.
- Shots 90 to 99 made and named in the reports (98 and 99, the visitor's pages, by AP-16).
- `approvals-service/README.md` holds the deploy steps and the list of values the stakeholder supplies, with no value written in.
- No agent has deployed anything, signed in to Vercel or a database host, or contacted a deployed service or a hosted database (D-086).

**Dependencies:** Phase 3 merged; P4-10 merged before AP-5 (it edits `core.ts`); P4-12 merged before AP-11 (it edits `campaign-view/`). The service slices need nothing from the app.

**Design:** the desktop side in `spec/approvals.md` (overview, Settings, screens, security rules and threats, open items, assumptions A-82 to A-109), `spec/approvals-client.md` (service client, local tables, kept passwords, pictures) and `spec/approvals-commands.md` (commands, queries, the event); the service in `spec/approvals-service.md` (Next.js on Vercel, tooling, environment, deploying), `spec/approvals-service-data.md` (contract, database, passwords, keyed API), `spec/approvals-service-visitor.md` (visitor logic, pictures) and `spec/approvals-service-tests.md`; the visitor's pages in `spec/approvals-gallery.md` [D-097]. Questions for the stakeholder: OI-95 to OI-97 in `spec/open-items.md` and the questions of D-097.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run what its class asks. A slice that touches the renderer runs `npm run test:e2e` too. Prefer one table test over many near-identical cases.
- **Class S (the service):** root `npm run lint`; in `approvals-service/`, `npm run typecheck` and `npm test`. **Class S+W (the service, served):** class S, then in `approvals-service/` `npm run build` and `npm run test:e2e`; for any slice that touches `app/`, `proxy.ts`, `next.config.ts`, `package.json` or `src/server/`. Other classes as in `spec/testing.md`.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Service slices touch only `approvals-service/`.** AP-1 also added the root ignore lines, the app's copy of the contract and the two root contract tests; AP-14 changes the ignore lines; AP-16 may widen the root lint's file pattern to `approvals-service/**/*.tsx`. So the service slices may run beside any Phase 4, look-pack or desktop approvals slice. Only one service slice runs at a time (they share `src/visitor/` and `package.json`).
- **The contract.** Only AP-1 writes `src/shared/approvals/contract.ts` and its copy. A later slice that finds it must change stops and reports; the architect rules, and the change goes into both copies in one commit.
- **Nothing leaves this machine** (D-086). No `vercel` command of any kind (`login`, `link`, `deploy`, `env pull`, `install`), no `npm run db:migrate -- --hosted`, no `libsql://` or other hosted database address, no `npx` tool that signs in. No test contacts a deployed service, a hosted database or a real S3 bucket. Every script that runs `next` sets `NEXT_TELEMETRY_DISABLED=1`. Installing packages with npm is allowed. If any tool asks to sign in, stop and report.
- **No paid call and no real S3.** S3 code is tested with stand-ins and by signing on this machine (signing sends nothing). The stakeholder's own check with a real bucket comes after deploying.
- **The form Origin check is never loosened for a test.** Every service e2e address is `http://localhost:{port}`; no slice reads `X-Forwarded-Host` or allows a second origin to make a test pass (`spec/approvals-service-visitor.md`, "Forms that write").
- **One migration.** Only AP-5 runs `npm run db:generate` (`0004_approvals`). If a Phase 4 or look-pack slice needs a migration before AP-5 merges, both stop and the orchestrator orders them.
- **Shared files.** Only AP-5 edits `agent-policy.ts`, `events.ts`, `queries/queries.ts`, the Drizzle schema index, `settings.ts`, `secrets.ts`, `core-deps.ts`, and the `core.ts` spread and deps lines. AP-5 registers every approvals command and query against a stub file; the slice that owns the stub replaces its body and touches no index. After AP-5 merges, AP-10b adds one `agent-policy.ts` row for `storage.checkS3`. `src/main/approvals/deps.ts` (AP-5) imports `createPasswordStore` from `password-store.ts` and `choosePictureStore` from `picture-store.ts`, both stubs from AP-5, so AP-6 and AP-7 never edit the same file.
- **Screens** (D-084): one folder per component, CSS from the existing tokens only. No slice here adds a token, so none edits `tokens.css`. A screen slice's edit to an existing component is a mount point of a few lines, named in the slice. Each screen slice adds `tests/shots/ap-{n}.shots.ts` (for example `tests/shots/ap-10.shots.ts`); picture names start with the numbers given in the slice, from the range 90 to 99 kept for this feature.
- **Security class.** Slices marked "full" merge only after a full security review; "short" after a short one.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside | Must not run beside |
|------|-------|-----------|----------------|---------------------|
| 1 | AP-1 Service skeleton, contract, database (built) | Nothing | Every Phase 4 and look-pack slice | Nothing |
| 2 | AP-2 Service: link API (built) | AP-1 | AP-3, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-3 Service: visitor logic and sessions (built) | AP-1 | AP-2, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-5 Desktop contracts (built) | AP-1; P4-10 merged | Any service slice, the look pack, Phase 4 screen slices | P4-10 (`core.ts`); any slice that adds a migration or edits `agent-policy.ts`, `events.ts`, `queries.ts`, `settings.ts` or `secrets.ts` (none is planned in Phase 4 or the look pack) |
| 3 | AP-14 Service: move to Next.js and libSQL (built, reviewed; review fixes in build) | AP-2, AP-3 and the AP-3 review fixes merged | Every desktop, Phase 4 and look-pack slice | Every other service slice |
| 4 | AP-15 Service: visitor replies for the page app | AP-14 and its review fixes | The same | Every other service slice |
| 5 | AP-4 Service: sign-offs and pictures | AP-15 | The same | Every other service slice |
| 6 | AP-16 Gallery pages | AP-4 | The same | Every other service slice |
| 3 | AP-6 Service client, service settings, kept passwords (built) | AP-5 | AP-4, AP-7 | Nothing |
| 3 | AP-7 Pictures: signed addresses and the picture store (built) | AP-5 | AP-4, AP-6 | Any slice that edits `package.json`, `src/main/providers/types.ts` or `src/main/providers/s3/` (AP-10b waits for AP-7) |
| 4 | AP-8 Link commands and the queries (built, in security review) | AP-6, AP-7 | AP-10 | Nothing |
| 4 | AP-10 Settings: approvals service (built; AP-10a, the S3 part, built) | AP-6 | AP-8, AP-9, AP-10b | Nothing (`settings-screen.tsx` has no other planned editor) |
| 4 | AP-10b Test connection for S3 (in build) | AP-5, AP-7 | AP-8, AP-9, AP-10, AP-11, Phase 4 and look-pack slices | Any slice that edits `src/main/commands/storage/`, `src/main/providers/s3/`, `s3-section/` or `agent-policy.ts` (none is planned) |
| 5 | AP-9 Update gallery and refresh | AP-8 and its review fixes | AP-10 | Nothing |
| 6 | AP-11 Approval dialog, bar and store | AP-9; P4-12 merged | AP-10 | P4-12 and AP-12 (`campaign-view/`) |
| 7 | AP-12 Tile marks | AP-11 | Phase 4 and look-pack slices | P4-12 and AP-11 (`campaign-view/`); any slice editing `variant-tile/` or `variant-grid/` (none is planned) |
| 8 | AP-13 Local end-to-end proof, deploy steps, exit check | Every other AP slice | Phase 4 and look-pack slices | Nothing |

The service slices AP-14, AP-15, AP-4 and AP-16 run one after another, each in `approvals-service/` only, so they never share a file with a desktop slice; the desktop waves (AP-6 to AP-12) keep their own order beside them. No two desktop slices of one wave edit the same file: wave 3 by folder (the app's client and password store, the app's picture store and S3 adapter); wave 4 by main process against Settings screens, with AP-10b in the storage command folder, the S3 adapter folder and `s3-section/` only. The move to Next.js and Vercel changes no desktop slice: the app knows only a service address and a key (D-097).

**Follow-ups ruled after AP-8 was built** (one small desktop slice, or part of AP-8's review fixes; the orchestrator chooses): the secure storage check before `createLink` and `setPassword` send anything, and `approvals.changed` after `setPassword` (`spec/phases/approvals-desktop-slices.md`, AP-8). Both come before AP-9, which edits the same command folder.

## Left for later

In `spec/approvals.md`, "Left for later": video variants as stills, a picture store of the service's own, a job with progress for big galleries, links of deleted campaigns, MCP tools.
