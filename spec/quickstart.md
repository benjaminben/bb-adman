# Quickstart (command line)

A demo of the pipeline for someone who has not installed the app (D-106, D-107). One brief in; finished ads out, one per subject set, language and size, with a report of the checks. It runs with `npm run quickstart` on macOS and Windows.

**State.** Built: the two examples, `--example` and the first question that picks one; the brand files and the brief's look read, with a printed note for each that cannot be used; the master built from the brief's layout with the logo, the brand fonts and the brand colours; the art direction in the picture prompt; text placement by AI with `--ai_layout` only; the picture in the subject spot for a flat-colour layout; one ad set per subject with `adsPer: subject`, and output folders by subject; `picture.png`; the checks, `report.json` and the printed result lines (QS-1, QS-2); each variant planned and its text fitted by the app's own rule, `planNewVariant` and `fitTranslatedText` (MV-8). Not built yet: the README with sample pictures (QS-3).

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
| One variant per size and language | `planNewVariant` (the app's "Make variants": the boxes for the new size, the brief's copy, the text fitted) |
| Translation answer check, and the fit of the new words | `cleanAnswer`, then `fitTranslatedText` (as `translation.write` does) |
| Checks | `runAllChecks` of `src/shared/checks/` |
| Drawing | The `Scene` component of `src/shared/scene/` |

## The two examples

Each example is a folder under `quickstart/examples/` with a `brief.yaml`, the files it names, and a `brand/` folder. `--example=<name>` picks one. `--brief=<file>` runs any other brief.

**The first question** (`quickstart/pick-example.ts`). A run that names no example and no brief starts by asking which example to make: a numbered list, `simple-routine` first and the rest by name, each with what it makes, read from its brief ("2 subjects in one picture, 3 languages, 3 sizes: 9 ads"). The answer is a number, an example's name, or Enter alone for the first; any other answer is refused in one line and the question is asked again. Ctrl+C or Ctrl+D ends the run with "No example was chosen." The question is asked only when both the input and the output are a terminal; in a script or a pipe, and when there is only one example, `simple-routine` runs with no question.

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
   3. Plan one variant per size and language from the master with `planNewVariant`, as the app's "Make variants" does, with the brief's layout ID as `layoutId` and the campaign's main language and brief. A box that sits where the layout put it takes the layout's box at the new size, so the margins line up in every size; a box moved off it (by the `--ai_layout` call) is anchored (`spec/make-variants.md`, "Anchoring"). Every language of a size has the same boxes. A language the brief gives copy for takes it, and a text whose words changed or whose box got tighter gets the largest font size that fits, never larger than before.
   4. Any language the brief gives no copy for gets one translate call. Each translated text then gets its font size fitted to the new words with `fitTranslatedText`, as the app's `translation.write` does: only ever smaller.
   5. Each size of other pixels than the first gets one extend call (the app's "fill"), and that picture becomes its background.
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

`tests/unit/quickstart/` covers the options, the examples, the first question (its order, its lines, what each answer means), the plan and its printout, the brief's files and notes, the ad sets, the layers (planned and fitted as `planNewVariant` and `fitTranslatedText` do, the margins of `summer-splash` at 16:9, the anchored boxes after `--ai_layout`), the text placement offer and its printed line, the checks' rule set and facts, the output names and the report. The run itself is checked by hand: `npm run quickstart -- --provider=fake --example=summer-splash`.

## Slices

- **QS-1. Examples, brand and layout.** The `examples/` folders and `--example`; brand files read and handed to the page; the master built from the layout with logo, fonts and colours; art direction in the prompt; `--ai_layout` in place of the layout call that always ran; the picture in the subject spot for a flat layout.
- **QS-2. Ad sets and the report.** `adsPer: subject`; a set with no photo; output folders by subject; `picture.png`; the checks, `report.json` (in place of `run.json`) and the printed lines.
- **MV-8. The app's rule** (`spec/make-variants.md`, "Quickstart"). Step 3 plans with `planNewVariant`, step 4 fits translated words with `fitTranslatedText`, and the pass that laid out each variant again (`starterLayoutPatches`, then the brand fonts and colours put back) is gone.
- **QS-3. README.** Both examples with sample pictures, after a real run.
