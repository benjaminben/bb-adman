# Make variants

How new variants of a direction are made: where each box goes in a new size, how text gets a size that fits, the screen's name for it, and making new variants from any variant, not only from the master [D-108]. Read with `spec/links-and-sync.md` ("Fan-out"), `spec/data-rules.md` (the follow rules), `spec/starter-layouts.md` and `spec/screens-variants.md` ("Make variants").

**State.** Built: the name (MV-1) and the pure helpers `place-box.ts`, `source-layout.ts`, `fit-text.ts` with the `sourceVariantId` schema field (MV-2); the placement in `planVariant` (MV-3), a new variant's values from its source and `planNewVariant` (MV-4), and the fit when a translation run first fills a text (MV-5). Not built: the dialog from a tile, the command, the quickstart (MV-6 to MV-9). Slices MV-1 to MV-9 in `spec/phases/make-variants.md`. Assumptions A-407 to A-420 are at the end of this file.

[REQ: FR-075, FR-076, FR-078–FR-083, FR-098, R-02]

## Names

- **"Make variants"** is the word for this action everywhere a person or an agent reads it: the direction's button "Make variants…", the dialog "Make variants of {direction}", the tile's menu item "Make variants from this one…", messages and the agent's refusal. It says what the click does; "fan out" did not.
- **Code names stay.** The command is still `variant.fanOut`, the folder `src/renderer/dialogs/fan-out/`, the files `fan-out-*.ts`, the types `FanOut*`. A rename would touch the agent policy table and many tests and change nothing a person sees.
- **In the spec**, "fan-out" names the command and its steps (`spec/links-and-sync.md`, `spec/data-rules.md`); "Make variants" names what the screen shows.

**Every visible word that changes** (slice MV-1 changes them all; it greps `src/renderer`, `src/main`, `src/shared` and `README.md` for "fan out", "fan-out" and "Fan out" first, so a place added since is not missed):

| Where | Today | New |
|-------|-------|-----|
| `src/renderer/dialogs/fan-out/fan-out-button.tsx`, the direction header button | "Fan out…" | "Make variants…" |
| `src/renderer/dialogs/fan-out/fan-out-dialog.tsx`, the dialog title | "Fan out {direction}" | "Make variants of {direction}" |
| `src/main/commands/variant/fan-out.ts`, refusal `too_many_variants` | "Fan-out can make at most 200 variants at a time." | "You can make at most 200 variants at a time." |
| `src/main/commands/agent-policy.ts`, the action text of `variant.fanOut` (an agent reads it in "Agents cannot {action} in this version…") | "run fan-out" | "make many variants at once" |
| The empty direction's action (`spec/phases/design-wave-screens-b.md`, CAMP-2), when built | "Fan out…" | "Make variants…" |

Nothing else a person or agent reads holds the words today: no MCP tool description, no Activity line, no README line. The primary button "Make {n} variants" and its idle form "Make variants" already fit and stay.

## Where a box goes in a new size

This lives in `planVariant` (`src/shared/links/fan-out-plan.ts`). It replaces the old rule that kept each box's centre at the same share of the canvas, which broke a shared left margin into several left edges.

"The source" is the variant the new one is made from: the direction's master, or the variant picked with "Make variants from this one…" (below). Sizes are compared in pixels, as the follow rules do [D-013]. For each layer of the source:

1. **Geometry that follows.** When the new variant has the master's pixel size, geometry follows the master, so its linked layers take the source's geometry when the source has that size too, and the master's when it does not ("Links after making", below). Nothing else here applies to them.
2. **Same pixel size as the source.** The source's geometry, unchanged.
3. **The background** is placed by the fit choice (scale, crop, fill), from the source's background picture, as today (`spec/links-and-sync.md`, "The background for a new size").
4. **A box the layout placed.** When the layer still sits exactly where the source's starter layout puts it ("Which layout", below), it goes where that layout puts it at the new size: `geometryOf(slot.box, frameOf(newSize))`, rotation 0, the layer's `crop` kept.
5. **Any other box** is anchored ("Anchoring", below).

So a master still as its layout made it comes out as the layout's rules give for each size, and a master the user moved keeps its edges. One layer moved by hand is anchored while the others still follow the layout.

### Which layout

`layoutOfLayers(layers, size, preferredId)` in `src/shared/links/source-layout.ts`, pure.

- A layer **sits as a layout places it** when its `key` is a slot the layout names, its type matches (`text` for a slot with text rules, `image` for a picture slot), its rotation is 0, and its `x`, `y`, `width` and `height` equal exactly the layout's box for that slot at the source's size. The background layer never counts.
- The source's layout is the starter layout that the most of the source's layers sit in. A tie goes to `preferredId` when it is among the tied, else to the first in `STARTER_LAYOUTS` order. When no layer sits in any layout, there is none, and every box is anchored.
- `preferredId` is the campaign's stored `brief.layout`, or the default layout's ID when the brief has none. It only breaks ties.
- **A layer a sync adds** (`sync-plan.ts`, the master's layer a variant lacks) is planned alone, but its layout is found from all of the master's layers: `planVariant` takes `layoutLayers` (absent: the layers being planned). One layer alone could match several layouts and take the wrong one's box.
- Nothing is stored. The app looks at where the boxes are, so it works the same for a master made by a brief, by an agent, by "New direction", or changed later with "Layout…".

### Anchoring

`anchoredBox(geometry, from, to, isText)` in `src/shared/links/place-box.ts`, pure. All lengths are measured in the layout's own unit, the smaller side `S` of the canvas: every gap and every length is multiplied by `k = S(new) / S(source)`. Most campaign sizes share a smaller side (1080 for 1:1, 4:5, 9:16 and 16:9), so `k` is 1 and gaps keep their pixels.

Each axis is handled alone. On the horizontal axis the gaps are `L = x` and `R = W − x − width`; on the vertical axis `T = y` and `B = H − y − height`. In this order, the first that applies:

1. **Stretch** (text layers only). Both gaps are smaller than the box's length on that axis (a wide headline): the new gaps are `round(L × k)` and `round(R × k)`, and the box fills the space between.
2. **Centre.** The two gaps differ by at most 1 pixel: the length is `round(length × k)` and the box is centred, `round((W' − length') / 2)`.
3. **Nearer edge.** Otherwise the box keeps its gap to the nearer edge (the smaller of the two), times `k`, and its length times `k`.

Then:

- Every length is at least 1 pixel. Rotation and `crop` are kept; the rule uses the box as stored, before rotation.
- **Kept inside.** A box that lay inside the source's canvas on an axis is kept inside the new canvas on that axis: its length is at most the canvas side, and it is moved in from the edge if it pokes out. A box that already ran past an edge (layout 4's subject runs off the bottom on purpose) is not pulled in.
- Pictures never stretch: a picture box stretched to a new shape would show a different crop of the photo.

Boxes that shared a left margin in the source share it in every new size, because the same gap gives the same new gap.

**Worked values** (the MV-2 and MV-3 tests use them). A 1080 × 1080 source with its boxes moved off the layout: logo picture (80, 80, 151, 151); headline text (80, 640, 920, 260); call to action text (80, 900, 454, 97).

| New size | Logo | Headline | Call to action |
|----------|------|----------|----------------|
| 1920 × 1080 (`k` 1) | 80, 80, 151, 151 | 80, 640, 1760, 260 | 80, 900, 454, 97 |
| 1080 × 1920 (`k` 1) | 80, 80, 151, 151 | 80, 1480, 920, 260 | 80, 1740, 454, 97 |
| 300 × 250 (`k` 250/1080) | 19, 19, 35, 35 | 19, 148, 262, 60 | 19, 209, 105, 22 |

The headline stretches across (both side gaps of 80 are smaller than its width) and keeps its 180-pixel gap to the bottom; the logo and the button keep their gaps to the nearer edges.

The same master as `photo-bottom-left` placed it, at 1920 × 1080: logo, headline and button all start at x = 65, the layout's margin, and each box equals that layout's box at 1920 × 1080.

## Text that fits

`src/shared/links/fit-text.ts`, pure, no measuring, so the main process, the window and the quickstart give the same numbers. It uses `startingFontSize` (`spec/starter-layouts.md`, "The starting font size") with the layer's own style as the rule.

### At creation

For each text layer of a new variant whose pixel size or language differs from the source's:

1. **Scale the pixel measures.** Four style fields are pixels: `fontSize`, `boxPadding`, `boxRadius`, `boxOutlineWidth`. Each is the source's value times `k`, rounded: `fontSize` at least 1; `boxOutlineWidth` at least 1 when the source's is above 0; each look field kept inside `LOOK_LIMITS`. With `k` = 1 nothing changes.
2. **Fit when it got tighter.** When the new words differ from the source's (another language: the brief's copy), or the new box is narrower or shorter than the source's box times `k` (each rounded), the font size becomes the largest whole size, from the scaled size down to `max(1, round(0.02 × S))`, at which `startingFontSize`'s estimate says the words fit the box. It is never larger than the scaled size. When nothing fits it is the smallest size, and the Scene's overflow check marks the layer as for any text [REQ: FR-098].
3. When the box did not get tighter and the words are the same, the scaled size stays. This keeps a size the user chose on the master, even where the estimate is more careful than the real measuring.

A new variant in the source's own size and language takes the source's style unchanged.

### When a translation arrives

A new variant in another language is made with the master's words marked missing (or the brief's words), and the translation run writes its words later. So once more: when `translation.write` writes words into a text layer whose status was `missing`, on a variant that is not the master, the font size is fitted to the new words, starting from the layer's current size and only ever smaller (`fitTranslatedText`). A shorter translation leaves the size as it is. The same command writes the style, so it stays not undoable, as `translation.write` is.

Nothing else fits text by itself: not a sync, not a later master edit, not a translation a person or agent types (`translation.set`), not a later translation run over words that were already there. Those keep the size they have; the overflow mark shows when words no longer fit, and the user changes the size or uses "Layout…".

### What a fitted size is to the link

A fitted or scaled measure is the variant's own value, so it is recorded as an override, the same way a language's own font is (`style.fontAssetId`, FR-056). On a linked layer whose key the master has, each of `style.fontSize`, `style.boxPadding`, `style.boxRadius` and `style.boxOutlineWidth` whose value now differs from the master layer's is added to `overrides` (once, after the paths already there). One that equals the master's is not added, so the common case (a 1080-based size in the master's language) adds nothing and still follows the master's size.

What follows from that, with no change to the follow rules or to sync:

- The rest of the style still follows: a new colour or weight on the master reaches the variant at the next sync.
- A new font size on the master makes the variant out of date for style; the sync review shows "Changed on this variant: style: …" with "Keep mine" chosen, as for any override. "Take the master's" writes the master's size, which may not fit; the overflow mark then shows.
- An unlinked layer never has overrides; its measures are just its own.
- `translation.write` adds the path the same way when its fit changes the size.

## Links after making

The data model is unchanged: a linked layer links to the layer with the same `key` in the direction's master, the only link target, and a direction has one variant per size, language and format (`spec/data-model-campaign.md`). Each new variant is linked to the master whatever it was made from. Its layers are the source's layers, in the source's order, with the source's `key`, `name`, `z`, `visible` and `locked`. A layer hidden or locked on the source is hidden or locked on the new variant.

For each **linked** layer of the source, each group gets, by the follow rule of the new variant (`followRule`, master against the new variant) and of the source:

| Group | Values, `synced_revs` and override paths of the new layer |
|-------|-----------------------------------------------------------|
| style, source, timing, animation (always follow) | The source's values, its synced counter, its paths in the group. Then the four pixel measures of "Text that fits" |
| geometry, when the new variant has the master's pixel size and the source does too | The source's geometry, synced counter and `geometry` path |
| geometry, when the new variant has the master's pixel size and the source does not | The master's geometry and counter; no path |
| geometry, when the new variant has another pixel size | Placed from the source's ("Where a box goes"); no path (geometry does not follow there) |
| copy, new variant in the source's language | The source's words, `translation_status`, `translation_source`, synced counter and `copy` path |
| copy, new variant in the master's language, source in another | The master's words and counter; status null; no path |
| copy, new variant in a third language | The master's words, status `missing`, source null, the master's counter, no path; then the brief's copy for that language, as today (`translatedLayers`) |

- `revs` starts at zero, `overflow` at 0, as today.
- So the new variant is out of date exactly where the source was, for the groups it takes from the source: a stale group stays stale, and an override stays an override. A path whose group does not follow for the new variant (a `geometry` path at another size, a `copy` path in another language) is dropped.
- **An unlinked layer** of the source (one made on that variant) is copied with `linked = 0`, its own values, empty `overrides`, geometry placed as above. In a language other than the source's its words are kept with status `missing`: no translation run covers it, because the master has no text for its key. The user types its words.
- A master layer the source lacks is missing from the new variant too; a sync offers it ("new layer from the master"), as it would for the source.
- From the master (the header's dialog) this gives exactly what fan-out gives today, apart from the new placement, the fit, and a video master's clips (below).

What counts as changed on the new variant: its override paths, which are the source's own changes (in groups that still follow) and the pixel measures that differ from the master's. Nothing else.

## Making variants from a variant

**`variant.fanOut`** gains `sourceVariantId?: string` (C, still `deny` for agents). Left out, or naming the master, it is the master's fan-out as before.

- The source must be a variant of `directionId` in this project's file, else `NOT_FOUND`, "That variant was not found in this direction." Checked before any write.
- The source's size and language are always part of the grid, in place of the master's. `fits` names exactly the listed sizes whose pixel size differs from the source's, else `INVALID_INPUT` with the present words.
- A size, language and format the direction already has is skipped, as today. The existing variant is not changed. To replace it, the user deletes it first, then makes it again.
- **R-02 in the source's language.** A new size in a language other than the source's copies its geometry from the new variant of the same size in the source's language made in the same call, when there is one.
- **What the new variant takes from the source:** its title and subjects, its duration and duration flag, and every layer as in "Links after making". The background's picture is the source's (`source` always follows), placed by the fit choice.
- **A video source** (the master included). The dialog starts with the source's format ticked. A new video variant copies the source's clips (asset, start, trims, `sound_on`; a clip's own `placement` is kept at the same pixel size and set to null, so it uses the background's, at another), and its `sound` and `sound_asset_id`; `first_clip_made` is 1 when a clip was copied. A source video with no clip, or an image source, gives the first clip from the background picture, as today (step 7). A new image variant takes no clips.
- **Fill.** For each size on "Generate fill", the new variant of that size in the source's language, as today with the master's. The fill extends the source's background picture.
- **Translations.** One run per new language other than the campaign's main language and other than the source's language. New variants in the source's language take its words and start no run, even where the source's words are still missing.
- **Cost.** Only after the user's click on "Make {n} variants", with the cost lines on screen: up to one fill per size on fill, and up to one translation per language counted as above (`spec/screens-variants.md`, "Make variants"). Copying from a variant calls no provider.
- Reply, inverse (`variant.remove`) and the 200 limit are unchanged. The snapshots of an undo carry the copied clips.

`variant.add` (and the agent's `add_variant`) stays master-only. It uses the new placement and fit.

## Agents

- `variant.fanOut` stays `deny`, with the action text "make many variants at once". Nothing in the agent policy table gets looser. An agent cannot make variants from a variant.
- `add_variant` (`variant.add`, allow) makes its one variant with the new placement and the fit at creation, from the master. Its description gains one sentence: "Boxes are placed for the new size and text is sized to fit, as the app does." An agent's variant in another language starts no translation run, so `translation.write` never fits it; when the agent sets the words with `set_translation` (`translation.set`), the size is not fitted, and the overflow value it reads with `get_variant` tells it to change the size.

## Quickstart

Once MV-4 is merged, the quickstart uses the app's own rule (slice MV-8):

- Step 2.3 plans each variant with `planNewVariant`, the same function `variant.fanOut` uses, from the master.
- Step 2.4, after a translate call, fits each text with `fitTranslatedText`, as `translation.write` does.
- **Step 2.6 goes**: the pass that laid out each variant again with `starterLayoutPatches` and then put the brand fonts and colours back. With and without `--ai_layout` the boxes are where the app's rule puts them.

## Code

| File | Holds |
|------|-------|
| `src/shared/links/place-box.ts` (new) | `anchoredBox(geometry, from, to, isText)` |
| `src/shared/links/source-layout.ts` (new) | `layoutOfLayers(layers, size, preferredId)`, `sitsAsLaidOut(layout, layer, size)`, `layoutBoxOf(layout, layer, size)` |
| `src/shared/links/fan-out-plan.ts` | `planVariant`: `PlanInput` gains `source?: { facts, layers }` (absent: the master) and `layoutId?: string \| null`; `pictureSize` is the source's background picture. Geometry by "Where a box goes"; values by "Links after making". No fit here, so a sync's added layer (`sync-plan.ts`, add-layer) gets the new placement and the master's style |
| `src/shared/links/fit-text.ts` (new) | `scaleTextMeasures(style, k)`, `fittedFontSize(copy, box, style, size)` (the largest size that fits, never above the style's own; it does not know the source's box, so the caller, `planNewVariant`, decides whether the words changed or the box got tighter before calling it), `fitTranslatedText(layer, copy, size, masterLayer)` (`{ style, overrides }`, or null when the size stays), `measureOverrides(layer, masterLayer)` |
| `src/shared/links/new-variant-plan.ts` (new) | `planNewVariant(input)`: `planVariant`, then `translatedLayers`, then the fit and its override paths. Used by `variant.fanOut`, `variant.add` and the quickstart |
| `src/shared/schemas/commands/variant.ts` | `sourceVariantId` on `variantFanOutInput` |
| `src/main/links/fan-out-write.ts` | `readFanOutSource(db, directionId, sourceVariantId?)` with the source's row, layers, subjects and picture size; `writeVariant` takes title, duration, subjects and sound from the source |
| `src/main/links/copy-clips.ts` (new) | `copyClips(ctx, sourceVariantId, variantId, samePixelSize)` |
| `src/main/commands/variant/fan-out.ts`, `add.ts` | Use `planNewVariant`; fan-out takes `sourceVariantId` |
| `src/main/translation/fan-out.ts` | `startFanOutTranslations` skips the source's language |
| `src/main/translation/fit-written.ts` (new), `src/main/commands/translation/write.ts` | The fit when a translation run first fills a layer |

## Security

Scope: destructive, data-access and privilege risks (`.claude/rules/security-priorities.md`).

- `sourceVariantId` is looked up in the command's own project file and must belong to `directionId`; a variant of another direction, campaign or project is `NOT_FOUND`. No row is read through an ID the window sends without that check.
- Copying clips copies asset IDs already in that project; no file is read, no path is taken, nothing is sent anywhere.
- Paid calls start only as today: fills from the window after the reply, each to the provider shown at the click and never more than the cost line showed (`fillsToStart`); translation runs only for the user's own click, never for an agent.
- No agent ability is added. No new entry into the main process exists for tests.
- Nuisance only (noted, not handled): a source with many layers and clips makes up to 200 copies in one call; the existing limit holds.

## Assumptions

| # | Assumption | Undo cost |
|---|------------|-----------|
| A-407 | The screen word is "Make variants" (button "Make variants…", dialog "Make variants of {direction}"); code names and the command keep "fan-out" | Low |
| A-408 | The agent's refusal reads "Agents cannot make many variants at once in this version…", because an agent can add one variant with `add_variant` | Low |
| A-409 | A box placed exactly by the source's starter layout takes that layout's box at the new size; any other box is anchored. Decided per layer, so one hand-moved box does not throw the others off the layout | Medium |
| A-410 | The source's layout is found from where its boxes are, not stored; the campaign's `brief.layout` only breaks ties | Low |
| A-411 | Anchoring measures gaps and lengths in shares of the smaller side; a text box with both gaps smaller than its length stretches, a picture never does | Medium |
| A-412 | Text is fitted at creation only when the words changed or the box got tighter, never made larger than the scaled size | Low |
| A-413 | A translation run fits the size once more, only smaller, when it first fills a layer that was missing its words; nothing else fits text by itself | Low |
| A-414 | Fitted and scaled pixel measures that differ from the master's are recorded as override paths, so a later master font size change waits behind "Keep mine" in the sync review | Medium |
| A-415 | The menu item is "Make variants from this one…", on every tile, the master's included | Low |
| A-416 | New variants made from a variant stay linked to the master and take the source's values, synced counters and override paths, so they are out of date where the source was | Medium |
| A-417 | A source's own words go only to new variants in the source's language; other languages translate the master's words, as every new variant does | Low |
| A-418 | A video source's clips and sound settings are copied to a new video variant, the master's included (before, a new video from a video master got only a first clip from the background picture) | Low |
| A-419 | A wanted size, language and format that already exists is skipped and the dialog says how many; nothing is replaced | Low |
| A-420 | The background fit choices do not change; from a variant they are judged against that variant's pixel size and background picture | Low |
