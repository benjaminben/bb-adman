# REQUIREMENTS.md

**Project:** Creative Automation App (working title)
**Version:** 1.0
**Date:** 2026-11-21
**Prepared by:** Requirements Analyst
**Status:** Approved

**How to read this document**

- Priorities: P0 = must-have, P1 = should-have, P2 = nice-to-have. Every key feature in the original brief is P0 by instruction.
- Source brief: `ANALYST-PROMPT.md`. Where discovery changed a decision in that brief, Section 9.5 records the change. Follow this document where the two differ.
- Section 10.2 lists answers the analyst proposed and the stakeholder accepted without comment. They are treated as confirmed, but they are the first place to look if something seems wrong.
- Section 11 lists what is still open. None of it blocks architecture.

---

## 1. Project Overview

### 1.1 Purpose
A desktop app that lets a non-technical member of a creative team turn a campaign brief into a set of social ad posts. The app reuses existing assets, generates missing ones with AI, and produces every post in the required aspect ratios, languages and formats (image or video). It is similar in spirit to Canva, but local, centred on digital marketing, open to several AI providers, and controllable by an external AI agent.

### 1.2 Problem Statement
The client is a global consumer goods company that launches hundreds of localized social ad campaigns each month. Today:

1. Creating and localizing variants by hand is slow, expensive and error-prone.
2. Creative from decentralized teams and agencies is often off-brand or low quality.
3. Approvals are slow because many people per region must review.
4. Performance data is siloed and reported by hand.
5. Skilled staff spend their time on repetitive requests.

This build addresses items 1, 2 and 5 directly. It helps item 3 by producing organized, shareable deliverables. Item 4 is out of scope.

### 1.3 Success Criteria
- A user can go from a brief file to a full exported set of posts (all chosen ratios and languages) without editing a settings file or reading the README.
- A change made to a master variant can be reviewed and applied to all linked variants in one review step.
- Text stays editable and translatable up to the moment of export. The image model never draws the text.
- Every export runs the campaign's brand and legal checks and produces a report.
- A project folder can be copied to another machine and opened there with nothing missing.
- A user with their own AI subscription or enterprise AI can have an external agent place copy in the app without paying for a separate layout API.
- The stakeholder has set no measurable targets (time per campaign, campaigns per month).

### 1.4 Scope

**In scope:**
- Projects stored as folders on the user's computer, each holding several campaigns and a shared set of subjects.
- Brief intake from JSON, YAML, markdown or plain text, or from a form.
- Asset import and reuse within a project.
- AI generation of images, text layout proposals, copy options, translations and image-to-video.
- A layer-based editor (background, image and text layers).
- Variants along ratio, language and format, with links, overrides and a sync review.
- Video variants with a timeline, a multi-clip background track, and entrance and exit text animations.
- Brand and legal checks before export.
- Export to an organized folder, with a report.
- Publishing a campaign's components and deliverables to cloud storage.
- An MCP server that lets an external agent read and edit the open project.
- A public repository with a README.

**Out of scope for this build:**
- Login, roles and per-user access control. The app is single-user.
- Two people editing the same campaign. Sharing a project means copying its folder.
- Sharing subjects or assets between separate projects, other than by import or copy.
- Automatic cloud sync or cloud backup of editable project data.
- Share links for published files.
- Posting to social platforms, ad spend and performance analytics.
- Approval workflows inside the app.
- User-made templates.
- Changing which properties a link follows.
- An external agent starting paid image or video generation, exporting to disk, or publishing to cloud. These are deferred and may be allowed later, so the design should not rule them out.
- An external agent reading or changing saved keys. This is never allowed.
- Editor features: shapes, text effects (shadow, outline, fill), grouping, safe-zone overlays, masks, blend modes, filters, freehand drawing, stock libraries, multi-page documents.
- Timeline features: custom keyframes, easing curves, animation of image layers, audio tracks, splitting a clip in two, transitions between clips, overlapping clips.
- Editing the content of generated video inside the app.
- Audio. All video is silent.
- Right-to-left languages.
- Importing a corrected translation sheet back into the app.
- Cultural adaptation of copy as a separate feature. Translation takes region and audience as context only.
- Dark theme.
- Sending telemetry. Automatic app updates.

---

## 2. Stakeholders

| Role | Name / Team | Responsibilities | Notes |
|------|-------------|------------------|-------|
| Sponsor | Corporate client (global consumer goods company) | Owns the business goals in the brief | No named contact recorded |
| Product owner | The stakeholder interviewed for this document | Decides requirements and priorities | |
| Primary users | Creative team members | Build campaigns, edit posts, export and publish | Not technical |
| Secondary users | Teammates without the app | View published files in cloud storage | Never open the app |
| Secondary users | Translator or interpreter colleagues | Verify the exported translation sheet | Work outside the app |
| Operations / Admin | None | | Single-user desktop app, user supplies own keys |
| External parties | AI providers, cloud storage providers | Supply generation and storage through the user's own accounts | |
| External parties | External agent apps | Connect to the app's MCP server on the user's behalf | Run under the user's own subscription or enterprise AI |
| External parties | Readers of the public repo | Read the code and run the app from the README | |

---

## 3. User Roles & Permissions

### 3.1 Creative User
- **Description:** A member of a creative team. Comfortable with design tools such as Canva, Photoshop or Premiere. Not technical. Will not edit config files or use a terminal.
- **Permissions:** Everything in the app. There is one human role.
- **Key Workflows:** Create or open a project, start a campaign from a brief, fill template slots, edit the master variant, fan out, review sync, approve translations, export, publish.

### 3.2 External Agent
- **Description:** An AI agent running in another app on the same computer, connected through the MCP server. It acts for the Creative User, who gives it instructions in that other app.
- **Permissions:** Limited to the actions in Section 4.18. Destructive actions need the user's permission in the app's UI. It can never see keys.
- **Key Workflows:** Look at a variant, place and style copy, write copy and translations, set up campaigns and variants, run checks.

---

## 4. Functional Requirements

### 4.1 Projects

**FR-001:** A project is a folder on the user's computer. The folder holds everything needed to open and edit the project: its data file, imported assets and generated files.
**Priority:** P0
**Notes:** Copying the folder to another machine and opening it there must work with nothing missing. Keys are never stored in the project folder.

**FR-002:** The app has no global history of the user's work. The user creates a project, opens a project folder, or picks from a recent-projects list.
**Priority:** P0

**FR-003:** Several projects can be open at the same time, as tabs in one window.
**Priority:** P0

**FR-004:** New projects are created in a default location inside the user's own documents area. The user can change the default and can choose a location per project.
**Priority:** P0

**FR-005:** A project holds any number of campaigns and one shared set of subjects.
**Priority:** P0

**FR-006:** The project saves automatically after every change. There is no save button. Undo history is cleared when the project closes.
**Priority:** P0

### 4.2 Subjects

**FR-010:** A subject is the thing an ad is about. It can be a physical product or a service. The UI term is "Subject". The brief's term "product" maps to it.
**Priority:** P0

**FR-011:** Each subject has a unique ID within the project (for example a SKU), a display name, a description and attached reference files.
**Priority:** P0
**Notes:** Two different subjects must never share stored assets. The ID, not the display name, identifies the subject.

**FR-012:** Subjects are shared by all campaigns in the project. They are not shared between projects except by import or copy.
**Priority:** P0

### 4.3 Brief Intake

**FR-020:** The app accepts a campaign brief as a JSON file, a YAML file, a markdown file or a plain text file. The user can also fill in a form with no file.
**Priority:** P0

**FR-021:** A brief contains: subjects (at least two must be supported, with no hard upper limit), target region or market, target audience and campaign message.
**Priority:** P0
**Notes:** Optional extra fields are accepted: offer, call-to-action, tone, required words, prohibited words, and copy per language.

**FR-022:** For markdown and plain text briefs, the app uses AI to extract the fields.
**Priority:** P0

**FR-023:** For every brief, the app shows a filled-in form that the user must confirm before any generation happens.
**Priority:** P0

**FR-024:** For each subject in the brief, the user either confirms a new subject ID or picks an existing subject from the project. Picking an existing subject reuses its files.
**Priority:** P0

**FR-025:** One brief creates one campaign.
**Priority:** P0

**FR-026:** On the confirm form the user picks the campaign's ratios and languages. Defaults are 1:1, 9:16 and 16:9, and the main language of the region.
**Priority:** P0

**FR-027:** The user can supply translations up front, as copy per language in the brief or typed on the confirm form.
**Priority:** P1

### 4.4 Campaigns

**FR-030:** A campaign targets exactly one region. A second region means a second campaign in the same project.
**Priority:** P0

**FR-031:** A campaign has its own list of languages, its own list of ratios and sizes, and a chosen set of subjects.
**Priority:** P0

**FR-032:** The user can add custom ratios or pixel sizes to a campaign.
**Priority:** P0
**Notes:** Default pixel sizes are 1080×1080 (1:1), 1080×1920 (9:16) and 1920×1080 (16:9).

**FR-033:** A campaign has a rule set: required assets (for example a logo file), a brand colour palette, required words and prohibited words.
**Priority:** P0
**Notes:** Used by the checks in 4.11.

**FR-034:** When setting up a campaign, the user can copy the rule set from another campaign in the project.
**Priority:** P0

### 4.5 Templates and Slots

**FR-040:** A template is a list of expected content slots, each either an image slot or a copy slot. A template does not define positions.
**Priority:** P0

**FR-041:** The app ships with at least one starter template with these slots: background, subject image, logo, headline (which holds the campaign message) and call-to-action. Users cannot create templates in this build.
**Priority:** P0

**FR-042:** After the brief is confirmed, the app shows each slot as filled (from the brief or from a subject's files) or empty.
**Priority:** P0

**FR-043:** The campaign message from the brief is placed word for word in the main text slot and appears on every final post.
**Priority:** P0

**FR-044:** For an empty image slot, the user can open a generation workflow (see 4.7).
**Priority:** P0

**FR-045:** For an empty copy slot other than the campaign message, the user can type the copy or have the app generate options.
**Priority:** P0

### 4.6 Asset Import and Reuse

**FR-050:** The user can add a local folder or individual files to the project.
**Priority:** P0

**FR-051:** Accepted file types are images, video, text content (files containing copy or briefs: txt, md, JSON, YAML) and font files.
**Priority:** P0

**FR-052:** Imported files are copied into the project folder.
**Priority:** P0

**FR-053:** Imported assets remain available between sessions and are reused when available instead of generating new ones.
**Priority:** P0

**FR-054:** Imported files go into a project pool. The user can attach a file to a subject on import or later, so the app can offer it when that subject is used.
**Priority:** P0

**FR-055:** For each subject the app handles three cases: a finished hero image exists and is used as-is; only a product shot or reference files exist and are sent to the image model to build a new scene; nothing exists and an image is generated from the subject description and campaign message.
**Priority:** P0

**FR-056:** Uploaded fonts can be used on text layers. Non-Latin left-to-right scripts (for example Chinese, Japanese, Korean) can use their own font.
**Priority:** P0

### 4.7 AI Generation

**FR-060:** When assets are missing, the app can generate new ones with an AI image model.
**Priority:** P0

**FR-061:** The image model never draws text. Text layout is proposed separately and the app renders it as editable text layers. A layout proposal can come from three sources: a third-party vision API on the user's key, an external agent through the MCP server (4.18), or the user placing text by hand.
**Priority:** P0

**FR-062:** The generation panel pre-fills a prompt from the brief (subject, audience, region, message) and attaches the subject's reference files. The user can edit the prompt.
**Priority:** P0

**FR-063:** Each run produces a number of options that the user can set. The user picks one or runs again.
**Priority:** P0

**FR-064:** Before a run starts, a confirmation dialog shows how many generations it will use.
**Priority:** P0

**FR-065:** All image and video generation is started by the user in the app, for one variant at a time. The master variant is built first.
**Priority:** P0

**FR-066:** Every generator (image, layout, text, video) sits behind a provider boundary so providers can be swapped.
**Priority:** P0

**FR-067:** The user sets a default provider for each AI job in Settings. On the confirmation dialog before each run, the user can change the provider for that run. A provider that is not working yet is listed but disabled and marked as not yet available.
**Priority:** P0

**FR-068:** Each generated asset carries the provider, model and prompt that made it, embedded in the file's own metadata in a form other tools can read. This applies to generated assets only. Final exports do not carry it.
**Priority:** P0
**Notes:** The stakeholder's reference is how ComfyUI embeds generation details in its image files. The same details are used in the export report (FR-150).

**FR-069:** Provider failures (bad key, quota used up, content refused, timeout) are shown as plain-language messages with the reason and a retry action. Raw error codes are never shown.
**Priority:** P0

### 4.8 Variants, Links and Sync

**FR-070:** A campaign has any number of variants. A variant is one post. It has a unique short ID, a title, a ratio (or size), a language, a format (image or video), a duration if it is a video, its subjects and a stack of layers.
**Priority:** P0
**Notes:** Titles do not have to be unique. The short ID is what tells variants apart.

**FR-071:** A variant can feature one subject or several together.
**Priority:** P0

**FR-072:** A campaign has one or more creative directions (for example "Beach" and "Studio"). Each direction has exactly one master variant. All cascading changes in a direction come from its master.
**Priority:** P0

**FR-073:** A master variant can be edited. It cannot be deleted while its direction exists, and another variant cannot be made the master in its place.
**Priority:** P0

**FR-074:** A new direction is made by duplicating a master variant. The copy becomes the master of the new direction. The campaign view shows one grid per direction.
**Priority:** P0

**FR-075:** Fan-out creates the grid of variants for the chosen ratios, languages and formats, each linked to the direction's master. Fan-out is a separate step the user starts after approving the master.
**Priority:** P0

**FR-076:** During fan-out the app shows a dialog for each new ratio where the user chooses how the background fits: scale, crop, or generate fill to extend the image.
**Priority:** P0
**Notes:** Generate fill is the only image generation in fan-out and happens only when the user chooses it. Translations are the other AI calls in fan-out.

**FR-077:** Background transforms (scale, position, crop) are stored and stay editable later. Cropping never discards pixels.
**Priority:** P0

**FR-078:** A layer in a variant can be linked to the layer with the matching ID in its master. Links are one level deep. Chains are not allowed.
**Priority:** P0

**FR-079:** Links follow properties, not whole layers. Across ratios, copy and style follow and position and size do not. Across languages, position and style follow and copy is a translation of the source. These defaults are fixed in this build.
**Priority:** P0

**FR-080:** A linked layer can override anything it inherits, including background image and copy. Each ratio can have its own background.
**Priority:** P0

**FR-081:** When a master layer changes, linked variants are marked out of date. Nothing changes in another variant until the user starts a sync.
**Priority:** P0

**FR-082:** The sync review shows a preview of the change for each affected variant. The user can accept each one individually, "Accept All" or "Accept Selected", and then edit the remaining ones by hand.
**Priority:** P0

**FR-083:** Layers with an override are skipped by sync and flagged in the review. For each, the user chooses to keep their version, take the master's, or edit by hand.
**Priority:** P0

**FR-084:** When master copy changes, the sync review includes proposed new translations for the other languages.
**Priority:** P0

### 4.9 Editor

**FR-090:** A post is a free stack of layers. Layer types are background, image (including logos) and text. The user can add image and text layers freely.
**Priority:** P0

**FR-091:** Background and text are separate layers. Either can be regenerated or edited without changing the other.
**Priority:** P0

**FR-092:** Layer actions: move, resize, rotate, reorder, show or hide, lock, delete.
**Priority:** P0

**FR-093:** Text properties: font, size, weight, colour, alignment, line spacing.
**Priority:** P0

**FR-094:** Image properties: crop and opacity.
**Priority:** P0

**FR-095:** Undo and redo.
**Priority:** P0

**FR-096:** Snapping and alignment guides.
**Priority:** P0

**FR-097:** Keyboard shortcuts for undo, redo, delete, duplicate, nudge with arrow keys and zoom.
**Priority:** P0

**FR-098:** Text that does not fit its box is flagged on the variant. The app never resizes text silently.
**Priority:** P0

### 4.10 Localization

**FR-100:** Language is a dimension of variant. Each language variant is a version of the text layers over the same background unless overridden.
**Priority:** P0

**FR-101:** The app proposes translations with AI, using the region and audience as context. Every translation needs explicit approval from the user, whatever its source. Unapproved translations are visible as a status on the variant.
**Priority:** P0

**FR-102:** The user can edit any translation.
**Priority:** P0

**FR-103:** The user can export a simple sheet containing all localized copy for a campaign, so a colleague can verify it outside the app. Export only.
**Priority:** P0

**FR-104:** Only left-to-right languages are supported.
**Priority:** P0

### 4.11 Brand and Legal Checks

**FR-110:** Brand check: the campaign's required assets (for example a logo) are present and visible on each variant.
**Priority:** P0

**FR-111:** Brand check: the colour of every text layer comes from the campaign's palette.
**Priority:** P0

**FR-112:** Brand check: colours inside background images can be checked through an optional outside verification provider.
**Priority:** P2
**Notes:** Depends on the architect's assessment (OI-01).

**FR-113:** Legal check: prohibited words are absent from, and required words are present in, every text layer of every variant, in every language.
**Priority:** P0

**FR-114:** Checks run automatically before export. The user can also run them on demand.
**Priority:** P0

**FR-115:** A failed check warns the user. The user can proceed with the export. The failure and the decision to proceed are written to the report.
**Priority:** P0

### 4.12 Video and Animation

**FR-120:** Format (image or video) and duration are properties of a variant. Different video variants can have different durations. There is no maximum duration.
**Priority:** P0

**FR-121:** A video variant has a background track that holds one or more clips in a row. A clip is a still image, a generated video or a video file the user provides.
**Priority:** P0

**FR-122:** Each background clip can be moved, reordered and trimmed at either end. Time not covered by a clip shows black.
**Priority:** P0

**FR-123:** The app can generate a video from a variant's finished background image. Generation is for one variant at a time and is started by the user.
**Priority:** P0

**FR-124:** Video generation runs as a background job with a visible status. The user can keep working. If it fails, the variant keeps what it had and offers retry.
**Priority:** P0

**FR-125:** The app does not edit the content of generated video. A user who wants to edit a clip does so in another tool and imports the result.
**Priority:** P0

**FR-126:** The same text layers shown over the video in preview are burned in on export.
**Priority:** P0

**FR-127:** Video variants have a timeline with one track per layer. Each layer has a start and end time within the variant's duration. Layers other than the background have one item per track.
**Priority:** P0

**FR-128:** Text layers can have an entrance animation and an exit animation, each with a preset, a start time and a duration, shown as blocks on the track that can be moved and resized. Presets: fade, fade up, slide, stagger by word, none.
**Priority:** P0
**Notes:** Only text layers animate in this build.

**FR-129:** Animation is stored as data (preset, start, duration), not code, so the same preset works on a longer translated headline.
**Priority:** P0

**FR-130:** The timeline has a playhead with play, pause and scrub. The preview matches the export.
**Priority:** P0

**FR-131:** Exported animation is identical regardless of the speed of the machine.
**Priority:** P0

**FR-132:** Video exports at up to 60 frames per second. All video is silent.
**Priority:** P0

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

**FR-152:** An activity panel lists running and finished background jobs with status and retry.
**Priority:** P0

**FR-153:** The app keeps a local log of its activity. Nothing is sent anywhere. The log is structured so that opt-in telemetry could be added later.
**Priority:** P0

### 4.15 Cloud Publishing

**FR-160:** The user can connect cloud storage with their own credentials. At least one of Amazon S3, Azure and Dropbox must work in this build. The others sit behind the same boundary and can follow.
**Priority:** P0

**FR-161:** Publishing is a manual action per campaign. It is never automatic.
**Priority:** P0

**FR-162:** Publishing uploads the campaign's final exports, the components used in them (backgrounds, logos, subject images, and fonts where the licence allows), the translation sheet and the report. It does not upload every generation attempt or the editable project data.
**Priority:** P0
**Notes:** Generated components keep their embedded generation details (FR-068) when published.

**FR-163:** Published files are organized so a teammate without the app can browse them by campaign, post and ratio.
**Priority:** P0

**FR-164:** Each campaign publishes into its own folder, named by campaign ID. Publishing again replaces that campaign's earlier files after a warning. One campaign never overwrites another's files, including when several people publish to the same bucket.
**Priority:** P0

### 4.16 Settings and Keys

**FR-170:** Keys are entered inside the app. The user never edits a settings file.
**Priority:** P0

**FR-171:** The app asks for a key only when an action needs it. The app is usable for manual work with no keys.
**Priority:** P0

**FR-172:** A key is not tested when entered. It is first used when the user takes an action that needs it.
**Priority:** P0

**FR-173:** Keys are stored encrypted in the application data folder, outside any project. Viewing a saved key requires the computer's user password, admin password or biometric check.
**Priority:** P0

### 4.17 Repository

**FR-180:** The repository has a README covering how to run the app, example input and output, key design decisions, and assumptions or limitations.
**Priority:** P0
**Notes:** The example set is one brief with two subjects, exported in three ratios and two languages.

**FR-181:** No secret is ever committed. Generated files are not committed, except the small example set the README needs.
**Priority:** P0

### 4.18 External Agent Control (MCP Server)

**FR-190:** The app includes an MCP server that lets an external agent control the app.
**Priority:** P0
**Notes:** Main purpose: a user with an AI subscription or enterprise AI in another app can have that agent place copy, with no extra layout API charges. The third-party layout API remains available (FR-061).

**FR-191:** The server is off until the user turns it on in Settings. It accepts connections only from the same computer.
**Priority:** P0

**FR-192:** Through the server an agent can read the open project: campaigns, subjects, variants, layers and rule sets.
**Priority:** P0

**FR-193:** An agent can request a rendered picture of a variant, so it can judge where copy fits.
**Priority:** P0

**FR-194:** An agent can create and edit layers: place and style text, set copy, and supply translations.
**Priority:** P0

**FR-195:** An agent can create a campaign from a brief and add variants.
**Priority:** P0

**FR-196:** An agent can run the brand and legal checks and read the results.
**Priority:** P0

**FR-197:** An agent can delete campaigns and variants. Every destructive action by an agent needs the user's explicit permission in the app's UI before it happens. The user can set this permission to automatic.
**Priority:** P0
**Notes:** "Destructive" means deleting a campaign or a variant. Deleting or replacing a single layer is an ordinary edit, covered by undo. An agent cannot delete subjects or assets. The rule in FR-073 still applies: a master variant cannot be deleted on its own.

**FR-198:** An agent can never read or change saved keys.
**Priority:** P0

**FR-199:** An agent cannot start image or video generation, export to disk, or publish to cloud storage in this build. These are deferred. The design should allow them to be added later.
**Priority:** P0

**FR-200:** Agent edits follow the same rules as user edits:
- They appear in the app as they happen.
- They can be undone.
- They are marked as agent-made in the log.
- Translations from an agent need the user's approval (FR-101).
- Edits to a master mark linked variants out of date and nothing cascades until the user runs a sync review (FR-081).
**Priority:** P0

**FR-201:** An agent works only on projects that are open in the app.
**Priority:** P0

---

## 5. User Workflows

### 5.1 Create a campaign from a brief

**Actor:** Creative User
**Precondition:** A project is open.
**Steps:**
1. The user starts a new campaign and drops in a brief file, or chooses a blank form.
2. The app reads the brief. For markdown or plain text it extracts the fields with AI.
3. The app shows the filled-in form. The user corrects it, confirms or picks a subject ID for each subject, picks ratios and languages, and sets the rule set or copies it from another campaign.
4. The user picks a starter template. The app shows each slot as filled or empty.
5. For each empty image slot the user opens the generation panel and sets the number of options. A confirmation dialog shows the generation count and the provider, which the user can change. The user runs it and picks a result.
6. Text layout is proposed by the layout API, by an external agent (workflow 5.7) or placed by hand. The app creates editable text layers. The campaign message is placed word for word.
7. The user edits the master variant in the editor.

**Postcondition:** The campaign has one direction with an approved master variant.
**Alternate Paths / Exceptions:** No key saved: the app asks for one at the first AI action. Provider failure: plain-language message and retry. Subject ID already exists: the user reuses the existing subject or enters a different ID.

### 5.2 Fan out and localize

**Actor:** Creative User
**Precondition:** The master variant is approved.
**Steps:**
1. The user starts fan-out.
2. For each new ratio the app shows a dialog. The user chooses scale, crop or generate fill for the background.
3. The app creates a linked variant for each ratio, language and format. Language variants get AI-proposed translations.
4. The campaign view shows the direction's grid of variants with status badges.
5. The user opens flagged variants and fixes overflowing text or adjusts a background.
6. The user approves each translation, or exports the translation sheet for a colleague first.

**Postcondition:** Every variant exists and its translations are approved.
**Alternate Paths / Exceptions:** Translation fails: the variant shows the source copy and a retry action. Generate fill fails: the background stays scaled or cropped and retry is offered.

### 5.3 Sync a change

**Actor:** Creative User
**Precondition:** Variants are linked to a master variant.
**Steps:**
1. The user edits a layer in the master variant.
2. Linked variants are marked out of date.
3. The user starts a sync.
4. The review shows a preview per affected variant, with new translations where copy changed. Layers with overrides are flagged and skipped.
5. The user accepts all, or selects some and accepts those.
6. The user resolves flagged layers one by one and edits any outliers.

**Postcondition:** No variant is out of date, or the remaining ones are left that way on purpose.

### 5.4 Add a creative direction

**Actor:** Creative User
**Precondition:** A campaign has at least one master variant.
**Steps:**
1. The user duplicates a master variant.
2. The copy becomes the master of a new direction. The user names the direction and changes it, for example with a new background.
3. The user fans out the new direction (workflow 5.2).

**Postcondition:** The campaign view shows a grid for each direction.

### 5.5 Make a video variant

**Actor:** Creative User
**Precondition:** A variant exists with a finished background.
**Steps:**
1. The user sets the variant's format to video and sets a duration.
2. On the background track the user keeps the still image, imports video files, or starts video generation for this variant.
3. Generation runs in the background. The activity panel and the variant tile show its status.
4. The user arranges and trims the background clips. Uncovered time shows black.
5. The user sets when each layer appears and disappears, and adds entrance and exit presets to text layers.
6. The user plays the preview.

**Postcondition:** The variant previews as it will export.
**Alternate Paths / Exceptions:** Generation fails: the track keeps what it had and retry is offered.

### 5.6 Export and publish

**Actor:** Creative User
**Precondition:** At least one variant exists.
**Steps:**
1. The user chooses a variant, a selection or the whole campaign, and an output folder.
2. The app runs the brand and legal checks.
3. If any fail, the app lists the warnings. The user fixes them or proceeds.
4. The app writes the files into the organized folder layout and saves the report.
5. The user can then publish the campaign to cloud storage. If files for this campaign are already there, the app warns before replacing them.

**Postcondition:** Deliverables and report are on disk, and in cloud storage if published.

### 5.7 Place copy with an external agent

**Actor:** Creative User, External Agent
**Precondition:** The MCP server is turned on in Settings. The agent app is connected. A variant has a background.
**Steps:**
1. In the agent app, the user asks the agent to lay out the copy on one or more variants.
2. The agent reads the campaign and the variants, and requests a rendered picture of each.
3. The agent creates or moves text layers and sets their style and copy.
4. The changes appear in the app as they happen. The user watches, and can undo any of them.
5. If the agent supplies translations, they show as unapproved until the user approves them.
6. If the agent edited a master, linked variants are marked out of date and the user runs a sync review.

**Postcondition:** The variants have editable text layers placed by the agent, recorded as agent-made in the log.
**Alternate Paths / Exceptions:** The agent tries to delete a campaign or variant: the app asks the user for permission, unless the user has set this to automatic. The agent asks for an action it is not allowed: the server refuses and says why.

---

## 6. Data Requirements

### 6.1 Key Data Entities
The detailed data model is for the architect. The entities and relationships below are required.

- **Project:** A folder. Has many campaigns, many subjects and a pool of assets.
- **Subject:** Unique ID, display name, description, reference files. Belongs to a project. Used by many campaigns.
- **Asset:** A file in the project (image, video, font, text). Either imported or generated. May be attached to a subject. Generated assets carry provider, model and prompt in their file metadata.
- **Campaign:** Region, audience, message, languages, ratios and sizes, subjects, rule set, template. Belongs to a project. Has one or more directions.
- **Rule set:** Required assets, colour palette, required words, prohibited words. Belongs to a campaign. Can be copied from another campaign.
- **Template:** A list of image and copy slots. Shipped with the app.
- **Direction:** A named creative direction in a campaign. Has exactly one master variant and many linked variants.
- **Variant:** Unique short ID, title, ratio or size, language, format, duration, subjects, layers, status flags (out of date, overflow, translation unapproved, check warning, job running). Belongs to a direction.
- **Layer:** ID, type (background, image, text), geometry, style, content, visibility, lock, timing (start, end), optional entrance and exit animation (preset, start, duration), optional link to the matching layer in the master, and which inherited properties are overridden. Background layers keep their transform (scale, position, crop) without discarding pixels.
- **Background clip:** One item on a video variant's background track: source asset, position in time, trim at each end.
- **Job:** A background task (for example video generation) with status and result.
- **Report:** The result of one export.
- **Log entry:** One recorded action, including whether the user or an agent made it.

### 6.2 Data Volumes & Retention
- No limit on the number of subjects, campaigns or variants in version 1, and no performance target tied to size.
- Project data is kept until the user deletes the project folder. The app applies no retention rules.

### 6.3 Data Privacy & Compliance
- The app collects no personal data and sends no telemetry.
- Brief content, prompts and reference images are sent to the AI providers the user has configured, under the user's own accounts.
- When the MCP server is on, a connected agent can read the open project's content. That content then passes to whatever AI service runs the agent.
- Generated assets carry their prompt in file metadata. Anyone given such a file, including through cloud publishing, can read the prompt. Final exports do not carry it.
- Keys are stored encrypted on the user's machine, outside project folders, and are never committed to the repository or exposed to an agent.
- No compliance standard has been named.

### 6.4 Data Migration
None. This is a new app with no legacy system.

---

## 7. Integration Requirements

| System | Direction | Protocol / Format | Purpose | Owner |
|--------|-----------|-------------------|---------|-------|
| AI image provider | Outbound | Provider API | Generate, remix and extend images | User's account |
| AI vision provider | Outbound | Provider API | Propose text layout | User's account |
| AI text provider | Outbound | Provider API | Read free-text briefs, copy options, translation | User's account |
| AI image-to-video provider | Outbound | Provider API | Generate video from a background image | User's account |
| Cloud storage (S3, Azure, Dropbox) | Outbound | Provider API | Publish components and deliverables | User's account |
| Optional verification provider | Outbound | Provider API | Optional checks such as image colour | User's account |
| External agent app | Inbound | MCP | Read and edit the open project | User's own agent |

**IR-001:** Every AI job and the cloud storage connection sit behind a provider boundary. Swapping a provider must not change the rest of the app.

**IR-002:** Stakeholder preferences for the architect (not requirements):
- Gemini ("nanobanana") as the default for image generation and text layout, because one self-serve key covers both.
- A stubbed adapter for the Adobe Firefly API, plus a research task on integrating Adobe AI products without an enterprise account to test with.
- Seedance for image-to-video, to be tested through fal.ai, with a possible change of route.
- Jev (docs: https://docs.typesafe.ai/introduction) as the optional verification provider. The analyst has not read these docs (OI-01).
- Generation details embedded in files the way ComfyUI does it.

**IR-003:** The inbound agent connection uses MCP, as named by the stakeholder. It is limited to the same computer and to the actions in Section 4.18.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Slow generation (video) must not block the UI. It runs as a background job with a status indicator.
- Exported animation must be identical on fast and slow machines.
- The stakeholder has set no targets for load, response time or export time.

### 8.2 Availability & Reliability
- The app runs on the user's machine. Manual work (import, layout, export) must work with no keys and no AI provider.
- Changes save automatically. A crash loses at most the edit in progress.

### 8.3 Scalability
- No hard limit on subjects per brief, campaigns per project, variants per campaign or video duration.

### 8.4 Security
- **Authentication:** None in the app. Single user.
- **Authorization Model:** None for the user. The external agent is limited to a fixed set of actions, with user permission required for destructive ones.
- **Compliance Standards:** None named.
- **Data Encryption:** Keys encrypted at rest. Viewing a key requires the computer's password or biometric check.
- **Threat Model Notes:**
  - The repo is public, so no secret may be committed.
  - Project folders are shared between people, so they must never contain keys.
  - The MCP server is a way into the app. It is off by default, reachable only from the same computer, never exposes keys, cannot spend the user's money on generation, cannot export or publish, and asks before destroying anything.

### 8.5 Auditability & Logging
- An export report per export (FR-150, FR-151).
- Generated assets carry provider, model and prompt (FR-068).
- A local activity log that marks agent-made actions (FR-153, FR-200).

### 8.6 Accessibility
Reference standard: WCAG 2.1 AA for the app's controls.
- Every control can be reached and triggered by keyboard.
- Every control has a label a screen reader can read.
- Focus is always visible.
- Text meets standard contrast levels.
- The contents of the design canvas are best effort.

### 8.7 Maintainability & Operability
- Public repository with a README.
- Setup must be as short as possible. The user must not need the README or a settings file to get running.
- New versions are installed by manual download.

### 8.8 Platforms
- macOS and Windows.

### 8.9 Look and Feel
- Clean and light, aimed at a non-technical user.
- Light theme only in this build.
- The screen list below is a starting point. The stakeholder expects to adjust it during the build.
  - **Start screen:** create a project, open a project folder, recent projects.
  - **Project tabs:** each open project is a tab in the one window.
  - **Project home:** campaigns and subjects. New campaign from a brief file or a blank form.
  - **Campaign view:** one grid of variants per direction, grouped by ratio, language and format, with thumbnails and status badges. Rule set, sync and export actions.
  - **Editor:** canvas in the centre, layer list on one side, properties on the other, timeline along the bottom for video variants.
  - **Panels and dialogs:** brief confirmation, template slots, generation, run confirmation (generation count and provider), fan-out background fit, sync review, export, publish, report, agent permission request.
  - **Settings:** keys, default providers, cloud storage, default project location, MCP server on or off, automatic permission for agent actions.
  - **Activity panel:** background jobs with status and retry.

---

## 9. Constraints

### 9.1 Technical Constraints
Fixed by the brief or the stakeholder:
- Electron desktop app with a React UI layer.
- SQLite database.
- FFmpeg included in the app for exporting video.
- MCP as the protocol for external agent control.

Stakeholder preferences for the architect (not fixed):
- Text rendered with HTML canvas or SVG.
- FFmpeg for burning text into video on export.
- GSAP timelines rendered frame by frame in a headless browser for animated text.
- One storage interface (exists, read, write) with a local version and a cloud version.
- Predictable storage paths.

### 9.2 Organizational Constraints
- The repository is public.
- The user supplies their own keys for AI providers and cloud storage, and their own agent app for MCP.
- There is no enterprise Adobe account to test Firefly with.

### 9.3 Regulatory & Legal Constraints
- **Licence:** The code is public to read, but others must not be legally able to use it in their own commercial work. The brief calls the app "OSS"; this intent is narrower than open source as usually defined. The licence itself is not chosen (OI-02).
- The licence terms of the included video tool and other bundled parts must be compatible with the chosen licence (OI-02).
- Font licences may limit which fonts can be published to cloud storage (FR-162).

### 9.4 Timeline & Budget Constraints
None given. The stakeholder asked for this to be treated as a normal app build.

### 9.5 Changes to decisions in the original brief

| Original decision | Now |
|-------------------|-----|
| With cloud storage, assets survive reinstall by re-entering storage details | Dropped. The project folder on disk is the durable copy. Cloud is for sharing finished work. |
| The app finds existing assets from campaign and product IDs alone, with no hidden local index | Applies only to the published cloud layout, which must be browsable without the app. Locally, the project's data file is the index. |
| Source assets are shared across campaigns | True within a project. Not across projects. |
| "Products" | Renamed "Subjects". Still needs a unique ID. |
| Paths such as `outputs/{campaign-id}/{product-id}/{ratio}/post.png` | Export layout is by campaign, post title and ratio, with language and variant ID in the file name. The title defaults to the subject IDs. |
| A configurable local storage folder | Replaced by a default project location plus a location per project. |
| Changes sync across localizations | Sync is manual, reviewed per variant, and skips overrides. |
| A vision model proposes the text layout | Still available. An external agent through MCP, or the user by hand, can do it instead. |
| Video: static text overlay on one generated video | Extended with a timeline, a multi-clip background track, and entrance and exit text animations. |
| "This will be OSS" | Public code with no commercial reuse by others (see 9.3). |

---

## 10. Assumptions

### 10.1 Assumptions not discussed with the stakeholder

| # | Assumption | Impact if Wrong |
|---|------------|-----------------|
| A-01 | Each project folder contains its own SQLite data file | If one database serves all projects, projects stop being portable |
| A-02 | A project is opened by one person at a time | Shared network folders with two editors could corrupt data |
| A-03 | The user has internet access when using AI features and publishing | Offline behaviour for those features would need defining |
| A-04 | Users have their own accounts and billing with each AI provider | The app would need a way to supply or meter keys |
| A-05 | Analytics, approvals and posting to social platforms are handled by other tools | Scope would grow considerably |
| A-06 | A master variant is deleted only by deleting its whole direction | A rule for orphaned linked variants would be needed |
| A-07 | Video exports default to 30 frames per second and the user can raise it to 60 | Export settings UI would change |

### 10.2 Analyst proposals accepted without comment
The stakeholder was told these would be treated as confirmed unless corrected, and did not correct them.

| # | Accepted answer | Where used |
|---|-----------------|------------|
| C-01 | The brief's cut-off sentence ("If ") held nothing that changes requirements | IR-002 |
| C-02 | Firefly is listed but disabled until it works | FR-067 |
| C-03 | One cloud service must work first. The others follow. | FR-160 |
| C-04 | No share link after publishing | Scope |
| C-05 | Published contents as listed | FR-162 |
| C-06 | One cloud folder per campaign ID plus a warning before replacing | FR-164 |
| C-07 | Imported files are copied into the project and held in a pool, attachable to a subject | FR-052, FR-054 |
| C-08 | No other accepted file type. "Text content" means copy and brief files. | FR-051 |
| C-09 | Link properties are fixed defaults | FR-079 |
| C-10 | No user-made templates | FR-041 |
| C-11 | Briefs accept optional extra fields | FR-021 |
| C-12 | Translation only, with region and audience as context | FR-101 |
| C-13 | Checks can also be run on demand | FR-114 |
| C-14 | Failed video generation keeps the existing background and offers retry | FR-124 |
| C-15 | Default ratios and default language | FR-026 |
| C-16 | Report shown in the app and saved as a readable file and JSON | FR-151 |
| C-17 | Manual updates. README example set as described. | 8.7, FR-180 |
| C-18 | Supplying translations up front stays at P1 | FR-027 |
| C-19 | An agent works only on projects open in the app | FR-201 |
| C-20 | "Destructive" means deleting a campaign or variant. Layer deletion is an ordinary edit. An agent cannot delete subjects or assets. | FR-197 |
| C-21 | Generated components keep their embedded prompt when published to the cloud | FR-162 |

---

## 11. Open Items & Decisions Required

None of these blocks the start of architecture.

| # | Item | Owner | Due Date |
|---|------|-------|----------|
| OI-01 | Assess Jev (typesafe.ai) for image colour verification and decide whether FR-112 is built | Architect | During architecture |
| OI-02 | Choose a licence that makes the code public but bars commercial reuse by others, and confirm it is compatible with the bundled video tool and other dependencies | Stakeholder, with architect input | Before the repo is made public |
| OI-03 | Research how to integrate Adobe AI products without an enterprise account | Architect | During architecture |
| OI-04 | Confirm the image-to-video provider route after testing | Architect | During architecture |
| OI-05 | Choose how generation details are embedded for each file type (image and video), following the ComfyUI reference | Architect | During architecture |
| OI-06 | Decide whether an agent may later start generation, export or publish, and under what limits | Stakeholder | After this build |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Project | A folder on the user's computer holding campaigns, subjects and assets |
| Subject | What an ad is about: a product or a service. Has a unique ID. Called "product" in the brief. |
| Campaign | A set of posts for one region, built from one brief |
| Brief | The input describing a campaign: subjects, region, audience, message |
| Template | A list of expected image and copy slots, with no positions |
| Slot | One expected piece of content in a template |
| Direction | One creative approach within a campaign, with its own master variant |
| Variant | One post, defined by ratio, language and format. Has a unique short ID. |
| Master variant | The variant in a direction that all linked variants follow |
| Fan-out | Creating the grid of linked variants from a master variant |
| Link | A connection from a layer to the matching layer in the master, so it follows certain properties |
| Override | A linked layer's own value that replaces what it would inherit |
| Sync review | The step where the user previews and accepts pending changes on linked variants |
| Layer | One element of a post: background, image or text |
| Background clip | One still or video item on a video variant's background track |
| Rule set | A campaign's required assets, colour palette, required words and prohibited words |
| Publish | Upload a campaign's components and deliverables to cloud storage |
| Provider | An outside service that performs an AI job or stores files |
| MCP server | The part of the app that lets an outside AI agent read and edit the open project, using the Model Context Protocol |
| External agent | An AI assistant in another app that connects to the MCP server and acts for the user |
| Destructive action | An agent action that deletes a campaign or a variant |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-20 | Requirements Analyst | Work-in-progress draft with open questions and assumed answers |
| 0.2 | 2026-11-21 | Requirements Analyst | Open questions resolved. Added directions with one master each, variant short IDs, fan-out fit dialog, non-destructive background transforms, multi-clip background track, colour palette check, copyable rule sets, tabs, autosave, platforms, local log, licence intent. Priorities confirmed. |
| 0.3 | 2026-11-21 | Requirements Analyst | Added MCP server for external agent control (4.18, workflow 5.7). Starter template defined. No maximum video duration. Per-run provider choice. Generation details embedded in generated asset files. Custom ratios, copy generation, generation count, keyboard shortcuts and activity panel raised to P0. |
| 1.0 | 2026-11-21 | Requirements Analyst | Approved by the stakeholder. Agent export and publish confirmed as deferred. Agent assumptions and the published-prompt default moved to confirmed. |
