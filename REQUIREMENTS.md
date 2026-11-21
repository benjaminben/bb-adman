# REQUIREMENTS.md

**Project:** Adman
**Version:** 1.4
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** In Review. Version 1.0 was Approved. Each change in 1.1 was agreed by the stakeholder during architecture (Section 9.6). Version 1.2 applies the stakeholder's answers to the questions raised on 1.1 (Section 9.7). Version 1.3 applies the answers that arrived after 1.2 (Section 9.8). Version 1.4 applies the navigation model the stakeholder accepted in the prototype, the parallel-work principle and the window default (Section 9.9). The stakeholder has not yet reviewed the full wording of 1.1, 1.2, 1.3 and 1.4 (Section 11, Q-011).

**How to read this document**

- Priorities: P0 = must-have, P1 = should-have, P2 = nice-to-have. Every key feature in the original brief is P0 by instruction.
- Source brief: `ANALYST-PROMPT.md`. Where discovery changed a decision in that brief, Section 9.5 records the change. Follow this document where the two differ.
- Technical specification: `SPEC.md`. Version 1.1 of this document brings it in line with the requirement changes agreed during architecture (SPEC.md Section 0, items R-01 to R-19). Section 9.6 maps each change to the text it touched. A requirement changed in 1.1 carries a "Changed in 1.1" or "Added in 1.1" line. Where SPEC.md and this document still differ, SPEC.md wins.
- Version 1.2 applies the stakeholder's answers recorded in `DECISIONS.md` (D-010 to D-017). Section 9.7 maps each answer to the text it touched. A requirement changed in 1.2 carries a "Changed in 1.2" line.
- Version 1.3 applies the later answers in `DECISIONS.md` (D-013 as confirmed, D-020, D-022 to D-027). Section 9.8 maps each answer to the text it touched. A requirement changed in 1.3 carries a "Changed in 1.3" line.
- Version 1.4 applies D-028 (navigation and parallel work) and D-031 (window default) from `DECISIONS.md`. Section 9.9 maps each to the text it touched. A requirement changed in 1.4 carries a "Changed in 1.4" or "Added in 1.4" line. Exception to "SPEC.md wins": SPEC.md 1.7 was written before D-028 was applied, so for FR-003, Section 4.19, FR-152 and Section 8.9 this document is the newer source until SPEC.md is updated.
- Section 10.2 lists answers the analyst proposed and the stakeholder accepted without comment. They are treated as confirmed, but they are the first place to look if something seems wrong.
- Section 11 lists what is still open.

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
- A user can go from a brief file to a full exported set of posts (all chosen ratios and languages) without editing a settings file or reading the README. *(Changed in 1.2: D-015. Accepted exception: the user may need the README for the standard first-launch steps of an unsigned app (8.7).)*
- A change made to a master variant can be reviewed and applied to all linked variants in one review step.
- Text stays editable and translatable up to the moment of export. The image model never draws the text.
- Every export runs the campaign's brand and legal checks and produces a report.
- A project can be packaged into one folder with the "Package project" command (FR-008). The packaged folder can be copied to another machine and opened there with nothing missing. *(Changed in 1.1: R-09. Before, copying the project folder itself was enough.)*
- A user with their own AI subscription or enterprise AI can have an external agent place copy in the app without paying for a separate layout API.
- While a generation runs, the user can work on another variant or another campaign, and can find the finished result later without running it again (Section 4.19). *(Added in 1.4: D-028.)*
- The stakeholder has set no measurable targets (time per campaign, campaigns per month).

### 1.4 Scope

**In scope:**
- Projects stored as single files on the user's computer, each holding several campaigns and a shared set of subjects. Asset files are linked from where they are, or kept in an assets folder beside the project file.
- Packaging a project and its files into one folder so it can be moved to another machine.
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
- Working on several campaigns and several variants at the same time, including while a generation runs (Section 4.19). *(Added in 1.4: D-028.)*
- A public repository with a README.

**Out of scope for this build:**
- Login, roles and per-user access control. The app is single-user.
- Two people editing the same campaign. Sharing a project means packaging it (FR-008) and passing on the packaged folder.
- Sharing subjects or assets between separate projects, other than by import or copy.
- Automatic cloud sync or cloud backup of editable project data.
- Share links for published files.
- Posting to social platforms, ad spend and performance analytics.
- Approval workflows inside the app.
- User-made templates.
- Changing which properties a link follows.
- An external agent starting paid image or video generation, exporting to disk, or publishing to cloud. These are deferred and may be allowed later, so the design should not rule them out.
- An external agent reading or changing saved keys. This is never allowed.
- Viewing a saved provider or storage key in full (FR-173). The agent access token is not covered by this: the user can view it (FR-191).
- Editor features: shapes, text effects (shadow, outline, fill), grouping, safe-zone overlays, masks, blend modes, filters, freehand drawing, stock libraries, multi-page documents.
- Timeline features: custom keyframes, easing curves, animation of image layers, audio tracks, splitting a clip in two, transitions between clips, overlapping clips.
- Editing the content of generated video inside the app.
- Audio. All video is silent.
- Right-to-left languages.
- Importing a corrected translation sheet back into the app.
- Cultural adaptation of copy as a separate feature. Translation takes region and audience as context only.
- Dark theme.
- Sending telemetry. Automatic app updates.
- Signed installers (8.7).
- Azure as a working cloud storage service. It is listed but disabled (FR-160).

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
- **Key Workflows:** Create or open a project, start a campaign from a brief, fill template slots, edit the master variant, fan out, review sync, approve translations, export, publish. The user often has several campaigns and variants in hand at once, and switches project less often (FR-210). *(Changed in 1.4: D-028. Last sentence added.)*

### 3.2 External Agent
- **Description:** An AI agent running in another app on the same computer, connected through the MCP server. It acts for the Creative User, who gives it instructions in that other app.
- **Permissions:** Limited to the actions in Section 4.18. Destructive actions need the user's permission in the app's UI. It can never see keys.
- **Key Workflows:** Look at a variant, place and style copy, write copy and translations, set up campaigns and variants, change a variant's format, run checks. *(Changed in 1.3: D-025. Format change added.)*

---

## 4. Functional Requirements

### 4.1 Projects

**FR-001:** A project is a single file on the user's computer, with the app's own file extension (`.adman`). The file holds all of the project's data. It does not hold asset files. It links to them, and they stay where they are on the user's machine unless the user chooses otherwise (FR-007, FR-052).
**Priority:** P0
**Notes:** A project moves to another machine through "Package project" (FR-008), not by copying the project file alone. Keys are never stored in the project file or in its assets folder.
**Changed in 1.1:** R-06, R-07. Before, a project was a folder that held its data file, imported assets and generated files.

**FR-002:** The app has no global history of the user's work. The user creates a project, opens a project file, or picks from a recent-projects list.
**Priority:** P0
**Notes:** Opening a project file from the operating system (for example by double-click) opens it in the app.
**Changed in 1.1:** R-06. "Project folder" became "project file".

**FR-003:** The user can switch from one project to another inside the running app, without quitting and starting it again. From inside a project the user can go to a recent project, open a project file, create a project, and close the current project. Projects are not shown as tabs. The main tabs are the project's open campaigns (FR-211).
**Priority:** P0
**Notes:**
- The stakeholder's words: "we don't expect the user to be switching between projects as often, so while we want to preserve that ability from within one instance of the app, the main tabs should be open campaigns".
- Switching project is the less common action. It can take more steps than switching campaign or variant, but it must stay possible from wherever the user is in a project.
- Not decided: whether one window shows one project at a time, or two projects can be seen side by side (Q-038). This requirement does not say how many projects can be open at once. Before 1.4 it said several could be.
- Not decided: what happens to a running generation when the user switches or closes the project (Q-039).
**Changed in 1.4:** D-028. Before: "Several projects can be open at the same time, as tabs in one window."

**FR-004:** New projects are created in a default location inside the user's own documents area. The user can change the default and can choose a location per project.
**Priority:** P0

**FR-005:** A project holds any number of campaigns and one shared set of subjects.
**Priority:** P0

**FR-006:** The project saves automatically after every change. There is no save button. Undo history is cleared when the project closes.
**Priority:** P0

**FR-007:** Each project has an assets folder. By default it sits beside the project file and is named after it. The app saves generated files there, and imported files the user chose to copy (FR-052). The user can change the assets folder location per project.
**Priority:** P0
**Added in 1.1:** R-07, R-08.

**FR-008:** A "Package project" command gathers everything related to the project into one folder the user chooses: the project file and every asset file the project has a record of. That covers every linked file, and every generated file and copied import in its assets folder, including generated options that no variant uses. The packaged folder opens on another machine with nothing missing. The original project is left as it is.
**Priority:** P0
**Notes:**
- This is how a project is moved to another machine or handed to another person. Keys are not part of a project and are never packaged (FR-001, FR-173).
- A file that sits in the assets folder but that the project has no record of is not part of the project and is not packaged.
- When a linked file is missing (FR-009), the app refuses to package the project unless the user confirms that the missing files are to be skipped. Skipped files are not in the packaged folder, so "nothing missing" does not cover them.
**Added in 1.1:** R-09.
**Changed in 1.2:** D-011. Wording now states that a packaged project includes everything related to the project.
**Changed in 1.3:** D-022, D-027. "Every file in its assets folder" became "every asset file the project has a record of". Unused generated options are included. Files the project has no record of are left out. Packaging with a missing linked file needs the user's confirmation.

**FR-009:** When a linked file cannot be found, the app marks the asset as missing, shows this on every variant that uses it, and lets the user point the app to the file's new location. A variant with a missing file is not exported. It is listed as a failure in the report (FR-150).
**Priority:** P0
**Notes:** A linked file changed outside the app shows its new content in the project. This requirement follows from linking files instead of copying them (FR-001, FR-052). Packaging a project that has a missing file is covered in FR-008.
**Added in 1.1:** R-06.
**Changed in 1.3:** D-027 (notes only, pointer to FR-008).

### 4.2 Subjects

**FR-010:** A subject is the thing an ad is about. It can be a physical product or a service. The UI term is "Subject". The brief's term "product" maps to it.
**Priority:** P0

**FR-011:** Each subject has a unique ID within the project (for example a SKU), a display name, a description and attached reference files.
**Priority:** P0
**Notes:** Two different subjects must never share stored assets. The ID, not the display name, identifies the subject. Files attached to a subject can be in either library (FR-054).

**FR-012:** Subjects are shared by all campaigns in the project. They are not shared between projects except by import or copy.
**Priority:** P0

### 4.3 Brief Intake

**FR-020:** The app accepts a campaign brief as a JSON file, a YAML file, a markdown file or a plain text file. The user can also fill in a form with no file.
**Priority:** P0

**FR-021:** A brief contains: one or more subjects, target region or market, target audience and campaign message. The app must handle a brief with two or more subjects, with no hard upper limit. A brief with a single subject is also valid.
**Priority:** P0
**Notes:** Optional extra fields are accepted: offer, call-to-action, tone, required words, prohibited words, and copy per language. Required and prohibited words can be given per language. A list given with no language belongs to the campaign's main language (FR-033).
**Changed in 1.1:** R-03 (notes only).
**Changed in 1.3:** D-024. Before, the text said "at least two must be supported", which could be read as a minimum of two subjects per brief.

**FR-022:** For markdown and plain text briefs, the app uses AI to extract the fields.
**Priority:** P0
**Notes:** This applies to brief files the user gives the app. The app makes no extraction call for a brief sent by an external agent, which arrives as structured fields (FR-195).
**Changed in 1.1:** R-01 (notes only).

**FR-023:** For every brief, the app shows a filled-in form that the user must confirm before any generation happens.
**Priority:** P0
**Notes:** Exception: a campaign created by an external agent is created with no confirm form (FR-195). An agent cannot start generation (FR-199), so generation still starts only when the user asks for it.
**Changed in 1.1:** R-01 (notes only).

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

**FR-033:** A campaign has a rule set: required assets (for example a logo file), a brand colour palette, required words and prohibited words. The required and prohibited word lists are held per language.
**Priority:** P0
**Notes:** Used by the checks in 4.11. A word list given with no language belongs to the campaign's main language.
**Changed in 1.1:** R-03. Before, each word list was one list for the whole campaign.

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

**FR-052:** By default, importing links each file where it is. The file is not copied or moved. The import dialog offers "copy into the assets folder" as a choice, which saves a copy in the project's assets folder (FR-007) instead.
**Priority:** P0
**Changed in 1.1:** R-08. Before, imported files were always copied into the project folder.

**FR-053:** Imported assets remain available between sessions and are reused when available instead of generating new ones.
**Priority:** P0
**Notes:** A linked file that has been moved or deleted is handled as in FR-009.
**Changed in 1.1:** R-06 (notes only).

**FR-054:** A project has two libraries. The reference library holds files used only as input to image generation. The asset library holds files that can go on a post. On import the user chooses the library. The user can attach a file to a subject on import or later, so the app can offer it when that subject is used.
**Priority:** P0
**Notes:** A hero image is an asset-library image attached to a subject.
**Changed in 1.1:** R-12. Before, imported files went into one project pool.

**FR-055:** For each subject the app handles three cases:
- The subject has a hero image (an asset-library image attached to it). The image is used as-is.
- The subject has only reference-library files (for example a product shot). They are sent to the image model to build a new scene.
- The subject has no files. An image is generated from the subject description and campaign message.
**Priority:** P0
**Changed in 1.1:** R-12. The three cases are now told apart by library.

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
**Notes:** The user does not have to pick at the moment the run finishes. The options stay available and can be reopened later (FR-216).
**Changed in 1.4:** D-028 (notes only).

**FR-064:** Before a run starts, a confirmation dialog shows how many generations it will use.
**Priority:** P0

**FR-065:** All image and video generation is started by the user in the app, for one variant at a time. The master variant is built first.
**Priority:** P0
**Notes:** "One variant at a time" means each run is for one variant. It does not mean only one run can be in progress. The user can start a run for another variant while an earlier run is still going (FR-215).
**Changed in 1.4:** D-028 (notes only).

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
**Notes:** Image and video variants in a direction share the one master. Format is a choice made at fan-out. A variant's format can also be changed later, from image to video or from video to image (FR-120). A variant that differs from the master in both size and language gets its text position and size by a one-time copy (FR-079).
**Changed in 1.1:** R-05 (confirmed), R-02 (notes only).
**Changed in 1.2:** D-012 (notes only).
**Changed in 1.3:** D-020 (notes only). The later change of format now goes both ways.

**FR-076:** During fan-out the app shows a dialog for each new ratio where the user chooses how the background fits: scale, crop, or generate fill to extend the image.
**Priority:** P0
**Notes:** Generate fill is the only image generation in fan-out and happens only when the user chooses it. Translations are the other AI calls in fan-out.

**FR-077:** Background transforms (scale, position, crop) are stored and stay editable later. Cropping never discards pixels.
**Priority:** P0

**FR-078:** A layer in a variant can be linked to the layer with the matching ID in its master. Links are one level deep. Chains are not allowed.
**Priority:** P0
**Notes:** The one-time copy of text position and size at fan-out (FR-079) is not a link and does not create a chain. Every link still points to the master.
**Changed in 1.1:** R-02 (notes only).

**FR-079:** Links follow properties, not whole layers. Across pixel sizes, copy and style follow and position and size do not. Across languages, position and style follow and copy is a translation of the source. Timing and animation always follow the master, whatever the variant's format. These defaults are fixed in this build.
**Priority:** P0
**Notes:**
- Timing and animation are stored on every layer, in image variants as well as video variants. An image variant keeps the values and does not use them. This lets image and video variants share one master (FR-075).
- The background clips of a video variant (FR-121) belong to that variant. They are not linked and do not sync.
- A variant that differs from the master in both size and language has no layer to follow for text position and size. At fan-out it copies them once from the variant with the same size in the master's language. This is a one-time copy, not a link. Later changes to that variant do not carry over.
- Position and size follow the master only in a variant that has the same pixel size (width and height) as the master. Having the same ratio at a different pixel size is not enough. The stakeholder confirmed this ("Correct").
**Changed in 1.1:** R-02, R-05.
**Changed in 1.2:** D-013 (notes only, reading not yet confirmed).
**Changed in 1.3:** D-013, now confirmed. The "not yet confirmed" mark is removed from the note. The requirement text said "across ratios" and now says "across pixel sizes" to match the note.

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

**FR-095:** Undo and redo. There is one undo list per variant and one undo list per campaign.
**Priority:** P0
**Notes:** Edits inside a variant go on that variant's list. Actions at campaign level, such as fan-out, a sync and deleting a variant, go on the campaign's list. Deleting a variant can be undone from the campaign's list. All lists are cleared when the project closes (FR-006).
**Changed in 1.1:** R-17.

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
**Notes:** A required asset is "present and visible" on a variant when all of these are true:
- A layer in the variant uses the asset.
- The layer is not hidden.
- The layer's opacity is above zero.
- Part of the layer is inside the canvas.
- For a video variant, the layer is on screen for part of the duration.

The check does not test whether another layer covers the asset.
**Changed in 1.1:** R-13 (definition added).

**FR-111:** Brand check: the colour of every text layer comes from the campaign's palette.
**Priority:** P0

**FR-112:** Brand check: colours inside background images can be checked through an optional outside verification provider.
**Priority:** P2
**Notes:** Not built in this build. Whether it is built later depends on an assessment of the verification provider, which is due after this build (OI-01).
**Changed in 1.3:** Notes only (SPEC.md OI-19). Before, the note read as if the assessment were still due in this build.

**FR-113:** Legal check, run for each variant against the word lists for that variant's language (FR-033):
- Prohibited words: no prohibited word appears in any text layer of the variant.
- Required words: every required word appears somewhere in the variant's text layers taken together. One text layer does not have to hold them all.
**Priority:** P0
**Notes:** The check covers every variant in every language. A language with no word list has nothing to check.
**Changed in 1.1:** R-03. Before, required words had to be present in every text layer, and the lists were not per language.

**FR-114:** Checks run automatically before export. The user can also run them on demand. This covers the brand and legal checks (FR-110 to FR-113) and the readiness checks (FR-116).
**Priority:** P0
**Changed in 1.1:** R-18.

**FR-115:** A failed check warns the user. The user can proceed with the export. The failure and the decision to proceed are written to the report. This applies to readiness checks (FR-116) in the same way as to brand and legal checks.
**Priority:** P0
**Changed in 1.1:** R-18.

**FR-116:** Readiness checks: before export the app also warns about variants that have an unapproved translation (FR-101) and variants that have text that does not fit its box (FR-098).
**Priority:** P0
**Notes:** These are warnings, handled as in FR-115. They do not replace the status shown on the variant.
**Added in 1.1:** R-18.

### 4.12 Video and Animation

**FR-120:** Format (image or video) and duration are properties of a variant. Different video variants can have different durations. There is no maximum duration. The user can change a variant's format after it is created, in either direction: from image to video and from video to image. A format change loses nothing that applied to the variant as a video. When a video variant is changed to an image and later changed back to a video, every setting it had as a video is as it was before.
**Priority:** P0
**Notes:**
- The stakeholder's words on image to video: "an image variant can be 'upgraded' to a video variant". On the way back: "Sure video can be moved back to image".
- The stakeholder's words on what is kept: "any settings which applied to video format should be preserved if switched to image and then back to video". This covers everything that belongs to the variant as a video, for example its duration and its background clips (FR-121). Timing and animation are already kept on the layers of image variants (FR-079). How the settings are kept is for the spec.
- An external agent can also change a variant's format (FR-195).
**Changed in 1.2:** D-012. The change from image to video is now stated.
**Changed in 1.3:** D-020, D-026. Format can be changed both ways. Video settings survive a change to image and back.

**FR-121:** A video variant has a background track that holds one or more clips in a row. A clip is a still image, a generated video or a video file the user provides.
**Priority:** P0

**FR-122:** Each background clip can be moved, reordered and trimmed at either end. Time not covered by a clip shows black.
**Priority:** P0

**FR-123:** The app can generate a video from a variant's finished background image. Generation is for one variant at a time and is started by the user.
**Priority:** P0

**FR-124:** Video generation runs as a background job with a visible status. The user can keep working. If it fails, the variant keeps what it had and offers retry.
**Priority:** P0
**Notes:** The rules in Section 4.19 for a generation that runs while the user works elsewhere (FR-215 to FR-218) apply to video generation.
**Changed in 1.4:** D-028 (notes only).

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

### 4.16 Settings and Keys

**FR-170:** Keys are entered inside the app. The user never edits a settings file.
**Priority:** P0

**FR-171:** The app asks for a key only when an action needs it. The app is usable for manual work with no keys.
**Priority:** P0

**FR-172:** A key is not tested when entered. It is first used when the user takes an action that needs it.
**Priority:** P0

**FR-173:** Keys are stored encrypted in the application data folder, outside any project. A saved AI provider key or cloud storage key can never be viewed. The app shows only its last four characters. The user can replace or delete a key.
**Priority:** P0
**Notes:** Exception: the agent access token (FR-191). It is for use on the local computer and is treated differently from provider and storage keys. The user can view it in full and copy it in the app.
**Changed in 1.1:** R-10. Before, a saved key could be viewed after the computer's user password, admin password or biometric check.
**Changed in 1.2:** D-014. The agent access token is an exception to "can never be viewed".

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

**FR-191:** The server is off until the user turns it on in Settings. It accepts connections only from the same computer, and only from a client that presents the app's access token.
**Priority:** P0
**Notes:** The user can view the token in full and copy it in the app, and gives it to their agent app. The token is not covered by the rule that a saved key can never be viewed (FR-173). The user can replace the token with a new one, which stops clients that hold the old one.
**Changed in 1.1:** R-04. The token is new.
**Changed in 1.2:** D-014 (notes only). The user can view and copy the token.

**FR-192:** Through the server an agent can read the open project: campaigns, subjects, variants, layers and rule sets. It can also list the project's assets and fonts by name and ID, without file contents.
**Priority:** P0
**Changed in 1.1:** R-11. The asset and font list is new.

**FR-193:** An agent can request a rendered picture of a variant, so it can judge where copy fits.
**Priority:** P0

**FR-194:** An agent can create and edit layers: place and style text, set copy, and supply translations.
**Priority:** P0

**FR-195:** An agent can create a campaign from a brief and add variants. The agent sends the brief as structured fields. For an agent the app makes no AI extraction call (FR-022) and shows no confirm form (FR-023). The campaign appears in the app at once. Creating a campaign is not an action that undo reverses. An agent can delete a campaign, with the user's permission as for any agent delete (FR-197). An agent can change a variant's format, from image to video or from video to image (FR-120).
**Priority:** P0
**Notes:**
- The agent's request carries the choices a user would make on the confirm form, such as which subject each brief subject maps to (FR-024) and the ratios and languages (FR-026).
- The stakeholder's words on removing a campaign the agent made: "the agent can delete a campaign they create, this isn't the same as Undo". Deleting a campaign is a destructive action and needs the user's permission as in FR-197. This holds for every campaign, whoever created it. There is no exemption for a campaign the agent created itself. The stakeholder's words: "Ok let's just request permission for any campaign delete".
- A format change by an agent follows the same rules as any agent edit (FR-200), and the rule in FR-120 that video settings are kept applies. It is not a destructive action (FR-197) and does not need the user's permission. The stakeholder's words: "Yes agent can change format".
**Changed in 1.1:** R-01.
**Changed in 1.2:** D-010. "Can be undone" was wrong and is replaced by "an agent can delete a campaign it created".
**Changed in 1.3:** D-023, D-025. The delete sentence no longer singles out campaigns the agent created, and the note states that permission is needed for every campaign delete. An agent can change a variant's format.

**FR-196:** An agent can run the checks and read the results. This covers the brand and legal checks (FR-110 to FR-113) and the readiness checks (FR-116), as in FR-114.
**Priority:** P0
**Changed in 1.3:** Wording only (SPEC.md OI-19). Before, the text named only the brand and legal checks.

**FR-197:** An agent can delete campaigns and variants. Every destructive action by an agent needs the user's explicit permission in the app's UI before it happens. The user can set this permission to automatic.
**Priority:** P0
**Notes:** "Destructive" means deleting a campaign or a variant. Deleting or replacing a single layer is an ordinary edit, covered by undo. An agent cannot delete subjects or assets. The rule in FR-073 still applies: a master variant cannot be deleted on its own.

**FR-198:** An agent can never read or change saved keys.
**Priority:** P0

**FR-199:** An agent cannot start image or video generation, export to disk, or publish to cloud storage in this build. These are deferred. The design should allow them to be added later.
**Priority:** P0

**FR-200:** Agent edits follow the same rules as user edits:
- They appear in the app as they happen.
- They can be undone. Creating a campaign is not covered by undo (FR-195).
- They are marked as agent-made in the log.
- Translations from an agent need the user's approval (FR-101).
- Edits to a master mark linked variants out of date and nothing cascades until the user runs a sync review (FR-081).
**Priority:** P0
**Changed in 1.2:** D-010 (pointer to FR-195 added).

**FR-201:** An agent works only on projects that are open in the app.
**Priority:** P0
**Notes:** An agent's reach does not depend on which campaign or variant has a tab open or is on screen (Section 4.19). How many projects can be open at once is not decided (FR-003, Q-038).
**Changed in 1.4:** D-028 (notes only).

### 4.19 Navigation and Parallel Work

This section is new in 1.4. It states what the user must be able to do. The clickable prototype (round 2, `design/prototype/`) shows one way of doing it, and the stakeholder accepted its navigation layout ("Navigation layout feels MUCH better"). Fonts, colours and other visual choices are not requirements here.

**FR-210:** The app is built around parallel work. The user can have several campaigns and several variants in hand at the same time, can move between them quickly, and finds each one as they left it. Waiting for a generation never stops the user from working on something else.
**Priority:** P0
**Notes:**
- The stakeholder's words: "The user will want to be working on multiple campaigns and variants at the same time, especially while waiting for generation to complete, so the design principle should revolve around letting work happen in parallel. Things should be easy to navigate around."
- This is the principle. FR-211 to FR-218 and FR-152 are the testable parts of it. Where a later design question is not covered by them, this principle decides it.
**Added in 1.4:** D-028.

**FR-211:** Open campaigns are the main tabs of the app. The user can have several campaigns of the project open at once, each in its own tab, and can go from one to another in one action. The user can open another campaign or start a new one from the tabs, and can close a tab.
**Priority:** P0
**Notes:**
- The stakeholder's words: "the main tabs should be open campaigns".
- Closing a campaign tab only removes the tab. The campaign and its variants are not changed or deleted.
- Things that belong to the whole project (the campaign list, subjects, both libraries, "Package project") stay reachable while campaign tabs are open (FR-003).
**Added in 1.4:** D-028. Prototype gap G-11.

**FR-212:** Inside a campaign there are variant tabs. The campaign's overview (the grids of all its variants, FR-074) is always there, and each variant the user opens gets its own tab beside it. Several variants can be open at once, and the user can go from one to another, or back to the overview, in one action. The user can close a variant tab.
**Priority:** P0
**Notes:**
- The stakeholder's words: "there should be variant tabs within the campaign view".
- The user opens a variant from the overview. Whether a plain click on a variant's tile goes to the variant or opens it in a tab behind the overview is not decided (Q-041). The prototype goes to the variant.
- Closing a variant tab only removes the tab. The variant is not changed or deleted, and its undo list is kept as FR-095 says.
**Added in 1.4:** D-028. Prototype gap G-12.

**FR-213:** Every tab keeps its place while the project stays open. When the user comes back to a campaign, it has the same variant tabs open as when they left it, and shows the same one. When the user comes back to a variant, it is as they left it, including which layer was selected.
**Priority:** P0
**Notes:**
- The selected layer is the minimum. What else a variant tab keeps (for example zoom or the playhead position) is for the design and the spec, guided by FR-210.
- Not decided: whether open campaign tabs and variant tabs are remembered the next time the project is opened (Q-040). This requirement covers only the time the project stays open.
**Added in 1.4:** D-028. Prototype gap G-12.

**FR-214:** From the overview the user can open a variant in a tab without leaving the overview, so that several variants can be opened one after another.
**Priority:** P1
**Notes:**
- The prototype has this as a separate control on the tile. Which of the two ways of opening a plain click does is not decided (Q-041). Both ways are available whichever is chosen.
- P1 is the analyst's proposal. The stakeholder accepted the layout that includes this control but has not spoken about it. To be confirmed with Q-041.
**Added in 1.4:** D-028. Prototype gap G-13.

**FR-215:** A generation the user has started keeps running when the user closes its dialog or panel, goes to another variant or campaign, closes the tab of its variant or campaign, or opens Settings. While it runs the user can do any other work in the project, including starting another generation for a different variant.
**Priority:** P0
**Notes:**
- This applies to image generation (FR-060 to FR-065) and to video generation (FR-123, FR-124). FR-124 already said it for video.
- Other AI work that makes the user wait (generate fill, layout proposals, copy options, translations) must never stop the user from working elsewhere in the project (FR-210, 8.1). Whether each of them also survives the closing of its own dialog is for the spec.
- How many generations run at the same moment, and whether later ones wait in a queue, is for the spec. The user must be able to start them without waiting for an earlier one.
- Not decided: what happens to a running generation when the user switches to another project or closes the project (Q-039). This requirement covers work inside the open project.
- Two parts of this are the analyst's reading of the principle, not the stakeholder's words: that closing a tab does not stop a generation, and that a second generation can be started while one runs (Section 10.1, A-08).
**Added in 1.4:** D-028. Prototype gap G-15.

**FR-216:** The result of a finished generation is kept until the user has dealt with it. The user can reopen it later and gets the same options the run produced, to pick one or run again (FR-063). Reopening never runs the generation again and never uses another generation.
**Priority:** P0
**Notes:**
- The user can get to the result from the activity panel (FR-152) and from the variant and layer it belongs to.
- Options the user did not pick stay in the project's record of assets, as FR-008 already assumes ("generated options that no variant uses").
- Whether a result that was never looked at is still there after the project is closed and opened again follows the answer to Q-039.
**Added in 1.4:** D-028. Prototype gap G-15.

**FR-217:** For every running or finished generation the user can tell which campaign and which variant it belongs to, and which layer when it is for one layer. From a running or finished generation the user can go to that place in one action.
**Priority:** P0
**Notes:** This holds wherever a generation is shown: in the activity panel (FR-152) and in any message the app shows when a generation finishes.
**Added in 1.4:** D-028. Prototype gap G-14.

**FR-218:** The user can tell a generation that is still running from one that has finished, and can tell a finished result they have not looked at yet from one they have. Without opening the activity panel, and from wherever they are in the project, the user can see that a campaign or a variant has a generation running or a finished result not yet looked at. The "not yet looked at" mark goes away when the user looks at the result.
**Priority:** P0
**Notes:**
- In the accepted layout the marks sit on the campaign tab and the variant tab the generation belongs to, and in the activity panel.
- How the user is told at the moment a generation finishes (the prototype shows a short message with a "Show result" button) is for the design. The lasting mark is the requirement.
- What counts as "looked at" is for the spec. The intent: the user has seen the result itself, not just the list entry.
- A failed generation is shown as in FR-069 and listed with retry (FR-152).
- Not decided: whether tabs also signal other states, such as "out of date" or a check warning (Q-042). Only running and finished-not-looked-at are required.
**Added in 1.4:** D-028. Prototype gap G-14.

### 4.20 App Window

**FR-220:** When the app starts, its window opens maximized: it fills the usable area of the screen. It does not open in full-screen mode.
**Priority:** P0
**Notes:**
- The stakeholder's words: "the app should default to open with the window maximized (not literally fullscreen)".
- The user can still make the window smaller, or put it in full-screen mode themselves, after it opens.
- Not decided: whether the window opens maximized on every launch, or only the first time and after that at the size the user last left it (Q-036, SPEC.md OI-26). Until that is answered the architect's default applies: maximized on every launch, with nothing remembered.
**Added in 1.4:** D-031.

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
**Alternate Paths / Exceptions:** No key saved: the app asks for one at the first AI action. Provider failure: plain-language message and retry. Subject ID already exists: the user reuses the existing subject or enters a different ID. The user does not wait for a generation in step 5: they close the panel, work elsewhere and pick the result later (workflow 5.8). *(Changed in 1.4: D-028. Last path added.)*

### 5.2 Fan out and localize

**Actor:** Creative User
**Precondition:** The master variant is approved.
**Steps:**
1. The user starts fan-out.
2. For each new ratio the app shows a dialog. The user chooses scale, crop or generate fill for the background.
3. The app creates a linked variant for each ratio, language and format. Language variants get AI-proposed translations. A variant that differs from the master in both size and language takes its text position and size once from the variant with the same size in the master's language (FR-079).
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
3. Generation runs in the background. The activity panel, the variant tile and the tabs of the variant and its campaign show its status (FR-218). *(Changed in 1.4: D-028. Tabs added.)*
4. The user arranges and trims the background clips. Uncovered time shows black.
5. The user sets when each layer appears and disappears, and adds entrance and exit presets to text layers.
6. The user plays the preview.

**Postcondition:** The variant previews as it will export.
**Alternate Paths / Exceptions:** Generation fails: the track keeps what it had and retry is offered. The user sets the format back to image: the variant becomes an image variant, and its video settings are kept for a later change back to video (FR-120). *(Changed in 1.3: D-020, D-026. The path back to image is added.)*

### 5.6 Export and publish

**Actor:** Creative User
**Precondition:** At least one variant exists.
**Steps:**
1. The user chooses a variant, a selection or the whole campaign, and an output folder.
2. The app runs the brand and legal checks and the readiness checks (unapproved translations, overflowing text).
3. If any fail, the app lists the warnings. The user fixes them or proceeds.
4. The app writes the files into the organized folder layout and saves the report.
5. The user can then publish the campaign to cloud storage. If files for this campaign are already there, the app warns before replacing them.

**Postcondition:** Deliverables and report are on disk, and in cloud storage if published.

### 5.7 Place copy with an external agent

**Actor:** Creative User, External Agent
**Precondition:** The MCP server is turned on in Settings. The agent app is connected with the access token (FR-191). A variant has a background.
**Steps:**
1. In the agent app, the user asks the agent to lay out the copy on one or more variants.
2. The agent reads the campaign and the variants, and requests a rendered picture of each.
3. The agent creates or moves text layers and sets their style and copy.
4. The changes appear in the app as they happen. The user watches, and can undo any of them.
5. If the agent supplies translations, they show as unapproved until the user approves them.
6. If the agent edited a master, linked variants are marked out of date and the user runs a sync review.

**Postcondition:** The variants have editable text layers placed by the agent, recorded as agent-made in the log.
**Alternate Paths / Exceptions:** The agent tries to delete a campaign or variant: the app asks the user for permission, unless the user has set this to automatic. This includes a campaign the agent created itself (FR-195, FR-197). The agent asks for an action it is not allowed: the server refuses and says why. The agent creates a campaign: it appears in the app at once with no confirm form. Undo does not remove it. *(Changed in 1.3: D-023. Wording now states that a campaign the agent created is deleted under the same permission rule as any other.)*

### 5.8 Keep working while a generation runs

*(Added in 1.4: D-028.)*

**Actor:** Creative User
**Precondition:** A project is open with at least two campaigns. A variant is open in a tab.
**Steps:**
1. In the variant, the user starts an image generation for one layer and confirms the run (FR-062 to FR-064).
2. The user closes the generation dialog. The run continues (FR-215).
3. The user opens another variant, or another campaign in its own tab, and works there. They can start another generation there.
4. The first run finishes. The tabs of its campaign and its variant show that a result is waiting (FR-218). The activity panel lists it with its campaign, variant and layer (FR-152, FR-217).
5. The user goes to the result from the tab or from the activity panel. The app shows the options the run produced, with no new run (FR-216). The user picks one or runs again (FR-063). The "not yet looked at" mark goes away.
6. The user goes back to the other tab and finds it as they left it (FR-213).

**Postcondition:** The layer has the picked image. No work in the other tabs was interrupted or lost.
**Alternate Paths / Exceptions:** The run fails: the activity panel shows a plain-language reason and a retry action (FR-069, FR-152), and the layer keeps what it had. The user switches or closes the project while the run is going: not decided (Q-039).

---

## 6. Data Requirements

### 6.1 Key Data Entities
The detailed data model is for the architect. The entities and relationships below are required.

- **Project:** A single file with the app's own extension. Has many campaigns, many subjects, two libraries of assets (reference library and asset library) and one assets folder, by default beside the project file.
- **Subject:** Unique ID, display name, description, reference files. Belongs to a project. Used by many campaigns.
- **Asset:** A file the project uses (image, video, font, text). Either imported or generated. Either linked where it is on the user's machine or saved in the project's assets folder. Belongs to one library: reference or asset. May be attached to a subject. Can be marked missing when a linked file cannot be found. Generated assets carry provider, model and prompt in their file metadata.
- **Campaign:** Region, audience, message, languages, ratios and sizes, subjects, rule set, template. Belongs to a project. Has one or more directions.
- **Rule set:** Required assets, colour palette, required words per language, prohibited words per language. Belongs to a campaign. Can be copied from another campaign.
- **Template:** A list of image and copy slots. Shipped with the app.
- **Direction:** A named creative direction in a campaign. Has exactly one master variant and many linked variants.
- **Variant:** Unique short ID, title, ratio or size, language, format, duration, subjects, layers, status flags (out of date, overflow, translation unapproved, check warning, job running, missing file). Belongs to a direction. Its video settings are kept while its format is image (FR-120). *(Changed in 1.3: D-026.)*
- **Layer:** ID, type (background, image, text), geometry, style, content, visibility, lock, timing (start, end), optional entrance and exit animation (preset, start, duration), optional link to the matching layer in the master, and which inherited properties are overridden. Timing and animation are stored on layers of image variants as well as video variants. Background layers keep their transform (scale, position, crop) without discarding pixels.
- **Background clip:** One item on a video variant's background track: source asset, position in time, trim at each end. Belongs to one variant and is not linked.
- **Job:** A background task (for example image or video generation) with status and result. A generation job records the campaign and variant it belongs to, and the layer when it is for one layer (FR-217). Its result stays available until the user has dealt with it (FR-216). The app knows whether the user has looked at a finished result (FR-218). *(Changed in 1.4: D-028.)*
- **Open tabs:** Which campaigns are open as tabs, which variants are open inside each, which one is showing, and each variant tab's place (FR-211 to FR-213). Kept at least while the project stays open. Whether it is kept between sessions is not decided (Q-040). *(Added in 1.4: D-028.)*
- **Report:** The result of one export.
- **Log entry:** One recorded action, including whether the user or an agent made it.

### 6.2 Data Volumes & Retention
- No limit on the number of subjects, campaigns or variants in version 1, and no performance target tied to size.
- Project data is kept until the user deletes the project file. Asset files are kept until the user deletes them. The app applies no retention rules.

### 6.3 Data Privacy & Compliance
- The app collects no personal data and sends no telemetry.
- Brief content, prompts and reference images are sent to the AI providers the user has configured, under the user's own accounts.
- When the MCP server is on, a connected agent can read the open project's content, including the names of its assets and fonts but not the files themselves. That content then passes to whatever AI service runs the agent.
- Generated assets carry their prompt in file metadata. Anyone given such a file, including through cloud publishing, can read the prompt. Final exports do not carry it.
- Keys are stored encrypted on the user's machine, outside project files, assets folders and packaged projects, and are never committed to the repository or exposed to an agent.
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
| Cloud storage (S3 and Dropbox working; Azure listed but disabled) | Outbound | Provider API | Publish components and deliverables | User's account |
| Optional verification provider | Outbound | Provider API | Optional checks such as image colour | User's account |
| External agent app | Inbound | MCP | Read and edit the open project | User's own agent |

**IR-001:** Every AI job and the cloud storage connection sit behind a provider boundary. Swapping a provider must not change the rest of the app.

**IR-002:** Stakeholder preferences for the architect (not requirements):
- Gemini ("nanobanana") as the default for image generation and text layout, because one self-serve key covers both.
- A stubbed adapter for the Adobe Firefly API, plus a research task on integrating Adobe AI products without an enterprise account to test with. *(1.1: the research is done. No route without an enterprise plan was found. Firefly stays a stub. See OI-03.)*
- Seedance for image-to-video, to be tested through fal.ai, with a possible change of route.
- Jev (docs: https://docs.typesafe.ai/introduction) as the optional verification provider. The analyst has not read these docs (OI-01).
- Generation details embedded in files the way ComfyUI does it.

**IR-003:** The inbound agent connection uses MCP, as named by the stakeholder. It is limited to the same computer, to clients that present the access token (FR-191), and to the actions in Section 4.18.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- No generation blocks the UI. Image and video generation run in the background with a status indicator, and the user can work anywhere else in the project while they run (FR-215). *(Changed in 1.4: D-028. Before, this named video generation only.)*
- Moving between open campaign tabs and variant tabs must feel immediate to the user. No number has been set. *(Added in 1.4: D-028, "Things should be easy to navigate around".)*
- Exported animation must be identical on fast and slow machines.
- The stakeholder has set no targets for load, response time or export time.

### 8.2 Availability & Reliability
- The app runs on the user's machine. Manual work (import, layout, export) must work with no keys and no AI provider.
- Changes save automatically. A crash loses at most the edit in progress.

### 8.3 Scalability
- No hard limit on subjects per brief, campaigns per project, variants per campaign or video duration.
- No hard limit has been set on how many campaign tabs or variant tabs can be open. The navigation must stay usable when there are more tabs than fit across the window. *(Added in 1.4: D-028. The prototype was not tested with more tabs than fit.)*

### 8.4 Security
- **Authentication:** None in the app. Single user. The external agent connection needs an access token (FR-191).
- **Authorization Model:** None for the user. The external agent is limited to a fixed set of actions, with user permission required for destructive ones.
- **Compliance Standards:** None named.
- **Data Encryption:** Keys encrypted at rest. A saved AI provider key or cloud storage key can never be viewed. Only its last four characters are shown (FR-173). The agent access token is the exception: it is for use on the local computer, and the user can view it in full and copy it in the app (FR-191). *(Changed in 1.2: D-014.)*
- **Threat Model Notes:**
  - The repo is public, so no secret may be committed.
  - Project files and packaged projects are shared between people, so they must never contain keys.
  - A project file received from someone else can point at files on this computer. The app must link only files of an accepted type (FR-051), and must show the user which files a publish will upload before it uploads them.
  - The MCP server is a way into the app. It is off by default, reachable only from the same computer and only with the access token, never exposes keys, cannot spend the user's money on generation, cannot export or publish, and asks before destroying anything.
  - The access token can be viewed in the app by whoever is using the app on that computer. It is never exposed to an agent through the server. *(The stakeholder has not yet decided whether this rule stays: Section 11, Q-019. It applies until they do.)*

### 8.5 Auditability & Logging
- An export report per export (FR-150, FR-151).
- Generated assets carry provider, model and prompt (FR-068).
- A local activity log that marks agent-made actions (FR-153, FR-200).

### 8.6 Accessibility
Reference standard: WCAG 2.1 AA for the app's controls.
- Every control can be reached and triggered by keyboard. This includes the campaign tabs, the variant tabs and the project switcher. *(Changed in 1.4: D-028. Second sentence added.)*
- Every control has a label a screen reader can read.
- Focus is always visible.
- Text meets standard contrast levels.
- A tab's "running" and "finished, not yet looked at" marks (FR-218) are not carried by colour alone and can be read by a screen reader. *(Added in 1.4: D-028.)*
- The contents of the design canvas are best effort.

### 8.7 Maintainability & Operability
- Public repository with a README.
- Setup must be as short as possible. The user must not need the README or a settings file to get running.
- New versions are installed by manual download.
- Installers are unsigned in this build. The operating system's security warnings on first launch are accepted. *(Added in 1.1: R-16.)*
- Accepted exception to "must not need the README": the user may need the README for the first launch of an unsigned app. This covers only the standard steps for opening an unsigned app on the operating system. *(Added in 1.2: D-015.)*

### 8.8 Platforms
- macOS and Windows.

### 8.9 Look and Feel
- Clean and light, aimed at a non-technical user.
- Light theme only in this build.
- The navigation is built for parallel work (FR-210): campaign tabs on top, variant tabs inside a campaign, and a small project switcher beside the campaign tabs. The stakeholder tried this layout in prototype round 2 and accepted it ("Navigation layout feels MUCH better"). *(Added in 1.4: D-028.)*
- The app window opens maximized, not full screen (FR-220). *(Added in 1.4: D-031.)*
- The screen list below is a starting point. The stakeholder expects to adjust it during the build.
  - **Start screen:** create a project, open a project file, recent projects.
  - **Project switcher:** a small control beside the campaign tabs that names the open project. From it the user reaches the project home, switches to a recent project, opens a project file, creates a project and closes the project (FR-003). *(Changed in 1.4: D-028. Replaces "Project tabs: each open project is a tab in the one window".)*
  - **Campaign tabs:** one main tab per open campaign, with a way to open another campaign or start a new one (FR-211). A tab shows when its campaign has a generation running or a finished result not yet looked at (FR-218). *(Added in 1.4: D-028.)*
  - **Project home:** campaigns and subjects. New campaign from a brief file or a blank form.
  - **Campaign view:** a row of variant tabs: the overview, then one tab per open variant (FR-212). The overview is one grid of variants per direction, grouped by ratio, language and format, with thumbnails and status badges. Rule set, sync and export actions. A variant can be opened from its tile, with or without leaving the overview (FR-214). *(Changed in 1.4: D-028. Variant tabs and the two ways of opening added.)*
  - **Editor:** shown in a variant tab. Canvas in the centre, layer list on one side, properties on the other, timeline along the bottom for video variants. *(Changed in 1.4: D-028. "Shown in a variant tab" added.)*
  - **Panels and dialogs:** brief confirmation, template slots, generation, run confirmation (generation count and provider), fan-out background fit, sync review, export, publish, report, agent permission request, import (link or copy, library), locate a missing file, package project. The generation dialog can be closed while its run continues, and reopened on the finished result (FR-215, FR-216). *(Changed in 1.4: D-028. Last sentence added.)*
  - **Settings:** keys, default providers, cloud storage, default project location, MCP server on or off, MCP access token, automatic permission for agent actions.
  - **Activity panel:** background jobs from every open campaign in one list, with status and retry. Each entry names its campaign, variant and layer and leads there (FR-152, FR-217). *(Changed in 1.4: D-028.)*

---

## 9. Constraints

### 9.1 Technical Constraints
Fixed by the brief or the stakeholder:
- Electron desktop app with a React UI layer.
- SQLite database.
- FFmpeg included in the app for exporting video.
- MCP as the protocol for external agent control.
- GSAP is not used. *(Added in 1.1: R-14.)*

Stakeholder preferences for the architect (not fixed):
- Text rendered with HTML canvas or SVG.
- FFmpeg for burning text into video on export.
- Animated text: the earlier preference for GSAP timelines rendered frame by frame in a headless browser is withdrawn (R-14). How presets are computed is for the spec. FR-129 and FR-131 still apply.
- One storage interface (exists, read, write) with a local version and a cloud version.
- Predictable storage paths.

### 9.2 Organizational Constraints
- The repository is public.
- The user supplies their own keys for AI providers and cloud storage, and their own agent app for MCP.
- There is no enterprise Adobe account to test Firefly with.

### 9.3 Regulatory & Legal Constraints
- **Licence:** The code is public to read, but others must not be legally able to use it in their own commercial work. The brief calls the app "OSS"; this intent is narrower than open source as usually defined. The licence is PolyForm Noncommercial 1.0.0, confirmed by the stakeholder (R-19, closes OI-02).
- The licence terms of the included video tool and other bundled parts must be compatible with the chosen licence.
- Font licences may limit which fonts can be published to cloud storage (FR-162).

### 9.4 Timeline & Budget Constraints
None given. The stakeholder asked for this to be treated as a normal app build.

### 9.5 Changes to decisions in the original brief

| Original decision | Now |
|-------------------|-----|
| With cloud storage, assets survive reinstall by re-entering storage details | Dropped. The project file and its asset files on disk are the durable copy. Cloud is for sharing finished work. |
| The app finds existing assets from campaign and product IDs alone, with no hidden local index | Applies only to the published cloud layout, which must be browsable without the app. Locally, the project file is the index. |
| Source assets are shared across campaigns | True within a project. Not across projects. |
| "Products" | Renamed "Subjects". Still needs a unique ID. |
| Paths such as `outputs/{campaign-id}/{product-id}/{ratio}/post.png` | Export layout is by campaign, post title and ratio, with language and variant ID in the file name. The title defaults to the subject IDs. |
| A configurable local storage folder | Replaced by a default project location plus a location per project, and an assets folder location per project (FR-007). |
| Changes sync across localizations | Sync is manual, reviewed per variant, and skips overrides. |
| A vision model proposes the text layout | Still available. An external agent through MCP, or the user by hand, can do it instead. |
| Video: static text overlay on one generated video | Extended with a timeline, a multi-clip background track, and entrance and exit text animations. |
| "This will be OSS" | Public code with no commercial reuse by others (see 9.3). |

### 9.6 Changes agreed during architecture (version 1.1)

The stakeholder agreed each of these in the design dialogue with the architect. SPEC.md Section 0 is the source. R-12 and R-13 were proposed three times and not corrected, and are treated as accepted. Mechanisms (file format, protocols, libraries) are in SPEC.md, not here.

| # | Agreed change | Requirement text changed | Also touched |
|---|---------------|--------------------------|--------------|
| R-01 | An agent creates a campaign by sending structured brief fields. No AI extraction call and no confirm form for an agent. The campaign appears at once. An agent can delete a campaign it created. *(Corrected in 1.2, D-010: this row said "can be undone". The stakeholder meant delete, not undo.)* | FR-195 | FR-022 notes, FR-023 notes, workflow 5.7 |
| R-02 | In fan-out, a variant that differs from the master in both size and language copies its text position and size once from the variant with the same size in the master's language. One-time copy, not a link. | FR-079 | FR-075 notes, FR-078 notes, workflow 5.2 |
| R-03 | Word lists are per language. Required words are checked against a variant's combined text. Prohibited words are checked in every text layer. | FR-033, FR-113 | FR-021 notes, 6.1 Rule set, glossary |
| R-04 | The MCP server needs a token as well as accepting only same-computer connections. | FR-191 | IR-003, 8.4, 8.9, workflow 5.7, glossary |
| R-05 | Image and video variants can share one master. Format is a fan-out choice. Timing and animation are stored on every layer and follow the master. | FR-079 | FR-075 notes, 6.1 Layer and Background clip |
| R-06 | A project is a single file with a custom extension. It links to asset files that stay where they are. | FR-001, FR-002, new FR-009, A-01 | 1.4, FR-053 notes, 6.1 Project, Asset and Variant, 6.2, 6.3, 8.4, 8.9, 9.5, glossary |
| R-07 | Generated files go to a folder beside the project file, named after it. The user can change the location per project. | FR-001, new FR-007 | 6.1 Project, 9.5, glossary |
| R-08 | Import links files by default. The import dialog offers "copy into the assets folder". | FR-052, C-07 | FR-007, 6.1 Asset, 8.9, glossary |
| R-09 | "Package project" gathers the project file and all linked files into one folder. This is how a project moves to another machine. | 1.3 portability criterion, new FR-008 | 1.4, FR-001 notes, 8.9, glossary |
| R-10 | Saved keys can never be viewed. The last four characters are shown. The user can replace or delete a key. | FR-173 | 1.4, 8.4 |
| R-11 | An agent can list assets and fonts by name and ID, without file contents. | FR-192 | 6.3 |
| R-12 | Two libraries: reference (input to image generation only) and asset (can go on a post). A hero image is an asset-library image attached to a subject. | FR-054, FR-055, C-07 | FR-011 notes, 6.1 Project and Asset, glossary |
| R-13 | Definition of "present and visible" for a required asset. Cover by another layer is not tested. | FR-110 notes | |
| R-14 | No GSAP. | 9.1 | |
| R-15 | S3 and Dropbox work in this build. Azure is listed but disabled. | FR-160, C-03 | 1.4, Section 7 table |
| R-16 | Installers are unsigned in this build. First-launch security warnings are accepted. | 8.7 | 1.4 |
| R-17 | One undo list per variant and one per campaign. Deleting a variant can be undone from the campaign list. | FR-095 | |
| R-18 | Export also warns about unapproved translations and overflowing text, handled like brand and legal warnings. | FR-114, FR-115, new FR-116 | workflow 5.6, glossary |
| R-19 | The licence is PolyForm Noncommercial 1.0.0. | 9.3, OI-02 | |

New requirement numbers in 1.1: FR-007, FR-008, FR-009, FR-116. No existing number was changed or reused.

### 9.7 Stakeholder answers applied in version 1.2

The analyst raised questions on version 1.1. The stakeholder's answers are recorded in `DECISIONS.md` as D-010 to D-017. Rows R-05, R-09 and R-10 in Section 9.6 are left as the record of what was agreed at the time. The rows below add to them.

| # | Answer | Requirement text changed | Also touched |
|---|--------|--------------------------|--------------|
| D-010 | A campaign created by an agent is not undone. The agent can delete a campaign it created. A delete is not an undo. It needs the user's permission like any agent delete (FR-197). | FR-195 | FR-200, workflow 5.7, 9.6 row R-01 |
| D-011 | A packaged project includes everything related to the project: the project file, linked files, and the files in the assets folder. *(Refined in 1.3, D-022: see Section 9.8.)* | FR-008 | glossary |
| D-012 | An image variant can be changed to a video variant. Whether a video variant can go back to image is not decided (Q-015). *(Answered in 1.3, D-020: it can. See Section 9.8.)* | FR-120 | FR-075 notes |
| D-013 | Reading, not yet confirmed (Q-016): position and size follow the master only between variants of the same pixel size. *(Confirmed in 1.3: see Section 9.8.)* | FR-079 notes | |
| D-014 | The agent access token is for use on the local computer. The user can view and copy it. Provider and storage keys can still never be viewed. | FR-173 | FR-191 notes, 1.4, 8.4, glossary |
| D-015 | Needing the README for the standard first-launch steps of an unsigned app is an accepted exception. | 8.7, 1.3 | |
| D-016 | Accepted as written in 1.1: missing-file handling (FR-009), opening a project file from the operating system (FR-002 notes), showing the file list before a publish uploads (8.4), replacing the access token (FR-191 notes). | None | |
| D-017 | Revision history dates for versions 0.2, 0.3 and 1.0 corrected from 2026-11-21 to 2026-11-20. | Section 13 | |

No requirement number was added, changed or reused in 1.2.

### 9.8 Stakeholder answers applied in version 1.3

These answers arrived after version 1.2 was written. They are recorded in `DECISIONS.md`. D-021 is not applied: D-023 replaced it. The rows of Section 9.7 are left as the record of what was known at the time, with a pointer here where an answer changed.

| # | Answer | Requirement text changed | Also touched |
|---|--------|--------------------------|--------------|
| D-013 | Confirmed ("Correct"): position and size follow the master only between variants of the same pixel size. Closes Q-016. | FR-079 ("across ratios" became "across pixel sizes"; the "not yet confirmed" mark is removed from the note) | Section 11, 9.7 row D-013 |
| D-020 | A variant's format can be changed both ways: image to video and video back to image. Closes Q-015. | FR-120 | FR-075 notes, workflow 5.5, Section 11, 9.7 row D-012 |
| D-022 | "All staged assets can move with the project." Reading stated to the stakeholder: every asset the project has a record of is packaged, including generated options no variant uses. A file in the assets folder that the project has no record of is not packaged. | FR-008 | glossary, 9.7 row D-011 |
| D-023 | The app asks the user's permission for any campaign delete by an agent, whoever created the campaign. FR-197 already said this. | FR-195 (delete sentence and notes) | workflow 5.7 |
| D-024 | A brief with a single subject is valid. The app must also handle briefs with two or more subjects. | FR-021 | glossary |
| D-025 | An agent can change a variant's format. The rules for agent edits apply (FR-200). It is not a destructive action. | FR-195 | 3.2, FR-120 notes |
| D-026 | Settings that applied to a variant as a video are kept when it is changed to an image and later back to a video. | FR-120 | workflow 5.5, 6.1 Variant |
| D-027 | When a linked file is missing, "Package project" refuses unless the user confirms skipping the missing files. | FR-008 notes | FR-009 notes |

Wording corrected in 1.3 with no change of decision (SPEC.md Section 15, OI-19):

| Text | Correction |
|------|------------|
| FR-196 | Now names the readiness checks (FR-116) as well as the brand and legal checks, in line with FR-114. |
| FR-112 notes | Now says the requirement is not built in this build and that the assessment (OI-01) is due after this build. |
| FR-079 | "Across ratios" became "across pixel sizes" (listed under D-013 above). |

The other wordings listed in OI-19 were already corrected in 1.2: FR-195 and workflow 5.7 "can be undone" (D-010), the token exception in FR-173, 1.4 and 8.4 (D-014), the FR-075 notes on format change (D-012), and the README exception in 1.3 and 8.7 (D-015).

No requirement number was added, changed or reused in 1.3.

### 9.9 Navigation, parallel work and the window default (version 1.4)

The stakeholder gave two decisions after version 1.3, recorded in `DECISIONS.md`. D-028 came from feedback on prototype round 1. It was held back until the stakeholder had tried the new layout in prototype round 2, which they then accepted: "Navigation layout feels MUCH better". D-031 is the window default. D-029 (visual character), D-030 and D-032 change no requirement and are not applied here.

| # | Decision | Requirement text changed | Also touched |
|---|----------|--------------------------|--------------|
| D-028 | Navigation: the main tabs are open campaigns. Inside a campaign there are variant tabs. Switching project stays possible inside one running app but is the less common action. Projects are no longer tabs. | FR-003 (rewritten), new FR-211, FR-212, FR-213, FR-214 | 3.1, 6.1 Open tabs, 8.3, 8.6, 8.9 (Project switcher, Campaign tabs, Campaign view, Editor), FR-201 notes, glossary |
| D-028 | Parallel work is the design principle: the user works on several campaigns and variants at once, especially while a generation runs. | New FR-210, FR-215, FR-216, FR-217, FR-218. FR-152 (one list across all open campaigns) | 1.3, 1.4, FR-063 notes, FR-065 notes, FR-124 notes, workflow 5.1, workflow 5.5, new workflow 5.8, 6.1 Job, 8.1, 8.9 (Panels and dialogs, Activity panel), A-08, A-09, glossary |
| D-031 | The app window opens maximized, not full screen. | New FR-220 | 8.9, Section 11 (Q-036) |

The designer listed what the prototype shows that the requirements did not cover (`design/NOTES.md`, "Spec gaps"). Rulings for the gaps that belong to the accepted navigation:

| Gap | What the prototype shows | Ruling in 1.4 |
|-----|--------------------------|---------------|
| G-11 | Campaign tabs replace project tabs. One project per window with a switcher. | Requirement: FR-003, FR-211. "One project per window" is not decided (Q-038). |
| G-12 | Variant tabs inside a campaign, several open at once, each keeping its selected layer. | Requirement: FR-212, FR-213. Remembering tabs between sessions is not decided (Q-040). |
| G-13 | "Open in a tab, stay on the grid." | Requirement at P1: FR-214. What a plain click does is not decided (Q-041). |
| G-14 | A job knows its campaign, variant and layer, and has a "finished, not looked at yet" state shown on tabs, in Activity and in a message. | Requirement: FR-217, FR-218. The message at the moment of finishing is left to the design. Other tab signals are not decided (Q-042). |
| G-15 | A generation keeps running after its dialog is closed, and its options can be reopened later. | Requirement: FR-215, FR-216. What happens on a project switch or close is not decided (Q-039). |
| G-16 | Activity lists jobs from every open campaign together. | Requirement: FR-152. |

Not applied in 1.4, because the stakeholder has not decided them: G-1 to G-10 (Q-026 in `DECISIONS.md`), and G-17 to G-20 (several picture layers, cut-outs, "Choose from library", extra text layers, the wording of the agent-delete switch; Q-032 covers the first of these). Fonts, colours and other visual choices (D-029) are not requirements in this document.

Parts of the new requirements that are the analyst's reading, not the stakeholder's words. They are listed in Section 10.1 and are the first place to look if something seems wrong:

| Text | Reading |
|------|---------|
| FR-215 | Closing a campaign tab or a variant tab does not stop a generation. A second generation can be started while one runs (A-08). |
| FR-152 | A job stays in the activity panel after the tab of its campaign or variant is closed (A-09). |
| FR-214 | Priority P1. |
| 8.1, 8.3, 8.6 | The added lines on switching speed, more tabs than fit, and tab marks for accessibility follow from the principle and from the existing accessibility standard. The stakeholder did not state them. |

New requirement numbers in 1.4: FR-210 to FR-218 (new Section 4.19) and FR-220 (new Section 4.20). FR-219 is not used. FR-003 and FR-152 keep their numbers with changed text. No number was reused. New workflow: 5.8. New open questions: Q-038 to Q-042.

---

## 10. Assumptions

### 10.1 Assumptions not discussed with the stakeholder

| # | Assumption | Impact if Wrong |
|---|------------|-----------------|
| A-01 | Superseded in 1.1 by a stakeholder decision (R-06): each project is one file that holds its own data, and it links to asset files instead of containing them. No longer an assumption. | Not applicable. Portability now depends on "Package project" (FR-008). |
| A-02 | A project is opened by one person at a time | Shared network folders with two editors could corrupt data |
| A-03 | The user has internet access when using AI features and publishing | Offline behaviour for those features would need defining |
| A-04 | Users have their own accounts and billing with each AI provider | The app would need a way to supply or meter keys |
| A-05 | Analytics, approvals and posting to social platforms are handled by other tools | Scope would grow considerably |
| A-06 | A master variant is deleted only by deleting its whole direction | A rule for orphaned linked variants would be needed |
| A-07 | Video exports default to 30 frames per second and the user can raise it to 60 | Export settings UI would change |
| A-08 | Closing a campaign tab or a variant tab does not stop a generation that belongs to it, and the user can start a generation while another is running (FR-215). *(Added in 1.4.)* | If closing a tab should stop the run, or only one run is allowed at a time, FR-215 and FR-065 notes change and the app needs a warning before a tab closes |
| A-09 | A job stays listed in the activity panel after the tab of its campaign or variant is closed (FR-152). *(Added in 1.4.)* | The user could lose track of a result they paid for |

### 10.2 Analyst proposals accepted without comment
The stakeholder was told these would be treated as confirmed unless corrected, and did not correct them.

| # | Accepted answer | Where used |
|---|-----------------|------------|
| C-01 | The brief's cut-off sentence ("If ") held nothing that changes requirements | IR-002 |
| C-02 | Firefly is listed but disabled until it works | FR-067 |
| C-03 | Superseded in 1.1 (R-15): S3 and Dropbox must both work in this build. Azure is listed but disabled. Before: one cloud service must work first, the others follow. | FR-160 |
| C-04 | No share link after publishing | Scope |
| C-05 | Published contents as listed | FR-162 |
| C-06 | One cloud folder per campaign ID plus a warning before replacing | FR-164 |
| C-07 | Superseded in 1.1 (R-08, R-12): imported files are linked by default, with copying as a choice, and go into one of two libraries. They can still be attached to a subject. Before: imported files are copied into the project and held in a pool. | FR-052, FR-054 |
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

Architecture is complete. The table shows the state of each item from version 1.0 as recorded in SPEC.md Section 15. SPEC.md Section 15 continues the same numbering with items raised during architecture (OI-07 to OI-14) and is the live list.

| # | Item | Owner | Due Date |
|---|------|-------|----------|
| OI-01 | Open. Assess Jev (typesafe.ai) for image colour verification and decide whether FR-112 is built. The architect read only the introduction page and found the fit plausible. FR-112 is not built in this build. | Stakeholder, Architect | After this build |
| OI-02 | Closed. The licence is PolyForm Noncommercial 1.0.0, confirmed by the stakeholder (R-19). Bundled parts must stay compatible with it (9.3). | — | — |
| OI-03 | Closed. No route to Adobe AI products without an enterprise plan was found. Firefly is a stub only. | — | — |
| OI-04 | Open. Confirm the image-to-video provider route by testing: the Seedance model, its limits and its price on fal.ai. | Developer | Start of development Phase 7 |
| OI-05 | Closed. How generation details are embedded for each file type is decided in SPEC.md Section 6.6. | — | — |
| OI-06 | Open. Decide whether an agent may later start generation, export or publish, and under what limits | Stakeholder | After this build |

Questions open after version 1.4. They keep their numbers from `DECISIONS.md`, which is the live list of questions for the stakeholder. Q-015 and Q-016, listed here in 1.2, are answered (D-020, D-013) and removed. Q-038 to Q-042 are new in 1.4. The analyst chose the next free numbers; they are not yet entered in `DECISIONS.md`.

| # | Item | Owner | Due Date |
|---|------|-------|----------|
| Q-011 | Open. Review the wording of versions 1.1, 1.2, 1.3 and 1.4 so the status of this document can return to Approved. | Stakeholder | None set |
| Q-019 | Open. Should an agent ever be able to read the access token through the server? This document says no (8.4, FR-198), and that stays the rule until the stakeholder decides. | Stakeholder | Before development Phase 10 |
| Q-036 | Open. Window: open maximized on every launch, or only the first time and after that at the size the user last left it? Until answered: maximized on every launch (FR-220, SPEC.md OI-26). | Stakeholder | Before development Phase 11 |
| Q-038 | Open. Is one project visible per window right, or must the user be able to see two projects side by side? This also settles whether more than one project can be open in the app at once. Affects FR-003, FR-152 and FR-201. | Stakeholder | Before the navigation is built |
| Q-039 | Open. What happens to a running generation when the user switches to another project or closes the project: does it keep running, stop, or does the app ask first? And is a finished result that was never looked at still there when the project is opened again? Affects FR-003, FR-215 and FR-216. | Stakeholder | Before the navigation is built |
| Q-040 | Open. Are the open campaign tabs and variant tabs remembered the next time the project is opened? Affects FR-213. | Stakeholder | Before the navigation is built |
| Q-041 | Open. Does a plain click on a variant's tile go to the variant, or open it in a tab behind the overview? The prototype goes to the variant and has a separate control for staying. Also confirm P1 for FR-214. Affects FR-212 and FR-214. | Stakeholder | Before the navigation is built |
| Q-042 | Open. Should tabs also signal warnings such as "out of date" or a check warning, or only "running" and "finished, not yet looked at"? Affects FR-218. | Stakeholder | Before the navigation is built |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Project | A single file on the user's computer holding campaigns and subjects, with links to its assets |
| Project file | The one file that is a project. It has the app's own extension (`.adman`). |
| Assets folder | The folder, by default beside the project file and named after it, where generated files and copied imports are saved |
| Linked file | An imported file that stays where it is on the user's machine and is used by the project from there |
| Reference library | The project's files that are used only as input to image generation |
| Asset library | The project's files that can go on a post |
| Hero image | An asset-library image attached to a subject. Used on a post as-is. |
| Package project | The command that gathers everything related to a project (the project file and every asset file the project has a record of, whether linked or in its assets folder) into one folder, so the project can move to another machine |
| Subject | What an ad is about: a product or a service. Has a unique ID. Called "product" in the brief. |
| Campaign | A set of posts for one region, built from one brief |
| Brief | The input describing a campaign: one or more subjects, region, audience, message |
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
| Rule set | A campaign's required assets, colour palette, and required and prohibited words per language |
| Readiness check | A check before export for unapproved translations and for text that does not fit its box |
| Publish | Upload a campaign's components and deliverables to cloud storage |
| Provider | An outside service that performs an AI job or stores files |
| MCP server | The part of the app that lets an outside AI agent read and edit the open project, using the Model Context Protocol |
| Access token | A secret value the app issues. An agent app must present it to connect to the MCP server. The user can view and copy it in the app. |
| External agent | An AI assistant in another app that connects to the MCP server and acts for the user |
| Destructive action | An agent action that deletes a campaign or a variant |
| Campaign tab | A main tab of the app. There is one for each campaign the user has open (FR-211). |
| Variant tab | A tab inside a campaign. There is one for each variant the user has open in that campaign (FR-212). |
| Overview | The part of the campaign view that shows the grids of all the campaign's variants. Always available beside the variant tabs. |
| Project switcher | The control beside the campaign tabs that names the open project and lets the user go to another one (FR-003) |
| Activity panel | The one list of running and finished background jobs for the project's open campaigns (FR-152) |
| Not yet looked at | The state of a finished generation whose result the user has not seen (FR-218) |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-20 | Requirements Analyst | Work-in-progress draft with open questions and assumed answers |
| 0.2 | 2026-11-20 | Requirements Analyst | Open questions resolved. Added directions with one master each, variant short IDs, fan-out fit dialog, non-destructive background transforms, multi-clip background track, colour palette check, copyable rule sets, tabs, autosave, platforms, local log, licence intent. Priorities confirmed. |
| 0.3 | 2026-11-20 | Requirements Analyst | Added MCP server for external agent control (4.18, workflow 5.7). Starter template defined. No maximum video duration. Per-run provider choice. Generation details embedded in generated asset files. Custom ratios, copy generation, generation count, keyboard shortcuts and activity panel raised to P0. |
| 1.0 | 2026-11-20 | Requirements Analyst | Approved by the stakeholder. Agent export and publish confirmed as deferred. Agent assumptions and the published-prompt default moved to confirmed. |
| 1.1 | 2026-11-20 | Requirements Analyst | Brought in line with the requirement changes agreed during architecture (SPEC.md Section 0, R-01 to R-19). See Section 9.6 for the full map. Product named Adman. A project is now a single file that links to its assets, with an assets folder and a "Package project" command (FR-001, new FR-007, FR-008, FR-009). Import links by default (FR-052). Two libraries (FR-054, FR-055). Per-language word lists and a changed required-words check (FR-033, FR-113). "Present and visible" defined (FR-110). Readiness checks at export (FR-114, FR-115, new FR-116). Undo lists per variant and per campaign (FR-095). MCP access token (FR-191), agent asset list (FR-192), agent campaign creation without a form (FR-195). Saved keys cannot be viewed (FR-173). S3 and Dropbox both required (FR-160). Unsigned installers (8.7). GSAP not used (9.1). Licence chosen (9.3). Open items OI-02, OI-03 and OI-05 closed; OI-01 and OI-04 updated. Closes SPEC.md OI-13. |
| 1.2 | 2026-11-20 | Requirements Analyst | Applied the stakeholder's answers to the questions raised on 1.1 (DECISIONS.md D-010 to D-017). See Section 9.7 for the full map. An agent-created campaign is deleted, not undone (FR-195, FR-200, workflow 5.7, 9.6 row R-01). "Package project" includes everything related to the project (FR-008). An image variant can be changed to a video variant (FR-120, FR-075 notes). Position and size follow only at the same pixel size, reading not yet confirmed (FR-079 notes). The agent access token can be viewed and copied; provider and storage keys still cannot (FR-173, FR-191, 1.4, 8.4). README allowed for the first launch of an unsigned app (1.3, 8.7). Dates of versions 0.2, 0.3 and 1.0 corrected from 2026-11-21 to 2026-11-20. Open questions Q-011, Q-015 and Q-016 added to Section 11. No requirement number added or changed. |
| 1.3 | 2026-11-20 | Requirements Analyst | Applied the stakeholder's answers that arrived after 1.2 (DECISIONS.md D-013 as confirmed, D-020, D-022 to D-027; D-021 is superseded and not applied). See Section 9.8 for the full map. A variant's format can be changed both ways, and video settings survive a change to image and back (FR-120, FR-075 notes, workflow 5.5, 6.1 Variant). An agent can change a variant's format (FR-195, 3.2). Permission is needed for every agent campaign delete, including a campaign the agent created (FR-195, workflow 5.7). The same-pixel-size rule is confirmed and FR-079 now says "across pixel sizes". A brief with one subject is valid (FR-021, glossary). "Package project" takes every asset the project has a record of, leaves out files it has no record of, and needs the user's confirmation to skip missing linked files (FR-008, FR-009 notes, glossary). Stale wording corrected in FR-196 and the FR-112 notes (SPEC.md OI-19). Q-015 and Q-016 closed; Q-019 added to Section 11. Closes SPEC.md OI-19. No requirement number added or changed. |
| 1.4 | 2026-11-20 | Requirements Analyst | Applied D-028 (navigation and parallel work, accepted in prototype round 2) and D-031 (window default). See Section 9.9 for the full map. Projects are no longer tabs: the user switches project inside the running app (FR-003 rewritten). New Section 4.19: parallel work as the principle (FR-210), campaign tabs (FR-211), variant tabs (FR-212), every tab keeps its place (FR-213), opening a variant without leaving the overview (FR-214, P1), a generation continues when its dialog is closed (FR-215), its result can be reopened later (FR-216), every generation shows its campaign, variant and layer (FR-217), running and "finished, not yet looked at" are visible from anywhere in the project (FR-218). The activity panel is one list across all open campaigns (FR-152). New Section 4.20: the window opens maximized, not full screen (FR-220). New workflow 5.8. Notes added to FR-063, FR-065, FR-124 and FR-201. Also touched: 1.3, 1.4, 3.1, workflows 5.1 and 5.5, 6.1 (Job, Open tabs), 8.1, 8.3, 8.6, 8.9, glossary. Assumptions A-08 and A-09 added. Open questions Q-036 and Q-038 to Q-042 added to Section 11. Prototype gaps G-11 to G-16 ruled; G-1 to G-10 and G-17 to G-20 not applied. |
