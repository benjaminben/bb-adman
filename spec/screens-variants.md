# Screens: variants, directions, making variants and sync

Built (Phase 5, Round 2, then the design wave's CAMP-1, CAMP-2, DLG-4b and DLG-7). The campaign's Variants tab with its grids per direction, the campaign's Undo and Redo, the tile's marks and actions, quick look, the "Make variants" dialog, the sync review and the direction dialogs. The campaign head and the "Campaign" tab strip are in `spec/screens-campaign.md`. The commands are in `spec/links-and-sync.md`. Every rule of `spec/screens.md` ("Rules for every screen") and `spec/screens-campaign.md` ("Rules for these screens") holds: one folder per component, CSS from `src/renderer/ui/tokens.css` only, dialogs on `ui/dialog-frame/`, a refusal shown in the dialog as well as the banner, real plurals.

These are choices made without a design sign-off; a later UI pass may change any of them.

## The Variants tab

Built (R2C-1 to R2C-3, CAMP-1, CAMP-2, CAMP-7). `src/renderer/screens/campaign/variants-tab/`, `direction-grids/`, `direction-header/`, `variant-grid/` (`grid-axes.ts`, `grid-heads.tsx`, `grid-moves.ts`, `tile-actions.tsx`), `variant-tile/` (`tile-strip.tsx`, `tile-targets.ts`, `badge-words.ts`). Full design: `spec/phases/round-2-campaign.md`, design additions 1 to 3.

- The tab holds the direction grids only. Pictures and videos are made in the editor's Generate panel; runs are followed in Activity (CAMP-7).
- **One section per direction**, in `directions` order, labelled by its heading. **The direction header** (`direction-header/`) is one line: the name (`h3`), a count chip "{n}" (hidden text "{n} variants"), on the first direction an InfoTip "About Variants" holding "Click a post to select it. Double-click it, or press Enter, to open it.", then "Make variants…" (was "Fan out…"; the new words are not built, MV-1), "Sync {n}" (named "Sync {n} out of date…", shown only while something in the direction is out of date) and the direction's More menu "More actions for {name}" with "New direction…", "Rename…" and "Delete direction…". Each control comes from its own dialog folder; none sends anything on its own click.
- **A direction is a grid** (`variant-grid/`, labelled "Variants in {direction name}"): rows are sizes, columns are languages, the master top left. A column head shows the language name, then the code muted; a row head the size label, then "{width}×{height}" muted (the size once when the label is only the size written another way). An image and a video of the same size and language share a cell. A row never wraps: the direction's box scrolls sideways, with the row heads kept in view. Order within a direction follows `direction-order.ts` (pure, A-144): the master first, then the campaign's `sizes` order, then its `languages` order, then image before video, then `createdAt`.
- **Select, then open** (R2C-3): a click selects a tile; a double-click or Enter opens its tab; Mod+Enter and Cmd-click (Ctrl-click on Windows) open it behind. Arrow keys, Home and End move the selection between tiles (`grid-moves.ts`); Delete or Backspace opens the delete warning for that tile (never for the master). The master is selected at the start; the variant shown last is the selected one.

## The variant tile

`variant-tile/`, component `VariantTile`. Props: `variant`, `chosen`, `onChoose`, `onOpen?`, `onOpenBehind?`, `preview?`, `actions?`, `footer?`.

- **The main button** is the tile's picture (`preview`, the drawn thumbnail; else a box in the variant's shape with its size label). It is named and titled "{title} · {width}×{height} · {language} · {format}", with " · master" on the master; `aria-pressed` marks the selected tile, drawn with an accent edge. The title shows under the picture only when titles differ within the direction. The master has a ★ corner titled "Master", a video a film corner titled "Video"; both are hidden from the name, which already says so.
- **The strip** under the picture (`tile-strip.tsx`, outside the main button): a group "Marks for {title}" holding the marks, then the approval marks (`footer`), then the actions at its right end.
- **Marks**, in this order, only when true: "Running", "New result", "Text does not fit", "File missing", "Translation not approved", "Out of date", "Check warning", "Not checked" (`badge-words.ts`). Each is a `StatusMark` with an icon and no label; its word is its tooltip and accessible name, so a test finds it by `title` or by role and name, not by visible text. A mark is a button where its fix exists (`tile-targets.ts`): "Running" opens Activity; "New result" and "Text does not fit" open the variant; "File missing" opens the relink dialog; "Out of date" opens the direction's sync review; "Translation not approved" shows the Translations tab; "Check warning" and "Not checked" show the Checks tab. No mark starts a run or sends a command.
- **Approval marks** join the strip (`spec/approvals.md`): "Signed off by {n}" is a button showing "{n}" that opens the sign-off list in a popover.
- **Actions** (`tile-actions.tsx`): an eye icon button "Quick look at {title}", then a More menu "More actions for {title}" with "Open", "Open in a tab", "Quick look", "Make variants from this one…" (Not built, MV-6; on every tile, the master's included) and, except on the master, "Delete…" (last, as today). "Make variants from this one…" opens the "Make variants" dialog with that variant as the source ("Make variants", below); it sends nothing itself.
- Delete opens the warning dialog (`src/renderer/dialogs/delete-variant/`, `kind="confirm"`) [D-099]: "Delete {title}?", the description "This cannot be undone.", "Keep" (quiet, focused) and "Delete variant" (danger primary, a spinner inside while it sends). "Delete variant" sends `variant.delete`; the campaign's Undo does not bring the variant back (A-140). Focus then goes to the next tile's main button, else the previous one, else the direction's heading. A refusal (`jobs_running`, `master_variant`) shows as a danger DialogAlert at the top of the body. An agent's `variant.delete` still asks the user first (policy ask; Phase 10).

## Campaign Undo and Redo

`campaign-undo/`, component `CampaignUndo`. Props `projectId`, `campaignId`. Drawn at the end of the "Campaign" tab strip.

- Two icon buttons, "Undo" and "Redo", in a group labelled "Campaign changes". Each sends `history.undo` / `history.redo` with `scope: 'campaign:{campaignId}'`; a refusal shows in the error banner.
- Enabled from `history.state` for that scope, read on mount and again on each `project.changed` for the project.
- Keys: Mod+Z, Mod+Shift+Z (and Ctrl+Y on Windows), through the `undo` and `redo` entries of `SHORTCUTS`, only while a campaign view is shown and the focus is not in a text field. The editor's keys keep acting on the variant's list in a variant tab.

## Quick look

`src/renderer/dialogs/quick-look/`, `kind="review"` [REQ: FR-244, P2]. View only; no tab opens (A-142).

- Title "{title} · {sizeLabel} · {language}". The picture from `variant.render { projectId, variantId, maxDimension: 1024 }`, shown through an object URL, `alt` "{title}", fitted inside the dialog with its shape kept. While it draws, a hidden status "Drawing the variant…". Refused: "The picture could not be drawn." A reply for a variant no longer shown is dropped. Drawn again when that variant's `rev` changes.
- Icon buttons "Previous" and "Next" at the picture's sides, and the Left and Right arrow keys, move through every variant of the campaign in the grids' order, wrapping at the ends. A counter "{i} / {n}".
- Escape or "Close" closes; focus goes back to the control that opened it.

## Make variants

The dialog that runs `variant.fanOut` (the command keeps its code name; `spec/make-variants.md`, "Names"). Built as "Fan out"; the new words (MV-1) and the source mode (MV-6) are not built.

`src/renderer/dialogs/fan-out/`: `FanOutButton` ("Make variants…", `plus` icon) and the dialog, `kind="run"` (`fan-out-chips.tsx`, `chip-group.tsx`, `fit-choices.tsx`, `cost-line.tsx`, `fan-out-costs.ts`, `fan-out-model.ts`); MV-6 adds `make-from-variant.tsx`, the dialog opened from a tile's menu.

- Title "Make variants of {direction name}". **From a tile's menu** (the source mode): "Make variants from {title} · {sizeLabel} · {language}", and as the body's first line: "New variants start from this one: its words, boxes, pictures and look. They stay linked to the master." On the master's tile the dialog is the header's, with the header's title.
- "The source" below is the master, or the tile's variant in the source mode. `FanOutBasis.master` holds the source's facts; `FanOutBasis` gains `primaryLanguage`, the campaign's main language.
- **Sizes**, **Languages** and **Formats** are toggle chips (buttons with `aria-pressed`), named as "{label} ({width}×{height})", the language, "Image" / "Video". The source's size and language chips are pressed and disabled. Formats start with the source's format on; the last format left on is `aria-disabled`.
- A size, language and format the direction already has is not made again. When the choice holds any, other than the source's own, a line says so: "1 of these already exists and stays as it is." / "{n} of these already exist and stay as they are." The locked chips' tooltips are "The master's size" and "The master's language" from the header, and "The size of {title}" and "The language of {title}" from a tile. The dialog starts with the source's format ticked, the master's included (a video master starts on Video).
- **Backgrounds**: for each chosen size whose pixel size differs from the source's, a group "Background for {label} ({width}×{height})" showing the size's label and three icon radios, each named and titled by its words (A-145): "Scale: show the whole picture, black at the edges" (the default), "Crop: fill the size and hide the edges", "Generate fill: extend the picture with AI". With no background picture on the source, the groups are not drawn and every fit is sent as `scale`. These choices do not change with the new box placement: they place only the background. There is no choice for text: boxes and text sizes follow `spec/make-variants.md` with no option.
- **Fill provider**: with one or more "Generate fill", the provider select (`screens/campaign/provider-select/`, image providers, with the trial mark). Each option shows the provider and model words (`spec/providers.md`, "Model words"); ComfyUI's model is that of the workflow a fill would get. With fills and no provider, a warn DialogAlert "No provider can do this yet." with "Settings".
- **Cost lines**, last in the body and in `aria-describedby` (DLG-4b, C-15), computed from the same state the click sends. `{Provider}` in these lines is the provider and model words: the fill provider with its picture model, the text provider with its text model ("Paid: up to 3 translations → Google · Gemini 3.5 Flash-Lite"):
  - fills: "Paid: {n} fills → {Provider}" (a MoneyLine), or "{n} fills on {Provider}. Nothing is charged.";
  - translations (P6-15; `n` is the number of new languages other than the campaign's main language and the source's language, which may overstate the paid requests but never understates them): "Paid: up to {n} translations → {Provider}" (a MoneyLine, the Settings text provider); "Translating {n} languages uses the fake provider. Nothing is charged."; "Translating {n} languages runs on {Provider}. Nothing is charged."; with no translating provider "No provider can translate yet. The new texts stay marked as missing a translation." None at 0.
- Foot: "Cancel" (quiet) and "Make {n} variants", the one click that pays. With nothing new it reads "Make variants", disabled, titled "Nothing new to make".
- Counts: one variant per size × language × format the direction lacks. One translation per new language other than the main language and the source's, whatever the formats. One fill per size on "Generate fill" whose new variant in the source's language this click makes. Video adds no paid fill.
- The click sends `variant.fanOut` with the lists, formats and fits, and in the source mode `sourceVariantId`. Nothing is sent before it.
- On success the dialog closes. For each fill to start (`fillsToStart()`), the window sends `generation.runFill { variantId, provider }` through the app store's `command`, so the key, address and licence dialogs work as for a picture run (`run-asks.ts` has `generation.runFill`). Each started job is registered in the attached store with owner `{ projectId, variantId }` and a finish that sends `generation.applyFill { jobId }`. A refused fill shows in the banner; the variants stay with their scaled background. The dialog also registers the translation jobs it started (the reply's `translationJobIds`, optional) with the campaign owner `{ projectId, campaignId }`, so closing the campaign tab warns while they run.
- While fills run, the tiles show "Running". A failed fill shows in Activity with its Retry (`job.retry`).

## Sync review

`src/renderer/dialogs/sync-review/`: `SyncButton` and the dialog, `kind="review"` (`sync-list.tsx`, `variant-changes.tsx`, `override-choice.tsx`, `translate-ask.tsx`, `translation-line.tsx`).

- **The button**: "Sync {n}" (named "Sync {n} out of date…"), with `n` the direction's variants whose `badges.outOfDate` is true; not drawn at 0. A tile's "Out of date" mark opens the same dialog.
- Title "Sync {direction name}". Reads `sync.preview` on open: "Reading the changes…" with a spinner; "Every variant is up to date." when the reply has none.
- **Two panes.** Left, a list with one row per out-of-date variant (a button and a listitem named "{title} · {sizeLabel} · {language}", with its thumbnail). Right, the picked variant's changes. Ticks and choices are kept by the dialog, so picking another row changes nothing that is sent.
- One checkbox per change, starting unticked (A-138):
  - update: "{layer name}: {group words}", the words from `sync-words.ts` (pure): copy "text", style "style", geometry "position and size", source "picture", timing "timing", animation "animation". With a copy change, under it: "New text: {text}".
  - add-layer: "{layer name}: new layer from the master". remove-layer: "{layer name}: removed from the master".
  - Each blocked path, under its change: "Changed on this variant: {path words}" and radios "Keep mine" (the default) and "Take the master's", drawn as segments "Mine" | "Master". Path words: the group word, and for `style.*` and `animation.*` the field after a colon, for example "style: colour".
- **Translations** (P6-16, P6-18): a translated copy change starts its sync translation; the dialog reads the changes again when one ends. A variant still waiting for its language has the mark "No {language}" and "Translate": with a paid text provider the first click shows the two-step paid line (`ui/paid-confirm/`, a MoneyLine with "Confirm" and "Cancel"), and only Confirm sends. A typed translation can be given in place.
- Foot: "Cancel", "Accept selected" (disabled with none ticked) and "Accept all" (primary). Both send `sync.apply` with the reply's `masterRev`.
- On `master_changed` the dialog shows the message and reads `sync.preview` again. On success it closes. Changes left unticked stay out of date.

## Direction dialogs

`src/renderer/dialogs/direction-menu/`: `DirectionMenu`, the direction's More menu.

- "New direction…": a `form` dialog "New direction" with the field "Name" (default "Direction {n}", the next free number) and "Make direction". Sends `direction.createFromMaster`. The new section appears below.
- "Rename…": a `form` dialog "Rename {name}" with "Name", "Rename". Sends `direction.rename`.
- "Delete direction…": a `confirm` dialog "Delete {name}?" with "Its {n} variants go with it. This cannot be undone." [D-099] and "Keep" (quiet, focused) / "Delete direction". The menu item is disabled, with the reason "A campaign keeps at least one direction." in its title, when it is the only one. Sends `direction.delete`.
- The name rules and refusals are the command's; a refusal shows in the dialog.
