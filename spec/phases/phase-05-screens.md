# Phase 5 — screen slices P5-14 to P5-18, exit slice P5-19

The index, the wave table, the shared files and the assumptions are in `spec/phases/phase-05.md`. The design of every screen here is `spec/screens-variants.md`; the commands are in `spec/links-and-sync.md`. Each screen slice reads `spec/screens.md` "Rules for every screen" and `spec/screens-campaign.md` "Rules for these screens" and "The campaign grid and the variant tile". Component tests live under `tests/unit/renderer/`; each has an axe check.

### P5-14 — Campaign page: Undo, Redo, one grid per direction (built)

- **Size:** medium. **Needs:** P5-1 (the command names exist); AP-11 and AP-12 merged.
- **Exists when done:** the overview shows `CampaignUndo` and then `DirectionGrids`, one section per direction with its heading, count, header row and grid in `direction-order.ts` order. The header row mounts `FanOutButton`, `SyncButton` and `DirectionMenu` from stub folders that render nothing. The campaign's Undo and Redo work by button and by key on the overview only. `campaign-view.tsx` is split so it stays under 200 lines.
- **New files:** `src/renderer/screens/campaign/campaign-undo/`; `src/renderer/screens/campaign/direction-grids/` (`direction-grids.tsx`, `direction-order.ts`, CSS); `src/renderer/screens/campaign/direction-header/`; `src/renderer/screens/campaign/campaign-view/use-campaign.ts`, `use-pre-tick.ts` (moved out of `campaign-view.tsx`, no change in behaviour). Stubs, each `index.ts` exporting a component that renders `null`, filled later: `src/renderer/dialogs/fan-out/` (`FanOutButton`, P5-16), `src/renderer/dialogs/sync-review/` (`SyncButton`, P5-17), `src/renderer/dialogs/direction-menu/` (`DirectionMenu`, P5-18). Each takes `{ projectId: string; campaign: CampaignGet; direction: DirectionRow }`.
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (the two mounts; the moves). Not `variant-grid/` or `variant-tile/`.
- **Tests first:** `tests/unit/renderer/screens/campaign/direction-order.test.ts` (one table: master first; size order; language order; image before video; then `createdAt`). `campaign-undo.test.tsx`: buttons follow `history.state` and read again on `project.changed`; each sends the campaign scope; a refusal goes to the banner; Mod+Z on the overview sends `history.undo` with the campaign scope; with a variant tab shown it does not; inside a text field it does not. `direction-grids.test.tsx`: two directions give two labelled sections and grids; the count line; the master's tile first; a plain click and a Cmd-click still reach `onChoose` and the open-behind path (the built behaviour kept).
- **Approved edits to existing tests:** `tests/unit/renderer/screens/campaign/campaign-view*.test.tsx` where they find the grid by the label "Variants" (now "Variants in {direction name}"), and where a stub needs `history.state`.
- **Shots:** `tests/shots/p5-14.shots.ts`: `150-direction-grid` (one direction; with two variants made through `variant.add` if P5-10 is merged, else the master alone), `151-campaign-undo` (after one built campaign change, such as a rule set edit, Undo enabled).
- **Exit check:** lint, typecheck, the component tests under `tests/unit/renderer/screens/campaign/`; `npm run test:e2e` (the renderer is touched).
- **Class:** D + A. No security review.
- **After:** P5-1; AP-11 and AP-12 merged.

### P5-15 — Tile actions: delete and quick look (built)

- **Size:** medium. **Needs:** P5-4, P5-14.
- **Exists when done:** each tile shows "Quick look at {title}" and, except on the master, "Delete {title}"; delete opens the warning dialog, "Delete variant" sends `variant.delete` and focus moves as designed [D-099]; quick look opens its dialog with Next, Previous and the arrow keys.
- **New files:** `src/renderer/dialogs/quick-look/` (`quick-look.tsx`, `use-variant-picture.ts`, CSS); `src/renderer/dialogs/delete-variant/` (`delete-variant.tsx`, CSS).
- **May touch:** `src/renderer/screens/campaign/variant-grid/variant-grid.tsx` (props `onQuickLook`, `onDelete`; the two buttons beside "+"); `src/renderer/screens/campaign/direction-grids/direction-grids.tsx` (passes them, holds the quick look state).
- **Tests first:** `quick-look.test.tsx`: the title; the picture from `variant.render` with `maxDimension: 1024`; "Drawing the variant…"; the refusal line; Next and Previous and the arrow keys wrap through the campaign order; "{i} of {n}"; a late reply for the earlier variant is dropped; Escape returns focus to the button. Additions to `variant-grid.test.tsx` (approved): the two buttons, none for delete on the master, focus after delete. `delete-variant.test.tsx`: the title and "This cannot be undone."; "Keep" has focus and sends nothing; "Delete variant" sends `variant.delete`; a refusal shows in the banner; after the delete the tile is gone and the campaign's Undo is not offered for it (exit criterion 4, with stubbed replies).
- **Approved edits to existing tests:** `variant-grid.test.tsx` (additions; the existing cases unchanged).
- **Shots:** `tests/shots/p5-15.shots.ts`: `152-tile-actions`, `153-quick-look`, `154-quick-look-next`, `155-delete-variant-confirm`.
- **Exit check:** lint, typecheck, the component tests named.
- **Class:** D. No security review (`variant.render` is user-only as built).
- **After:** P5-4, P5-14.

### P5-16 — Fan-out dialog (built; shot 160 not made)

- **Size:** medium. **Needs:** P5-9, P5-10, P5-14.
- **Exists when done:** `FanOutButton` opens the dialog of `spec/screens-variants.md`, "Fan-out"; "Make variants" sends `variant.fanOut`; then one `generation.runFill` per `fill` entry, each registered as attached with a finish that sends `generation.applyFill`.
- **New files:** inside the stub folder `src/renderer/dialogs/fan-out/`: `fan-out-button.tsx`, `fan-out-dialog.tsx`, `fit-choices.tsx`, `fan-out-model.ts` (pure: the pairs, the new count, the fits to send), `use-start-fills.ts`, CSS.
- **May touch:** `src/renderer/stores/run-asks.ts` (adds `generation.runFill`).
- **Tests first:** `fan-out-model.test.ts` (one table: the master's size and language always in; existing pairs not counted; a fit only for sizes of other pixels; no background picture sends `scale` for each). `fan-out-dialog.test.tsx`: wording and labels; the fit groups appear and go with the ticks; the provider select and paid line only with a fill; 0 new disables the button with its line; the sent input; a refusal in the dialog; after success, one `generation.runFill` per `fill` entry with the chosen provider and an attached registration whose finish sends `generation.applyFill`; a refused fill leaves the variants and shows in the banner. `run-asks.test.ts` (approved addition): `generation.runFill` gets the address and licence asks.
- **Approved edits to existing tests:** `run-asks.test.ts` (addition).
- **Shots:** `tests/shots/p5-16.shots.ts`: `156-fan-out-dialog`, `157-fan-out-fits`, `158-fan-out-fill-paid-line`, `159-grid-after-fan-out`, `160-fill-running`, `161-fill-placed` (fake provider). Shot 160 was not made: the fake provider finishes the fill too fast to catch it running.
- **Exit check:** lint, typecheck, the component tests named.
- **Class:** D + A. **Security check, short review:** a paid call starts only after "Make variants" with the paid line shown; the provider comes from the user's choice; no path in the window.
- **After:** P5-9, P5-10, P5-14.

### P5-17 — Sync review dialog (built)

- **Size:** medium. **Needs:** P5-13, P5-14.
- **Exists when done:** `SyncButton` with its count opens the review of `spec/screens-variants.md`, "Sync review"; "Accept all" and "Accept selected" send `sync.apply`; `master_changed` reads again.
- **New files:** inside the stub folder `src/renderer/dialogs/sync-review/`: `sync-button.tsx`, `sync-review.tsx`, `variant-changes.tsx`, `override-choice.tsx`, `sync-words.ts` (pure), `decisions.ts` (pure), CSS.
- **Tests first:** `sync-words.test.ts` (every group word; `style.color`, `animation.exit`). `decisions.test.ts` (accept all, accept selected, the override choices, no choice means keep mine). `sync-review.test.tsx`: the button's count and disabled state; loading, empty and listed states; the new text line; the Phase 5 translation line; the override radios with "Keep mine" chosen; the sent input with `masterRev`; `master_changed` shows its message and reads again; success closes; a title holding `<b>` drawn as text.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/p5-17.shots.ts`: `162-out-of-date-badges`, `163-sync-review`, `164-sync-overrides`, `165-sync-up-to-date`.
- **Exit check:** lint, typecheck, the component tests named.
- **Class:** D + A. No security review.
- **After:** P5-13, P5-14.

### P5-18 — Direction menu and dialogs (built)

- **Size:** small. **Needs:** P5-11, P5-14.
- **Exists when done:** `DirectionMenu` with "New direction from this master…", "Rename…" and "Delete direction…", each dialog as designed.
- **New files:** inside the stub folder `src/renderer/dialogs/direction-menu/`: `direction-menu.tsx`, `name-dialog.tsx` (new and rename), `delete-direction.tsx`, `next-name.ts` (pure), CSS.
- **Tests first:** `next-name.test.ts` ("Direction 2" after "Direction 1"; skips a taken number). `direction-menu.test.tsx`: the three items; the new-direction default name and the sent input; rename; a `direction_name_taken` refusal in the dialog; delete's sentence with the count, "Keep" focused, disabled with its hint for the only direction.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/p5-18.shots.ts`: `166-new-direction-dialog`, `167-two-direction-grids`, `168-rename-direction`, `169-delete-direction-confirm`.
- **Exit check:** lint, typecheck, the component tests named.
- **Class:** D. No security review.
- **After:** P5-11, P5-14.

### P5-19 — Workflows 5.3 and 5.4, real runs, exit check (built)

- **As built:** shot 171 (a failed fill with Retry) was not made: the built app cannot set the fake provider to fail, and no test hook was added for it. The one ComfyUI extend run is still owed (U-13, `spec/open-items.md`).

- **Size:** medium. **Needs:** every other P5 slice; SP-5 merged.
- **Exists when done:** both workflows pass end to end with the fake provider; the real runs below are made and reported; the "Not built" marks in `spec/links-and-sync.md`, `spec/screens-variants.md` and the rows in `spec/api-commands.md` and `spec/api-queries-events.md` are reported for the orchestrator to change to "Built (P5-n)" (the developer does not edit the spec).
- **New files:** `tests/e2e/workflow-5-3.spec.ts`, `tests/e2e/workflow-5-4.spec.ts`, `tests/e2e/variants-steps.ts` (helpers: fan out, open the sync review, accept selected); `tests/shots/p5-19.shots.ts`.
- **May touch:** `tests/e2e/screen-tour.ts` (one stop for the overview with two directions) only if SP-5 is merged.
- **Workflow 5.3:** a campaign through the form (SP-5's helpers), fan-out to two more sizes and one more language; change the master headline's colour and its copy; the three linked variants show "Out of date"; on one, change the colour by hand first (an override); the review flags it; tick one change and "Accept selected"; one variant stays out of date; "Accept all" clears the rest, with "Keep mine" for the flagged one; that variant keeps its colour.
- **Workflow 5.4:** "New direction from this master…" named "Studio"; two grids show; in the new master, choose another background picture; fan out "Studio" with one size on "Generate fill" (fake provider); the fill places on that size and the tile shows "New result" then the picture; Cmd-click a tile opens its tab behind; quick look Next once; delete a variant: the ask dialog says "This cannot be undone.", and after the delete the campaign's Undo is off (D-099: deleting a variant or campaign has no undo, only the ask dialog).
- **Real runs** (each once, reported with time, model ID and picture size, never a key or a picture's contents): `tests/live/gemini-extend.live.test.ts` at the smallest size (D-085). One ComfyUI extend run through the app at the lowest settings only if a non-draft extend workflow exists by then; otherwise report "owed: `moss-extend` is still draft (U-13)".
- **Shots:** `170-tour-two-directions`, `171-fill-retry` (a failed fill with Retry, fake provider set to fail).
- **Exit check:** lint, typecheck, `npm run test:coverage`, `npm run build`, `npm run test:build`, `npm run test:e2e`; the exit criteria of `spec/phases/phase-05.md`, checked one by one in the report.
- **Class:** D + a G-style run (end-to-end on a desktop). **Security class, full review** only for the live test file (a paid call; it reads its key itself, prints no key).
- **After:** every other P5 slice; SP-5 merged.

Pictures 172 to 179 are spare for retakes.
