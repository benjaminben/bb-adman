# Requirements: export, reporting and cloud publishing

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.13 Export

**FR-140:** The user can export a single variant, a selection of variants or a whole campaign to a folder.
**Priority:** P0

**FR-141:** Image variants export as PNG or JPG. Video variants export as MP4.
**Priority:** P0

**FR-142:** Exports are organized by campaign, post title and ratio. The post title defaults to the subject IDs joined together (for example `SKU1+SKU2`), which keeps outputs organized by product and aspect ratio as the brief requires. Each file name includes the language and the variant's short ID, so two variants never write to the same file.
**Priority:** P0
**Notes:** Example: `{campaign}/{post title}/{ratio}/{language}-{variant id}.{ext}`. The architect may adjust the exact pattern.

**FR-143:** The tool needed to export video is included in the app. The user installs nothing extra.
**Priority:** P0

### 4.14 Reporting and Logging

**FR-150:** After each export the app produces a report listing every variant, which assets were generated (with provider, model and prompt) and which were reused, the result of each check including warnings the user overrode, and any failures.
**Priority:** P0

**FR-151:** The report can be viewed in the app and is saved with the export as a readable file and a JSON file.
**Priority:** P0

**FR-152:** An activity panel lists running and finished background jobs with status and retry. It is one list for the project's work: it shows the jobs of every open campaign together, whichever campaign or variant is on screen. The user can reach it from anywhere in the project.
**Priority:** P0
**Notes:**
- Each entry says what it belongs to and leads there (FR-217), and shows whether a finished result has been looked at (FR-218).
- A job stays in the list when the tab of its campaign or variant is closed (FR-215).
- Whether the list also shows jobs from another project depends on Q-038 and Q-039, which are not decided.
**Changed in 1.4:** D-028. Before: "An activity panel lists running and finished background jobs with status and retry."

**FR-153:** The app keeps a local log of its activity. Nothing is sent anywhere. The log is structured so that opt-in telemetry could be added later.
**Priority:** P0

### 4.15 Cloud Publishing

**FR-160:** The user can connect cloud storage with their own credentials. Amazon S3 and Dropbox must work in this build. Azure is listed but disabled and marked as not yet available. All three sit behind the same boundary.
**Priority:** P0
**Changed in 1.1:** R-15. Before, at least one of the three had to work.

**FR-161:** Publishing is a manual action per campaign. It is never automatic.
**Priority:** P0

**FR-162:** Publishing uploads the campaign's final exports, the components used in them (backgrounds, logos, subject images, and fonts where the licence allows), the translation sheet and the report. It does not upload every generation attempt or the editable project data.
**Priority:** P0
**Notes:** Generated components keep their embedded generation details (FR-068) when published.

**FR-163:** Published files are organized so a teammate without the app can browse them by campaign, post and ratio.
**Priority:** P0

**FR-164:** Each campaign publishes into its own folder, named by campaign ID. Publishing again replaces that campaign's earlier files after a warning. One campaign never overwrites another's files, including when several people publish to the same bucket.
**Priority:** P0
