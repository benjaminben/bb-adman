# Quickstart (command line)

A demo of the pipeline for someone who has not installed the app (D-106, D-107). One brief in; finished ads out, one per subject set, language and size, with a report of the checks. It runs with `npm run quickstart` on macOS and Windows.

**State.** Built: the two examples and `--example`; the brand files and the brief's look read, with a printed note for each that cannot be used; the master built from the brief's layout with the logo, the brand fonts and the brand colours; the art direction in the picture prompt; text placement by AI with `--ai_layout` only; the picture in the subject spot for a flat-colour layout; one ad set per subject with `adsPer: subject`, and output folders by subject; each variant laid out by the layout for its own size and words; `picture.png`; the checks, `report.json` and the printed result lines (QS-1, QS-2). Not built yet: the README with sample pictures (QS-3).

## What it is not

It opens no app window and starts no Electron process. It reads and writes no project file, no SQLite database, no Settings file and no saved secret. It is not packaged with the app (`electron-builder.json` ships `out/**` only).

## What it reuses

The CLI holds no drawing, prompt, layout or check logic of its own. Each step calls the code the app runs:

| Step | App code |
|---|---|
| Read the brief | `src/shared/brief/parse.ts`, `size.ts`, `primary-language.ts`, the `Brief` schema |
| Brand, layout, art direction, ad sets | `briefLook`, `brandFileTexts`, `brandRuleSet`, `starterLayoutOf` (`spec/brief-brand.md`, "Shared helpers") |
| Picture, text placement, translation | The adapters in `src/main/providers/gemini/` (or `fake/`), through the `AdapterContext` contract |
| Picture prompt | `prefilledPrompt` (with the art direction), `promptToSend`, `FILL_PROMPT` in `src/shared/generation/prompt.ts` |
| Master layers | `buildMasterLayers` with the starter template and the brief's layout, then `withBrandFonts` and `withBrandColours` |
| Text placement checks (with `--ai_layout`) | `layoutItems`, `clampLayout`, `keepReadable`, `layoutPatches` |
| One variant per size and language | `planVariant` (fan-out) and `translatedLayers` (the brief's copy) |
| Translation answer check | `cleanAnswer` |
| Checks | `runAllChecks` of `src/shared/checks/` |
| Drawing | The `Scene` component of `src/shared/scene/` |

## The two examples

Each example is a folder under `quickstart/examples/` with a `brief.yaml`, the files it names, and a `brand/` folder. `--example=<name>` picks one; the default is `simple-routine`. `--brief=<file>` runs any other brief.

| Example | Shows |
|---|---|
| `simple-routine` | Two subjects with photos, shown together in one picture. Three languages (one with copy in the brief, one translated by AI). Sizes 1:1, 4:5, 9:16. Two brand fonts and two colours. Layout `photo-top-centre`. |
| `summer-splash` | One set of ads per subject (`adsPer: subject`). One subject has a photo; the other has only a description, so its picture is made from words alone. Two languages, both with copy in the brief. Sizes 1:1, 9:16, 16:9. A logo, three colours, two fonts. Layout `photo-bottom-left`. Banned words per language, and the German call to action holds one on purpose, so the report shows a flag. A comment in the brief says so. |

Every font in an example is under the SIL Open Font License; its licence text sits beside it. The logo and the product photo of `summer-splash` are made for this repository.

## Steps

1. Read the brief. Find each subject's photos and the brand's logo and fonts (beside the brief, or at a full path). A file that is missing or of the wrong type is left out with a printed note, as the app's brief form does. Print the plan: the ad sets, languages, sizes, and the AI calls the run will make.
2. For each ad set (one for the campaign, or one per subject):
   1. One picture call at the first size, with the set's subject photos as reference pictures. A set with no photo sends none.
   2. Build the master from the brief's layout (the default layout when the brief names none), with the logo in the logo spot, the brand fonts and the brand colours. With `--ai_layout`, one layout call then moves the text, clamped and checked for contrast as the app's layout job does; an answer with no usable box keeps the layout.
   3. Plan one variant per size and language as fan-out does: every language of a size has the same boxes and styles; a box keeps its share of the canvas across sizes.
   4. A language the brief gives copy for takes it. Any other language gets one translate call.
   5. Each size of other pixels than the first gets one extend call (the app's "fill"), and that picture becomes its background.
   6. Without `--ai_layout`, each variant is then laid out by the brief's layout for its own size and its own words (`starterLayoutPatches`, the app's "Layout…" action), with the brand fonts and colours put back after. So the margins line up in every size, and longer words in another language get a smaller size that fits. With `--ai_layout`, the boxes stay where step 3 put them. **This step goes away with slice MV-8** (`spec/make-variants.md`, "Quickstart"): step 3 then plans with `planNewVariant`, which places the boxes and fits the text as the app's "Make variants" does, and step 4 fits each translated text with `fitTranslatedText`, with or without `--ai_layout`.
3. Draw each variant, and each of its layers alone.
4. Run the app's checks on each variant and write the report.

**Where the picture goes.** A layout with a photo background takes the picture as its background. A flat-colour layout takes it in the subject spot; its other sizes then need no extend call.

## Drawing

The app photographs the `Scene` in a hidden Electron window. The CLI shows the same component in a browser with no window: Playwright opens Chromium (its own, else an installed Chrome or Edge) on a page that Vite serves on `127.0.0.1` at a free port. Pictures and fonts are handed to the page from memory. A text layer alone is drawn on a see-through canvas of the ad's size, so the layers stack into the final picture.

## Options

`--provider=gemini|fake`, `--gemini_api_key` (or `GEMINI_API_KEY`), `--model` (pictures), `--text_model` (placement and translation), `--example`, `--brief`, `--out`, `--prompt`, `--ai_layout`, `--help`. A name may use `_` or `-`. An option npm kept for itself (a shell that drops `--`) is read from `npm_config_<name>`.

## Output

```
quickstart/output/{campaign}/
  report.json
  {language}/{size}/            one set of ads for the campaign
  {subject}/{language}/{size}/  one set per subject
    final.png
    picture.png                 the picture as the model made it, with no shade or text
                                (.jpg or .webp if the model returns that type; its bytes are not changed)
    layers/{n}-{layer}.png
    layout.json                 each layer's text, box and style
```

`report.json` holds the models, each ad set's prompt and which of its pictures were given or made, the AI calls with their time, the notes from the brief, and for each ad its folder and the result of each check (passed, flagged with its findings, or skipped with the reason). The same results are printed as one line per ad. A flag does not make the run fail. `quickstart/output/` is not in git.

**The checks in a run with no project.** The rule set is the brief's word lists, the brand colours, and the logo as a required file. A translation made by AI counts as not yet approved, as in the app, so that check flags it; copy from the brief counts as the user's own (approved). Whether a text overflows its box is what the drawing page measured for the finished ad.

## Rules

- The key is never printed, logged or written to a file. A refusal of the options never repeats a typed value of the key.
- Folder names from a brief (campaign name, subject name, language) are cleaned to letters, digits and dashes, so a brief cannot name a place outside the output folder.
- The drawing page is served on `127.0.0.1` only and closes with the run.
- Nothing is sent anywhere but the provider chosen: the prompt, the subject photos, the picture for placement and extend, and the texts to translate. The logo and the fonts are sent nowhere.
- The `fake` provider makes no network call.
- No printed line or report entry holds a full path from the brief; a file is named by its last part.

## Tests

`tests/unit/quickstart/` covers the options, the examples, the plan and its printout, the brief's files and notes, the ad sets, the layers, the layout for each variant, the text placement offer, the checks' rule set and facts, the output names and the report. The run itself is checked by hand: `npm run quickstart -- --provider=fake --example=summer-splash`.

## Slices

- **QS-1. Examples, brand and layout.** The `examples/` folders and `--example`; brand files read and handed to the page; the master built from the layout with logo, fonts and colours; art direction in the prompt; `--ai_layout` in place of the layout call that always ran; the picture in the subject spot for a flat layout.
- **QS-2. Ad sets and the report.** `adsPer: subject`; a set with no photo; output folders by subject; each variant laid out by the layout for its size and words; `picture.png`; the checks, `report.json` (in place of `run.json`) and the printed lines.
- **QS-3. README.** Both examples with sample pictures, after a real run.
