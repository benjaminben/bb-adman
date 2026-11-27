# Build plan

The phase plans, in build order, and what each has left. Phases 1 to 10 and the later work in the second table are built on `main`. What is left is mostly hand checks by the stakeholder (real servers, Windows) and Phase 11, which is held: there is no `LICENSE` file, no licence check in CI and no example set. Each file keeps its slices as the record of what each one owns and tests; the rules as built live in the topic files.

`spec/phases/review-leftovers.md` holds review findings not yet handled. Its "Fix now" list is empty. Its "Fix with a later phase" items are read by that phase's architect.

## Order

The Phase 2 leftovers keep their group numbers. Group 1 (the `@/` alias, one folder per component, one styling source) is built.

| # | Work | Goal | Depends on | Topic files the developers need |
|---|------|------|------------|------------------------------|
| 1 | Phase 2 leftovers, group 2 (`phase-02-leftovers.md`) | Small fixes and helpers later phases lean on; ComfyUI follow-ups; slice WP. Built: F-1 to F-12, F-14 to F-17, EX-1, WP. Left: F-18 (partly done), the ComfyUI follow-ups that wait on real runs, TP-2, and the items waiting on a ruling | Phase 2 as built | `jobs.md`, `assets.md`, `comfyui.md`, `comfyui-workflows.md`, `comfyui-trials.md`, `providers.md`, `security.md`, `testing.md`, `data-rules.md` |
| 2 | Phase 2 leftovers, group 3 (`phase-02-agent-generation.md`) | Agents generate through the MCP server: built. Left: the first agent run on the user's ComfyUI server (by hand, once); the OI-90 change if the answer is "no ticks" | Phase 2 as built | `agent-runs.md`, `mcp-and-agents.md`, `comfyui.md` |
| 3 | Phase 2 leftovers, groups 4 and 5 (`phase-02-screens.md`, S2-1 to S2-17 built) | ComfyUI failures, the address and licence dialogs; drop import, brief form, slot view, import, relink and package dialogs, the campaign grid | Phase 2 as built | `screens-campaign.md`, `screens.md`, `comfyui.md`, `comfyui-workflows.md`, `brief-and-templates.md`, `assets.md`, `api-commands.md`, `api-queries-events.md`, `security.md`, `testing.md` |
| 4 | Phase 3 (`phase-03.md`) | The user lays out a post by hand | Its own wave table in `phase-03.md`, every slice built; left: the exit check | `scene.md`, `editor.md`, `editor-commands.md`, `data-model.md`, `data-rules.md`, `assets.md`, `screens.md`, `structure.md`, `security.md`, `testing.md` |
| 5 | Phase 4 (`phase-04.md`) | Empty slots can be filled with AI | Phase 3. Every slice built (P4-1 to P4-20, P4-T3); left: the stakeholder's hand checks in `phase-04.md`, "Status" | `ai-jobs.md`, `screens-ai.md`, `providers.md`, `providers-adapters.md`, `jobs.md`, `brief-and-templates.md`, `agent-runs.md`, `api-commands.md`, `editor.md`, `screens.md`, `testing.md` |
| 5a | Look pack (`look-pack.md`) | Ads that can look like the five reference ads (D-094): background colour, text boxes, shades, starter layouts | Every slice built (LK-1 to LK-7); left: the looks by hand and Windows | `starter-layouts.md`, `scene.md`, `editor.md`, `editor-commands.md`, `data-model-campaign.md`, `brief-and-templates.md`, `screens.md`, `testing.md` |
| 5b | Approvals by link (`approvals.md`) | Reviewers sign off on variants through a password-protected link; the sign-offs show in the app (D-095). Built, with the Round 2 gallery (`round-2-approvals.md`, `round-2-approvals-video.md`). Left: the stakeholder deploys the service (`approvals-service/README.md`) and checks it by hand | Its wave table | `approvals.md`, `approvals-client.md`, `approvals-commands.md`, `approvals-service.md` (and its `-data`, `-visitor`, `-tests` files), `approvals-gallery.md`, `storage-and-publish.md`, `scene.md`, `security.md`, `screens.md`, `testing.md` |
| 5c | App style (`app-style.md`) | The built screens take the prototype's look; nothing they do changes (D-084). Built (ST-1 to ST-14) | Its wave table | `app-style.md`, `screens.md`, `structure.md`, `testing.md` |
| 6 | Phase 5 (`phase-05.md`; slices in `phase-05-slices.md` and `phase-05-screens.md`) | One master drives a grid of variants | Phase 4. Every slice built (P5-1 to P5-19); left: the one ComfyUI extend run (U-13) and Windows | `links-and-sync.md`, `screens-variants.md`, `data-model-campaign.md`, `data-rules.md`, `api-commands.md`, `providers-adapters.md`, `comfyui-workflows.md`, `agent-runs.md`, `screens.md`, `screens-campaign.md`, `testing.md` |
| 7 | Phase 6 (`phase-06.md`) | Translations with approval, brand and legal checks | Phase 5. Built | `data-rules.md`, `export-and-checks.md`, `providers.md`, `providers-adapters.md`, `screens.md`, `testing.md` |
| 8 | Phase 7 (`phase-07.md`) | Video variants preview as they will export | Phase 6, OI-09, OI-30. Every slice built (P7-1 to P7-24); the one paid fal run is done; left: Windows | `providers.md`, `providers-adapters.md`, `jobs.md`, `cancel.md`, `assets.md`, `data-rules.md`, `infra-and-settings.md`, `security.md`, `screens.md`, `testing.md` |
| 9 | Phase 8 (`phase-08.md`) | Deliverables and a report on disk | Phase 7. Built | `export-and-checks.md`, `infra-and-settings.md`, `screens.md`, `testing.md` |
| 10 | Phase 9 (`phase-09.md`) | A campaign's deliverables in S3 or Dropbox | Phase 8, OI-18 for the hand proof. Every slice built (P9-1 to P9-15); left: the stakeholder's hand proofs | `storage-and-publish.md`, `security.md`, `infra-and-settings.md`, `screens.md`, `testing.md` |
| 11 | Phase 10 (`phase-10.md`) | Claude can read and edit open projects | Phases 3, 6, 7; group 3. Every slice built (P10-1 to P10-15); left: the stakeholder's hand checks | `mcp-and-agents.md`, `api-principles.md`, `api-commands.md`, `api-queries-events.md`, `security.md`, `screens.md`, `testing.md` |
| 12 | Phase 11 (`phase-11.md`) | A repository ready to publish; nothing published (D-086). Done: the history check (P11-1), the first `README.md` (P11-4), and local release builds in place of a release workflow (D-102). Not built, held: P11-2 (`LICENSE`, the licence check; waits for the licence), P11-5 to P11-8 (the example set, npm warnings, the packaged run, the full gate) | Phases 1 to 10 | `overview.md`, `infra-and-settings.md`, `testing.md` |

### Work after Phase 10

| Work | File | State |
|------|------|-------|
| Round 2: projects, agents and the app's name | `round-2-platform.md` | Built (R2P-1 to R2P-12, R2P-5b) |
| Round 2: the editor, generation and first run | `round-2-editor.md` | Built (R2E-1 to R2E-11) |
| Round 2: the campaign page and the asset library | `round-2-campaign.md` | Built (R2C-1 to R2C-7) |
| Round 2: the approvals gallery | `round-2-approvals.md`, `round-2-approvals-video.md` | Built (R2A-1 to R2A-9, R2V-1 to R2V-8). Left: the stakeholder's deploy and the hand check in Safari and Chrome |
| Subject photos | `subject-photos.md` | Built |
| Brief brand | `brief-brand.md` | Built (BB-1 to BB-8) |
| Custom ComfyUI workflows (D-104) | `custom-workflows-slices.md` | Built (CW-1 to CW-8) |
| Make variants (D-108) | `make-variants.md` | Built (MV-1 to MV-9) |
| Subject delete (D-101) | `subject-delete.md` | Built (SUBJ-1) |
| Design wave | `design-wave.md`, `design-wave-screens-a.md`, `design-wave-screens-b.md` | Built (Wave 1 and Wave 2). Not built: the clean-up slice Z-1 (removes the unused `--font-size-*` aliases and `.iconOnly`) |
| Things for the stakeholder to verify | `round-2-verify.md`, `round-3-verify.md`, `design-wave-verify.md` | Running lists of choices made without him; no build work |

Every developer also reads `overview.md`. Open questions are in `open-items.md`; the assumptions made meanwhile are in `assumptions.md`.

## Rules for every phase

- **Screens are built with their logic** (D-084). `[logic]` and `[UI]` tags show where the work lands, not when. Components are modular, one folder each, and take all styling from the shared tokens.
- **Test first.** A developer writes a failing test, then the code that passes it. A developer does not edit an existing test unless the slice lists that edit as approved.
- **One slice per developer run**, sized well under 300k tokens. A developer who finds the slice too large stops at a passing point, commits, writes `HANDOFF.md`, and hands off.
- **A slice edits only the files it owns.** The architect names them in the brief. Slices that own no shared file may run side by side in worktrees.
- **Security-class slices get a review** before they merge. The brief says "full" or "short".
- **Verification classes** (A to G) and what each runs are in `spec/testing.md`.
- **Paid calls.** Automatic tests never make a paid call. A developer may make one low-cost paid run per new feature, at the smallest size and shortest length (D-085). No agent reads a key file.
- **What leaves this machine.** `main` may be pushed to the private GitHub repository and releases made there from installers built locally (D-102). Nothing else: no deploy, no sign-in to a host, no hosted database, no real bucket or Dropbox by an agent (D-086).
- **Windows.** Agents verify on macOS only. An exit criterion that says "on both systems" is met on macOS, and Windows is listed as the stakeholder's check (D-087).
