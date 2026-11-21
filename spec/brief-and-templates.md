# Brief intake and templates

How a campaign brief is read, checked and turned into a campaign, and what a template is and how the first layers of a campaign are built from it. Usually read with `spec/api-commands.md` (`brief.parse`, `campaign.create`), `spec/data-model.md` (`CampaignSize`, `LayerRow`, `rule_set`) and `spec/security.md`.

**Requirements traced:** [REQ: FR-020–FR-027, FR-040–FR-043, FR-055, FR-104, FR-171, FR-297, R-03, R-12]

## The brief's shape

Built. `src/shared/schemas/brief.ts`, the single owner of the brief schema.

JSON and YAML brief files use these field names:

```json
{
  "campaignName": "string, required",
  "region": "string, required",
  "audience": "string, required",
  "message": "string, required",
  "subjects": [{ "id": "string, optional", "name": "string, required", "description": "string, optional" }],
  "offer": "string, optional",
  "callToAction": "string, optional",
  "tone": "string, optional",
  "requiredWords": "string[] or { language: string[] }, optional",
  "prohibitedWords": "string[] or { language: string[] }, optional",
  "languages": "string[] of BCP-47 tags, optional",
  "sizes": "string[] such as '1:1' or '1080x1350', optional",
  "copy": { "<language>": { "headline": "string", "callToAction": "string" } }
}
```

The file exports two Zod schemas with these field names:

| Schema | What it is | Rules |
|--------|-----------|-------|
| `BriefDraft` | What a brief file gives, before the user has confirmed anything. The result of `brief.parse`. | Every field is optional. Unknown fields are dropped. A field of the wrong type is dropped, not refused (each field is `.optional().catch(undefined)`). `subjects` may be empty. Nothing is trimmed: the user sees what the file held. |
| `Brief` | A confirmed brief. The `brief` input of `campaign.create` and of the MCP tool `create_campaign`, the value stored in `campaign.brief`, and the type the `TextProvider` interface names. | `campaignName`, `region`, `audience`, `message` are non-empty strings. `subjects` has at least one entry and each has a non-empty `name` (`BriefSubject`). Every other field is optional. `requiredWords` and `prohibitedWords` accept both forms shown above. |

**Trimming.** In `Brief`, the four required texts and each subject `name` are trimmed of spaces at both ends and then must be non-empty, so a name made only of spaces is refused. The trimmed text is the value: handlers store and use what the schema returns, never the raw input, so a stored brief reads back the same (trimming twice changes nothing). "Word for word" for the headline [REQ: FR-043] means the trimmed message. Nothing inside a text is changed.

**Subjects.** `subjects` needs at least one entry and has no upper limit [REQ: FR-021]. A brief with one subject is valid, and briefs with two or more work the same way. FR-021's "at least two must be supported" is what the app must be able to handle, not the smallest brief allowed [D-024].

**Word lists.** A plain word list for `requiredWords` or `prohibitedWords` is stored under the primary language [REQ: R-03]. `wordsByLanguage(words, primaryLanguage)` (`src/shared/brief/words.ts`) turns either form into `{ [language]: string[] }`: a plain list goes under the primary language, a per-language list is kept as given. The result shares no list with its input. `wordsByLanguage([], 'en')` gives `{ en: [] }`.

**Sizes in a brief.** `parseSize(text)` (`src/shared/brief/size.ts`; the `CampaignSize` shape is in `spec/data-model.md`) turns a ratio or a pixel size into a `CampaignSize`, or null when it cannot be read. Ratios may be decimal. Two numbers both below 100 joined by `x` are read as a ratio. Cases pinned by `tests/unit/shared/brief/size.test.ts`:

| Text | Result |
|------|--------|
| `1.91:1` | `2063x1080` |
| `1:1.91` | `1080x2063` |
| `4.5:1` | `4860x1080` |
| `4:5.0` | ready-made `4x5` |
| `1.0:1` | `1x1` |
| `2x3` | `1080x1620` |
| `99x99` | `1x1` |
| `50x1080`, `100x100` | stay pixel sizes |
| `1,91:1`, `.5:1`, `1.:1`, `0.0:1`, `1.5x2`, `1.9.1:1`, `1080.5x1350` | null |

## Reading a brief: `parseBrief`

Built. `src/shared/brief/parse.ts`, `draft.ts`, `yaml-tokens.ts`, `yaml-walk.ts`, `bad-line.ts`; limits in `src/shared/config/brief-limits.ts`. Security class.

A brief is a file the user imports. It may come from anyone, so it is read as hostile.

### Signatures

The types are in `src/shared/templates/types.ts` (frozen):

```ts
type BriefSyntax = 'json' | 'yaml'
type ParseBrief = (text: string, syntax: BriefSyntax) => Result<BriefDraft>
```

- `parseBrief: ParseBrief`. Never throws. Any refusal is the one fixed error `BRIEF_UNREADABLE`.
- `parseBriefFile: ParseBrief`. The same, but for a malformed YAML brief the error names the first bad line (see "Error messages"). `parseBrief` is `parseBriefFile` with any `brief_unreadable` error replaced by `BRIEF_UNREADABLE`. `brief.parse` calls `parseBriefFile`.
- `briefDraftFrom(value: unknown): Result<BriefDraft>` (`draft.ts`): only a plain object at the top is a brief; anything else (a list, a number, text, null) is `brief_unreadable`. Then `BriefDraft` drops unknown and wrong-typed fields.

### Order of work

1. Remove one byte-order mark (U+FEFF) from the start, if there is one.
2. `syntax` picks the parser: `json` uses the built-in `JSON.parse`, `yaml` uses the `yaml` package (steps below). The function does not try the other syntax on failure.
3. Hand the value to `briefDraftFrom`.

Steps 1 to 3 run inside one `try`. Anything caught, of any error type, gives `brief_unreadable`. A stack overflow is caught the same way.

### Limits

`src/shared/config/brief-limits.ts` is the one owner of the brief limits. No other file under `src/` writes these numbers.

| Constant | Value | Meaning |
|----------|-------|---------|
| `MAX_BRIEF_DEPTH` | 32 | Deepest nesting a YAML brief may have, checked on the tokens before compose. |
| `MAX_BAD_LINE_CHARS` | 120 | Longest first bad line, in code points, that a malformed YAML brief's error shows. |

**A brief has no size limit** (stakeholder decision). There is no `MAX_BRIEF_BYTES`, no reason `brief_too_large`, no size check in `parseBrief` and no `stat` check in `brief.parse`. Do not bring them back. A huge brief may freeze or crash the app; this is accepted [D-059 item 2]. A slow parse is a nuisance and is not worked on: there is no parse-time stop rule, no worker and no time limit. There is no alias count constant.

### The `yaml` package

`yaml` is declared in `dependencies` at exactly `2.9.1`, with no `allowScripts` entry (ISC licence, no dependencies, no install scripts). If an update brings an install script or an `npm audit` finding, the developer stops and reports. JSON uses `JSON.parse` and needs no package.

### YAML options

`YAML_OPTIONS` in `parse.ts`, set whatever the library's defaults are:

```ts
const YAML_OPTIONS = {
  version: '1.2',
  schema: 'core',
  customTags: [],
  resolveKnownTags: false,
  merge: false,
  uniqueKeys: false,
  prettyErrors: false,
  logLevel: 'error',
}
```

| Option | Why |
|--------|-----|
| `version: '1.2'`, `schema: 'core'` | `NO` is the text "NO", not `false`; unquoted `1:1` and `16:9` stay text; `languages: [no]` gives `['no']`. A `%YAML 1.1` line in the file does not bring back 1.1 rules. |
| `customTags: []` | No tag may produce anything but text, a number, true or false, null, a list or a plain object. |
| `resolveKnownTags: false` | Without it `!!binary` gives a Buffer and `!!timestamp` a Date. |
| `merge: false` | A `<<` key is not merged. |
| `uniqueKeys: false` | The walk (rule 2) does the repeated-key check in one pass. |
| `prettyErrors: false` | Only an error's start offset is read, so the library need not quote lines into its errors. |
| `logLevel: 'error'` | `'warn'` prints a warning that quotes the file; `'silent'` also hides the "several documents" error. |

No reviver function is used; maps become plain objects. Exactly one document: a file with two documents gives `brief_unreadable`.

### YAML is read as a plain subset

A brief is maps with text keys, lists and single values; FR-020 and `BriefDraft` ask for nothing more [REQ: FR-020]. So YAML features a brief does not need are refused rather than counted. `readYaml` runs three rules; any refusal gives `brief_unreadable`.

**Rule 1, the token check, before compose.** `passesYamlTokens` (`yaml-tokens.ts`) runs the library's own `Parser` (`new Parser().parse(text)`) and looks at each top-level token:

- A `directive` token whose first word is not `%YAML` is refused. The first word is found the library's way: trim, then split on spaces and tabs. So a `%TAG` line and an unknown directive never reach compose, also with byte-order marks in front of the line. A `%YAML` line is allowed.
- A `document` token nested deeper than `MAX_BRIEF_DEPTH` is refused. Depth is the length of the `path` that `CST.visit` hands its visitor; past the limit the visitor returns `CST.visit.BREAK`.
- When the check refuses, `parseDocument` is not called. When it passes, `parseDocument(text, YAML_OPTIONS)` runs; the text is parsed twice, which costs a few milliseconds and means the check sees the tokens compose sees. If the document's `errors` list is not empty, the file is refused.

**Rule 2, the walk, after compose and before `toJS`.** `passesYamlWalk` (`yaml-walk.ts`) makes one pass with the library's `visit` and refuses:

- any alias node;
- any node with an anchor (a map, a list or a single value, as a key or as a value), also when no alias uses it. Each node kind has its own anchor check, because `visit` calls only the most specific visitor for a node;
- any pair whose key is not a single value (`Scalar`): a list or a map as a key, block or flow form. A quoted key, a number key and an empty key are fine;
- a mapping with a plain key given twice, compared the library's way (`===`): two `.nan` keys are never equal, and `1` and `"1"` are different keys (the later wins when the map becomes an object).

When the walk refuses, `toJS` is not called.

**Rule 3, aliases off.** `doc.toJS({ maxAliasCount: 0 })`. The library then throws at the first alias it meets. It is a second guard behind rule 2.

**Tags are read as plain data.** A value with a tag the reader does not act on (`!!js/function`, `!!binary`, `!!set`, `!!timestamp`, a made-up `!thing`) is read as the plain text, list or map under the tag. The library records a `TAG_RESOLVE_FAILED` warning; it is not treated as an error and is not printed or logged. A tag cannot make anything but plain data, so refusing the file would protect nothing.

**What is read.** A `%YAML 1.2` line; a `%` line inside a block scalar (it is text); a quoted key, a number key, an empty key; `&` and `*` inside text, unchanged (`message: Buy 1 & save *today*`, `callToAction: "*Terms apply & more"`); a tagged value as plain data (`tone: !thing warm`, with no warning written); many tags with no `%TAG` line (`ok`, empty draft).

**What is refused** (all `brief_unreadable`, JSON briefs not affected): an anchor, an alias, a list or map as a key, a `%TAG` or unknown directive, nesting deeper than 32, a key given twice in one mapping, two documents, a top value that is not a map. The stakeholder accepted that such a brief is reported as malformed, with no exact cause [D-053 item 6].

**Depth edge.** The top-level map is level 1. Under a top-level key, 32 nested empty lists are read and 33 refused; with a value inside the innermost list, 31 are read and 32 refused (a value adds one step to the path). 100 nested lists, 100 `- ` on one line, and 100 nested block maps are refused. 10,000 nested lists give `brief_unreadable` without throwing.

**Not chosen: a check on the raw text.** `&` and `*` are common in copy, and only the lexer knows when they are indicators. A raw test for a `%` line is unsound: the lexer skips a byte-order mark at the start of such a line.

### Nothing of the brief leaves

- The errors are fixed values, except the first bad line of a malformed YAML brief, which goes into the command's error and nowhere else.
- A caught error's message, which can quote lines of the file, is never read, put in the result, logged or thrown on. From the library's errors only `pos[0]` (the start offset) is read. `pos` is present on every error of `yaml` 2.9.1.
- Nothing is written to `console.warn`, `console.error` or `process.emitWarning`.
- A `__proto__` key anywhere leaves `Object.prototype` unchanged.
- `fail(BRIEF_UNREADABLE)` hands out one shared error object; no caller may change it.
- **Known exception, accepted.** If `LOG_STREAM` or `LOG_TOKENS` is set in the app's environment, `yaml` 2.9.1 prints every token of the file to the process's own output, and no option turns this off. Only someone who starts the app with those variables set sees it, on their own machine, and that person can already read the file. The app never sets them. Revisit if a brief ever carries a secret.

### Error messages

All are `INVALID_INPUT` with `details.reason = 'brief_unreadable'` [REQ: FR-297]. No exact cause is ever given.

| Case | Message | `details` |
|------|---------|-----------|
| No line known | "The brief is malformed. It could not be read as JSON or YAML." | `{ reason: 'brief_unreadable' }` |
| YAML, line known | "The brief is malformed. The first line that could not be read is line {n}: {text}" | `{ reason: 'brief_unreadable', line: n, lineText: text }` |
| YAML, line known, cleaned text empty | "The brief is malformed. The first line that could not be read is line {n}." | `{ reason: 'brief_unreadable', line: n, lineText: '' }` |

**When a line is given.** Only for YAML, only when the token check passed, and only when the library's document has at least one error. The line holds the smallest start offset among `doc.errors[i].pos[0]`. Files refused by the token check or the walk, a file that is not a map at the top, and every JSON file get no line. In code: `readYaml` throws an internal `YamlFault` carrying the offset or null.

**The line.** Its number is 1 plus the count of `\n` before the offset, in the text after one byte-order mark is removed. An offset past the end counts as the last line. `badLineAt(body, offset): { line: number; text: string }` (`bad-line.ts`) cleans the text, in this order:

1. Take the line without its break and without a trailing `\r`.
2. Turn each tab into one space.
3. Remove U+0000–U+001F, U+007F–U+009F, U+200B–U+200F, U+2028–U+202E, U+2060–U+2069, U+FEFF and every lone surrogate (characters that can hide or reorder text on screen).
4. Trim the end.
5. Cut to `MAX_BAD_LINE_CHARS` (120) code points, adding "…" when cut.

`brief.parse` logs the reason and the line number, never `lineText`. The window shows the message as plain text, never as markup.

### Tests that hold these rules

In `tests/unit/shared/brief/`: `parse.test.ts`, `parse-yaml.test.ts`, `parse-yaml-options.test.ts` (the options, including three tests that watch `parseDocument`), `parse-yaml-subset.test.ts` (the subset and the pinned depth edges), `parse-yaml-walk.test.ts`, `parse-brief-file.test.ts`, `bad-line.test.ts`, `draft.test.ts`.

**Timed tests**, which must keep passing: `parse-slow.test.ts` (named worst cases) and `parse-slow-generated.test.ts` (generated cases), with helpers `slow-fill.ts`, `slow-named.ts` and `test-size.ts`. Each worst-case text is built to `BRIEF_TEST_BYTES` (16,384, in `test-size.ts`; a test size, not an app limit) and must return its stated result from one `parseBrief` call in under 5,000 ms, timed around the call, with a 30-second test timeout. The generated cases are a fixed (not random) list of short units, each repeated three ways; they pin no outcome, only `ok` or `brief_unreadable`, no throw, and the time bound. Units may be added; none removed. Named case 6 (`%TAG` with many tags) is the proof the token check is needed: 48 seconds without it, 0.2 ms with it.

**Known slow paths, accepted.** The `yaml` 2.9.1 parser has two inputs whose time grows with the square of the size, and a file full of syntax mistakes makes about one error object per byte. A large built file can freeze the app. That is a nuisance and is not worked on. If it ever must be, the ideas on record are a worker with a time limit, parsing once through `Composer`, and `Error.stackTraceLimit = 0` around compose.

## Region, language and direction

Built. `src/shared/config/region-languages.ts` (the table, its one owner), `src/shared/brief/languages.ts`.

```ts
type PrimaryLanguageFor = (region: string) => string | null
type IsRightToLeft = (tag: string) => boolean
```

- `primaryLanguageFor(region)` finds a region by its ISO 3166-1 two-letter code or an English name, in any letter case, after trimming. The common names UK, USA, UAE, Holland and Korea are accepted. Not in the table: null, and the language field is then empty and required [REQ: FR-026].
- The table gives a plain language tag (`en`, not `en-US`). The campaign keeps the region beside the language. China, Taiwan and Hong Kong give plain `zh`, accepted by the stakeholder [D-053 item 18]; which script to write (simplified or traditional) is decided when translation is designed (Phase 6).
- A country with several main languages gives the one most people speak there: CA `en`, CH `de`, BE `nl`, LU `fr`, IN `hi`. The user can change it.
- A region whose main language is right-to-left (for example SA, IL) still gives that language. The refusal comes from `campaign.create`, with its own message, so the user sees why.
- Right-to-left languages (`ar`, `he`, `fa`, `ur`, `yi`, `ps`, `sd`, `dv`) are refused by `campaign.create` with `RULE_VIOLATION` and "Right-to-left languages are not supported yet." [REQ: FR-104]
- `isRightToLeft` trims the tag, splits on the first `-` or `_`, and compares the language part in any letter case. So `ar_SA`, `he_IL` and `AR_sa` are right-to-left; `en_US` and `x_ar` are not. An underscore is not BCP-47, but hand-written briefs use it and the `languages` input accepts any non-empty text. The tag is stored as typed; nothing rewrites it. Tests: `tests/unit/shared/brief/languages.test.ts`.

## The `brief.parse` command

Built. `src/main/commands/brief/parse.ts`; input schema and reply type in `src/shared/schemas/commands/brief.ts`. Tests: `tests/integration/campaigns/brief-parse.test.ts`.

**Input.** `projectId` plus exactly one of `filePath` (non-empty text) or `text`. Both or neither is `INVALID_INPUT` ("Give a file path or text, not both."). A `filePath` that is not absolute is `INVALID_INPUT` ("The file path must be absolute."), before any read.

**Reply.**

```ts
type BriefParsed = { draft: BriefDraft; primaryLanguage: string | null }
```

`primaryLanguage` is the first entry of `draft.languages` if there is one, otherwise `primaryLanguageFor(draft.region)`, otherwise null.

**How it reads.**

- **A file.** The ending, in any letter case, picks the syntax: `.json` is JSON, `.yaml` and `.yml` are YAML, with no second try. The whole file is read as UTF-8 (no size check). The command writes nothing: the file is read in `prepare` and the draft returned from `run`.
- **`text` with no file.** It tries `parseBriefFile(text, 'json')`; if that is not `ok`, it returns the answer of `parseBriefFile(text, 'yaml')`, bad line included.

**Errors.**

| Case | Code | Reason | Message |
|------|------|--------|---------|
| Cannot be read as a brief | `INVALID_INPUT` | `brief_unreadable` | See "Error messages" above. |
| Any ending other than `.json`, `.yaml`, `.yml`, or none (`.md` and `.txt` until Phase 4) | `RULE_VIOLATION` | `brief_type_not_supported` | "This kind of brief file cannot be read yet. Use a JSON or YAML file." |
| File not there | `NOT_FOUND` | | "That file was not found." |
| File cannot be read | `RULE_VIOLATION` | `file_not_readable` | "That file could not be read." |

**`BriefError`** (security class), private to `parse.ts`. The reply gets the full error, which may hold the bad line's text. The bus logs an error's message, so `BriefError` gives the bus a message with the line number only ("The brief is malformed. The first line that could not be read is line {n}."): the log gets the reason and the line number and no word of the file.

**Who may call it.** The window, through the file picker (`dialog.pickFiles` with purpose `brief`). Agents may not: the agent policy table denies `brief.parse` ("read brief files"); see `spec/mcp-and-agents.md`.

## From a brief to a campaign

### The other `campaign.create` inputs

Built. `src/shared/schemas/commands/campaign.ts` owns them (frozen with `brief.ts`); handler in `src/main/commands/campaign/create.ts`. [REQ: FR-023–FR-026]

| Input | Shape | Rules |
|-------|-------|-------|
| `subjectMap` | One entry for each entry of `brief.subjects`, in the same order: `{ subjectId: string, create: boolean }` | `create: true` makes a new subject with that ID (format in `spec/data-model.md`) and the brief entry's name and description; `RULE_VIOLATION` if the ID is taken. `create: false` uses the existing subject; `NOT_FOUND` if there is none. A wrong number of entries is `INVALID_INPUT` ("Give one subject entry for each subject in the brief."). |
| `languages` | BCP-47 tags, at least one, each non-empty | The first is the primary language. A right-to-left language is refused. |
| `sizes` | `CampaignSize[]`, at least one | The first is the master variant's size. Labels are unique ("Size labels must differ."). |
| `ruleSet` or `copyRuleSetFrom` | `ruleSet`: the four lists of the `rule_set` table (`requiredAssetIds`, `palette`, `requiredWords`, `prohibitedWords`). `copyRuleSetFrom`: a campaign ID in the same project. | At most one of the two ("Give a rule set or a campaign to copy it from, not both."). With neither, the rule set holds the brief's `requiredWords` and `prohibitedWords` (through `wordsByLanguage`) and nothing else. |
| `templateId` | string | `starter` is the only template in this build. Any other ID is `NOT_FOUND`, "That template is not in this build." |

**Defaults.** Default sizes are the ready-made sizes picked by default in `src/shared/config/defaults.ts`: 1080×1080 (`1x1`), 1080×1920 (`9x16`), 1920×1080 (`16x9`); `4x5` (1080×1350) is ready-made but not picked by default. The default language comes from the region table; if the region is not in the table the language field is empty and required [REQ: FR-026].

**The MCP tool `create_campaign`.** `sizes`, `languages` and `rule_set` are optional. The tool fills in what is missing before it calls the command: the brief's own values if it has them, otherwise the default sizes and the region table's language. If no language can be found the tool returns `INVALID_INPUT`. See `spec/mcp-and-agents.md`.

### What the project page sends

Built. `src/renderer/screens/project-home/brief-load/`, `brief-form/`, `subject-rows/`, `size-fields/`, `rule-fields/`, `brief-form-model.ts` (with `brief-form-problems.ts`, `brief-form-sizes.ts`), `campaign-input.ts` (`briefSubjectIds`). Tests: `tests/unit/renderer/screens/project-home/brief-load.test.tsx`, `brief-type.test.tsx`, `brief-subject-ids.test.tsx`, `brief-form*.test.ts(x)`, `size-fields.test.tsx`, `rule-fields.test.tsx`. The form, its wording and its problem lines are in `spec/screens-campaign.md`, "The brief form".

"Load a brief" opens the picker, calls `brief.parse`, and opens the brief form filled from the draft (every value the brief's own text, shown as field values). "Type a brief" opens the same form empty. The user edits it [REQ: FR-023]. "Create campaign" sends `subject.create` for each new subject, then `campaign.create`, and stops at the first refusal. Cancel sends nothing. Nothing is sent while the form has a problem line or the input fails the shared `campaign.create` schema.

- **Languages:** the form's "Languages" field. It starts as the brief's own, else the reply's `primaryLanguage`, else empty (a problem line).
- **Sizes:** the ticked ready-made sizes and the typed "Other sizes", each read with `parseSize` (a problem line for one that cannot be read), the chosen master first. They start as the brief's own, else the ready-made sizes with `selectedByDefault`.
- **`templateId`:** `starterTemplate.id`. **Rule set:** "Use these word lists" sends no rule input, so the rule set holds the brief's word lists as edited on the form (sent in `brief`, only for the listed languages); "Copy the rules from another campaign" sends `copyRuleSetFrom`. Colours and required files are not on the form (A-44).
- **Subjects:** every `subjectMap` entry has `create: false`, because the subjects are made first with `subject.create`. If `campaign.create` then fails, the made subjects stay.
- **A brief subject with no `id` gets one made from its name**, and so does a new row on the form whose "Subject ID" is left blank (provisional, OI-72: made subject IDs and reuse of held subjects await the stakeholder). Each run of spaces becomes `-`; every character outside `A–Z a–z 0–9 - _` is dropped; the result is cut to 64 characters; an empty result becomes `subject`. `Summer Splash 2!` gives `Summer-Splash-2`. When two subjects of one brief would share an ID (or a made ID equals an ID the brief gives), the later gets `-2`, `-3` and so on, cut so the whole fits 64. The made ID must pass the shared `SubjectId` schema, the one owner of the format. An `id` the brief gives or the user types that breaks the format is a problem line ("Subject {i}: the ID "{id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters."); it is not replaced.
- **A subject the project already holds** opens as "Use a subject this project has", gets no `subject.create` and is used as it is (provisional, OI-72). A differing name or description updates nothing; the stored subject wins. The campaign's stored `brief` still holds the brief's own words. The same brief loaded twice gives the same subjects.

### The intake screens

Built (slices S2-13, S2-14, S2-15). In `spec/screens-campaign.md`, "The brief form" and "The slot view":

- **Blank brief form.** "Type a brief" opens the same form empty.
- **Editable confirm form** [REQ: FR-023, FR-024, FR-026, FR-034]. Every field; one row per subject with "New subject" (a "Subject ID" field) or "Use a subject this project has"; sizes, master size and languages; the brief's word lists per language, or "Copy the rules from another campaign" (`copyRuleSetFrom`). Colours and required files are not on the form (A-44). The pure model `brief-form-model.ts` replaced `campaignPlan`; `briefSubjectIds` stays.
- **Slot view.** Filled and empty slots of the master with candidates from `template.slots` [REQ: FR-042], view only (A-46), on the campaign page below the grid.

### Not built: Markdown and plain-text briefs

Not built (Phase 4). `.md`, `.markdown` and `.txt` briefs go to the command `brief.extract`, an attached `brief_extraction` job that calls `TextProvider.extractBrief` and gives a `BriefDraft` for the same brief form [REQ: FR-022]. With no key, the app shows the key dialog; the user can cancel and fill the form by hand [REQ: FR-171]. `brief.parse` keeps refusing these files with `brief_type_not_supported`. Design: `spec/ai-jobs.md`, "Brief reading"; screens: `spec/screens-ai.md`.

## Templates

Built. `src/shared/templates/types.ts` (frozen), `starter.ts`, `master-layers.ts`; layout values in `src/shared/config/default-layout.ts`; queries `template.list` and `template.slots` in `src/main/queries/template.ts`; fills in `src/main/commands/campaign/fills.ts`.

### Shapes

```ts
type SlotType = 'image' | 'copy'
type Slot = { id: string; type: SlotType }
type Template = { id: string; name: string; slots: Slot[] }
type NewLayer = Omit<LayerRow, 'id' | 'variantId'>
type SlotFill = { assetId: string } | { text: string }   // asset for an image slot, text for a copy slot
type SlotFills = Partial<Record<string, SlotFill>>       // slot ID to fill; a slot left out is empty
type SlotState = { slot: Slot; state: 'filled' | 'empty'; candidates: string[] }   // asset IDs

buildMasterLayers(template: Template, size: CampaignSize, fills: SlotFills): NewLayer[]
slotStates(template: Template, layers: LayerRow[], candidates: Record<string, string[]>): SlotState[]
```

**A template** is the list of slots and their order [REQ: FR-040]. It holds no position, size or style. Templates are app code, so a slot named like a built-in property (`constructor`) cannot come from a user.

### The starter template

`starterTemplate`: `id: 'starter'`, `name: 'Starter'` [REQ: FR-040, FR-041].

| Slot ID | Type | Filled from |
|---------|------|-------------|
| `background` | image | Empty until generated or chosen |
| `subject-image` | image | A hero image of the campaign's subjects, if any: an image in the asset library attached to a subject; the first subject with one, its newest [REQ: R-12] |
| `logo` | image | The first image in the rule set's required assets, if any |
| `headline` | copy | The campaign message (trimmed), always [REQ: FR-043] |
| `call-to-action` | copy | The brief's `callToAction`, if given and not blank |

`slotFills` (`fills.ts`) builds `fills` from the template's own slots, so `buildMasterLayers` never meets a slot it lacks. It reads asset rows by ID only and never builds a path.

### Subject image cases

[REQ: FR-055, R-12]

| The subject has | Slot shows | Generation panel |
|-----------------|-----------|------------------|
| A hero image (asset library) | Filled | Not needed |
| Only reference-library files | Empty | Prompt pre-filled, the subject's reference files attached |
| No files | Empty | Prompt pre-filled from the subject description and the campaign message |

### `slotStates` and the template queries

- `slotStates` gives one entry per template slot, in template order. A layer fills its slot when it has that slot ID and, for an `image` or `background` layer, its `source` is not null (the background layer exists before any picture is chosen); a `text` layer with the slot ID fills it. A slot ID missing from `candidates` has an empty list; a copy slot always has an empty list; asset IDs pass through as given; no row is read.
- `template.list` gives the templates of this build (copies). `template.slots` gives `slotStates` for the campaign's master variant, with candidates: `subject-image` gets the hero images of the campaign's subjects, newest first; `logo` gets the images among the rule set's required assets. See `spec/api-queries-events.md`.

## The default layout and `buildMasterLayers`

Built. `src/shared/config/default-layout.ts` (every number and name, as data), `src/shared/templates/master-layers.ts`. Tests: `tests/unit/shared/templates/master-layers.test.ts`, `master-layers-fields.test.ts`, `starter.test.ts`, `tests/integration/campaigns/campaign-create-fills.test.ts`.

**Look pack** (Not built, LK-4) [D-094]. The default layout becomes the first of five starter layouts, `photo-bottom-left` (A-77), and its boxes, styles and look fields replace the values in the tables below; the "any other slot" rows stay. Each text layer's starting font size comes from its text's length by an estimate, with no measuring, so a long message no longer runs past its box. New layers store every look field. Full tables, the formula and its worked values: `spec/starter-layouts.md`. Until LK-4 merges, the tables below hold.

**What it is.** The default layout gives each new layer of a master variant a starting box and style for the campaign's first size, so the post is not a pile of layers in one corner [REQ: FR-040, FR-043]. It is a starting point only: the user moves and restyles everything in the editor (Phase 3), and `generation.proposeLayout` can place the text again (Phase 4).

**One owner.** `buildMasterLayers` reads `default-layout.ts` and holds no number of its own. Any later code that needs a starting box for a slot reads the same file. The values are provisional (the stakeholder's standing instruction on UI); the design pass may change any of them by editing that one file. The tests state the expected numbers for the four ready-made sizes, so a change to the file is a visible test change, approved with the design pass.

### Boxes

`W` and `H` are the size's width and height in pixels. `S` is the smaller of the two. `m = round(0.06 × S)` is the margin. Every result is rounded to a whole pixel with `Math.round`. `rotation` is 0 and `crop` is null for every layer.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `background` | 0 | 0 | `W` | `H` |
| `subject-image` | `round((W − side) / 2)` | `round(0.22 × H)` | `side` | `side`, where `side = round(0.46 × S)` |
| `logo` | `m` | `m` | `round(0.14 × S)` | `round(0.14 × S)` |
| `headline` | `m` | `round(0.70 × H)` | `W − 2m` | `round(0.16 × H)` |
| `call-to-action` | `m` | `round(0.88 × H)` | `W − 2m` | `round(0.06 × H)` |
| Any other image slot | `round((W − side) / 2)` | `round((H − side) / 2)` | `side` | `side` |
| Any other copy slot | `m` | `round(0.42 × H)` | `W − 2m` | `round(0.16 × H)` |

The rule works for any size the `CampaignSize` schema allows (each side from 50 to 8,192 pixels): every box has a width and height above zero and every font size is above zero. The five named boxes above the background do not overlap for any shape: the logo ends at `0.20 × S`, the subject image sits between `0.22 × H` and `0.68 × H`, the headline between `0.70 × H` and `0.86 × H`, the call to action between `0.88 × H` and `0.94 × H`. Worked values, which the tests use (each cell is x, y, width, height):

| Size | `subject-image` | `logo` | `headline` | `call-to-action` |
|------|-----------------|--------|------------|------------------|
| 1080 × 1080 | 292, 238, 497, 497 | 65, 65, 151, 151 | 65, 756, 950, 173 | 65, 950, 950, 65 |
| 1080 × 1920 | 292, 422, 497, 497 | 65, 65, 151, 151 | 65, 1344, 950, 307 | 65, 1690, 950, 115 |
| 1920 × 1080 | 712, 238, 497, 497 | 65, 65, 151, 151 | 65, 756, 1790, 173 | 65, 950, 1790, 65 |
| 1080 × 1350 | 292, 297, 497, 497 | 65, 65, 151, 151 | 65, 945, 950, 216 | 65, 1188, 950, 81 |

`buildMasterLayers` does not know a picture's own width and height, so an image layer gets the slot's box as it is. How a picture of another shape is drawn inside its box is the Scene's rule, set in Phase 3.

### Style

Image and background layers: `{ opacity: 1 }`. Text layers:

| Slot | fontAssetId | fontSize | fontWeight | color | align | lineHeight | letterSpacing |
|------|-------------|----------|------------|-------|-------|------------|---------------|
| `headline`, and any other copy slot | null | `round(0.07 × S)` (76 when `S` is 1080) | 700 | `#FFFFFF` | `center` | 1.1 | 0 |
| `call-to-action` | null | `round(0.035 × S)` (38 when `S` is 1080) | 600 | `#FFFFFF` | `center` | 1.2 | 0 |

The headline box holds two lines at that size and the call to action one (LK-4 replaces this with the starting font size of `spec/starter-layouts.md`). Longer text is not shrunk here; the Scene's overflow measurement reports it (`spec/data-model.md`).

### The layers

`buildMasterLayers(template, size, fills)` returns, in this order:

1. **The background layer, always.** `type: 'background'`, `key: 'background'`, `name: 'Background'`, `z: 0`, `copy: null`. `slot` is `'background'` when the template has a slot with that ID, otherwise null. `source` is `{ assetId }` when `fills.background` is given, otherwise null.
2. **One layer for each other slot that has a fill**, in the template's slot order, with `z` counting up from 1 with no gaps. A slot with no fill gets no layer.

| Slot | type | key | name | copy | source |
|------|------|-----|------|------|--------|
| `subject-image` | `image` | `subject-image` | Subject image | null | `{ assetId }` from the fill |
| `logo` | `image` | `logo` | Logo | null | `{ assetId }` from the fill |
| `headline` | `text` | `headline` | Headline | the fill's text, unchanged | null |
| `call-to-action` | `text` | `call-to-action` | Call to action | the fill's text, unchanged | null |
| Any other slot | `image` or `text` by the slot's type | the slot ID | the slot ID | as above | as above |

The `key` is the slot ID, so it is the same in every master and every fanned-out variant. The same values on every layer:

| Field | Value |
|-------|-------|
| `visible` | true |
| `locked` | false |
| `linked` | false (a master follows nothing) |
| `overrides` | `[]` |
| `timing` | `{ startMs: 0, endMs: null }`: shown for the whole variant |
| `animation` | `entrance` and `exit` both `{ preset: 'none', startMs: 0, durationMs: 0 }` |
| `revs`, `syncedRevs` | every counter 0 |
| `translationStatus` | null |
| `translationSource` | null, the headline included |
| `overflow` | false |

- **Why `translationSource` is null on the headline.** The field says where a translation came from. The master's text is in the primary language and is not a translation, and `translation_status` is null there too. `brief` is written only at fan-out, for a language whose copy the brief supplied (`spec/data-rules.md`, fan-out).
- The function does not trim, shorten or check the text. `campaign.create` passes the trimmed campaign message for `headline` [REQ: FR-043] and leaves `call-to-action` out of `fills` when the brief has none.
- It does not check that asset IDs exist; the caller does. `campaign.create` gives each returned layer its `id` and `variantId`, and every such layer passes `LayerRow`.

**Errors.** `buildMasterLayers` throws a plain `Error` (the bus answers `INTERNAL`) for a programming error, before building anything:

- a slot ID in `fills` that the template lacks;
- a fill of the wrong sort for the slot type (text for an image slot, an asset for a copy slot);
- a template whose `background` slot is of type `copy`, whatever `fills` holds. Without this a text fill for such a slot would pass the check and then be dropped. The starter template cannot cause it.

**Fresh values.** The result shares nothing with its inputs, with the config file, or with earlier results: changing a returned layer changes no other value. That includes values inside one layer: `revs`, `syncedRevs`, `animation.entrance` and `animation.exit` are each their own object on every layer (the config writes each out separately, and each call deep-copies it). Raising `revs.copy` leaves `syncedRevs.copy` at 0; changing the entrance leaves the exit unchanged (`master-layers-fields.test.ts`).
