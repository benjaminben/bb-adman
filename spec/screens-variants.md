# Screens: variants, directions, fan-out and sync

Built (Phase 5; slices P5-14 to P5-19 in `spec/phases/phase-05-screens.md`). The campaign overview's grids per direction, the campaign's Undo and Redo, the tile's actions, quick look, the fan-out dialog, the sync review and the direction dialogs. The commands are in `spec/links-and-sync.md`. Every rule of `spec/screens.md` ("Rules for every screen") and `spec/screens-campaign.md` ("Rules for these screens") holds: one folder per component, CSS from `src/renderer/ui/tokens.css` only, dialogs on `ui/dialog-frame/`, a refusal shown in the dialog as well as the banner, counts with "(s)". No new token is expected.

These are choices made without a design sign-off; the UI pass may change any of them.

## The campaign page (Round 2)

Built (R2C-1 to R2C-4). Full design: `spec/phases/round-2-campaign.md`, design additions 1 to 4.

- **The head** (`campaign-head/`): "Back to project", the campaign name, the approval bar, "Export…", "Reports", "Publish…", "Assets" (opens the Assets panel, `spec/screens-campaign.md`). Under it the paid count and the variant tab row ("Overview" and the open variants).
- **The view bar** (`campaign-overview/`), inside Overview: tabs "Variants", "Checks" and "Translations" on the left, the campaign's Undo and Redo on the right. "Checks" carries a warning count badge ("{n} warning(s)"; no badge at 0). The chosen tab is kept while the campaign page is open.
- **Variants tab** (`variants-tab/`): the hint "Click a post to select it. Double-click it, or press Enter, to open it."; the direction grids; then the line "Runs and panels below are for: …", the slot view, the picture panel and the run list, which act on the selected variant. The "Make a video" card is being removed (R2E-9, in progress): videos are made in the editor's Generate panel.
- **Checks tab**: the check panel, then the rule set panel. **Translations tab**: the translation panel; with one language, a line says there is nothing to translate.
- **A direction is a grid** (`variant-grid/`, `grid-axes.ts`): rows are sizes, columns are languages, the master top left. A row head shows the size label and "{width}×{height}" (the size once when it has no name of its own); a column head the language name and code. An image and a video of the same size and language share a cell. A row never wraps: the direction's box scrolls sideways, with the row heads kept in view. The master tile has a "Master" badge and a tinted ground.
- **Select, then open** (R2C-3): a click selects a tile; a double-click or Enter opens its tab; Mod+Enter, Cmd-click and "+" open it behind. Arrow keys, Home and End move the selection between tiles (`grid-moves.ts`); Delete or Backspace opens the delete warning for that tile (never for the master).
- **Translations show their source** (R2C-4): each row shows "{primary language} (source)" with the source text beside the labelled translation field, and the tab says "These are the texts on the posts themselves. A change here changes that post at once."

## The overview

`src/renderer/screens/campaign/campaign-view/` mounts, in its overview, the view bar above (with `campaign-undo/`) and then `direction-grids/` in the Variants tab. The rest (the "Runs and panels below are for" line, slot view, panels, run list) stays as built.

**`campaign-undo/`**, component `CampaignUndo`. Props `projectId`, `campaignId`.

- Two buttons, "Undo" and "Redo", in a group labelled "Campaign changes". Each sends `history.undo` / `history.redo` with `scope: 'campaign:{campaignId}'`; a refusal shows in the error banner.
- Enabled from `history.state` for that scope, read on mount and again on each `project.changed` for the project.
- Keys: Mod+Z, Mod+Shift+Z (and Ctrl+Y on Windows), through the `undo` and `redo` entries of `SHORTCUTS`, only while the overview tab is shown and the focus is not in a text field. The editor's keys keep acting on the variant's list in a variant tab.

**`direction-grids/`**, component `DirectionGrids`. Props `projectId`, `campaign: CampaignGet`, `chosenId`, `onChoose`, `onOpenBehind`, `onQuickLook`.

- One section per direction, in `directions` order, labelled by its heading: a level-3 heading "{direction name}", then "{n} variant(s)".
- A row of direction controls under the heading (`direction-header/`): `FanOutButton`, `SyncButton` and `DirectionMenu`, each from its own dialog folder, each given `projectId`, the campaign and the direction.
- Then a `VariantGrid` with that direction's variants, labelled "Variants in {direction name}", in the order of `direction-order.ts` (pure, A-144): the master first, then by the campaign's `sizes` order, then its `languages` order, then image before video, then `createdAt`.

## The tile's actions

`VariantGrid` gains `onQuickLook?(variantId)` and `onDelete?(variantId)`. With them, the tile's `actions` hold, after the built "+": "Quick look at {title}" and, for a variant that is not the master, "Delete {title}".

- Delete opens a warning dialog (`src/renderer/dialogs/delete-variant/`) [D-099]: "Delete {title}?" with "This cannot be undone." and "Keep" (focused) / "Delete variant". "Delete variant" sends `variant.delete`; the campaign's Undo does not bring the variant back (A-140). Focus then goes to the next tile's main button, else the previous one, else the direction's heading. A refusal (`jobs_running`, `master_variant`) shows in the banner.
- An agent's `variant.delete` still asks the user first (policy ask; Phase 10).

## Quick look

`src/renderer/dialogs/quick-look/` [REQ: FR-244, P2]. View only; no tab opens (A-142).

- Title "{title} · {sizeLabel} · {language}". The picture from `variant.render { projectId, variantId, maxDimension: 1024 }`, shown through an object URL, `alt` "{title}", fitted inside the dialog with its shape kept. While it draws: "Drawing the variant…". Refused: "The picture could not be drawn." A reply for a variant no longer shown is dropped. Drawn again when that variant's `rev` changes.
- "Previous" and "Next" buttons, and the Left and Right arrow keys, move through every variant of the campaign in the grids' order, wrapping at the ends. A line "{i} of {n}".
- Escape or "Close" closes; focus goes back to the tile's "Quick look" button.

## Fan-out

`src/renderer/dialogs/fan-out/`: `FanOutButton` ("Fan out…") and the dialog.

- Title "Fan out {direction name}".
- **Sizes**: one checkbox per campaign size, "{label} ({width}×{height})". The master's size is ticked and disabled.
- **Languages**: one checkbox per campaign language. The master's language is ticked and disabled.
- A size and language pair the direction already has in every chosen format is not made again; the count line says how many are new.
- **Backgrounds**: for each ticked size whose pixel size differs from the master's, a group "Background for {label} ({width}×{height})" with three choices (A-145): "Scale: show the whole picture, black at the edges" (the default), "Crop: fill the size and hide the edges", "Generate fill: extend the picture with AI". With no background picture on the master, the groups are not drawn and every fit is sent as `scale`.
- **Fill**: with one or more "Generate fill", the provider select (`screens/campaign/provider-select/`, image providers) and the paid line "This will use {n} generation(s) with {provider}." (`n` the sizes with fill), as the run dialog words it. The dialog was opened to make something, so "Make variants" is the one click that pays (C-15, `spec/screens.md`, "Rules for every screen"): the paid lines sit directly above the buttons and are in the dialog's accessible description (DLG-4 of the design wave links them).
- **The text-call line** (P6-15, built in `fan-out-model.ts`): `n` is the number of new languages other than the master's (it may overstate the paid requests, since brief copy or a missing key starts none, but never understates them). None at 0. Otherwise one of four forms: no translating provider, "No provider can translate yet. The new texts stay marked as missing a translation."; the fake provider, "Translating {n} language(s) uses the fake provider. Nothing is charged."; a local provider, "Translating {n} language(s) runs on {provider}. Nothing is charged."; a paid one, "Translating {n} language(s) sends up to {n} paid request(s) to {provider}."
- The line "This makes {n} variant(s)." and the button "Make variants", disabled at 0 with "Nothing new to make."; "Cancel".
- **Formats**: a fieldset "Formats" with the checkboxes "Image" (ticked at first) and "Video". The dialog sends the ticked formats in the order image, video. With none ticked, "Make variants" is disabled and the line "Choose at least one format." shows.
- Counts: one variant per size × language × format the direction lacks. One translation per new language other than the master's, whatever the formats. The fill line is unchanged: Video adds no paid request.
- On success the dialog closes. For each entry of the reply's `fill`, the window sends `generation.runFill { variantId, provider }` through the app store's `command`, so the key, address and licence dialogs work as for a picture run (`run-asks.ts` gains `generation.runFill`). Each started job is registered in the attached store with owner `{ projectId, variantId }` and a finish that sends `generation.applyFill { jobId }`. A refused fill shows in the banner; the variants stay with their scaled background. The dialog also registers the translation jobs it started (the reply's `translationJobIds`, optional: absent means none) with the campaign owner `{ projectId, campaignId }`, so closing the campaign tab warns while they run.
- While fills run, the tiles show "Running". A failed fill shows on the variant's run as any failed run, with its Retry (`job.retry`).

## Sync review

`src/renderer/dialogs/sync-review/`: `SyncButton` and the dialog.

- **The button**: "Sync {n} out of date…" with `n` the direction's variants whose `badges.outOfDate` is true; at 0, "Nothing to sync", disabled.
- Title "Sync {direction name}". Reads `sync.preview` on open. "Reading the changes…"; "Every variant is up to date." when the reply has none.
- One group per variant, headed "{title} · {sizeLabel} · {language}" with its thumbnail (`VariantThumbnail`, alt empty). One checkbox per change, starting unticked (A-138):
  - update: "{layer name}: {group words}", the words from `sync-words.ts` (pure): copy "text", style "style", geometry "position and size", source "picture", timing "timing", animation "animation". With a copy change, under it: "New text: {text}".
  - Phase 5 translation stand-in: "No translation yet. The text stays as it is and is marked as missing a translation."
  - add-layer: "{layer name}: new layer from the master". remove-layer: "{layer name}: removed from the master".
  - Each blocked path, under its change: "Changed on this variant: {path words}" and two radios, "Keep mine" (the default) and "Take the master's". Path words: the group word, and for `style.*` and `animation.*` the field after a colon, for example "style: colour".
- "Accept all" sends every change with `accept: true`; "Accept selected" only the ticked ones (disabled with none ticked); "Cancel". Both send `sync.apply` with the reply's `masterRev`.
- On `master_changed` the dialog shows the message and reads `sync.preview` again. On success it closes. Changes left unticked stay out of date.

## Direction dialogs

`src/renderer/dialogs/direction-menu/`: `DirectionMenu`, a menu button "Direction" with three items.

- "New direction from this master…": a dialog "New direction" with the field "Name" (default "Direction {n}", the next free number) and "Make direction". Sends `direction.createFromMaster`. The new section appears below.
- "Rename…": a dialog "Rename {name}" with "Name", "Rename". Sends `direction.rename`.
- "Delete direction…": a dialog "Delete {name}?" with "Its {n} variant(s) go with it. This cannot be undone." [D-099] and "Keep" (focused) / "Delete direction". Disabled with the hint "A campaign keeps at least one direction." when it is the only one. Sends `direction.delete`.
- The name rules and refusals are the command's; a refusal shows in the dialog.
