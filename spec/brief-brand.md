# Brand, layout and art direction in a brief

A JSON or YAML brief can carry the brand (a logo, colours, two fonts), the starter layout the first ad starts from, a line of art direction for the picture prompt, and whether the campaign makes one set of ads for all subjects or one per subject. Fonts and every other value work the same in the app and in the command-line quickstart, because the rules live in shared code. This file covers the file shape, what is kept, `brief.parse`, the brief form, `campaign.create`, agents, the shared helpers and the security rules.

**State.** Not built. Slices: `spec/phases/brief-brand.md` (BB-1 to BB-8). Assumptions A-395 to A-406 are at the end of this file.

Read with: `spec/brief-and-templates.md` (the brief's shape, `brief.parse`, `buildMasterLayers`), `spec/subject-photos.md` (the path rules this copies), `spec/starter-layouts.md`, `spec/assets.md` ("File types"), `spec/export-and-checks.md` (the rule set checks), `spec/mcp-and-agents.md`, `.claude/rules/security-priorities.md`.

[REQ: FR-020, FR-023, FR-034, FR-040, FR-043, FR-062, FR-162]

## The file shape

```yaml
brand:
  logo: brand/logo.png            # one picture
  colours: ['#0B3D2E', '#FFF6E5'] # hex colours; one text is read as a list of one
  fonts:
    heading: brand/Headline.woff2 # goes on the headline
    body: brand/Body.woff2        # goes on every other text layer
layout: photo-bottom-left         # a starter layout ID
artDirection: Products on the right, calm empty space lower left, soft morning light
adsPer: subject                   # "campaign" (the default) or "subject"
```

- Every field is optional. A field of the wrong type is dropped, as for every brief field.
- `logo`, `fonts.heading` and `fonts.body` are each one text read exactly as a subject's `pictures` text (`spec/subject-photos.md`, D-098, D-100): an asset ID, an absolute path, or a path relative to the brief file. The same refusals apply, the Windows network path included. A logo must be a PNG, JPEG or WebP picture; a font a TTF, OTF or WOFF2 file (`spec/assets.md`, "File types").
- A value that cannot be used is left out with a plain note on the form. It never refuses the whole brief (agents differ: see "Agents").

## The rules

- **Colours.** Each text is trimmed. `#` and 6 hex digits, or `#` and 3 (each digit is doubled: `#0b3` gives `#00BB33`), in any letter case. Kept in upper case, each once, in brief order. A blank text is skipped with no note; any other bad text gets a note.
- **Layout.** Trimmed and lower-cased, it must equal the `id` of one of `STARTER_LAYOUTS`. Otherwise a note, and the default layout is used.
- **`adsPer`.** Trimmed and lower-cased: `campaign` or `subject`. A blank or missing value is `campaign` with no note; any other text gets a note and is read as `campaign`.
- **Art direction.** Trimmed; blank counts as none. No length limit.
- **What the brand does to the new campaign:**
  - the logo becomes the first of the rule set's `requiredAssetIds`, so it fills the master's `logo` slot (`fills.ts` takes the first picture there) and the `required-assets` check asks for it on every post;
  - the colours replace the rule set's `palette`, whatever rule set the campaign starts with (the brief's word lists or a copied one; A-397);
  - the colours also colour the master's text: each text layer's `style.color` becomes the nearest brand colour, by the rule the AI layout already uses with a palette, so the `text-colours` check passes from the start. A label's `boxColor` is left as the layout has it (A-406);
  - `fonts.heading` is set as `style.fontAssetId` on the text layer with key `headline`; `fonts.body` on every other text layer of the master. A font the brief does not give leaves those layers on the default font: one never stands in for the other (A-398);
  - `layout` picks the starter layout the master is built from;
  - `artDirection` is added to the pre-filled picture and video prompt;
  - `adsPer: subject` makes one direction per subject ("One direction per subject").
- **A brand font keeps `font_publish_allowed` false** until the user ticks "I am allowed to share this font" for it. Publishing still needs consent given on this computer (A-260).

## What the confirmed `Brief` keeps (decision)

`campaign.brief` keeps `layout`, `artDirection`, `adsPer` and `brand.colours`, all as cleaned values. It never keeps `brand.logo` or `brand.fonts`: they are paths or asset IDs, and once imported they live as an asset (the logo in the rule set, the fonts on the layers). Why these four: none is a path; the editor reads `artDirection` from the stored brief for each later prompt; `layout` and `adsPer` record what the campaign was built from; `brand.colours` records the brief's palette even after the rule set is edited.

## Schemas

`src/shared/schemas/brief.ts` (frozen; the architect's edit is made):

```ts
const draftBrand = z.object({
  logo: loose(z.string()),
  colours: loose(z.union([z.string(), z.array(z.string())])),
  fonts: loose(z.object({ heading: loose(z.string()), body: loose(z.string()) })),
})
// BriefDraft gains: brand: loose(draftBrand), layout, artDirection, adsPer: loose(z.string())
export const ADS_PER = ['campaign', 'subject'] as const
const BriefBrand = z.object({ colours: z.array(z.string().regex(HEX_COLOUR)).optional() })
// Brief gains: layout: z.string().optional(), artDirection: z.string().optional(),
//              adsPer: z.enum(ADS_PER).optional(), brand: BriefBrand.optional()
```

`Brief.layout` takes any text so a stored brief stays readable if a layout leaves the build; `campaign.create` refuses an ID the build does not have. Zod drops unknown keys, so a `logo` or `fonts` sent inside `brief.brand` to `campaign.create` or `create_campaign` is never stored.

`src/shared/schemas/commands/campaign.ts` (frozen; designed here): `campaignCreateInput` gains `brand?: { logoAssetId?: string; headingFontAssetId?: string; bodyFontAssetId?: string }` (each `z.string().min(1)`). `campaignCreateToolInput` (the MCP tool `create_campaign`) does not gain it.

`src/shared/schemas/commands/brief.ts` gains:

```ts
type BrandRole = 'logo' | 'headingFont' | 'bodyFont'
type BrandNoteReason = PictureNoteReason | 'not_a_font'
type BrandFile = { role: BrandRole; path: string | null; assetId: string | null }  // exactly one is set
type BrandFileNote = { role: BrandRole; name: string; reason: BrandNoteReason }   // name: pictureName
type BrandFiles = { files: BrandFile[]; notes: BrandFileNote[] }
type BriefParsed = { draft; primaryLanguage; subjectPictures?; brandFiles?: BrandFiles }
```

`brief.parse` always sets `brandFiles`; the AI reader never does. `files` is in role order (logo, heading, body); a role the brief does not name, or one with a note, has no entry.

## Shared helpers (one owner each; the app and the quickstart call them)

| Function | File | Does |
|----------|------|------|
| `briefLook(draft): BriefLook` | `src/shared/brief/brand.ts` | Cleans colours, layout, `adsPer` and art direction by "The rules" and gives `{ colours, layoutId: string \| null, artDirection: string \| null, adsPer, notes: BrandValueNote[] }`; notes in the order colours, layout, `adsPer` |
| `brandColours(raw)`, `briefLayoutId(raw)`, `adsPerOf(raw)`, `artDirectionOf(raw)` | same | The four parts of `briefLook`, exported for tests |
| `brandFileTexts(draft): { role, text }[]` | same | The logo and font texts as given, in role order, absent ones left out |
| `brandRuleSet(values, colours, logoAssetId): RuleSetValues` | `src/shared/brief/brand-rule-set.ts` | A fresh rule set: `palette` replaced by `colours` when not empty; the logo moved or added to the front of `requiredAssetIds` |
| `starterLayoutOf(id): StarterLayout \| null` | `src/shared/config/starter-layouts.ts` | The layout with exactly this ID |
| `buildMasterLayers(template, size, fills, layout = DEFAULT_STARTER_LAYOUT)` | `src/shared/templates/master-layers.ts`, type in `types.ts` (frozen; designed here) | Builds from the given layout's boxes, text styles, text boxes, shades and background. Slot names stay from `SLOT_LAYOUTS`. With the default the result is unchanged |
| `brandFontRole(key): 'heading' \| 'body'` | `src/shared/templates/brand-fonts.ts` | `headline` is `heading`; every other key is `body` |
| `withBrandFonts(layers, { heading?, body? })` | same | Fresh copies; each `text` layer gets the font of its role as `style.fontAssetId` when that font is given; other layers unchanged |
| `nearestColour(colour, palette): string` | `src/shared/generation/nearest-colour.ts` | The palette colour with the smallest sum of squared red, green and blue differences. Moved out of `layout-clamp.ts`, which now imports it |
| `withBrandColours(layers, colours)` | `src/shared/templates/brand-colours.ts` | Fresh copies; each `text` layer's `style.color` becomes `nearestColour` of it when `colours` is not empty; other layers and other style fields unchanged |
| `prefilledPrompt(facts)` | `src/shared/generation/prompt.ts` | `PromptFacts` gains `artDirection?: string \| null` |

`BrandValueNote = { field: 'colours' | 'layout' | 'adsPer'; text: string; reason: 'not_a_colour' | 'unknown_layout' | 'unknown_ads_per' }`. `text` is the raw value; a caller that shows it cleans it first (`cleanLineText`).

**The art direction sentence.** With art direction, `prefilledPrompt` puts `Art direction: {text}` between its first sentence and its last. `{text}` has each run of white space made one space and is trimmed; a `.` is added unless it already ends in `.`, `!` or `?`. Example: "A picture of Citrus can for an advertisement aimed at young adults in Canada. Art direction: Products on the right, soft morning light. Leave clear space for the advertisement's words, which are added separately." Null, missing or blank: the prompt is as today. `use-first-draft.ts` passes `campaign.brief.artDirection`.

## `brief.parse` (security class)

New file `src/main/assets/brief-brand.ts`: `checkBriefBrand(briefPath, draft, { assetOf, platform? }): Promise<BrandFiles>`. `parse.ts` calls it beside `checkBriefPictures` for a file and for text. `assetOf(id)` gives `{ kind, library }` of an asset of the open project, or null.

The per-text checks of `brief-pictures.ts` move to `src/main/assets/brief-file-check.ts` and take the wanted kind (`image` or `font`); `checkBriefPictures` keeps its signature, its tests and its behaviour. For each text of `brandFileTexts`, the first rule that fails gives the note:

1. **An asset ID**: an asset of the wanted kind in the **asset** library, else `unknown_asset` (a layer may not use a reference-library file, R-12).
2. **A relative path**: from pasted text, `not_full_path`; from a file, joined onto the brief's real folder.
3. **A Windows network or device path**: `not_readable`, nothing opened.
4. **A file**: as photo rule 4, with the wanted kind's extensions and first bytes. A wrong file is `not_a_picture` for the logo and `not_a_font` for a font.

Two roles may name the same file (the same font for heading and body); both entries carry it. Nothing is logged, nothing throws for a bad file, and no note shows a folder.

## The brief form

**The model** (pure). New file `src/renderer/screens/project-home/brief-form-brand.ts`; the note lines in `brand-notes.ts` beside it.

```ts
type FormAsset = FormPhoto   // { assetId, added }
type BrandChoice = {
  logo: FormAsset | null; headingFont: FormAsset | null; bodyFont: FormAsset | null
  colours: string[]          // cleaned
  layoutId: string           // a starter layout ID; the default when the brief gave none
  artDirection: string       // as typed
  notes: string[]
}
type BriefBrand = { logo: FormAsset | null; headingFont: FormAsset | null; bodyFont: FormAsset | null; notes: string[] }
brandFromDraft(draft: BriefDraft, imported?: BriefBrand): BrandChoice
brandPlan(brand: BrandChoice): { brief: Pick<Brief, 'layout' | 'artDirection' | 'brand'>; campaign: CampaignCreateInput['brand'] }
removedBrandAssets(values: BriefFormValues, roles: BrandRole[]): string[]
```

- `BriefFormValues` gains `brand: BrandChoice` and `adsPer: 'campaign' | 'subject'`. `formFromDraft(reply, held, photos, brand?)` fills them with `brandFromDraft`: the files from `brand`, the rest through `briefLook`; `notes` are the import notes first, then one line per `BrandValueNote`. The empty form gets the default layout, no brand and `campaign`.
- `planFromForm` adds to `brief`: `layout`, `artDirection` (left out when blank), `adsPer`, and `brand: { colours }` when there are colours; and to the `campaign.create` input `brand` with each asset ID the form holds (left out when none).
- `removedBrandAssets` gives the IDs to send `asset.remove` for when roles leave the form: those with `added` true that no other brand role and no subject photo of the form still holds, each once. Remove and Cancel both use it.
- The brand adds no problem line.

**Loading** (`brief-load/use-brief-brand.ts`). After the photos are imported (`spec/subject-photos.md`), each distinct path of `brandFiles.files` is imported with one `asset.import { projectId, paths: [path], library: 'asset', copy: true }`, in role order; roles sharing a path share its result. A role given by asset ID gets `{ assetId, added: false }`. The result is `{ assetId: assetIds[0], added: not in reusedAssetIds }`. Meanwhile the line "Adding the brief's brand files…" shows (role `status`). If the page goes away, every added brand asset is removed again.

**Notes** (`brand-notes.ts`), as plain text, `{name}` from `pictureName`, `{text}` cleaned with `cleanLineText`. `{what}` is "logo", "headline font" or "text font".

| Reason | Line |
|--------|------|
| `not_found` | "The {what} "{name}" was not found." |
| `not_a_picture` | "The logo "{name}" is not a picture Adman can use." |
| `not_a_font` | "The file "{name}" is not a font Adman can use. Use TTF, OTF or WOFF2." |
| `not_readable` | "The {what} "{name}" could not be read." |
| `not_full_path` | "The {what} "{name}" was not used: a pasted brief has no folder, so give its full path or its asset ID." |
| `unknown_asset` | "No picture with the asset ID "{name}" is in this project's asset library." (for a font: "No font …") |
| refused import | "The brief's {what} could not be added: {message}" |
| `not_a_colour` | "The colour "{text}" is not a hex colour such as #0B3D2E." |
| `unknown_layout` | "The layout "{text}" is not one of Adman's starting layouts. The default is used." |
| `unknown_ads_per` | "Ad sets "{text}" is not "campaign" or "subject". All subjects share one set." |

**What it shows.** A Section "Brand and layout" after "Sizes" and before "Rules", in the existing Section style. It opens unfolded when, at open, the form's brand holds a file, a colour, art direction, a note, or a layout other than the default; else folded. Summary: "{layout name}", then " · {n} colours", " · logo", " · {m} fonts" for each that is set. Inside, in order:

1. A select "Layout" (accessible name "Starting layout"): the five layout names. Under it, the chosen layout's `description` as text.
2. A text area "Art direction (optional)", hint "Added to the first picture prompt of each ad."
3. "Logo": a tile (a `--layer-thumb` picture from `assetUrl`, the display name as text, ✕ "Remove logo"), or the line "No logo." Hint: "The logo is a required file of the campaign and fills the logo spot."
4. "Colours": a list "Brand colours" of chips, each a swatch, the hex as text and ✕ "Remove colour {hex}"; or "No colours." Hint: "These become the campaign's colours. The colour check then flags text in any other colour."
5. "Fonts": "Headline: {name}" and "Other text: {name}", each with ✕ ("Remove headline font", "Remove font for other text"); an unset one reads "Default font (Inter)". `{name}` is the asset's `fontFamily`, else its display name (`asset.list { projectId, kind: 'font' }`). Hint: "A font from a brief is not shared when you publish until you tick "I am allowed to share this font"."
6. A list "Notes on the brand" when there are notes.

The form adds no brand files of its own (A-399): the user removes, and sets others after Create in Rules or the editor. No path is drawn.

**Ad sets.** Under the "Place first photo" switch, when the form has two or more subject rows: a segment pair, group "Ad sets", "Together" | "Per subject" (named "One set of ads for all subjects" and "One set of ads per subject"). Hint: "Per subject makes one direction for each subject, each with its own first ad." With one row it is hidden and the value is kept.

**Create** sends the steps of `spec/subject-photos.md` unchanged; the brand travels inside `campaign.create`.

## `campaign.create`

In `createCampaignRows` (`src/main/commands/campaign/create.ts`; the master rows move to `master-rows.ts`), before anything is written:

1. **Layout.** No `brief.layout`: the default. Otherwise `starterLayoutOf`; none: `NOT_FOUND`, "That layout is not in this build."
2. **Brand assets** (`brand-assets.ts`, `checkBrandAssets`). `logoAssetId` must be an asset of kind `image` in the asset library, else `NOT_FOUND`, "The brand logo is not a picture in this project's asset library." Each font ID must be of kind `font` in the asset library, else `NOT_FOUND`, "A brand font is not a font in this project's asset library."
3. **Rule set.** `brandRuleSet(startingRuleSet(...), brief.brand?.colours, brand?.logoAssetId)`.
4. **Master.** `withBrandColours(withBrandFonts(buildMasterLayers(starterTemplate, size, fills, layout), fonts), brief.brand?.colours ?? [])`.

## One direction per subject

With `brief.adsPer === 'subject'` and two or more subjects, `createCampaignRows` makes one direction per subject, in subject order (`sort` 0, 1, …). Each direction is named after its subject's stored name, trimmed and cut to 100 characters ("Direction {n}" if that is empty), and has one master at the first size and primary language, whose `variant_subject` is that subject alone and whose fills use that subject's hero (when `placeSubjectPhoto` allows). `campaign_subject` still lists every subject. The reply names the first direction and its master. With one subject, or `campaign`, nothing changes. Fan-out and sync stay per direction, as for any direction.

## Agents

- **`create_campaign_from_brief`** (both commands, through `briefPlan`) reads the brand in a new file `from-brief-brand.ts`, before the ask:
  - A brand value with a note is refused, the first one: `INVALID_INPUT`, reason `brief_value`, "brand.colours holds a value that is not a hex colour such as #0B3D2E." / "layout is not a starter layout ID. Use one of: {ids}." / 'adsPer must be "campaign" or "subject".'
  - A brand file given as a path (full or relative) is refused with no disk read: `RULE_VIOLATION`, reason `brand_file_path`, "{field} names a file. Import it with import_assets first, then give its asset ID." `{field}` is `brand.logo`, `brand.fonts.heading` or `brand.fonts.body`. A brand path never makes the tool pick the files command, and the files command refuses it too.
  - An asset ID must pass create's step 2, else `NOT_FOUND`, reason `unknown_asset`, "{field}: no picture (or font) with that asset ID is in this project's asset library."
  - The confirmed `Brief` is built from `briefLook`'s cleaned values, never the raw draft, and the IDs go in `campaign.create`'s `brand`.
- **`create_campaign`** takes the new `Brief` fields (layout, art direction, `adsPer`, colours) and checks them by schema; it has no `brand` IDs. Fonts can be set after with `layer.setFonts`.
- Nothing in the agent policy table changes. No message holds a path or the bad value's text.

## The AI brief reader and Markdown briefs

`brief.extract` drops `brand.logo` and `brand.fonts` from its draft, as it drops `pictures`, so a path an AI answer made up is never shown or kept (A-404). It keeps colours, `layout`, `artDirection` and `adsPer`: they are no paths, and the form cleans them. Its reply has no `brandFiles`. The Markdown form of `parseBriefText` reads none of the new fields; no change.

## Security rules

- **Paths.** A brand path goes to `asset.import` from the window only after a `brief.parse` reply listed it in `brandFiles`, always with `copy: true` (A-396). No path reaches `campaign.brief`, a job row, an MCP reply, an event, an error message or a log line. Notes are shown on the user's screen only.
- **Any file on the disk.** As for photos (D-100), a brief may name a logo or font anywhere the user can read, with no confirm. It shows on the form before Create, and a font is never uploaded without consent given on this computer. Accepted.
- **Hostile font files.** A brief font is parsed by the same code as a picked one (`readFontFamily`, and the window's font loader through `adman-asset:`), after the same first-bytes check. No new risk beyond the picker's.
- **Agents.** Stricter than for photos: brand files by asset ID only, so the ask flow and `asset.importFiles` are unchanged.
- **IDs from the window.** `campaign.create` checks each brand ID's kind and library, so no layer gets a font as a picture, a picture as a font, or a reference-library file (R-12).
- **Nuisance, noted only.** A huge colour list or art direction text, a very large font file, a prompt-like art direction aimed at a model.

## Out of scope

Picking brand files on the form; a per-language font from the brief; more than two fonts; colouring a label's box from the palette; brand fields in Markdown briefs; a brand block in `create_campaign`.

## Assumptions

- **A-395. The stored brief keeps `layout`, `artDirection`, `adsPer` and `brand.colours`**, never the logo or font texts. *BB-1. Easy.*
- **A-396. Brand files are imported when the form opens, copied into the assets folder, and removed again on Remove or Cancel** unless something else in the form holds them. *BB-7. Easy.*
- **A-397. Brand colours replace the palette** of whatever rule set the campaign starts with; the logo goes first in the required files. *BB-4. Easy.*
- **A-398. The heading font goes on the headline only, the body font on every other text layer**; neither stands in for the other. *BB-2. Easy.*
- **A-399. The form adds no brand files of its own**; it only removes. *BB-7. Easy.*
- **A-400. Layout IDs and `adsPer` are read without case or outer spaces; `#RGB` colours are widened**; colours are stored in upper case. *BB-1. Easy.*
- **A-401. Agents name brand files by asset ID only**; a path is refused, and bad brand values are refused with the field named. *BB-5. Easy.*
- **A-402. `adsPer: subject` names each direction after its subject** and the reply names the first. *BB-8. Easy.*
- **A-403. The art direction goes between the prompt's first and last sentence**, for pictures and video alike. *BB-1. Easy.*
- **A-404. The AI reader keeps the brand values but not the brand files.** *BB-3. Easy.*
- **A-405. A brand file named by asset ID must be in the asset library.** *BB-3, BB-4. Easy.*
- **A-406. Brand colours colour the master's text**: each text layer takes the nearest brand colour. A list with no light colour, or no dark one, can leave text hard to read on its ground; the user recolours it in the editor. *BB-2, BB-4. Easy.*
