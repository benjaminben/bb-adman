# Quickstart (command line)

A demo of the pipeline for someone who has not installed the app (D-106). One brief in, one finished ad per language and size out. It runs with `npm run quickstart` on macOS and Windows.

## What it is not

It opens no app window and starts no Electron process. It reads and writes no project file, no SQLite database, no Settings file and no saved secret. It is not packaged with the app (`electron-builder.json` ships `out/**` only).

## What it reuses

The CLI holds no drawing, prompt or layout logic of its own. Each step calls the code the app runs:

| Step | App code |
|---|---|
| Read the brief | `src/shared/brief/parse.ts`, `size.ts`, `primary-language.ts`, the `Brief` schema |
| Picture, text placement, translation | The adapters in `src/main/providers/gemini/` (or `fake/`), through the `AdapterContext` contract |
| Picture prompt | `prefilledPrompt`, `promptToSend`, `FILL_PROMPT` in `src/shared/generation/prompt.ts` |
| Master layers | `buildMasterLayers` with the starter template |
| Text placement checks | `layoutItems`, `clampLayout`, `keepReadable`, `layoutPatches` |
| One variant per size and language | `planVariant` (fan-out) and `translatedLayers` (the brief's copy) |
| Translation answer check | `cleanAnswer` |
| Drawing | The `Scene` component of `src/shared/scene/` |

Two helpers moved to shared code so both sides use one copy: `layoutItems` (`src/shared/generation/layout-items.ts`) and `translatedLayers` (`src/shared/translation/translated-layers.ts`). The files they came from export them as before.

## Steps

1. Read the brief and each subject's photos (PNG, JPEG or WebP, beside the brief or at a full path). Print the plan and the AI calls it will make.
2. One picture call at the first size, with the photos as reference pictures.
3. One layout call on that picture. The answer is clamped and checked for contrast as the app's layout job does. An answer with no usable box keeps the starter layout.
4. Plan one variant per size and language as fan-out does: every language of a size has the same boxes and styles; a box keeps its share of the canvas across sizes.
5. A language the brief gives copy for takes it. Any other language gets one translate call.
6. Each size of other pixels than the first gets one extend call (the app's "fill"), and that picture becomes its background.
7. Draw each variant, and each of its layers alone.

## Drawing

The app photographs the `Scene` in a hidden Electron window. The CLI shows the same component in a browser with no window: Playwright opens Chromium (its own, else an installed Chrome or Edge) on a page that Vite serves on `127.0.0.1` at a free port. Pictures are handed to the page from memory. A text layer alone is drawn on a see-through canvas of the ad's size, so the layers stack into the final picture.

## Options

`--provider=gemini|fake`, `--gemini_api_key` (or `GEMINI_API_KEY`), `--model` (pictures), `--text_model` (placement and translation), `--brief`, `--out`, `--prompt`, `--help`. A name may use `_` or `-`. An option npm kept for itself (a shell that drops `--`) is read from `npm_config_<name>`.

## Output

`quickstart/output/{campaign}/{language}/{size}/` holds `final.png`, `layers/{n}-{layer}.png` and `layout.json` (each layer's text, box and style). `{campaign}/run.json` holds the models and the prompt. `quickstart/output/` is not in git.

## Rules

- The key is never printed, logged or written to a file. A refusal of the options never repeats a typed value of the key.
- Folder names from a brief (campaign name, language) are cleaned to letters, digits and dashes, so a brief cannot name a place outside the output folder.
- The drawing page is served on `127.0.0.1` only and closes with the run.
- Nothing is sent anywhere but the provider chosen: the prompt, the subject photos, the picture for placement and extend, and the texts to translate.
- The `fake` provider makes no network call.

## Tests

`tests/unit/quickstart/` covers the options, the plan, the layers and the output names. The run itself is checked by hand: `npm run quickstart -- --provider=fake`.
