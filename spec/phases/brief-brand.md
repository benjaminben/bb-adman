# Brief brand: slices BB-1 to BB-8

The design is `spec/brief-brand.md`; read the parts each slice names. The architect has already changed `src/shared/schemas/brief.ts` (`BriefDraft` and `Brief`); no slice edits it. Every slice writes its tests first, runs the targeted tests and type check for its own files only (`spec/testing.md`, verification classes), and stays under 300k tokens.

## Order

At most two developers at once. The two slices of a wave share no file.

| Wave | Slices | Needs merged first |
|------|--------|--------------------|
| 1 | BB-1, BB-2 | nothing |
| 2 | BB-3, BB-4 | BB-1 (both); BB-2 (BB-4) |
| 3 | BB-5, BB-6 | BB-4 (BB-5); BB-1 and BB-3 (BB-6) |
| 4 | BB-7, BB-8 | BB-6 (BB-7); BB-4 (BB-8) |

**Already failing after the architect's edit.** The MCP tool list snapshot (`tests/integration/mcp/__snapshots__/tool-list.test.ts.snap`) holds `create_campaign`'s input schema, which is built from `Brief`; it now shows the four new optional fields. BB-1 updates the snapshot, and its review checks that those four fields are the only change.

**Known gap until BB-5 merges.** `from-brief-plan.ts` builds the `Brief` from the raw draft. An agent brief with an odd colour or `adsPer` value then fails with `INTERNAL` instead of a plain refusal. Nothing is written. BB-5 fixes it; do not release before BB-5.

## BB-1 — Shared brief values, schemas, prompt (classes A and D; E for the snapshot)

- **Files:** new `src/shared/brief/brand.ts`, new `src/shared/brief/brand-rule-set.ts`; `src/shared/config/starter-layouts.ts` (`starterLayoutOf`); `src/shared/generation/prompt.ts`; `src/renderer/editor/generate-fields/use-first-draft.ts`; `src/shared/schemas/commands/campaign.ts` (`brand` on `campaignCreateInput` only); `src/shared/schemas/commands/brief.ts` (the brand types and `brandFiles`).
- **Read:** `spec/brief-brand.md`, "The rules", "Schemas", "Shared helpers".
- **Tests first:**
  - `tests/unit/shared/brief/brand.test.ts`: colours (`#0b3d2e` gives `#0B3D2E`; `#0b3` gives `#00BB33`; `' #FFF6E5 '` kept; `teal`, `#12345`, `0B3D2E` give notes; a blank is skipped with no note; a repeat in another case kept once; one text read as a list of one); layout (each of the five IDs; ` Photo-Top-Centre ` found; `nope` gives a note and null; missing gives null and no note); `adsPer` (`subject`, ` SUBJECT `, missing, `''`, `banana` with its note); art direction (trimmed; blank is null); `briefLook` note order; `brandFileTexts` order and absent roles.
  - `tests/unit/shared/brief/brand-rule-set.test.ts`: palette replaced only by a non-empty list; the logo added to the front, or moved there when already listed; the input not changed.
  - `tests/unit/shared/schemas/brief-brand-schema.test.ts`: `BriefDraft` keeps the raw brand texts and drops a wrong-typed `brand`, `fonts` or `colours`; `Brief` drops `brand.logo` and `brand.fonts`, refuses a bad colour and an unknown `adsPer`, accepts any `layout` text.
  - The prompt test file: the example sentence of "The art direction sentence"; white space folded; no second full stop after `.`, `!`, `?`; null and blank give today's text; video too.
  - `starterLayoutOf`: each ID, an unknown one, `constructor`.
  - The tool list snapshot, updated as said under "Order".
- **Must not touch:** `src/shared/schemas/brief.ts`, anything under `src/main/`, `src/shared/templates/`.

## BB-2 — Layout and fonts in the master layers (class A)

- **Files:** `src/shared/templates/types.ts` (frozen; the fourth parameter as designed), `src/shared/templates/master-layers.ts`, new `src/shared/templates/brand-fonts.ts`, new `src/shared/templates/brand-colours.ts`, new `src/shared/generation/nearest-colour.ts` (moved out of `layout-clamp.ts`, which imports it).
- **Read:** `spec/brief-brand.md`, "Shared helpers"; `spec/starter-layouts.md`.
- **Tests first:**
  - `tests/unit/shared/templates/master-layers-layout.test.ts`: for each of the five layouts at the four ready-made sizes, every layer built with that layout equals the default build with `starterLayoutPatches(layout, size, layers)` applied (geometry, style, background); names stay "Subject image", "Logo", "Headline", "Call to action". The existing master-layers tests stay green unchanged (the default gives the same result).
  - `tests/unit/shared/templates/brand-fonts.test.ts`: headline gets the heading font, call to action and a layer of any other key the body font; picture and background layers untouched; a missing font leaves the layer's own; the result shares nothing with the input.
  - `tests/unit/shared/templates/brand-colours.test.ts`: with `#0B3D2E` and `#FFF6E5`, white text becomes `#FFF6E5` and near-black text `#0B3D2E`; an empty list changes nothing; `boxColor`, picture and background layers untouched; the result shares nothing with the input. `nearest-colour.test.ts`: the nearest of three; a tie keeps the first. The existing layout-clamp tests stay green unchanged.
- **Must not touch:** `starter-layouts.ts`, `default-layout.ts`, `starter-layout-patches.ts`, `new-layer.ts`, anything under `src/main/`.

## BB-3 — `brief.parse` brand files (class B, security class)

- **Files:** new `src/main/assets/brief-file-check.ts` (the per-text checks moved out of `brief-pictures.ts`, with the wanted kind), `src/main/assets/brief-pictures.ts` (calls it), new `src/main/assets/brief-brand.ts`, `src/main/commands/brief/parse.ts`, `src/main/jobs/kinds/brief-extraction.ts`.
- **Read:** `spec/brief-brand.md`, "`brief.parse`", "The AI brief reader", "Security rules"; `spec/subject-photos.md`, "How `brief.parse` checks the paths".
- **Tests first:**
  - `tests/unit/main/assets/brief-brand.test.ts`, on a temp folder: a relative logo and fonts beside the brief; a path leading out of the folder; an absolute path; pasted text with a relative path (`not_full_path`); a missing file; a folder; a PNG named `.woff2` (`not_a_font`); a WOFF2 as logo (`not_a_picture`); an asset ID of a font, of a picture, of a reference-library picture, of the wrong kind; heading and body the same file; on `win32` rules, `\\server\share\a.woff2` gives `not_readable` and opens nothing; no note holds a folder.
  - `tests/integration/campaigns/brief-parse-brand.test.ts`: the reply has `brandFiles` for a file and for text; nothing logged holds a path.
  - The existing `brief-pictures` and `brief-parse` tests stay green unchanged.
  - The brief-extraction test: an answer with `brand.logo`, `brand.fonts` and colours keeps the colours and drops the two.
- **Must not touch:** `src/renderer/`, `src/main/commands/campaign/`, `src/shared/`.

## BB-4 — `campaign.create` with layout, brand and fonts (class B)

- **Files:** `src/main/commands/campaign/create.ts`, new `src/main/commands/campaign/master-rows.ts` (the master rows moved out of `create.ts`), new `src/main/commands/campaign/brand-assets.ts`.
- **Read:** `spec/brief-brand.md`, "`campaign.create`", "The rules".
- **Tests first:** `tests/integration/campaigns/campaign-create-brand.test.ts`: `layout: flat-centre-top` gives that layout's boxes and background; an unknown layout is `NOT_FOUND` with nothing written; the logo becomes the first required asset and fills the logo layer; colours replace the palette, also with `copyRuleSetFrom`; heading font on the headline, body font on the call to action; with colours, each text layer's colour is one of them; a font ID that is a picture, a logo ID that is a font, an unknown ID and a reference-library logo are each `NOT_FOUND` with nothing written; `brief` stored with `layout`, `artDirection`, `adsPer`, `brand.colours` and no other brand key; the asset's `fontPublishAllowed` stays false; the MCP `create_campaign` input schema has no `brand`. Existing create tests stay green.
- **Must not touch:** `fills.ts`, `rule-set-values.ts`, `from-brief*.ts`, `src/shared/`, `src/renderer/`.

## BB-5 — Agents: the brand in `create_campaign_from_brief` (classes B and E, security class)

- **Files:** new `src/main/commands/campaign/from-brief-brand.ts`, `src/main/commands/campaign/from-brief-plan.ts`, `src/main/mcp/tools/brief-tools.ts` (description only).
- **Read:** `spec/brief-brand.md`, "Agents"; `spec/mcp-and-agents.md`, the brief tool.
- **Tests first:** `tests/integration/mcp/brief-tool-brand.test.ts` (with `brief-tool-fixture.ts`): asset IDs of a picture and two fonts make the campaign as BB-4 does, with no ask; a full brand path and a relative one are refused (`brand_file_path`) with no disk read, no ask and no event, and the message names the field, not the text; a brand path beside a photo path is refused before the ask; a bad colour, layout or `adsPer` is refused with its message; the stored brief holds only cleaned values; the description names the brand fields (the tool list snapshot is updated for the new description). Existing brief tool tests stay green.
- **Must not touch:** `from-brief-pictures.ts`, `from-brief.ts`, `create.ts`, `agent-policy.ts`, `ask-kinds.ts`.

## BB-6 — The form model (class D)

- **Files:** new `src/renderer/screens/project-home/brief-form-brand.ts`, new `src/renderer/screens/project-home/brand-notes.ts`, `src/renderer/screens/project-home/brief-form-model.ts`. Existing tests that write `BriefFormValues` by hand gain the two new fields, nothing else.
- **Read:** `spec/brief-brand.md`, "The brief form" (model, notes).
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-form-brand.test.ts` (`brandFromDraft` from a draft with every field, with none, with bad values and their note lines; `planFromForm` sends `layout`, `artDirection` only when not blank, `adsPer`, `brand.colours` only when there are colours, and the `campaign.create` `brand` IDs; `removedBrandAssets` keeps an ID another role or a subject photo holds and gives a shared added ID once); `brand-notes.test.ts` (every line of the table; a name with a folder shows only its last part; hidden characters removed).
- **Must not touch:** `brief-form-problems.ts`, `brief-form-photos.ts`, components, `brief-load/`.

## BB-7 — The form screen and loading (class D)

- **Files:** new `src/renderer/screens/project-home/brand-fields/` (`brand-fields.tsx`, its CSS module, `use-project-fonts.ts`, `index.ts`), `src/renderer/screens/project-home/brief-form/brief-form.tsx` (the Section and the "Ad sets" pair), new `src/renderer/screens/project-home/brief-load/use-brief-brand.ts`, `src/renderer/screens/project-home/brief-load/brief-load.tsx`.
- **Read:** `spec/brief-brand.md`, "The brief form"; `spec/screens-campaign.md`, "The brief form"; `spec/app-style-parts.md` (Section, segments).
- **Tests first:** `tests/unit/renderer/screens/project-home/brand-fields.test.tsx` (folded or open by the rule; summary text; each remove button's name and its `asset.remove` per `removedBrandAssets`; no path in the DOM; notes listed); `brief-load-brand.test.tsx` (one `asset.import` per distinct path with `copy: true`; a refused import gives its note; Cancel removes added brand assets; "Ad sets" shows only with two rows and its value reaches `campaign.create`).
- **Must not touch:** `subject-rows/`, `subject-photos/`, `rule-fields/`, `size-fields/`, the model files of BB-6, `src/main/`.

## BB-8 — One direction per subject (class B)

- **Files:** `src/main/commands/campaign/create.ts`, `src/main/commands/campaign/master-rows.ts`.
- **Read:** `spec/brief-brand.md`, "One direction per subject".
- **Tests first:** `tests/integration/campaigns/campaign-create-ads-per.test.ts`: two subjects with `subject` give two directions named after the subjects in order, each master with one `variant_subject` and its own hero when placed; `campaign_subject` lists both; the reply names the first; one subject, or `campaign`, gives one "Direction 1"; a subject name of 150 letters is cut to 100; through `create_campaign_from_brief` too.
- **Must not touch:** `brand-assets.ts`, `fills.ts`, `src/shared/`, `src/renderer/`.
